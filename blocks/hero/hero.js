export default function decorate(block) {
  // wrapTextNodes wraps [picture, h1, p] inside a <p> wrapper because
  // the first child is PICTURE with siblings. Unwrap so the image stays
  // in normal flow and the text can be absolutely positioned over it.
  const cell = block.querySelector(':scope > div > div');
  if (cell) {
    const wrapper = cell.querySelector(':scope > p');
    if (wrapper && wrapper.querySelector('picture')) {
      while (wrapper.firstChild) {
        cell.appendChild(wrapper.firstChild);
      }
      wrapper.remove();
    }
  }

  // wrap h1 + subtitle in a .hero-copy container for positioning
  const h1 = block.querySelector('h1');
  if (h1) {
    const copy = document.createElement('div');
    copy.className = 'hero-copy';
    // collect h1 and the next sibling p (subtitle) if present
    const subtitle = h1.nextElementSibling;
    copy.appendChild(h1);
    if (subtitle && subtitle.tagName === 'P') {
      copy.appendChild(subtitle);
    }
    cell.appendChild(copy);
  }

  // ensure the hero image loads eagerly
  const img = block.querySelector('img');
  if (img) {
    img.setAttribute('loading', 'eager');
  }
}
