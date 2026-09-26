(function() {
  const chartDom = document.getElementById('strompreis-streuung-erneuerbare');
  if (!chartDom) {
    console.error('Chart container "strompreis-streuung-erneuerbare" not found');
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
    const seriesData = [{"name":"2019–2020","data":[[38.86,49.39,"2019-01"],[38.38,42.82,"2019-02"],[50.57,30.63,"2019-03"],[44.36,36.96,"2019-04"],[45.53,37.84,"2019-05"],[47.99,32.52,"2019-06"],[42.51,39.68,"2019-07"],[41.16,36.85,"2019-08"],[43.6,35.75,"2019-09"],[41.34,36.94,"2019-10"],[34.8,41,"2019-11"],[46.22,31.97,"2019-12"],[44.61,35.03,"2020-01"],[58.04,21.92,"2020-02"],[52.18,22.49,"2020-03"],[54.9,17.09,"2020-04"],[53.05,17.6,"2020-05"],[47.06,26.18,"2020-06"],[47.34,30.06,"2020-07"],[42.12,34.86,"2020-08"],[38.91,43.69,"2020-09"],[45.46,33.97,"2020-10"],[37.77,38.79,"2020-11"],[36.88,43.52,"2020-12"]],"trend":[[34.8,46.49495],[58.04,17.417776]],"color":"#3ba272"},{"name":"2021–2022","data":[[35.17,52.81,"2021-01"],[41.49,48.7,"2021-02"],[44.13,47.17,"2021-03"],[45.56,53.61,"2021-04"],[52.9,53.35,"2021-05"],[41.97,74.08,"2021-06"],[43.55,81.37,"2021-07"],[47.02,82.7,"2021-08"],[36.46,128.37,"2021-09"],[45.7,139.49,"2021-10"],[34.36,176.15,"2021-11"],[37.31,221.06,"2021-12"],[44.43,167.73,"2022-01"],[57.09,128.8,"2022-02"],[39.78,252.01,"2022-03"],[50.45,165.73,"2022-04"],[52.69,177.48,"2022-05"],[48.89,218.03,"2022-06"],[46.41,315,"2022-07"],[42.39,465.18,"2022-08"],[44.16,346.12,"2022-09"],[49.41,152.6,"2022-10"],[44.8,173.63,"2022-11"],[39.68,251.62,"2022-12"]],"trend":[[34.36,181.078909],[57.09,145.912838]],"color":"#d9534f"},{"name":"2023–2025","data":[[50.97,117.83,"2023-01"],[44.14,128.31,"2023-02"],[52.16,102.52,"2023-03"],[54.88,100.74,"2023-04"],[62.69,81.71,"2023-05"],[59.56,94.76,"2023-06"],[65.16,77.61,"2023-07"],[56.59,94.32,"2023-08"],[54.2,100.72,"2023-09"],[57.69,87.38,"2023-10"],[55.11,91.12,"2023-11"],[56.95,68.52,"2023-12"],[55.17,76.57,"2024-01"],[59.57,61.34,"2024-02"],[56.96,64.7,"2024-03"],[64.87,62.36,"2024-04"],[64.01,67.21,"2024-05"],[63.31,72.89,"2024-06"],[63.37,67.7,"2024-07"],[60.76,82.05,"2024-08"],[62.43,78.31,"2024-09"],[54.33,86.1,"2024-10"],[47.37,113.91,"2024-11"],[54.09,108.32,"2024-12"],[51.81,114.14,"2025-01"],[44.33,128.52,"2025-02"],[51.63,94.73,"2025-03"],[59.52,77.94,"2025-04"],[69.89,67.34,"2025-05"],[73.3,63.99,"2025-06"],[62.88,87.79,"2025-07"],[66.36,76.99,"2025-08"],[65.62,83.51,"2025-09"],[61.62,84.4,"2025-10"],[49.75,101.88,"2025-11"],[55.07,93.47,"2025-12"]],"trend":[[44.14,118.915306],[73.3,53.52026]],"color":"#5470c6"}];
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
          return head + '<br>' + "Erneuerbarenanteil (%)" + ': ' + format(x, 1) + " %"
            + '<br>' + "Strompreis (EUR/MWh)" + ': ' + format(y, 1) + " EUR/MWh";
        }
      },
      legend: {
        data: seriesData.map((series) => series.name),
        top: '2%',
        textStyle: { color: colors.textColor }
      },
      xAxis: axis("Erneuerbarenanteil (%)", 30),
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