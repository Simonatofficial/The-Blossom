/* Preset module gallery (docs/04: + New module → From Preset). */

import { router } from '../core/router.js';
import { icon } from './icons.js';
import { el, toast, openDrawer } from './components.js';
import { PRESET_MODULES, instantiatePreset } from '../presets/modules/index.js';
import { getBlueprint } from '../presets/blueprints.js';

export function openPresetGallery() {
  const d = openDrawer({ title: 'Preset modules', iconName: 'gift' });
  for (const preset of PRESET_MODULES) {
    const card = el(`<button class="list-item" style="align-items:flex-start;padding:14px">
      <span style="color:var(--accent);margin-top:2px">${icon(preset.icon, 22)}</span>
      <span class="li-main">
        <span class="li-title"></span>
        <span class="li-sub"></span>
      </span>${icon('plus', 16)}</button>`);
    card.querySelector('.li-title').textContent = preset.name;
    card.querySelector('.li-sub').textContent = preset.description;
    card.onclick = async () => {
      d.close();
      // Help me build is the default for presets that have a blueprint (docs/13
      // §3c); the wizard offers a "plant full preset" escape. Others plant 1-tap.
      const bp = getBlueprint(preset.key);
      if (bp) { const { openBuildWizard } = await import('./buildwizard.js'); openBuildWizard(bp, { fullPreset: preset }); return; }
      const mod = instantiatePreset(preset);
      toast(`${preset.name} planted`, 'sprout');
      router.go(mod.id);
    };
    d.body.appendChild(card);
  }
}
