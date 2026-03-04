export function el(tag, attrs, ...children) {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else if (key === 'class') {
        element.className = value;
      } else if (key === 'for') {
        element.setAttribute('for', value);
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

export function on(element, event, handler) {
  element.addEventListener(event, handler);
}

export function clear(element) {
  element.innerHTML = '';
}
