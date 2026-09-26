// Enhance the existing navigation in place; without JavaScript it stays visible.
(function () {
  function init() {
    const menuToggle = document.querySelector('.topics-menu-toggle');
    const topicsMenu = document.querySelector('.topics-nav .topics-menu');
    const menuBackdrop = document.querySelector('.menu-backdrop');
    if (!menuToggle || !topicsMenu || !menuBackdrop) return;

    let mobile = window.innerWidth <= 768;
    let open = false;
    let previousOverflow;
    const backgroundState = new Map();

    topicsMenu.id ||= 'topics-menu';
    menuToggle.setAttribute('aria-controls', topicsMenu.id);
    menuToggle.setAttribute('type', 'button');
    menuBackdrop.setAttribute('aria-hidden', 'true');

    // Disable only branches outside the menu and its toggle, keeping the nav landmark.
    function disableBackground(parent) {
      for (const child of parent.children) {
        if (child === topicsMenu || child === menuToggle || child === menuBackdrop) continue;
        if (child.contains(topicsMenu) || child.contains(menuToggle)) {
          disableBackground(child);
        } else {
          backgroundState.set(child, child.hasAttribute('inert'));
          child.setAttribute('inert', '');
        }
      }
    }

    function render() {
      topicsMenu.hidden = mobile && !open;
      topicsMenu.toggleAttribute('inert', mobile && !open);
      topicsMenu.classList.toggle('active', open);
      menuBackdrop.hidden = !open;
      menuBackdrop.classList.toggle('active', open);
      menuToggle.hidden = !mobile;
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    }

    function closeMenu(restoreFocus = false) {
      if (open) {
        document.body.style.overflow = previousOverflow;
        backgroundState.forEach((wasInert, element) => element.toggleAttribute('inert', wasInert));
        backgroundState.clear();
      }
      open = false;
      // Move focus before hiding the drawer.
      if (mobile && (restoreFocus || topicsMenu.contains(document.activeElement))) {
        menuToggle.focus();
      }
      render();
    }

    menuToggle.addEventListener('click', () => {
      if (!mobile) return;
      if (open) return closeMenu(true);
      open = true;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      disableBackground(document.body);
      render();
      topicsMenu.querySelector('a[href]')?.focus();
    });

    menuBackdrop.addEventListener('click', () => closeMenu(true));
    topicsMenu.addEventListener('click', (event) => {
      if (event.target.closest('a[href]')) closeMenu(true);
    });

    document.addEventListener('keydown', (event) => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      } else if (event.key === 'Tab') {
        const controls = [menuToggle, ...topicsMenu.querySelectorAll('a[href]')];
        const current = controls.indexOf(document.activeElement);
        if (current === -1 || (event.shiftKey && current === 0) ||
            (!event.shiftKey && current === controls.length - 1)) {
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0].focus();
        }
      }
    });

    window.addEventListener('resize', () => {
      const nextMobile = window.innerWidth <= 768;
      if (nextMobile === mobile) return;
      mobile = nextMobile;
      if (mobile) menuToggle.hidden = false;
      const toggleHadFocus = document.activeElement === menuToggle;
      closeMenu();
      if (!mobile && toggleHadFocus) topicsMenu.querySelector('a[href]')?.focus();
    });

    render();
    // `js` is normally already set by the inline head script (so the collapsed
    // drawer is painted from the start); set it here too so the drawer and its
    // toggle never depend on that script. The head script removes `js` on load
    // when `nav-enhanced` is missing, restoring the in-flow no-JS navigation.
    document.documentElement.classList.add('js', 'nav-enhanced');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
