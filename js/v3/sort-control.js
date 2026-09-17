// Sort control (DT-7): chip + popover listbox. The native <select> could
// never render the design's caret (appearance:none on a select paints
// nothing) and read as a static label. This is the app's control-vocabulary
// version: quiet surface, live caret, keyboard parity with the native one —
// Enter/Space/ArrowDown open, arrows move, Enter selects, Esc closes,
// first-letter typeahead. createElement-only (XSS rule).
//
// A row is a native <button> (the show menu's rows now work the same way,
// app.js showMenuRow) — that is where the 44px touch floor comes from, by
// being a `button`, not by naming this control in the stylesheet. The <li>
// around it is packaging (role="presentation"); the button carries the
// option role, so the popover keeps its listbox presentation. Focus stays on
// the chip throughout (roving highlight + aria-activedescendant, unchanged) —
// a row is a tap target, not a second place the keyboard has to visit.

const OPTIONS = [
  { value: 'billing', label: 'Billing' },
  { value: 'az', label: 'A → Z' },
  { value: 'mine', label: 'My picks' },
  { value: 'crew', label: 'Most picked' },  // vocabulary is picked/must/notes/fest — never 'favorites'
];

export function createSortControl({ initial = 'billing', onChange }) {
  let value = initial;
  let open = false;
  let activeIdx = OPTIONS.findIndex((o) => o.value === value);

  const wrap = document.createElement('span');
  wrap.className = 'sort-wrap';

  const chip = document.createElement('button');
  chip.className = 'sort-chip';
  chip.setAttribute('aria-haspopup', 'listbox');
  chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('aria-label', 'Sort artists');
  const labelSpan = document.createElement('span');
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = '▾';
  caret.setAttribute('aria-hidden', 'true');
  chip.append(labelSpan, caret);

  const pop = document.createElement('ul');
  pop.className = 'sort-pop';
  pop.setAttribute('role', 'listbox');
  pop.setAttribute('aria-label', 'Sort artists');
  pop.style.display = 'none';

  const items = OPTIONS.map((opt, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    const row = document.createElement('button');
    row.type = 'button';
    row.setAttribute('role', 'option');
    row.id = `sort-opt-${opt.value}`;
    // Kept out of the tab order on purpose: the chip owns real focus (roving
    // highlight + aria-activedescendant, below), so a row is reachable by
    // pointer/touch tap and by the chip's own arrow keys, not by Tab.
    row.tabIndex = -1;
    const check = document.createElement('span');
    check.className = 'check';
    const text = document.createElement('span');
    text.textContent = opt.label;
    row.append(check, text);
    row.addEventListener('click', () => select(i));
    li.appendChild(row);
    return row;
  });
  pop.append(...items.map((row) => row.parentElement));

  function paint() {
    labelSpan.textContent = OPTIONS.find((o) => o.value === value).label;
    items.forEach((btn, i) => {
      const selected = OPTIONS[i].value === value;
      btn.setAttribute('aria-selected', String(selected));
      btn.firstChild.textContent = selected ? '✓' : '';
      btn.classList.toggle('kb-active', open && i === activeIdx);
    });
    chip.setAttribute('aria-expanded', String(open));
    pop.style.display = open ? '' : 'none';
    if (open) pop.setAttribute('aria-activedescendant', items[activeIdx].id);
  }

  function setOpen(next) {
    open = next;
    if (open) activeIdx = OPTIONS.findIndex((o) => o.value === value);
    paint();
    if (open) {
      // Viewport collision (audit 2.1): the popover is right-anchored by
      // default, but when the chip sits near the LEFT edge (390px wraps the
      // toolbar) that pushes most of the menu off-canvas — and body
      // overflow-x:clip makes it unreachable. Flip to left-anchored when it
      // would spill.
      pop.style.right = '';
      pop.style.left = '';
      const r = pop.getBoundingClientRect();
      if (r.left < 8) { pop.style.right = 'auto'; pop.style.left = '0'; }
    }
  }

  function select(i) {
    const next = OPTIONS[i].value;
    setOpen(false);
    chip.focus();
    if (next !== value) {
      value = next;
      paint();
      onChange(value);
    }
  }

  chip.addEventListener('click', () => setOpen(!open));
  chip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      // The first arrow press OPENS and highlights the current choice — it
      // must not also advance past it (Codex ship gate, P2).
      if (!open) { setOpen(true); return; }
    }
    if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
    if (open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(activeIdx); return; }
    if (open && e.key === 'ArrowDown') { activeIdx = (activeIdx + 1) % OPTIONS.length; paint(); }
    if (open && e.key === 'ArrowUp') { activeIdx = (activeIdx - 1 + OPTIONS.length) % OPTIONS.length; paint(); }
    if (open && /^[a-z]$/i.test(e.key)) {
      const hit = OPTIONS.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (hit >= 0) { activeIdx = hit; paint(); }
    }
  });
  document.addEventListener('click', (e) => { if (open && !wrap.contains(e.target)) setOpen(false); });
  // Tabbing away closes the popover too — a click elsewhere isn't the only
  // way focus leaves. A row click moves focus to that row and then, inside
  // select(), back to the chip — both stops are inside `wrap`, so this
  // handler stays quiet for it; by the time either fires `open` is already
  // false.
  wrap.addEventListener('focusout', (e) => {
    if (open && !wrap.contains(e.relatedTarget)) setOpen(false);
  });

  wrap.append(chip, pop);
  paint();
  return {
    el: wrap,
    get value() { return value; },
  };
}
