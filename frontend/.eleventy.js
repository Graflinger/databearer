const { HtmlBasePlugin } = require('@11ty/eleventy');
const { execSync } = require('child_process');
const electricity = require('./src/js/dashboards/electricity-data');
const { validateBuildSnapshot } = require('./src/data_ingestion/builders/electricitySnapshot');
const { verifyPublished } = require('./src/data_ingestion/builders/electricityHistory');
const { verifyPublishedTrends } = require('./src/data_ingestion/builders/electricityTrends');
const { verifyPublishedProgress } = require('./src/data_ingestion/builders/electricityProgress');
const electricityFilters = require('./src/data_ingestion/builders/electricityFilters');
const seo = require('./src/seo');

module.exports = function (eleventyConfig) {
  require('./lib/responsive-images').register(eleventyConfig);
  seo.configure(eleventyConfig);
  // Generate charts before Eleventy build
  eleventyConfig.on('eleventy.before', async () => {
    console.log('🎨 Generating charts...');
    execSync('node "src/data_ingestion/generate-charts.js"', {
      stdio: 'inherit',
    });
  });

  eleventyConfig.addFilter('electricitySummary', (snapshot) => {
    validateBuildSnapshot(snapshot);
    return electricityFilters.summary(snapshot);
  });
  eleventyConfig.addFilter('electricityNumber', electricity.number);
  eleventyConfig.addFilter('electricityStatusJSON', electricityFilters.statusJSON);
  eleventyConfig.addFilter('electricityJSON', (snapshot) => {
    validateBuildSnapshot(snapshot);
    return JSON.stringify(snapshot).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  });

  // Ignore data ingestion folder
  eleventyConfig.ignores.add('src/data_ingestion/**');
  eleventyConfig.addPassthroughCopy({ 'src/data-history/german-electricity': 'data/history/german-electricity' });
  eleventyConfig.addPassthroughCopy('src/_headers');
  eleventyConfig.on('eleventy.after', ({ dir }) => verifyPublished(dir.output));
  eleventyConfig.on('eleventy.after', ({ dir }) => verifyPublishedTrends(dir.output));
  eleventyConfig.on('eleventy.after', ({ dir }) => verifyPublishedProgress(dir.output));

  // Exclude generated charts from watch to prevent rebuild loop
  eleventyConfig.watchIgnores.add('src/js/charts/**');

  // Copy the CSS directory to output
  eleventyConfig.addPassthroughCopy('src/css');

  // Add HTML base plugin to manage base URLs
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Copy the JS directory to output
  eleventyConfig.addPassthroughCopy('src/js');

  // Copy the images directory to output
  eleventyConfig.addPassthroughCopy('src/images');

  // Copy ads.txt to output
  eleventyConfig.addPassthroughCopy('src/ads.txt');

  // Copy ECharts library to output
  eleventyConfig.addPassthroughCopy({
    'node_modules/echarts/dist/echarts.min.js': 'js/lib/echarts.min.js',
  });

  // Add a date filter for formatting dates
  eleventyConfig.addFilter('localDate', function (date, locale = 'en-US') {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  // Add ISO date string filter for meta tags
  eleventyConfig.addFilter('htmlDateString', function (date) {
    return new Date(date).toISOString();
  });

  // Add global data for helpers
  eleventyConfig.addGlobalData('helpers', {
    year: new Date().getFullYear(),
  });

  // Create main post collection from all posts in src/posts
  eleventyConfig.addCollection('post', function (collectionApi) {
    return collectionApi.getFilteredByGlob('src/posts/**/*.md').filter(seo.published);
  });

  // Create topic-specific collections
  eleventyConfig.addCollection('energiePosts', function (collectionApi) {
    return collectionApi.getFilteredByGlob('src/posts/**/*.md').filter((post) => {
      return seo.published(post) && post.data.topic && post.data.topic.includes('energie');
    });
  });

  eleventyConfig.addCollection('politikPosts', function (collectionApi) {
    return collectionApi.getFilteredByGlob('src/posts/**/*.md').filter((post) => {
      return seo.published(post) && post.data.topic && post.data.topic.includes('politik-und-gesellschaft');
    });
  });

  eleventyConfig.addCollection('wirtschaftPosts', function (collectionApi) {
    return collectionApi.getFilteredByGlob('src/posts/**/*.md').filter((post) => {
      return seo.published(post) && post.data.topic && post.data.topic.includes('wirtschaft');
    });
  });

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      layouts: '_includes',
    },
  };
};
