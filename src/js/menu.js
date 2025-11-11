// Topics menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.querySelector('.topics-menu-toggle');
  const topicsMenu = document.querySelector('.topics-menu');

  if (menuToggle && topicsMenu) {
    menuToggle.addEventListener('click', function(event) {
      event.stopPropagation();

      // Toggle active class on menu (to show/hide)
      topicsMenu.classList.toggle('active');

      // Update aria-expanded for accessibility
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', !isExpanded);

      // Update aria-label
      if (isExpanded) {
        menuToggle.setAttribute('aria-label', 'Menü öffnen');
      } else {
        menuToggle.setAttribute('aria-label', 'Menü schließen');
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
      if (!event.target.closest('.topics-nav')) {
        topicsMenu.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Menü öffnen');
      }
    });

    // Close menu when a link is clicked
    const menuLinks = topicsMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
      link.addEventListener('click', function() {
        topicsMenu.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Menü öffnen');
      });
    });

    // Prevent menu from being affected by window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (window.innerWidth > 768) {
          topicsMenu.classList.remove('active');
          menuToggle.setAttribute('aria-expanded', 'false');
          menuToggle.setAttribute('aria-label', 'Menü öffnen');
        }
      }, 250);
    });
  }
});
