/**
 * Deliberately cheap token estimator. Exact counts need a tokenizer per model;
 * budgets here are order-of-magnitude gates, so a calibrated ratio is enough.
 * Ratios follow the density figures for prose vs code vs structured data.
 */
const RATIOS = [
  { test: /\.json$/i, charsPerToken: 2.6 },
  { test: /\.(ts|tsx|jsx)$/i, charsPerToken: 3.0 },
  { test: /\.(py|go|java|cs|cpp|c|h|rs)$/i, charsPerToken: 3.2 },
  { test: /\.(md|txt)$/i, charsPerToken: 4.0 },
];

const DEFAULT_CHARS_PER_TOKEN = 3.6;

export function charsPerToken(filename = '') {
  return RATIOS.find((r) => r.test.test(filename))?.charsPerToken ?? DEFAULT_CHARS_PER_TOKEN;
}

export function estimateTokens(text, filename = '') {
  return Math.ceil(text.length / charsPerToken(filename));
}

export function formatTokens(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
