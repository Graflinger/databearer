/**
 * Bar Chart Builder for Apache ECharts
 *
 * @param {Array} data - Array of objects with x and y properties (or multiple y keys for multi-series)
 * @param {Object} options - Configuration options
 * @param {string} options.containerId - DOM element ID for the chart
 * @param {string} options.title - Chart title (optional)
 * @param {string} options.xAxisLabel - X-axis label (optional)
 * @param {string} options.yAxisLabel - Y-axis label (optional)
 * @param {string} options.xKey - Key for x-axis data (default: 'x')
 * @param {string} options.yKey - Key for y-axis data (default: 'y') - single series only
 * @param {Array<string>} options.seriesKeys - Array of keys for multiple series (e.g., ['sales', 'expenses'])
 * @param {Array<string>} options.seriesNames - Array of display names for series (e.g., ['Sales', 'Expenses'])
 * @param {Array<string>} options.colors - Custom colors for series (optional)
 * @param {string} options.color - Bar color for single series (optional)
 * @param {boolean} options.stacked - Stack bars (default: false)
 * @returns {string} JavaScript code for the chart
 */
function buildBarChart(data, options = {}) {
  const {
    containerId,
    title = '',
    xAxisLabel = '',
    yAxisLabel = '',
    xKey = 'x',
    yKey = 'y',
    seriesKeys = null,
    seriesNames = null,
    colors = null,
    color = null,
    stacked = false,
  } = options;

  if (!containerId) {
    throw new Error('containerId is required');
  }

  const xData = data.map((d) => d[xKey]);

  // Multi-series mode
  const isMultiSeries = seriesKeys && Array.isArray(seriesKeys) && seriesKeys.length > 0;

  let seriesData;
  if (isMultiSeries) {
    seriesData = seriesKeys.map((key, index) => ({
      key,
      name: seriesNames && seriesNames[index] ? seriesNames[index] : key,
      data: data.map((d) => d[key]),
      color: colors && colors[index] ? colors[index] : null,
    }));
  } else {
    const yData = data.map((d) => d[yKey]);
    seriesData = [{ key: yKey, name: yAxisLabel || yKey, data: yData, color: color }];
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

  // Detect dark mode
  const isDarkMode = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Get theme colors
  const getThemeColors = () => {
    const dark = isDarkMode();
    const defaultColors = dark
      ? ['#73c0de', '#91cc75', '#fac858', '#ee6666', '#9a60b4', '#ea7ccc']
      : ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];

    return {
      textColor: dark ? '#e0e0e0' : '#333333',
      backgroundColor: dark ? 'transparent' : 'transparent',
      defaultColors: defaultColors,
      axisLineColor: dark ? '#6e7079' : '#cccccc',
      splitLineColor: dark ? '#3a3a3a' : '#e0e0e0'
    };
  };

  const updateChart = () => {
    if (!chart) return;

    const colors = getThemeColors();
    const xData = ${JSON.stringify(xData)};
    const seriesData = ${JSON.stringify(seriesData)};
    const stacked = ${stacked};

    const option = {
      backgroundColor: colors.backgroundColor,
      title: ${
        title
          ? `{
        text: ${JSON.stringify(title)},
        left: 'center',
        textStyle: {
          color: colors.textColor
        }
      }`
          : 'undefined'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: isDarkMode() ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: colors.axisLineColor,
        textStyle: {
          color: colors.textColor
        }
      },
      ${
        isMultiSeries
          ? `legend: {
        data: seriesData.map(s => s.name),
        top: ${title ? "'12%'" : "'5%'"},
        textStyle: {
          color: colors.textColor
        }
      },`
          : ''
      }
      xAxis: {
        type: 'category',
        data: xData,
        name: ${JSON.stringify(xAxisLabel)},
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          color: colors.textColor
        },
        axisLine: {
          lineStyle: {
            color: colors.axisLineColor
          }
        },
        axisLabel: {
          color: colors.textColor
        },
        splitLine: {
          lineStyle: {
            color: colors.splitLineColor
          }
        }
      },
      yAxis: {
        type: 'value',
        name: ${JSON.stringify(yAxisLabel)},
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          color: colors.textColor
        },
        axisLine: {
          lineStyle: {
            color: colors.axisLineColor
          }
        },
        axisLabel: {
          color: colors.textColor
        },
        splitLine: {
          lineStyle: {
            color: colors.splitLineColor
          }
        }
      },
      series: seriesData.map((series, index) => ({
        name: series.name,
        data: series.data,
        type: 'bar',
        stack: stacked ? 'total' : undefined,
        itemStyle: {
          color: series.color || colors.defaultColors[index % colors.defaultColors.length]
        }
      })),
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: ${isMultiSeries ? (title ? "'25%'" : "'18%'") : title ? "'15%'" : "'10%'"}
      },
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut'
    };

    chart.setOption(option);
  };

  const initChart = () => {
    if (isInitialized) return;
    isInitialized = true;

    chart = echarts.init(chartDom);
    updateChart();

    // Listen for theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateChart);
    }

    // Make chart responsive
    window.addEventListener('resize', function() {
      if (chart) chart.resize();
    });
  };

  // Use Intersection Observer to lazy load chart when visible
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          initChart();
          observer.unobserve(chartDom);
        }
      });
    }, {
      rootMargin: '50px' // Start loading 50px before entering viewport
    });

    observer.observe(chartDom);
  } else {
    // Fallback for browsers without IntersectionObserver
    initChart();
  }
})();
`.trim();
}

module.exports = { buildBarChart };
