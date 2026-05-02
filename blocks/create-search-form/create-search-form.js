import { readBlockConfig } from '../../scripts/aem.js';
import { toast } from '../../scripts/scripts.js';
import { callAPI, shouldHalt } from '../../tools/stock/storage.js';

const RETAILER_DISPLAY = {
  bestbuy: 'Best Buy',
  walmart: 'Walmart',
  target: 'Target',
  gamestop: 'GameStop',
};

const EXPECTS_SKU = {
  target: '8-digit number',
  bestbuy: '7-digit number',
  gamestop: '6-digit number',
  walmart: '10 to 12-character string',
};

const SKU_LENGTHS = {
  target: 8,
  bestbuy: 7,
  gamestop: 6,
  walmart: 10,
};

const isValidSku = (retailer, sku) => {
  if (retailer === 'target') return /^\d{8,10}$/.test(sku);
  if (retailer === 'bestbuy') return /^\d{7}$/.test(sku);
  if (retailer === 'gamestop') return /^\d{6}$/.test(sku);
  if (retailer === 'walmart') return /^[a-zA-Z0-9]{10,12}$/.test(sku);
  return true;
};

/**
 * @param {HTMLDivElement} block
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  const retailer = config.retailer;
  block.classList.add(`retailer-${retailer}`);
  block.innerHTML = '';
  if (await shouldHalt()) return;

  const skuLen = SKU_LENGTHS[retailer] ?? 6;
  const skuPlaceholder = new Array(skuLen).fill(0).map((_, i) => i % 9 + 1).join('');
  const showExtract = retailer === 'bestbuy';

  block.innerHTML = `\
    <form>
      <div class="field-group">
        <div class="field">
          <div class="field-label">SKU <span class="required">*</span></div>
          <input class="field-input" id="sku" type="text" inputmode="numeric" placeholder="${skuPlaceholder}" autocomplete="off" maxlength="${skuLen + 2}" />
          <div class="field-hint">${EXPECTS_SKU[retailer] || 'Product SKU'}</div>
        </div>

        <div class="field-row">
          <div class="field">
            <div class="field-label">Title</div>
            <input class="field-input" id="title" type="text" placeholder="Optional friendly title" autocomplete="off" />
          </div>
          <div class="field">
            <div class="field-label">Image URL</div>
            <input class="field-input" id="image" type="url" placeholder="https://example.com/image.png" autocomplete="off" />
          </div>
        </div>
      </div>

      ${showExtract ? `\
      <div class="extract-accordion" id="extractAccordion">
        <button class="extract-toggle" id="extractToggle" type="button">
          <span class="extract-toggle-icon">
            <svg viewBox="0 0 10 10"><polyline points="3,2 7,5 3,8"/></svg>
          </span>
          Extract info from product page
        </button>
        <div class="extract-body">
          <div class="extract-row">
            <div class="field">
              <div class="field-label">Product URL</div>
              <input class="field-input" id="url" type="url"
                placeholder="https://www.bestbuy.com/site/sku/6624827.p?skuId=6624827"
                autocomplete="off" />
            </div>
            <button class="extract-go-btn" id="extract" type="button">Go</button>
          </div>
        </div>
      </div>` : ''}

      <div class="submit-area">
        <button class="submit-btn" id="create" type="button">
          Create Search <span class="submit-btn-arrow">\u2192</span>
        </button>
      </div>

      <span class="disable-gamestop disable-bestbuy disable-walmart">
        <div class="notes">
          <p class="error"><b>Note:</b> Target stock numbers are inaccurate for <b>Pokemon cards</b>, as their supplier does not update inventory numbers.</p>
        </div>
      </span>
      <span class="disable-gamestop disable-bestbuy disable-target">
        <div class="notes">
          <p class="error"><b>Note:</b> Walmart does not provide specific quantities, only in/out of stock. Inventory state is relatively <b>inaccurate</b>, your results may vary.</p>
        </div>
      </span>
    </form>`;

  // inject page header into the section's default-content-wrapper (or create one)
  const section = block.closest('.section');
  if (section && !section.querySelector('.page-header')) {
    const displayName = RETAILER_DISPLAY[retailer] || retailer;
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `\
      <div class="page-header-eyebrow">
        <span class="retailer-pill">${displayName}</span>
        <span>Inventory Lookup</span>
      </div>
      <div class="page-header-title">Create a Search</div>
      <div class="page-header-sub">Enter a ${EXPECTS_SKU[retailer] || 'SKU'} to check local store availability.</div>`;
    const wrapper = block.closest('.create-search-form-wrapper');
    if (wrapper) {
      section.insertBefore(header, wrapper);
    }
  }

  /** @type {HTMLInputElement} */
  const skuInput = block.querySelector('input#sku');
  /** @type {HTMLInputElement} */
  const titleInput = block.querySelector('input#title');
  /** @type {HTMLInputElement} */
  const imageInput = block.querySelector('input#image');
  /** @type {HTMLButtonElement} */
  const btn = block.querySelector('button#create');

  // extract accordion toggle
  const extractToggle = block.querySelector('#extractToggle');
  const extractAccordion = block.querySelector('#extractAccordion');
  if (extractToggle && extractAccordion) {
    extractToggle.addEventListener('click', () => {
      extractAccordion.classList.toggle('open');
    });
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();

    const title = titleInput.value ?? '';
    const sku = skuInput.value;

    if (!sku || !isValidSku(retailer, sku)) {
      if (!sku) {
        skuInput.setCustomValidity('SKU is required');
      } else {
        skuInput.setCustomValidity(`Not a valid SKU, expecting ${EXPECTS_SKU[retailer]}`);
      }
      skuInput.addEventListener('input', () => {
        skuInput.setCustomValidity('');
      }, { once: true });
      return;
    }

    const image = imageInput.value;
    if (image) {
      try {
        new URL(image);
      } catch {
        imageInput.setCustomValidity('Not a valid URL');
        imageInput.addEventListener('input', () => {
          imageInput.setCustomValidity('');
        }, { once: true });
        return;
      }
    }

    const params = new URLSearchParams({ title, image });
    window.location.href = `/lookup/${retailer}/${sku}?${params}`;
  });

  // extract handler
  /** @type {HTMLInputElement} */
  const urlInput = block.querySelector('input#url');
  /** @type {HTMLButtonElement} */
  const btnExtract = block.querySelector('button#extract');

  if (btnExtract && urlInput) {
    btnExtract.addEventListener('click', async (e) => {
      e.preventDefault();

      const url = urlInput.value;
      try {
        new URL(url);
      } catch {
        urlInput.setCustomValidity('Not a valid URL');
        urlInput.addEventListener('input', () => {
          urlInput.setCustomValidity('');
        }, { once: true });
        return;
      }

      btnExtract.disabled = true;

      const resp = await callAPI('/ops/extract', undefined, { url });
      if (!resp.ok) {
        toast(`${resp.headers.get('x-error') ?? 'an error occurred'} (${resp.status})`, 'error');
        console.error(resp);
        urlInput.setCustomValidity(`Failed to fetch: ${resp.status}`);
        urlInput.addEventListener('input', () => {
          urlInput.setCustomValidity('');
          btnExtract.disabled = false;
        }, { once: true });
        return;
      }

      const { title: extractTitle, image: extractImage, sku: extractSku } = await resp.json();
      if (!imageInput.value) imageInput.value = extractImage || '';
      if (!titleInput.value) titleInput.value = extractTitle || '';
      if (extractSku) skuInput.value = extractSku;
      btnExtract.disabled = false;
    });
  }
}
