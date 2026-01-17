(function() {
  const chartDom = document.getElementById('zuschlagsmenge_in_kw');
  if (!chartDom) {
    console.error('Chart container "zuschlagsmenge_in_kw" not found');
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
    const xData = ["2017-05-01","2017-08-01","2017-11-01","2018-02-01","2018-05-01","2018-08-01","2018-10-01","2019-02-01","2019-05-01","2019-08-01","2019-09-01","2019-10-01","2019-12-01","2020-02-01","2020-03-01","2020-06-01","2020-07-01","2020-09-01","2020-10-01","2020-12-01","2021-02-01","2021-05-01","2021-09-01","2022-02-01","2022-05-01","2022-09-01","2022-12-01","2023-02-01","2023-05-01","2023-08-01","2023-11-01","2024-02-01","2024-05-01","2024-08-01","2024-11-01","2025-02-01","2025-05-01","2025-08-01","2025-11-01"];
    const seriesData = [{"key":"Zuschlagsmenge in kw","name":"Zuschlagsmenge in kw","data":[806660,1012890,1000375,708926,604140,666450,363200,476300,269760,208200,179410,204070,509040,523050,150900,463990,191050,284900,658650,399700,691450,1110390,1493940,1332249,930790,772660,189450,1441150,1535460,1433260,1967215,1795380,2379150,2723535,4098060,4094160,3446780,3447956,3456334],"color":null},{"key":"Gebotsmenge in kw","name":"Gebotsmenge in kw","data":[2136730,2926940,2590845,989306,604140,708600,388350,499390,294960,239250,187810,204070,685840,526550,193800,467590,191050,310450,768950,657100,718800,1161390,1823840,1356449,946890,772660,203050,1501530,1597020,1435560,1981315,1835940,2485410,2960735,6082780,4896120,4971750,5738515,8155380],"color":null}];

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
        name: "Datum",
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
        name: "Menge in kW",
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