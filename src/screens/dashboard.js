import { el, on, clear } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store, resetSession } from '../lib/store.js';
import { createChat } from '../components/chat.js';
import { createCharacter } from '../components/character.js';
import { createWallet } from '../components/wallet.js';
import { createWhatsAppQR } from '../components/whatsapp-qr.js';

const TAB_LABELS = {
  chat: 'Chat',
  wallet: 'Wallet',
  connect: 'Connect',
};

let profileImageUrl = '';

export function registerDashboard() {
  registerScreen('dashboard', {
    render,
    cleanup() {
      if (!profileImageUrl) return;
      URL.revokeObjectURL(profileImageUrl);
      profileImageUrl = '';
    },
  });
}

function render(container) {
  if (profileImageUrl) {
    URL.revokeObjectURL(profileImageUrl);
    profileImageUrl = '';
  }

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'editable-name';
  nameInput.value = store.name;
  nameInput.setAttribute('aria-label', 'Twin name');

  on(nameInput, 'input', () => {
    store.name = nameInput.value;
  });

  const profileImage = el('img', {
    class: 'profile-image',
    src: getProfileImageSrc(),
    alt: `${store.name} profile image`,
    role: 'button',
    tabindex: '0',
    'aria-expanded': 'false',
    title: 'Open profile image',
    loading: 'eager',
    decoding: 'async',
  });
  const header = el('div', { class: 'dashboard-header' }, profileImage, nameInput);
  const profilePanelImage = el('img', {
    class: 'profile-image-large',
    src: profileImage.getAttribute('src'),
    alt: `${store.name} profile image`,
    loading: 'eager',
    decoding: 'async',
  });
  const profilePanel = el('div', { class: 'profile-panel' }, profilePanelImage);

  const tabBar = el('div', { class: 'tabs' });
  const tabContent = el('div', { class: 'tab-content' });

  const tabs = ['chat', 'wallet', 'connect'];
  let activeTab = 'wallet';
  let settingsOpen = false;
  let profileExpanded = false;

  function toggleProfileExpanded() {
    profileExpanded = !profileExpanded;
    profileImage.setAttribute('aria-expanded', String(profileExpanded));
    profileImage.setAttribute('title', profileExpanded ? 'Close profile image' : 'Open profile image');
    profileImage.classList.toggle('profile-image--active', profileExpanded);
    profilePanel.classList.toggle('profile-panel--open', profileExpanded);
    dashboard.classList.toggle('dashboard--photo-expanded', profileExpanded);
  }

  on(profileImage, 'click', toggleProfileExpanded);
  on(profileImage, 'keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggleProfileExpanded();
  });
  on(profilePanelImage, 'click', toggleProfileExpanded);

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

  const dashboard = el('div', { class: 'dashboard' }, header, profilePanel, tabBar, tabContent);
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
    resetSession();
    navigate('welcome');
  });

  wrapper.append(characterSection, billingSection, signOutBtn);
  parent.appendChild(wrapper);
}

function getProfileImageSrc() {
  if (store.photoBlob) {
    profileImageUrl = URL.createObjectURL(store.photoBlob);
    return profileImageUrl;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="8" fill="currentColor" fill-opacity="0.08"/><circle cx="36" cy="28" r="12" fill="currentColor" fill-opacity="0.22"/><path d="M18 58c0-10 8-18 18-18s18 8 18 18" fill="currentColor" fill-opacity="0.22"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
