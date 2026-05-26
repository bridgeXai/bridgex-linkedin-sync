import { loadConfig, validateConfig } from "./lib/config.js";
import { syncActionToFeishu } from "./lib/feishu.js";
import { DEFAULT_MODEL, parseContactInfoContent, parseOutreachMessage, parseResumeContent } from "./lib/llm.js";
import { normalizeContactFields } from "./lib/contact-fields.js";
import { appendActivityLog, snapshotFieldStats } from "./lib/activity-log.js";
import { extractLinkedInSlug, isLinkedInUrl, normalizeLinkedInProfileUrl, parseNameFromTitle } from "./lib/name-parser.js";
import { enrichAiFieldsWithAngles } from "./lib/angle-fields.js";
import { coerceSegmentFields } from "./lib/segment-fields.js";
import {
  buildMemoPreviewText,
  enrichAiFieldsFromMemo,
  extractBackgroundSections,
  mergeBackgroundText,
  pickImagesForLlm,
  toAiFieldsFromParsed,
} from "./lib/resume-fields.js";

const nameInput = document.getElementById("name-input");
const titleInput = document.getElementById("title-input");
const companyInput = document.getElementById("company-input");
const regionInput = document.getElementById("region-input");
const contactEmailInput = document.getElementById("contact-email-input");
const contactPhoneInput = document.getElementById("contact-phone-input");
const contactReadBtn = document.getElementById("contact-read-btn");
const urlInput = document.getElementById("url-input");
const memoInput = document.getElementById("memo-input");
const messageInput = document.getElementById("message-input");
const messageAiBtn = document.getElementById("message-ai-btn");
const messageAiPreview = document.getElementById("message-ai-preview");
const resumeCaptureBtn = document.getElementById("resume-capture-btn");
const aiExtraPreview = document.getElementById("ai-extra-preview");
const pageHint = document.getElementById("page-hint");
const statusEl = document.getElementById("status");
const actionButtons = document.querySelectorAll(".action-btn");

let busy = false;
let latestAiFields = {};
let latestMessageAiFields = {};
let currentDraftKey = "";
let draftSaveTimer = null;

const DRAFT_PREFIX = "profile_draft:";

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function setBusy(nextBusy) {
  busy = nextBusy;
  actionButtons.forEach((button) => {
    button.disabled = nextBusy;
  });
  if (resumeCaptureBtn) resumeCaptureBtn.disabled = nextBusy;
  if (contactReadBtn) contactReadBtn.disabled = nextBusy;
  if (messageAiBtn) messageAiBtn.disabled = nextBusy;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function normalizeProfileUrl(url) {
  if (isLinkedInUrl(url)) {
    return normalizeLinkedInProfileUrl(url);
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.split(/[?#]/)[0].replace(/\/$/, "");
  }
}

function getDraftKey(url) {
  const normalizedUrl = normalizeProfileUrl(url);
  return normalizedUrl ? `${DRAFT_PREFIX}${normalizedUrl}` : "";
}

function getCurrentDraft() {
  return {
    name: nameInput.value.trim(),
    title: titleInput.value.trim(),
    company: companyInput.value.trim(),
    region: regionInput.value.trim(),
    contactEmail: contactEmailInput?.value?.trim() || "",
    contactPhone: contactPhoneInput?.value?.trim() || "",
    url: urlInput.value.trim(),
    memo: memoInput.value.trim(),
    messageSent: messageInput.value.trim(),
    aiFields: latestAiFields,
    messageAiFields: latestMessageAiFields,
    updatedAt: Date.now(),
  };
}

async function saveDraftNow() {
  const draft = getCurrentDraft();
  const draftKey = getDraftKey(draft.url);
  if (!draftKey) return;

  currentDraftKey = draftKey;
  await storageSet({ [draftKey]: draft });
}

function scheduleDraftSave() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    saveDraftNow();
  }, 300);
}

function flushDraftSave() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = null;
  return saveDraftNow();
}

function persistDraftSync() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = null;
  const draft = getCurrentDraft();
  const draftKey = getDraftKey(draft.url);
  if (!draftKey) return;
  currentDraftKey = draftKey;
  chrome.storage.local.set({ [draftKey]: draft });
}

function getLegacyDraftKeys(url) {
  const keys = [];
  const slug = extractLinkedInSlug(url);
  if (!slug) return keys;

  const hosts = ["https://www.linkedin.com", "https://linkedin.com"];
  const suffixes = ["", "/overlay/contact-info", "/overlay/contact-info/"];
  for (const host of hosts) {
    for (const suffix of suffixes) {
      keys.push(`${DRAFT_PREFIX}${host}/in/${slug}${suffix}`.toLowerCase());
      keys.push(`${DRAFT_PREFIX}${host}/in/${slug}${suffix}`.replace(/\/$/, ""));
    }
  }
  return keys;
}

function applyDraftToForm(draft) {
  if (draft.name) nameInput.value = draft.name;
  if (draft.title) titleInput.value = draft.title;
  if (draft.company) companyInput.value = draft.company;
  if (draft.region) regionInput.value = draft.region;
  if (Object.prototype.hasOwnProperty.call(draft, "contactEmail") && contactEmailInput) {
    contactEmailInput.value = draft.contactEmail || "";
  }
  if (Object.prototype.hasOwnProperty.call(draft, "contactPhone") && contactPhoneInput) {
    contactPhoneInput.value = draft.contactPhone || "";
  }
  if (draft.url) urlInput.value = draft.url;
  if (draft.memo) memoInput.value = draft.memo;
  if (draft.messageSent) messageInput.value = draft.messageSent;
  latestAiFields = draft.aiFields || {};
  latestMessageAiFields = draft.messageAiFields || {};
  renderExtraAiFields(latestAiFields);
  renderMessageAiFields(latestMessageAiFields);
}

async function restoreDraftForUrl(url) {
  const draftKey = getDraftKey(url);
  if (!draftKey) return false;

  currentDraftKey = draftKey;
  const keysToTry = [draftKey, ...getLegacyDraftKeys(url).filter((key) => key !== draftKey)];
  const items = await storageGet(keysToTry);

  for (const key of keysToTry) {
    const draft = items[key];
    if (!draft) continue;

    applyDraftToForm(draft);
    if (key !== draftKey) {
      await storageSet({ [draftKey]: { ...draft, url: normalizeProfileUrl(draft.url || url) } });
      await storageRemove(key);
    }
    return true;
  }

  return false;
}

async function clearCurrentDraft() {
  const draftKey = currentDraftKey || getDraftKey(urlInput.value.trim());
  if (draftKey) {
    await storageRemove(draftKey);
  }
}

function getProfileContext() {
  return {
    messageText: messageInput?.value?.trim() || "",
    company: companyInput?.value?.trim() || "",
    title: titleInput?.value?.trim() || "",
  };
}

function getExtraAiFields(parsed, context = getProfileContext()) {
  return toAiFieldsFromParsed(parsed, context);
}

async function ensureAnglesBeforeSync(messageSent) {
  const ctx = getProfileContext();
  let fields = enrichAiFieldsFromMemo(mergeAiFieldsForSync(), memoInput.value.trim());

  if (!messageSent.trim()) {
    return coerceSegmentFields(enrichAiFieldsWithAngles(fields, ctx));
  }

  if (!fields.painAngle || !fields.offerAngle) {
    setStatus("正在分析消息中的 Pain / Offer 角度…", "loading");
    const parsed = await parseOutreachMessage(messageSent);
    latestMessageAiFields = {
      ...latestMessageAiFields,
      ...getExtraAiFields(parsed, ctx),
    };
    renderMessageAiFields(latestMessageAiFields);
    fields = enrichAiFieldsFromMemo(mergeAiFieldsForSync(), memoInput.value.trim());
  }

  return coerceSegmentFields(enrichAiFieldsWithAngles(fields, ctx));
}

function mergeAiFieldsForSync() {
  const merged = { ...latestAiFields };
  for (const [key, value] of Object.entries(latestMessageAiFields)) {
    if (value) merged[key] = value;
  }
  return merged;
}

function renderMessageAiFields(fields) {
  if (!messageAiPreview) return;

  const labels = [
    ["模板", fields.messageTemplateId],
    ["Pain", fields.painAngle],
    ["Offer", fields.offerAngle],
    ["CTA", fields.ctaType],
    ["ICP", fields.icpSegment],
    ["角色", fields.roleSegment],
    ["个性化句", fields.personalizedExcerpt],
  ];
  const lines = labels
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  if (!lines.length) {
    messageAiPreview.hidden = true;
    return;
  }

  messageAiPreview.textContent = `消息 AI 分类（同步时写入表 C）\n${lines.join("\n")}`;
  messageAiPreview.hidden = false;
}

async function parseMessageAndClassify() {
  const text = messageInput.value.trim();
  if (!text) {
    setStatus("请先粘贴发出的消息", "err");
    return;
  }

  setBusy(true);
  setStatus("正在分析发出的消息…", "loading");

  const url = urlInput.value.trim();
  const targetName = nameInput.value.trim();

  try {
    const parsed = await parseOutreachMessage(text);
    if (parsed.message_sent) {
      messageInput.value = parsed.message_sent;
    }
    latestMessageAiFields = getExtraAiFields(parsed, getProfileContext());
    renderMessageAiFields(latestMessageAiFields);
    await saveDraftNow();
    setStatus("消息分类完成！", "ok");
    await appendActivityLog({
      type: "parse",
      source: "message",
      status: "ok",
      model: DEFAULT_MODEL,
      url,
      targetName,
      ...snapshotFieldStats(latestMessageAiFields, messageInput.value),
    });
    setTimeout(() => setStatus("", ""), 3000);
  } catch (error) {
    setStatus(`消息分析失败: ${error.message}`, "err");
    await appendActivityLog({
      type: "parse",
      source: "message",
      status: "err",
      model: DEFAULT_MODEL,
      url,
      targetName,
      error: error.message,
      messageLen: text.length,
    });
  } finally {
    setBusy(false);
  }
}

function renderExtraAiFields(fields) {
  const labels = [
    ["ICP", fields.icpSegment],
    ["角色", fields.roleSegment],
    ["工作经历", fields.careerBackground],
    ["教育背景", fields.eduBackground],
    ["Pain", fields.painAngle],
    ["Offer", fields.offerAngle],
    ["CTA", fields.ctaType],
    ["模板", fields.messageTemplateId],
  ];
  const lines = labels
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  if (!aiExtraPreview || !lines.length) {
    if (aiExtraPreview) aiExtraPreview.hidden = true;
    return;
  }

  aiExtraPreview.textContent = `AI 补充字段（同步时会写入表 C）\n${lines.join("\n")}`;
  aiExtraPreview.hidden = false;
}

async function parseAndFill(contentMessage, logMeta = {}) {
  setBusy(true);
  setStatus("正在 AI 解析履历…", "loading");

  const url = urlInput.value.trim();
  const targetName = nameInput.value.trim();
  const isImage = Array.isArray(contentMessage) && contentMessage.some((p) => p?.type === "image_url");
  const source = logMeta.source || (isImage ? "capture" : "text");

  try {
    const parsed = await parseResumeContent(contentMessage);
    const newAiFields = enrichAiFieldsFromMemo(getExtraAiFields(parsed, getProfileContext()), "");
    const priorMemoSections = extractBackgroundSections(memoInput.value);

    latestAiFields = {
      ...latestAiFields,
      ...newAiFields,
      careerBackground: mergeBackgroundText(
        mergeBackgroundText(latestAiFields.careerBackground, priorMemoSections.career),
        newAiFields.careerBackground
      ),
      eduBackground: mergeBackgroundText(
        mergeBackgroundText(latestAiFields.eduBackground, priorMemoSections.edu),
        newAiFields.eduBackground
      ),
      icpSegment: newAiFields.icpSegment || latestAiFields.icpSegment,
      roleSegment: newAiFields.roleSegment || latestAiFields.roleSegment,
      painAngle: newAiFields.painAngle || latestAiFields.painAngle,
      offerAngle: newAiFields.offerAngle || latestAiFields.offerAngle,
      ctaType: newAiFields.ctaType || latestAiFields.ctaType,
      messageTemplateId: newAiFields.messageTemplateId || latestAiFields.messageTemplateId,
      personalizedExcerpt:
        newAiFields.personalizedExcerpt || latestAiFields.personalizedExcerpt,
    };

    renderExtraAiFields(latestAiFields);

    if (parsed.company) companyInput.value = parsed.company;
    if (parsed.title) titleInput.value = parsed.title;
    if (parsed.region) regionInput.value = parsed.region;

    const mergedForMemo = {
      career_background: latestAiFields.careerBackground,
      edu_background: latestAiFields.eduBackground,
      personalized_excerpt: latestAiFields.personalizedExcerpt,
      memo: parsed.memo,
    };

    const memoPreview = buildMemoPreviewText(mergedForMemo);
    if (memoPreview) {
      memoInput.value = memoPreview;
    }

    await saveDraftNow();

    const missingBg = !latestAiFields.careerBackground && !latestAiFields.eduBackground;
    const status = missingBg ? "warn" : "ok";
    const note = missingBg ? "未识别到工作经历/教育背景" : undefined;

    await appendActivityLog({
      type: "parse",
      source,
      status,
      model: DEFAULT_MODEL,
      url,
      targetName,
      imageCount: logMeta.imageCount,
      segmentCount: logMeta.segmentCount,
      note,
      ...snapshotFieldStats(latestAiFields, messageInput.value),
    });

    if (missingBg) {
      setStatus("AI 解析完成，但未识别到工作经历/教育背景，请检查截图或手填素材框", "warn");
    } else {
      setStatus("AI 解析并填表完成！", "ok");
    }
    setTimeout(() => setStatus("", ""), 3000);
  } catch (error) {
    setStatus(`AI 识别失败: ${error.message}`, "err");
    await appendActivityLog({
      type: "parse",
      source,
      status: "err",
      model: DEFAULT_MODEL,
      url,
      targetName,
      imageCount: logMeta.imageCount,
      segmentCount: logMeta.segmentCount,
      error: error.message,
    });
  } finally {
    setBusy(false);
  }
}

if (messageAiBtn) {
  messageAiBtn.addEventListener("click", parseMessageAndClassify);
}

function parseMemoTextFromInput(source = "text") {
  const text = memoInput.value.trim();
  if (!text) return;
  parseAndFill([{ type: "text", text }], { source });
}

const MAX_CAPTURE_SEGMENTS = 18;
const SCROLL_SETTLE_MS = 850;

async function scrollPage(tabId, x, y) {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [x, y],
    func: (nextX, nextY) => {
      window.scrollTo(nextX, nextY);
    },
  });
}

function buildCaptureScrollPositions(plan, maxSegments) {
  const viewportHeight = Math.max(1, plan.viewportHeight);
  const scrollHeight = Math.max(viewportHeight, plan.scrollHeight);
  const overlap = 96;
  const step = Math.max(1, viewportHeight - overlap);
  const positions = new Set();

  positions.add(0);
  positions.add(Math.max(0, scrollHeight - viewportHeight));

  for (let y = 0; y < scrollHeight; y += step) {
    positions.add(Math.min(y, scrollHeight - viewportHeight));
  }

  for (const anchor of plan.anchorYs || []) {
    positions.add(anchor.y);
    positions.add(Math.max(0, Math.min(anchor.y + Math.floor(viewportHeight * 0.45), scrollHeight - viewportHeight)));
  }

  const sorted = [...positions].sort((a, b) => a - b);
  if (sorted.length <= maxSegments) {
    return { positions: sorted, truncated: false };
  }

  const anchorValues = new Set((plan.anchorYs || []).map((item) => item.y));
  const mustKeep = new Set([0, sorted[sorted.length - 1]]);
  for (const y of sorted) {
    if (anchorValues.has(y)) mustKeep.add(y);
  }

  const required = [...mustKeep].sort((a, b) => a - b);
  const rest = sorted.filter((y) => !mustKeep.has(y));
  const picked = [...required];
  const slots = maxSegments - required.length;
  if (slots > 0 && rest.length) {
    const stride = Math.max(1, Math.ceil(rest.length / slots));
    for (let i = 0; i < rest.length && picked.length < maxSegments; i += stride) {
      picked.push(rest[i]);
    }
  }

  return {
    positions: [...new Set(picked)].sort((a, b) => a - b),
    truncated: true,
  };
}

async function prepareCapturePlan(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["lib/linkedin-capture-plan.js"],
  });
  await sleep(400);

  const [first] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.bridgexBuildCapturePlan?.(),
  });

  await sleep(1200);

  const [second] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.bridgexBuildCapturePlan?.(),
  });

  return second?.result || first?.result;
}

function buildResumeCapturePrompt(meta) {
  let text = `以下是 LinkedIn 个人主页的分段截图（共 ${meta.segmentCount} 张）。页面已滚动整页，并优先覆盖 Experience（工作经历）与 Education（教育背景）区域。
请务必完整提取 career_background（工作经历）与 edu_background（教育背景）；若同一条目出现在多张图中请合并去重。`;

  if (!meta.hasExperience) {
    text += "\n未在页面上定位到 Experience 锚点，请根据画面中「Experience / 工作经历」相关内容填写 career_background。";
  }
  if (!meta.hasEducation) {
    text += "\n未在页面上定位到 Education 锚点，请根据画面中「Education / 教育」相关内容填写 edu_background。";
  }
  if (meta.truncated) {
    text += "\n截图张数已达上限，请根据已提供的画面尽可能提取，勿编造。";
  }
  return text;
}

async function captureResumeFullPage(tab) {
  const plan = await prepareCapturePlan(tab.id);
  if (!plan) {
    throw new Error("无法生成截屏计划，请确认当前为 LinkedIn 个人主页");
  }

  const { positions, truncated } = buildCaptureScrollPositions(plan, MAX_CAPTURE_SEGMENTS);
  const images = [];

  try {
    for (let i = 0; i < positions.length; i += 1) {
      setStatus(`履历整页截屏 ${i + 1}/${positions.length}…`, "loading");
      await scrollPage(tab.id, plan.originalX, positions[i]);
      await sleep(SCROLL_SETTLE_MS);
      images.push(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }));
    }
  } finally {
    await scrollPage(tab.id, plan.originalX, plan.originalY);
  }

  return {
    images,
    truncated,
    hasExperience: plan.hasExperience,
    hasEducation: plan.hasEducation,
    segmentCount: positions.length,
  };
}

async function runResumeCaptureAndParse() {
  setBusy(true);
  setStatus("准备滚动并截取 Experience / Education…", "loading");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("找不到当前标签页");
    if (!isLinkedInUrl(tab.url || "")) {
      setStatus("请在 LinkedIn 个人主页使用履历整页截屏", "err");
      setBusy(false);
      return;
    }

    const captureMeta = await captureResumeFullPage(tab);
    let hints = [];
    if (captureMeta.hasExperience) hints.push("已定位 Experience");
    if (captureMeta.hasEducation) hints.push("已定位 Education");
    if (captureMeta.truncated) hints.push("已达截屏上限");

    const imagesForLlm = pickImagesForLlm(captureMeta.images, 8);
    if (imagesForLlm.length < captureMeta.images.length) {
      hints.push(`送 AI ${imagesForLlm.length}/${captureMeta.images.length} 张`);
    }

    setStatus(
      `截屏完成（${captureMeta.segmentCount} 张${hints.length ? `，${hints.join("、")}` : ""}），AI 解析中…`,
      "loading"
    );

    await parseAndFill(
      [
        { type: "text", text: buildResumeCapturePrompt(captureMeta) },
        ...imagesForLlm.map((url) => ({ type: "image_url", image_url: { url } })),
      ],
      {
        source: "capture",
        imageCount: imagesForLlm.length,
        segmentCount: captureMeta.segmentCount,
      }
    );
  } catch (err) {
    setStatus(`履历截屏失败：${err.message}`, "err");
    setBusy(false);
  }
}

if (resumeCaptureBtn) {
  resumeCaptureBtn.addEventListener("click", runResumeCaptureAndParse);
}

memoInput.addEventListener("paste", async (e) => {
  const items = e.clipboardData.items;
  let imageFile = null;
  for (const item of items) {
    if (item.type.indexOf("image") === 0) {
      imageFile = item.getAsFile();
      break;
    }
  }

  if (imageFile) {
    e.preventDefault();

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      parseAndFill(
        [
          { type: "text", text: "请识别这张截图中的个人履历信息。" },
          { type: "image_url", image_url: { url: base64Data } },
        ],
        { source: "paste_image", imageCount: 1 }
      );
    };
    reader.readAsDataURL(imageFile);
    return;
  }

  const pastedText = e.clipboardData.getData("text/plain").trim();
  if (!pastedText) return;

  window.setTimeout(() => {
    parseMemoTextFromInput("text");
  }, 0);
});

[nameInput, titleInput, companyInput, regionInput, contactEmailInput, contactPhoneInput, urlInput, memoInput, messageInput].forEach((input) => {
  if (!input) return;
  input.addEventListener("input", scheduleDraftSave);
  input.addEventListener("blur", () => {
    flushDraftSave();
  });
});

window.addEventListener("pagehide", () => {
  persistDraftSync();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    persistDraftSync();
  }
});

async function runContactRead() {
  if (busy) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isLinkedInUrl(tab.url || "")) {
    setStatus("请在 LinkedIn 个人主页使用「读取联系方式」", "err");
    return;
  }

  setBusy(true);
  setStatus("正在截取联系方式…", "loading");

  try {
    let modalDetected = false;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["lib/profile-extract-page.js"],
      });
      const checkResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.bridgexIsContactModalOpen?.(),
      });
      modalDetected = Boolean(checkResults?.[0]?.result);
    } catch {
      modalDetected = false;
    }

    const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

    setStatus("AI 识别联系方式中…", "loading");
    const parsed = await parseContactInfoContent([
      {
        type: "text",
        text: "请识别截图中 LinkedIn「联系方式 / Contact info」弹窗内的邮箱与电话。",
      },
      { type: "image_url", image_url: { url: image } },
    ]);
    const contact = normalizeContactFields(parsed);

    if (contact.contactEmail && contactEmailInput) {
      contactEmailInput.value = contact.contactEmail;
    }
    if (contact.contactPhone && contactPhoneInput) {
      contactPhoneInput.value = contact.contactPhone;
    }
    await flushDraftSave();

    if (contact.contactEmail || contact.contactPhone) {
      const parts = [];
      if (contact.contactEmail) parts.push("邮箱");
      if (contact.contactPhone) parts.push("电话");
      const hint = modalDetected ? "" : "（未检测到弹窗，请确认截图中含联系方式）";
      setStatus(`已识别${parts.join("、")}${hint}`, "ok");
      await appendActivityLog({
        type: "parse",
        status: "ok",
        source: "contact_capture",
        model: DEFAULT_MODEL,
        url: urlInput.value.trim(),
        targetName: nameInput.value.trim(),
        note: `联系方式：${parts.join("、")}`,
        imageCount: 1,
      });
    } else {
      setStatus(
        modalDetected
          ? "截屏完成，但未识别到邮箱/电话，请手动填写"
          : "未检测到联系方式弹窗：请先打开弹窗再截屏，或手动填写",
        "warn"
      );
      await appendActivityLog({
        type: "parse",
        status: "warn",
        source: "contact_capture",
        model: DEFAULT_MODEL,
        url: urlInput.value.trim(),
        targetName: nameInput.value.trim(),
        note: "未识别到邮箱/电话",
        imageCount: 1,
      });
    }
  } catch (err) {
    setStatus(`读取联系方式失败：${err.message}`, "err");
    await appendActivityLog({
      type: "parse",
      status: "err",
      source: "contact_capture",
      model: DEFAULT_MODEL,
      url: urlInput.value.trim(),
      targetName: nameInput.value.trim(),
      error: err.message,
    });
  } finally {
    setBusy(false);
  }
}

if (contactReadBtn) {
  contactReadBtn.addEventListener("click", runContactRead);
}

async function loadCurrentTab() {
  const tempData = await storageGet(["temp_memo", "temp_message"]);
  const tempMemo = tempData.temp_memo || "";
  const tempMessage = tempData.temp_message || "";
  if (tempMemo) {
    await storageRemove("temp_memo");
    chrome.action.setBadgeText({ text: "" });
  }
  if (tempMessage) {
    await storageRemove("temp_message");
    chrome.action.setBadgeText({ text: "" });
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    pageHint.textContent = "无法读取当前标签页";
    pageHint.classList.add("warn");
    return;
  }

  const title = tab.title || "";
  const url = tab.url || "";
  const profileUrl = isLinkedInUrl(url) ? normalizeLinkedInProfileUrl(url) : url;

  urlInput.value = profileUrl;
  currentDraftKey = getDraftKey(profileUrl);

  const restored = await restoreDraftForUrl(profileUrl);
  if (!nameInput.value.trim()) {
    nameInput.value = parseNameFromTitle(title);
  }

  if (isLinkedInUrl(url) && !restored) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["lib/profile-extract-page.js"],
      });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.bridgexExtractProfileFromPage?.(),
      });

      if (results?.[0]?.result) {
        const res = results[0].result;
        if (!titleInput.value.trim()) titleInput.value = res.headline || "";
        if (!companyInput.value.trim()) companyInput.value = res.company || "";
        if (!regionInput.value.trim()) regionInput.value = res.region || "";
      }
    } catch (e) {
      console.warn("DOM extraction blocked or failed: ", e);
    }
  }

  if (tempMemo) {
    memoInput.value = tempMemo;
    await saveDraftNow();
    parseMemoTextFromInput("text");
  }
  if (tempMessage) {
    messageInput.value = tempMessage;
    await saveDraftNow();
  }

  if (!isLinkedInUrl(url)) {
    pageHint.textContent = "当前页不是 LinkedIn，仍可手动填写后同步";
    pageHint.classList.add("warn");
  } else if (restored) {
    pageHint.textContent = "已恢复草稿（弹窗开/关状态不影响已填内容）";
    pageHint.classList.remove("warn");
  } else if (!nameInput.value) {
    pageHint.textContent = "未能从标题提取姓名，请手动填写";
    pageHint.classList.add("warn");
  } else {
    pageHint.textContent = "已读取当前标签页信息及首屏履历";
    pageHint.classList.remove("warn");
  }
}

async function handleAction(actionType) {
  if (busy) {
    return;
  }

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  const company = companyInput.value.trim();
  const region = regionInput.value.trim();
  const contactEmail = contactEmailInput?.value?.trim() || "";
  const contactPhone = contactPhoneInput?.value?.trim() || "";
  const memo = memoInput.value.trim();
  const messageSent = messageInput.value.trim();

  if (!name) {
    setStatus("请填写姓名", "err");
    return;
  }
  if (!url) {
    setStatus("请填写 LinkedIn 链接", "err");
    return;
  }

  if (actionType === "已发消息" && !messageSent) {
    setStatus("同步「已发消息」前，请先在上方粘贴发出的消息原文", "err");
    return;
  }

  const config = await loadConfig();
  const missing = validateConfig(config);
  if (missing.length) {
    setStatus(`请先在设置中配置：${missing.join("、")}`, "err");
    return;
  }

  setBusy(true);

  try {
    setStatus("同步中…", "loading");
    const aiFieldsForSync = await ensureAnglesBeforeSync(messageSent);

    const result = await syncActionToFeishu(config, {
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
      aiFields: aiFieldsForSync,
    });
    await clearCurrentDraft();

    const syncNoteParts = [];
    if (!aiFieldsForSync.careerBackground && !aiFieldsForSync.eduBackground) {
      syncNoteParts.push("未写入履历");
    }
    if (!messageSent.trim()) {
      syncNoteParts.push("未写入消息");
    }
    if (result.tableCResult?.alreadyConnected) {
      syncNoteParts.push("已是 Connected");
    } else if (result.tableCResult?.updated) {
      syncNoteParts.push("更新表 C");
    } else if (result.tableCResult?.created) {
      syncNoteParts.push("新建表 C");
    }

    await appendActivityLog({
      type: "sync",
      status: result.tableBError ? "warn" : "ok",
      model: DEFAULT_MODEL,
      url,
      targetName: name,
      actionType,
      note: syncNoteParts.join("；") || undefined,
      error: result.tableBError || undefined,
      ...snapshotFieldStats(aiFieldsForSync, messageSent),
    });

    if (result.tableBError) {
      setStatus(`✅ 表 C 已同步；表 B 未更新：${result.tableBError}`, "err");
      setBusy(false);
      return;
    }

    if (result.tableCResult?.alreadyConnected) {
      setStatus("✅ 表 C 已是 Connected（表 B 未重复 +1）", "ok");
    } else if (actionType === "连接已接受" && result.tableCResult?.updated) {
      setStatus("✅ 已更新表 C 为 Connected，表 B connect_accepted +1", "ok");
    } else if (result.tableBResult && !result.tableBResult.skipped) {
      setStatus("✅ 已同步（表 C + 表 B）", "ok");
    } else {
      setStatus("✅ 已同步", "ok");
    }
    window.setTimeout(() => window.close(), 1000);
  } catch (error) {
    setStatus(error.message || "同步失败", "err");
    await appendActivityLog({
      type: "sync",
      status: "err",
      model: DEFAULT_MODEL,
      url,
      targetName: name,
      actionType,
      error: error.message,
      ...snapshotFieldStats(latestAiFields, messageSent),
    });
    setBusy(false);
  }
}

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleAction(button.dataset.action);
  });
});

  const openSettingsBtn = document.getElementById("open-settings");
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", (event) => {
      event.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  const openActivityLogBtn = document.getElementById("open-activity-log");
  if (openActivityLogBtn) {
    openActivityLogBtn.addEventListener("click", (event) => {
      event.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("options.html#activity-log") });
    });
  }

loadCurrentTab();
