import { el, clear } from '../lib/dom.js';
import { registerScreen } from '../lib/router.js';
import { buildWelcomeUrl, fetchSharedCard } from '../lib/share.js';
import { createShareCardElement } from '../components/share-card.js';

export function registerShare() {
  registerScreen('share', {
    render,
  });
}

async function render(container) {
  const shell = el('div', { class: 'screen share-screen' });
  const frame = el('div', { class: 'share-screen__frame' });
  const status = el('p', { class: 'share-screen__status secondary' }, 'Loading shared card...');

  frame.appendChild(status);
  shell.appendChild(frame);
  container.appendChild(shell);

  const token = getShareToken();
  if (!token) {
    clear(frame);
    frame.appendChild(createShareErrorState('This shared card link is incomplete.'));
    return;
  }

  try {
    const card = await fetchSharedCard(token);
    clear(frame);
    frame.appendChild(createShareCardElement({
      twinName: card.twinName,
      imageSrc: card.imageUrl || '',
      personalMessage: card.personalMessage || '',
      ctaUrl: buildWelcomeUrl(),
    }));
  } catch (err) {
    clear(frame);
    frame.appendChild(createShareErrorState(err.message || 'Could not load this shared card.'));
  }
}

function createShareErrorState(message) {
  return el(
    'div',
    { class: 'share-screen__empty' },
    el('p', { class: 'bold' }, 'Shared card unavailable'),
    el('p', { class: 'secondary' }, message),
    el('a', { class: 'btn', href: buildWelcomeUrl() }, 'Create your own CyberTwin.'),
  );
}

function getShareToken() {
  const pathMatch = window.location.pathname.match(/^\/share\/([^/]+)$/);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

  const [, query = ''] = window.location.hash.split('?');
  return new URLSearchParams(query).get('token');
}
