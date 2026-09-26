// Drafts are handled for every template by the `drafts` preprocessor in
// .eleventy.js; boolean `draft: true` skips a post before it is rendered.
module.exports = {
  layout: 'post.njk',
  tags: 'post',
  isPost: true,
};
