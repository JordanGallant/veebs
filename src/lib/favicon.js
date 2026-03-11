import { getThemeColor } from './colors.js';

export function initFavicon() {
  const bg = getThemeColor('--color-bg') || '#c6c6f1';
  const fg = getThemeColor('--color-fg') || '#2b2927';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="4" fill="${bg}"/>

      <circle cx="10" cy="7.2" r="3.1" fill="${fg}"/>
      <path d="M7.1 11h5.8l2.3 4.8-1.8 0.9-1.5-3.1v10.9H9.7V13.6l-1.5 3.1-1.8-0.9z" fill="${fg}"/>

      <circle cx="22" cy="7.2" r="3.1" fill="${fg}"/>
      <path d="M19.1 11h5.8l2.3 4.8-1.8 0.9-1.5-3.1v10.9h-2.2V13.6l-1.5 3.1-1.8-0.9z" fill="${fg}"/>

      <rect x="14.2" y="15.8" width="3.6" height="1.8" rx="0.9" fill="${fg}"/>
    </svg>
  `.replace(/\s+/g, ' ').trim();
  const dataUri = 'data:image/svg+xml,' + encodeURIComponent(svg);

  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = dataUri;
}
