// Search functionality for the site
(function () {
  let indexPromise;
  let queryVersion = 0;
  let inputTimer;
  let searchInput;
  let searchForm;
  let searchResults;
  let searchStatus;

  // Initialize search when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    searchInput = document.getElementById('search-input');
    searchForm = document.getElementById('search-form');
    searchResults = document.getElementById('search-results');
    searchStatus = document.getElementById('search-status');

    if (!searchInput || !searchForm || !searchResults || !searchStatus) {
      return; // Not on search page
    }

    // Load search index
    indexPromise = loadSearchIndex();

    // Event listeners
    searchInput.addEventListener('input', () => {
      // Invalidate pending work immediately, including during the debounce window.
      queryVersion += 1;
      clearTimeout(inputTimer);
      searchResults.innerHTML = '';
      const hasQuery = searchInput.value.trim().length >= 2;
      setStatus(hasQuery ? 'Suche läuft …' : 'Bitte geben Sie mindestens 2 Zeichen ein.', hasQuery);
      inputTimer = setTimeout(performSearch, 300);
    });
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      clearTimeout(inputTimer);
      performSearch();
    });

    // Check for URL search parameter
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
      searchInput.value = query;
      performSearch();
    }
  }

  async function loadSearchIndex() {
    try {
      const response = await fetch('/search.json');
      if (!response.ok) throw new Error(`Search index HTTP ${response.status}`);
      const index = await response.json();
      if (!Array.isArray(index) || index.some((item) => !item ||
          typeof item.title !== 'string' || typeof item.url !== 'string')) {
        throw new Error('Invalid search index');
      }
      return index;
    } catch (error) {
      console.error('Failed to load search index:', error);
      // Resolve failures too: the current query alone owns the visible status.
      return null;
    }
  }

  function setStatus(message, busy) {
    searchStatus.textContent = message;
    searchResults.setAttribute('aria-busy', String(busy));
  }

  async function performSearch() {
    const version = ++queryVersion;
    const query = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';

    if (query.length < 2) {
      setStatus('Bitte geben Sie mindestens 2 Zeichen ein.', false);
      return;
    }

    setStatus('Suchindex wird geladen …', true);
    const searchIndex = await indexPromise;
    if (version !== queryVersion) return;
    if (!searchIndex) {
      setStatus('Die Suche ist derzeit nicht verfügbar. Bitte laden Sie die Seite erneut oder nutzen Sie die Themenlinks.', false);
      return;
    }

    const results = searchIndex.filter((item) => {
      const titleMatch = item.title?.toLowerCase().includes(query);
      const excerptMatch = typeof item.excerpt === 'string' && item.excerpt.toLowerCase().includes(query);
      const contentMatch = typeof item.content === 'string' && item.content.toLowerCase().includes(query);
      const topics = Array.isArray(item.topic) ? item.topic : [item.topic];
      const topicMatch = topics.some((t) => typeof t === 'string' && t.toLowerCase().includes(query));

      return titleMatch || excerptMatch || contentMatch || topicMatch;
    });

    displayResults(results, query);
  }

  function displayResults(results, query) {
    if (results.length === 0) {
      setStatus('Keine Ergebnisse gefunden.', false);
      searchResults.innerHTML = `
        <div class="no-results">
          <h2>Keine Ergebnisse gefunden</h2>
          <p>Ihre Suche nach "<strong>${escapeHtml(query)}</strong>" ergab keine Treffer.</p>
          <p>Versuchen Sie es mit anderen Suchbegriffen.</p>
        </div>
      `;
      return;
    }

    const countText =
      results.length === 1 ? '1 Ergebnis gefunden' : `${results.length} Ergebnisse gefunden`;
    setStatus(countText, false);

    let html = '<div class="search-results-grid">';

    results.forEach((result) => {
      const title = highlightText(result.title, query);
      const excerpt = result.excerpt
        ? highlightText(result.excerpt, query)
        : highlightText(truncateText(result.content, 200), query);

      const date = formatDate(result.date);

      html += `
        <a href="${escapeHtml(result.url)}" class="blog-card-link">
          <article class="blog-card blog-card-horizontal">
            <div class="blog-card-image-small">
              <img src="${
                escapeHtml(result.image || '/images/blog_card_images/test_img.png')
              }" alt="" loading="lazy">
            </div>
            <div class="blog-card-content">
            <h2>${title}</h2>
              <p>${excerpt}</p>
              ${date ? `<p class="post-date">${date}</p>` : ''}
              
            </div>
          </article>
        </a>
      `;
    });

    html += `</div>`;
    searchResults.innerHTML = html;
  }

  function highlightText(text, query) {
    if (!text) return '';
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.split(regex).map((part, index) => index % 2
      ? `<mark class="search-highlight">${escapeHtml(part)}</mark>` : escapeHtml(part)).join('');
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
})();
