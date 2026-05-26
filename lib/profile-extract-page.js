/**
 * 注入 LinkedIn 个人页后执行，由 popup 通过 executeScript 调用。
 * 勿在此文件使用 import/export。
 */
function bridgexExtractProfileFromPage() {
  function clean(text) {
    return (text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors, root) {
    const scope = root || document;
    for (const selector of selectors) {
      const nodes = scope.querySelectorAll(selector);
      for (const node of nodes) {
        const text = clean(node.innerText || node.textContent);
        if (text) return text;
      }
    }
    return "";
  }

  function isNoise(text) {
    if (!text || text.length > 120) return true;
    return /^\d+(\+|\+)?\s*(st|nd|rd|th)?\s*(degree|度)|connection|follower|联系人|位关注|report|举报|contact info|联系方式|see all|查看全部|mutual/i.test(
      text
    );
  }

  function looksLikeLocation(text) {
    if (!text || isNoise(text)) return false;
    if (text.includes(",")) return true;
    return /区|市|省|国|州|郡|県|都|府|道|Japan|Tokyo|China|United|Area|Metropolitan|Region|Greater|India|Singapore|Korea|Germany|France|UK|Canada|Australia|Brazil|Mexico|Taiwan|Hong Kong|马来西亚|泰国|越南|印尼|菲律宾|Meguro|Shibuya|London|Berlin|Paris|Sydney|Dubai/i.test(
      text
    );
  }

  const result = { headline: "", company: "", region: "" };

  const topCard =
    document.querySelector(
      "section.artdeco-card.pv-top-card, section.pv-top-card, [componentkey*='Topcard'], main section"
    ) || document.querySelector("main");

  result.headline = firstText(
    [
      ".text-body-medium.break-words",
      "div[data-generated-suggestion-target] ~ div .text-body-medium",
      ".pv-text-details__left-panel .text-body-medium",
      "main h1",
      "h1.inline",
    ],
    topCard
  );

  result.company = firstText(
    [
      "button[aria-label*='Current company']",
      "button[aria-label*='当前公司']",
      "a[aria-label*='Current company']",
      ".pv-text-details__right-panel .inline-show-more-text",
      "[data-field='experience_company_logo'] + div span",
    ],
    topCard
  );

  if (!result.company) {
    const experience = document.querySelector("#experience, section[id*='experience']");
    result.company = firstText(
      [
        ".optional-action-target-wrapper .mr1.hoverable-link-text span[aria-hidden='true']",
        ".pvs-entity__sub-title",
        "span.t-14.t-normal span[aria-hidden='true']",
      ],
      experience
    );
  }

  const mapScope = topCard || document;
  const mapEl =
    mapScope.querySelector('a[href*="linkedin.com/maps"]') ||
    mapScope.querySelector('a[href*="geoUrn"]');
  if (mapEl) {
    const mapText = clean(mapEl.innerText || mapEl.getAttribute("aria-label"));
    if (mapText && !isNoise(mapText)) {
      result.region = mapText.replace(/^(location|所在地|地区)\s*[:：]?\s*/i, "");
    }
  }

  if (!result.region) {
    const locFromAria = document.querySelector(
      "span[aria-label*='Location'], span[aria-label*='所在地'], [data-test-icon='location-marker'] + span"
    );
    if (locFromAria) {
      const text = clean(locFromAria.innerText || locFromAria.getAttribute("aria-label"));
      if (looksLikeLocation(text)) result.region = text.replace(/^(location|所在地)\s*/i, "");
    }
  }

  if (!result.region && topCard) {
    const candidates = topCard.querySelectorAll(
      ".text-body-small, span.text-body-small.inline, .pv-text-details__left-panel span, .text-body-small.inline.t-black--light.break-words"
    );
    for (const node of candidates) {
      const text = clean(node.innerText);
      if (looksLikeLocation(text)) {
        result.region = text;
        break;
      }
    }
  }

  if (!result.region) {
    const allSmall = document.querySelectorAll(".text-body-small");
    for (const node of allSmall) {
      const text = clean(node.innerText);
      if (looksLikeLocation(text)) {
        result.region = text;
        break;
      }
    }
  }

  return result;
}

function bridgexIsContactModalOpen() {
  function clean(text) {
    return (text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function looksLikeContactModalText(text) {
    const sample = clean(text).slice(0, 800);
    if (!sample) return false;
    const hasLabel = /contact info|联系方式|contact details|profile|个人资料|电话|phone|email|邮箱/i.test(
      sample
    );
    const hasContactValue =
      /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(sample) ||
      /\+\d[\d\s\-().]{7,}\d/.test(sample) ||
      /linkedin\.com\/in\//i.test(sample);
    return hasLabel && hasContactValue;
  }

  const headingSelectors = "h1, h2, h3, [class*='modal-header'], [id*='modal-header']";
  for (const heading of document.querySelectorAll(headingSelectors)) {
    const text = clean(heading.innerText || heading.textContent);
    if (/^(contact info|联系方式|contact details)$/i.test(text)) {
      const container = heading.closest(
        '[role="dialog"], .artdeco-modal, .artdeco-modal__content, [aria-modal="true"]'
      );
      if (!container || isVisible(container)) return true;
    }
  }

  const modalRoots = document.querySelectorAll(
    '[role="dialog"], .artdeco-modal, .artdeco-modal__content, [aria-modal="true"], #artdeco-modal-outlet *'
  );
  for (const node of modalRoots) {
    if (!isVisible(node)) continue;
    if (looksLikeContactModalText(node.innerText || node.textContent)) return true;
  }

  for (const link of document.querySelectorAll('a[href^="mailto:"]')) {
    if (!isVisible(link)) continue;
    const container = link.closest(
      '[role="dialog"], .artdeco-modal, .artdeco-modal__content, [aria-modal="true"], .pv-contact-info'
    );
    if (container && isVisible(container)) return true;
  }

  return false;
}

window.bridgexExtractProfileFromPage = bridgexExtractProfileFromPage;
window.bridgexIsContactModalOpen = bridgexIsContactModalOpen;
