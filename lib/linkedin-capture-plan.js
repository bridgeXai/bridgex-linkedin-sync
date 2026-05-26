/**
 * 注入 LinkedIn 个人页：展开 Experience/Education，生成整页截屏滚动计划
 */
function bridgexBuildCapturePlan() {
  function normalizeY(y, scrollHeight, viewportHeight) {
    const maxY = Math.max(0, scrollHeight - viewportHeight);
    return Math.max(0, Math.min(Math.round(y), maxY));
  }

  function elementTopY(el, headerOffset = 72) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 && rect.width === 0) return null;
    return window.scrollY + rect.top - headerOffset;
  }

  function findSectionRoot(keyword) {
    const byId = document.getElementById(keyword);
    if (byId) return byId;

    const sections = document.querySelectorAll("section");
    for (const section of sections) {
      if (new RegExp(`^${keyword}$`, "i").test(section.id || "")) return section;
      const heading = section.querySelector("h2, h3, .pvs-header__title");
      const text = (heading?.innerText || "").trim().toLowerCase();
      if (text === keyword || text.includes(keyword)) return section;
    }

    const aria = document.querySelector(`[aria-label*="${keyword}" i]`);
    return aria?.closest("section") || aria;
  }

  function expandShowAll(root) {
    if (!root) return 0;
    let clicked = 0;
    const scope = root.closest("section") || root.parentElement || root;
    const buttons = scope.querySelectorAll("button, a[role='button']");
    for (const btn of buttons) {
      const label = `${btn.innerText || ""} ${btn.getAttribute("aria-label") || ""}`.toLowerCase();
      if (/show all|see all|显示全部|查看全部|show more|see more/.test(label)) {
        btn.click();
        clicked += 1;
      }
    }
    return clicked;
  }

  const viewportHeight = window.innerHeight;
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight || 0,
    viewportHeight
  );

  const experienceEl = findSectionRoot("experience");
  const educationEl = findSectionRoot("education");

  expandShowAll(experienceEl);
  expandShowAll(educationEl);

  const anchorYs = [];

  const expY = elementTopY(experienceEl);
  if (expY != null) {
    anchorYs.push({ name: "experience", y: normalizeY(expY, scrollHeight, viewportHeight) });
    if (experienceEl) {
      const expBottom = window.scrollY + experienceEl.getBoundingClientRect().bottom;
      anchorYs.push({
        name: "experience-tail",
        y: normalizeY(expBottom - viewportHeight * 0.65, scrollHeight, viewportHeight),
      });
    }
  }

  const eduY = elementTopY(educationEl);
  if (eduY != null) {
    anchorYs.push({ name: "education", y: normalizeY(eduY, scrollHeight, viewportHeight) });
    if (educationEl) {
      const eduBottom = window.scrollY + educationEl.getBoundingClientRect().bottom;
      anchorYs.push({
        name: "education-tail",
        y: normalizeY(eduBottom - viewportHeight * 0.65, scrollHeight, viewportHeight),
      });
    }
  }

  return {
    originalX: window.scrollX,
    originalY: window.scrollY,
    viewportHeight,
    scrollHeight,
    anchorYs,
    hasExperience: Boolean(experienceEl),
    hasEducation: Boolean(educationEl),
  };
}

window.bridgexBuildCapturePlan = bridgexBuildCapturePlan;
