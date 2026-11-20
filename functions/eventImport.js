// Reads a public event page and maps its schema.org Event JSON-LD block to a
// draft for the event form. Only the hosts below are ever requested, which is
// the guard against the callable being pointed at internal addresses.
const IMPORT_HOSTS = ["lu.ma", "luma.com"];
// Where Luma serves cover images. The browser downloads the cover itself, so
// this only decides which image addresses the form is ever handed.
const IMAGE_HOSTS = ["images.lumacdn.com"];
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 1000000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const DURATION_STEP_MINUTES = 15;
const MAX_DURATION_MINUTES = 1440;

const parseImportUrl = (value) => {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch (error) {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const allowed = url.protocol === "https:" && IMPORT_HOSTS.includes(host) &&
      !url.port && !url.username && !url.password;
  return allowed ? url : null;
};

// schema.org allows a string, an ImageObject, or a list of either.
const parseImageUrl = (image) => {
  const first = [].concat(image || [])[0];
  const value = first && typeof first === "object" ? first.url : first;
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    return null;
  }
  const allowed = url.protocol === "https:" &&
      IMAGE_HOSTS.includes(url.hostname) && !url.port;
  return allowed ? url.href : null;
};

const readCappedText = async (response) => {
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_PAGE_BYTES) throw new Error("Event page is too large.");
    text += decoder.decode(chunk, {stream: true});
  }
  return text + decoder.decode();
};

// Tags a failure with the callable error code it should reach the form as;
// untagged failures (timeout, network, oversized page) become `unavailable`.
const importError = (callableCode, message) =>
  Object.assign(new Error(message), {callableCode});

// Redirects are followed by hand so each hop is re-checked against the
// allowlist (lu.ma answers with a redirect to luma.com). Unread bodies are
// cancelled so the connection is released right away.
const fetchEventPage = async (startUrl, fetchImpl = fetch) => {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetchImpl(url.href, {
      redirect: "manual",
      signal,
      headers: {"user-agent": "Mozilla/5.0 (compatible; event-import)"},
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const target = response.headers.get("location");
      url = parseImportUrl(target ? new URL(target, url).href : null);
      if (!url) {
        throw importError("unavailable",
            "Redirect to an unsupported address.");
      }
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      const gone = response.status === 404 || response.status === 410;
      throw importError(gone ? "not-found" : undefined,
          `Event page returned ${response.status}.`);
    }
    return {html: await readCappedText(response), url};
  }
  throw new Error("Too many redirects.");
};

const isEventType = (type) =>
  [].concat(type || []).some((name) => /Event$/.test(String(name)));

const findEvent = (node) => {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    return node.map(findEvent).find(Boolean) || null;
  }
  if (isEventType(node["@type"])) return node;
  return findEvent(node["@graph"]);
};

const extractEventJsonLd = (html) => {
  const pattern = new RegExp(
      "<script[^>]*type=[\"']application/ld\\+json[\"'][^>]*>" +
      "([\\s\\S]*?)</script>", "gi");
  for (const match of String(html).matchAll(pattern)) {
    try {
      const event = findEvent(JSON.parse(match[1]));
      if (event) return event;
    } catch (error) {
      // Not valid JSON: try the next block.
    }
  }
  return null;
};

const asText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

// A time without an offset is read as hub time (Asia/Ho_Chi_Minh, which has
// no daylight saving), never as the server's own time zone.
const asInstant = (value) => {
  if (typeof value !== "string") return null;
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasOffset ? value : `${value}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Minutes rounded up to the form's 15-minute step; null when the page gives no
// usable end, so the form keeps its own value.
const getDurationMinutes = (start, end) => {
  if (!end || end <= start) return null;
  const minutes = (end - start) / 60000;
  const stepped =
    Math.ceil(minutes / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES;
  return Math.min(stepped, MAX_DURATION_MINUTES);
};

const toEventDraft = (event, pageUrl) => {
  if (!event) return null;
  const title = asText(event.name, MAX_TITLE_LENGTH);
  const start = asInstant(event.startDate);
  if (!title || !start) return null;
  const link = parseImportUrl(event.url) || pageUrl;
  return {
    title,
    description: asText(event.description, MAX_DESCRIPTION_LENGTH),
    date: start.toISOString(),
    duration: getDurationMinutes(start, asInstant(event.endDate)),
    eventLink: link.href,
    image: parseImageUrl(event.image),
  };
};

module.exports = {
  parseImportUrl,
  fetchEventPage,
  extractEventJsonLd,
  toEventDraft,
};
