import { el, on } from '../lib/dom.js';
import { animateTypewriter } from '../lib/typewriter.js';

export function openShareLayover(parent, { twinName }) {
  const safeTwinName = twinName && twinName.trim() ? twinName.trim() : 'your twin';
  const panel = el('div', { class: 'overlay-panel overlay-panel--compact overlay-shell recording-panel share-layover-panel' });
  const overlay = el('div', { class: 'share-layover' }, panel);
  const heading = el('h1', { class: 'text-lg bold recording-heading' }, '');
  const closeBtn = el('button', {
    class: 'share-layover-close',
    type: 'button',
    'aria-label': 'Close share dialog',
    title: 'Close',
  }, '×');
  const headingRow = el('div', { class: 'recording-heading-row' }, heading, closeBtn);
  const input = el('textarea', {
    class: 'input question-textarea',
    placeholder: '',
  });
  const status = el('p', { class: 'secondary text-sm share-layover-status' });
  const actionBtn = el('button', { class: 'btn', type: 'button' }, 'Next');
  const controls = el('div', { class: 'rec-controls rec-controls--compact' }, actionBtn);

  panel.append(headingRow, input, status, controls);
  parent.appendChild(overlay);

  const prompts = [
    () => 'with whom do you wanna share me?',
    (recipientName) => `what should i tell ${recipientName}?`,
  ];

  let stopHeadingType = null;
  let step = 0;
  let recipientName = '';
  let sharePrompt = '';
  let resolved = false;

  function typeHeading(text, swap) {
    if (stopHeadingType) stopHeadingType();
    stopHeadingType = animateTypewriter(heading, text, {
      speed: 20,
      swap,
      swapDuration: 120,
    });
  }

  function teardown(result) {
    if (resolved) return;
    resolved = true;
    if (stopHeadingType) stopHeadingType();
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    window.setTimeout(() => {
      overlay.remove();
      resultResolver(result);
    }, 220);
  }

  function updateStep(nextStep) {
    step = nextStep;
    status.textContent = '';
    actionBtn.textContent = step === 0 ? 'Next' : 'Create link';

    if (step === 0) {
      input.value = recipientName;
      input.placeholder = 'Type a name...';
      typeHeading(prompts[0](), true);
    } else {
      input.value = sharePrompt;
      input.placeholder = `A short message from ${safeTwinName}...`;
      typeHeading(prompts[1](recipientName), true);
    }
    window.requestAnimationFrame(() => input.focus());
  }

  function handleSubmit() {
    const value = input.value.trim();
    if (!value) {
      status.textContent = 'Please type a response.';
      return;
    }

    if (step === 0) {
      recipientName = value;
      updateStep(1);
      return;
    }

    sharePrompt = value;
    teardown({
      recipientName,
      sharePrompt,
    });
  }

  on(actionBtn, 'click', handleSubmit);
  on(closeBtn, 'click', () => teardown(null));
  on(overlay, 'click', (event) => {
    if (event.target === overlay) teardown(null);
  });
  on(input, 'keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      teardown(null);
      return;
    }
    if ((event.key === 'Enter' && (event.metaKey || event.ctrlKey)) || (event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault();
      handleSubmit();
    }
  });

  window.requestAnimationFrame(() => {
    panel.classList.add('is-visible');
    typeHeading(prompts[0](), false);
    input.placeholder = 'Type a name...';
    input.focus();
  });

  let resultResolver = () => {};
  return new Promise((resolve) => {
    resultResolver = resolve;
  });
}
