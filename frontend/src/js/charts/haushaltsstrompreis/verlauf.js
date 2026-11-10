(function() {
  const chartDom = document.getElementById('haushaltsstrom-verlauf');
  if (!chartDom) {
    console.error('Chart container "haushaltsstrom-verlauf" not found');
    return;
  }

  let chart = null;
  let isInitialized = false;
  const hasAuthoredLabel = chartDom.hasAttribute('aria-labelledby') || chartDom.hasAttribute('aria-label');

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
    const xData = ["2008-S1","2008-S2","2009-S1","2009-S2","2010-S1","2010-S2","2011-S1","2011-S2","2012-S1","2012-S2","2013-S1","2013-S2","2014-S1","2014-S2","2015-S1","2015-S2","2016-S1","2016-S2","2017-S1","2017-S2","2018-S1","2018-S2","2019-S1","2019-S2","2020-S1","2020-S2","2021-S1","2021-S2","2022-S1","2022-S2","2023-S1","2023-S2","2024-S1","2024-S2","2025-S1","2025-S2","2026-S1"];
    const seriesData = [{"key":"Gesamt_ct_kWh","name":"Mit Steuern und Abgaben","data":[21.48,21.95,22.82,22.94,23.75,24.38,25.28,25.31,25.95,26.76,29.19,29.21,29.81,29.74,29.51,29.46,29.69,29.77,30.48,30.48,29.87,30,30.88,28.78,30.43,30.06,31.93,32.34,32.79,33.57,41.25,40.2,39.51,39.43,38.35,38.69,36.18],"color":"#5470c6"},{"key":"Ohne_Steuern_ct_kWh","name":"Ohne Steuern und Abgaben","data":[12.99,13.41,14.01,13.59,13.81,13.7,14.06,13.95,14.41,14.32,14.93,14.89,14.35,14.4,14.31,14.27,13.88,13.82,13.89,13.83,13.79,13.78,14.73,13.21,14.3,14.51,15.62,15.96,18.99,23.33,29.73,28.82,28.06,27.97,25.98,26.25,23.88],"color":"#3ba272"}];

    const option = {
      aria: {
        enabled: true,
        // Keep the article's authored accessible name and summary when present.
        label: {
          enabled: !hasAuthoredLabel
        }
      },
      backgroundColor: colors.backgroundColor,
      title: undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDarkMode() ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: colors.axisLineColor,
        textStyle: {
          color: colors.textColor
        }
      },
      legend: {
        data: seriesData.map(s => s.name),
        top: '5%',
        textStyle: {
          color: colors.textColor
        }
      },
      xAxis: {
        type: 'category',
        data: xData,
        name: "Halbjahr (S1 / S2)",
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
        name: "ct/kWh",
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
        type: 'line',
        smooth: false,
        lineStyle: {
          width: 2,
          color: series.color || colors.defaultColors[index % colors.defaultColors.length]
        },
        itemStyle: {
          color: series.color || colors.defaultColors[index % colors.defaultColors.length]
        },
        symbolSize: 6
      })),
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: chartDom.clientWidth < 600 ? "25%" : '18%'
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

    if (!chartDom.hasAttribute('role')) chartDom.setAttribute('role', 'img');
    chart = echarts.init(chartDom);
    updateChart();

    // Listen for theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateChart);
    }

    // Make chart responsive
    window.addEventListener('resize', function() {
      if (chart) chart.resize();
      updateChart();
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