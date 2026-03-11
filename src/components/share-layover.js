import { saveOwnerReferenceName } from '../lib/api.js';
import { clear, el, on } from '../lib/dom.js';
import {
  buildPublicShareUrl,
  canUseNativeShare,
  createShareCard,
  prepareShareTarget,
  shareToChannel,
} from '../lib/share.js';

const SHARE_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: whatsappIcon },
  { id: 'x', label: 'X', icon: xIcon },
  { id: 'messages', label: 'Messages', icon: messagesIcon },
  { id: 'instagram', label: 'Instagram', icon: instagramIcon },
  { id: 'more', label: 'More apps', icon: moreIcon },
  { id: 'copy', label: 'Copy link', icon: copyIcon },
];

function svgIcon(paths, viewBox = '0 0 24 24') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('share-icon');
  svg.innerHTML = paths;
  return svg;
}

function filledSvgIcon(paths, viewBox = '0 0 24 24') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('share-icon');
  svg.innerHTML = paths;
  return svg;
}

function whatsappIcon() {
  return filledSvgIcon(
    '<path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>',
  );
}

function xIcon() {
  return filledSvgIcon(
    '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
  );
}

function messagesIcon() {
  return svgIcon(
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  );
}

function instagramIcon() {
  return svgIcon(
    '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
  );
}

function moreIcon() {
  return svgIcon(
    '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  );
}

function copyIcon() {
  return svgIcon(
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  );
}

export function openShareLayover(parent, {
  agentId,
  twinName,
  ownerReferenceName,
  ownerReferenceFallback = '',
  anchor = null,
}) {
  const safeTwinName = twinName && twinName.trim() ? twinName.trim() : 'your twin';
  const panel = el('div', {
    class: 'share-dropdown',
    role: 'dialog',
    'aria-modal': 'false',
    'aria-labelledby': 'share-sheet-title',
  });
  const wrapper = el('div', { class: 'share-dropdown-wrap' }, panel);
  const heading = el('span', { class: 'bold share-sheet__title', id: 'share-sheet-title' }, 'Share');
  const closeBtn = el('button', {
    class: 'share-sheet__close',
    type: 'button',
    'aria-label': 'Close',
  });
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const header = el('div', { class: 'share-sheet__header' }, heading, closeBtn);
  const status = el('p', {
    class: 'secondary text-sm share-sheet__status',
    'aria-live': 'polite',
  });
  const body = el('div', { class: 'share-sheet__body' });

  panel.append(header, body, status);

  if (anchor) {
    anchor.parentElement.style.position = 'relative';
    anchor.parentElement.appendChild(wrapper);
  } else {
    parent.appendChild(wrapper);
  }

  let resolved = false;
  let resultResolver = () => {};
  let busy = false;
  let currentOwnerReferenceName = normalizeValue(ownerReferenceName);
  let ownerDraft = currentOwnerReferenceName || normalizeValue(ownerReferenceFallback);
  let view = currentOwnerReferenceName ? 'quick' : 'owner';
  let focusTarget = null;
  let shareCache = {
    quick: null,
    personal: null,
    personalKey: '',
  };
  const personalDraft = {
    recipientName: '',
    sharePrompt: '',
  };

  function teardown(result) {
    if (resolved) return;
    resolved = true;
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    window.setTimeout(() => {
      wrapper.remove();
      resultResolver(result);
    }, 250);
  }

  function setStatus(message = '') {
    status.textContent = message;
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    render();
  }

  function getQuickPreview() {
    const ownerName = currentOwnerReferenceName || ownerDraft || 'my human';
    return `Hi, I'm ${safeTwinName}, ${ownerName}'s twin.`;
  }

  function getPersonalPreview() {
    const recipient = personalDraft.recipientName.trim() || 'there';
    const prompt = personalDraft.sharePrompt.trim() || 'I wanted to share my twin with you.';
    return `Hi ${recipient}, I'm ${safeTwinName}, ${(currentOwnerReferenceName || ownerDraft || 'my human')}'s twin. ${prompt}`;
  }

  function getPersonalKey() {
    return JSON.stringify({
      recipientName: personalDraft.recipientName.trim(),
      sharePrompt: personalDraft.sharePrompt.trim(),
    });
  }

  async function ensureSharePayload(mode) {
    if (mode === 'quick' && shareCache.quick) {
      return shareCache.quick;
    }

    const personalKey = getPersonalKey();
    if (mode === 'personal' && shareCache.personal && shareCache.personalKey === personalKey) {
      return shareCache.personal;
    }

    const shareRecord = await createShareCard({
      agentId,
      twinName: safeTwinName,
      shareMode: mode,
      recipientName: mode === 'personal' ? personalDraft.recipientName.trim() : null,
      sharePrompt: mode === 'personal' ? personalDraft.sharePrompt.trim() : null,
    });

    const payload = {
      title: `${shareRecord.twinName || safeTwinName} on CyberTwin`,
      text: shareRecord.personalMessage || (mode === 'quick' ? getQuickPreview() : getPersonalPreview()),
      url: buildPublicShareUrl(shareRecord.token),
    };

    if (mode === 'quick') {
      shareCache.quick = payload;
    } else {
      shareCache.personal = payload;
      shareCache.personalKey = personalKey;
    }

    return payload;
  }

  async function handleOwnerSave() {
    const nextName = normalizeValue(ownerDraft);
    if (!nextName) {
      setStatus('Please tell your twin how to address you.');
      render();
      return;
    }

    setStatus('Saving...');
    setBusy(true);

    try {
      currentOwnerReferenceName = await saveOwnerReferenceName(nextName);
      ownerDraft = currentOwnerReferenceName;
      view = 'quick';
      setStatus('Saved.');
    } catch (err) {
      setStatus(err.message || 'Could not save that name.');
    } finally {
      setBusy(false);
    }
  }

  async function handleShare(channel) {
    if (busy) return;
    const mode = view === 'personal-targets' ? 'personal' : 'quick';
    const preparedTarget = prepareShareTarget(channel);

    setBusy(true);
    try {
      if (channel === 'instagram' && canUseNativeShare()) {
        setStatus('Choose Instagram in the next share sheet.');
      } else if (channel !== 'copy') {
        setStatus('Preparing your link...');
      }

      const payload = await ensureSharePayload(mode);
      const result = await shareToChannel(channel, payload, { preparedTarget });
      setStatus(result.message || '');
    } catch (err) {
      if (preparedTarget && !preparedTarget.closed) {
        preparedTarget.close();
      }
      if (err?.name === 'AbortError') {
        setStatus('');
      } else {
        setStatus(err?.message || 'Could not share your twin.');
      }
    } finally {
      setBusy(false);
    }
  }

  function createChannelGrid() {
    const grid = el('div', { class: 'share-sheet__grid' });

    for (const channel of SHARE_CHANNELS) {
      const icon = channel.icon();
      const button = el('button', {
        class: 'share-sheet__channel',
        type: 'button',
        'aria-label': channel.label,
        title: channel.label,
      });
      button.appendChild(icon);

      if (busy) {
        button.setAttribute('disabled', '');
      }

      on(button, 'click', () => {
        handleShare(channel.id);
      });
      grid.appendChild(button);

      if (!focusTarget) focusTarget = button;
    }

    return grid;
  }

  function renderOwnerView() {
    const field = el('div', { class: 'share-sheet__field' });
    const label = el('label', { class: 'bold', for: 'share-owner-name' }, 'How should your twin call you?');
    const hint = el(
      'p',
      { class: 'secondary text-sm' },
      'This is used in shared messages and can be changed later in settings.',
    );
    const input = el('input', {
      id: 'share-owner-name',
      class: 'input share-sheet__input',
      type: 'text',
      value: ownerDraft,
    });
    const actions = el('div', { class: 'share-sheet__actions' });
    const saveBtn = el('button', {
      class: 'btn',
      type: 'button',
    }, busy ? 'Saving...' : 'Continue');
    if (busy) saveBtn.setAttribute('disabled', '');

    on(input, 'input', () => {
      ownerDraft = input.value;
      setStatus('');
    });
    on(input, 'keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleOwnerSave();
      }
    });
    on(saveBtn, 'click', handleOwnerSave);

    field.append(label, hint, input);
    actions.appendChild(saveBtn);
    body.append(field, actions);
    focusTarget = input;
  }

  function renderQuickView() {
    const personalBtn = el('button', {
      class: 'share-sheet__personal-cta text-sm',
      type: 'button',
    }, 'personalise message');
    if (busy) personalBtn.setAttribute('disabled', '');
    on(personalBtn, 'click', () => {
      if (busy) return;
      setStatus('');
      view = 'personal-form';
      render();
    });

    body.append(createChannelGrid(), personalBtn);
  }

  function renderPersonalForm() {
    const intro = el(
      'p',
      { class: 'secondary text-sm share-sheet__intro' },
      'Add a personal note before choosing a share target.',
    );
    const recipientField = el('div', { class: 'share-sheet__field' });
    const recipientLabel = el('label', { class: 'bold', for: 'share-recipient-name' }, 'Recipient name');
    const recipientInput = el('input', {
      id: 'share-recipient-name',
      class: 'input share-sheet__input',
      type: 'text',
      value: personalDraft.recipientName,
    });
    recipientField.append(recipientLabel, recipientInput);

    const promptField = el('div', { class: 'share-sheet__field' });
    const promptLabel = el('label', { class: 'bold', for: 'share-personal-prompt' }, 'What should I tell them?');
    const promptInput = el('textarea', {
      id: 'share-personal-prompt',
      class: 'input share-sheet__textarea',
      rows: '5',
    });
    promptInput.value = personalDraft.sharePrompt;
    promptField.append(promptLabel, promptInput);

    const actions = el('div', { class: 'share-sheet__actions' });
    const backBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Back');
    const continueBtn = el('button', { class: 'btn', type: 'button' }, 'Choose share target');

    on(recipientInput, 'input', () => {
      personalDraft.recipientName = recipientInput.value;
      setStatus('');
    });
    on(promptInput, 'input', () => {
      personalDraft.sharePrompt = promptInput.value;
      shareCache.personal = null;
      shareCache.personalKey = '';
      setStatus('');
    });
    on(backBtn, 'click', () => {
      setStatus('');
      view = 'quick';
      render();
    });
    on(continueBtn, 'click', () => {
      personalDraft.recipientName = recipientInput.value;
      personalDraft.sharePrompt = promptInput.value;

      if (!personalDraft.recipientName.trim() || !personalDraft.sharePrompt.trim()) {
        setStatus('Please complete both fields.');
        return;
      }

      setStatus('');
      view = 'personal-targets';
      render();
    });

    actions.append(backBtn, continueBtn);
    body.append(intro, recipientField, promptField, actions);
    focusTarget = recipientInput;
  }

  function renderPersonalTargets() {
    const editBtn = el('button', { class: 'share-sheet__personal-cta text-sm', type: 'button' }, 'edit message');
    on(editBtn, 'click', () => {
      setStatus('');
      view = 'personal-form';
      render();
    });

    body.append(createChannelGrid(), editBtn);
  }

  function render() {
    clear(body);
    focusTarget = null;
    if (busy) {
      closeBtn.setAttribute('disabled', '');
    } else {
      closeBtn.removeAttribute('disabled');
    }

    switch (view) {
      case 'owner':
        renderOwnerView();
        break;
      case 'personal-form':
        renderPersonalForm();
        break;
      case 'personal-targets':
        renderPersonalTargets();
        break;
      default:
        renderQuickView();
        break;
    }

    window.requestAnimationFrame(() => {
      if (focusTarget) focusTarget.focus();
    });
  }

  function handleOutsideClick(event) {
    if (!panel.contains(event.target) && !(anchor && anchor.contains(event.target))) {
      if (busy) return;
      dismiss();
    }
  }
  function handleEscape(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (busy) return;
      dismiss();
    }
  }
  function dismiss() {
    document.removeEventListener('mousedown', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape);
    teardown(null);
  }

  on(closeBtn, 'click', () => {
    if (busy) return;
    dismiss();
  });

  document.addEventListener('mousedown', handleOutsideClick);
  document.addEventListener('keydown', handleEscape);

  window.requestAnimationFrame(() => {
    panel.classList.add('is-visible');
    render();
  });

  const promise = new Promise((resolve) => {
    resultResolver = resolve;
  });
  return { promise, close: dismiss };
}

function normalizeValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
