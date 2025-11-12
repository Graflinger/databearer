// Search functionality for the site
(function() {
  let searchIndex = [];
  let searchInput;
  let searchButton;
  let searchResults;

  // Initialize search when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    searchInput = document.getElementById('search-input');
    searchButton = document.getElementById('search-button');
    searchResults = document.getElementById('search-results');

    if (!searchInput || !searchButton || !searchResults) {
      return; // Not on search page
    }

    // Load search index
    loadSearchIndex();

    // Event listeners
    searchInput.addEventListener('input', debounce(performSearch, 300));
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
    searchButton.addEventListener('click', performSearch);

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
      searchIndex = await response.json();
    } catch (error) {
      console.error('Failed to load search index:', error);
      searchResults.innerHTML = '<p class="search-info">Fehler beim Laden des Suchindex.</p>';
    }
  }

  function performSearch() {
    const query = searchInput.value.trim().toLowerCase();

    if (query.length < 2) {
      searchResults.innerHTML = '<p class="search-info">Bitte geben Sie mindestens 2 Zeichen ein.</p>';
      return;
    }

    const results = searchIndex.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(query);
      const excerptMatch = item.excerpt?.toLowerCase().includes(query);
      const contentMatch = item.content?.toLowerCase().includes(query);
      const topicMatch = item.topic?.some(t => t.toLowerCase().includes(query));

      return titleMatch || excerptMatch || contentMatch || topicMatch;
    });

    displayResults(results, query);
  }

  function displayResults(results, query) {
    if (results.length === 0) {
      searchResults.innerHTML = `
        <div class="no-results">
          <h2>Keine Ergebnisse gefunden</h2>
          <p>Ihre Suche nach "<strong>${escapeHtml(query)}</strong>" ergab keine Treffer.</p>
          <p>Versuchen Sie es mit anderen Suchbegriffen.</p>
        </div>
      `;
      return;
    }

    const countText = results.length === 1
      ? '1 Ergebnis gefunden'
      : `${results.length} Ergebnisse gefunden`;

    let html = `<p class="search-results-count">${countText}</p>`;

    results.forEach(result => {
      const title = highlightText(result.title, query);
      const excerpt = result.excerpt
        ? highlightText(result.excerpt, query)
        : highlightText(truncateText(result.content, 200), query);

      const date = formatDate(result.date);
      const topics = result.topic?.map(t =>
        `<span class="search-topic">${formatTopic(t)}</span>`
      ).join(' ') || '';

      html += `
        <article class="search-result">
          <h2><a href="${result.url}">${title}</a></h2>
          <div class="search-meta">
            <span>${date}</span>
            ${topics}
          </div>
          <p class="search-excerpt">${excerpt}</p>
        </article>
      `;
    });

    searchResults.innerHTML = html;
  }

  function highlightText(text, query) {
    if (!text) return '';
    const escapedText = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatTopic(topic) {
    const topicMap = {
      'energie': 'Energie',
      'politik_und_gesellschaft': 'Politik & Gesellschaft',
      'wirtschaft': 'Wirtschaft'
    };
    return topicMap[topic] || topic;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
})();
