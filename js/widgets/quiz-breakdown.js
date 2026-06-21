/* Quiz breakdown (docs/16 §5d): "Recall by deck" — a collapsible
   Class › Unit › Topic tree built from every quiz result's per-question
   `context`, showing right/total + % at each level so you can drill from a
   whole subject down to the exact topic you're missing. Read-only; worst areas
   sort first. Lives in the Quiz internal view, below History. */

import { objectsOf } from './base.js';
import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';

/** Build the nested recall tree from quiz results. Each node: {name, correct,
    total, children:Map}. Every question bumps every ancestor on its context path. */
function buildTree(results) {
  const root = { name: '', correct: 0, total: 0, children: new Map() };
  for (const res of results) {
    for (const q of res.data.questions || []) {
      const path = (q.context || 'Questions').split(' › ').map(s => s.trim()).filter(Boolean);
      const right = q.status === 'correct';
      let node = root; node.total++; if (right) node.correct++;
      for (const name of path) {
        let ch = node.children.get(name);
        if (!ch) node.children.set(name, ch = { name, correct: 0, total: 0, children: new Map() });
        ch.total++; if (right) ch.correct++;
        node = ch;
      }
    }
  }
  return root;
}

const barColor = (pct) => pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--highlight)' : 'var(--warn)';

/** Append the "Recall by deck" section to host (nothing if no results yet). */
export function renderRecallByDeck(host, widget) {
  const results = objectsOf(widget.id, 'quizResult');
  if (!results.length) return;
  const root = buildTree(results);
  if (!root.children.size) return;

  const sec = el('<div class="qz-breakdown" style="margin-top:16px"></div>');
  const head = el(`<button class="row-between" style="width:100%;background:none;border:none;padding:0;cursor:pointer;color:inherit"><h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:0">RECALL BY DECK</h3><span class="btn-icon qz-bd-caret">${icon('chevron-down', 14)}</span></button>`);
  const body = el('<div style="margin-top:6px"></div>');
  let open = true;
  head.onclick = () => { open = !open; body.style.display = open ? '' : 'none'; head.querySelector('.qz-bd-caret').innerHTML = icon(open ? 'chevron-down' : 'chevron-right', 14); };

  const renderNode = (node, depth, container) => {
    const kids = [...node.children.values()].sort((a, b) => (a.correct / a.total) - (b.correct / b.total)); // worst first
    for (const ch of kids) {
      const pct = Math.round(ch.correct / ch.total * 100);
      const hasKids = ch.children.size > 0;
      const pad = depth * 14;
      const row = el(`<div style="margin-bottom:6px;padding-left:${pad}px">
        <div class="row" style="gap:4px;align-items:center;font-size:0.84rem">
          ${hasKids ? `<button class="btn-icon qz-bd-tog" style="width:18px;height:18px">${icon('chevron-right', 12)}</button>` : '<span style="width:18px;display:inline-block"></span>'}
          <span class="qz-bd-name" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
          <span class="soft" style="white-space:nowrap;font-size:0.78rem">${ch.correct}/${ch.total} · ${pct}%</span>
        </div>
        <div class="fc-progress" style="margin-top:3px;margin-left:22px"><span style="width:${pct}%;background:${barColor(pct)}"></span></div>
      </div>`);
      row.querySelector('.qz-bd-name').textContent = ch.name;
      container.appendChild(row);
      if (hasKids) {
        const kidWrap = el('<div></div>');
        kidWrap.style.display = 'none'; // drill in on demand (progressive disclosure)
        renderNode(ch, depth + 1, kidWrap);
        container.appendChild(kidWrap);
        const tog = row.querySelector('.qz-bd-tog');
        let kopen = false;
        tog.onclick = () => { kopen = !kopen; kidWrap.style.display = kopen ? '' : 'none'; tog.innerHTML = icon(kopen ? 'chevron-down' : 'chevron-right', 12); };
      }
    }
  };
  renderNode(root, 0, body);
  sec.append(head, body);
  host.appendChild(sec);
}
