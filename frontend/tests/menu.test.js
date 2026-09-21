const fs = require('fs');
const path = require('path');

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
    document.documentElement.classList.remove('nav-enhanced');
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

  it('gates the mobile drawer and button styles on successful enhancement', () => {
    setup();
    const css = fs.readFileSync(path.join(__dirname, '../src/scss/utilities/_responsive.scss'), 'utf8');
    expect(css).toMatch(/\.nav-enhanced \.topics-menu-toggle\s*\{/);
    expect(css).toMatch(/\.nav-enhanced \.topics-menu\s*\{[^}]*position: fixed/s);
    expect(css).not.toMatch(/\.topics-nav\s*\{[^}]*display: none/s);
  });
});
