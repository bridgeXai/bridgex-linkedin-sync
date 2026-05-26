import { OPENROUTER_API_KEY } from "./secrets.js";
import { getOfferAngleOptionsForPrompt, getPainAngleOptionsForPrompt } from "./angle-fields.js";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "qwen/qwen3-vl-32b-instruct";

const RESUME_SYS_PROMPT = `你是一个履历解析助手。请提取提供的文本或图片中的履历信息，并务必返回合法的 JSON 对象，格式如下：
{
  "company": "最近的一家公司名称，如果没有则为空字符串",
  "title": "最新或核心的职位头衔，如果没有则为空字符串",
  "region": "所在地/地区（国家、城市等，如 Japan Tokyo），如果没有则为空字符串",
  "career_background": "【必填若图中有 Experience】工作经历：按时间列出公司、职位、年限、职责与成就，多行文本",
  "edu_background": "【必填若图中有 Education】教育背景：学校、学位、专业、年份，多行文本",
  "memo": "其它要点（技能、认证等），无则空字符串",
  "icp_segment": "目标客群/行业分组：请务必从下列选项中单选最符合的一项：[Biopharma (General), Vaccine Manufacturing, mRNA Therapeutics, Monoclonal Antibodies (mAb), Cell & Gene Therapy (CGT), Recombinant Proteins, Biosimilars, Contract Development and Manufacturing Organization (CDMO), Contract Research Organization (CRO), Active Pharmaceutical Ingredients (API), Filtration / Membrane Technology, Medical Devices, Diagnostics / IVD, Life Science Research Tools, Food & Beverage, Cosmetics & Personal Care, Other]，如都不符合或无法推断请选 Other",
  "role_segment": "角色分组：必须从下列选项中单选：[Procurement, Supply Chain, Operations, Finance, Founder, Other]，如果不确定请选 Other",
  "pain_angle": "痛点角度：必须从下列选一（原样输出字符串），无匹配则空字符串",
  "offer_angle": "价值角度：必须从下列选一（原样输出字符串），无匹配则空字符串",
  "cta_type": "建议的 CTA 类型，例如 Connect / Reply / Meeting / Other，如果不确定则为空字符串",
  "message_template_id": "建议使用的话术模板 ID，例如 A / B / C，如果不确定则为空字符串",
  "personalized_excerpt": "可直接写入 CRM 的一句个性化开场依据，优先引用公司、职位、项目、行业或经历"
}
规则：
1. 请只返回 JSON，不要输出任何 markdown 标记（如 \`\`\`json）和其他废话。
2. 无法从素材判断的字段必须返回空字符串，不要编造具体事实。
3. personalized_excerpt 应简短、自然、适合人工发 LinkedIn 消息前快速复核。
4. career_background 与 edu_background 须分开填写，勿把教育经历写入 career_background。
5. 若提供多张截图，请合并所有图中 Experience / Education 可见条目；career_background、edu_background 必须尽量写满，禁止只填 icp_segment 而留空这两项。
6. 只返回一个 JSON 对象，键名必须与上述 snake_case 完全一致。

pain_angle 只能选其一：
${getPainAngleOptionsForPrompt()}

offer_angle 只能选其一：
${getOfferAngleOptionsForPrompt()}`;

const MESSAGE_SYS_PROMPT = `你是一个 LinkedIn 外展话术分析助手。用户会提供一条他们实际发给目标人的消息（连接附言或私信/InMail 全文）。
请分析并返回合法 JSON 对象：
{
  "message_sent": "清理后的完整发出消息原文，保留原意，不要润色改写",
  "message_template_id": "话术模板 ID，仅当明显符合 A/B/C 之一时填 A、B 或 C，否则空字符串",
  "pain_angle": "【必填】消息体现的痛点角度，必须从下列选一，原样输出",
  "offer_angle": "【必填】消息体现的价值/offer 角度，必须从下列选一，原样输出",
  "cta_type": "消息中的行动号召类型，如 15min call / exchange ideas / share material / soft intro / Other，不确定则为空字符串",
  "icp_segment": "目标客群/行业分组：请务必从下列选项中单选最符合的一项：[Biopharma (General), Vaccine Manufacturing, mRNA Therapeutics, Monoclonal Antibodies (mAb), Cell & Gene Therapy (CGT), Recombinant Proteins, Biosimilars, Contract Development and Manufacturing Organization (CDMO), Contract Research Organization (CRO), Active Pharmaceutical Ingredients (API), Filtration / Membrane Technology, Medical Devices, Diagnostics / IVD, Life Science Research Tools, Food & Beverage, Cosmetics & Personal Care, Other]，如都不符合或无法推断请选 Other",
  "role_segment": "角色分组：必须从下列选项中单选：[Procurement, Supply Chain, Operations, Finance, Founder, Other]，如果不确定请选 Other",
  "personalized_excerpt": "消息中针对对方个性化的一句或半句；若没有明显个性化句则为空字符串"
}
规则：
1. 只返回 JSON，不要 markdown 标记或其它说明。
2. 不得编造消息中不存在的事实。
3. message_template_id 仅在结构明显像标准模板时才填 A/B/C。
4. pain_angle、offer_angle 禁止留空：根据消息语义选择最接近的一项。
5. 键名必须 snake_case，值必须与选项列表完全一致。

pain_angle 只能选其一：
${getPainAngleOptionsForPrompt()}

offer_angle 只能选其一：
${getOfferAngleOptionsForPrompt()}`;

const CONTACT_SYS_PROMPT = `你是一个 LinkedIn「联系方式 / Contact info」弹窗识别助手。用户会提供一张浏览器截图，其中应包含 LinkedIn 个人资料的联系方式弹窗。
请提取并返回合法 JSON 对象：
{
  "contact_email": "邮箱地址，无则空字符串",
  "contact_phone": "电话号码（保留国家码与原格式，如 +81-90-4664-7502），无则空字符串",
  "linkedin_url": "弹窗中的 LinkedIn 个人链接，无则空字符串",
  "birthday": "生日（若有），无则空字符串",
  "connected_on": "联系时间 / Connected on（若有），无则空字符串"
}
规则：
1. 只返回 JSON，不要 markdown 标记或其它说明。
2. 逐字 OCR 识别，不要编造截图中不存在的信息。
3. 电话若带后缀如 (移动设备)/(Mobile)，只保留号码部分写入 contact_phone。
4. 若截图中看不到联系方式弹窗，contact_email 与 contact_phone 均返回空字符串。
5. 键名必须 snake_case。`;

function parseJsonFromLlmText(text) {
  const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("AI 返回格式解析失败");
  }
}

async function callOpenRouter(systemPrompt, userContent, maxTokens = 800) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes("xxxxxxxx")) {
    throw new Error("OpenRouter API Key 未配置，请联系管理员更新 lib/secrets.js");
  }

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://bridgex.local/linkedin-sync",
      "X-Title": "BridgeX LinkedIn Sync",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "AI 接口返回错误");
  }

  const text = data.choices[0]?.message?.content || "";
  return parseJsonFromLlmText(text);
}

export async function parseOutreachMessage(messageText) {
  const trimmed = (messageText || "").trim();
  if (!trimmed) {
    throw new Error("请先填写或抓取发出的消息");
  }

  return callOpenRouter(MESSAGE_SYS_PROMPT, trimmed, 600);
}

export async function parseResumeContent(contentMessage) {
  const isMultiImage =
    Array.isArray(contentMessage) &&
    contentMessage.some((part) => part?.type === "image_url");
  const maxTokens = isMultiImage ? 3200 : 1600;
  return callOpenRouter(RESUME_SYS_PROMPT, contentMessage, maxTokens);
}

export async function parseContactInfoContent(contentMessage) {
  return callOpenRouter(CONTACT_SYS_PROMPT, contentMessage, 400);
}
