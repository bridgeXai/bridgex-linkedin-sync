/**
 * 从 LinkedIn 页面 title 提取联系人姓名。
 * 示例:
 *   "John Doe | LinkedIn"
 *   "(99+) John Doe - Software Engineer | LinkedIn"
 */
export function parseNameFromTitle(title) {
  if (!title || typeof title !== "string") {
    return "";
  }

  let text = title.trim();
  text = text.replace(/^\(\d+\+\)\s*/, "");
  text = text.replace(/^\(\d+\)\s*/, "");

  const pipeParts = text.split(/\s*[|｜]\s*/);
  let segment = (pipeParts[0] || text).trim();

  const dashMatch = segment.match(/^(.+?)\s+-\s+.+/);
  if (dashMatch) {
    segment = dashMatch[1].trim();
  }

  return segment;
}

export function extractLinkedInSlug(url) {
  const match = (url || "").match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : "";
}

export function normalizeLinkedInProfileUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    let path = parsed.pathname.replace(/\/$/, "");

    // 联系方式弹窗等 overlay 会改变 pathname，草稿须统一到 /in/{slug}
    const profileMatch = path.match(/^(\/in\/[^/]+)/i);
    if (profileMatch && /linkedin\.com/i.test(parsed.hostname)) {
      path = profileMatch[1];
    }

    return `${parsed.origin}${path}`.toLowerCase();
  } catch {
    let base = (url || "").split(/[?#]/)[0].replace(/\/$/, "");
    const profileMatch = base.match(/^(.*\/in\/[^/]+)/i);
    return (profileMatch ? profileMatch[1] : base).toLowerCase();
  }
}

export function isLinkedInUrl(url) {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return /(^|\.)linkedin\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}
