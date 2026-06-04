(function() {
  const chartDom = document.getElementById('zuschlagsmenge_in_kw_yearly');
  if (!chartDom) {
    console.error('Chart container "zuschlagsmenge_in_kw_yearly" not found');
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
    const xData = [2017,2018,2019,2020,2021,2022,2023,2024,2025];
    const seriesData = [{"key":"Zuschlagsmenge in kw","name":"Zuschlagsmenge in kW","data":[2819925,2342716,1846780,2672240,3295780,3225149,6377085,10996125,14445230],"color":null}];
    const stacked = false;

    const option = {
      backgroundColor: colors.backgroundColor,
      title: undefined,
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
      
      xAxis: {
        type: 'category',
        data: xData,
        name: "Jahr",
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
        name: "Zuschlagsmenge in kW",
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
        top: '10%'
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