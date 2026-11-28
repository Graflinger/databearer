(function() {
  const chartDom = document.getElementById('energieintensive-produktion');
  if (!chartDom) {
    console.error('Chart container "energieintensive-produktion" not found');
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
    const xData = ["2018-01","2018-02","2018-03","2018-04","2018-05","2018-06","2018-07","2018-08","2018-09","2018-10","2018-11","2018-12","2019-01","2019-02","2019-03","2019-04","2019-05","2019-06","2019-07","2019-08","2019-09","2019-10","2019-11","2019-12","2020-01","2020-02","2020-03","2020-04","2020-05","2020-06","2020-07","2020-08","2020-09","2020-10","2020-11","2020-12","2021-01","2021-02","2021-03","2021-04","2021-05","2021-06","2021-07","2021-08","2021-09","2021-10","2021-11","2021-12","2022-01","2022-02","2022-03","2022-04","2022-05","2022-06","2022-07","2022-08","2022-09","2022-10","2022-11","2022-12","2023-01","2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12","2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"];
    const seriesData = [{"key":"Industrie","name":"Industrie insgesamt","data":[109.6,107.5,109.2,108.7,110.4,110,107.9,108.9,108.1,107.9,106,107,106.7,106.3,107.5,106,106.5,105.4,105,105.3,104.3,103.6,103.9,101.3,104.5,105.3,94.2,73.5,82.2,91.8,94.1,93.6,96.2,100,101.5,101.4,101.9,99.8,101,100.7,99.7,98.2,100.5,94.7,95.1,98.9,99.7,101.2,100.9,100.8,95.4,97.2,98.5,99.6,99.4,98.5,101,100.4,100.8,98.4,100,102.6,99.9,99.2,100.8,99.1,97.9,98.3,97.4,96.7,96,94,94.9,96.5,95.4,95.6,92.3,95,92.6,94.7,92.8,92.8,93.3,91.4,93.9,93,96.2,93.3,93.1,92.8,93.3,90.9,92,92.1,93.7,92.6,91.5,91.7,91.2,91.3,92.2,92.3,90.2,90.7],"color":"#5470c6"},{"key":"Energieintensiv","name":"Energieintensive Zweige","data":[103.1,101.5,100.3,101.4,104.2,103.6,103.1,101.9,101,100,99.8,100.5,100.8,100.7,99.6,98.8,98.5,98.1,98.2,98.6,96.9,98.1,96.8,95.3,98.5,101.9,96.6,86.1,84.8,86.7,90.3,93.1,94.3,97.4,98.4,100.3,99.5,95,99.6,99.3,100.9,98.8,98.3,98.4,99.8,100.8,101.6,103.3,100.9,98.6,97.8,97.8,95.5,96,94.1,91.7,91.9,88.7,88.3,84,86.8,86.9,85,83.3,82.8,83,82.5,83,83.5,81.6,83,79.7,82.4,86.1,85.2,84.5,84.7,86.4,85,84.1,81.7,81.6,83.4,81.8,83.8,82.6,84.5,82.6,81.6,81,81,81.4,81.4,81.5,80.5,80.1,80,81.1,81.9,83.3,83.7,82,80.1,79.7],"color":"#d9534f"}];

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
        name: "Monat",
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
        name: "Index (2021 = 100)",
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
        top: chartDom.clientWidth < 600 ? "23%" : '18%'
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