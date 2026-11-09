// Pure email helpers, kept out of index.js so they can be unit-tested without
// initializing firebase-admin. Mirrors the split waitlist.js uses.

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

/**
 * Escapes text so it renders literally inside email HTML.
 * @param {*} value Text to escape; null/undefined become ""
 * @return {string} HTML-safe text
 */
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);

module.exports = {escapeHtml};
