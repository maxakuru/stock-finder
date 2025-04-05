/**
 * @param {number} deg 
 * @returns {number}
 */
const degToRad = (deg) => deg * (Math.PI / 180);

/**
 * @param {number} lat1 degrees
 * @param {number} long1 degrees
 * @param {number} lat2 degrees
 * @param {number} long2 degrees
 * @returns {number}
 */
const distance = (lat1, long1, lat2, long2) => {
  const dlat1 = degToRad(lat1);
  const dlong1 = degToRad(long1);
  const dlat2 = degToRad(lat2);
  const dlong2 = degToRad(long2);

  try {
    return Math.acos(
      Math.sin(dlat1) * Math.sin(dlat2)
      + Math.cos(dlat1) * Math.cos(dlat2) * Math.cos(dlong2 - dlong1)
    ) * 6371;
  } catch (e) {
    console.log('failed to calc distance: ', e);
    return 9999;
  }
}

// json.searchKey -> { lat: string; long: string; }
// json.locations -> contains all locations, including oos, but in HTML and need to parse it
// json.stores -> contains only stores with stock?
// json.storesResultsHtml -> contains html to be rendered, with actual stock?
export default async function adapter(json) {
  const resultsEl = document.createElement('div');
  resultsEl.innerHTML = json.storesResultsHtml;

  const lat1 = Number.parseFloat(json.searchKey.lat);
  const long1 = Number.parseFloat(json.searchKey.long);

  const item = {
    sku,
    inStoreAvailable: false,
    locations: [],
    ispuEligible: false,
  };

  const rawLocations = JSON.parse(json.locations);
  const locations = rawLocations
    .map(({ infoWindowHtml, ...rest }) => {
      // render the html chunk and get stuff from it
      const el = document.createElement('div');
      el.innerHTML = infoWindowHtml;
      const detailsEl = el.firstElementChild;
      const id = detailsEl.getAttribute('data-store-id');
      const phone = detailsEl.querySelector('a.storelocator-phone').getAttribute('href');
      const address = detailsEl.querySelector('address').textContent.split('\n').map((s) => s.trim()).filter(Boolean)[0];
      const storeData = detailsEl.querySelector('span.storeData');
      const state = storeData.getAttribute('data-stateprovince');
      const city = storeData.getAttribute('data-city');
      const zipcode = storeData.getAttribute('data-postalcode');
      const { latitude: lat2, longitude: long2 } = rest;

      return {
        id,
        address,
        city,
        zipcode,
        state,
        phone,
        distance: distance(lat1, long1, lat2, long2),
        ...rest,
      };
    })
    .sort((a, b) => a.distance - b.distance);
  console.debug('locations: ', locations);

  json.stores.forEach((store) => {
    // parse quantity from resultsEl
    const resultEl = resultsEl.querySelector(`div.store-details[data-store-id="${store.ID}"]`);
    const quantityEl = resultEl.querySelector('span.store-product-count');
    const quantityTxt = quantityEl.textContent.toLowerCase();
    let quantity;
    try {
      quantity = quantityTxt === 'in stock'
        ? 1
        : Number.parseInt(quantityTxt.replace(/[^\d]/g, '').trim(), 10);
    } catch {
      quantity = 0;
    }

    if (quantity > 0) {
      item.inStoreAvailable = true;
      item.ispuEligible = true;
    }

    item.locations.push({
      locationId: store.ID,
      availability: {
        availablePickupQuantity: quantity,
      },
      inStoreAvailability: {
        availableInStoreQuantity: quantity,
      },
      quantityText: store.eligibleStorePickupProductCount,
      middleDayClosure: store.storeMiddleDayClosure ?? false,
      mode: store.storeMode ?? 'ACTIVE',
      puDetails: store.storePickupDetails,
    });
  });

  return {
    items: [item],
    locations,
  };
}