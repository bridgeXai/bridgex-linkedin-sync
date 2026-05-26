/**
 * icp_segment / role_segment / cta_type / message_template_id
 * 须与飞书表 C 单选选项一致；AI 只能从中选一项
 */

export const ICP_SEGMENT_OPTIONS = [
  "Biopharma (General)",
  "Vaccine Manufacturing",
  "mRNA Therapeutics",
  "Monoclonal Antibodies (mAb)",
  "Cell & Gene Therapy (CGT)",
  "Recombinant Proteins",
  "Biosimilars",
  "Contract Development and Manufacturing Organization (CDMO)",
  "Contract Research Organization (CRO)",
  "Active Pharmaceutical Ingredients (API)",
  "Filtration / Membrane Technology",
  "Medical Devices",
  "Diagnostics / IVD",
  "Life Science Research Tools",
  "Food & Beverage",
  "Cosmetics & Personal Care",
  "Other",
];

export const ROLE_SEGMENT_OPTIONS = [
  "Procurement",
  "Supply Chain",
  "Operations",
  "Finance",
  "Founder",
  "Other",
];

export const CTA_TYPE_OPTIONS = ["Connect", "Reply", "Meeting", "Other"];

export const MESSAGE_TEMPLATE_ID_OPTIONS = ["A", "B", "C"];

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

export function coerceIcpSegment(value) {
  return normalizeOption(value, ICP_SEGMENT_OPTIONS);
}

export function coerceRoleSegment(value) {
  return normalizeOption(value, ROLE_SEGMENT_OPTIONS);
}

export function coerceCtaType(value) {
  return normalizeOption(value, CTA_TYPE_OPTIONS);
}

export function coerceMessageTemplateId(value) {
  return normalizeOption(value, MESSAGE_TEMPLATE_ID_OPTIONS);
}

/** 履历/消息 AI 字段写入飞书前统一规范化 */
export function coerceSegmentFields(aiFields = {}) {
  return {
    ...aiFields,
    icpSegment: coerceIcpSegment(aiFields.icpSegment),
    roleSegment: coerceRoleSegment(aiFields.roleSegment),
    ctaType: coerceCtaType(aiFields.ctaType),
    messageTemplateId: coerceMessageTemplateId(aiFields.messageTemplateId),
  };
}
