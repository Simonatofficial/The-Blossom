/* Preset module gallery (docs/04: + New module → From Preset). */

import { router } from '../core/router.js';
import { icon } from './icons.js';
import { el, toast, openDrawer } from './components.js';
import { PRESET_MODULES, instantiatePreset } from '../presets/modules/index.js';

export function openPresetGallery() {
  const d = openDrawer({ title: 'Preset modules', iconName: 'gift' });
  for (const preset of PRESET_MODULES) {
    const card = el(`<button class="list-item" style="align-items:flex-start;padding:14px">
      <span style="color:var(--accent);margin-top:2px">${icon(preset.icon, 22)}</span>
      <span class="li-main">
        <span class="li-title" style="font-weight:600"></span>
        <span class="li-sub" style="white-space:normal"></span>
      </span>${icon('plus', 16)}</button>`);
    card.querySelector('.li-title').textContent = preset.name;
    card.querySelector('.li-sub').textContent = preset.description;
    card.onclick = () => {
      const mod = instantiatePreset(preset);
      d.close();
      toast(`${preset.name} planted`, 'sprout');
      router.go(mod.id);
    };
    d.body.appendChild(card);
  }
}
