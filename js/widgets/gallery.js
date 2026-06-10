/* Image / Gallery widget (docs/05): imported images as Blobs in a masonry
   grid; lightbox with caption. Blobs live in IndexedDB and survive offline. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, confirmDialog } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';

const urls = new Map(); // objectId -> blob URL (session cache)
function urlFor(obj) {
  if (!urls.has(obj.id)) urls.set(obj.id, URL.createObjectURL(obj.data.blob));
  return urls.get(obj.id);
}

function importImages(widget, onDone) {
  const fileIn = el('<input type="file" accept="image/*" multiple class="hidden">');
  document.body.appendChild(fileIn);
  fileIn.onchange = async () => {
    for (const file of fileIn.files) {
      createObject(widget.id, 'image', { blob: file, caption: file.name.replace(/\.\w+$/, '') });
    }
    fileIn.remove();
    onDone();
  };
  fileIn.click();
}

registry.register({
  type: 'gallery',
  name: 'Gallery',
  icon: 'image',
  description: 'A soft grid of your images',
  external: true, internal: true,

  renderCard(host, widget) {
    host.innerHTML = '';
    const imgs = objectsOf(widget.id, 'image');
    if (!imgs.length) {
      host.appendChild(el('<p class="soft">Tap to open and add images.</p>'));
      return;
    }
    const cover = el(`<div class="gal-cover"><img alt=""><span class="chip" style="position:absolute;right:8px;bottom:8px">${imgs.length}</span></div>`);
    cover.querySelector('img').src = urlFor(imgs[imgs.length - 1]);
    host.appendChild(cover);
  },

  renderFull(host, widget, ctx) {
    const render = () => {
      host.innerHTML = '';
      const grid = el('<div class="gal-grid"></div>');
      for (const obj of objectsOf(widget.id, 'image')) {
        const cell = el('<button class="gal-cell"><img alt="" loading="lazy"></button>');
        cell.querySelector('img').src = urlFor(obj);
        cell.onclick = () => lightbox(obj);
        grid.appendChild(cell);
      }
      host.appendChild(grid);
      const add = el(`<button class="btn-soft-wide" style="margin-top:12px">${icon('plus', 15)} Add images</button>`);
      add.onclick = () => importImages(widget, render);
      host.appendChild(add);
    };

    const lightbox = (obj) => {
      const box = el(`<div class="gal-light"><img alt="">
        <input class="input" style="max-width:420px;margin:10px auto 0" placeholder="Caption…">
        <div class="row" style="justify-content:center;margin-top:8px">
          <button class="btn">${icon('trash', 14)} Remove</button>
          <button class="btn btn-primary">Done</button></div></div>`);
      const img = box.querySelector('img');
      img.src = urlFor(obj);
      let zoomed = false;
      img.onclick = () => { zoomed = !zoomed; img.style.transform = zoomed ? 'scale(2)' : ''; };
      const cap = box.querySelector('input');
      cap.value = obj.data.caption || '';
      cap.onchange = () => { obj.data.caption = cap.value; saveObject(obj); };
      box.querySelector('.btn').onclick = async () => {
        if (await confirmDialog({ title: 'Remove this image?' })) {
          store.trash('objects', obj.id);
          box.remove();
          render();
        }
      };
      box.querySelector('.btn-primary').onclick = () => box.remove();
      host.appendChild(box);
    };

    render();
  }
});
