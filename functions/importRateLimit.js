const WINDOW_MS = 60 * 60 * 1000;
const MAX_IMPORTS = 10;

// Returns null when the current account window has exhausted its quota.
const nextRateLimitState = (state, now) => {
  if (!state || now - state.windowStart >= WINDOW_MS) {
    return {windowStart: now, count: 1};
  }
  if (state.count >= MAX_IMPORTS) return null;
  return {windowStart: state.windowStart, count: state.count + 1};
};

module.exports = {nextRateLimitState};
