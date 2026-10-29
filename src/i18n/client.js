import { translate } from './translations.js';

export const currentLanguage = () => document.documentElement.lang === 'es' ? 'es' : 'en';
export function setLocalizedText(element, english) {
  element.dataset.i18nEn = english;
  element.textContent = translate(english, currentLanguage());
}

export function initializeLanguages() {
  const nodes = [];
  const attributes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.parentElement || node.parentElement.closest('script,style,textarea,[data-i18n-en]')) continue;
    const english = node.textContent.trim();
    if (english && translate(english, 'es') !== english) nodes.push({ node, english, original: node.textContent });
  }
  document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(element => {
    for (const name of ['placeholder', 'aria-label', 'title']) {
      const english = element.getAttribute(name);
      if (english) attributes.push({ element, name, english });
    }
  });
  function applyLanguage(language) {
    const lang = language === 'es' ? 'es' : 'en';
    document.documentElement.lang = lang;
    nodes.forEach(({ node, english, original }) => {
      // Dynamic form statuses are managed separately, without touching entered values.
      if (!node.parentElement?.closest('[data-i18n-en]')) node.textContent = original.replace(english, translate(english, lang));
    });
    attributes.forEach(({ element, name, english }) => element.setAttribute(name, translate(english, lang)));
    document.querySelectorAll('[data-i18n-en]').forEach(element => {
      const english = element.dataset.i18nEn;
      element.textContent = lang === 'es' ? (element.dataset.i18nEs ?? translate(english, lang)) : english;
    });
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === lang)));
    const subject = document.querySelector('#asunto');
    if (subject && ['CV request', 'Solicitud de CV'].includes(subject.value)) subject.value = translate('CV request', lang);
    try { localStorage.setItem('portfolio-language', lang); } catch { /* Storage may be disabled. */ }
    document.dispatchEvent(new CustomEvent('portfolio:language', { detail: lang }));
  }
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => applyLanguage(button.dataset.language)));
  document.querySelector('[data-cv-request]')?.addEventListener('click', () => {
    const subject = document.querySelector('#asunto');
    if (subject && !subject.value.trim()) subject.value = translate('CV request', currentLanguage());
  });
  let saved = 'en';
  try { saved = localStorage.getItem('portfolio-language') || 'en'; } catch { /* Use English by default. */ }
  applyLanguage(saved);
}
