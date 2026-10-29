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

// Other names members give for a partner's company, keyed by the partner's
// normalized name. DiiD's legal name is "Công ty TNHH Phát triển Trí tuệ số",
// which members shorten in several ways; "tritueso" is common to all of them.
const PARTNER_ALIASES = {
  diid: ["Trí tuệ số"],
};

/**
 * The normalized names a partner is matched by: its own and its aliases.
 * @param {{name: string}} partner Partner org
 * @return {Array<string>} Normalized names
 */
function partnerNames(partner) {
  const name = normalizePartnerName(partner.name);
  return [name, ...(PARTNER_ALIASES[name] || []).map(normalizePartnerName)];
}

/**
 * Length of the longest of a partner's names the company contains, or 0.
 * Names shorter than 3 characters never match, to avoid accidental hits.
 * @param {string} normalized Normalized company
 * @param {{name: string}} partner Partner org
 * @return {number} Match length
 */
function matchLength(normalized, partner) {
  return Math.max(0, ...partnerNames(partner)
      .filter((name) => name.length >= 3 && normalized.includes(name))
      .map((name) => name.length));
}

/**
 * Finds the partner a member-entered company names. A company matches when it
 * contains the partner's normalized name or one of its aliases
 * ("9AM Games Studio" → 9AM Games). When several partners match, the longest
 * matching name wins.
 * @param {string} company Member's free-text company
 * @param {Array<{id: string, name: string}>} partners Partner orgs
 * @return {{id: string, name: string}|null} Matching partner
 */
function matchPartnerForCompany(company, partners) {
  const normalized = normalizePartnerName(company);
  if (!normalized) return null;
  let best = null;
  let bestLength = 0;
  partners.forEach((partner) => {
    const length = matchLength(normalized, partner);
    if (length > bestLength) {
      best = partner;
      bestLength = length;
    }
  });
  return best;
}

module.exports = {
  PARTNER_ALIASES,
  matchPartnerForCompany,
  normalizePartnerName,
};
