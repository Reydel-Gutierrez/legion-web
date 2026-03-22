export function buildPath(values, min, max, w, h, padLeft, padRight, padV) {
  const pr = padRight ?? padLeft;
  const pv = padV ?? padLeft;
  const innerW = w - padLeft - pr;
  const innerH = h - pv * 2;
  const n = values.length;
  if (n < 2) return "";

  const x = (i) => padLeft + (innerW * i) / (n - 1);
  const y = (v) => {
    const t = (v - min) / (max - min || 1);
    return pv + innerH - innerH * t;
  };

  let d = "";
  for (let i = 0; i < n; i++) {
    const xi = x(i);
    const yi = y(values[i]);
    d += i === 0 ? `M ${xi} ${yi}` : ` L ${xi} ${yi}`;
  }
  return d;
}

export function scaleX(idx, n, w, padLeft, padRight) {
  const pr = padRight ?? padLeft;
  const innerW = w - padLeft - pr;
  return padLeft + (innerW * idx) / (n - 1 || 1);
}

export function scaleY(v, min, max, h, pad) {
  const innerH = h - pad * 2;
  const t = (v - min) / (max - min || 1);
  return pad + innerH - innerH * t;
}

/**
 * Picks evenly spaced tick indices with no duplicates (rounding can collapse ticks for small n).
 * @param {number} n
 * @param {number} maxTicks
 * @returns {number[]}
 */
export function pickAxisTickIndices(n, maxTicks) {
  if (n < 2) return [];
  const cap = Math.max(2, Math.min(maxTicks, n));
  const raw = Array.from({ length: cap }, (_, k) => Math.round((k * (n - 1)) / (cap - 1)));
  return [...new Set(raw)].sort((a, b) => a - b);
}

/**
 * Formats trend x-axis labels as compact date + time (e.g. "3/21 15:06").
 * Drops trailing /yy on the date segment to save space; keeps time on every tick.
 * @param {string} label
 */
export function formatAxisTimeLabel(label) {
  if (!label || typeof label !== "string") return "—";
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return label;
  const datePart = parts[0];
  const timePart = parts.slice(1).join(" ");
  const dateShort = datePart.replace(/\/(\d{2}|\d{4})$/, "");
  return `${dateShort} ${timePart}`;
}

/**
 * Drops ticks whose formatted label matches the previous tick (same clock minute at different indices).
 * @param {{ idx: number; x: number; label: string }[]} ticks
 */
export function dedupeAxisTickLabels(ticks) {
  const out = [];
  let prev = null;
  for (const t of ticks) {
    if (t.label === prev) continue;
    prev = t.label;
    out.push(t);
  }
  return out;
}
