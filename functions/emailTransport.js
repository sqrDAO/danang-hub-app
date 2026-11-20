/**
 * Creates a lazy getter for a process-local SMTP pool.
 * @param {Function} createTransport Factory, loaded on first use by default.
 * @param {object} env Runtime environment, read when the getter first runs.
 * @return {Function} Getter returning the same transporter on later calls.
 */
function createTransporterGetter(
    createTransport = (options) =>
      require("nodemailer").createTransport(options),
    env = process.env,
) {
  let transporter;
  return () => {
    if (transporter) return transporter;
    transporter = createTransport({
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      maxRequeues: 1,
      idleTimeout: 60000,
      socketTimeout: 20000,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      dnsTimeout: 5000,
      host: env.EMAIL_SMTP_HOST,
      port: parseInt(env.EMAIL_SMTP_PORT || "465"),
      secure: env.EMAIL_SMTP_SECURE !== "false",
      auth: {user: env.EMAIL_USER, pass: env.EMAIL_PASS},
    });
    return transporter;
  };
}

const getTransporter = createTransporterGetter();
module.exports = {createTransporterGetter, getTransporter};
