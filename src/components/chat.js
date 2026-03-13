import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { sendMessage, getChatHistory, loadVoiceRef, uploadVoiceMemo, getVoiceMemoUrl } from '../lib/api.js';
import { generateSpeech } from '../lib/tts-api.js';
import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

function getSleepingReplyName() {
  const preferredName = store.ownerReferenceName
    || store.ownerReferenceFallbackName
    || store.user?.user_metadata?.display_name
    || store.name;
  const trimmedName = typeof preferredName === 'string' ? preferredName.trim() : '';
  return trimmedName || 'friend';
}

async function generateVoiceNote(text, messageId) {
  await loadVoiceRef();

  if (!store.voiceRefAudioBlob || !store.voiceTranscript) {
    return null;
  }

  const wavBlob = await generateSpeech(text, {
    refAudioBlob: store.voiceRefAudioBlob,
    refText: store.voiceTranscript,
  });

  // Upload to Supabase and link to chat message
  uploadVoiceMemo(store.agentId, wavBlob, messageId).catch((err) => {
    console.warn('Voice memo upload failed:', err.message);
  });

  return wavBlob;
}

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

    const textEl = document.createElement(role === 'user' ? 'span' : 'div');
    if (role === 'user') {
      textEl.appendChild(document.createTextNode(content));
    } else {
      textEl.className = 'chat-markdown';
      textEl.innerHTML = marked.parse(content || '');
      textEl.querySelectorAll('a').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
    }
    msgEl.appendChild(textEl);

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
    return msgEl;
  }

  function appendVoiceNote(msgEl, src) {
    // src can be a Blob or a URL string
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    const audio = el('audio', { controls: '', class: 'chat-voice-note' });
    audio.src = url;
    if (src instanceof Blob) {
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
    }
    msgEl.appendChild(audio);
    log.scrollTop = log.scrollHeight;
  }

  function renderMessages() {
    clear(log);
    for (const msg of store.messages) {
      const msgEl = appendMessage(msg.role, msg.content, msg.extras || {}, false);

      // Render saved voice memos from history
      if (msg.voice_memo_path) {
        getVoiceMemoUrl(msg.voice_memo_path).then((url) => {
          if (url) appendVoiceNote(msgEl, url);
        });
      }
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

    if (store.agentState !== 'running') {
      const reply = `zzz, ${getSleepingReplyName()}... quiet, i'm sleeping so i don't burn any credits. If you want to chat, you can toggle me on in the top right.`;
      store.messages.push({ role: 'twin', content: reply });
      appendMessage('twin', reply);
      input.focus();
      return;
    }

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
      const msgEl = appendMessage('twin', reply, extras);

      // Generate voice note when backend flags voice_reply
      if (data.voice_reply && reply && !reply.startsWith('Error:')) {
        generateVoiceNote(reply, data.message_id)
          .then((blob) => {
            if (blob) appendVoiceNote(msgEl, blob);
          })
          .catch((err) => {
            console.warn('Voice note generation failed:', err.message);
          });
      }
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
            voice_memo_path: m.voice_memo_path || null,
          }));
          renderMessages();
        }
      })
      .catch(() => {});
  }

  renderMessages();

  return { scrollEl: log };
}
