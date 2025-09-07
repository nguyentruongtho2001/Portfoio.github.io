// === Lightweight i18n for static sites ===
// - Ưu tiên: localStorage > ?lang= > <html lang> > navigator > 'en'
// - Lưu lựa chọn vào localStorage
// - Hỗ trợ {{placeholder}} & data-i18n-params='{"k":"v"}'
// - Hỗ trợ dịch attributes qua data-i18n-attr="placeholder|title|aria-label"
// - Hỗ trợ innerHTML khi thêm data-i18n-html vào element

const I18N = (function () {
  const STORAGE_KEY = "lang";
  const DEFAULT_LANG = "vi";           // mặc định đang viết tiếng Việt
  const LOCALE_PATH = "./locales";     // chứa en.json, vi.json

  let cache = {};
  let currentLang = DEFAULT_LANG;

  function resolveInitialLang() {
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    const fromQuery = new URLSearchParams(location.search).get("lang");
    const fromHtml = document.documentElement.getAttribute("lang");
    const fromNavigator = (navigator.language || "").slice(0, 2);
    return (fromStorage || fromQuery || fromHtml || fromNavigator || DEFAULT_LANG)
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .slice(0, 2);
  }

  async function loadLang(lang) {
    if (cache[lang]) return cache[lang];
    const res = await fetch(`${LOCALE_PATH}/${lang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Cannot load locale: ${lang}`);
    const data = await res.json();
    cache[lang] = data;
    return data;
  }

  function template(str, params = {}) {
    return String(str).replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] ?? ""));
  }

  function get(key, params = {}) {
    const dict = cache[currentLang] || {};
    const raw = key.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), dict);
    return raw != null ? template(raw, params) : key; // fallback: hiện key nếu thiếu
  }

  function applyToElement(el) {
    const key = el.getAttribute("data-i18n");
    if (!key) return;

    const params = el.getAttribute("data-i18n-params");
    const parsed = params ? JSON.parse(params) : {};

    const attrList = (el.getAttribute("data-i18n-attr") || "")
      .split("|")
      .map(s => s.trim())
      .filter(Boolean);

    if (attrList.length) {
      // dịch vào attributes
      const txt = get(key, parsed);
      attrList.forEach(attr => el.setAttribute(attr, txt));
      return;
    }

    // nếu có data-i18n-html => set innerHTML (khi chuỗi có <span>, <b>, ...)
    if (el.hasAttribute("data-i18n-html")) {
      el.innerHTML = get(key, parsed);
    } else {
      el.textContent = get(key, parsed);
    }
  }

  function applyAll() {
    document.documentElement.setAttribute("lang", currentLang);
    document.querySelectorAll("[data-i18n]").forEach(applyToElement);
  }

  async function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    await loadLang(lang);
    applyAll();
  }

  // cập nhật nhãn nút: hiển thị ngôn ngữ SẼ chuyển sang khi bấm
  function updateToggleLabel(btn) {
    btn.textContent = currentLang === "vi" ? "EN" : "VI";
    // (tuỳ chọn) set aria-label thân thiện hơn:
    btn.setAttribute(
      "aria-label",
      currentLang === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"
    );
  }

  async function init() {
    const initLang = resolveInitialLang();
    try {
      await changeLanguage(initLang);
    } catch (e) {
      console.warn(e);
      await changeLanguage(DEFAULT_LANG);
    }

    // Toggle button (thay vì select)
    const toggleBtn = document.getElementById("langToggle");
    if (toggleBtn) {
      updateToggleLabel(toggleBtn);
      toggleBtn.addEventListener("click", async () => {
        const newLang = currentLang === "vi" ? "en" : "vi";
        await changeLanguage(newLang);
        updateToggleLabel(toggleBtn);
      });
    }
  }

  return { init, changeLanguage };
})();

document.addEventListener("DOMContentLoaded", I18N.init);
