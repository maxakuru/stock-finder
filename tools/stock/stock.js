import { html } from '../../scripts/scripts.js';
import {
  PERSIST_SEARCH_KEY,
  SESSION_KEY_ZIP,
  callAPI,
  getPersistedData,
  shouldHalt
} from './storage.js';

/**
 * @typedef {import('./types.d').LookupParams} LookupParams
 * @typedef {import('./types.d').PersistedSearchData} PersistedSearchData
 * @typedef {import('./types.d').SearchResults} SearchResults
 */

/** @type {HTMLTitleElement} */
const titleEl = document.querySelector('head>title');
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
/** @type {HTMLLinkElement} */
const btnOpenPDP = document.querySelector('a#form-action-open');
/** @type {HTMLLinkElement} */
const btnShareSearch = document.querySelector('a#form-action-share');

/** @type {PersistedSearchData} */
let _persisted;

const PDP_URL = (retailer, sku) => {
  switch (retailer) {
    case 'target':
      return `https://www.target.com/p/urlkey/-/A-${sku}`;
    case 'bestbuy':
      return `https://www.bestbuy.com/site/urlkey/${sku}.p?skuId=${sku}`;
    default:
      return '#';
  }
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

    locations.forEach(location => {
      let itemLocation = item.locations.find(ploc => ploc.locationId === location.id);
      if (!itemLocation) {
        itemLocation = {};
      }

      const pickupQty = itemLocation?.availability?.availablePickupQuantity;
      const inStoreQty = itemLocation?.inStoreAvailability?.availableInStoreQuantity;
      if (pickupQty && inStoreQty && pickupQty !== inStoreQty) {
        console.warn('mismatched quantity: ', loc);
      }

      let qty = Math.max(pickupQty, inStoreQty) ?? 0;
      if (Number.isNaN(qty)) {
        qty = 0;
      }
      const { id, address, city, state, zipCode } = location;

      // ID | Address, City, State | Quantity (mapLink) 
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
            (<a target="_blank" rel="noopener noreferrer" href="https://maps.google.com/?q=${address} ${city} ${state} ${zipCode}">Map</a>)
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

  // update pdp link
  btnOpenPDP.href = PDP_URL(retailer, sku);

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
  } else if (!pzipcode) {
    // not set from params, try to pull from session
    inputZipcode.value = inputZipcode.value || sessionStorage.getItem(SESSION_KEY_ZIP) || '';
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
    // store zipcode in session
    sessionStorage.setItem(SESSION_KEY_ZIP, zipcode);
    btnLookupSubmit.disabled = true;
    const results = await fetchStock(retailer, sku, zipcode);
    const sparams = new URLSearchParams(location.search);
    sparams.set('zipcode', zipcode);
    window.history.pushState('', '', `?${sparams}`)
    renderLookupResults(results);
    btnLookupSubmit.disabled = false;
  });

  // attach share link
  btnShareSearch.addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(window.location.href);
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

  console.debug('params: ', params);

  if (params.sku) {
    // looking up a product..
    titleEl.innerText.replace('{sku}', sku);
    return await renderLookupForm(retailer, params);
  }

  // otherwise this is to render the "add a search" view
  // TODO: make a content page for this..

})().catch(console.error);