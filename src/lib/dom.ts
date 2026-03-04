type Attrs = Record<string, string>;
type Child = HTMLElement | string;

export function el(
  tag: string,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElement {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else if (key === 'class') {
        element.className = value;
      } else if (key === 'for') {
        (element as HTMLLabelElement).htmlFor = value;
      } else {
        element.setAttribute(key, value);
      }
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }
  return element;
}

export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
): void {
  element.addEventListener(event, handler);
}

export function clear(element: HTMLElement): void {
  element.innerHTML = '';
}

export function $(selector: string, parent: HTMLElement | Document = document): HTMLElement | null {
  return parent.querySelector(selector);
}
