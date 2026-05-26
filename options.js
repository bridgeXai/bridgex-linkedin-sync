import { loadConfig, saveConfig, validateConfig } from "./lib/config.js";
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

function readIdentityFromForm() {
  return {
    operator: document.getElementById("operator-name").value.trim(),
    accountId: document.getElementById("account-id").value.trim(),
  };
}

function fillIdentityForm(config) {
  document.getElementById("operator-name").value = config.operator;
  document.getElementById("account-id").value = config.accountId;
}

async function readFullConfig() {
  const config = await loadConfig();
  return { ...config, ...readIdentityFromForm() };
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
  fillIdentityForm(config);
  await renderActivityLogs();
  if (location.hash === "#activity-log") {
    document.getElementById("activity-log")?.scrollIntoView({ behavior: "smooth" });
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const config = await readFullConfig();
  const missing = validateConfig(config);
  if (missing.length) {
    setStatus(`请填写：${missing.join("、")}`, "err");
    return;
  }

  await saveConfig(config);
  setStatus("已保存", "ok");
});

testBtn.addEventListener("click", async () => {
  const config = await readFullConfig();
  const missing = validateConfig(config, { requireIdentity: false });
  if (missing.length) {
    setStatus(missing.join("；"), "err");
    return;
  }

  testBtn.disabled = true;
  setStatus("正在测试飞书连接…");

  try {
    const token = await getTenantAccessToken(config.appId, config.appSecret);
    if (!token) {
      throw new Error("未返回有效 Token");
    }
    setStatus("飞书连接正常（表格配置已内置）", "ok");
  } catch (error) {
    setStatus(error.message || "连接失败，请联系管理员检查 secrets.js", "err");
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
