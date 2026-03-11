import { el, on, clear } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store, resetSession } from '../lib/store.js';
import { logout, getProfileImage, saveAgentName, saveAgentCharacterProfile } from '../lib/api.js';
import { PLAN_OPTIONS, applyPlanSelection, getPlanById } from '../lib/plans.js';
import { createChat } from '../components/chat.js';
import { createCharacter } from '../components/character.js';
import { createWallet } from '../components/wallet.js';
import { createWhatsAppQR } from '../components/whatsapp-qr.js';
import { openShareLayover } from '../components/share-layover.js';
import { animateTypewriter } from '../lib/typewriter.js';
import { createShareCard, buildPublicShareUrl } from '../lib/share.js';

const TAB_LABELS = {
  chat: 'Chat',
  wallet: 'Wallet',
  connect: 'Connect',
};

const PLAN_TOKEN_QUOTAS = {
  trial: 100000,
  monthly: 5555000,
  yearly: 5555000,
};

let profileImageUrl = '';
let stopNameType = null;

export function registerDashboard() {
  registerScreen('dashboard', {
    render,
    cleanup() {
      if (profileImageUrl) {
        URL.revokeObjectURL(profileImageUrl);
        profileImageUrl = '';
      }
      if (stopNameType) stopNameType();
      stopNameType = null;
    },
  });
}

function render(container) {
  if (profileImageUrl) {
    URL.revokeObjectURL(profileImageUrl);
    profileImageUrl = '';
  }

  const nameTitle = el('h1', {
    class: 'dashboard-title',
    'aria-label': 'Twin name',
  });
  const shareBtn = el('button', {
    class: 'dashboard-share-btn',
    type: 'button',
    'aria-label': 'Share twin card',
    title: 'Share twin card',
  }, createShareIcon());
  const shareStatus = el('p', {
    class: 'secondary text-sm dashboard-share-status',
    'aria-live': 'polite',
  });
  const headerTopRow = el('div', { class: 'dashboard-header-toprow' }, nameTitle, shareBtn);
  const headerCopy = el('div', { class: 'dashboard-header-copy' }, headerTopRow, shareStatus);

  function updateDisplayedName(name) {
    nameTitle.textContent = name && name.trim() ? name : 'Unnamed Twin';
  }

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
  const header = el('div', { class: 'dashboard-header' }, profileImage, headerCopy);
  const profilePanelImage = el('img', {
    class: 'profile-image-large',
    src: profileImage.getAttribute('src'),
    alt: `${store.name} profile image`,
    loading: 'eager',
    decoding: 'async',
  });
  const profilePanel = el('div', { class: 'profile-panel' }, profilePanelImage);

  const tabBar = el('div', { class: 'tabs' });
  const tabContent = el('div', { class: 'tab-content dashboard-tab-content' });

  const tabs = ['chat', 'wallet', 'connect'];
  let activeTab = 'wallet';
  let settingsOpen = false;
  let profileExpanded = false;
  const scrollPositions = {
    chat: null,
    wallet: null,
    connect: null,
    settings: null,
  };
  let activePanelKey = null;
  let activePanelScroller = null;
  let profileScrollWatcherEl = null;
  let lastProfileScrollTop = 0;
  let lastTouchY = null;

  function saveActiveScrollPosition() {
    if (!activePanelKey || !activePanelScroller) return;
    scrollPositions[activePanelKey] = activePanelScroller.scrollTop;
  }

  function syncProfileExpandedState() {
    profileImage.setAttribute('aria-expanded', String(profileExpanded));
    profileImage.setAttribute('title', profileExpanded ? 'Close profile image' : 'Open profile image');
    profileImage.classList.toggle('profile-image--active', profileExpanded);
    profilePanel.classList.toggle('profile-panel--open', profileExpanded);
    dashboard.classList.toggle('dashboard--photo-expanded', profileExpanded);
  }

  function closeProfileExpanded() {
    if (!profileExpanded) return;
    profileExpanded = false;
    syncProfileExpandedState();
  }

  function toggleProfileExpanded() {
    profileExpanded = !profileExpanded;
    syncProfileExpandedState();
  }

  function handleProfileScrollCollapse() {
    if (!profileScrollWatcherEl) return;
    const nextScrollTop = profileScrollWatcherEl.scrollTop;
    if (profileExpanded && nextScrollTop > lastProfileScrollTop) {
      closeProfileExpanded();
    }
    lastProfileScrollTop = nextScrollTop;
  }

  function bindProfileScrollWatcher(element) {
    if (profileScrollWatcherEl === element) {
      lastProfileScrollTop = element.scrollTop;
      return;
    }
    if (profileScrollWatcherEl) {
      profileScrollWatcherEl.removeEventListener('scroll', handleProfileScrollCollapse);
    }
    profileScrollWatcherEl = element;
    lastProfileScrollTop = element.scrollTop;
    profileScrollWatcherEl.addEventListener('scroll', handleProfileScrollCollapse);
  }

  function handleProfileWheelCollapse(event) {
    if (!profileExpanded) return;
    if (event.deltaY <= 0) return;
    closeProfileExpanded();
  }

  function handleProfileTouchStart(event) {
    lastTouchY = event.touches[0]?.clientY ?? null;
  }

  function handleProfileTouchMove(event) {
    if (!profileExpanded || lastTouchY == null) return;
    const nextTouchY = event.touches[0]?.clientY;
    if (nextTouchY == null) return;
    if (nextTouchY < lastTouchY) {
      closeProfileExpanded();
    }
    lastTouchY = nextTouchY;
  }

  on(profileImage, 'click', toggleProfileExpanded);
  on(profileImage, 'keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggleProfileExpanded();
  });
  on(profilePanelImage, 'click', toggleProfileExpanded);

  let sharing = false;

  function renderShareState(message = '') {
    shareStatus.textContent = message;
  }

  function renderShareButton({ busy = false } = {}) {
    shareBtn.disabled = sharing;
    shareBtn.setAttribute('aria-busy', String(busy));
  }

  on(shareBtn, 'click', async () => {
    if (sharing) return;
    sharing = true;
    renderShareButton();

    const twinName = (store.name && store.name.trim()) || 'Unnamed Twin';
    try {
      if (!store.agentId) {
        throw new Error('Create your twin before sharing.');
      }

      const flowInput = await openShareLayover(container, { twinName });
      if (!flowInput) {
        renderShareState('');
        return;
      }

      renderShareButton({ busy: true });

      const shareRecord = await createShareCard({
        agentId: store.agentId,
        twinName,
        recipientName: flowInput.recipientName,
        sharePrompt: flowInput.sharePrompt,
      });
      const shareUrl = buildPublicShareUrl(shareRecord.token);
      const sharePayload = {
        title: `${shareRecord.twinName || twinName} on CyberTwin`,
        text: shareRecord.personalMessage || 'Shared from CyberTwin.',
        url: shareUrl,
      };

      if (navigator.share) {
        await navigator.share(sharePayload);
        renderShareState('Shared.');
        return;
      }

      const copied = await copyShareLink(shareUrl);
      renderShareState(copied ? 'Link copied.' : shareUrl);
    } catch (err) {
      if (err?.name === 'AbortError') {
        renderShareState('');
        return;
      }
      renderShareState(err?.message || 'Could not create share link.');
    } finally {
      sharing = false;
      renderShareButton({ busy: false });
    }
  });

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
        saveActiveScrollPosition();
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
      saveActiveScrollPosition();
      settingsOpen = !settingsOpen;
      renderTabs();
      renderTabContent();
    });

    tabBar.appendChild(tabsMain);
    tabBar.appendChild(settingsBtn);
  }

  function renderTabContent() {
    clear(tabContent);
    const panelKey = settingsOpen ? 'settings' : activeTab;
    const isChatPanel = panelKey === 'chat';
    tabContent.classList.toggle('dashboard-tab-content--chat', isChatPanel);
    let panelScroller = tabContent;

    if (settingsOpen) {
      createSettings(tabContent, { updateDisplayedName });
    } else {
      switch (activeTab) {
        case 'chat': {
          const chat = createChat(tabContent, { initialScrollTop: scrollPositions.chat });
          panelScroller = chat.scrollEl;
          break;
        }
        case 'wallet':
          createWallet(tabContent);
          break;
        case 'connect':
          createWhatsAppQR(tabContent);
          break;
      }
    }

    activePanelKey = panelKey;
    activePanelScroller = panelScroller;
    const savedScrollTop = scrollPositions[panelKey];
    if (savedScrollTop != null) {
      activePanelScroller.scrollTop = savedScrollTop;
    } else if (!isChatPanel) {
      activePanelScroller.scrollTop = 0;
    }
    bindProfileScrollWatcher(activePanelScroller);
  }

  const dashboardChrome = el('div', { class: 'dashboard-chrome' }, header, profilePanel, tabBar);
  const dashboard = el('div', { class: 'dashboard' }, dashboardChrome, tabContent);
  container.appendChild(dashboard);

  on(dashboard, 'wheel', handleProfileWheelCollapse);
  on(dashboard, 'touchstart', handleProfileTouchStart);
  on(dashboard, 'touchmove', handleProfileTouchMove);

  renderTabs();
  renderTabContent();

  const startingName = store.name || 'Unnamed Twin';
  stopNameType = animateTypewriter(nameTitle, startingName, {
    delay: 80,
    speed: 30,
    swap: false,
  });

  // Load persisted profile image from API if we don't have one in memory
  if (!store.photoUrl && !store.photoBlob) {
    getProfileImage().then((url) => {
      if (url) {
        store.photoUrl = url;
        profileImage.src = url;
        profilePanelImage.src = url;
      }
    }).catch(() => {});
  }
}

function createSettings(parent, { updateDisplayedName }) {
  const wrapper = el('div', { class: 'settings-panel' });
  let settingsView = 'main';
  let savedName = store.name || '';
  let savedCharacterProfile = store.characterProfile || '';

  function renderSettingsView() {
    clear(wrapper);

    if (settingsView === 'billing') {
      createBillingPage(wrapper, () => {
        settingsView = 'main';
        renderSettingsView();
      });
      return;
    }

    const characterSection = el('div', { class: 'settings-section' });
    const nameLabel = el('label', { for: 'settings-twin-name', class: 'bold' }, 'Twin name');
    const nameInput = el('input', {
      id: 'settings-twin-name',
      class: 'input settings-name-input',
      type: 'text',
      value: savedName,
      placeholder: 'Unnamed Twin',
    });
    const nameActions = el('div', { class: 'settings-name-actions' });
    const nameStatus = el('p', { class: 'secondary text-sm' });
    let savingName = false;

    function getDraftName() {
      return nameInput.value.trim();
    }

    function renderNameActions() {
      clear(nameActions);
      const draftName = getDraftName();
      const hasChanges = draftName !== savedName.trim();

      if (savingName) {
        const savingBtn = el('button', { class: 'btn btn--secondary', type: 'button', disabled: '' }, 'Saving...');
        nameActions.appendChild(savingBtn);
        return;
      }

      if (!hasChanges) return;

      const saveBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Save');
      on(saveBtn, 'click', async () => {
        const nextName = getDraftName();
        if (!nextName) {
          nameStatus.textContent = 'Twin name cannot be empty.';
          renderNameActions();
          return;
        }

        const previousSavedName = savedName;
        const previousStoreName = store.name;

        savingName = true;
        savedName = nextName;
        store.name = nextName;
        updateDisplayedName(nextName);
        nameStatus.textContent = 'Saving...';
        renderNameActions();

        try {
          const agent = await saveAgentName(nextName);
          savedName = agent.name || nextName;
          store.name = savedName;
          nameInput.value = savedName;
          updateDisplayedName(savedName);
          nameStatus.textContent = 'Saved.';
        } catch (err) {
          savedName = previousSavedName;
          store.name = previousStoreName;
          nameInput.value = previousSavedName;
          updateDisplayedName(previousStoreName);
          nameStatus.textContent = err.message;
        } finally {
          savingName = false;
          renderNameActions();
        }
      });
      nameActions.appendChild(saveBtn);
    }

    on(nameInput, 'input', () => {
      if (stopNameType) {
        stopNameType();
        stopNameType = null;
      }
      store.name = nameInput.value;
      updateDisplayedName(nameInput.value);
      nameStatus.textContent = '';
      renderNameActions();
    });

    characterSection.appendChild(nameLabel);
    characterSection.appendChild(nameInput);
    characterSection.appendChild(nameActions);
    characterSection.appendChild(nameStatus);
    characterSection.appendChild(el('hr', { class: 'divider' }));
    characterSection.appendChild(el('p', { class: 'bold' }, 'Character'));

    const characterActions = el('div', { class: 'settings-name-actions' });
    const characterStatus = el('p', { class: 'secondary text-sm' });
    let savingCharacter = false;

    function renderCharacterActions(draftValue) {
      clear(characterActions);
      const draftProfile = draftValue.trim();
      const hasChanges = draftProfile !== savedCharacterProfile.trim();

      if (savingCharacter) {
        characterActions.appendChild(
          el('button', { class: 'btn btn--secondary', type: 'button', disabled: '' }, 'Saving...'),
        );
        return;
      }

      if (!hasChanges) return;

      const saveBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Save');
      on(saveBtn, 'click', async () => {
        const nextProfile = characterEditor.value.trim();
        if (!nextProfile) {
          characterStatus.textContent = 'Character profile cannot be empty.';
          renderCharacterActions(characterEditor.value);
          return;
        }

        const previousSavedProfile = savedCharacterProfile;

        savingCharacter = true;
        savedCharacterProfile = nextProfile;
        store.characterProfile = nextProfile;
        characterStatus.textContent = 'Saving...';
        renderCharacterActions(nextProfile);

        try {
          const agent = await saveAgentCharacterProfile(nextProfile);
          savedCharacterProfile = agent.personality || nextProfile;
          store.characterProfile = savedCharacterProfile;
          characterEditor.value = savedCharacterProfile;
          characterStatus.textContent = 'Saved.';
        } catch (err) {
          savedCharacterProfile = previousSavedProfile;
          store.characterProfile = previousSavedProfile;
          characterEditor.value = previousSavedProfile;
          characterStatus.textContent = err.message;
        } finally {
          savingCharacter = false;
          renderCharacterActions(characterEditor.value);
        }
      });

      characterActions.appendChild(saveBtn);
    }

    const { editor: characterEditor } = createCharacter(characterSection, {
      value: savedCharacterProfile,
      actions: characterActions,
      status: characterStatus,
      onChange(value) {
        characterStatus.textContent = '';
        renderCharacterActions(value);
      },
    });
    renderNameActions();
    renderCharacterActions(savedCharacterProfile);

    const usageSummary = getBillingUsageSummary();
    const billingSection = el(
      'div',
      { class: 'settings-section settings-section--compact' },
      el('p', { class: 'bold' }, 'Billing'),
      el('p', { class: 'secondary' }, `${usageSummary.planLabel} plan`),
      el('p', { class: 'secondary' }, `${formatTokens(usageSummary.usedTokens)} used this month`),
    );

    const openBillingBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Open Billing');
    on(openBillingBtn, 'click', () => {
      settingsView = 'billing';
      renderSettingsView();
    });
    billingSection.appendChild(openBillingBtn);

    const signOutBtn = el('button', { class: 'btn btn--danger', type: 'button' }, 'Sign out');
    on(signOutBtn, 'click', async () => {
      await logout();
      resetSession();
      navigate('welcome');
    });

    wrapper.append(characterSection, billingSection, signOutBtn);
  }

  renderSettingsView();
  parent.appendChild(wrapper);
}

function createBillingPage(parent, onBack) {
  ensureBillingDefaults();

  const backBtn = el('button', { class: 'btn btn--secondary billing-back-btn', type: 'button' }, 'Back');
  const page = el('section', { class: 'settings-section billing-page' });
  const header = el(
    'div',
    { class: 'billing-header' },
    backBtn,
    el('p', { class: 'bold' }, 'Billing'),
  );
  const subtitle = el('p', { class: 'secondary' }, 'Manage usage, plans, and on-demand controls.');

  const usageFold = el('details', { class: 'billing-fold', open: '' });
  const usageSummary = el('summary', { class: 'bold billing-fold-summary' }, 'Usage this month');
  const usageBody = el('div', { class: 'billing-fold-body' });
  usageFold.append(usageSummary, usageBody);

  const planFold = el('details', { class: 'billing-fold' });
  const planSummary = el('summary', { class: 'bold billing-fold-summary' }, 'Plan');
  const planBody = el('div', { class: 'billing-fold-body' });
  planFold.append(planSummary, planBody);

  const onDemandFold = el('details', { class: 'billing-fold' });
  const onDemandSummary = el('summary', { class: 'bold billing-fold-summary' }, 'On-demand usage');
  const onDemandBody = el('div', { class: 'billing-fold-body' });
  onDemandFold.append(onDemandSummary, onDemandBody);

  const statusLine = el('p', { class: 'secondary' });

  on(backBtn, 'click', onBack);

  page.append(header, subtitle, usageFold, planFold, onDemandFold, statusLine);
  parent.appendChild(page);

  renderUsage();
  renderPlanControls();
  renderOnDemandControls();

  function renderUsage() {
    clear(usageBody);

    const usage = getBillingUsageSummary();
    const percentUsed = usage.totalTokens > 0
      ? Math.min(100, Math.round((usage.usedTokens / usage.totalTokens) * 100))
      : 0;
    const allowanceLabel = usage.totalTokens > 0
      ? `of ${formatTokens(usage.totalTokens)} available`
      : 'No included tokens available';
    const progressLabel = usage.totalTokens > 0
      ? `${percentUsed}% used. Renews on ${usage.renewsOn}.`
      : `No active token allowance. Renews on ${usage.renewsOn}.`;

    usageBody.append(
      el('div', { class: 'billing-kpi' },
        el('p', { class: 'bold' }, formatTokens(usage.usedTokens)),
        el('p', { class: 'secondary' }, allowanceLabel),
      ),
      el('div', { class: 'billing-meter' },
        el('div', {
          class: 'billing-meter-fill',
          style: `width:${percentUsed}%;`,
          role: 'img',
          'aria-label': `${percentUsed}% of monthly tokens used`,
        }),
      ),
      el('p', { class: 'secondary' }, progressLabel),
      el('p', { class: 'secondary' }, `Current plan: ${usage.planLabel}`),
    );
  }

  function renderPlanControls() {
    clear(planBody);

    const selected = getSelectedPlan();
    const planNotice = el('p', { class: 'secondary' }, selected
      ? `${selected.title} is active.`
      : 'No plan is active.');

    const planList = el('div', { class: 'billing-plan-list' });

    for (const option of PLAN_OPTIONS) {
      const isCurrent = selected && selected.id === option.id;
      const row = el(
        'div',
        { class: 'billing-plan-row' },
        el(
          'div',
          { class: 'billing-plan-copy' },
          el('p', { class: 'bold' }, option.title),
          el('p', { class: 'secondary' }, option.price),
          el('p', { class: 'secondary' }, option.copy),
        ),
      );

      if (isCurrent) {
        row.appendChild(el('span', { class: 'billing-tag' }, 'Current'));
      } else {
        const switchBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, `Switch`);
        on(switchBtn, 'click', () => {
          applyPlanSelection(option.id);
          ensureBillingDefaults();
          statusLine.textContent = `Plan switched to ${option.title}.`;
          renderUsage();
          renderPlanControls();
        });
        row.appendChild(switchBtn);
      }

      planList.appendChild(row);
    }

    const cancelBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Cancel plan');
    on(cancelBtn, 'click', () => {
      store.selectedPlan = null;
      store.messageQuota = null;
      store.hasCustomerSupport = false;
      statusLine.textContent = 'Plan canceled. You can still re-activate anytime.';
      renderUsage();
      renderPlanControls();
    });

    planBody.append(planNotice, planList, cancelBtn);
  }

  function renderOnDemandControls() {
    clear(onDemandBody);

    const toggleId = 'on-demand-toggle';
    const tokenLimitId = 'on-demand-token-limit';
    const spendLimitId = 'on-demand-spend-limit';

    const onDemandToggle = el('input', {
      id: toggleId,
      type: 'checkbox',
      class: 'billing-checkbox',
    });
    onDemandToggle.checked = Boolean(store.onDemandUsageEnabled);

    const toggleLabel = el(
      'label',
      { class: 'billing-toggle', for: toggleId },
      onDemandToggle,
      el('span', { class: 'bold' }, 'Enable on-demand usage'),
    );

    const tokenLabel = el('label', { for: tokenLimitId }, 'Monthly extra token limit');
    const tokenInput = el('input', {
      class: 'input',
      id: tokenLimitId,
      type: 'number',
      min: '1000',
      step: '1000',
    });
    if (store.onDemandTokenLimit != null) {
      tokenInput.value = String(store.onDemandTokenLimit);
    }

    const spendLabel = el('label', { for: spendLimitId }, 'Monthly spend limit (EUR)');
    const spendInput = el('input', {
      class: 'input',
      id: spendLimitId,
      type: 'number',
      min: '0',
      step: '1',
    });
    if (store.monthlySpendingLimit != null) {
      spendInput.value = String(store.monthlySpendingLimit);
    }

    const inputGrid = el(
      'div',
      { class: 'billing-grid' },
      el('div', { class: 'billing-field' }, tokenLabel, tokenInput),
      el('div', { class: 'billing-field' }, spendLabel, spendInput),
    );

    const saveBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Save on-demand settings');
    const onDemandStatus = el('p', { class: 'secondary' });

    function applyToggleState() {
      const isEnabled = onDemandToggle.checked;
      tokenInput.disabled = !isEnabled;
      spendInput.disabled = !isEnabled;
      saveBtn.disabled = false;
      inputGrid.classList.toggle('billing-grid--disabled', !isEnabled);
      if (!isEnabled) {
        onDemandStatus.textContent = 'On-demand usage is disabled.';
      }
    }

    on(onDemandToggle, 'change', applyToggleState);

    on(saveBtn, 'click', () => {
      const isEnabled = onDemandToggle.checked;
      if (!isEnabled) {
        store.onDemandUsageEnabled = false;
        statusLine.textContent = 'On-demand usage disabled.';
        onDemandStatus.textContent = 'On-demand usage is disabled.';
        renderUsage();
        return;
      }

      const tokenRaw = tokenInput.value.trim();
      const spendRaw = spendInput.value.trim();

      const tokenLimit = Number.parseInt(tokenRaw, 10);
      if (!Number.isFinite(tokenLimit) || tokenLimit < 1000) {
        onDemandStatus.textContent = 'Set an extra token limit of at least 1,000.';
        return;
      }

      let spendLimit = null;
      if (spendRaw) {
        const parsedSpend = Number.parseFloat(spendRaw);
        if (!Number.isFinite(parsedSpend) || parsedSpend < 0) {
          onDemandStatus.textContent = 'Spend limit must be 0 or more.';
          return;
        }
        spendLimit = Math.round(parsedSpend * 100) / 100;
      }

      store.onDemandUsageEnabled = true;
      store.onDemandTokenLimit = tokenLimit;
      store.monthlySpendingLimit = spendLimit;

      onDemandStatus.textContent = `On-demand enabled with ${formatTokens(tokenLimit)} extra tokens.`;
      statusLine.textContent = 'On-demand settings updated.';
      renderUsage();
    });

    onDemandBody.append(toggleLabel, inputGrid, saveBtn, onDemandStatus);
    applyToggleState();
  }
}

function ensureBillingDefaults() {
  if (store.onDemandUsageEnabled == null) {
    store.onDemandUsageEnabled = false;
  }

  if (store.onDemandTokenLimit == null) {
    store.onDemandTokenLimit = 1000000;
  }

  if (store.monthlyTokenUsage == null) {
    const plan = getSelectedPlan();
    const baseTokens = plan ? getPlanTokenQuota(plan.id) : 100000;
    store.monthlyTokenUsage = Math.round(baseTokens * 0.34);
  }
}

function getBillingUsageSummary() {
  ensureBillingDefaults();
  const selected = getSelectedPlan();
  const includedTokens = selected ? getPlanTokenQuota(selected.id) : 0;
  const onDemandTokens = store.onDemandUsageEnabled ? (store.onDemandTokenLimit || 0) : 0;
  const totalTokens = includedTokens + onDemandTokens;
  const now = new Date();
  const renewsOn = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    planLabel: selected ? selected.title : 'No active',
    usedTokens: store.monthlyTokenUsage || 0,
    totalTokens,
    renewsOn: renewsOn.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

function getSelectedPlan() {
  if (store.selectedPlan) {
    return getPlanById(store.selectedPlan);
  }
  if (store.messageQuota) {
    return PLAN_OPTIONS.find((plan) => plan.messages === store.messageQuota) || null;
  }
  return null;
}

function getPlanTokenQuota(planId) {
  return PLAN_TOKEN_QUOTAS[planId] || 0;
}

function formatTokens(value) {
  return `${Math.max(0, Math.round(value || 0)).toLocaleString('en-US')} tokens`;
}

function getProfileImageSrc() {
  if (store.photoUrl) {
    return store.photoUrl;
  }

  if (store.photoBlob) {
    profileImageUrl = URL.createObjectURL(store.photoBlob);
    return profileImageUrl;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="8" fill="#2b2927" fill-opacity="0.08"/><circle cx="36" cy="28" r="12" fill="#2b2927" fill-opacity="0.22"/><path d="M18 58c0-10 8-18 18-18s18 8 18 18" fill="#2b2927" fill-opacity="0.22"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function copyShareLink(url) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {}
  return false;
}

function createShareIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'dashboard-share-icon');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M15 5h4v4M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', '1.8');
  svg.appendChild(path);

  return svg;
}
