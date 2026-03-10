import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { sendMessage, getChatHistory } from '../lib/api.js';

export function createChat(parent, options = {}) {
  const { initialScrollTop } = options;
  const hasInitialScroll = Number.isFinite(initialScrollTop);
  const log = el('div', { class: 'chat-log' });
  const input = el('input', { class: 'input', type: 'text', placeholder: 'Type a message...' });
  const sendBtn = el('button', { class: 'btn' }, 'Send');
  const row = el('div', { class: 'chat-input-row' }, input, sendBtn);
  const wrapper = el('div', { class: 'chat-panel' }, log, row);
  parent.appendChild(wrapper);

  function appendMessage(role, content, autoScroll = true) {
    const cls = role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg chat-msg--twin';
    log.appendChild(el('div', { class: cls }, content));
    if (autoScroll) {
      log.scrollTop = log.scrollHeight;
    }
  }

  function renderMessages() {
    clear(log);
    for (const msg of store.messages) {
      appendMessage(msg.role, msg.content, false);
    }
    if (hasInitialScroll) {
      log.scrollTop = initialScrollTop;
    } else {
      log.scrollTop = log.scrollHeight;
    }
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;

    store.messages.push({ role: 'user', content: text });
    appendMessage('user', text);
    input.value = '';
    sendBtn.setAttribute('disabled', '');
    input.setAttribute('disabled', '');

    // Show typing indicator
    const typing = el('div', { class: 'chat-msg chat-msg--twin chat-msg--typing' }, '...');
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    try {
      if (!store.user) throw new Error('Not signed in');
      const data = await sendMessage(text);
      const reply = data.response || "I'm not sure how to respond to that.";
      store.messages.push({ role: 'twin', content: reply });
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      appendMessage('twin', reply);
    } catch (err) {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      const msg = err.message.includes('Authorization') || err.message.includes('signed in')
        ? 'Please sign in to chat. Go to Settings and sign out, then sign back in.'
        : `Error: ${err.message}`;
      appendMessage('twin', msg);
    }

    sendBtn.removeAttribute('disabled');
    input.removeAttribute('disabled');
    input.focus();
  }

  on(sendBtn, 'click', send);
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter') send();
  });

  // Load chat history from backend
  if (store.user) {
    getChatHistory()
      .then((messages) => {
        if (Array.isArray(messages) && messages.length > 0) {
          store.messages = messages.map((m) => ({
            role: m.role === 'assistant' ? 'twin' : m.role,
            content: m.content,
          }));
          renderMessages();
        }
      })
      .catch(() => {
        // Silently fail — just start fresh
      });
  }

  renderMessages();

  return { scrollEl: log };
}
