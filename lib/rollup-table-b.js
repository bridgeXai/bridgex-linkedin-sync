/**
 * 方案 B 全量：从表 C 按 status + sent_at 聚合，回写表 B 日计数
 */

import {
  TABLE_B_FIELDS,
  STATUS_ROLLUP_COUNTERS,
  emptyDailyCounts,
  addCounts,
  formatCounterForBitable,
} from "./table-b-constants.js";
import {
  getTenantAccessToken,
  listAllBitableRecords,
  searchBitableRecords,
  updateBitableRecord,
  createBitableRecord,
} from "./feishu-client.js";

function readTextField(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value[0]?.text) return String(value[0].text).trim();
  return "";
}

function readTimeMs(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function getLocalDayStartMs(timestampMs) {
  const date = new Date(timestampMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function rollupKey(accountId, dayStartMs) {
  return `${accountId}|${dayStartMs}`;
}

/**
 * @param {object} config
 * @param {object} options
 * @param {number} [options.sinceDayStartMs] 仅聚合 sent_at >= 该日 0:00 的记录
 * @param {number} [options.untilDayStartMs] 仅聚合 sent_at <= 该日 0:00 的记录（含当日）
 * @param {boolean} [options.dryRun]
 */
export function aggregateTableCRecords(records, fieldNames, options = {}) {
  const { sinceDayStartMs, untilDayStartMs } = options;
  const buckets = new Map();

  for (const record of records) {
    const fields = record.fields || {};
    const accountId = readTextField(fields[fieldNames.accountId]);
    const status = readTextField(fields[fieldNames.action]);
    const sentAtMs = readTimeMs(fields[fieldNames.time]);

    if (!accountId || !sentAtMs) continue;

    const dayStartMs = getLocalDayStartMs(sentAtMs);
    if (sinceDayStartMs != null && dayStartMs < sinceDayStartMs) continue;
    if (untilDayStartMs != null && dayStartMs > untilDayStartMs) continue;

    const delta = STATUS_ROLLUP_COUNTERS[status];
    if (!delta) continue;

    const key = rollupKey(accountId, dayStartMs);
    if (!buckets.has(key)) {
      buckets.set(key, { accountId, dayStartMs, counts: emptyDailyCounts() });
    }
    addCounts(buckets.get(key).counts, delta);
  }

  return buckets;
}

async function findDailyLogRow({ token, appToken, tableBId, accountId, dayStartMs }) {
  const items = await searchBitableRecords({
    token,
    appToken,
    tableId: tableBId,
    filter: {
      conjunction: "and",
      conditions: [
        {
          field_name: TABLE_B_FIELDS.accountId,
          operator: "is",
          value: [accountId],
        },
      ],
    },
  });

  return items.find((item) => {
    const dateVal = item.fields?.[TABLE_B_FIELDS.date];
    const rowDay = typeof dateVal === "number" ? dateVal : readTimeMs(dateVal);
    return getLocalDayStartMs(rowDay || dayStartMs) === dayStartMs;
  });
}

function buildTableBFields(counts) {
  return {
    [TABLE_B_FIELDS.connectSent]: formatCounterForBitable(
      TABLE_B_FIELDS.connectSent,
      counts.connectSent
    ),
    [TABLE_B_FIELDS.connectAccepted]: formatCounterForBitable(
      TABLE_B_FIELDS.connectAccepted,
      counts.connectAccepted
    ),
    [TABLE_B_FIELDS.messagesSent]: formatCounterForBitable(
      TABLE_B_FIELDS.messagesSent,
      counts.messagesSent
    ),
    [TABLE_B_FIELDS.repliesReceived]: formatCounterForBitable(
      TABLE_B_FIELDS.repliesReceived,
      counts.repliesReceived
    ),
  };
}

function inferActionTypes(counts) {
  const tags = [];
  if (counts.connectSent > 0 || counts.connectAccepted > 0) tags.push("Connect");
  if (counts.messagesSent > 0 || counts.repliesReceived > 0) tags.push("Message");
  return tags;
}

/**
 * @returns {Promise<{ buckets: number, updated: number, created: number, skipped: number, details: object[] }>}
 */
export async function rollupTableBFromTableC(config, options = {}) {
  const { dryRun = false, sinceDayStartMs, untilDayStartMs } = options;
  const { fieldNames } = config;

  if (!config.tableBId) {
    throw new Error("未配置表 B Table ID");
  }

  const token = await getTenantAccessToken(config.appId, config.appSecret);
  const tableCRecords = await listAllBitableRecords({
    token,
    appToken: config.appToken,
    tableId: config.tableId,
  });

  const buckets = aggregateTableCRecords(tableCRecords, fieldNames, {
    sinceDayStartMs,
    untilDayStartMs,
  });

  const details = [];
  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const bucket of buckets.values()) {
    const counterFields = buildTableBFields(bucket.counts);
    const actionTags = inferActionTypes(bucket.counts);

    const existing = await findDailyLogRow({
      token,
      appToken: config.appToken,
      tableBId: config.tableBId,
      accountId: bucket.accountId,
      dayStartMs: bucket.dayStartMs,
    });

    const detail = {
      accountId: bucket.accountId,
      day: new Date(bucket.dayStartMs).toISOString().slice(0, 10),
      counts: bucket.counts,
      recordId: existing?.record_id || null,
      action: null,
    };

    if (dryRun) {
      detail.action = existing ? "would_update" : "would_create";
      details.push(detail);
      if (existing) updated += 1;
      else created += 1;
      continue;
    }

    if (existing?.record_id) {
      const fields = { ...counterFields };
      if (actionTags.length) {
        fields[TABLE_B_FIELDS.actionType] = actionTags;
      }
      await updateBitableRecord({
        token,
        appToken: config.appToken,
        tableId: config.tableBId,
        recordId: existing.record_id,
        fields,
      });
      detail.action = "updated";
      updated += 1;
    } else if (
      bucket.counts.connectSent ||
      bucket.counts.connectAccepted ||
      bucket.counts.messagesSent ||
      bucket.counts.repliesReceived
    ) {
      const fields = {
        [TABLE_B_FIELDS.date]: bucket.dayStartMs,
        [TABLE_B_FIELDS.accountId]: bucket.accountId,
        ...counterFields,
      };
      if (actionTags.length) {
        fields[TABLE_B_FIELDS.actionType] = actionTags;
      }
      const result = await createBitableRecord({
        token,
        appToken: config.appToken,
        tableId: config.tableBId,
        fields,
      });
      detail.action = "created";
      detail.recordId = result.data?.record?.record_id;
      created += 1;
    } else {
      detail.action = "skipped_empty";
      skipped += 1;
    }

    details.push(detail);
  }

  return {
    tableCScanned: tableCRecords.length,
    buckets: buckets.size,
    updated,
    created,
    skipped,
    details,
  };
}
