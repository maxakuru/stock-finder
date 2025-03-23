import { readBlockConfig } from "../../scripts/aem.js";

/**
 * @param {HTMLDivElement} block 
 */
export default function decorate(block) {
  const config = readBlockConfig(block);

  block.innerHTML = `\
    <form>
      <label for="sku">SKU</label>
      <input id="sku" required></input>

      <label for="title">Title</label>
      <input id="title"></input>

      <label for="image">Image URL</label>
      <input id="image"></input>

      <button id="create">Find Stock</button>
    </form>`

  /** @type {HTMLInputElement} */
  const skuInput = block.querySelector('input#sku');
  /** @type {HTMLInputElement} */
  const titleInput = block.querySelector('input#title');
  /** @type {HTMLInputElement} */
  const imageInput = block.querySelector('input#image');
  /** @type {HTMLButtonElement} */
  const btn = block.querySelector('button#create');

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
}