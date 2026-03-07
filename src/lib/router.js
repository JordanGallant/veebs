const routes = new Map();
let currentCleanup;
let container;
let asciiLayer;

export function registerScreen(name, route) {
  routes.set(name, route);
}

export function navigate(screen) {
  window.location.hash = screen;
}

export function getAsciiLayer() {
  return asciiLayer;
}

function getScreenFromHash() {
  const hash = window.location.hash.replace('#', '');
  return routes.has(hash) ? hash : 'welcome';
}

async function render() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = undefined;
  }

  const screen = getScreenFromHash();
  const route = routes.get(screen);
  if (!route) return;

  container.innerHTML = '';
  await route.render(container);
  currentCleanup = route.cleanup;
}

export function initRouter(screenEl, asciiEl) {
  container = screenEl;
  asciiLayer = asciiEl;
  window.addEventListener('hashchange', () => render());
  render();
}
