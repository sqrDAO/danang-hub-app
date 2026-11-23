// Dynamic client registration (RFC 7591) for public clients only.
const logger = require("firebase-functions/logger");
const {HOUR, LIFETIME, LIMITS} = require("./config");
const {
  sha256, randomHex, ts, isAllowedRedirect, isHostedRedirect, loopbackParts,
} = require("./util");

const GRANTS = ["authorization_code", "refresh_token"];
const UNUSED_DOC = "dcr-unused";
const UNUSED_WINDOW_HOURS = 24;
// Control and format characters (\p{Cf} covers U+180E), line and paragraph
// separators, and letters that render blank: the Hangul fillers and the
// Braille blank.
const INVISIBLE =
  /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u115F\u1160\u3164\uFFA0\u2800]/gu;

const fail = (status, error, description, headers) =>
  ({status, headers, body: {error, error_description: description}});
const invalidMetadata = (description) =>
  fail(400, "invalid_client_metadata", description);

const optionalList = (value, fallback) => {
  if (value === undefined) return fallback;
  return Array.isArray(value) && value.every((v) => typeof v === "string") ?
    value : null;
};
const cleanName = (value) => {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;
  // Self-declared and untrusted: drop control and invisible format
  // characters (bidi overrides and isolates, zero-width, BOM), line or
  // paragraph separators and blank-rendering letters, then cap the length.
  // A name that is blank after this is stored as "", like a missing one.
  return [...value.replace(INVISIBLE, "").trim()]
      .slice(0, LIMITS.clientName).join("");
};

// Returns {metadata} or {error}. token_endpoint_auth_method is always
// "none": RFC 7591 lets the server replace a requested value.
const validateMetadata = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {error: invalidMetadata("Send a JSON object.")};
  }
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || !uris.length ||
    uris.length > LIMITS.redirectUris) {
    return {error: fail(400, "invalid_redirect_uri",
        `Send 1 to ${LIMITS.redirectUris} redirect_uris.`)};
  }
  if (!uris.every(isAllowedRedirect)) {
    return {error: fail(400, "invalid_redirect_uri",
        "Only Claude, ChatGPT and loopback callbacks are allowed.")};
  }
  const grantTypes = optionalList(body.grant_types, GRANTS);
  if (!grantTypes || !grantTypes.every((g) => GRANTS.includes(g))) {
    return {error: invalidMetadata("Only authorization_code and " +
      "refresh_token grants are supported.")};
  }
  const responseTypes = optionalList(body.response_types, ["code"]);
  if (!responseTypes || !responseTypes.every((r) => r === "code")) {
    return {error: invalidMetadata("Only the code response type is " +
      "supported.")};
  }
  const clientName = cleanName(body.client_name);
  if (clientName === null) {
    return {error: invalidMetadata("client_name must be a string.")};
  }
  return {metadata: {redirectUris: [...new Set(uris)],
    grantTypes: [...new Set(grantTypes)],
    responseTypes: [...new Set(responseTypes)], clientName}};
};

const unusedCount = (buckets, hour) => Object.entries(buckets || {})
    .filter(([key]) => Number(key) > hour - UNUSED_WINDOW_HOURS)
    .reduce((sum, [, count]) => sum + count, 0);
const pruneBuckets = (buckets, hour) => Object.fromEntries(
    Object.entries(buckets || {})
        .filter(([key]) => Number(key) > hour - UNUSED_WINDOW_HOURS));

// Hosted callbacks (Claude, ChatGPT) come from shared egress IPs, so they
// share one global hourly cap; any loopback redirect is limited per IP.
const limitFor = (uris, ip, hour) => {
  const loopback = uris.some((uri) => loopbackParts(uri));
  return loopback ?
    {id: `dcr-ip-${sha256(String(ip || "unknown")).slice(0, 16)}-${hour}`,
      max: LIMITS.loopbackPerIpHour, hosted: false} :
    {id: `dcr-hosted-${hour}`, max: LIMITS.hostedPerHour, hosted: true};
};

const registerClient = async (db, body, {ip, now = Date.now()} = {}) => {
  const {metadata, error} = validateMetadata(body);
  if (error) return error;
  const hour = Math.floor(now / HOUR);
  const limit = limitFor(metadata.redirectUris, ip, hour);
  const limits = db.collection("oauthRateLimits");
  const limitRef = limits.doc(limit.id);
  const unusedRef = limits.doc(UNUSED_DOC);
  const clientId = "dhc_" + randomHex(16);
  const retryHour = String(Math.ceil(((hour + 1) * HOUR - now) / 1000));
  return db.runTransaction(async (tx) => {
    const counter = (await tx.get(limitRef)).data();
    const unused = (await tx.get(unusedRef)).data() || {};
    if (unusedCount(unused.buckets, hour) >= LIMITS.unusedClients) {
      return fail(503, "temporarily_unavailable",
          "Too many unused clients; try again later.",
          {"Retry-After": "3600"});
    }
    const count = (counter && counter.count) || 0;
    if (count >= limit.max) {
      return fail(429, "temporarily_unavailable",
          "Registration limit reached; try again later.",
          {"Retry-After": retryHour});
    }
    if (limit.hosted && count + 1 === limit.max / 2) {
      logger.warn("oauth: hosted DCR at 50% of hourly cap", {hour});
    }
    tx.set(limitRef, {count: count + 1,
      expiresAt: ts((hour + 2) * HOUR)});
    const buckets = pruneBuckets(unused.buckets, hour);
    buckets[hour] = (buckets[hour] || 0) + 1;
    tx.set(unusedRef, {buckets});
    tx.set(db.collection("oauthClients").doc(clientId), {
      ...metadata, createdAt: now, registeredHour: hour, usedAt: null,
      hosted: metadata.redirectUris.every(isHostedRedirect),
      expiresAt: ts(now + LIFETIME.unusedClient),
    });
    return {status: 201, body: {
      client_id: clientId,
      client_id_issued_at: Math.floor(now / 1000),
      client_name: metadata.clientName || undefined,
      redirect_uris: metadata.redirectUris,
      grant_types: metadata.grantTypes,
      response_types: metadata.responseTypes,
      token_endpoint_auth_method: "none",
    }};
  });
};

module.exports = {
  registerClient, validateMetadata, unusedCount, UNUSED_DOC, GRANTS,
};
