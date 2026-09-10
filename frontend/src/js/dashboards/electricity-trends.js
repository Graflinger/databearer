/* Fixed long-term views: no selected-period state, requests or event handlers. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./electricity-data'), require('./electricity-history'));
  else factory(root.ElectricityData, root.ElectricityHistory).mount();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (data, history) {
  'use strict';
  function options(summary, colors) {
    const { ink, line, accent, muted, font } = colors;
    const labels = summary.energy.map((row) => String(row.year));
    const signed = (value, digits = 2) => `${value > 0 ? '+' : ''}${data.number(value, digits)}`;
    function base(unit, categories, description, coverage) {
      return { animation: false, backgroundColor: 'transparent', textStyle: { color: ink, fontFamily: font },
        aria: { enabled: true, label: { description } },
        grid: { left: 8, right: 18, top: 35, bottom: 14, containLabel: true },
        tooltip: { trigger: 'axis', renderMode: 'richText', confine: true,
          formatter: (items) => {
            if (!items.length) return '';
            return `${items[0].axisValue}${coverage ? ` · ${coverage[items[0].dataIndex]}` : ''}\n${items.map((item) => {
              const value = item.value && typeof item.value === 'object' ? item.value.value : item.value;
              const numeric = typeof value === 'number' ? value : null;
              return `${item.seriesName}: ${item.seriesName.startsWith('Netto') ? signed(numeric) : data.number(numeric, unit === '%' ? 1 : 2)} ${unit}`;
            }).join('\n')}`;
          } },
        xAxis: { type: 'category', data: categories,
          // Always show annual labels, especially the final partial-year label
          // and years with gaps. Monthly labels can thin out on narrow screens.
          axisLabel: { color: ink, hideOverlap: categories.length > 20, ...(categories.length <= 20 ? { interval: 0, fontSize: 10 } : {}) },
          axisLine: { lineStyle: { color: line } }, axisTick: { show: false } },
        yAxis: { type: 'value', name: unit, nameTextStyle: { color: ink }, axisLabel: { color: ink }, splitLine: { lineStyle: { color: line } } } };
    }
    const coverage = summary.energy.map((row) => row.method === 'source_annual_aggregate' ? 'SMARD-Jahreswerte · Lücken in Tageshistorie bleiben bestehen' : `${row.complete_days}/${row.days} Erzeugungstage${row.complete_days < row.days ? ' · Jahreswert fehlt' : ''}`);
    const zero = { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: ink, type: 'solid', width: 1 }, data: [{ yAxis: 0 }] };
    const netName = 'Nettoexport (+) / Nettoimport (−)';
    const tradeColors = [muted, accent, ink];
    const tradeFields = ['imports_twh', 'exports_twh', 'net_exports_twh'];
    const tradeNames = ['Import', 'Export', netName];
    const shares = [
      ['renewable_share', 'Erneuerbare', accent, 'solid'],
      ['coal_share', 'Kohle (Braun- + Steinkohle)', muted, 'dashed'],
      ['gas_share', 'Erdgas', history.SOURCES.find((source) => source.key === 'gas').color, 'dotted'],
    ];
    const years = summary.trade.years;
    const months = summary.trade.months;
    return {
      shares: { ...base('%', labels, summary.notes.energy, coverage), series: shares.map(([key, name, color, type]) => ({ name, type: 'line', connectNulls: false, symbolSize: 7, lineStyle: { type, width: 3 }, itemStyle: { color }, data: summary.energy.map((row) => row[key]) })) },
      mix: {
        ...base('TWh', labels, summary.notes.energy, coverage),
        grid: { left: 8, right: 18, top: 35, bottom: 65, containLabel: true },
        legend: { type: 'scroll', bottom: 0, left: 0, right: 0, selectedMode: 'multiple',
          data: history.SOURCES.map((source) => source.label),
          textStyle: { color: ink }, pageTextStyle: { color: ink }, pageIconColor: ink,
          inactiveColor: line, icon: 'rect' },
        tooltip: { trigger: 'item', renderMode: 'richText', confine: true,
          formatter: (item) => `${item.name} · ${coverage[item.dataIndex]}\n${item.seriesName}: ${data.number(item.value, 2)} TWh` },
        // ECharts stacks from bottom to top; reverse series so the legend reads
        // left-to-right in the same order as the visible stack from top to bottom.
        series: [...history.SOURCES].reverse().map((source) => ({ name: source.label, type: 'bar', stack: 'generation',
          itemStyle: { color: source.color },
          emphasis: { focus: 'series', blurScope: 'coordinateSystem', itemStyle: { borderColor: ink, borderWidth: 2 } },
          blur: { itemStyle: { opacity: 0.2 } },
          data: summary.energy.map((row) => row.mix_twh[source.key]) })),
      },
      'trade-years': { ...base('TWh', years.map((row) => row.label.replace(' (', '\n(')), summary.notes.trade, years.map((row) => `${row.complete_months}/${row.months} Monate${row.partial_year ? ' · Teiljahr, keine Hochrechnung' : ''}`)),
        series: [
          ...tradeFields.slice(0, 2).map((key, i) => ({ name: tradeNames[i], type: 'bar', itemStyle: { color: tradeColors[i] }, data: years.map((row) => row.partial_year ? { value: row[key], itemStyle: { opacity: 0.45, borderColor: tradeColors[i], borderWidth: 2, borderType: 'dashed' } } : row[key]) })),
          { name: netName, type: 'line', connectNulls: false, symbolSize: 8, itemStyle: { color: ink }, markLine: zero, data: years.map((row) => row.partial_year ? null : row.net_exports_twh) },
          { name: 'Netto · Teiljahr', type: 'scatter', symbol: 'diamond', symbolSize: 13, itemStyle: { color: ink }, data: years.map((row) => row.partial_year ? row.net_exports_twh : null) },
        ] },
      'trade-months': { ...base('TWh', months.map((row) => row.month), summary.notes.trade), series: tradeFields.map((key, i) => ({ name: tradeNames[i], type: 'line', connectNulls: false, showSymbol: false, lineStyle: { width: i === 2 ? 1 : 2, type: i === 0 ? 'dashed' : 'solid' }, itemStyle: { color: tradeColors[i] }, ...(i === 2 ? { areaStyle: { opacity: 0.12 }, markLine: zero } : {}), data: months.map((row) => row[key]) })) },
    };
  }
  function mount() {
    const root = document.getElementById('electricity-trends');
    const embedded = document.getElementById('electricity-trends-data');
    if (!root || !embedded) return;
    const status = document.getElementById('electricity-trends-status');
    const nodes = [...root.querySelectorAll('[data-trend-chart]')];
    const charts = new Map();
    let summary;
    function failure() { status.textContent = 'Langfristdiagramme konnten nicht dargestellt werden. Alle Langfristwerte stehen im JSON-Download; monatliche Handelswerte bleiben als Tabelle lesbar.'; }
    try { summary = JSON.parse(embedded.textContent); }
    catch (error) { failure(); return; }
    function currentOptions() {
      const style = getComputedStyle(root);
      const token = (name) => style.getPropertyValue(`--electricity-${name}`).trim();
      return options(summary, { ink: token('ink'), line: token('line'), accent: token('accent'), muted: token('muted'), font: style.fontFamily });
    }
    function draw(node) {
      if (charts.has(node)) return;
      let chart;
      try {
        if (!window.echarts) throw new Error('ECharts unavailable');
        chart = window.echarts.init(node);
        chart.setOption(currentOptions()[node.dataset.trendChart], { notMerge: true });
        charts.set(node, chart);
      } catch (error) { if (chart) chart.dispose(); node.hidden = true; failure(); }
    }
    // Reveal empty, sized placeholders only with JS, so IntersectionObserver can
    // observe them. Each chart is initialized once, when it nears the viewport.
    nodes.forEach((node) => { node.hidden = false; });
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        entries.filter((entry) => entry.isIntersecting).forEach(({ target }) => { draw(target); observer.unobserve(target); });
      }, { rootMargin: '200px' });
      nodes.forEach((node) => observer.observe(node));
    } else nodes.forEach(draw);
    const resize = () => charts.forEach((chart) => chart.resize());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(root);
    else window.addEventListener('resize', resize);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const next = currentOptions();
      charts.forEach((chart, node) => {
        const option = next[node.dataset.trendChart];
        if (node.dataset.trendChart === 'mix') {
          const legend = chart.getOption().legend[0];
          option.legend.selected = legend.selected;
          option.legend.scrollDataIndex = legend.scrollDataIndex;
        }
        chart.setOption(option, { notMerge: true });
      });
    });
  }
  return { options, mount };
});
