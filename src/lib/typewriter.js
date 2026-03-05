const TYPEWRITER_STATE = Symbol('typewriterState');

function isTextInput(element) {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function setText(element, text) {
  if (isTextInput(element)) {
    element.value = text;
    return;
  }
  element.textContent = text;
}

export function stopTypewriter(element) {
  if (!element) return;
  const state = element[TYPEWRITER_STATE];
  if (state && state.cancel) state.cancel();
  delete element[TYPEWRITER_STATE];
  element.classList.remove('is-switching', 'is-typing');
}

export function animateTypewriter(element, text, options = {}) {
  if (!element) return () => {};

  const {
    delay = 0,
    speed = 24,
    swap = false,
    swapDuration = 120,
    onDone = null,
  } = options;

  stopTypewriter(element);
  element.classList.add('typewriter-animated');

  let typeTimer = 0;
  let delayTimer = 0;
  let swapTimer = 0;
  let stopped = false;

  function finish() {
    if (stopped) return;
    element.classList.remove('is-typing');
    delete element[TYPEWRITER_STATE];
    if (typeof onDone === 'function') onDone();
  }

  function cancel() {
    if (stopped) return;
    stopped = true;
    clearInterval(typeTimer);
    clearTimeout(delayTimer);
    clearTimeout(swapTimer);
    element.classList.remove('is-switching', 'is-typing');
  }

  function startTyping() {
    if (stopped) return;
    element.classList.remove('is-switching');
    element.classList.add('is-typing');
    setText(element, '');

    if (!text.length) {
      finish();
      return;
    }

    let index = 0;
    typeTimer = window.setInterval(() => {
      if (stopped) return;
      index += 1;
      setText(element, text.slice(0, index));
      if (index < text.length) return;
      clearInterval(typeTimer);
      finish();
    }, speed);
  }

  function kickoff() {
    if (stopped) return;
    if (!swap) {
      startTyping();
      return;
    }
    element.classList.add('is-switching');
    swapTimer = window.setTimeout(() => {
      startTyping();
    }, swapDuration);
  }

  element[TYPEWRITER_STATE] = { cancel };

  if (delay > 0) {
    delayTimer = window.setTimeout(() => {
      kickoff();
    }, delay);
  } else {
    kickoff();
  }

  return cancel;
}
