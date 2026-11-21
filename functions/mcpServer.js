const {McpServer} = require("@modelcontextprotocol/sdk/server/mcp.js");
const {StreamableHTTPServerTransport} =
  require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const {z} = require("zod");
const {HttpsError} = require("firebase-functions/v2/https");

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const time = z.string().datetime({offset: true})
    .describe("ISO-8601 with offset, e.g. 2026-12-01T09:00:00+07:00.");
const amenityId = id.describe("Amenity ID from list_amenities.");
const slot = {amenityId, startTime: time, endTime: time};
const pagination = {
  limit: z.number().int().min(1).max(50).default(20)
      .describe("Page size, 1-50 (default 20)."),
  cursor: id.optional().describe("nextCursor from the previous page."),
};
const instructions = "Da Nang Blockchain Hub booking for the member who " +
  "owns this token. To book: list_amenities for IDs and hours, " +
  "check_availability for the slot, confirm amenity and time with the " +
  "member, then create_booking with a new requestId (reuse it only to " +
  "retry the same slot). New bookings are pending until the Hub approves " +
  "them, so never report pending as confirmed; list_my_bookings shows the " +
  "current status. Hub time is Asia/Ho_Chi_Minh: send times with an " +
  "explicit offset such as +07:00. List tools page by ID, not date: follow " +
  "nextCursor until it is null. get_my_hours_left shows the monthly " +
  "ad-hoc desk allowance. cancel_booking only cancels the member's own " +
  "pending individual bookings; event spaces, desk plans and admin " +
  "actions stay in the Hub portal. Limit: 60 requests per minute; on a " +
  "rate-limit error wait a minute instead of retrying.";
// [name, title, description, input schema, readOnly]
const toolDefinitions = [
  ["list_amenities", "List Hub amenities", "List bookable amenities with " +
    "IDs, type, capacity and opening hours. Event spaces and other " +
    "partners' reserved desks are omitted.",
  z.object(pagination).strict(), true],
  ["check_availability", "Check a slot", "Check one slot; returns " +
    "availability and anonymous busy ranges. A check does not reserve " +
    "the slot.",
  z.object(slot).strict(), true],
  ["get_my_hours_left", "My desk hours left", "Your used and remaining " +
    "monthly ad-hoc desk hours; desk plans are excluded.",
  z.object({month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .describe("Month as YYYY-MM, in Asia/Ho_Chi_Minh time.")})
      .strict(), true],
  ["list_my_bookings", "List my bookings", "List only your bookings, " +
    "paginated by ID (not date). Returns IDs, times, status and source.",
  z.object(pagination).strict(), true],
  ["create_booking", "Book a slot", "Create your pending individual " +
    "booking after checking availability. Ask the member to confirm the " +
    "slot first. Reuse requestId on retries; approval/monthly limits run " +
    "afterwards.",
  z.object({...slot, requestId: id.describe(
      "Unique key you choose; reuse only to retry this exact slot.")})
      .strict(), false],
  ["cancel_booking", "Cancel my booking", "Cancel only your own pending " +
    "individual booking. Approved bookings and desk plans cannot be " +
    "cancelled here.",
  z.object({bookingId: id.describe("Booking ID from list_my_bookings.")})
      .strict(), false],
];

const createServer = (principal, handlers) => {
  const server = new McpServer({
    name: "danang-hub-mcp-server", version: "1.1.0",
  }, {instructions});
  for (const [name, title, description, schema, readOnly] of
    toolDefinitions) {
    server.registerTool(name, {
      title, description, inputSchema: schema,
      annotations: {readOnlyHint: readOnly,
        destructiveHint: name === "cancel_booking",
        idempotentHint: readOnly || name === "create_booking",
        openWorldHint: false},
    }, async (args) => {
      try {
        const result = await handlers[name](principal, schema.parse(args));
        return {content: [{type: "text", text: JSON.stringify(result)}],
          structuredContent: result};
      } catch (error) {
        const message = error instanceof HttpsError ? error.message :
          "Unable to complete this operation. Retry later or contact the Hub.";
        return {isError: true, content: [{type: "text", text: message}]};
      }
    });
  }
  return server;
};

const createHttpHandler = (authenticate, handlers, origins) =>
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      res.status(403).json({error: "Origin not allowed"});
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).end();
      return;
    }
    if ((req.rawBody && req.rawBody.length > 16384) ||
      JSON.stringify(req.body || {}).length > 16384) {
      res.status(413).end();
      return;
    }
    let server;
    try {
      const principal = await authenticate(req.headers.authorization);
      server = createServer(principal, handlers);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, enableJsonResponse: true,
      });
      res.on("close", () => {
        server.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (res.headersSent) return;
      const limited = error.code === "resource-exhausted";
      const denied = error.code === "unauthenticated" ||
      error.code === "auth/user-not-found";
      const status = limited ? 429 : denied ? 401 : 503;
      if (limited) res.setHeader("Retry-After", "60");
      if (denied) res.setHeader("WWW-Authenticate", "Bearer realm=\"Hub MCP\"");
      res.status(status).json({error: limited ? "Rate limit exceeded" :
      denied ? "Invalid or expired token" : "Service unavailable"});
    }
  };

module.exports = {createServer, createHttpHandler, toolDefinitions,
  instructions};
