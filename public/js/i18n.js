// Idioma de la página. Las páginas en inglés viven en /en/, cargan antes js/en.js
// (window.EN_TXT: texto en castellano → texto en inglés) y ponen lang="en".
(function (root) {
  'use strict';
  const doc = root.document;
  const en = !!doc && doc.documentElement.lang === 'en';
  const D = root.EN_TXT || {};
  const faltan = new Set();
  // Los textos que ya están en inglés pasan tal cual (así da igual traducir dos veces)
  const yaEn = new Set(Object.values(D));

  // t('Quedan {n} pasos', { n: 3 }): traduce si la página es inglesa y rellena los huecos.
  function t(s, v) {
    let r = s;
    if (en) {
      if (Object.prototype.hasOwnProperty.call(D, s)) r = D[s];
      else if (!yaEn.has(s) && !faltan.has(s)) { faltan.add(s); if (root.console) console.warn('[i18n] sin traducir: ' + s); }
    }
    if (v) r = r.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
    return r;
  }
  // Textos que no se traducen (nombres propios, como la designación de una unidad)
  function literal(s) { yaEn.add(s); }
  // Número con la coma o el punto decimal del idioma
  function num(n, dec) { const s = n.toFixed(dec); return en ? s : s.replace('.', ','); }

  root.I18N = { en, lang: en ? 'en' : 'es', t, literal, num, raiz: en ? '../' : '', faltan };
})(typeof window !== 'undefined' ? window : globalThis);
