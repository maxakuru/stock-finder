import { html } from '../../scripts/scripts.js';
import { getPersistedData, PERSIST_SEARCH_KEY, VERSION } from './storage.js';

/**
 * @typedef {import('./types.d').LookupParams} LookupParams
 * @typedef {import('./types.d').PersistedSearchData} PersistedSearchData
 * @typedef {import('./types.d').SearchResults} SearchResults
 */

const SUPERUSER_TOKEN_KEY = `superuser-token--${VERSION}`;
const AUTH_ENABLED = true;
const DEV = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_ENDPOINT = DEV
  ? 'http://localhost:8787'
  : 'https://api.snormax.com';

/** @type {HTMLDivElement} */
const lookupSection = document.querySelector('div#lookup');
/** @type {HTMLDivElement} */
const lookupResults = lookupSection.querySelector('#lookup-results');
/** @type {HTMLImageElement} */
const searchImage = lookupSection.querySelector('.display img');
/** @type {HTMLElement} */
const searchTitle = lookupSection.querySelector('h2#search-title');
/** @type {HTMLFormElement} */
const lookupForm = lookupSection.querySelector('form');
/** @type {HTMLInputElement} */
const inputSku = lookupForm.querySelector('input#sku');
/** @type {HTMLInputElement} */
const inputZipcode = lookupForm.querySelector('input#zipcode');
/** @type {HTMLButtonElement} */
const btnLookupSubmit = lookupForm.querySelector('button#lookup-submit');

/** @type {string|undefined} */
let _token = localStorage.getItem(SUPERUSER_TOKEN_KEY);

/** @type {PersistedSearchData} */
let _persisted;

/**
 * @param {string} path 
 * @param {RequestInit} [opts] 
 * @param {Record<string,string>} [params] 
 * @returns {Promise<Response>}
 */
async function callAPI(path, opts = {}, params = {}) {
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
 * @param {string} retailer 
 * @param {string} sku 
 * @param {string} zip 
 * @returns {Promise<SearchResults>}
 */
async function fetchStock(retailer, sku, zip) {
  if (!retailer) {
    return undefined;
  }

  const resp = await callAPI(`/stock/${retailer}`, undefined, { sku, zip });
  if (resp.ok) {
    return resp.json();
  }
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
async function shouldHalt() {
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
 * @param {SearchResults} results 
 * @returns {Promise<void>}
 */
async function renderLookupResults(results) {
  const { items, locations } = results ?? { items: [], locations: [] };
  console.log('results: ', results, items, locations);
  if (!(items ?? []).length) {
    // render no results
    lookupResults.innerHTML = /* html */`\
      <div class="no-results-message">
        <p>No results found!</p>
      </div>`;
    return;
  } else {
    lookupResults.innerHTML = '';
  }

  // render each location in a table
  items.forEach(item => {
    const resultTable = html`<table class="result-table"></table>`;
    const hrow = html`\
    <table>
      <thead>
        <tr class="result-row row-header">
          <th class="result-id row-header">Store ID</td>
          <th class="result-addr row-header">Location</td>
          <th class="result-qty row-header">Stock</td>
          <th class="result-cta row-header"></td>
        </tr>
      </thead>
    </table>`.firstElementChild;
    resultTable.append(hrow);

    const tableBody = html`<table><tbody></tbody></table>`.firstElementChild;
    resultTable.append(tableBody);

    item.locations.forEach(loc => {
      let location = locations.find(ploc => ploc.id === loc.locationId);
      if (!location) {
        console.warn('missing location: ', loc, locations);
        location = {};
      }

      console.log('loc: ', loc);

      const pickupQty = loc?.availability?.availablePickupQuantity;
      const inStoreQty = loc?.inStoreAvailability?.availableInStoreQuantity;
      if (pickupQty && inStoreQty && pickupQty !== inStoreQty) {
        console.warn('mismatched quantity: ', loc);
      }

      let qty = Math.max(pickupQty, inStoreQty) ?? 0;
      if (Number.isNaN(qty)) {
        qty = 0;
      }
      const { id, address, city, state, latitude, longitude } = location;

      // ID | Address, City, State | Quantity (phone#, mapLink) 
      const row = html`\
      <table>
        <tr class="result-row">
          <td class="result-id">${id}</td>
          <td class="result-addr">
            <span class="result-mobile-id">ID: ${id}<br/></span>
            ${address}, ${city}, ${state}
          </td>
          <td class="result-qty ${qty > 0 ? 'in' : 'out-of'}-stock">${String(qty)}</td>
          <td class="result-cta">
            (<a target="_blank" rel="noopener noreferrer" href="https://maps.google.com/?q=${latitude},${longitude}">Map</a>)
          </td>
        </tr>
      </table>`.firstElementChild.firstElementChild;
      tableBody.append(row);
    })
    lookupResults.append(resultTable);
  })

}

/**
 * @param {string} zip 
 * @returns {boolean}
 */
function isValidZipcode(zip) {
  return /^\d{5}$/.test(zip);
}

/**
 * @param {string} retailer
 * @param {LookupParams} params 
 */
async function persist(retailer, params) {
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

    if (touched) {
      localStorage.setItem(PERSIST_SEARCH_KEY(retailer), JSON.stringify(_persisted));
    }
  } catch (e) {
    console.error('failed to persist searches: ', e);
  }
}

/**
 * @param {string} retailer
 * @param {LookupParams} params 
 * @returns {Promise<void>}
 */
async function renderLookupForm(retailer, params) {
  const {
    sku,
    image,
    title,
    zipcode: pzipcode
  } = params;

  // save the search to localStorage, if needed
  persist(retailer, params);

  // set sku
  inputSku.value = sku || '';

  // set title
  searchTitle.innerText = title || 'Lookup';

  // set image
  if (image) {
    searchImage.onerror = () => {
      searchImage.src = '/icons/broken-image.svg';
    }
    searchImage.src = image;
  } else {
    searchImage.src = '/icons/broken-image.svg';
  }

  // set zipcode if provided, and perform lookup after render
  if (pzipcode && isValidZipcode(pzipcode)) {
    inputZipcode.value = pzipcode;
    setTimeout(() => btnLookupSubmit.click());
  }

  // attach form
  btnLookupSubmit.addEventListener('click', async (e) => {
    e.preventDefault();

    const zipcode = inputZipcode.value;
    if (!zipcode || !isValidZipcode(zipcode)) {
      inputZipcode.setCustomValidity('Invalid zipcode');
      inputZipcode.addEventListener('input', () => {
        inputZipcode.setCustomValidity("");
      }, { once: true });
      return;
    }
    btnLookupSubmit.disabled = true;
    const results = await fetchStock(retailer, sku, zipcode);
    const sparams = new URLSearchParams(location.search);
    sparams.set('zipcode', zipcode);
    window.history.pushState('', '', `?${sparams}`)
    renderLookupResults(results);
    btnLookupSubmit.disabled = false;
  });

  // make visible
  lookupSection.style.display = 'unset';
}

(async () => {
  if (await shouldHalt()) {
    return;
  }

  // fetch based on params, if set
  const url = new URL(location.href);
  const params = Object.fromEntries(url.searchParams.entries());
  let retailer;

  // set sku from pathname, if it's there
  if (/^\/lookup\/[a-z]+\/[a-zA-Z0-9]+$/.test(url.pathname)) {
    const parts = url.pathname.split('/').slice(2);
    retailer = parts[0];
    params.sku = parts[1];
    _persisted = getPersistedData(retailer);
  } else {
    retailer = params.retailer;
    _persisted = getPersistedData(params.retailer);
  }

  console.log('params: ', params);

  if (params.sku) {
    // looking up a product..
    return await renderLookupForm(retailer, params);
  }

  // otherwise this is to render the "add a search" view
  // TODO: make a content page for this..

})().catch(console.error);