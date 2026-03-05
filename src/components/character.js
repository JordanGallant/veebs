import { el, on } from '../lib/dom.js';
import { store } from '../lib/store.js';

export function createCharacter(parent) {
  const heading = el('p', { class: 'secondary text-sm', style: 'padding-bottom:var(--space-sm)' },
    'Describe your twin in natural English. This text guides how your twin behaves.',
  );

  const label = el('label', { for: 'character-profile', class: 'text-sm secondary' }, 'Character profile');
  const editor = document.createElement('textarea');
  editor.id = 'character-profile';
  editor.className = 'input character-profile';
  editor.rows = 9;
  editor.value = store.characterProfile;
  editor.setAttribute('aria-label', 'Character profile text');

  on(editor, 'input', () => {
    store.characterProfile = editor.value;
  });

  const wrapper = el('div', { class: 'character-editor', style: 'display:flex;flex-direction:column;gap:var(--space-sm)' }, heading, label, editor);

  parent.appendChild(wrapper);
}
