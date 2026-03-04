import { el, on, clear } from '../lib/dom.js';
import { registerScreen } from '../lib/router.js';
import { store, notify } from '../lib/store.js';
import { createChat } from '../components/chat.js';
import { createCharacter } from '../components/character.js';
import { createWallet } from '../components/wallet.js';
import { createWhatsAppQR } from '../components/whatsapp-qr.js';

type Tab = 'chat' | 'character' | 'wallet' | 'whatsapp';

const TAB_LABELS: Record<Tab, string> = {
  chat: 'Chat',
  character: 'Character',
  wallet: 'Wallet',
  whatsapp: 'WhatsApp',
};

let cleanupTab: (() => void) | null = null;

export function registerDashboard(): void {
  registerScreen('dashboard', {
    render,
    cleanup() {
      if (cleanupTab) {
        cleanupTab();
        cleanupTab = null;
      }
    },
  });
}

function render(container: HTMLElement): void {
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

  const tabs: Tab[] = ['chat', 'character', 'wallet', 'whatsapp'];
  let activeTab: Tab = 'chat';

  function renderTabs(): void {
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

  function renderTabContent(): void {
    if (cleanupTab) {
      cleanupTab();
      cleanupTab = null;
    }
    clear(tabContent);

    switch (activeTab) {
      case 'chat':
        cleanupTab = createChat(tabContent);
        break;
      case 'character':
        cleanupTab = createCharacter(tabContent);
        break;
      case 'wallet':
        cleanupTab = createWallet(tabContent);
        break;
      case 'whatsapp':
        cleanupTab = createWhatsAppQR(tabContent);
        break;
    }
  }

  const dashboard = el('div', { class: 'dashboard' }, header, tabBar, tabContent);
  container.appendChild(dashboard);

  renderTabs();
  renderTabContent();
}
