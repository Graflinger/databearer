# AGENTS.md

This file provides guidance to coding agents when working with the frontend in this repository.

## Project Overview

Databearer is a German data journalism blog (databearer.de) built with Eleventy (11ty) v3. The site covers topics including energy (Energie), politics & society (Politik & Gesellschaft), and economics (Wirtschaft). Posts feature interactive Apache ECharts visualizations generated from CSV data.

## Commands

```bash
# Development server with hot reload
npm start

# Production build
npm run build

# Deployment: Cloudflare Pages builds this folder (root dir = frontend) and serves blog.databearer.de

# Generate charts only
npm run build:charts

# Generate specific chart config file
node "src/data_ingestion/generate-charts.js" industriepolitik.js
```

## Architecture

### Directory Structure
- `src/` - Source files (Eleventy input)
- `src/_includes/` - Nunjucks layouts (`base.njk` for site shell, `post.njk` for blog posts)
- `src/_data/` - Global data files (`site.js` contains locale, author, metadata)
- `src/posts/{year}/` - Markdown blog posts organized by year
- `src/themen/` - Topic landing pages (energie, wirtschaft, politik-und-gesellschaft)
- `src/data_ingestion/` - Chart generation system (excluded from Eleventy build)
- `_site/` - Build output

### Chart Generation Pipeline
Charts are auto-generated before each Eleventy build via `.eleventy.js` hook:

1. **Data files**: Place CSV in `src/data_ingestion/data/`
2. **Config files**: Create JS config in `src/data_ingestion/charts/` exporting an array of chart configs
3. **Output**: Generated JS files go to `src/js/charts/{config-name}/`

Chart config structure:
```javascript
{
  type: 'line' | 'bar',
  dataFile: 'data.csv',           // relative to data/
  outputFile: 'chart.js',         // output filename
  containerId: 'chart-id',        // DOM element ID
  xKey: 'column_name',
  yKey: 'value',                  // single series
  seriesKeys: ['col1', 'col2'],   // multi-series
  seriesNames: ['Label1', 'Label2']
}
```

### Post Frontmatter
```yaml
title: "Post Title"
date: 2025-01-01
excerpt: "Short description"
image: "/images/blog_card_images/2025/filename.png"
imageText: "Image caption"
topic: ["energie", "wirtschaft"]  # array, determines collections
fullWidthCard: false              # optional
lastUpdated: 2025-01-15           # optional
```

### Collections
Defined in `.eleventy.js`:
- `post` - All posts from `src/posts/**/*.md`
- `energiePosts`, `politikPosts`, `wirtschaftPosts` - Filtered by topic array

### Using Charts in Posts
```html
<script src="/js/lib/echarts.min.js"></script>
<div id="chart-id" style="width: 100%; height: 400px;"></div>
<script src="/js/charts/config-name/chart.js"></script>
```

Charts support dark mode detection and lazy loading via IntersectionObserver.

## Key Files
- `.eleventy.js` - Eleventy config, filters, collections, chart generation hook
- `src/_includes/base.njk` - Site layout with SEO meta, structured data, navigation
- `src/data_ingestion/generate-charts.js` - Chart generation entry point
- `src/data_ingestion/builders/` - Chart builder modules (lineChart.js, barChart.js)
