export const VERSION = 'v0';
export const AUTH_ENABLED = false;
export const DEV = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const API_ENDPOINT = DEV
  ? 'http://localhost:8787'
  : 'https://api.snormax.com';

const SUPERUSER_TOKEN_KEY = `superuser-token--${VERSION}`;

/** @param {string} */
export const PERSIST_SEARCH_KEY = (retailer) => `persisted-search--${retailer}--${VERSION}`;

/** @type {string|undefined} */
let _token = localStorage.getItem(SUPERUSER_TOKEN_KEY);

/** 
 * @param {string} [retailer]
 * @returns {import("./types").PersistedSearchData}
 */
export const getPersistedData = (retailer = 'bestbuy') => JSON.parse(
  localStorage.getItem(PERSIST_SEARCH_KEY(retailer))
  ?? JSON.stringify({
    recent: [],
    searches: {}
  })
);

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
