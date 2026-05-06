export function normalizeDimensions(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\\"/g, '″')
    .replace(/"/g, '″')
    .replace(/\s*X\s*/g, ' × ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HW_PATTERN = /(\d+(?:\.\d+)?)["″]?\s*h\s*[X×]\s*(\d+(?:\.\d+)?)["″]?\s*w/i;

export function parseDimensions(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\\"/g, '"');
  const m = cleaned.match(HW_PATTERN);
  if (!m) return null;
  return {
    height: parseFloat(m[1]),
    width: parseFloat(m[2]),
    unit: 'in',
  };
}
