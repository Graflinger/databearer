(function() {
  const chartDom = document.getElementById('industriepolitik_electrification_rate');
  if (!chartDom) {
    console.error('Chart container "industriepolitik_electrification_rate" not found');
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
    const xData = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];
    const seriesData = [{"key":"European Union (27)","name":"EU","data":[18.785057,19.128424,19.460196,19.643227,20.054985,20.06046,19.939405,19.684896,19.780638,19.944767,21.015223,20.73862,20.728165,21.215576,""],"color":null},{"key":"China","name":"China","data":[15.285041,15.822168,16.24124,17.097458,17.944887,17.90304,18.954338,19.742897,20.54269,20.672407,20.851488,21.783802,22.407356,22.687473,23.546158],"color":null},{"key":"United States","name":"USA","data":[17.355753,17.493196,17.741415,17.342222,17.333252,17.462751,17.575586,17.440084,17.392159,17.37423,18.433102,17.88257,18.122622,18.208447,18.645765],"color":null},{"key":"Norway","name":"Norwegen","data":[42.7128,43.49991,47.06009,44.676487,46.03272,45.837326,47.141514,46.591755,46.193897,44.44601,49.595215,49.601982,48.016068,49.599567,50.600704],"color":null},{"key":"Germany","name":"Deutschland","data":[18.294329,18.34491,18.610584,18.369253,19.008898,19.416786,19.062948,18.703709,18.96566,18.656755,19.119055,18.759167,19.146555,18.472597,17.629148],"color":null}];

    const option = {
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
        name: "Jahre",
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
        name: "Elektrifizierungsrate in %",
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
        smooth: true,
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