import { el, on } from '../lib/dom.js';
import { store, notify } from '../lib/store.js';

const TRAIT_NAMES = ['Creativity', 'Humor', 'Formality', 'Energy', 'Empathy'];

export function createCharacter(parent: HTMLElement): () => void {
  const heading = el('p', { class: 'secondary text-sm', style: 'padding-bottom:var(--space-sm)' },
    'Adjust the personality traits of your twin.',
  );

  const wrapper = el('div', { class: 'tab-content', style: 'gap:var(--space-xs)' }, heading);

  for (const name of TRAIT_NAMES) {
    const value = store.traits[name] ?? 50;

    const label = el('label', { for: `trait-${name}` }, name);

    const range = document.createElement('input');
    range.type = 'range';
    range.id = `trait-${name}`;
    range.min = '0';
    range.max = '100';
    range.value = String(value);

    const valueDisplay = el('span', { class: 'trait-value' }, String(value));

    on(range, 'input', () => {
      const v = parseInt(range.value, 10);
      store.traits[name] = v;
      valueDisplay.textContent = String(v);
      notify();
    });

    const row = el('div', { class: 'trait-row' }, label, range, valueDisplay);
    wrapper.appendChild(row);
  }

  parent.appendChild(wrapper);

  return () => {};
}
