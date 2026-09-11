(function() {
  const chartDom = document.getElementById('battery-storage-segments');
  if (!chartDom) {
    console.error('Chart container "battery-storage-segments" not found');
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
    const xData = [2019,2020,2021,2022,2023,2024,2025];
    const seriesData = [{"key":"Klein_GWh","name":"Klein","data":[0.345740256,0.741205626,1.252523053,1.964712371,5.539988937,5.041172647,4.54440019],"color":null},{"key":"Mittel_GWh","name":"Mittel","data":[0.03211337,0.057221727,0.08070482,0.116734067,0.242438538,0.313053994,0.424486125],"color":null},{"key":"Gross_GWh","name":"Groß","data":[0.081737,0.0904114,0.050847,0.54412872,0.311616752,0.824289801,1.74609785],"color":null}];
    const stacked = true;

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
        name: "Inbetriebnahme-Kohorte",
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
        name: "Speicherkapazität (GWh)",
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