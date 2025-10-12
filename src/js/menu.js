// Burger menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const burgerMenu = document.querySelector('.burger-menu');
  const topicsMenu = document.querySelector('.topics-menu');

  if (burgerMenu && topicsMenu) {
    burgerMenu.addEventListener('click', function() {
      // Toggle active class on burger menu (for animation)
      burgerMenu.classList.toggle('active');

      // Toggle active class on menu (to show/hide)
      topicsMenu.classList.toggle('active');

      // Update aria-expanded for accessibility
      const isExpanded = burgerMenu.getAttribute('aria-expanded') === 'true';
      burgerMenu.setAttribute('aria-expanded', !isExpanded);
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
      if (!event.target.closest('.topics-nav')) {
        burgerMenu.classList.remove('active');
        topicsMenu.classList.remove('active');
        burgerMenu.setAttribute('aria-expanded', 'false');
      }
    });

    // Close menu when a link is clicked
    const menuLinks = topicsMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
      link.addEventListener('click', function() {
        burgerMenu.classList.remove('active');
        topicsMenu.classList.remove('active');
        burgerMenu.setAttribute('aria-expanded', 'false');
      });
    });
  }
});
