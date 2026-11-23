const crypto = require("node:crypto");
const {Timestamp} = require("firebase-admin/firestore");
const {LIMITS} = require("./config");

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const randomHex = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
// RFC 7636 S256: BASE64URL(SHA256(ASCII(code_verifier))).
const s256 = (verifier) =>
  crypto.createHash("sha256").update(verifier).digest("base64url");
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const verifyPkce = (verifier, challenge) =>
  typeof verifier === "string" && VERIFIER.test(verifier) &&
  safeEqual(s256(verifier), challenge);

// expiresAt fields are Firestore Timestamps so TTL policies can delete them.
const ts = (ms) => Timestamp.fromMillis(ms);
const millis = (value) =>
  value && typeof value.toMillis === "function" ? value.toMillis() : value;
const expired = (data, now) =>
  !data || !(millis(data.expiresAt) > now);

// Decision 2: only Claude, ChatGPT and loopback (Claude Code, Codex, MCP
// Inspector) callbacks may register.
const HOSTED_REDIRECTS = [
  /^https:\/\/claude\.ai\/api\/mcp\/auth_callback$/,
  /^https:\/\/claude\.com\/api\/mcp\/auth_callback$/,
  /^https:\/\/chatgpt\.com\/connector_platform_oauth_redirect$/,
  /^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]{1,128}$/,
];
// Paths: /callback (Claude Code, Codex), /callback/<id> (Codex appends a
// per-server callback id when the AS does not advertise RFC 9207 iss),
// /oauth/callback and /oauth/callback/debug (MCP Inspector). The id is part
// of the exact path match; only the port is ignored.
const LOOPBACK = new RegExp("^http://(localhost|127\\.0\\.0\\.1)" +
  "(?::(\\d{1,5}))?(/callback(?:/[A-Za-z0-9_-]{1,128})?|/oauth/callback" +
  "|/oauth/callback/debug)$");
const loopbackParts = (uri) => {
  const match = typeof uri === "string" && LOOPBACK.exec(uri);
  if (!match) return null;
  const port = match[2] === undefined ? 80 : Number(match[2]);
  return port >= 1 && port <= 65535 ? {host: match[1], path: match[3]} : null;
};
const isHostedRedirect = (uri) =>
  typeof uri === "string" && HOSTED_REDIRECTS.some((re) => re.test(uri));
// Every allowed form is short; the cap keeps a client document small.
const isAllowedRedirect = (uri) =>
  typeof uri === "string" && uri.length <= LIMITS.redirectUriLength &&
  (isHostedRedirect(uri) || Boolean(loopbackParts(uri)));
// Exact match, except loopback ignores the port (RFC 8252 section 7.3).
const redirectMatches = (registered, requested) => {
  if (typeof requested !== "string") return false;
  return registered.some((uri) => {
    if (uri === requested) return true;
    const a = loopbackParts(uri);
    const b = loopbackParts(requested);
    return Boolean(a && b && a.host === b.host && a.path === b.path);
  });
};

module.exports = {
  sha256, randomHex, s256, safeEqual, verifyPkce, CHALLENGE, ts, millis,
  expired, isHostedRedirect, isAllowedRedirect, loopbackParts,
  redirectMatches,
};
