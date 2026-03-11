import { el } from '../lib/dom.js';

export function createShareCardElement({ twinName, imageSrc, personalMessage, ctaUrl }) {
  const safeName = twinName && twinName.trim() ? twinName.trim() : 'Unnamed Twin';
  const safeMessage = personalMessage && personalMessage.trim()
    ? personalMessage.trim()
    : `Hi. I'm ${safeName}.`;

  const media = imageSrc
    ? el('img', {
      class: 'share-card__image',
      src: imageSrc,
      alt: `${safeName} profile picture`,
      loading: 'eager',
      decoding: 'async',
    })
    : createShareCardPlaceholder();

  return el(
    'article',
    { class: 'share-card' },
    el('h1', { class: 'share-card__title' }, safeName),
    el('div', { class: 'share-card__media' }, media),
    el('p', { class: 'share-card__message' }, safeMessage),
    el('a', { class: 'btn share-card__cta', href: ctaUrl }, 'create your own twin'),
  );
}

function createShareCardPlaceholder() {
  return el(
    'div',
    { class: 'share-card__placeholder', 'aria-hidden': 'true' },
    el('div', { class: 'share-card__placeholder-head' }),
    el('div', { class: 'share-card__placeholder-body' }),
  );
}
