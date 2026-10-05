/** @jest-environment node */
// Every article image is AI-generated: the visible caption must say so.
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const postsDir = path.resolve(__dirname, '../src/posts');
const posts = fs.readdirSync(postsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((year) => fs.readdirSync(path.join(postsDir, year.name))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `${year.name}/${name}`));
const withImage = posts.filter((post) => matter(fs.readFileSync(path.join(postsDir, post), 'utf8')).data.image);

test('there are posts with images to check', () => {
  expect(withImage.length).toBeGreaterThan(0);
});

test.each(withImage)('%s: caption ends with "(KI-generiert)"', (post) => {
  const { imageText } = matter(fs.readFileSync(path.join(postsDir, post), 'utf8')).data;
  expect(typeof imageText).toBe('string');
  expect(imageText).toMatch(/\S \(KI-generiert\)$/);
  expect(imageText).not.toMatch(/KI-generiertes Symbolbild|\. \(KI-generiert\)$/);
  expect(imageText.match(/KI-generiert/g)).toHaveLength(1);
});
