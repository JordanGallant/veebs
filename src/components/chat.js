import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { sendMessage, getChatHistory, speakText } from '../lib/api.js';

let currentAudio = null;

export function createChat(parent, options = {}) {
  const { initialScrollTop } = options;
  const hasInitialScroll = Number.isFinite(initialScrollTop);
  const log = el('div', { class: 'chat-log' });
  const input = el('input', { class: 'input', type: 'text', placeholder: 'Type a message...', maxlength: '2000' });
  const sendBtn = el('button', { class: 'btn' }, 'Send');
  const row = el('div', { class: 'chat-input-row' }, input, sendBtn);
  const wrapper = el('div', { class: 'chat-panel' }, log, row);
  parent.appendChild(wrapper);

  function appendMessage(role, content, extras = {}, autoScroll = true) {
    const cls = role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg chat-msg--twin';
    const msgEl = el('div', { class: cls });

    const textEl = el('span', null, content);
    msgEl.appendChild(textEl);

    // Speak button for agent messages
    if (role !== 'user' && content && !content.startsWith('Error:')) {
      const speakBtn = el('button', {
        class: 'chat-speak-btn',
        type: 'button',
        title: 'Listen',
        'aria-label': 'Listen to message',
      }, '\u{1F50A}');

      let speaking = false;

      on(speakBtn, 'click', async () => {
        // Stop current audio if playing
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }

        if (speaking) {
          speaking = false;
          speakBtn.textContent = '\u{1F50A}';
          return;
        }

        speaking = true;
        speakBtn.textContent = '...';

        try {
          const voice = await speakText(content);
          if (!voice.voice_memo_url) throw new Error('No audio');

          const audio = new Audio(voice.voice_memo_url);
          currentAudio = audio;

          audio.addEventListener('ended', () => {
            speaking = false;
            speakBtn.textContent = '\u{1F50A}';
            if (currentAudio === audio) currentAudio = null;
          });

          audio.addEventListener('error', () => {
            speaking = false;
            speakBtn.textContent = '\u{1F50A}';
            if (currentAudio === audio) currentAudio = null;
          });

          await audio.play();
          speakBtn.textContent = '\u{23F9}';
        } catch {
          speaking = false;
          speakBtn.textContent = '\u{1F50A}';
        }
      });

      msgEl.appendChild(speakBtn);
    }

    // Tool calls
    if (Array.isArray(extras.toolCalls) && extras.toolCalls.length > 0) {
      const toolsWrap = el('div', { class: 'chat-tool-calls' });
      for (const tc of extras.toolCalls) {
        const details = el('details', { class: 'chat-tool-call' });
        const summary = el('summary', null, `Used: ${tc.name || 'tool'}`);
        const pre = el('pre', null, tc.arguments || tc.input || JSON.stringify(tc, null, 2));
        details.append(summary, pre);
        toolsWrap.appendChild(details);
      }
      msgEl.appendChild(toolsWrap);
    }

    // Products
    if (Array.isArray(extras.products) && extras.products.length > 0) {
      const productsWrap = el('div', { class: 'chat-products' });
      for (const p of extras.products) {
        const card = el('div', { class: 'chat-product-card' },
          el('span', { class: 'bold' }, p.name || 'Product'),
          p.price ? el('span', null, ` — ${p.price}`) : '',
        );
        productsWrap.appendChild(card);
      }
      msgEl.appendChild(productsWrap);
    }

    log.appendChild(msgEl);
    if (autoScroll) log.scrollTop = log.scrollHeight;
  }

  function renderMessages() {
    clear(log);
    for (const msg of store.messages) {
      appendMessage(msg.role, msg.content, msg.extras || {}, false);
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

    const typing = el('div', { class: 'chat-msg chat-msg--twin chat-msg--typing' }, '...');
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    try {
      if (!store.user) throw new Error('Not signed in');
      const data = await sendMessage(text);
      const reply = data.response || "I'm not sure how to respond to that.";
      const extras = {
        toolCalls: data.toolCalls || [],
        products: data.products || [],
      };
      store.messages.push({ role: 'twin', content: reply, extras });
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      appendMessage('twin', reply, extras);
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
      .catch(() => {});
  }

  renderMessages();

  return { scrollEl: log };
}
