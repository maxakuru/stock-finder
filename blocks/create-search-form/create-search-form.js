import { readBlockConfig } from "../../scripts/aem.js";
import { callAPI, shouldHalt } from "../../tools/stock/storage.js";

/**
 * @param {HTMLDivElement} block 
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);

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

      <details>
        <summary>
          <label>Extract info from URL</label>
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

      <button id="create">Find Stock</button>
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

  btn.addEventListener('click', (e) => {
    e.preventDefault();

    const title = titleInput.value ?? '';

    const sku = skuInput.value;
    if (!sku) {
      skuInput.setCustomValidity('SKU is required');
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