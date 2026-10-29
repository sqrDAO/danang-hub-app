// Pure partner-org matching for scripts/assign-partners-by-company.cjs, kept
// out of the script so it can be unit-tested without firebase-admin.

/**
 * Lowercases, strips diacritics, spaces and punctuation:
 * "9AM Games", "9am-games" and "9AMGames" all become "9amgames".
 * @param {string} value Free text
 * @return {string} Normalized text
 */
function normalizePartnerName(value) {
  return String(value || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
}

/**
 * Finds the partner a member-entered company names. A company matches when it
 * contains the partner's normalized name ("9AM Games Studio" → 9AM Games).
 * Names shorter than 3 characters never match, to avoid accidental hits.
 * When several partners match, the longest name wins.
 * @param {string} company Member's free-text company
 * @param {Array<{id: string, name: string}>} partners Partner orgs
 * @return {{id: string, name: string}|null} Matching partner
 */
function matchPartnerForCompany(company, partners) {
  const normalized = normalizePartnerName(company);
  if (!normalized) return null;
  const matches = partners.filter((partner) => {
    const name = normalizePartnerName(partner.name);
    return name.length >= 3 && normalized.includes(name);
  });
  if (matches.length === 0) return null;
  return matches.reduce((best, partner) =>
    normalizePartnerName(partner.name).length >
      normalizePartnerName(best.name).length ? partner : best);
}

module.exports = {
  matchPartnerForCompany,
  normalizePartnerName,
};
