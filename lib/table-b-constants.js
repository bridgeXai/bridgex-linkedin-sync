/** 表 B 字段名与表 C status → 日汇总计数规则（方案 B 全量聚合） */

export const TABLE_B_FIELDS = {
  date: "date",
  accountId: "account_id",
  connectSent: "connect_sent",
  connectAccepted: "connect_accepted",
  messagesSent: "messages_sent",
  repliesReceived: "replies_received",
  actionType: "action_type",
};

/** 按表 C 当前 status 推断当日漏斗计数（与插件分次 +1 语义对齐） */
export const STATUS_ROLLUP_COUNTERS = {
  Sent: { connectSent: 1 },
  Connected: { connectSent: 1, connectAccepted: 1 },
  Messaged: { messagesSent: 1 },
  Replied: { repliesReceived: 1 },
  Positive: { repliesReceived: 1 },
  Meeting: { repliesReceived: 1 },
};

export function emptyDailyCounts() {
  return {
    connectSent: 0,
    connectAccepted: 0,
    messagesSent: 0,
    repliesReceived: 0,
  };
}

export function addCounts(target, delta) {
  target.connectSent += delta.connectSent || 0;
  target.connectAccepted += delta.connectAccepted || 0;
  target.messagesSent += delta.messagesSent || 0;
  target.repliesReceived += delta.repliesReceived || 0;
}

export function formatCounterForBitable(fieldName, value) {
  if (
    fieldName === TABLE_B_FIELDS.connectSent ||
    fieldName === TABLE_B_FIELDS.connectAccepted
  ) {
    return value;
  }
  return String(value);
}
