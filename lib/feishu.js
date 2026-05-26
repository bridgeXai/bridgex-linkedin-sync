import { extractLinkedInSlug, normalizeLinkedInProfileUrl } from "./name-parser.js";
import { coercePainAngle, coerceOfferAngle } from "./angle-fields.js";
import {
  coerceCtaType,
  coerceIcpSegment,
  coerceMessageTemplateId,
  coerceRoleSegment,
} from "./segment-fields.js";

const FEISHU_ERROR_HINTS = {
  TextFieldConvFail:
    "飞书文本字段写入失败：① sent_at 若为「文本」列，请在设置选「日期文本」；若为「日期/日期时间」列则选「日期时间戳」。② 勿把整段履历写入 personalized_excerpt。③ 检查字段映射与列类型是否一致。",
  SingleSelectFieldConvFail:
    "飞书单选字段写入失败：写入值不在表头选项中。请核对 icp_segment / role_segment / pain_angle / offer_angle / cta_type / message_template_id 的选项是否与插件白名单一致。",
  DatetimeFieldConvFail:
    "飞书日期字段写入失败：sent_at 请使用「日期」或「日期时间」列 + 「日期时间戳」，或「文本」列 + 「日期文本」。",
};

const MAX_PERSONALIZED_EXCERPT_CHARS = 1500;

const TOKEN_URL =

  "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

const CONNECTED_STATUS = "Connected";



const TABLE_B_FIELDS = {

  date: "date",

  accountId: "account_id",

  connectSent: "connect_sent",

  connectAccepted: "connect_accepted",

  messagesSent: "messages_sent",

  repliesReceived: "replies_received",

  actionType: "action_type",

};



export const ACTION_STATUS_MAP = {

  "已发申请": "Sent",

  "已发消息": "Messaged",

  "已回复": "Replied",

  "连接已接受": "Connected",

  "其他": "Sent",

};



const TABLE_B_COUNTER_MAP = {

  "已发申请": { field: TABLE_B_FIELDS.connectSent, actionTag: "Connect" },

  "已发消息": { field: TABLE_B_FIELDS.messagesSent, actionTag: "Message" },

  "已回复": { field: TABLE_B_FIELDS.repliesReceived, actionTag: "Message" },

  "连接已接受": { field: TABLE_B_FIELDS.connectAccepted, actionTag: "Connect" },

};



export async function getTenantAccessToken(appId, appSecret) {

  const response = await fetch(TOKEN_URL, {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({

      app_id: appId,

      app_secret: appSecret,

    }),

  });



  const data = await response.json();

  if (!response.ok || data.code !== 0) {

    throw new Error(data.msg || `获取 Token 失败 (HTTP ${response.status})`);

  }

  return data.tenant_access_token;

}



function setTextField(fields, fieldName, value) {

  if (fieldName && value && !fields[fieldName]) {

    fields[fieldName] = value;

  }

}



function truncateShortText(text, max = MAX_PERSONALIZED_EXCERPT_CHARS) {

  const trimmed = (typeof text === "string" ? text : "").trim();

  if (!trimmed) return "";

  if (trimmed.length <= max) return trimmed;

  return `${trimmed.slice(0, max - 3)}...`;

}



function setSingleSelectField(fields, fieldName, value, coerceFn) {

  const coerced = coerceFn(value);

  if (fieldName && coerced) {

    fields[fieldName] = coerced;

  }

}



/** 北京时间，仅到「日」YYYY-MM-DD */
function getBeijingDateString(date = new Date()) {

  return new Intl.DateTimeFormat("en-CA", {

    timeZone: "Asia/Shanghai",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

  }).format(date);

}



/** 北京时间当日 0:00 的毫秒时间戳（无时分秒精度） */
function getBeijingDayStartMs(date = new Date()) {

  const dateStr = getBeijingDateString(date);

  return new Date(`${dateStr}T00:00:00+08:00`).getTime();

}



export function formatSentAtForBitable(timeFieldFormat = "date_ms") {

  if (timeFieldFormat === "text_iso" || timeFieldFormat === "date_text") {

    return getBeijingDateString();

  }

  // date_ms；兼容旧配置 datetime_ms
  return getBeijingDayStartMs();

}



function setLongTextField(fields, fieldName, value) {

  const text = typeof value === "string" ? value.trim() : "";

  if (fieldName && text) {

    fields[fieldName] = text;

  }

}



function getTodayStartTimestamp() {

  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date.getTime();

}



function isSameLocalDay(timestamp, dayStart) {

  return typeof timestamp === "number" && timestamp >= dayStart && timestamp < dayStart + 86400000;

}



function readCounterValue(value) {

  if (value == null || value === "") return 0;

  if (typeof value === "number") return value;

  if (typeof value === "string") return Number(value) || 0;

  if (Array.isArray(value) && value[0]?.text != null) return Number(value[0].text) || 0;

  return 0;

}



function readAccountId(value) {

  if (typeof value === "string") return value;

  if (Array.isArray(value) && value[0]?.text) return value[0].text;

  return "";

}



function readMultiSelect(value) {

  if (!Array.isArray(value)) return [];

  return value.filter(Boolean);

}



function formatCounterValue(fieldName, nextValue) {

  if (
    fieldName === TABLE_B_FIELDS.connectSent ||
    fieldName === TABLE_B_FIELDS.connectAccepted
  ) {

    return nextValue;

  }

  return String(nextValue);

}



function mergeActionTypes(existingValue, actionTag) {

  const current = readMultiSelect(existingValue);

  if (!actionTag || current.includes(actionTag)) return current;

  return [...current, actionTag];

}



function buildForbiddenError() {

  return new Error(

    "飞书 Forbidden：开放平台权限已开通，但应用尚未获得这张多维表格的文档级编辑权限。请打开该 Base → 右上角「…」→「更多」→「添加文档应用」，选择本应用并授予「可编辑」或「可管理」。若表开启了高级权限，需给「可管理」。"

  );

}



async function parseFeishuResponse(response) {

  let data = null;

  try {

    data = await response.json();

  } catch {

    data = null;

  }



  if (!response.ok || data?.code !== 0) {

    if (response.status === 403 || data?.code === 91403 || data?.code === 1254302 || data?.code === 1254304) {

      throw buildForbiddenError();

    }

    const code = data?.code != null ? String(data.code) : "";

    const msg = data?.msg || `飞书接口失败 (HTTP ${response.status})`;

    const hint = FEISHU_ERROR_HINTS[msg] || FEISHU_ERROR_HINTS[code];

    throw new Error(hint ? `${msg}：${hint}` : msg);

  }



  return data;

}



export function buildRecordFields({
  name,
  url,
  title,
  company,
  region,
  contactEmail,
  contactPhone,
  memo,
  messageSent,
  actionType,
  accountId,
  operatorName,
  fieldNames,
  aiFields = {},
  timeFieldFormat = "date_ms",
}) {
  const fields = {};
  fields[fieldNames.name] = name;
  fields[fieldNames.url] = url;
  fields[fieldNames.action] = ACTION_STATUS_MAP[actionType] || actionType;
  fields[fieldNames.time] = formatSentAtForBitable(timeFieldFormat);
  setTextField(fields, fieldNames.title, title);
  setTextField(fields, fieldNames.company, company);
  setTextField(fields, fieldNames.region, region);
  setTextField(fields, fieldNames.contactEmail, contactEmail);
  setTextField(fields, fieldNames.contactPhone, contactPhone);
  setTextField(fields, fieldNames.accountId, accountId);
  setTextField(fields, fieldNames.operatorName, operatorName);

  setSingleSelectField(fields, fieldNames.icpSegment, aiFields.icpSegment, coerceIcpSegment);

  setSingleSelectField(fields, fieldNames.roleSegment, aiFields.roleSegment, coerceRoleSegment);

  setLongTextField(fields, fieldNames.careerBackground, aiFields.careerBackground);

  setLongTextField(fields, fieldNames.eduBackground, aiFields.eduBackground);

  setSingleSelectField(fields, fieldNames.painAngle, aiFields.painAngle, coercePainAngle);

  setSingleSelectField(fields, fieldNames.offerAngle, aiFields.offerAngle, coerceOfferAngle);

  setSingleSelectField(fields, fieldNames.ctaType, aiFields.ctaType, coerceCtaType);

  setSingleSelectField(
    fields,
    fieldNames.messageTemplateId,
    aiFields.messageTemplateId,
    coerceMessageTemplateId
  );

  // 个性化摘录：仅写 AI 短句，禁止把整段履历素材写入短文本列
  setTextField(
    fields,
    fieldNames.personalizedExcerpt,
    truncateShortText(aiFields.personalizedExcerpt)
  );

  if (fieldNames.memo && fieldNames.memo !== fieldNames.personalizedExcerpt) {
    setLongTextField(fields, fieldNames.memo, memo);
  }

  setLongTextField(fields, fieldNames.messageSent, messageSent);

  return fields;

}



export async function createBitableRecord({ token, appToken, tableId, fields }) {

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`;



  const response = await fetch(url, {

    method: "POST",

    headers: {

      "Content-Type": "application/json; charset=utf-8",

      Authorization: `Bearer ${token}`,

    },

    body: JSON.stringify({ fields }),

  });



  return parseFeishuResponse(response);

}



async function updateBitableRecord({ token, appToken, tableId, recordId, fields }) {

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`;



  const response = await fetch(url, {

    method: "PUT",

    headers: {

      "Content-Type": "application/json; charset=utf-8",

      Authorization: `Bearer ${token}`,

    },

    body: JSON.stringify({ fields }),

  });



  return parseFeishuResponse(response);

}



async function findTodayDailyLog({ token, appToken, tableId, accountId }) {

  const searchUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/search`;

  const response = await fetch(searchUrl, {

    method: "POST",

    headers: {

      "Content-Type": "application/json; charset=utf-8",

      Authorization: `Bearer ${token}`,

    },

    body: JSON.stringify({

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

      page_size: 50,

    }),

  });



  const data = await parseFeishuResponse(response);

  const dayStart = getTodayStartTimestamp();

  return (data.data?.items || []).find((item) => {

    const fields = item.fields || {};

    const sameAccount = readAccountId(fields[TABLE_B_FIELDS.accountId]) === accountId;

    return sameAccount && isSameLocalDay(fields[TABLE_B_FIELDS.date], dayStart);

  });

}



async function incrementDailyLogCounter({ token, appToken, tableId, accountId, actionType }) {

  const counterConfig = TABLE_B_COUNTER_MAP[actionType];

  if (!counterConfig || !accountId) {

    return { skipped: true };

  }



  const dayStart = getTodayStartTimestamp();

  const existing = await findTodayDailyLog({ token, appToken, tableId, accountId });

  const counterField = counterConfig.field;

  const nextValue = readCounterValue(existing?.fields?.[counterField]) + 1;



  if (existing?.record_id) {

    const fields = {

      [counterField]: formatCounterValue(counterField, nextValue),

    };

    const mergedActionTypes = mergeActionTypes(

      existing.fields?.[TABLE_B_FIELDS.actionType],

      counterConfig.actionTag

    );

    if (mergedActionTypes.length) {

      fields[TABLE_B_FIELDS.actionType] = mergedActionTypes;

    }

    await updateBitableRecord({

      token,

      appToken,

      tableId,

      recordId: existing.record_id,

      fields,

    });

    return { updated: true, recordId: existing.record_id, field: counterField, value: nextValue };

  }



  const fields = {

    [TABLE_B_FIELDS.date]: dayStart,

    [TABLE_B_FIELDS.accountId]: accountId,

    [counterField]: formatCounterValue(counterField, 1),

    [TABLE_B_FIELDS.actionType]: [counterConfig.actionTag],

  };



  if (counterField !== TABLE_B_FIELDS.connectSent) {

    fields[TABLE_B_FIELDS.connectSent] = 0;

  }

  if (counterField !== TABLE_B_FIELDS.messagesSent) {

    fields[TABLE_B_FIELDS.messagesSent] = "0";

  }

  if (counterField !== TABLE_B_FIELDS.repliesReceived) {

    fields[TABLE_B_FIELDS.repliesReceived] = "0";

  }

  if (counterField !== TABLE_B_FIELDS.connectAccepted) {

    fields[TABLE_B_FIELDS.connectAccepted] = 0;

  }



  const created = await createBitableRecord({ token, appToken, tableId, fields });

  return {

    created: true,

    recordId: created.data?.record?.record_id,

    field: counterField,

    value: 1,

  };

}



function readUrlField(value) {

  if (typeof value === "string") return value;

  if (value && typeof value === "object" && value.link) return value.link;

  if (Array.isArray(value) && value[0]?.link) return value[0].link;

  if (Array.isArray(value) && value[0]?.text) return value[0].text;

  return "";

}



function readStatusField(value) {

  if (typeof value === "string") return value;

  if (Array.isArray(value) && value[0]) return value[0].text || value[0].name || "";

  return "";

}



function readTimeField(value) {

  if (typeof value === "number") return value;

  if (typeof value === "string") return Date.parse(value) || 0;

  return 0;

}



async function searchBitableRecords({ token, appToken, tableId, filter, pageSize = 50 }) {

  const searchUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/search`;

  const response = await fetch(searchUrl, {

    method: "POST",

    headers: {

      "Content-Type": "application/json; charset=utf-8",

      Authorization: `Bearer ${token}`,

    },

    body: JSON.stringify({

      filter,

      page_size: pageSize,

    }),

  });



  const data = await parseFeishuResponse(response);

  return data.data?.items || [];

}



async function findReachOutRecordsByUrl({ token, appToken, tableId, urlFieldName, accountFieldName, accountId, url }) {

  const slug = extractLinkedInSlug(url);

  if (!slug) return [];



  const conditions = [

    {

      field_name: urlFieldName,

      operator: "contains",

      value: [slug],

    },

  ];



  if (accountId && accountFieldName) {

    conditions.push({

      field_name: accountFieldName,

      operator: "is",

      value: [accountId],

    });

  }



  const items = await searchBitableRecords({

    token,

    appToken,

    tableId,

    filter: { conjunction: "and", conditions },

  });



  const targetUrl = normalizeLinkedInProfileUrl(url);

  return items.filter((item) => {

    const recordUrl = readUrlField(item.fields?.[urlFieldName]);

    return normalizeLinkedInProfileUrl(recordUrl) === targetUrl;

  });

}



function pickLatestReachOutRecord(records, timeFieldName) {

  if (!records.length) return null;

  return records.reduce((latest, item) => {

    if (!latest) return item;

    const latestTime = readTimeField(latest.fields?.[timeFieldName]);

    const itemTime = readTimeField(item.fields?.[timeFieldName]);

    return itemTime >= latestTime ? item : latest;

  }, null);

}



async function syncConnectedToFeishu(config, payload) {

  const token = await getTenantAccessToken(config.appId, config.appSecret);

  const { fieldNames } = config;

  const matches = await findReachOutRecordsByUrl({

    token,

    appToken: config.appToken,

    tableId: config.tableId,

    urlFieldName: fieldNames.url,

    accountFieldName: fieldNames.accountId,

    accountId: config.accountId,

    url: payload.url,

  });



  const latest = pickLatestReachOutRecord(matches, fieldNames.time);

  let tableCResult = null;

  let shouldIncrementB = true;



  if (latest?.record_id) {

    const currentStatus = readStatusField(latest.fields?.[fieldNames.action]);

    if (currentStatus === CONNECTED_STATUS) {

      shouldIncrementB = false;

      tableCResult = { alreadyConnected: true, recordId: latest.record_id };

    } else {

      const updateFields = { [fieldNames.action]: CONNECTED_STATUS };
      setTextField(updateFields, fieldNames.contactEmail, payload.contactEmail);
      setTextField(updateFields, fieldNames.contactPhone, payload.contactPhone);

      await updateBitableRecord({

        token,

        appToken: config.appToken,

        tableId: config.tableId,

        recordId: latest.record_id,

        fields: updateFields,

      });

      tableCResult = { updated: true, recordId: latest.record_id };

    }

  } else {

    const fields = buildRecordFields({

      name: payload.name,

      url: payload.url,

      title: payload.title,

      company: payload.company,

      region: payload.region,

      contactEmail: payload.contactEmail,

      contactPhone: payload.contactPhone,

      memo: payload.memo,

      messageSent: payload.messageSent,

      actionType: "连接已接受",

      accountId: config.accountId,

      operatorName: config.operator,

      fieldNames,

      aiFields: payload.aiFields || {},

      timeFieldFormat: config.timeFieldFormat,

    });

    const created = await createBitableRecord({

      token,

      appToken: config.appToken,

      tableId: config.tableId,

      fields,

    });

    tableCResult = {

      created: true,

      recordId: created.data?.record?.record_id,

    };

  }



  let tableBResult = null;

  let tableBError = null;



  if (shouldIncrementB && config.tableBId) {

    try {

      tableBResult = await incrementDailyLogCounter({

        token,

        appToken: config.appToken,

        tableId: config.tableBId,

        accountId: config.accountId,

        actionType: "连接已接受",

      });

    } catch (error) {

      tableBError = error.message || "表 B 统计更新失败";

    }

  } else if (!shouldIncrementB) {

    tableBResult = { skipped: true, reason: "already_connected" };

  }



  return { tableCResult, tableBResult, tableBError };

}



export async function syncActionToFeishu(config, {

  name,

  url,

  title,

  company,

  region,

  contactEmail,

  contactPhone,

  memo,

  messageSent,

  actionType,

  aiFields,

}) {

  if (actionType === "连接已接受") {

    return syncConnectedToFeishu(config, {

      name,

      url,

      title,

      company,

      region,

      contactEmail,

      contactPhone,

      memo,

      messageSent,

      aiFields,

    });

  }

  const token = await getTenantAccessToken(config.appId, config.appSecret);

  const fields = buildRecordFields({
    name,
    url,
    title,
    company,
    region,
    contactEmail,
    contactPhone,
    memo,
    messageSent,
    actionType,
    accountId: config.accountId,
    operatorName: config.operator,
    fieldNames: config.fieldNames,
    aiFields,
    timeFieldFormat: config.timeFieldFormat,
  });



  const tableCResult = await createBitableRecord({

    token,

    appToken: config.appToken,

    tableId: config.tableId,

    fields,

  });



  let tableBResult = null;

  let tableBError = null;



  if (config.tableBId) {

    try {

      tableBResult = await incrementDailyLogCounter({

        token,

        appToken: config.appToken,

        tableId: config.tableBId,

        accountId: config.accountId,

        actionType,

      });

    } catch (error) {

      tableBError = error.message || "表 B 统计更新失败";

    }

  }



  return { tableCResult, tableBResult, tableBError };

}

