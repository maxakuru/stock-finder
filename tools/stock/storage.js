export const VERSION = 'v0';

/** @param {string} */
export const PERSIST_SEARCH_KEY = (retailer) => `persisted-search--${retailer}--${VERSION}`;

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