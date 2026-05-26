/**
 * 轻量解析/同步记录（chrome.storage.local，最近 50 条）
 */

export const ACTIVITY_LOG_KEY = "bridgex_activity_log";
const MAX_ENTRIES = 50;

export function snapshotFieldStats(aiFields = {}, messageSent = "") {
  return {
    careerLen: String(aiFields.careerBackground || "").length,
    eduLen: String(aiFields.eduBackground || "").length,
    messageLen: String(messageSent || "").trim().length,
    icp: aiFields.icpSegment || "",
    role: aiFields.roleSegment || "",
  };
}

export async function appendActivityLog(entry) {
  const items = await chrome.storage.local.get(ACTIVITY_LOG_KEY);
  const list = Array.isArray(items[ACTIVITY_LOG_KEY]) ? items[ACTIVITY_LOG_KEY] : [];
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    ...entry,
  });
  if (list.length > MAX_ENTRIES) {
    list.length = MAX_ENTRIES;
  }
  await chrome.storage.local.set({ [ACTIVITY_LOG_KEY]: list });
}

export async function getActivityLogs() {
  const items = await chrome.storage.local.get(ACTIVITY_LOG_KEY);
  return Array.isArray(items[ACTIVITY_LOG_KEY]) ? items[ACTIVITY_LOG_KEY] : [];
}

export async function clearActivityLogs() {
  await chrome.storage.local.remove(ACTIVITY_LOG_KEY);
}

const TYPE_LABELS = {
  parse: "解析",
  sync: "同步",
};

const SOURCE_LABELS = {
  capture: "履历截屏",
  contact_capture: "联系方式截屏",
  text: "文本解析",
  paste_image: "粘贴图片",
  message: "消息分类",
};

const STATUS_LABELS = {
  ok: "成功",
  warn: "警告",
  err: "失败",
};

export function formatActivityLogLine(entry) {
  const time = new Date(entry.at).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
  const type = TYPE_LABELS[entry.type] || entry.type || "事件";
  const source = entry.source ? SOURCE_LABELS[entry.source] || entry.source : "";
  const status = STATUS_LABELS[entry.status] || entry.status || "";
  const name = entry.targetName ? ` · ${entry.targetName}` : "";
  const url = entry.url ? ` · ${truncateUrl(entry.url)}` : "";
  const model = entry.model ? ` · ${entry.model}` : "";
  const imgs =
    entry.imageCount != null
      ? ` · 图${entry.imageCount}/${entry.segmentCount ?? entry.imageCount}`
      : "";
  const stats = `履历${entry.careerLen ?? 0}字 教育${entry.eduLen ?? 0}字 消息${entry.messageLen ?? 0}字`;
  const tags = [entry.icp, entry.role].filter(Boolean).join(" / ");
  const tagPart = tags ? ` · ${tags}` : "";
  const action = entry.actionType ? ` · ${entry.actionType}` : "";
  const note = entry.note ? ` — ${entry.note}` : "";
  const err = entry.error ? ` — ${entry.error}` : "";

  return `[${time}] ${type}${source ? `(${source})` : ""} ${status}${name}${url}${model}${imgs}${action}\n  ${stats}${tagPart}${note}${err}`;
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname.length > 36 ? `${u.pathname.slice(0, 36)}…` : u.pathname;
  } catch {
    return String(url).slice(0, 40);
  }
}
