// Sort control (DT-7): chip + popover listbox. The native <select> could
// never render the design's caret (appearance:none on a select paints
// nothing) and read as a static label. This is the app's control-vocabulary
// version: quiet surface, live caret, keyboard parity with the native one —
// Enter/Space/ArrowDown open, arrows move, Enter selects, Esc closes,
// first-letter typeahead. createElement-only (XSS rule).

const OPTIONS = [
  { value: 'billing', label: 'Billing' },
  { value: 'az', label: 'A → Z' },
  { value: 'mine', label: 'My picks' },
  { value: 'crew', label: 'Crew favorites' },
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
    li.setAttribute('role', 'option');
    li.id = `sort-opt-${opt.value}`;
    const check = document.createElement('span');
    check.className = 'check';
    const text = document.createElement('span');
    text.textContent = opt.label;
    li.append(check, text);
    li.addEventListener('click', () => select(i));
    return li;
  });
  pop.append(...items);

  function paint() {
    labelSpan.textContent = OPTIONS.find((o) => o.value === value).label;
    items.forEach((li, i) => {
      const selected = OPTIONS[i].value === value;
      li.setAttribute('aria-selected', String(selected));
      li.firstChild.textContent = selected ? '✓' : '';
      li.classList.toggle('kb-active', open && i === activeIdx);
    });
    chip.setAttribute('aria-expanded', String(open));
    pop.style.display = open ? '' : 'none';
    if (open) pop.setAttribute('aria-activedescendant', items[activeIdx].id);
  }

  function setOpen(next) {
    open = next;
    if (open) activeIdx = OPTIONS.findIndex((o) => o.value === value);
    paint();
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
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
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

  wrap.append(chip, pop);
  paint();
  return {
    el: wrap,
    get value() { return value; },
  };
}
