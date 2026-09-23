// Search index for /suche/. A JavaScript template so every field is serialised
// by JSON.stringify and all text passes through the same sanitizer.
const { published, isoDate } = require('./seo');
const { searchText } = require('../lib/search-text');

const THUMBNAIL_FIELDS = ['src', 'srcset', 'webpSrcset', 'sizes', 'width', 'height'];

// Only local /images/ sources have prepared variants. Layouts (post hero, cards)
// already fail the build on invalid local paths; the index never fetches remote images.
const isLocalImage = (source) => typeof source === 'string' && source.startsWith('/images/');

// Keep only the documented thumbnail contract; anything without a source is no image.
function thumbnailFields(thumbnail) {
  if (!thumbnail || typeof thumbnail.src !== 'string' || !thumbnail.src) return null;
  return Object.fromEntries(THUMBNAIL_FIELDS.filter((key) => thumbnail[key] !== undefined && thumbnail[key] !== null)
    .map((key) => [key, thumbnail[key]]));
}

// Same inclusion rules as the archive: published posts and dashboards with a URL,
// minus noindex pages; newest posts first, dashboards before posts.
function searchItems(collections = {}) {
  const seen = new Set();
  return [...(collections.post || []), ...(collections.dashboard || [])]
    .filter((item) => item.url && published(item) && !item.data.noindex)
    .reverse()
    .filter((item) => !seen.has(item.url) && seen.add(item.url));
}

class SearchIndex {
  data() {
    return {
      permalink: '/search.json',
      excludeFromSitemap: true,
      eleventyExcludeFromCollections: true,
      // Render after the collections whose templateContent is indexed.
      eleventyImport: { collections: ['post', 'dashboard'] },
    };
  }

  async render({ collections }) {
    if (typeof this.imageThumbnail !== 'function') {
      throw new Error('search.11ty.js requires the async imageThumbnail filter (lib/responsive-images.js)');
    }
    const entries = await Promise.all(searchItems(collections).map(async (item) => {
      const { data } = item;
      const image = data.image || data.dashboardImage;
      const topic = data.topic ?? [data.dashboardTopic || ''];
      return {
        title: String(data.title ?? ''),
        url: item.url,
        excerpt: searchText(data.excerpt || data.dashboardSummary || data.description || ''),
        date: (data.date && isoDate(data.date)) || null,
        topic: Array.isArray(topic) ? topic : [topic],
        thumbnail: isLocalImage(image) ? thumbnailFields(await this.imageThumbnail(image)) : null,
        // Dashboards index their summary, not the rendered dashboard tables.
        content: searchText(data.dashboardSummary || item.templateContent || ''),
      };
    }));
    return JSON.stringify(entries);
  }
}

module.exports = SearchIndex;
module.exports.searchItems = searchItems;
module.exports.thumbnailFields = thumbnailFields;
