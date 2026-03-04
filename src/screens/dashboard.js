import { el, on, clear } from '../lib/dom.js';
import { registerScreen } from '../lib/router.js';
import { store, notify } from '../lib/store.js';
import { createChat } from '../components/chat.js';
import { createCharacter } from '../components/character.js';
import { createWallet } from '../components/wallet.js';
import { createWhatsAppQR } from '../components/whatsapp-qr.js';

const TAB_LABELS = {
  chat: 'Chat',
  character: 'Character',
  wallet: 'Wallet',
  whatsapp: 'WhatsApp',
};

export function registerDashboard() {
  registerScreen('dashboard', { render });
}

function render(container) {
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'editable-name';
  nameInput.value = store.name;
  nameInput.setAttribute('aria-label', 'Twin name');

  on(nameInput, 'input', () => {
    store.name = nameInput.value;
    notify();
  });

  const header = el('div', { class: 'dashboard-header' }, nameInput);

  const tabBar = el('div', { class: 'tabs' });
  const tabContent = el('div', { class: 'tab-content' });

  const tabs = ['chat', 'character', 'wallet', 'whatsapp'];
  let activeTab = 'chat';

  function renderTabs() {
    clear(tabBar);
    for (const tab of tabs) {
      const btn = el('button', {
        class: tab === activeTab ? 'tab tab--active' : 'tab',
        type: 'button',
      }, TAB_LABELS[tab]);

      on(btn, 'click', () => {
        if (tab === activeTab) return;
        activeTab = tab;
        renderTabs();
        renderTabContent();
      });

      tabBar.appendChild(btn);
    }
  }

  function renderTabContent() {
    clear(tabContent);

    switch (activeTab) {
      case 'chat':
        createChat(tabContent);
        break;
      case 'character':
        createCharacter(tabContent);
        break;
      case 'wallet':
        createWallet(tabContent);
        break;
      case 'whatsapp':
        createWhatsAppQR(tabContent);
        break;
    }
  }

  const dashboard = el('div', { class: 'dashboard' }, header, tabBar, tabContent);
  container.appendChild(dashboard);

  renderTabs();
  renderTabContent();
}
