// Request router for the `oauth` function (Hosting rewrites send the
// well-known and /oauth/* endpoints here). No MCP SDK is loaded.
const logger = require("firebase-functions/logger");
const {
  protectedResourceMetadata, authorizationServerMetadata, DISCOVERY_ENABLED,
} = require("./config");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, " +
    "MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};
const METADATA = {
  "/.well-known/oauth-protected-resource": protectedResourceMetadata,
  "/.well-known/oauth-protected-resource/mcp": protectedResourceMetadata,
  "/.well-known/oauth-authorization-server": authorizationServerMetadata,
};

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) =>
  ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;",
    "'": "&#39;"})[c]);
const errorPage = (message) => "<!doctype html><html lang=\"en\"><head>" +
  "<meta charset=\"utf-8\"><meta name=\"viewport\" " +
  "content=\"width=device-width\"><title>Sign-in error</title></head><body>" +
  "<h1>Can't start sign-in</h1><p>" + escapeHtml(message) + "</p><p>Go " +
  "back to your AI app and add the Hub connector again.</p></body></html>";

// Firebase Hosting sets fastly-client-ip; direct calls fall back to req.ip.
const clientIp = (req) => req.headers["fastly-client-ip"] || req.ip;

const sendResult = (res, result, cors) => {
  res.set({...(cors ? CORS : {}), ...(result.headers || {})});
  if (result.location) {
    res.set("Location", result.location).status(302).end();
  } else if (result.page) {
    res.set("Content-Type", "text/html; charset=utf-8")
        .status(result.status).send(errorPage(result.page));
  } else {
    res.status(result.status).json(result.body);
  }
};

const route = (db, req, now) => {
  const options = {now, headers: req.headers};
  const handlers = {
    "POST /oauth/register": () => require("./register")
        .registerClient(db, req.body, {ip: clientIp(req), now}),
    "GET /oauth/authorize": () => require("./authorize")
        .authorize(db, req.query, {now}),
    "POST /oauth/token": () => require("./token")
        .token(db, req.body, options),
    "POST /oauth/revoke": () => require("./token")
        .revoke(db, req.body, options),
  };
  return handlers[`${req.method} ${req.path}`];
};

// `discovery` defaults to DISCOVERY_ENABLED; tests pass false to check the
// dark (404) mode that phase 2 shipped.
const createOauthHandler = (db, {now = () => Date.now(),
  discovery = DISCOVERY_ENABLED} = {}) =>
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    const path = req.path;
    const cors = path !== "/oauth/authorize";
    if (req.method === "OPTIONS" && cors) {
      res.set(CORS).status(204).end();
      return;
    }
    if (METADATA[path] && req.method === "GET") {
      if (discovery) res.set(CORS).status(200).json(METADATA[path]());
      else res.set(CORS).status(404).json({error: "not_found"});
      return;
    }
    const handler = route(db, req, now());
    if (!handler) {
      sendResult(res, {status: 404, body: {error: "not_found"}}, cors);
      return;
    }
    try {
      sendResult(res, await handler(), cors);
    } catch (error) {
      logger.error("oauth: request failed", {path, message: error.message});
      sendResult(res, {status: 500, body: {error: "server_error"}}, cors);
    }
  };

module.exports = {createOauthHandler, escapeHtml};
