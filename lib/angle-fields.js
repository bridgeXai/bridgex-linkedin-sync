/**
 * pain_angle / offer_angle：飞书单选 + 消息/履历推断
 * 选项需与表 C 单选列表一致；可在设置页扩展（后续）
 */

/** 与 MVP 手册 + 当前表 C 已用值对齐，AI 只能从中选一项 */
export const PAIN_ANGLE_OPTIONS = [
  "获客效率",
  "成本下降",
  "渠道扩展",
  "supplier evaluation",
  "traceability",
  "quality compliance",
  "operations efficiency",
  "market access",
];

export const OFFER_ANGLE_OPTIONS = [
  "帮你找客户",
  "帮你验证市场",
  "帮你拓展渠道",
  "traceability & sourcing",
  "investment / partnership",
  "strategic collaboration",
  "product validation",
  "channel partnership",
];

const PAIN_OPTION_TEXT = PAIN_ANGLE_OPTIONS.map((o) => `- ${o}`).join("\n");
const OFFER_OPTION_TEXT = OFFER_ANGLE_OPTIONS.map((o) => `- ${o}`).join("\n");

export function getPainAngleOptionsForPrompt() {
  return PAIN_OPTION_TEXT;
}

export function getOfferAngleOptionsForPrompt() {
  return OFFER_OPTION_TEXT;
}

function normalizeOption(value, allowed) {
  const raw = (value || "").trim();
  if (!raw) return "";

  const exact = allowed.find((opt) => opt.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const partial = allowed.find(
    (opt) =>
      raw.toLowerCase().includes(opt.toLowerCase()) ||
      opt.toLowerCase().includes(raw.toLowerCase())
  );
  return partial || "";
}

export function coercePainAngle(value) {
  return normalizeOption(value, PAIN_ANGLE_OPTIONS);
}

export function coerceOfferAngle(value) {
  return normalizeOption(value, OFFER_ANGLE_OPTIONS);
}

/** 消息正文关键词兜底（AI 未填时） */
export function inferAnglesFromMessageText(messageText) {
  const text = (messageText || "").toLowerCase();
  let pain = "";
  let offer = "";

  if (/supplier|sourcing|procurement|supply chain|vendor|采购|供应链/.test(text)) {
    pain = "supplier evaluation";
    offer = "traceability & sourcing";
  } else if (/traceability|合规|quality|compliance|audit/.test(text)) {
    pain = "traceability";
    offer = "traceability & sourcing";
  } else if (/cost|efficiency|获客|效率|save/.test(text)) {
    pain = "获客效率";
    offer = "帮你找客户";
  } else if (/channel|渠道|distribution|market access/.test(text)) {
    pain = "渠道扩展";
    offer = "帮你拓展渠道";
  } else if (/investor|investment|融资|biotech|pharma|战略投资/.test(text)) {
    pain = "market access";
    offer = "investment / partnership";
  } else if (/validate|validation|验证|pilot|trial/.test(text)) {
    pain = "operations efficiency";
    offer = "帮你验证市场";
  } else if (/partner|collaborat|合作|explore/.test(text)) {
    offer = "strategic collaboration";
  }

  return {
    painAngle: coercePainAngle(pain),
    offerAngle: coerceOfferAngle(offer),
  };
}

export function enrichAiFieldsWithAngles(aiFields, { messageText = "", company = "", title = "" } = {}) {
  const out = { ...aiFields };

  out.painAngle = coercePainAngle(out.painAngle);
  out.offerAngle = coerceOfferAngle(out.offerAngle);

  if (!out.painAngle || !out.offerAngle) {
    const fromMsg = inferAnglesFromMessageText(messageText);
    if (!out.painAngle) out.painAngle = fromMsg.painAngle;
    if (!out.offerAngle) out.offerAngle = fromMsg.offerAngle;
  }

  if (!out.painAngle && /filter|filtration|industrial|manufacturing|化工|过滤/.test(`${company} ${title}`.toLowerCase())) {
    out.painAngle = coercePainAngle("supplier evaluation");
  }
  if (!out.offerAngle && out.painAngle === "supplier evaluation") {
    out.offerAngle = coerceOfferAngle("traceability & sourcing");
  }

  return out;
}
