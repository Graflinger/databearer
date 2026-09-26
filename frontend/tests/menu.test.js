const { createCascade, compileSiteCss } = require('./helpers/css-cascade');

describe('mobile navigation', () => {
  let toggle;
  let menu;
  let backdrop;
  let listeners;

  function resize(width) {
    window.innerWidth = width;
    window.dispatchEvent(new Event('resize'));
  }

  function setup(width = 375) {
    window.innerWidth = width;
    document.body.innerHTML = `
      <header><button class="topics-menu-toggle"></button><a href="/">Logo</a></header>
      <div class="menu-backdrop"></div>
      <nav class="topics-nav"><div class="container"><ul class="topics-menu">
        <li><a href="/energie/">Energie</a></li><li><a href="/suche/">Suche</a></li>
      </ul></div></nav>
      <main><a href="/post/">Post</a></main><footer inert>Footer</footer>`;
    toggle = document.querySelector('button');
    menu = document.querySelector('ul');
    backdrop = document.querySelector('.menu-backdrop');
    listeners = [];
    for (const target of [document, window]) {
      const add = target.addEventListener.bind(target);
      jest.spyOn(target, 'addEventListener').mockImplementation((type, handler, options) => {
        listeners.push([target, type, handler]);
        add(type, handler, options);
      });
    }
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    jest.resetModules();
    require('../src/js/menu');
  }

  afterEach(() => {
    listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler));
    jest.restoreAllMocks();
    document.documentElement.classList.remove('js', 'nav-enhanced');
    document.body.style.overflow = '';
  });

  it('keeps the same list in the nav, with hidden/inert closed state and control relationship', () => {
    setup();
    const parent = menu.parentElement;
    expect(menu.closest('nav')).not.toBeNull();
    expect(menu.hidden).toBe(true);
    expect(menu.hasAttribute('inert')).toBe(true);
    expect(toggle.getAttribute('aria-controls')).toBe(menu.id);
    toggle.click();
    expect(menu.parentElement).toBe(parent);
    expect(menu.hidden).toBe(false);
    expect(menu.hasAttribute('inert')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(menu.querySelector('a'));
    expect(document.querySelector('main').hasAttribute('inert')).toBe(true);
  });

  it('handles Escape, restores focus and preserves pre-existing overflow/inert', () => {
    setup();
    document.body.style.overflow = 'clip';
    toggle.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);
    expect(backdrop.hidden).toBe(true);
    expect(document.body.style.overflow).toBe('clip');
    expect(document.querySelector('main').hasAttribute('inert')).toBe(false);
    expect(document.querySelector('footer').hasAttribute('inert')).toBe(true);
  });

  it('cycles keyboard focus through the menu and its close toggle', () => {
    setup();
    toggle.click();
    const lastLink = menu.querySelectorAll('a')[1];
    lastLink.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement).toBe(toggle);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
    expect(document.activeElement).toBe(lastLink);
  });

  it.each(['backdrop', 'toggle', 'link'])('cleans up when closed with %s', (control) => {
    setup();
    toggle.click();
    const link = menu.querySelector('a');
    link.addEventListener('click', (event) => event.preventDefault());
    ({ backdrop, toggle, link })[control].click();
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
    expect(document.body.style.overflow).toBe('');
  });

  it('cleans up immediately on desktop resize and hides the drawer on return to mobile', () => {
    setup();
    toggle.click();
    resize(1024);
    expect(menu.closest('nav')).not.toBeNull();
    expect(menu.hidden).toBe(false);
    expect(menu.hasAttribute('inert')).toBe(false);
    expect(toggle.hidden).toBe(true);
    expect(backdrop.hidden).toBe(true);
    expect(document.querySelector('main').hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    resize(375);
    expect(menu.hidden).toBe(true);
    expect(toggle.hidden).toBe(false);
    expect(document.activeElement).toBe(toggle);
  });

  it('starts on desktop with visible, usable navigation', () => {
    setup(1024);
    expect(menu.hidden).toBe(false);
    expect(menu.hasAttribute('inert')).toBe(false);
    expect(toggle.hidden).toBe(true);
  });

  it('marks the document as enhanced, including when the head script did not add js', () => {
    setup();
    expect(document.documentElement.classList.contains('js')).toBe(true);
    expect(document.documentElement.classList.contains('nav-enhanced')).toBe(true);
  });

  it('does not enhance (and so lets the head script restore no-JS navigation) without its controls', () => {
    window.innerWidth = 375;
    document.body.innerHTML = '<nav class="topics-nav"><ul class="topics-menu"><li><a href="/">Home</a></li></ul></nav>';
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    listeners = [];
    jest.resetModules();
    require('../src/js/menu');
    expect(document.documentElement.classList.contains('nav-enhanced')).toBe(false);
    expect(document.querySelector('ul').hidden).toBe(false);
  });
});

// The inline head script sets html.js before first paint and removes it on load
// when menu.js never added nav-enhanced. The collapsed drawer must therefore key
// on .js alone, so the in-flow no-JS list never paints (and shifts) for JS users.
describe('mobile navigation styles across enhancement states', () => {
  const cascade = createCascade(compileSiteCss());
  const mobile = { width: 375 };
  const desktop = { width: 1024 };
  let nav;
  let menu;
  let toggle;
  let backdrop;

  function page(classes, { hidden = false, active = false } = {}) {
    document.documentElement.className = classes;
    document.body.innerHTML = `
      <header class="site-header"><div class="container">
        <button class="topics-menu-toggle" aria-label="Menü öffnen" aria-expanded="false"></button>
      </div></header>
      <div class="menu-backdrop"${active ? '' : ' hidden'}></div>
      <nav class="topics-nav"><div class="container">
        <ul class="topics-menu${active ? ' active' : ''}"${hidden ? ' hidden inert' : ''}>
          <li><a href="/">Alle Posts</a></li><li><a href="/suche/">Suche</a></li>
        </ul>
      </div></nav>`;
    nav = document.querySelector('.topics-nav');
    menu = document.querySelector('.topics-menu');
    toggle = document.querySelector('.topics-menu-toggle');
    backdrop = document.querySelector('.menu-backdrop');
  }
  const style = (element, property, env = mobile) => cascade.computed(element, property, env);
  // The <nav> takes no vertical space once its list is out of flow.
  const collapsedBar = () => ['padding-top', 'padding-bottom', 'border-bottom-width']
    .map((property) => style(nav, property));

  afterEach(() => {
    document.documentElement.className = '';
  });

  it('keeps the no-JS mobile list in flow and usable, without a toggle', () => {
    page('');
    expect(style(menu, 'position')).toBe('static');
    expect(style(menu, 'display')).toBe('flex');
    expect(style(menu, 'visibility')).toBe('visible');
    expect(style(menu.querySelector('a'), 'visibility')).toBe('visible');
    expect(style(toggle, 'display')).toBe('none');
    expect(collapsedBar()).not.toEqual(['0', '0', '0']);
  });

  it('collapses the drawer out of flow as soon as html.js is set, before menu.js runs', () => {
    page('js');
    expect(style(menu, 'position')).toBe('fixed');
    expect(style(menu, 'transform')).toBe('translateX(-100%)');
    expect(style(toggle, 'display')).toBe('block');
    expect(collapsedBar()).toEqual(['0', '0', '0']);
    // Links of the not-yet-managed drawer are neither visible nor focusable.
    expect(style(menu, 'visibility')).toBe('hidden');
    expect(style(menu.querySelector('a'), 'visibility')).toBe('hidden');
  });

  it('does not require nav-enhanced for any rule that collapses the drawer', () => {
    page('js');
    for (const property of ['position', 'transform', 'top', 'left']) {
      const winner = cascade.winner(menu, property, mobile);
      expect(winner.selector).not.toMatch(/nav-enhanced/);
    }
    expect(cascade.winner(toggle, 'display', mobile).selector).not.toMatch(/nav-enhanced/);
    expect(cascade.winner(nav, 'padding-top', mobile).selector).not.toMatch(/nav-enhanced/);
  });

  it('lets menu.js own the closed and open states once enhanced', () => {
    page('js nav-enhanced', { hidden: true });
    expect(style(menu, 'display')).toBe('none');
    expect(style(backdrop, 'display')).toBe('none');
    expect(style(toggle, 'display')).toBe('block');
    expect(collapsedBar()).toEqual(['0', '0', '0']);

    page('js nav-enhanced', { active: true });
    expect(style(menu, 'display')).toBe('flex');
    expect(style(menu, 'position')).toBe('fixed');
    expect(style(menu, 'transform')).toBe('translateX(0)');
    expect(style(menu, 'visibility')).toBe('visible');
    expect(style(menu.querySelector('li'), 'opacity')).toBe('1');
    expect(style(backdrop, 'display')).toBe('block');
  });

  it('restores the in-flow list when the head script removes js after a failed enhancement', () => {
    page('js');
    expect(style(menu, 'position')).toBe('fixed');
    document.documentElement.classList.remove('js');
    expect(style(menu, 'position')).toBe('static');
    expect(style(menu, 'visibility')).toBe('visible');
    expect(style(toggle, 'display')).toBe('none');
  });

  it('never hides the desktop navigation while waiting for menu.js', () => {
    page('js');
    expect(style(menu, 'position', desktop)).toBe('static');
    expect(style(menu, 'visibility', desktop)).toBe('visible');
    expect(style(toggle, 'display', desktop)).toBe('none');
  });

  it('keeps hidden disclosure parts hidden despite author display rules', () => {
    page('js nav-enhanced', { hidden: true });
    toggle.hidden = true;
    expect(style(toggle, 'display')).toBe('none');
    expect(style(menu, 'display', desktop)).toBe('none');
  });
});
