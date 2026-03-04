import { el, on, clear } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store, notify } from '../lib/store.js';
import { createChat } from '../components/chat.js';
import { createCharacter } from '../components/character.js';
import { createWallet } from '../components/wallet.js';
import { createWhatsAppQR } from '../components/whatsapp-qr.js';

const TAB_LABELS = {
  chat: 'Chat',
  wallet: 'Wallet',
  connect: 'Connect',
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

  const tabs = ['chat', 'wallet', 'connect'];
  let activeTab = 'chat';
  let settingsOpen = false;

  function renderTabs() {
    clear(tabBar);
    const tabsMain = el('div', { class: 'tabs-main' });

    for (const tab of tabs) {
      const btn = el('button', {
        class: !settingsOpen && tab === activeTab ? 'tab tab--active' : 'tab',
        type: 'button',
      }, TAB_LABELS[tab]);

      on(btn, 'click', () => {
        if (!settingsOpen && tab === activeTab) return;
        activeTab = tab;
        settingsOpen = false;
        renderTabs();
        renderTabContent();
      });

      tabsMain.appendChild(btn);
    }

    const settingsBtn = el('button', {
      class: settingsOpen ? 'tab tab--icon tab--active' : 'tab tab--icon',
      type: 'button',
      'aria-label': 'Settings',
      title: 'Settings',
    }, '⚙');

    on(settingsBtn, 'click', () => {
      settingsOpen = !settingsOpen;
      renderTabs();
      renderTabContent();
    });

    tabBar.appendChild(tabsMain);
    tabBar.appendChild(settingsBtn);
  }

  function renderTabContent() {
    clear(tabContent);

    if (settingsOpen) {
      createSettings(tabContent);
      return;
    }

    switch (activeTab) {
      case 'chat':
        createChat(tabContent);
        break;
      case 'wallet':
        createWallet(tabContent);
        break;
      case 'connect':
        createWhatsAppQR(tabContent);
        break;
    }
  }

  const dashboard = el('div', { class: 'dashboard' }, header, tabBar, tabContent);
  container.appendChild(dashboard);

  renderTabs();
  renderTabContent();
}

function createSettings(parent) {
  const wrapper = el('div', { class: 'tab-content settings-panel' });

  const characterSection = el('div', { class: 'settings-section' });
  characterSection.appendChild(el('p', { class: 'bold' }, 'Character'));
  createCharacter(characterSection);

  const billingSection = el(
    'div',
    { class: 'settings-section' },
    el('p', { class: 'bold' }, 'Billing'),
    el('p', { class: 'secondary text-sm' }, 'Plan: Starter (mock). Next charge: EUR 12.00 on the 1st of each month.'),
    el('button', { class: 'btn btn--secondary', type: 'button' }, 'Manage Billing'),
  );

  const signOutBtn = el('button', { class: 'btn btn--danger', type: 'button' }, 'Sign out');
  on(signOutBtn, 'click', () => {
    store.messages = [];
    store.photoBlob = null;
    store.audioBlob = null;
    if (store.mediaStream) {
      for (const track of store.mediaStream.getTracks()) track.stop();
    }
    store.mediaStream = null;
    notify();
    navigate('welcome');
  });

  wrapper.append(characterSection, billingSection, signOutBtn);
  parent.appendChild(wrapper);
}
