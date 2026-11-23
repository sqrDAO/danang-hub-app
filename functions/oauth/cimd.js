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
const FETCH = Object.freeze({timeoutMs: 3000, maxBytes: 16 * 1024,
  cacheMs: HOUR});
const GRANTS = ["authorization_code", "refresh_token"];
const MAX_LIST = 10;
const MAX_TEXT = 256;

// Validated documents only, keyed by the allowlisted URL. Per function
// instance; at most ALLOWLIST.length entries.
const cache = new Map();
const resetCimdCache = () => cache.clear();

const isUrlClientId = (value) =>
  typeof value === "string" && value.startsWith("https://");
const isAllowedCimd = (value) =>
  typeof value === "string" && ALLOWLIST.includes(value);

const invalid = (description) => ({error: {kind: "invalid", description}});
const unavailable = (description) =>
  ({error: {kind: "unavailable", description}});

// Reads at most `max` bytes; anything longer is refused, not truncated.
const readCapped = async (response, max) => {
  const declared = Number(response.headers.get("content-length"));
  if (declared > max) return null;
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
      const message = `Client metadata answered ${response.status}.`;
      return response.status >= 500 ? unavailable(message) : invalid(message);
    }
    if (!/json/i.test(response.headers.get("content-type") || "")) {
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

// {client} for an allowlisted, valid document, else {error: {kind,
// description}}: kind "invalid" (refused) or "unavailable" (fetch failed).
// A URL outside the allowlist is refused without any network call.
const resolveCimdClient = async (url, {now = Date.now(), fetch} = {}) => {
  if (!isAllowedCimd(url)) return invalid("client_id is not allowlisted.");
  const hit = cache.get(url);
  if (hit && hit.until > now) return {client: hit.client};
  const fetched = await fetchDocument(url, {fetch});
  const result = fetched.error ? fetched : validateDocument(url, fetched.text);
  if (result.error) {
    logger.warn("oauth: CIMD client refused", {url,
      reason: result.error.description});
    return result;
  }
  cache.set(url, {client: result.client, until: now + FETCH.cacheMs});
  return result;
};

module.exports = {
  ALLOWLIST, FETCH, isUrlClientId, isAllowedCimd, fetchDocument,
  validateDocument, resolveCimdClient, resetCimdCache,
};
