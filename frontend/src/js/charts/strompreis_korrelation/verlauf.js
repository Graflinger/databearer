(function() {
  const chartDom = document.getElementById('strompreis-gaspreis-verlauf');
  if (!chartDom) {
    console.error('Chart container "strompreis-gaspreis-verlauf" not found');
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
    const xData = ["2019-01","2019-02","2019-03","2019-04","2019-05","2019-06","2019-07","2019-08","2019-09","2019-10","2019-11","2019-12","2020-01","2020-02","2020-03","2020-04","2020-05","2020-06","2020-07","2020-08","2020-09","2020-10","2020-11","2020-12","2021-01","2021-02","2021-03","2021-04","2021-05","2021-06","2021-07","2021-08","2021-09","2021-10","2021-11","2021-12","2022-01","2022-02","2022-03","2022-04","2022-05","2022-06","2022-07","2022-08","2022-09","2022-10","2022-11","2022-12","2023-01","2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12","2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12"];
    const seriesData = [{"key":"Strompreis_EUR_MWh","name":"Strompreis Day-Ahead DE-LU","data":[49.39,42.82,30.63,36.96,37.84,32.52,39.68,36.85,35.75,36.94,41,31.97,35.03,21.92,22.49,17.09,17.6,26.18,30.06,34.86,43.69,33.97,38.79,43.52,52.81,48.7,47.17,53.61,53.35,74.08,81.37,82.7,128.37,139.49,176.15,221.06,167.73,128.8,252.01,165.73,177.48,218.03,315,465.18,346.12,152.6,173.63,251.62,117.83,128.31,102.52,100.74,81.71,94.76,77.61,94.32,100.72,87.38,91.12,68.52,76.57,61.34,64.7,62.36,67.21,72.89,67.7,82.05,78.31,86.1,113.91,108.32,114.14,128.52,94.73,77.94,67.34,63.99,87.79,76.99,83.51,84.4,101.88,93.47],"color":"#5470c6"},{"key":"Gaspreis_EUR_MWh","name":"Gaspreis TTF (Monatsmittel)","data":[21.7,18.07,15.64,14.94,13.24,10.85,11.01,11.29,13.05,15.62,15.9,14.18,11.16,9.11,8.39,6.66,4.95,5.31,5.36,8.25,11.43,14.17,13.95,16.43,20.38,17.37,17.58,20.37,25.03,29.17,36.11,44.72,66.21,91.32,82.57,114.8,85.22,81.92,131.27,101.56,94.09,108.38,172.07,235.96,203.62,135.5,119.48,116.14,63.94,52.67,44.01,42.06,31.74,32.58,29.47,35,36.89,47.07,45.74,36.02,29.91,25.76,26.83,28.91,31.94,34.47,32.57,38.33,36.19,40.43,44.71,45.13,48.31,50.27,41.8,35.27,35.28,36.65,33.96,32.71,32.34,31.95,30.76,27.63],"color":"#e6a23c"}];

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
        name: "EUR/MWh",
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
        top: '18%'
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