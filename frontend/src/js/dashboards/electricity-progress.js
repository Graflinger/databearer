/* Fixed progress panels; only the monthly metric has local state. No requests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./electricity-data'));
  else factory(root.ElectricityData).mount();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
  'use strict';
  function options(snapshot, colors, metric = 'energy') {
    const { ink, line, accent, muted, font } = colors;
    function chart(rows, period, unit, series, description) {
      return { animation: false, backgroundColor: 'transparent', textStyle: { color: ink, fontFamily: font },
        aria: { enabled: true, label: { description } },
        grid: { left: 8, right: 12, top: 35, bottom: 12, containLabel: true },
        tooltip: { trigger: 'axis', renderMode: 'richText', confine: true,
          formatter: (items) => items.length ? `${items[0].axisValue}\n${items.map((item) => `${item.seriesName}: ${data.number(item.value, unit === 'GW' ? 3 : 2)} ${unit}`).join('\n')}` : '' },
        xAxis: { type: 'category', data: rows.map((row) => String(row[period])), axisLabel: { color: ink, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: line } } },
        yAxis: { type: 'value', min: 0, name: unit, nameTextStyle: { color: ink }, axisLabel: { color: ink }, splitLine: { lineStyle: { color: line } } },
        series: series.map(([key, name], i) => ({ name, type: period === 'year' && unit !== 'GW' ? 'bar' : 'line',
          showSymbol: period === 'year', symbol: ['circle', 'rect', 'triangle'][i], symbolSize: 6,
          lineStyle: { width: 2.5, type: ['solid', 'dashed', 'dotted'][i] }, itemStyle: { color: [accent, ink, muted][i] },
          data: rows.map((row) => row[key]) })) };
    }
    const energy = metric !== 'cost';
    return {
      capacity: chart(snapshot.capacity.rows, 'year', 'GW', [['solar_gw', 'Solar'], ['wind_onshore_gw', 'Wind an Land'], ['wind_offshore_gw', 'Wind auf See']], 'Gemeldete Kraftwerksliste – Nettonennleistung in GW. Vorläufige Jahresendwerte, einschließlich ausländischer Anlagen.'),
      storage: chart(snapshot.capacity.rows, 'year', 'GW', [['battery_gw', 'Batteriespeicher'], ['pumped_storage_gw', 'Pumpspeicher']], 'Erfasste Speicherleistung in GW. Ohne Kleinspeicher unter 13,2 kW, einschließlich ausländischer Anlagen. Keine Energie oder Speicherdauer.'),
      'annual-energy': chart(snapshot.congestion.annual, 'year', 'GWh', [['energy_gwh', 'Maßnahmenenergie insgesamt']], 'Jährliche Maßnahmenenergie in GWh, Hoch- und Herunterregeln; kein Erzeugungsverlust. Methodikwechsel 2021/2022.'),
      'annual-cost': chart(snapshot.congestion.annual, 'year', 'Mio. €', [['cost_million_eur', 'Kosten insgesamt']], 'Jährliche nominale Kosten in Millionen Euro, teils saldiert. Methodikwechsel 2021/2022.'),
      monthly: chart(snapshot.congestion.monthly, 'month', energy ? 'GWh' : 'Mio. €', [
        [energy ? 'energy_gwh' : 'cost_million_eur', 'Netzengpassmanagement insgesamt'],
        [energy ? 'redispatch_energy_gwh' : 'redispatch_cost_million_eur', 'Davon Redispatch mit Marktkraftwerken'],
      ], `Monatliche ${energy ? 'Maßnahmenenergie in GWh' : 'nominale Kosten in Millionen Euro'}: insgesamt und Redispatch mit Marktkraftwerken, ohne Netzreservekosten in der Teilreihe.`),
    };
  }
  function mount() {
    const root = document.getElementById('electricity-progress');
    const embedded = document.getElementById('electricity-progress-data');
    if (!root || !embedded) return;
    const status = document.getElementById('electricity-progress-status');
    const nodes = [...root.querySelectorAll('[data-progress-chart]')];
    const buttons = [...root.querySelectorAll('[data-progress-metric]')];
    const charts = new Map();
    let snapshot, metric = 'energy';
    const failure = () => { status.textContent = 'Diagramme konnten nicht dargestellt werden. Die letzten Werte und Ziele bleiben lesbar; alle Reihen stehen im JSON-Download.'; };
    try { snapshot = JSON.parse(embedded.textContent); }
    catch (error) { failure(); return; }
    if (!window.echarts) { failure(); return; }
    function currentOptions() {
      const style = getComputedStyle(root);
      const token = (name) => style.getPropertyValue(`--electricity-${name}`).trim();
      return options(snapshot, { ink: token('ink'), line: token('line'), accent: token('accent'), muted: token('muted'), font: style.fontFamily }, metric);
    }
    function disable(node) {
      const chart = charts.get(node);
      if (chart) chart.dispose();
      charts.delete(node);
      node.hidden = true;
      if (node.dataset.progressChart === 'monthly') buttons.forEach((button) => { button.disabled = true; });
      failure();
    }
    function draw(node) {
      if (charts.has(node) || node.hidden) return;
      try {
        const chart = window.echarts.init(node);
        charts.set(node, chart);
        chart.setOption(currentOptions()[node.dataset.progressChart], { notMerge: true });
        if (node.dataset.progressChart === 'monthly') buttons.forEach((button) => { button.disabled = false; });
      } catch (error) { disable(node); }
    }
    nodes.forEach((node) => { node.hidden = false; });
    // A zero margin initializes only intersecting charts, not the entire section.
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        entries.filter((entry) => entry.isIntersecting).forEach(({ target }) => { draw(target); observer.unobserve(target); });
      }, { rootMargin: '0px' });
      nodes.forEach((node) => observer.observe(node));
    } else {
      const visible = () => nodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) draw(node);
      });
      window.addEventListener('scroll', visible, { passive: true });
      window.addEventListener('resize', visible);
      visible();
    }
    buttons.forEach((button) => button.addEventListener('click', () => {
      const node = nodes.find((item) => item.dataset.progressChart === 'monthly');
      if (!charts.has(node)) return;
      metric = button.dataset.progressMetric;
      try {
        charts.get(node).setOption(currentOptions().monthly, { notMerge: true });
        node.setAttribute('aria-label', `Monatliche ${metric === 'cost' ? 'Kosten in Mio. €' : 'Maßnahmenenergie in GWh'}: insgesamt und Redispatch mit Marktkraftwerken`);
        buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      } catch (error) { disable(node); }
    }));
    const resize = () => charts.forEach((chart, node) => { try { chart.resize(); } catch (error) { disable(node); } });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(root);
    else window.addEventListener('resize', resize);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const next = currentOptions();
      charts.forEach((chart, node) => { try { chart.setOption(next[node.dataset.progressChart], { notMerge: true }); } catch (error) { disable(node); } });
    });
  }
  return { options, mount };
});
