const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

const markdown = new MarkdownIt({ html: true });

test.each([
  ['2026/Windenergiezukunft.md', 1],
  ['2026/Windkraftausschreibungen-2026.md', 1],
  ['2025/Industriepolitik.md', 4],
])('%s: scrollable tables are named, keyboard-focusable regions', (post, count) => {
  const source = fs.readFileSync(path.join(__dirname, '../src/posts', post), 'utf8');
  document.body.innerHTML = markdown.render(source.replace(/^---\n[\s\S]*?\n---\n/, ''));
  const wrappers = [...document.querySelectorAll('div[style]')]
    .filter((element) => element.style.overflowX === 'auto');
  expect(wrappers).toHaveLength(count);
  for (const wrapper of wrappers) {
    expect(wrapper.querySelector('table caption')).not.toBeNull();
    expect(wrapper.getAttribute('role')).toBe('region');
    expect(wrapper.getAttribute('tabindex')).toBe('0');
    const label = document.getElementById(wrapper.getAttribute('aria-labelledby'));
    expect(label).not.toBeNull();
    expect(label.textContent.trim()).not.toBe('');
    wrapper.focus();
    expect(document.activeElement).toBe(wrapper);
  }
});
