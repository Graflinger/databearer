// Minimal CSS cascade evaluator for jsdom tests.
//
// jsdom's getComputedStyle ignores selector specificity (it applies rules in
// source order), media queries such as prefers-color-scheme or viewport widths,
// and custom properties, so it cannot answer "which colour actually wins?".
// This helper resolves the cascade for fixture elements instead: origin and
// !important, specificity (including :is/:not/:has/:where), source order,
// inline styles, inheritance, var() substitution, simple media queries and
// forced interaction states. It is deliberately small; unsupported colours
// throw so a test can never pass on a value it did not understand.
const { execFileSync } = require('child_process');
const path = require('path');

// Just enough of a user-agent stylesheet for display, links, marks and tables.
const UA_CSS = `
  html, body, address, article, aside, blockquote, details, dialog, div, dl, dd, dt, fieldset,
  figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, main, menu, nav, ol,
  p, pre, section, summary, ul { display: block; }
  head, script, style, template, [hidden] { display: none; }
  li { display: list-item; }
  button, input, select, textarea { display: inline-block; }
  table { display: table; border-collapse: separate; }
  caption { display: table-caption; text-align: center; }
  thead { display: table-header-group; }
  tbody { display: table-row-group; }
  tr { display: table-row; }
  td, th { display: table-cell; }
  th { font-weight: bold; text-align: center; }
  strong, b { font-weight: bold; }
  a:any-link { color: #0000ee; text-decoration: underline; cursor: pointer; }
  mark { background-color: yellow; color: black; }
`;

const INHERITED = new Set(['color', 'visibility', 'cursor', 'direction', 'font-family', 'font-size',
  'font-style', 'font-weight', 'font-variant-numeric', 'letter-spacing', 'line-height', 'text-align',
  'text-indent', 'text-transform', 'text-underline-offset', 'white-space', 'word-spacing',
  'overflow-wrap', 'word-break', 'hyphens', 'caption-side', 'border-collapse', 'border-spacing',
  'empty-cells', 'list-style-type', 'list-style-position', 'quotes', 'color-scheme']);

const INITIAL = {
  color: '#000000', visibility: 'visible', display: 'inline', position: 'static', float: 'none',
  'background-color': 'transparent', 'text-decoration-line': 'none', transform: 'none',
  opacity: '1', 'overflow-x': 'visible', 'overflow-y': 'visible', 'text-align': 'start',
  'white-space': 'normal', 'font-variant-numeric': 'normal', 'font-weight': 'normal',
  'border-collapse': 'separate', 'caption-side': 'top', 'vertical-align': 'baseline',
  'outline-style': 'none', 'outline-width': 'medium', 'outline-color': 'currentcolor',
  'outline-offset': '0', 'text-underline-offset': 'auto', 'z-index': 'auto',
};
for (const side of ['top', 'right', 'bottom', 'left']) {
  Object.assign(INITIAL, { [`padding-${side}`]: '0', [`margin-${side}`]: '0',
    [`border-${side}-width`]: 'medium', [`border-${side}-style`]: 'none',
    [`border-${side}-color`]: 'currentcolor', [side]: 'auto' });
}

const SIDES = ['top', 'right', 'bottom', 'left'];
const BORDER_STYLES = /^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/i;
const WIDE_KEYWORDS = /^(inherit|initial|unset|revert|revert-layer)$/i;

// --- Low-level scanning ------------------------------------------------------

function matchingClose(text, index) {
  // index points at an opening ( or [ ; returns the index of its partner.
  const open = text[index];
  const close = open === '(' ? ')' : ']';
  let depth = 0;
  let quote = null;
  for (let i = index; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === open) depth += 1;
    else if (char === close && --depth === 0) return i;
  }
  throw new Error(`Unbalanced ${open} in: ${text}`);
}

// Split at top-level occurrences of a separator (outside strings, () and []).
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (depth === 0 && (separator === ' ' ? /\s/.test(char) : char === separator)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function stripComments(css) {
  let result = '';
  let quote = null;
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (quote) {
      result += char;
      if (char === '\\') result += css[++i] ?? '';
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      result += char;
    } else if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
    } else result += char;
  }
  return result;
}

// --- Specificity ---------------------------------------------------------------

const IDENT = /[\w\-\u00a0-\uffff]/;

function skipIdent(selector, index) {
  let i = index;
  while (i < selector.length) {
    if (selector[i] === '\\') i += 2;
    else if (IDENT.test(selector[i])) i += 1;
    else break;
  }
  return i;
}

function maxSpecificity(list) {
  return list.reduce((best, item) => (compare(item, best) > 0 ? item : best), [0, 0, 0]);
}

function compare(left, right) {
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function specificity(selector) {
  const result = [0, 0, 0];
  const add = ([a, b, c]) => { result[0] += a; result[1] += b; result[2] += c; };
  let i = 0;
  while (i < selector.length) {
    const char = selector[i];
    if (char === '\\') {
      i += 2;
    } else if (char === '#') {
      result[0] += 1;
      i = skipIdent(selector, i + 1);
    } else if (char === '.') {
      result[1] += 1;
      i = skipIdent(selector, i + 1);
    } else if (char === '[') {
      result[1] += 1;
      i = matchingClose(selector, i) + 1;
    } else if (char === ':') {
      const element = selector[i + 1] === ':';
      const start = i + (element ? 2 : 1);
      i = skipIdent(selector, start);
      const name = selector.slice(start, i).toLowerCase();
      let argument = null;
      if (selector[i] === '(') {
        const end = matchingClose(selector, i);
        argument = selector.slice(i + 1, end);
        i = end + 1;
      }
      if (element || ['before', 'after', 'first-line', 'first-letter'].includes(name)) {
        result[2] += 1;
      } else if (name === 'where') {
        // Zero specificity by definition.
      } else if (['is', 'not', 'has', 'matches', '-webkit-any', '-moz-any'].includes(name)) {
        add(maxSpecificity(splitTopLevel(argument ?? '', ',').map(specificity)));
      } else if (['nth-child', 'nth-last-child'].includes(name) && /\bof\b/i.test(argument ?? '')) {
        result[1] += 1;
        add(maxSpecificity(splitTopLevel(argument.split(/\bof\b/i).slice(1).join('of'), ',').map(specificity)));
      } else {
        result[1] += 1;
      }
    } else if (IDENT.test(char)) {
      result[2] += 1;
      i = skipIdent(selector, i);
    } else {
      i += 1; // '*', combinators, whitespace and namespace separators
    }
  }
  return result;
}

// Interaction states cannot be triggered in jsdom; tests force them with data
// attributes instead. Pseudo-classes and attribute selectors share specificity
// (0,1,0), and specificity is computed from the original selector anyway.
const FORCED_STATES = [
  ['focus-visible', '[data-focus-visible]'], ['focus-within', '[data-focus-within]'],
  ['focus', '[data-focus]'], ['hover', '[data-hover]'], ['active', '[data-active]'],
  ['visited', '[data-visited]'], ['any-link', '[href]'], ['link', '[href]'],
];

function forceStates(selector) {
  return FORCED_STATES.reduce((text, [state, replacement]) =>
    text.replace(new RegExp(`(?<!:):${state}(?![\\w-])`, 'g'), replacement), selector);
}

const PSEUDO_ELEMENT = /::|:(before|after|first-line|first-letter)(?![\w-])/i;

// --- Declarations and shorthands ------------------------------------------------

function box(values) {
  const [top, right = top, bottom = top, left = right] = values;
  return [top, right, bottom, left];
}

function isColorToken(token) {
  return /^(#[0-9a-f]{3,8}|(rgba?|hsla?|color-mix|var)\(.*\)|currentcolor)$/i.test(token)
    || Object.prototype.hasOwnProperty.call(NAMED_COLORS, token.toLowerCase());
}

function lineParts(value) {
  // border/outline shorthand: width, style and colour in any order.
  const parts = { width: 'medium', style: 'none', color: 'currentcolor' };
  for (const token of splitTopLevel(value, ' ')) {
    if (BORDER_STYLES.test(token)) parts.style = token.toLowerCase();
    else if (/^(0|[\d.]+[a-z%]*|thin|medium|thick)$/i.test(token)) parts.width = token;
    else parts.color = token;
  }
  return parts;
}

function expand(property, value) {
  const longhands = [[property, value]];
  const wide = WIDE_KEYWORDS.test(value);
  const tokens = splitTopLevel(value, ' ');
  const all = (names) => names.map((name) => [name, value]);
  if (property === 'text-decoration') {
    const lines = tokens.filter((token) => /^(none|underline|overline|line-through|blink)$/i.test(token));
    longhands.push(['text-decoration-line', wide ? value : (lines.join(' ') || 'none')]);
  } else if (property === 'background') {
    const color = tokens.filter(isColorToken).pop();
    longhands.push(['background-color', wide ? value : (color || 'transparent')]);
  } else if (property === 'padding' || property === 'margin') {
    const values = wide ? box([value]) : box(tokens);
    SIDES.forEach((side, index) => longhands.push([`${property}-${side}`, values[index]]));
  } else if (property === 'overflow') {
    const [x, y = x] = wide ? [value] : tokens;
    longhands.push(['overflow-x', x], ['overflow-y', y]);
  } else if (property === 'inset') {
    const values = wide ? box([value]) : box(tokens);
    SIDES.forEach((side, index) => longhands.push([side, values[index]]));
  } else if (/^border(-(top|right|bottom|left))?$/.test(property)) {
    const sides = property === 'border' ? SIDES : [property.slice(7)];
    if (wide) {
      for (const side of sides) longhands.push(...all([`border-${side}-width`, `border-${side}-style`, `border-${side}-color`]));
    } else {
      const parts = lineParts(value);
      for (const side of sides) {
        longhands.push([`border-${side}-width`, parts.width], [`border-${side}-style`, parts.style],
          [`border-${side}-color`, parts.color]);
      }
    }
  } else if (/^border-(width|style|color)$/.test(property)) {
    const values = wide ? box([value]) : box(tokens);
    SIDES.forEach((side, index) => longhands.push([`border-${side}-${property.slice(7)}`, values[index]]));
  } else if (property === 'outline') {
    if (wide) longhands.push(...all(['outline-width', 'outline-style', 'outline-color']));
    else {
      const parts = lineParts(value);
      longhands.push(['outline-width', parts.width], ['outline-style', parts.style], ['outline-color', parts.color]);
    }
  }
  return longhands;
}

function parseDeclarations(body) {
  const declarations = [];
  for (const part of splitTopLevel(body, ';')) {
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    const raw = part.slice(0, colon).trim();
    const property = raw.startsWith('--') ? raw : raw.toLowerCase();
    let value = part.slice(colon + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/\s*!\s*important\s*$/i, '');
    for (const [name, longhand] of expand(property, value)) {
      declarations.push({ property: name, value: longhand, important });
    }
  }
  return declarations;
}

// --- Stylesheet parsing ------------------------------------------------------------

function parseRules(css, origin, rules = []) {
  const source = stripComments(css);
  function block(start, media) {
    let i = start;
    while (i < source.length) {
      while (i < source.length && /\s/.test(source[i])) i += 1;
      if (i >= source.length) return i;
      if (source[i] === '}') return i + 1;
      let j = i;
      let quote = null;
      let depth = 0;
      for (; j < source.length; j += 1) {
        const char = source[j];
        if (quote) {
          if (char === '\\') j += 1;
          else if (char === quote) quote = null;
        } else if (char === '"' || char === "'") quote = char;
        else if (char === '(' || char === '[') depth += 1;
        else if (char === ')' || char === ']') depth -= 1;
        else if (depth === 0 && '{;}'.includes(char)) break;
      }
      const prelude = source.slice(i, j).trim();
      if (source[j] !== '{') {
        i = source[j] === ';' ? j + 1 : j; // @charset/@import or a stray token
        continue;
      }
      if (/^@media\b/i.test(prelude)) {
        i = block(j + 1, [...media, prelude.replace(/^@media\s*/i, '')]);
      } else if (/^@supports\b/i.test(prelude)) {
        i = block(j + 1, media); // assume support
      } else {
        let end = j + 1;
        let nesting = 1;
        quote = null;
        for (; end < source.length && nesting; end += 1) {
          const char = source[end];
          if (quote) {
            if (char === '\\') end += 1;
            else if (char === quote) quote = null;
          } else if (char === '"' || char === "'") quote = char;
          else if (char === '{') nesting += 1;
          else if (char === '}') nesting -= 1;
        }
        // Skip @keyframes, @font-face, @starting-style and friends entirely.
        if (!prelude.startsWith('@')) {
          const branches = splitTopLevel(prelude, ',').map((selector) => ({
            selector,
            pseudoElement: PSEUDO_ELEMENT.test(selector),
            match: forceStates(selector),
            specificity: specificity(selector),
          }));
          rules.push({ origin, media, selector: prelude, branches, order: rules.length,
            declarations: parseDeclarations(source.slice(j + 1, end - 1)) });
        }
        i = end;
      }
    }
    return i;
  }
  block(0, []);
  return rules;
}

// --- Media queries -----------------------------------------------------------------

function pixels(value) {
  const match = /^(-?[\d.]+)(px|em|rem)?$/i.exec(value.trim());
  if (!match) return NaN;
  return parseFloat(match[1]) * (/r?em/i.test(match[2] || '') ? 16 : 1);
}

function mediaFeature(name, value, env) {
  switch (name) {
    case 'max-width': return env.width <= pixels(value);
    case 'min-width': return env.width >= pixels(value);
    case 'max-height': return env.height <= pixels(value);
    case 'min-height': return env.height >= pixels(value);
    case 'prefers-color-scheme': return value === env.theme;
    case 'hover':
    case 'any-hover': return value === undefined ? env.hover : (value === 'hover') === env.hover;
    case 'pointer':
    case 'any-pointer': return value === (env.hover ? 'fine' : 'coarse');
    case 'prefers-reduced-motion':
      return value === undefined ? env.reducedMotion : (value === 'reduce') === env.reducedMotion;
    case 'orientation': return value === (env.width >= env.height ? 'landscape' : 'portrait');
    default: return false; // Unknown features never match, as in browsers.
  }
}

function mediaQuery(query, env) {
  let text = query.trim().toLowerCase();
  let negate = false;
  if (text.startsWith('not ')) {
    negate = true;
    text = text.slice(4);
  }
  text = text.replace(/^only\s+/, '');
  let result = true;
  for (const part of text.split(/\s+and\s+/)) {
    if (part === 'all' || part === 'screen') continue;
    const feature = /^\(\s*([a-z-]+)\s*(?::\s*(.+?))?\s*\)$/.exec(part);
    result = result && Boolean(feature) && mediaFeature(feature[1], feature[2], env);
  }
  return negate ? !result : result;
}

function mediaMatches(media, env) {
  return media.every((list) => splitTopLevel(list, ',').some((query) => mediaQuery(query, env)));
}

// --- Colours -------------------------------------------------------------------------

const NAMED_COLORS = {
  transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1],
  yellow: [255, 255, 0, 1], red: [255, 0, 0, 1], canvas: [255, 255, 255, 1],
  canvastext: [0, 0, 0, 1],
};

function parseColor(value) {
  const text = String(value).trim().toLowerCase();
  if (NAMED_COLORS[text]) return NAMED_COLORS[text];
  const hex = /^#([0-9a-f]{3,8})$/.exec(text);
  if (hex && [3, 4, 6, 8].includes(hex[1].length)) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit) : hex[1].match(/../g);
    const [r, g, b, a = 'ff'] = digits;
    return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16) / 255];
  }
  const rgb = /^rgba?\(([^)]*)\)$/.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/\s*[,/]\s*|\s+/).filter(Boolean);
    const channel = (part) => (part.endsWith('%') ? parseFloat(part) * 2.55 : parseFloat(part));
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if (parts.length >= 3 && parts.slice(0, 3).every((part) => Number.isFinite(channel(part)))) {
      return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha];
    }
  }
  throw new Error(`Unsupported colour in cascade test: ${value}`);
}

function toHex([r, g, b, a = 1]) {
  const hex = [r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');
  return `#${hex}${a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : ''}`;
}

function composite(top, bottom) {
  const alpha = top[3] + bottom[3] * (1 - top[3]);
  if (!alpha) return [0, 0, 0, 0];
  const channel = (index) => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha;
  return [channel(0), channel(1), channel(2), alpha];
}

function luminance([r, g, b]) {
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// --- The cascade ------------------------------------------------------------------------

const DEFAULT_ENV = { theme: 'light', width: 1280, height: 800, hover: true, reducedMotion: false };

function createCascade(css) {
  const rules = parseRules(UA_CSS, 'user-agent');
  parseRules(css, 'author', rules);
  const byProperty = new Map();
  for (const rule of rules) {
    rule.declarations.forEach((declaration, index) => {
      if (!byProperty.has(declaration.property)) byProperty.set(declaration.property, []);
      byProperty.get(declaration.property).push({ rule, declaration, index });
    });
  }

  function environment(env) {
    return { ...DEFAULT_ENV, ...env };
  }

  function ruleSpecificity(rule, element) {
    let best = null;
    for (const branch of rule.branches) {
      if (branch.pseudoElement) continue;
      let matched = false;
      try {
        matched = element.matches(branch.match);
      } catch (error) {
        matched = false; // selectors the engine cannot parse never match
      }
      if (matched && (!best || compare(branch.specificity, best) > 0)) best = branch.specificity;
    }
    return best;
  }

  // All declarations for a property that apply to an element, best first.
  function candidates(element, property, env) {
    const found = [];
    for (const { rule, declaration, index } of byProperty.get(property) || []) {
      if (!mediaMatches(rule.media, env)) continue;
      const matched = ruleSpecificity(rule, element);
      if (!matched) continue;
      const level = rule.origin === 'user-agent' ? (declaration.important ? 3 : 0) : (declaration.important ? 2 : 1);
      found.push({ ...declaration, selector: rule.selector, media: rule.media, specificity: matched,
        rank: [level, 0, ...matched, rule.order, index] });
    }
    const inline = element.getAttribute?.('style');
    if (inline) {
      parseDeclarations(inline).filter((declaration) => declaration.property === property)
        .forEach((declaration, index) => found.push({ ...declaration, selector: '[style]', media: [],
          specificity: [1, 0, 0, 0], rank: [declaration.important ? 2 : 1, 1, 0, 0, 0, Infinity, index] }));
    }
    return found.sort((left, right) => compare(right.rank, left.rank));
  }

  function winner(element, property, env = {}) {
    return candidates(element, property, environment(env))[0] || null;
  }

  function initial(element, property, env) {
    const value = INITIAL[property] ?? '';
    return value === 'currentcolor' ? computed(element, 'color', env) : value;
  }

  function inherit(element, property, env) {
    const parent = element.parentElement;
    return parent ? computed(parent, property, env) : initial(element, property, env);
  }

  function customProperty(element, name, env, seen) {
    if (seen.has(name)) return null; // cyclic references are invalid
    const declaration = candidates(element, name, env)[0];
    if (!declaration || /^(inherit|unset|revert|revert-layer)$/i.test(declaration.value)) {
      return element.parentElement ? customProperty(element.parentElement, name, env, seen) : null;
    }
    if (/^initial$/i.test(declaration.value)) return null;
    return substitute(element, declaration.value, env, new Set([...seen, name]));
  }

  // Replace var() references; null means invalid at computed-value time.
  function substitute(element, value, env, seen = new Set()) {
    let result = '';
    let index = 0;
    while (index < value.length) {
      const start = value.indexOf('var(', index);
      if (start === -1) {
        result += value.slice(index);
        break;
      }
      result += value.slice(index, start);
      const end = matchingClose(value, start + 3);
      const [name, ...fallback] = splitTopLevel(value.slice(start + 4, end), ',');
      let resolved = customProperty(element, name, env, seen);
      if (resolved === null && fallback.length) resolved = substitute(element, fallback.join(', '), env, seen);
      if (resolved === null) return null;
      result += resolved;
      index = end + 1;
    }
    return result.trim();
  }

  function computed(element, property, env = {}) {
    const context = environment(env);
    if (property.startsWith('--')) return customProperty(element, property, context, new Set());
    const declaration = candidates(element, property, context)[0];
    const value = declaration ? substitute(element, declaration.value, context) : null;
    const keyword = value?.toLowerCase();
    if (value === null || ['unset', 'revert', 'revert-layer'].includes(keyword)) {
      return INHERITED.has(property) ? inherit(element, property, context) : initial(element, property, context);
    }
    if (keyword === 'inherit') return inherit(element, property, context);
    if (keyword === 'initial') return initial(element, property, context);
    if (keyword === 'currentcolor') {
      return property === 'color' ? inherit(element, property, context) : computed(element, 'color', context);
    }
    if (/^border-(top|right|bottom|left)-width$/.test(property)
      && /^(none|hidden)$/i.test(computed(element, property.replace('width', 'style'), context))) {
      return '0';
    }
    return value;
  }

  function color(element, property = 'color', env = {}) {
    return parseColor(computed(element, property, env));
  }

  // Opaque colour behind an element: its own and its ancestors' backgrounds
  // composited over the white canvas.
  function background(element, env = {}) {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const layer = color(node, 'background-color', env);
      if (layer[3] > 0) layers.push(layer);
      if (layer[3] >= 1) break;
    }
    return layers.reverse().reduce((below, layer) => composite(layer, below), [255, 255, 255, 1]);
  }

  function contrast(element, env = {}) {
    const behind = background(element, env);
    return contrastRatio(composite(color(element, 'color', env), behind), behind);
  }

  // Decoration lines drawn under an element's text: its own plus those
  // propagated from ancestors, which stop at atomic inlines and out-of-flow boxes.
  function decorationLines(element, env = {}) {
    const lines = new Set();
    for (let node = element; node; node = node.parentElement) {
      for (const line of computed(node, 'text-decoration-line', env).split(/\s+/)) {
        if (line && line !== 'none') lines.add(line);
      }
      const display = computed(node, 'display', env);
      if (/^inline-(block|flex|grid|table)$/.test(display) || ['absolute', 'fixed'].includes(computed(node, 'position', env))
        || computed(node, 'float', env) !== 'none') break;
    }
    return [...lines];
  }

  // Author selectors the DOM engine cannot evaluate would silently never match;
  // tests assert this list is empty so no rule is ignored unnoticed.
  function unsupportedSelectors(document) {
    return rules.filter((rule) => rule.origin === 'author').flatMap((rule) => rule.branches)
      .filter((branch) => !branch.pseudoElement).filter((branch) => {
        try {
          document.documentElement.matches(branch.match);
          return false;
        } catch (error) {
          return true;
        }
      }).map((branch) => branch.selector);
  }

  return { rules, winner, candidates: (element, property, env = {}) => candidates(element, property, environment(env)),
    computed, color, background, contrast, decorationLines, unsupportedSelectors };
}

// Compile the real Sass entry point. Dart Sass cannot use the filesystem inside
// jest-environment-jsdom, so compile in a child Node process in every environment.
function compileSiteCss() {
  const root = path.resolve(__dirname, '../..');
  return execFileSync(process.execPath,
    ['-e', 'process.stdout.write(require("sass").compile(process.argv[1]).css)', path.join(root, 'src/scss/style.scss')],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

module.exports = { createCascade, compileSiteCss, specificity, parseColor, contrastRatio, toHex, mediaQuery };
