import { readBlockConfig } from "../../scripts/aem.js";
import { html } from "../../scripts/scripts.js";
import { getPersistedData } from "../../tools/stock/storage.js";

/**
 * @param {import("../../tools/stock/types.js").PersistedSearchData['searches'][string]} item 
 * @returns {HTMLDivElement}
 */
const carouselItem = (retailer, item) => {
  if (!item) {
    return undefined;
  }

  const { image, title, sku } = item;
  const params = new URLSearchParams({ title, image });
  const el = html`\
    <div class="carousel-item">
      <a class="search-link" href="/lookup/${retailer}/${sku}?${params}">
        <img src="${image}"/>
        <p>${title}</p>
      </a>
    </div>`;

  // attach handlers
  // TODO: allow delete?
  const searchLink = el.querySelector('a.search-link');
  const imageEl = searchLink.querySelector('img');
  imageEl.onerror = () => {
    imageEl.src = '/icons/broken-image.svg';
  }
  return el;
}

/**
 * @param {HTMLDivElement} block 
 */
export default function decorate(block) {
  const config = readBlockConfig(block);
  block.innerHTML = '';

  if (!config?.retailer) {
    console.error('missing retailer');
    block.remove();
    return;
  }

  const data = getPersistedData(config.retailer);
  console.log(`retrieved persisted for ${config.retailer}: `, data);
  const recent = data.recent.slice(0, 8); // max 8 items
  const items = recent.map(id => carouselItem(config.retailer, data.searches[id])).filter(Boolean);

  if (!items.length) {
    // nothing to show
    console.log('no recent searches: ', recent, items);
    block.remove();
    return;
  }

  block.innerHTML = `\
    <div class="recent-carousel">
      <h3>Recent Searches</h3>
      <div class="carousel"></div>
    </div>`;

  /** @type {HTMLElement} */
  const carousel = block.querySelector('.carousel');
  carousel.style.width = `calc( ${recent.length} * 200px)`;

  // add items to carousel
  items.forEach(item => {
    carousel.append(item);
  });
}