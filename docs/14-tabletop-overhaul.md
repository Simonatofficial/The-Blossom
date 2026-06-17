# 14 — Tabletop (D&D 5e) Overhaul

The long-form plan for turning the Tabletop modules into an offline, all-in-one
5e toolkit in the spirit of **D&D Beyond** and the free **D&D 5e Companion app**:
full SRD content, a guided character builder, a homebrew + custom-book system,
and resources that calculate and link to each other.

**Legal boundary (firm):** only the **5e SRD 5.1 (CC-BY-4.0)** is reproduced in
full. Non-SRD book content (full PHB/XGE/TCE/MM/VGM/MTF text) is *not* embedded;
where a popular option is referenced (e.g. standard feats) it is a brief
mechanical summary with the source book named. The homebrew system is how the
user adds anything beyond the SRD themselves.

---

## A. Content counts — have vs. addable

Live data lives in `js/presets/tabletop/`. "SRD 5.1" = the full free SRD target;
"Have" = currently shipped (v75).

| Category | Have | SRD 5.1 target | Notes / remaining |
|---|---:|---:|---|
| **Spells** | 307 | ~319 | Add the ~12 remaining SRD spells to complete the set. |
| **Monsters** | 54 | ~325 | Biggest gap. Add the rest of the SRD bestiary (dragons by age/color, all devils/demons, golems, more giants/elementals/oozes/plants/celestials/fey/undead, NPC stat blocks). |
| **Classes** | 12 | 12 | Complete. Each has the SRD subclass; more subclasses are PHB (paraphrased summaries only). |
| **Subclasses** | ~30 (summaries) | 12 (SRD) | SRD has 1 each; extras are PHB summaries. Homebrew for the rest. |
| **Races** | 9 | 9 | Complete (with SRD subraces). |
| **Backgrounds** | 13 | 1 SRD (+12 PHB) | SRD only has Acolyte; the other 12 are PHB summaries. |
| **Feats** | 43 | 1 SRD (+~42 PHB) | SRD only has Grappler; rest are PHB summaries. |
| **Weapons** | 37 | 37 | Complete. |
| **Armor** | 13 | 13 | Complete. |
| **Adventuring gear** | 32 | ~120 | Add the rest: containers, kits, holy symbols, ammunition types, spellcasting foci, trade goods. |
| **Tools** *(new category)* | 0 | ~40 | Artisan's tools, kits (herbalism/healer/etc.), gaming sets, instruments, navigator's/thieves' tools. |
| **Mounts & vehicles** *(new)* | 0 | ~20 | Riding/draft animals, carts, ships, their speeds & capacities. |
| **Magic items** | 34 | ~362 | Large gap. Add the full SRD magic-item list by rarity, with attunement and charges. |
| **Conditions** | 15 | 15 | Complete. |
| **Rules** | 25 | open | Add: full combat sequence, environment (vision, suffocation, falling), travel/downtime, traps, diseases, poisons, madness, the planes. |
| **Languages** *(new)* | 0 | ~16 | Standard + exotic languages with scripts. |
| **Deities** *(new)* | 0 | ~30 | The SRD example pantheon. |
| **Poisons** *(new)* | 0 | ~14 | SRD poisons (type, price, effect). |
| **Planes** *(new)* | 0 | ~25 | The SRD cosmology entries. |

**Compendium categories now (12):** Spells · Monsters · Classes · Races ·
Backgrounds · Feats · Weapons · Armor · Gear · Magic Items · Rules · Conditions.
**Planned new categories:** Subclasses · Tools · Mounts & Vehicles · Languages ·
Deities · Poisons · Planes · *Homebrew (per custom book)*.

---

## B. Homebrew & custom books

The user wants to create custom content of every kind and group it into their own
**books**, and to share a book with everyone inside it.

**Data model**
- New object kind `ttbook` (custom sourcebook): `{ name, abbrev, author, color, description, blossomShareId }`.
- Every homebrew entry stores `homebrew: true`, `bookId`, `source: <book name>`, and a `kind` matching a compendium category (`spell`, `monster`, `class`, `race`, `background`, `feat`, `weapon`, `armor`, `gear`, `magicitem`, …).
- Homebrew entries persist in IndexedDB under a dedicated `homebrew` widget (or the module anchor), so they survive updates and export with the module.

**New widget `homebrew` (Homebrew Workshop)**
- Create/edit/delete books.
- Create entries of any category with the right form (reuse the editors already built for spells/items/monsters; add forms for class/race/background/feat).
- Assign each entry to a book; entries show their book as the source.
- **Sharing:** "Share book" exports the book + all its entries as a Blossom code (the app's existing share-code system). Importing a code adds the book and its contents to the recipient's compendium.

**Compendium integration**
- `searchCompendium()` merges SRD entries with all homebrew entries.
- A **Homebrew** filter and per-book filters in the Compendium and in every picker.
- The smart pickers (sheet, spellbook, inventory, statblock, session planner) automatically include homebrew, so a custom sword or spell is addable exactly like an SRD one.

---

## C. Character sheet overhaul (D&D-Beyond-parity checklist)

The sheet should hold and **calculate** everything, and link to the other
widgets. Status: ✅ done · ◻ planned.

**Identity:** ✅ name · ✅ species/race (all SRD) · ◻ subrace/ancestral heritage surfaced · ✅ class (all) · ◻ subclass picker · ✅ background · ✅ alignment · ◻ faith/deity · ✅ level · ✅ XP.

**Abilities & proficiency:** ✅ six ability scores · ✅ modifiers · ✅ proficiency bonus (auto) · ✅ saving throws (auto, class-proficient) · ✅ skills (○/◐/● proficiency, auto bonus) · ✅ passive Perception/Investigation/Insight · ◻ other proficiencies (armor/weapons/tools/languages) editable from compendium.

**Combat & resources:** ✅ AC · ✅ initiative · ✅ speed · ✅ HP (cur/max/temp) · ✅ hit dice · ✅ death saves · ✅ attacks (tap to roll) · ◻ AC auto-calc from equipped armor + DEX · ◻ resources (ki/rage/etc.) tied to class.

**Features & traits:** ◻ class features auto-listed by level · ◻ racial traits auto-listed · ◻ feats from compendium · ✅ freeform features list today.

**Spellcasting:** ✅ casting ability · ✅ spell save DC · ✅ spell attack bonus · ✅ spell slots (auto from class+level) · ✅ known/prepared spells · ✅ prepared limit · ◻ ritual/concentration surfaced on the sheet.

**Equipment:** ✅ inventory (weight, value, equipped, attuned) · ✅ currency (cp/sp/ep/gp/pp) · ◻ armor/weapon objects that feed AC and attacks · ◻ **shop → buy with gold → equip** flow · ◻ drag-and-drop an owned weapon into Combat.

**Personality:** ✅ traits/ideals/bonds/flaws · ✅ appearance · ✅ backstory (Story face).

**Multi-character:** ✅ multiple saved characters per module · ✅ active-character switch in the sheet menu (syncs all linked widgets) · ✅ guided creator makes a **new** character (no longer overwrites).

---

## D. Companion-app features

- **Party Manager** *(new widget `party`)*: a roster row per character — name, race/class, level, AC, HP, passive Perception, initiative — pulling live from each character (or quick-entry for NPCs). At-a-glance table for the DM.
- **Encounter builder**: extend the existing `encounter` widget to pull monsters from the SRD/homebrew compendium and compute encounter XP vs. party thresholds (`CR_XP`, `XP_THRESHOLDS` already shipped).
- **Combat/monster creator**: `statblock` already imports SRD monsters; add a guided "create monster" form and CR estimator.
- **Initiative tracker**: existing `initiative` widget; link it to party + encounter.
- **Shop**: a `shop` view (gear/weapons/armor/magic items with prices) → buy deducts currency and adds the item to inventory → equip from inventory.

---

## E. Dice (✅ shipped v75)

- Configurable **dice pool**: tap a die to add (right-click to remove), roll any
  combination at once — e.g. `3d6`, `2d100` (percentile), `4d6+1d8`. Shows the
  per-die breakdown and total; logged to history.
- Existing: d4–d100 quick buttons, `NdX±M` formulas, advantage/disadvantage.
- **Creator ability scores** now offer **Roll dice (4d6 drop lowest ×6)** in
  addition to standard array, point buy, and manual.

---

## F. Build order (phased)

1. ✅ **v75** — multi-character + switcher, creator-creates-new, roll-for-stats, dice pool. *(this turn)*
2. **Homebrew core** — `ttbook` model, `homebrew` widget, compendium merge, per-book filters, Blossom-code sharing.
3. **Content fill — equipment side** — finish gear, add tools, mounts/vehicles, languages; finish magic items by rarity.
4. **Content fill — bestiary** — bring monsters toward the full SRD set (priority: dragons, fiends, common NPCs, golems).
5. **Sheet linking** — armor object → AC auto-calc; weapon objects → Combat attacks; class features & racial traits auto-listed; subclass picker.
6. **Shop + equip flow** — buy with gold, equip, drag-into-combat.
7. **Party Manager** widget; encounter builder pulls compendium + XP math.
8. **Content fill — spells/rules/deities/planes/poisons**; finish remaining SRD spells.
9. **Then PF2e** (separate system, per docs/13 §12e) once 5e is rich.

Work 5e and the homebrew system together; extend across multiple sessions.
