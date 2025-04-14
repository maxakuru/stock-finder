import { readBlockConfig } from "../../scripts/aem.js";
import { callAPI, shouldHalt } from "../../tools/stock/storage.js";

const EXPECTS_SKU = {
  target: '8-digit number', // ignore the 10 digits that are allowed, since those seem to be 3rd party
  bestbuy: '7-digit number'
}

const isValidSku = (retailer, sku) => {
  if (retailer === 'target') {
    return /^\d{8,10}$/.test(sku);
  } else if (retailer === 'bestbuy') {
    return /^\d{7}$/.test(sku);
  }
  return true;
}

/**
 * @param {HTMLDivElement} block 
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  block.classList.add(`retailer-${config.retailer}`);
  block.innerHTML = '';
  if (await shouldHalt()) {
    return;
  }

  block.innerHTML = `\
    <form>
      <label for="sku">SKU</label>
      <input id="sku" required></input>

      <label for="title">Title</label>
      <input id="title"></input>

      <label for="image">Image URL</label>
      <input id="image"></input>

      <details class="disable-target disable-gamestop">
        <summary>
          <label>Extract info from product page</label>
        </summary>
        <fieldset id="extract-field" class="horizontal">
          <span class="field">
            <label for="url">Product URL</label>
            <input id="url" required></input>
          </span>

          <div class="controls">
            <button id="extract">Go</button>
          </div>
        </fieldset>
      </details>      

      <button id="create">Create Search</button>

      <span class="disable-gamestop disable-bestbuy">
        <div class="notes">
          <p class="error"><b>Note:</b> Target stock numbers are inaccurate for <b>Pokemon cards</b>, as their supplier does not update inventory numbers.</p>
        </div>
      </span>
    </form>`

  /** @type {HTMLInputElement} */
  const skuInput = block.querySelector('input#sku');
  /** @type {HTMLInputElement} */
  const titleInput = block.querySelector('input#title');
  /** @type {HTMLInputElement} */
  const imageInput = block.querySelector('input#image');
  /** @type {HTMLInputElement} */
  const urlInput = block.querySelector('input#url');
  /** @type {HTMLButtonElement} */
  const btn = block.querySelector('button#create');
  /** @type {HTMLButtonElement} */
  const btnExtract = block.querySelector('button#extract');
  /** @type {HTMLDetailsElement} */
  const details = block.querySelector('details');
  /** @type {HTMLLabelElement} */
  const summaryLabel = details.querySelector('summary>label');

  // allow summary label to open/close details
  summaryLabel.addEventListener('click', (e) => {
    details.open = !details.open;
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();

    const title = titleInput.value ?? '';

    const sku = skuInput.value;
    if (!sku || !isValidSku(sku)) {
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
      // try to parse url, if it fails reject the url
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

    // all good, redirect
    const params = new URLSearchParams({ title, image });
    window.location.href = `/lookup/${config.retailer}/${sku}?${params}`;
  });

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

    // valid, try extraction
    btnExtract.disabled = true;

    const resp = await callAPI(`/ops/extract`, undefined, { url });
    if (!resp.ok) {
      urlInput.setCustomValidity(`Failed to fetch: ${resp.status}`);
      urlInput.addEventListener('input', () => {
        urlInput.setCustomValidity('');
        btnExtract.disabled = false;
      }, { once: true });
      return;
    }

    const { title, image, sku } = await resp.json();
    // only set data to inputs without values
    // to avoid overwriting user's data
    if (!imageInput.value) {
      imageInput.value = image || '';
    }
    if (!titleInput.value) {
      titleInput.value = title || '';
    }
    // but always set sku if available, since it must be correct
    if (sku) {
      skuInput.value = sku;
    }
  });
}