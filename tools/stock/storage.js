/**
 * @typedef {import('./types.d').LookupParams} LookupParams
 * @typedef {import('./types.d').PersistedSearchData} PersistedSearchData
 * @typedef {import('./types.d').SearchResults} SearchResults
 */

export const VERSION = 'v0';
export const AUTH_ENABLED = false;
export const DEV = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const REMOTE_DEV = window.location.host.endsWith(':3001');
export const API_ENDPOINT = DEV && !REMOTE_DEV
  ? 'http://localhost:8787'
  : 'https://api.snormax.com';
export const SESSION_KEY_ZIP = `zipcode--${VERSION}`;

const SUPERUSER_TOKEN_KEY = `superuser-token--${VERSION}`;

const MAX_PERSISTED_SEARCHES = 100;

/** @param {string} */
const PERSIST_SEARCH_KEY = (retailer) => `persisted-search--${retailer}--${VERSION}`;

/** @type {string|undefined} */
let _token = localStorage.getItem(SUPERUSER_TOKEN_KEY);

/** @type {PersistedSearchData} */
let _persisted;

/**
 * @param {string} str
 * @param {string} algo
 * @returns {Promise<string>}
 */
export async function digest(str, algo = 'SHA-1') {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(algo, new TextEncoder().encode(str)),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}


/** 
 * @param {string} [retailer]
 * @returns {import("./types").PersistedSearchData}
 */
export const getPersistedData = (retailer = 'bestbuy') => {
  if (!_persisted) {
    _persisted = JSON.parse(
      localStorage.getItem(PERSIST_SEARCH_KEY(retailer))
      ?? JSON.stringify({
        recent: [],
        searches: {}
      })
    );
  }
  return _persisted;
}

/**
 * @param {string} retailer
 * @param {LookupParams} params 
 */
export async function persist(retailer, params) {
  try {
    const { sku, image, title } = params;
    const id = await digest(`${sku}/${title}/${image}`);

    let touched = false;
    if (!_persisted.searches[id]) {
      touched = true;
      _persisted.searches[id] = { sku, image, title };
    }

    if (_persisted.recent[0] !== id) {
      touched = true;
      _persisted.recent = [...new Set([id, ..._persisted.recent])];
    }

    if (_persisted.recent.length > MAX_PERSISTED_SEARCHES) {
      // prune older searches
      touched = true;
      const removedIds = _persisted.recent.splice(MAX_PERSISTED_SEARCHES, _persisted.recent.length - 1);
      removedIds.forEach(rmId => {
        delete _persisted.searches[rmId];
      });
    }

    if (touched) {
      localStorage.setItem(PERSIST_SEARCH_KEY(retailer), JSON.stringify(_persisted));
    }
  } catch (e) {
    console.error('failed to persist searches: ', e);
  }
}

/**
 * @param {string} path 
 * @param {RequestInit} [opts] 
 * @param {Record<string,string>} [params] 
 * @returns {Promise<Response>}
 */
export async function callAPI(path, opts = {}, params = {}) {
  const pStr = new URLSearchParams(params).toString();
  const resp = await fetch(`${API_ENDPOINT}${path}${pStr ? `?${pStr}` : ''}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      'authorization': `Bearer ${_token}`
    }
  });
  if (!resp.ok) {
    console.error('failed to call api: ', resp);
  }
  return resp;
}

/**
 * check if currently set token is valid
 * @returns {Promise<boolean>}
 */
async function isTokenValid() {
  const res = await callAPI('/auth/me');
  if (res.ok) {
    return true;
  }
  return false;
}

/**
 * @returns {Promise<boolean>}
 */
export async function shouldHalt() {
  if (!AUTH_ENABLED) {
    return false;
  }

  if (_token && !(await isTokenValid())) {
    localStorage.removeItem(SUPERUSER_TOKEN_KEY);
    _token = undefined;
  }
  if (!_token) {
    // get token from input
    _token = prompt('Please enter your token: ');
    if (!_token) {
      alert('access denied');
      return true;
    }
    const valid = await isTokenValid();
    if (valid) {
      localStorage.setItem(SUPERUSER_TOKEN_KEY, _token);
    } else {
      localStorage.removeItem(SUPERUSER_TOKEN_KEY);
      location.reload();
      return true;
    }
  }
}
