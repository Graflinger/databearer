const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const setupSearchDom = async (indexData = []) => {
  document.body.innerHTML = `
    <input id="search-input" />
    <button id="search-button"></button>
    <div id="search-results"></div>
  `;

  global.fetch = jest.fn().mockResolvedValue({
    json: async () => indexData,
  });

  jest.resetModules();
  require('../src/js/search');
  document.dispatchEvent(new Event('DOMContentLoaded'));

  await flushPromises();
};

describe('search', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('shows a minimum length message', async () => {
    await setupSearchDom([]);

    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResults = document.getElementById('search-results');

    searchInput.value = 'a';
    searchButton.click();

    expect(searchResults.innerHTML).toContain('mindestens 2 Zeichen');
  });

  it('highlights matching results', async () => {
    await setupSearchDom([
      {
        title: 'Energiepreise steigen',
        excerpt: 'Kurz',
        content: 'Energiepreise und Nachfrage',
        topic: ['energie'],
        url: '/post',
        date: '2024-01-15',
        image: '/images/test.png',
      },
    ]);

    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResults = document.getElementById('search-results');

    searchInput.value = 'energie';
    searchButton.click();

    expect(searchResults.innerHTML).toContain(
      '<mark class="search-highlight">Energie</mark>preise',
    );
  });

  it('escapes HTML in the no-results view', async () => {
    await setupSearchDom([
      {
        title: 'Datenschutz',
        excerpt: 'Kurz',
        content: 'Sicher',
        topic: ['politik'],
        url: '/privacy',
        date: '2024-02-10',
        image: '/images/test.png',
      },
    ]);

    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResults = document.getElementById('search-results');

    searchInput.value = '<script>';
    searchButton.click();

    expect(searchResults.innerHTML).toContain('&lt;script&gt;');
  });
});
