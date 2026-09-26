(function() {
  const chartDom = document.getElementById('strompreis-streuung-gas');
  if (!chartDom) {
    console.error('Chart container "strompreis-streuung-gas" not found');
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
    const seriesData = [{"name":"2019–2020","data":[[21.7,49.39,"2019-01"],[18.07,42.82,"2019-02"],[15.64,30.63,"2019-03"],[14.94,36.96,"2019-04"],[13.24,37.84,"2019-05"],[10.85,32.52,"2019-06"],[11.01,39.68,"2019-07"],[11.29,36.85,"2019-08"],[13.05,35.75,"2019-09"],[15.62,36.94,"2019-10"],[15.9,41,"2019-11"],[14.18,31.97,"2019-12"],[11.16,35.03,"2020-01"],[9.11,21.92,"2020-02"],[8.39,22.49,"2020-03"],[6.66,17.09,"2020-04"],[4.95,17.6,"2020-05"],[5.31,26.18,"2020-06"],[5.36,30.06,"2020-07"],[8.25,34.86,"2020-08"],[11.43,43.69,"2020-09"],[14.17,33.97,"2020-10"],[13.95,38.79,"2020-11"],[16.43,43.52,"2020-12"]],"trend":[[4.95,23.291752],[21.7,48.490624]],"color":"#3ba272"},{"name":"2021–2022","data":[[20.38,52.81,"2021-01"],[17.37,48.7,"2021-02"],[17.58,47.17,"2021-03"],[20.37,53.61,"2021-04"],[25.03,53.35,"2021-05"],[29.17,74.08,"2021-06"],[36.11,81.37,"2021-07"],[44.72,82.7,"2021-08"],[66.21,128.37,"2021-09"],[91.32,139.49,"2021-10"],[82.57,176.15,"2021-11"],[114.8,221.06,"2021-12"],[85.22,167.73,"2022-01"],[81.92,128.8,"2022-02"],[131.27,252.01,"2022-03"],[101.56,165.73,"2022-04"],[94.09,177.48,"2022-05"],[108.38,218.03,"2022-06"],[172.07,315,"2022-07"],[235.96,465.18,"2022-08"],[203.62,346.12,"2022-09"],[135.5,152.6,"2022-10"],[119.48,173.63,"2022-11"],[116.14,251.62,"2022-12"]],"trend":[[17.37,41.57423],[235.96,416.615813]],"color":"#d9534f"},{"name":"2023–2025","data":[[63.94,117.83,"2023-01"],[52.67,128.31,"2023-02"],[44.01,102.52,"2023-03"],[42.06,100.74,"2023-04"],[31.74,81.71,"2023-05"],[32.58,94.76,"2023-06"],[29.47,77.61,"2023-07"],[35,94.32,"2023-08"],[36.89,100.72,"2023-09"],[47.07,87.38,"2023-10"],[45.74,91.12,"2023-11"],[36.02,68.52,"2023-12"],[29.91,76.57,"2024-01"],[25.76,61.34,"2024-02"],[26.83,64.7,"2024-03"],[28.91,62.36,"2024-04"],[31.94,67.21,"2024-05"],[34.47,72.89,"2024-06"],[32.57,67.7,"2024-07"],[38.33,82.05,"2024-08"],[36.19,78.31,"2024-09"],[40.43,86.1,"2024-10"],[44.71,113.91,"2024-11"],[45.13,108.32,"2024-12"],[48.31,114.14,"2025-01"],[50.27,128.52,"2025-02"],[41.8,94.73,"2025-03"],[35.27,77.94,"2025-04"],[35.28,67.34,"2025-05"],[36.65,63.99,"2025-06"],[33.96,87.79,"2025-07"],[32.71,76.99,"2025-08"],[32.34,83.51,"2025-09"],[31.95,84.4,"2025-10"],[30.76,101.88,"2025-11"],[27.63,93.47,"2025-12"]],"trend":[[25.76,68.233475],[63.94,132.053353]],"color":"#5470c6"}];
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
      title: undefined,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDarkMode() ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: colors.axisLineColor,
        textStyle: { color: colors.textColor },
        formatter: (params) => {
          const [x, y, label] = params.value;
          const head = label ? label + ' (' + params.seriesName + ')' : params.seriesName;
          return head + '<br>' + "Gaspreis (EUR/MWh)" + ': ' + format(x, 1) + " EUR/MWh"
            + '<br>' + "Strompreis (EUR/MWh)" + ': ' + format(y, 1) + " EUR/MWh";
        }
      },
      legend: {
        data: seriesData.map((series) => series.name),
        top: '2%',
        textStyle: { color: colors.textColor }
      },
      xAxis: axis("Gaspreis (EUR/MWh)", 30),
      yAxis: axis("Strompreis (EUR/MWh)", 45),
      series: points.concat(trends),
      grid: { left: 70, right: 24, bottom: 55, top: 45 },
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