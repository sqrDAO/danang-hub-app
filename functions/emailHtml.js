// Pure email helpers, kept out of index.js so they can be unit-tested without
// initializing firebase-admin. Mirrors the split waitlist.js uses.

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

/**
 * Escapes text so it renders literally inside email HTML.
 * @param {*} value Text to escape; null/undefined become ""
 * @return {string} HTML-safe text
 */
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);

/**
 * Builds the HTML sent to an event organizer after review.
 * @param {Object} options Event status and recipient display values
 * @return {string} Complete escaped email HTML
 */
const buildEventStatusEmail = ({
  isApproved, eventTitle, displayName, rejectionReason, appUrl,
}) => {
  const eventTitleHtml =
    `<strong style="color:#38bdf8;">` +
    `"${escapeHtml(eventTitle)}"</strong>`;
  const statusHtml = isApproved ?
    `${eventTitleHtml} has been ` +
      `<strong style="color:#22c55e;">approved</strong>` +
    ` and is now live on the events calendar.` :
    `We're sorry, ${eventTitleHtml} was ` +
      `<strong style="color:#ef4444;">not approved</strong>` +
    ` at this time.`;
  const followUpHtml = isApproved ?
    `Members can now see and register for your event.` +
    ` You'll receive reminders as the date approaches.` :
    `You're welcome to submit a new event request` +
    ` after addressing the feedback above.`;
  /* eslint-disable max-len */
  const guidelinesHtml = isApproved ?
    `<p style="margin:20px 0 0;color:#94a3b8;font-size:14px;">` +
    `Please review our ` +
    `<a href="https://www.danangblockchainhub.com/event-guidelines.html" ` +
    `style="color:#38bdf8;text-decoration:none;">Event Guidelines</a>` +
    ` and ` +
    `<a href="https://www.danangblockchainhub.com/community-space-guidelines.html" ` +
    `style="color:#38bdf8;text-decoration:none;">Community Space Guidelines</a>` +
    ` before your event to ensure a smooth experience for all attendees.</p>` : "";
  /* eslint-enable max-len */

  const reasonText = rejectionReason || "No reason was provided.";
  const reasonHtml = isApproved ? "" :
    `<div style="margin:20px 0;padding:16px;` +
    `background:#fff1f2;border-left:4px solid #ef4444;` +
    `border-radius:6px;">` +
    `<p style="margin:0;font-size:14px;color:#991b1b;">` +
    `<strong>Reason:</strong> ${escapeHtml(reasonText)}</p></div>`;

  /* eslint-disable max-len */
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
              Da Nang Blockchain Hub
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;">
              Hi ${escapeHtml(displayName)},
            </p>
            <p style="margin:0 0 20px;color:#e2e8f0;font-size:16px;line-height:1.6;">
              ${statusHtml}
            </p>
            ${reasonHtml}
            <p style="margin:20px 0 0;color:#94a3b8;font-size:14px;">
              ${followUpHtml}
            </p>
            ${guidelinesHtml}
            <div style="margin:32px 0;text-align:center;">
              <a href="${appUrl}/member/events"
                 style="display:inline-block;padding:12px 28px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                View My Events
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;color:#475569;font-size:12px;">
              Da Nang Blockchain Hub &mdash; You're receiving this because you submitted an event request.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  /* eslint-enable max-len */
};

module.exports = {escapeHtml, buildEventStatusEmail};
