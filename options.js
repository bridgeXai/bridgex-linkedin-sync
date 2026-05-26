import {
  DEFAULT_FIELD_NAMES,
  loadConfig,
  saveConfig,
  validateConfig,
} from "./lib/config.js";
import { getTenantAccessToken } from "./lib/feishu.js";
import {
  clearActivityLogs,
  formatActivityLogLine,
  getActivityLogs,
} from "./lib/activity-log.js";

const form = document.getElementById("config-form");
const statusEl = document.getElementById("status");
const testBtn = document.getElementById("test-btn");

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function readForm() {
  return {
    appToken: document.getElementById("app-token").value.trim(),
    tableId: document.getElementById("table-id").value.trim(),
    tableBId: document.getElementById("table-b-id").value.trim(),
    operator: document.getElementById("operator-name").value.trim(),
    accountId: document.getElementById("account-id").value.trim(),
    timeFieldFormat: document.getElementById("time-field-format").value || "date_ms",
    fieldNames: {
      name: document.getElementById("field-name").value.trim() || DEFAULT_FIELD_NAMES.name,
      url: document.getElementById("field-url").value.trim() || DEFAULT_FIELD_NAMES.url,
      action: document.getElementById("field-action").value.trim() || DEFAULT_FIELD_NAMES.action,
      time: document.getElementById("field-time").value.trim() || DEFAULT_FIELD_NAMES.time,
      memo: document.getElementById("field-memo").value.trim() || DEFAULT_FIELD_NAMES.memo,
      accountId:
        document.getElementById("field-account-id").value.trim() || DEFAULT_FIELD_NAMES.accountId,
      operatorName:
        document.getElementById("field-operator-name").value.trim() ||
        DEFAULT_FIELD_NAMES.operatorName,
      company: document.getElementById("field-company").value.trim() || DEFAULT_FIELD_NAMES.company,
      title: document.getElementById("field-title").value.trim() || DEFAULT_FIELD_NAMES.title,
      region: document.getElementById("field-region").value.trim() || DEFAULT_FIELD_NAMES.region,
      contactEmail:
        document.getElementById("field-contact-email").value.trim() ||
        DEFAULT_FIELD_NAMES.contactEmail,
      contactPhone:
        document.getElementById("field-contact-phone").value.trim() ||
        DEFAULT_FIELD_NAMES.contactPhone,
      icpSegment:
        document.getElementById("field-icp-segment").value.trim() || DEFAULT_FIELD_NAMES.icpSegment,
      roleSegment:
        document.getElementById("field-role-segment").value.trim() || DEFAULT_FIELD_NAMES.roleSegment,
      careerBackground:
        document.getElementById("field-career-background").value.trim() ||
        DEFAULT_FIELD_NAMES.careerBackground,
      eduBackground:
        document.getElementById("field-edu-background").value.trim() ||
        DEFAULT_FIELD_NAMES.eduBackground,
      painAngle:
        document.getElementById("field-pain-angle").value.trim() || DEFAULT_FIELD_NAMES.painAngle,
      offerAngle:
        document.getElementById("field-offer-angle").value.trim() || DEFAULT_FIELD_NAMES.offerAngle,
      ctaType:
        document.getElementById("field-cta-type").value.trim() || DEFAULT_FIELD_NAMES.ctaType,
      messageTemplateId:
        document.getElementById("field-message-template-id").value.trim() ||
        DEFAULT_FIELD_NAMES.messageTemplateId,
      personalizedExcerpt:
        document.getElementById("field-personalized-excerpt").value.trim() ||
        DEFAULT_FIELD_NAMES.personalizedExcerpt,
      messageSent:
        document.getElementById("field-message-sent").value.trim() ||
        DEFAULT_FIELD_NAMES.messageSent,
    },
  };
}

function fillForm(config) {
  document.getElementById("app-token").value = config.appToken;
  document.getElementById("table-id").value = config.tableId;
  document.getElementById("table-b-id").value = config.tableBId;
  document.getElementById("operator-name").value = config.operator;
  document.getElementById("account-id").value = config.accountId;
  const timeFormat = config.timeFieldFormat || "date_ms";
  const timeSelect = document.getElementById("time-field-format");
  const legacyMap = { datetime_ms: "date_ms", text_iso: "date_text" };
  timeSelect.value = legacyMap[timeFormat] || timeFormat;
  document.getElementById("field-name").value = config.fieldNames.name;
  document.getElementById("field-url").value = config.fieldNames.url;
  document.getElementById("field-action").value = config.fieldNames.action;
  document.getElementById("field-time").value = config.fieldNames.time;
  document.getElementById("field-memo").value = config.fieldNames.memo;
  document.getElementById("field-account-id").value = config.fieldNames.accountId;
  document.getElementById("field-operator-name").value = config.fieldNames.operatorName;
  document.getElementById("field-company").value = config.fieldNames.company;
  document.getElementById("field-title").value = config.fieldNames.title;
  document.getElementById("field-region").value = config.fieldNames.region;
  document.getElementById("field-contact-email").value = config.fieldNames.contactEmail;
  document.getElementById("field-contact-phone").value = config.fieldNames.contactPhone;
  document.getElementById("field-icp-segment").value = config.fieldNames.icpSegment;
  document.getElementById("field-role-segment").value = config.fieldNames.roleSegment;
  document.getElementById("field-career-background").value = config.fieldNames.careerBackground;
  document.getElementById("field-edu-background").value = config.fieldNames.eduBackground;
  document.getElementById("field-pain-angle").value = config.fieldNames.painAngle;
  document.getElementById("field-offer-angle").value = config.fieldNames.offerAngle;
  document.getElementById("field-cta-type").value = config.fieldNames.ctaType;
  document.getElementById("field-message-template-id").value = config.fieldNames.messageTemplateId;
  document.getElementById("field-personalized-excerpt").value = config.fieldNames.personalizedExcerpt;
  document.getElementById("field-message-sent").value = config.fieldNames.messageSent;
}

const activityLogList = document.getElementById("activity-log-list");
const refreshLogBtn = document.getElementById("refresh-log-btn");
const clearLogBtn = document.getElementById("clear-log-btn");

async function renderActivityLogs() {
  if (!activityLogList) return;
  const logs = await getActivityLogs();
  if (!logs.length) {
    activityLogList.textContent = "暂无记录。请在 popup 中执行「履历截屏」或同步后刷新。";
    return;
  }
  activityLogList.textContent = logs.map((entry) => formatActivityLogLine(entry)).join("\n\n");
}

async function init() {
  const config = await loadConfig();
  fillForm(config);
  await renderActivityLogs();
  if (location.hash === "#activity-log") {
    document.getElementById("activity-log")?.scrollIntoView({ behavior: "smooth" });
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const config = { ...(await loadConfig()), ...readForm() };
  const missing = validateConfig(config);
  if (missing.length) {
    setStatus(`请填写：${missing.join("、")}`, "err");
    return;
  }

  await saveConfig(config);
  setStatus("配置已保存", "ok");
});

testBtn.addEventListener("click", async () => {
  const config = { ...(await loadConfig()), ...readForm() };
  const missing = validateConfig(config);
  if (missing.length) {
    setStatus(`请填写：${missing.join("、")}`, "err");
    return;
  }

  testBtn.disabled = true;
  setStatus("正在测试 Token…");

  try {
    const token = await getTenantAccessToken(config.appId, config.appSecret);
    if (!token) {
      throw new Error("未返回有效 Token");
    }
    setStatus("连接成功，飞书凭证有效", "ok");
  } catch (error) {
    setStatus(error.message || "连接失败", "err");
  } finally {
    testBtn.disabled = false;
  }
});

if (refreshLogBtn) {
  refreshLogBtn.addEventListener("click", () => {
    renderActivityLogs();
    setStatus("记录已刷新", "ok");
  });
}

if (clearLogBtn) {
  clearLogBtn.addEventListener("click", async () => {
    await clearActivityLogs();
    await renderActivityLogs();
    setStatus("记录已清空", "ok");
  });
}

init();
