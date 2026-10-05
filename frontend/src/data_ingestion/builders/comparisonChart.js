// Semantic, scale-free comparisons: every metric retains its own unit.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function renderComparisonChart(data, options) {
  const { xKey, baseline, current, metrics, label } = options;
  if (!xKey || !label || !Array.isArray(metrics) || !metrics.length || baseline === current) {
    throw new Error('Comparison requires a label, xKey, distinct periods and metrics');
  }
  const period = (value) => {
    const rows = data.filter((row) => row[xKey] === value);
    if (rows.length !== 1) throw new Error(`Comparison requires exactly one row for ${value}`);
    return rows[0];
  };
  const previous = period(baseline);
  const latest = period(current);
  const number = (value, digits, signed = false) => value.toLocaleString('de-DE', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  });
  const rows = metrics.map(({ key, label: metricLabel, unit, digits = 1, delta = 'percent', deltaDigits = 1 }) => {
    if (!key || !metricLabel || !unit || !['percent', 'percentagePoints'].includes(delta)
      || (delta === 'percentagePoints' && unit !== '%')
      || ![digits, deltaDigits].every((n) => Number.isInteger(n) && n >= 0 && n <= 6)) {
      throw new Error('Invalid comparison metric/unit/precision/delta');
    }
    const a = previous[key];
    const b = latest[key];
    if (![a, b].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error(`Missing or non-finite comparison value: ${key}`);
    }
    // Relative change is ambiguous at zero or a negative baseline; keep absolute
    // observations visible and state that the relative comparison is unavailable.
    const change = delta === 'percentagePoints' ? b - a : a > 0 ? 100 * (b / a - 1) : null;
    if (change !== null && !Number.isFinite(change)) throw new Error('Non-finite comparison delta');
    const changeLabel = change === null ? 'Relative Änderung nicht definiert'
      : `${number(change, deltaDigits, true)} ${delta === 'percentagePoints' ? 'Prozentpunkte' : '%'}`;
    return `<div class="comparison-chart__metric"><dt>${escapeHtml(metricLabel)}</dt><dd>`
      + `<span class="comparison-chart__value"><span class="comparison-chart__period">${escapeHtml(baseline)}</span> ${number(a, digits)} ${escapeHtml(unit)}</span>`
      + '<span class="comparison-chart__arrow" aria-hidden="true">→</span>'
      + `<span class="comparison-chart__value"><span class="comparison-chart__period">${escapeHtml(current)}</span> <strong>${number(b, digits)} ${escapeHtml(unit)}</strong></span>`
      + `<span class="comparison-chart__delta">${escapeHtml(changeLabel)}<span class="comparison-chart__period"> gegenüber ${escapeHtml(baseline)}</span></span>`
      + '</dd></div>';
  });
  return `<dl class="comparison-chart" aria-label="${escapeHtml(label)}">${rows.join('')}</dl>`;
}

function buildComparisonChart(data, options) {
  if (!options.containerId) throw new Error('Comparison requires containerId');
  const html = renderComparisonChart(data, options);
  const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
  // The shortcode provides the same HTML at build time (including feeds/no-JS).
  // Standard script-only embeds also work; never duplicate server-rendered content.
  return `(() => {\n  const container = document.getElementById(${json(options.containerId)});\n  if (container && !container.querySelector('.comparison-chart')) container.innerHTML = ${json(html)};\n})();\n`;
}

module.exports = { buildComparisonChart, renderComparisonChart };
