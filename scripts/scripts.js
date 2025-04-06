import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

export const TOAST_DURATION = 4000;

const w = window;
const d = document;

/**
 * @template {Function} T
 * @param {T} fn
 * @param {number} [time=600]
 * @returns {T}
 */
export function debounce(fn, time = 600) {
  let timer;
  return (...args) => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    timer = setTimeout(() => fn(...args), time);
  };
}

/**
 * @param {HTMLElement} elem
 * @param {(e: MouseEvent) => void} cb
 * @returns {()=>void} remover fn
 */
export function onOutsideClick(elem, cb) {
  const h = ev => {
    if (!elem.contains(ev.target)) cb(ev);
  };
  d.addEventListener('click', h);
  return () => d.removeEventListener('click', h);
}

function el(str) {
  const content = typeof str !== 'string' ? '' : str;
  const tmp = document.createElement('div');
  tmp.innerHTML = content;
  return tmp.firstElementChild;
};

/**
 * HTML string template tag
 * @param {string[]} strs
 * @param  {...(string|Element)} params
 */
function htmlstr(strs, ...params) {
  let res = '';
  strs.forEach((s, i) => {
    const p = params[i];
    res += s;
    if (!p) return;
    if (p instanceof HTMLElement) {
      res += p.outerHTML;
    } else {
      res += p;
    }
  });
  return res;
}

/**
 * HTML element template tag
 * @param {string[]} strs
 * @param {} params
 * @returns {HTMLElement}
 */
export function html(strs, ...params) {
  return el(htmlstr(strs, ...params));
}

/**
 * @type {(
 *  msg: string, 
 *  lvl?: string, 
 *  opts?: { isPop?: boolean; duration?: number; }
 * ) => void} msg
 */
export const toast = (() => {
  /** @type {HTMLDivElement} */
  let _tc;
  /** @type {HTMLDivElement[]} */
  let _ts = [];
  let _timedOutPop;
  const updateTop = () => {
    const dEl = d.documentElement;
    let hHeight = 0;
    if (d.querySelector('header')) {
      hHeight = d.querySelector('header').clientHeight;
    }
    const pHeight = parseInt(getComputedStyle(dEl).getPropertyValue('--toast-top-pad').trim().slice(0, -2), 10) || 0;
    _tc.style.top = `calc(${Math.max(hHeight + pHeight - dEl.scrollTop, 0)}px)`;
  };
  const prep = () => {
    _tc = html`<div class="toast-container"></div>`;
    if (d.body.querySelector('main')) {
      d.body.querySelector('main').prepend(_tc);
    }
    updateTop();
    d.addEventListener('scroll', debounce(updateTop, 100));
  };
  const cleanup = () => {
    if (!_ts.filter(t => !!t).length) {
      _ts = [];
    }
  };
  const pop = id => () => {
    const rm = _ts[id];
    if (!rm) return;
    _ts[id] = undefined;
    rm.style.marginTop = `-${rm.clientHeight + 5}px`;
    setTimeout(() => {
      _tc.style.display = 'none';
      rm.remove();
      cleanup();
    }, 499);
  };
  return (msg, lvl = 'info', { isPop = true, duration = TOAST_DURATION } = {}) => {
    if (!msg) log.warn('toast added without message');
    if (!_tc) {
      prep();
    } else {
      _tc.style.removeProperty('display');
    }
    const t = html`<div class="toast ${lvl}"><p>${msg}</p></div>`;
    _ts[0] = t;
    while (_tc.firstChild) {
      _tc.removeChild(_tc.firstChild);
      clearTimeout(_timedOutPop);
    }
    _tc.appendChild(t);
    if (isPop) {
      _timedOutPop = setTimeout(pop(0), duration);
    }
    return () => setTimeout(pop(0), 10);
  };
})();
w.toast = toast;

/** make loading spinner */
export const loader = (classes = '', dataTestId = '') => html` <div data-testid="${dataTestId}" class="loader ${classes}">
  <div class="loader-progress"></div>
</div>`;

/** toggle loading spinner */
export const toggleLoader = (currentBlock, loaderName, flag) => {
  const loaderElement = currentBlock.querySelector(`.${loaderName}`);
  loaderElement.style.visibility = flag ? 'visible' : 'hidden';
};

export const widgetLoader = (classes = '', dataTestId = '') => html` <div data-testid="${dataTestId}" class="widget-loader-wrapper ${classes}">
  <div class="widget-loader-progress"></div>
</div>`;

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
