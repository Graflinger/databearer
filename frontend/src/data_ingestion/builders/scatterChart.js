/**
 * Scatter Chart Builder for Apache ECharts
 *
 * Plots one point per data row, optionally grouped into one colored series per
 * group value (e.g. a period), with an optional least-squares trend line per group.
 *
 * @param {Array} data - Array of row objects
 * @param {Object} options - Configuration options
 * @param {string} options.containerId - DOM element ID for the chart
 * @param {string} options.xKey - Numeric x value key
 * @param {string} options.yKey - Numeric y value key
 * @param {string} [options.labelKey] - Point label shown in the tooltip (e.g. month)
 * @param {string} [options.groupKey] - Row key that splits points into series
 * @param {Array<string>} [options.groupOrder] - Required order/allowlist of group values
 * @param {string} [options.xAxisLabel] - X-axis name, including the unit
 * @param {string} [options.yAxisLabel] - Y-axis name, including the unit
 * @param {string} [options.xUnit] - Unit appended to x values in the tooltip
 * @param {string} [options.yUnit] - Unit appended to y values in the tooltip
 * @param {number} [options.xDecimals=1] - Tooltip decimals for x
 * @param {number} [options.yDecimals=1] - Tooltip decimals for y
 * @param {boolean} [options.trendLines=false] - Draw an OLS line per group over its x range
 * @param {Array<string>} [options.colors] - Colors per group
 * @param {string} [options.title] - Chart title
 * @returns {string} JavaScript code for the chart
 */
function linearFit(points) {
  const n = points.length;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n;
  const sxx = points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  if (n < 3 || sxx === 0) throw new Error('Trend line needs at least three points with varying x');
  const slope = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) / sxx;
  return { slope, intercept: meanY - slope * meanX };
}

function buildScatterChart(data, options = {}) {
  const {
    containerId,
    title = '',
    xAxisLabel = '',
    yAxisLabel = '',
    xKey,
    yKey,
    labelKey = null,
    groupKey = null,
    groupOrder = null,
    xUnit = '',
    yUnit = '',
    xDecimals = 1,
    yDecimals = 1,
    trendLines = false,
    colors = null,
  } = options;

  if (!containerId) throw new Error('containerId is required');
  if (!xKey || !yKey) throw new Error('xKey and yKey are required');

  const groups = groupKey ? (groupOrder || [...new Set(data.map((row) => row[groupKey]))]) : [yAxisLabel || yKey];
  const seriesData = groups.map((group, index) => {
    const rows = groupKey ? data.filter((row) => row[groupKey] === group) : data;
    if (!rows.length) throw new Error(`Scatter group "${group}" has no rows`);
    const points = rows.map((row) => {
      const x = row[xKey];
      const y = row[yKey];
      if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
        throw new Error(`Scatter values must be finite numbers (${labelKey ? row[labelKey] : 'row'})`);
      }
      return labelKey ? [x, y, String(row[labelKey])] : [x, y];
    });
    let trend = null;
    if (trendLines) {
      const { slope, intercept } = linearFit(points);
      const xs = points.map(([x]) => x);
      const round = (value) => Number(value.toFixed(6));
      trend = [Math.min(...xs), Math.max(...xs)].map((x) => [round(x), round(intercept + slope * x)]);
    }
    return { name: String(group), data: points, trend, color: colors && colors[index] ? colors[index] : null };
  });
  if (groupKey) {
    const unknown = data.filter((row) => !groups.includes(row[groupKey]));
    if (unknown.length) throw new Error(`Scatter rows outside groupOrder: ${unknown.length}`);
  }

  return `
(function() {
  const chartDom = document.getElementById('${containerId}');
  if (!chartDom) {
    console.error('Chart container "${containerId}" not found');
    return;
  }

  let chart = null;
  let isInitialized = false;
  const hasAuthoredLabel = chartDom.hasAttribute('aria-labelledby') || chartDom.hasAttribute('aria-label');

  const isDarkMode = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const getThemeColors = () => {
    const dark = isDarkMode();
    return {
      textColor: dark ? '#e0e0e0' : '#333333',
      defaultColors: dark
        ? ['#73c0de', '#fac858', '#ee6666', '#91cc75', '#9a60b4', '#ea7ccc']
        : ['#5470c6', '#e6a23c', '#d9534f', '#3ba272', '#73c0de', '#9a60b4'],
      axisLineColor: dark ? '#6e7079' : '#cccccc',
      splitLineColor: dark ? '#3a3a3a' : '#e0e0e0'
    };
  };

  const format = (value, decimals) => Number(value).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const updateChart = () => {
    if (!chart) return;

    const colors = getThemeColors();
    const seriesData = ${JSON.stringify(seriesData)};
    const colorOf = (series, index) => series.color || colors.defaultColors[index % colors.defaultColors.length];
    const axis = (name, gap) => ({
      type: 'value',
      scale: true,
      name: name,
      nameLocation: 'middle',
      nameGap: gap,
      nameTextStyle: { color: colors.textColor },
      axisLine: { lineStyle: { color: colors.axisLineColor } },
      axisLabel: { color: colors.textColor, formatter: (value) => format(value, 0) },
      splitLine: { lineStyle: { color: colors.splitLineColor } }
    });

    const points = seriesData.map((series, index) => ({
      name: series.name,
      type: 'scatter',
      data: series.data,
      symbolSize: 8,
      itemStyle: { color: colorOf(series, index), opacity: 0.8 }
    }));
    const trends = seriesData.filter((series) => series.trend).map((series) => ({
      name: series.name,
      type: 'line',
      data: series.trend,
      showSymbol: false,
      silent: true,
      tooltip: { show: false },
      lineStyle: { width: 2, type: 'dashed', color: colorOf(series, seriesData.indexOf(series)) }
    }));

    const option = {
      aria: {
        enabled: true,
        label: { enabled: !hasAuthoredLabel }
      },
      backgroundColor: 'transparent',
      title: ${title ? `{ text: ${JSON.stringify(title)}, left: 'center', textStyle: { color: colors.textColor } }` : 'undefined'},
      tooltip: {
        trigger: 'item',
        backgroundColor: isDarkMode() ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: colors.axisLineColor,
        textStyle: { color: colors.textColor },
        formatter: (params) => {
          const [x, y, label] = params.value;
          const head = label ? label + ' (' + params.seriesName + ')' : params.seriesName;
          return head + '<br>' + ${JSON.stringify(xAxisLabel)} + ': ' + format(x, ${Number(xDecimals)}) + ${JSON.stringify(xUnit ? ` ${xUnit}` : '')}
            + '<br>' + ${JSON.stringify(yAxisLabel)} + ': ' + format(y, ${Number(yDecimals)}) + ${JSON.stringify(yUnit ? ` ${yUnit}` : '')};
        }
      },
      legend: {
        data: seriesData.map((series) => series.name),
        top: ${title ? "'10%'" : "'2%'"},
        textStyle: { color: colors.textColor }
      },
      xAxis: axis(${JSON.stringify(xAxisLabel)}, 30),
      yAxis: axis(${JSON.stringify(yAxisLabel)}, 45),
      series: points.concat(trends),
      grid: { left: 70, right: 24, bottom: 55, top: ${title ? 70 : 45} },
      animation: true,
      animationDuration: 800
    };

    chart.setOption(option, true);
  };

  const initChart = () => {
    if (isInitialized) return;
    isInitialized = true;

    if (!chartDom.hasAttribute('role')) chartDom.setAttribute('role', 'img');
    chart = echarts.init(chartDom);
    updateChart();

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateChart);
    }

    window.addEventListener('resize', function() {
      if (chart) chart.resize();
    });
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          initChart();
          observer.unobserve(chartDom);
        }
      });
    }, {
      rootMargin: '50px'
    });

    observer.observe(chartDom);
  } else {
    initChart();
  }
})();
`.trim();
}

module.exports = { buildScatterChart, linearFit };
