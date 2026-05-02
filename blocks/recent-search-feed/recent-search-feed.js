import { readBlockConfig } from '../../scripts/aem.js';
import { html } from '../../scripts/scripts.js';
import { getPersistedData } from '../../tools/stock/storage.js';

const RECENT_ITEM_LIMIT = 12;

/**
 * @param {string} retailer
 * @param {object} item
 * @returns {HTMLElement|undefined}
 */
function recentItem(retailer, item) {
  if (!item) return undefined;
  const { image, title, sku } = item;
  const params = new URLSearchParams({ title: title || '', image: image || '' });

  const el = html`\
    <a class="recent-item" href="/lookup/${retailer}/${sku}?${params}">
      <div class="recent-item-img-wrap">
        <img src="${image || '/icons/broken-image.svg'}" alt="${title || sku}" loading="lazy" />
      </div>
      <div class="recent-item-body">
        <div class="recent-item-title">${title || sku}</div>
        <div class="recent-item-sku">${sku}</div>
      </div>
    </a>`;

  const img = el.querySelector('img');
  img.onerror = () => {
    img.src = '/icons/broken-image.svg';
  };

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
  const recent = data.recent.slice(0, RECENT_ITEM_LIMIT);
  const items = recent.map((id) => {
    const search = data.searches[id];
    return search ? recentItem(config.retailer, search) : undefined;
  }).filter(Boolean);

  block.innerHTML = `\
    <div class="recent-header">
      <div class="recent-label">History</div>
      <div class="recent-heading">Recent Searches</div>
      <div class="recent-rule"></div>
      <div class="recent-count"></div>
    </div>
    <div class="recent-scroll">
      <div class="recent-row"></div>
    </div>
    <div class="recent-empty">No recent searches yet</div>`;

  const row = block.querySelector('.recent-row');
  const empty = block.querySelector('.recent-empty');
  const countEl = block.querySelector('.recent-count');

  if (!items.length) {
    empty.style.display = 'block';
    row.style.display = 'none';
    countEl.textContent = '';
    return;
  }

  empty.style.display = 'none';
  row.style.display = 'flex';
  countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

  items.forEach((item) => row.append(item));
}
