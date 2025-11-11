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

  // Copy robots.txt to output
  eleventyConfig.addPassthroughCopy("src/robots.txt");

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

  // Filter to get related posts
  eleventyConfig.addFilter("relatedPosts", function (collections, currentPage) {
    const allPosts = collections.post || [];
    const currentTopics = (currentPage && currentPage.data && currentPage.data.topic) || [];
    const currentUrl = (currentPage && currentPage.url) || "";

    // Get posts from the same topic (excluding current post)
    const sameTopic = allPosts.filter((post) => {
      if (post.url === currentUrl) return false;
      const postTopics = post.data.topic || [];
      return postTopics.some((topic) => currentTopics.includes(topic));
    });

    // Sort by date (newest first) and get latest 10
    const latest10SameTopic = sameTopic
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    // Randomly select 3 from the latest 10
    const shuffled = latest10SameTopic.sort(() => 0.5 - Math.random());
    const randomThree = shuffled.slice(0, 3);

    // Get the newest post from all posts (excluding current post and same topic)
    const newestAcrossTopics = allPosts
      .filter(
        (post) =>
          post.url !== currentUrl &&
          !sameTopic.some((samePost) => samePost.url === post.url)
      )
      .sort((a, b) => b.date - a.date)[0];

    // Combine: 3 random from same topic + 1 newest across topics
    const result = [...randomThree];
    if (newestAcrossTopics) {
      result.push(newestAcrossTopics);
    }

    return result;
  });

  // Add global data for helpers
  eleventyConfig.addGlobalData("helpers", {
    year: new Date().getFullYear(),
  });

  // Create main post collection from all posts in src/posts
  eleventyConfig.addCollection("post", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md");
  });

  // Create topic-specific collections
  eleventyConfig.addCollection("energiePosts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").filter((post) => {
      return post.data.topic && post.data.topic.includes("energie");
    });
  });

  eleventyConfig.addCollection("politikPosts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").filter((post) => {
      return (
        post.data.topic && post.data.topic.includes("politik_und_gesellschaft")
      );
    });
  });

  eleventyConfig.addCollection("wirtschaftPosts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").filter((post) => {
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
