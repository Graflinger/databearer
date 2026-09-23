const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const { createCascade, compileSiteCss, contrastRatio } = require('./helpers/css-cascade');

const markdown = new MarkdownIt({ html: true });
const postsRoot = path.join(__dirname, '../src/posts');
const read = (post) => fs.readFileSync(path.join(postsRoot, post), 'utf8');
const body = (source) => source.replace(/^---\n[\s\S]*?\n---\n/, '');
const allPosts = fs.readdirSync(postsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  .flatMap((year) => fs.readdirSync(path.join(postsRoot, year.name)).filter((name) => name.endsWith('.md'))
    .map((name) => `${year.name}/${name}`));

// Render a post body the way post.njk nests it.
function renderPost(post) {
  document.body.innerHTML = `<main class="site-main"><div class="container"><article class="post-content">${
    markdown.render(body(read(post)))}</article></div></main>`;
}

describe('scrollable article tables', () => {
  test.each([
    ['2026/Windenergiezukunft.md', 1],
    ['2026/Windkraftausschreibungen-2026.md', 1],
    ['2025/Industriepolitik.md', 4],
    ['2026/batteriespeicher-wandel.md', 2],
  ])('%s: wrappers are named, keyboard-focusable .table-scroll regions', (post, count) => {
    renderPost(post);
    const wrappers = [...document.querySelectorAll('.table-scroll')];
    expect(wrappers).toHaveLength(count);
    for (const wrapper of wrappers) {
      expect(wrapper.tagName).toBe('DIV');
      expect(wrapper.hasAttribute('style')).toBe(false);
      expect(wrapper.querySelector(':scope > table > caption')).not.toBeNull();
      expect(wrapper.getAttribute('role')).toBe('region');
      expect(wrapper.getAttribute('tabindex')).toBe('0');
      const labelledBy = wrapper.getAttribute('aria-labelledby');
      const name = labelledBy ? document.getElementById(labelledBy)?.textContent : wrapper.getAttribute('aria-label');
      expect(name?.trim()).toBeTruthy();
      wrapper.focus();
      expect(document.activeElement).toBe(wrapper);
    }
  });

  test.each(allPosts)('%s: no inline overflow wrappers remain', (post) => {
    expect(body(read(post))).not.toMatch(/style="[^"]*overflow/i);
  });
});

describe('article table styles', () => {
  const cascade = createCascade(compileSiteCss());
  const style = (element, property, theme = 'light', width = 1280) => cascade.computed(element, property, { theme, width });

  beforeEach(() => renderPost('2025/Industriepolitik.md'));

  test.each(['light', 'dark'])('numeric evidence tables align, separate and label their data (%s)', (theme) => {
    const table = document.getElementById('industriepolitik_electrification_rate-table');
    expect(style(table, 'border-collapse', theme)).toBe('collapse');
    const caption = table.querySelector('caption');
    expect(style(caption, 'text-align', theme)).toBe('left');
    expect(style(caption, 'caption-side', theme)).toBe('top');
    for (const cell of table.querySelectorAll('td')) {
      expect(style(cell, 'text-align', theme)).toBe('right');
      expect(style(cell, 'font-variant-numeric', theme)).toBe('tabular-nums');
      expect(style(cell, 'border-bottom-style', theme)).toBe('solid');
    }
    for (const header of table.querySelectorAll('th[scope="row"]')) {
      expect(style(header, 'text-align', theme)).toBe('left');
      expect(style(header, 'white-space', theme)).toBe('nowrap');
    }
    const [first, ...numericHeaders] = table.querySelectorAll('thead th');
    expect(style(first, 'text-align', theme)).toBe('left');
    for (const header of numericHeaders) expect(style(header, 'text-align', theme)).toBe('right');
    // The header row is set off from the chart section behind the table.
    const head = cascade.color(first, 'background-color', { theme });
    const section = cascade.background(table.closest('.chart-section'), { theme });
    expect(head).not.toEqual(section);
    expect(cascade.contrast(first, { theme })).toBeGreaterThanOrEqual(4.5);
    expect(cascade.contrast(caption, { theme })).toBeGreaterThanOrEqual(4.5);
    expect(cascade.contrast(table.querySelector('td'), { theme })).toBeGreaterThanOrEqual(4.5);
    // Rules are subtle but visible against the dark and light surfaces alike.
    const line = cascade.color(table.querySelector('td'), 'border-bottom-color', { theme });
    expect(contrastRatio(line, section)).toBeGreaterThan(1.1);
  });

  test('the scroll wrapper scrolls horizontally and shows keyboard focus', () => {
    const wrapper = document.querySelector('.table-scroll');
    expect(style(wrapper, 'overflow-x', 'light', 375)).toBe('auto');
    wrapper.setAttribute('data-focus-visible', '');
    expect(style(wrapper, 'outline-style')).toBe('solid');
    expect(style(wrapper, 'outline-width')).toBe('2px');
    expect(style(wrapper.querySelector('table'), 'margin-bottom')).toBe('0');
  });

  test('Markdown text tables without row headers stay left-aligned', () => {
    document.body.innerHTML = `<article class="post-content">${markdown.render(
      '| Anschrift | |\n| --- | --- |\n| Name | Databearer |\n| Adresse | Europaring 90 |\n')}</article>`;
    for (const cell of document.querySelectorAll('th, td')) expect(style(cell, 'text-align')).toBe('left');
  });
});
