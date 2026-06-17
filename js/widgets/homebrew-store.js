/* Homebrew store (docs/14 §B): user-created content grouped into custom books.
   Everything lives under one synthetic global owner so homebrew is available
   everywhere — the Compendium, every SRD picker, and across modules. Registers
   a provider with the compendium index so homebrew merges into search. */

import { store } from '../core/store.js';
import { objectsOf, createObject } from './base.js';
import { setHomebrewProvider } from '../presets/tabletop/srd5e-index.js';

const HB = '__homebrew__'; // global owner id for all homebrew objects

/** Compendium category id → singular entry kind (for entryDetail). */
export const CAT_KIND = {
  spells: 'spell', monsters: 'monster', classes: 'class', races: 'race',
  backgrounds: 'background', feats: 'feat', weapons: 'weapon', armor: 'armor',
  gear: 'gear', tools: 'tool', mounts: 'mount', items: 'magicitem',
  languages: 'language', poisons: 'poison', deities: 'deity', planes: 'plane',
  rules: 'rule', conditions: 'condition'
};

/* ---------- books ---------- */

export function allBooks() {
  return objectsOf(HB, 'ttbook').map(o => ({ id: o.id, ...o.data }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
export function getBook(id) { const o = store.get('objects', id); return o ? { id: o.id, ...o.data } : null; }
export function createBook(data = {}) {
  return createObject(HB, 'ttbook', { name: 'My Homebrew', abbrev: 'HB', author: '', color: '', description: '', ...data });
}
export function saveBook(id, data) { const o = store.get('objects', id); if (o) { o.data = { ...o.data, ...data }; store.put('objects', o); } }
export function deleteBook(id) {
  for (const e of objectsOf(HB, 'hbentry')) if (e.data.bookId === id) store.trash('objects', e.id);
  store.trash('objects', id);
}
export function bookSource(book) { return book ? (book.abbrev ? `${book.name} (${book.abbrev})` : book.name) : 'Homebrew'; }

/* ---------- entries ---------- */

/** Stored shape: { category, bookId, entry } where entry matches entryDetail. */
export function entriesOf(bookId = null) {
  return objectsOf(HB, 'hbentry').filter(e => !bookId || e.data.bookId === bookId);
}
export function createEntry(bookId, category, entry) {
  return createObject(HB, 'hbentry', { bookId, category, entry });
}
export function saveEntry(id, category, entry) {
  const o = store.get('objects', id);
  if (o) { o.data = { ...o.data, category, entry }; store.put('objects', o); }
}
export function deleteEntry(id) { store.trash('objects', id); }

/* ---------- compendium provider ---------- */

/** All homebrew entries shaped like compendium results (for search/pickers). */
export function homebrewCompendiumEntries() {
  const books = Object.fromEntries(allBooks().map(b => [b.id, b]));
  return entriesOf().map(o => {
    const b = books[o.data.bookId];
    return {
      ...o.data.entry,
      kind: CAT_KIND[o.data.category] || 'rule',
      _cat: o.data.category,
      homebrew: true,
      source: bookSource(b),
      _hbId: o.id, _bookId: o.data.bookId
    };
  });
}

// wire homebrew into the compendium search the moment this module loads
setHomebrewProvider(homebrewCompendiumEntries);

/* ---------- sharing (Blossom code) ---------- */

/** Bundle a book + its entries into a shareable Blossom code. */
export async function shareBook(bookId) {
  const { encode } = await import('../core/codes.js');
  const book = getBook(bookId);
  if (!book) return null;
  const entries = entriesOf(bookId).map(o => ({ category: o.data.category, entry: o.data.entry }));
  return encode('obj', { hb: 1, book: { name: book.name, abbrev: book.abbrev, author: book.author, color: book.color, description: book.description }, entries });
}

/** Import a homebrew book code. @returns {{book, count}|null} */
export async function importBook(code) {
  const { decode } = await import('../core/codes.js');
  const { payload } = await decode(code);
  if (!payload?.hb || !payload.book) throw new Error('That code is not a homebrew book.');
  const book = createBook(payload.book);
  let count = 0;
  for (const e of payload.entries || []) { createEntry(book.id, e.category, e.entry); count++; }
  return { book: { id: book.id, ...book.data }, count };
}
