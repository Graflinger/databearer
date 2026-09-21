/** @jest-environment node */
const path = require('path');
const sass = require('sass');
const { JSDOM } = require('jsdom');

const css = sass.compile(path.resolve(__dirname, '../src/scss/style.scss')).css;
const document = new JSDOM(`<style>${css}</style>`).window.document;
const rules = [...document.styleSheets[0].cssRules];
const darkRules = rules.filter((rule) => rule.conditionText === '(prefers-color-scheme: dark)')
  .flatMap((rule) => [...rule.cssRules]);
const color = (rules, selector, property = 'color') => rules
  .filter((rule) => rule.selectorText?.split(/,\s*/).includes(selector))
  .map((rule) => rule.style.getPropertyValue(property)).filter(Boolean).pop();

test('post paragraphs and nested lists inherit the parent text color in both themes', () => {
  // jsdom does not resolve custom properties or color-scheme media queries;
  // inspect the compiled cascade, including dark overrides, instead.
  expect(color(rules, '.post-content', '--post-text')).toBe('#374151');
  expect(color(rules, '.post-content')).toBe('var(--post-text)');
  expect(color(darkRules, '.post-content', '--post-text')).toBe('#e0e0e0');
  for (const selector of ['.post-content p', '.post-content ul', '.post-content ol', '.post-content li', '.post-content li p']) {
    expect(color(rules, selector)).toBe('inherit');
    expect(color([...rules, ...darkRules], selector)).toBe('inherit');
  }
});

test('post headings retain their separate light and dark colors', () => {
  for (const heading of ['h1', 'h2', 'h3']) {
    expect(color(rules, `.post-content ${heading}`)).toBe('#1a1a1a');
    expect(color(darkRules, `.post-content ${heading}`)).toBe('#e0e0e0');
  }
});

test('article headings allow long compound words to wrap on narrow screens', () => {
  for (const heading of ['h1', 'h2', 'h3']) {
    expect(color(rules, `.post-content ${heading}`, 'overflow-wrap')).toBe('anywhere');
  }
});

test.each(['light', 'dark'])('gold controls keep dark foregrounds across interaction states in %s mode', (theme) => {
  const themeRules = theme === 'dark' ? [...rules, ...darkRules] : rules;
  // The SVG search icon uses currentColor, so it shares the button foreground.
  for (const selector of ['.pagination-link', '#search-button', '.error-404-button.primary']) {
    for (const state of ['', ':hover', ':focus', ':focus-visible', ':active']) {
      const foreground = color(themeRules, selector + state) || color(themeRules, selector);
      const background = color(themeRules, selector + state, 'background-color') || color(themeRules, selector, 'background-color');
      expect(foreground).toBe('#1a1a1a');
      expect(['#c4ad61', '#d9c176']).toContain(background);
    }
  }
  expect(color(themeRules, '.error-404-button.secondary')).toBe('var(--prose-link)');
  expect(color(themeRules, '.error-404-button.secondary:hover')).toBe('#1a1a1a');
  expect(color(themeRules, '.error-404-button.secondary:hover', 'background-color')).toBe('#c4ad61');
});
