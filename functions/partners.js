// Pure partner-org matching for scripts/assign-partners-by-company.cjs, kept
// out of the script so it can be unit-tested without firebase-admin.

/**
 * Strips diacritics (and maps "đ", which NFKD keeps, to "d") and lowercases.
 * @param {string} value Free text
 * @return {string} Folded text
 */
function foldVietnamese(value) {
  return String(value || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase();
}

/**
 * Lowercases, strips diacritics, spaces and punctuation:
 * "9AM Games", "9am-games" and "9AMGames" all become "9amgames".
 * Mirrored in src/utils/deskPlans.js.
 * @param {string} value Free text
 * @return {string} Normalized text
 */
function normalizePartnerName(value) {
  return foldVietnamese(value).replace(/[^a-z0-9]/g, "");
}

/**
 * Folded words, padded with spaces so whole words can be found with
 * includes(): "Công ty Trí tuệ số" becomes " cong ty tri tue so ".
 * @param {string} value Free text
 * @return {string} Padded words
 */
function paddedWords(value) {
  const words = foldVietnamese(value).replace(/[^a-z0-9]+/g, " ").trim();
  return words ? ` ${words} ` : "";
}

// Other names members give for a partner's company, keyed by the partner's
// normalized name (the script warns when a key matches no partner, e.g.
// after a rename). Aliases match whole words only. DiiD's legal name is
// "Công ty TNHH Phát triển Trí tuệ số", which members shorten in several
// ways; "Trí tuệ số" is common to all of them.
const PARTNER_ALIASES = {
  diid: ["Trí tuệ số"],
};

/**
 * Alias keys that name no partner, so their aliases never apply.
 * @param {Array<{name: string}>} partners Partner orgs
 * @return {Array<string>} Unused keys
 */
function unusedAliasKeys(partners) {
  const names = new Set(partners.map((p) => normalizePartnerName(p.name)));
  return Object.keys(PARTNER_ALIASES).filter((key) => !names.has(key));
}

/**
 * How well a company names a partner, or 0. The partner's own name matches
 * anywhere ("9AM Games Studio" → 9AM Games) and needs 3+ characters, to
 * avoid accidental hits; aliases match whole words. Longer matches score
 * higher, and on a tie the partner's own name beats an alias.
 * @param {string} company Member's free-text company
 * @param {{name: string}} partner Partner org
 * @return {number} Match score
 */
function matchScore(company, partner) {
  const name = normalizePartnerName(partner.name);
  const words = paddedWords(company);
  const aliasLengths = (PARTNER_ALIASES[name] || [])
      .filter((alias) => paddedWords(alias) &&
        words.includes(paddedWords(alias)))
      .map((alias) => normalizePartnerName(alias).length * 2);
  const nameMatches = name.length >= 3 &&
    normalizePartnerName(company).includes(name);
  return Math.max(0, nameMatches ? name.length * 2 + 1 : 0, ...aliasLengths);
}

/**
 * Finds the partner a member-entered company names: the best match by
 * matchScore, or null when none match.
 * @param {string} company Member's free-text company
 * @param {Array<{id: string, name: string}>} partners Partner orgs
 * @return {{id: string, name: string}|null} Matching partner
 */
function matchPartnerForCompany(company, partners) {
  let best = null;
  let bestScore = 0;
  partners.forEach((partner) => {
    const score = matchScore(company, partner);
    if (score > bestScore) {
      best = partner;
      bestScore = score;
    }
  });
  return best;
}

module.exports = {
  PARTNER_ALIASES,
  unusedAliasKeys,
  matchPartnerForCompany,
  normalizePartnerName,
};
