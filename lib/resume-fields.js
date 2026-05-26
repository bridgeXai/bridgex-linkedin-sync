import { enrichAiFieldsWithAngles } from "./angle-fields.js";
import { coerceSegmentFields } from "./segment-fields.js";

/** 履历 AI 结果规范化，及从素材文本回填 career / edu */

function pickString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function mergeBackgroundText(existing, incoming) {
  const left = (existing || "").trim();
  const right = (incoming || "").trim();
  if (!left) return right;
  if (!right) return left;

  const blocks = [];
  const seen = new Set();

  for (const block of [...splitBackgroundBlocks(left), ...splitBackgroundBlocks(right)]) {
    const key = normalizeBackgroundBlock(block);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    blocks.push(block);
  }

  return blocks.join("\n\n");
}

function splitBackgroundBlocks(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const paragraphBlocks = raw
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphBlocks.length > 1) {
    return paragraphBlocks;
  }

  return raw
    .split(/\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeBackgroundBlock(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[•·\-–—|]/g, " ")
    .trim();
}

export function extractBackgroundSections(text) {
  const source = (text || "").trim();
  if (!source) {
    return { career: "", edu: "" };
  }

  const careerMatch = source.match(
    /(?:【工作经历】|【Experience】|career_background[：:])\s*\n?([\s\S]*?)(?=\n\n(?:【教育背景】|【Education】|【|edu_background)|$)/i
  );
  const eduMatch = source.match(
    /(?:【教育背景】|【Education】|edu_background[：:])\s*\n?([\s\S]*?)(?=\n\n(?:【|$))/i
  );

  return {
    career: careerMatch?.[1]?.trim() || "",
    edu: eduMatch?.[1]?.trim() || "",
  };
}

export function normalizeResumeParsed(parsed) {
  const raw = parsed && typeof parsed === "object" ? parsed : {};

  let career = pickString(raw, [
    "career_background",
    "careerBackground",
    "work_experience",
    "experience",
    "career",
  ]);
  let edu = pickString(raw, ["edu_background", "eduBackground", "education_background", "education", "edu"]);

  const memo = pickString(raw, ["memo", "notes", "summary"]);
  if (!career || !edu) {
    const fromMemo = extractBackgroundSections(memo);
    if (!career) career = fromMemo.career;
    if (!edu) edu = fromMemo.edu;
  }

  return {
    ...raw,
    career_background: career,
    edu_background: edu,
    company: pickString(raw, ["company", "target_company", "current_company"]),
    title: pickString(raw, ["title", "target_title", "headline", "position"]),
    region: pickString(raw, ["region", "target_region", "location"]),
    memo,
  };
}

export function toAiFieldsFromParsed(parsed, context = {}) {
  const normalized = normalizeResumeParsed(parsed);
  const base = {
    icpSegment: pickString(normalized, ["icp_segment", "icpSegment"]),
    roleSegment: pickString(normalized, ["role_segment", "roleSegment"]),
    careerBackground: normalized.career_background || "",
    eduBackground: normalized.edu_background || "",
    painAngle: pickString(normalized, ["pain_angle", "painAngle"]),
    offerAngle: pickString(normalized, ["offer_angle", "offerAngle"]),
    ctaType: pickString(normalized, ["cta_type", "ctaType"]),
    messageTemplateId: pickString(normalized, ["message_template_id", "messageTemplateId"]),
    personalizedExcerpt: pickString(normalized, ["personalized_excerpt", "personalizedExcerpt"]),
  };
  return coerceSegmentFields(enrichAiFieldsWithAngles(base, context));
}

export function enrichAiFieldsFromMemo(aiFields, memoText) {
  const sections = extractBackgroundSections(memoText);
  return {
    ...aiFields,
    careerBackground: aiFields.careerBackground || sections.career,
    eduBackground: aiFields.eduBackground || sections.edu,
  };
}

export function buildMemoPreviewText(parsed) {
  const normalized = normalizeResumeParsed(parsed);
  const parts = [];

  if (normalized.career_background) {
    parts.push(`【工作经历】\n${normalized.career_background}`);
  }
  if (normalized.edu_background) {
    parts.push(`【教育背景】\n${normalized.edu_background}`);
  }
  if (normalized.memo) {
    parts.push(normalized.memo);
  }
  const excerpt = pickString(normalized, ["personalized_excerpt", "personalizedExcerpt"]);
  if (excerpt) {
    parts.push(excerpt);
  }

  return parts.filter(Boolean).join("\n\n");
}

/** 多图送模时限制张数，避免响应截断导致 JSON 缺字段 */
export function pickImagesForLlm(images, maxCount = 8) {
  if (!Array.isArray(images) || images.length <= maxCount) {
    return images || [];
  }

  const indices = new Set([0, images.length - 1]);
  const middleSlots = maxCount - 2;
  const step = (images.length - 1) / (middleSlots + 1);

  for (let i = 1; i <= middleSlots; i += 1) {
    indices.add(Math.round(i * step));
  }

  return [...indices].sort((a, b) => a - b).map((index) => images[index]);
}
