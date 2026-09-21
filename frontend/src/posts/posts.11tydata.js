module.exports = {
  layout: 'post.njk',
  tags: 'post',
  isPost: true,
  eleventyComputed: {
    // Explicit boolean policy. Future dates do not implicitly hide posts.
    permalink: (data) => data.draft === true ? false : data.permalink,
    eleventyExcludeFromCollections: (data) => data.draft === true || data.eleventyExcludeFromCollections,
  },
};
