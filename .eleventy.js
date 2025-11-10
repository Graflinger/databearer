const { HtmlBasePlugin } = require("@11ty/eleventy");

module.exports = function (eleventyConfig) {
  // Copy the CSS directory to output
  eleventyConfig.addPassthroughCopy("src/css");

  // Add HTML base plugin to manage base URLs
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Copy the JS directory to output
  eleventyConfig.addPassthroughCopy("src/js");

  // Copy the images directory to output
  eleventyConfig.addPassthroughCopy("src/images");

  // Add a date filter for formatting dates
  eleventyConfig.addFilter("localDate", function (date, locale = "en-US") {
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // Add ISO date string filter for meta tags
  eleventyConfig.addFilter("htmlDateString", function (date) {
    return new Date(date).toISOString();
  });

  // Add global data for helpers
  eleventyConfig.addGlobalData("helpers", {
    year: new Date().getFullYear(),
  });

  // Add global data for site
  eleventyConfig.addGlobalData("site", {
    locale: "de-DE",
    url: "https://databearer.com", // Update this with your actual domain
  });

  // Create topic-specific collections
  eleventyConfig.addCollection("energiePosts", function (collectionApi) {
    return collectionApi.getFilteredByTag("post").filter((post) => {
      return post.data.topic && post.data.topic.includes("energie");
    });
  });

  eleventyConfig.addCollection("politikPosts", function (collectionApi) {
    return collectionApi.getFilteredByTag("post").filter((post) => {
      return (
        post.data.topic && post.data.topic.includes("politik_und_gesellschaft")
      );
    });
  });

  eleventyConfig.addCollection("wirtschaftPosts", function (collectionApi) {
    return collectionApi.getFilteredByTag("post").filter((post) => {
      return post.data.topic && post.data.topic.includes("wirtschaft");
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes",
    },
  };
};
