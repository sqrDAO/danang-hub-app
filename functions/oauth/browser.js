// Browser binding for consent: /oauth/authorize gives the browser a random
// id in an HttpOnly cookie and stores only its SHA-256 on the request;
// describe, approve and deny refuse a browser without it. This stops a
// sign-in started in someone else's browser (their connector, their
// callback) from being approved by a member who was sent the consent link.
// Firebase Hosting forwards only a cookie named `__session` to functions.
const {HttpsError} = require("firebase-functions/v2/https");
const {LIFETIME} = require("./config");
const {sha256, safeEqual} = require("./util");

const BROWSER_COOKIE = "__session";
const BROWSER_ID = /^[a-f0-9]{64}$/;

// The browser id from a Cookie header, or null when absent or malformed.
const readBrowserId = (header) => {
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (name === BROWSER_COOKIE && BROWSER_ID.test(value)) return value;
  }
  return null;
};

// One id per browser, not per request, so concurrent sign-ins in one browser
// share it; each authorize refreshes Max-Age to cover its own request.
// Path=/oauth reaches /oauth/authorize and /oauth/consent-action only.
const browserCookie = (id) => `${BROWSER_COOKIE}=${id}; ` +
  `Max-Age=${LIFETIME.request / 1000}; Path=/oauth; Secure; HttpOnly; ` +
  "SameSite=Lax";

const OTHER_BROWSER = "This sign-in link was opened in a different " +
  "browser. Start the connection again from your app.";
const requireSameBrowser = (request, browserId) => {
  const same = typeof browserId === "string" &&
    typeof request.browserHash === "string" &&
    safeEqual(sha256(browserId), request.browserHash);
  if (!same) {
    throw new HttpsError("permission-denied", OTHER_BROWSER,
        {reason: "browser"});
  }
};

module.exports = {
  BROWSER_COOKIE, readBrowserId, browserCookie, requireSameBrowser,
};
