const {McpServer} = require("@modelcontextprotocol/sdk/server/mcp.js");
const {StreamableHTTPServerTransport} =
  require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const {z} = require("zod");
const {HttpsError} = require("firebase-functions/v2/https");

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const time = z.string().datetime({offset: true})
    .describe("ISO-8601 with offset, e.g. 2026-12-01T09:00:00+07:00.");
const slot = {amenityId: id, startTime: time, endTime: time};
const pagination = {limit: z.number().int().min(1).max(50).default(20),
  cursor: id.optional().describe("nextCursor from the previous page.")};
const toolDefinitions = [
  ["list_amenities", "List bookable amenities with Hub hours and IDs.",
    z.object(pagination).strict(), true],
  ["check_availability", "Check one slot; returns availability and anonymous " +
    "busy ranges. A check does not reserve the slot.",
  z.object(slot).strict(), true],
  ["get_my_hours_left", "Your remaining monthly ad-hoc desk hours; plans " +
    "are excluded. Month uses Asia/Ho_Chi_Minh.",
  z.object({month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)})
      .strict(), true],
  ["list_my_bookings", "List only your bookings, paginated by ID. " +
    "Returns IDs, dates, status and source; not other members' details.",
  z.object(pagination).strict(), true],
  ["create_booking", "Create your pending individual booking after " +
    "checking availability. Ask the member to confirm the slot first. " +
    "Reuse requestId on retries; approval/monthly limits run afterwards.",
  z.object({...slot, requestId: id.describe("Unique key; reuse on retry.")})
      .strict(), false],
  ["cancel_booking", "Cancel only your own pending individual booking. " +
    "Approved bookings and desk plans cannot be cancelled here.",
  z.object({bookingId: id}).strict(), false],
];

const createServer = (principal, handlers) => {
  const server = new McpServer({
    name: "danang-hub-mcp-server", version: "1.0.0",
  });
  for (const [name, description, schema, readOnly] of toolDefinitions) {
    server.registerTool(name, {
      title: name.replaceAll("_", " "), description, inputSchema: schema,
      annotations: {readOnlyHint: readOnly, destructiveHint: !readOnly,
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

module.exports = {createServer, createHttpHandler, toolDefinitions};
