export function getThemeColor(name: '--color-bg' | '--color-fg'): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function initFavicon(): void {
  const bg = getThemeColor('--color-bg');
  const fg = getThemeColor('--color-fg');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="${bg}"/><text x="16" y="24" text-anchor="middle" font-size="22" fill="${fg}">C</text></svg>`;
  const dataUri = 'data:image/svg+xml,' + encodeURIComponent(svg);

  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = dataUri;
}
