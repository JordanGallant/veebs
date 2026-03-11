export function getThemeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
