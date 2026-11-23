// Client ID Metadata Documents (CIMD, draft-ietf-oauth-client-id-metadata-
// document): a client_id that is an HTTPS URL naming the client's own
// metadata. Only the exact URLs below are accepted, and only those exact
// strings are ever fetched, so a request cannot make the server fetch a URL
// of its choosing (SSRF). Sources for each URL: docs/knowledge/
// mcp-oauth-design.md, "CIMD (phase 4)".
const logger = require("firebase-functions/logger");
const {HOUR, LIMITS} = require("./config");
const {isAllowedRedirect} = require("./util");
const {cleanName} = require("./register");

const ALLOWLIST = Object.freeze([
  "https://chatgpt.com/oauth/client.json",
  "https://claude.ai/oauth/mcp-oauth-client-metadata",
  "https://claude.ai/oauth/claude-code-client-metadata",
]);
// cacheMs: a validated document is used without refetching. staleMs: past
// that, while the host is unreachable or refusing us (403/408/429/5xx,
// network, timeout), the last validated document keeps serving, so a
// Cloudflare challenge on Google Cloud egress does not end live grants.
// failureMs: such a failure is remembered so every request does not refetch.
const FETCH = Object.freeze({timeoutMs: 3000, maxBytes: 16 * 1024,
  cacheMs: HOUR, staleMs: 24 * HOUR, failureMs: 30 * 1000});
// Statuses that say "not now" rather than "this client is wrong".
const TRANSIENT = [403, 408, 429];
const GRANTS = ["authorization_code", "refresh_token"];
const MAX_LIST = 10;
const MAX_TEXT = 256;

// Per function instance, keyed by the allowlisted URL (so each map holds at
// most ALLOWLIST.length entries): validated documents, recent "unavailable"
// failures, and fetches in flight (concurrent resolves share one).
const cache = new Map();
const failures = new Map();
const inflight = new Map();
const resetCimdCache = () => {
  cache.clear();
  failures.clear();
  inflight.clear();
};

const isUrlClientId = (value) =>
  typeof value === "string" && value.startsWith("https://");
const isAllowedCimd = (value) =>
  typeof value === "string" && ALLOWLIST.includes(value);

const invalid = (description) => ({error: {kind: "invalid", description}});
const unavailable = (description) =>
  ({error: {kind: "unavailable", description}});

// Releases the connection of a body we will not read. Never throws.
const cancelBody = (response) => {
  try {
    if (response.body) response.body.cancel().catch(() => {});
  } catch (error) {
    // Already locked or closed: nothing to release.
  }
};

// Reads at most `max` bytes; anything longer is refused, not truncated.
const readCapped = async (response, max) => {
  const declared = Number(response.headers.get("content-length"));
  if (declared > max) {
    cancelBody(response);
    return null;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
};

// GET the document: HTTPS only, no redirects, no cookies or credentials, a
// time cap over the whole exchange and a size cap on the body.
const fetchDocument = async (url, {fetch = global.fetch,
  timeoutMs = FETCH.timeoutMs, maxBytes = FETCH.maxBytes} = {}) => {
  if (!isAllowedCimd(url)) return invalid("client_id is not allowlisted.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {method: "GET", redirect: "manual",
      credentials: "omit", headers: {Accept: "application/json"},
      signal: controller.signal});
    // A 3xx is refused, never followed (redirect: "manual").
    if (response.status !== 200) {
      cancelBody(response);
      const message = `Client metadata answered ${response.status}.`;
      return response.status >= 500 || TRANSIENT.includes(response.status) ?
        unavailable(message) : invalid(message);
    }
    if (!/json/i.test(response.headers.get("content-type") || "")) {
      cancelBody(response);
      return invalid("Client metadata is not JSON.");
    }
    const text = await readCapped(response, maxBytes);
    if (text === null) return invalid("Client metadata is too large.");
    return {text};
  } catch (error) {
    return unavailable(controller.signal.aborted ?
      "Client metadata timed out." : "Client metadata unreachable.");
  } finally {
    clearTimeout(timer);
  }
};

const isText = (v) => typeof v === "string" && v.length <= MAX_TEXT;
// undefined → fallback; anything but a short array of short strings → null.
const textList = (value, fallback) => {
  if (value === undefined) return fallback;
  return Array.isArray(value) && value.length <= MAX_LIST &&
    value.every(isText) ? value : null;
};

// The document must name itself, use only allowlisted redirect URIs, and
// allow a public client (token_endpoint_auth_method "none"). Grant types we
// do not support (ChatGPT and Claude list jwt-bearer) are dropped.
const checkLists = (doc) => {
  const redirects = textList(doc.redirect_uris, null);
  if (!redirects || !redirects.length ||
    redirects.length > LIMITS.redirectUris ||
    !redirects.every(isAllowedRedirect)) {
    return "redirect_uris must be allowlisted callbacks.";
  }
  const grants = textList(doc.grant_types, ["authorization_code"]);
  if (!grants || !grants.includes("authorization_code")) {
    return "grant_types must include authorization_code.";
  }
  const responses = textList(doc.response_types, ["code"]);
  if (!responses || !responses.includes("code")) {
    return "response_types must include code.";
  }
  return null;
};
const allowsPublicClient = (doc) => {
  const method = doc.token_endpoint_auth_method;
  const methods = textList(doc.token_endpoint_auth_methods_supported, []);
  if (method !== undefined && !isText(method)) return false;
  return Boolean(methods) && (method === "none" || methods.includes("none"));
};

const validateDocument = (url, text) => {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    return invalid("Client metadata is not JSON.");
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return invalid("Client metadata must be a JSON object.");
  }
  if (doc.client_id !== url) {
    return invalid("Client metadata client_id does not match its URL.");
  }
  const listError = checkLists(doc);
  if (listError) return invalid(listError);
  if (!allowsPublicClient(doc) || doc.client_secret !== undefined) {
    return invalid("Client must allow token_endpoint_auth_method none.");
  }
  if (doc.client_name !== undefined && !isText(doc.client_name)) {
    return invalid("client_name must be a short string.");
  }
  return {client: {
    clientId: url, cimd: true,
    clientName: cleanName(doc.client_name),
    redirectUris: [...new Set(doc.redirect_uris)],
    grantTypes: GRANTS.filter((g) =>
      textList(doc.grant_types, ["authorization_code"]).includes(g)),
  }};
};

// One fetch and validation per URL at a time.
const load = (url, fetch) => {
  if (!inflight.has(url)) {
    const run = fetchDocument(url, {fetch})
        .then((f) => f.error ? f : validateDocument(url, f.text))
        .finally(() => inflight.delete(url));
    inflight.set(url, run);
  }
  return inflight.get(url);
};

// During an "unavailable" failure: the last validated document if it is
// within the stale grace, else the error.
const staleOr = (url, error, now) => {
  const hit = cache.get(url);
  if (hit && hit.until + FETCH.staleMs > now) {
    logger.warn("oauth: CIMD serving stale client metadata", {url,
      reason: error.description, expiredAt: hit.until});
    return {client: hit.client, stale: true};
  }
  cache.delete(url);
  return {error};
};

// {client} for an allowlisted, valid document, else {error: {kind,
// description}}: kind "invalid" (refused) or "unavailable" (fetch failed).
// A URL outside the allowlist is refused without any network call. An
// "invalid" document drops the cached one; only "unavailable" serves stale.
const resolveCimdClient = async (url, {now = Date.now(), fetch} = {}) => {
  if (!isAllowedCimd(url)) return invalid("client_id is not allowlisted.");
  const hit = cache.get(url);
  if (hit && hit.until > now) return {client: hit.client};
  const failed = failures.get(url);
  if (failed && failed.until > now) return staleOr(url, failed.error, now);
  const result = await load(url, fetch);
  if (result.client) {
    cache.set(url, {client: result.client, until: now + FETCH.cacheMs});
    failures.delete(url);
    return result;
  }
  logger.warn("oauth: CIMD client refused", {url,
    reason: result.error.description});
  if (result.error.kind === "invalid") {
    cache.delete(url);
    failures.delete(url);
    return result;
  }
  failures.set(url, {error: result.error, until: now + FETCH.failureMs});
  return staleOr(url, result.error, now);
};

module.exports = {
  ALLOWLIST, FETCH, isUrlClientId, isAllowedCimd, fetchDocument,
  validateDocument, resolveCimdClient, resetCimdCache,
};
