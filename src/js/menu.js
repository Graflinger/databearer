// Topics menu toggle functionality
document.addEventListener('DOMContentLoaded', function () {
  const menuToggle = document.querySelector('.topics-menu-toggle');
  const topicsMenu = document.querySelector('.topics-menu');
  const menuBackdrop = document.querySelector('.menu-backdrop');
  const topicsNav = document.querySelector('.topics-nav');
  const topicsNavContainer = document.querySelector('.topics-nav .container');

  if (menuToggle && topicsMenu && menuBackdrop && topicsNav && topicsNavContainer) {
    // Function to open menu
    const openMenu = () => {
      topicsMenu.classList.add('active');
      menuBackdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
      menuToggle.setAttribute('aria-expanded', 'true');
      menuToggle.setAttribute('aria-label', 'Menü schließen');
    };

    // Function to close menu
    const closeMenu = () => {
      topicsMenu.classList.remove('active');
      menuBackdrop.classList.remove('active');
      document.body.style.overflow = '';
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Menü öffnen');
    };

    // Function to handle menu positioning based on screen size
    const handleMenuPosition = () => {
      if (window.innerWidth <= 768) {
        // Mobile: Move menu outside of nav (after body's first child)
        if (topicsMenu.parentElement === topicsNavContainer) {
          document.body.insertBefore(topicsMenu, topicsNav.nextSibling);
        }
      } else {
        // Desktop: Move menu back inside nav container
        if (topicsMenu.parentElement !== topicsNavContainer) {
          topicsNavContainer.appendChild(topicsMenu);
        }
        // Ensure menu is closed when switching to desktop
        closeMenu();
      }
    };

    // Initial position setup
    handleMenuPosition();

    // Toggle menu on button click
    menuToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close menu when clicking backdrop
    menuBackdrop.addEventListener('click', function () {
      closeMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.topics-menu') && !event.target.closest('.topics-menu-toggle')) {
        closeMenu();
      }
    });

    // Close menu when a link is clicked
    const menuLinks = topicsMenu.querySelectorAll('a');
    menuLinks.forEach((link) => {
      link.addEventListener('click', function () {
        closeMenu();
      });
    });

    // Handle menu position and close on window resize
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        handleMenuPosition();
      }, 250);
    });

    // Close menu on escape key
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
      }
    });
  }
});
