// Topics menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.querySelector('.topics-menu-toggle');
  const topicsMenu = document.querySelector('.topics-menu');
  const menuBackdrop = document.querySelector('.menu-backdrop');

  if (menuToggle && topicsMenu && menuBackdrop) {
    // Function to open menu
    function openMenu() {
      topicsMenu.classList.add('active');
      menuBackdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
      menuToggle.setAttribute('aria-expanded', 'true');
      menuToggle.setAttribute('aria-label', 'Menü schließen');
    }

    // Function to close menu
    function closeMenu() {
      topicsMenu.classList.remove('active');
      menuBackdrop.classList.remove('active');
      document.body.style.overflow = '';
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Menü öffnen');
    }

    // Toggle menu on button click
    menuToggle.addEventListener('click', function(event) {
      event.stopPropagation();
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close menu when clicking backdrop
    menuBackdrop.addEventListener('click', function() {
      closeMenu();
    });

    // Close menu when clicking outside (for cases without backdrop)
    document.addEventListener('click', function(event) {
      if (!event.target.closest('.topics-nav')) {
        closeMenu();
      }
    });

    // Close menu when a link is clicked
    const menuLinks = topicsMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
      link.addEventListener('click', function() {
        closeMenu();
      });
    });

    // Close menu and restore scroll on window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (window.innerWidth > 768) {
          closeMenu();
        }
      }, 250);
    });

    // Close menu on escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
      }
    });
  }
});
