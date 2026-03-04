export type Screen = 'welcome' | 'recording' | 'birthing' | 'dashboard';

type RenderFn = (container: HTMLElement) => void | Promise<void>;
type CleanupFn = () => void;

interface Route {
  render: RenderFn;
  cleanup?: CleanupFn;
}

const routes = new Map<Screen, Route>();
let currentCleanup: CleanupFn | undefined;
let container: HTMLElement;

export function registerScreen(name: Screen, route: Route): void {
  routes.set(name, route);
}

export function navigate(screen: Screen): void {
  window.location.hash = screen;
}

function getScreenFromHash(): Screen {
  const hash = window.location.hash.replace('#', '') as Screen;
  return routes.has(hash) ? hash : 'welcome';
}

async function render(): Promise<void> {
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

export function initRouter(appEl: HTMLElement): void {
  container = appEl;
  window.addEventListener('hashchange', () => render());
  render();
}
