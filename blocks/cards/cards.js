import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });

    // strip stray <br> tags that can appear from Google Doc formatting
    li.querySelectorAll('br').forEach((br) => br.remove());

    // detect retailer variant from link href
    const link = li.querySelector('a');
    if (link) {
      const href = link.getAttribute('href') || '';
      if (href.includes('bestbuy')) li.classList.add('card--bb');
      else if (href.includes('walmart')) li.classList.add('card--wm');
      else if (href.includes('target')) li.classList.add('card--tg');
    }

    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.textContent = '';
  block.append(ul);

  // inject horizontal rule into the section header (default-content-wrapper)
  const wrapper = block.closest('.section')?.querySelector(':scope > .default-content-wrapper');
  if (wrapper && !wrapper.querySelector('hr')) {
    const rule = document.createElement('hr');
    wrapper.appendChild(rule);
  }
}
