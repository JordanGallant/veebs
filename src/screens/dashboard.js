import { el, on, clear } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store, savePendingSignup } from '../lib/store.js';
import {
  getActiveSessionUser,
  isEmailVerified,
  logout,
  getProfileImage,
  saveAgentName,
  saveAgentCharacterProfile,
  saveOwnerReferenceName,
} from '../lib/api.js';
import { PLAN_OPTIONS, applyPlanSelection, getPlanById } from '../lib/plans.js';
import { createChat } from '../components/chat.js';
import { createCharacter } from '../components/character.js';
// wallet removed for hackathon
import { openShareLayover } from '../components/share-layover.js';
import { animateTypewriter } from '../lib/typewriter.js';

const GENERIC_DISPLAY_NAME = 'CyberTwin User';

const TAB_LABELS = {
  welcome: 'Welcome',
  chat: 'Chat',
  wallet: 'Wallet',
};

const PLAN_TOKEN_QUOTAS = {
  trial: 100000,
  monthly: 5555000,
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

async function render(container) {
  const sessionUser = await getActiveSessionUser();
  if (!sessionUser) {
    navigate('auth?mode=signin');
    return;
  }

  // Email verification disabled for hackathon

  if (profileImageUrl) {
    URL.revokeObjectURL(profileImageUrl);
    profileImageUrl = '';
  }

  const nameTitle = el('h1', {
    class: 'dashboard-title',
    'aria-label': 'Twin name',
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
  const statusRow = el('div', { class: 'agent-status-row' }, nameTitle);

  const shareBtn = el('button', {
    class: 'dashboard-control dashboard-share-btn',
    type: 'button',
    'aria-label': 'Share twin card',
    title: 'Share twin card',
  }, el('span', { class: 'dashboard-control-label' }, 'Share'), createShareIcon());
  const shareStatus = el('p', {
    class: 'secondary text-sm dashboard-share-status',
    'aria-live': 'polite',
  });

  // ── Join Meeting panel ──
  const meetingInput = el('input', {
    class: 'input',
    type: 'url',
    placeholder: 'Paste meeting link...',
    style: 'width:100%; margin-bottom:8px;',
  });

  const scriptLabel = el('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;' },
    el('span', { class: 'secondary text-sm' }, 'Script'),
  );

  const contextInput = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'Meeting context (e.g. "team standup", "investor pitch")',
    style: 'width:100%; margin-bottom:8px;',
  });

  const generateScriptBtn = el('button', {
    class: 'btn btn--secondary',
    type: 'button',
    style: 'width:100%; margin-bottom:8px;',
  }, 'Generate Script');

  const scriptInput = el('textarea', {
    class: 'input',
    placeholder: 'What should your twin say?',
    rows: '4',
    style: 'width:100%; margin-bottom:8px; resize:vertical; font-family:inherit;',
  });
  scriptInput.value = `Hello everyone, I am ${store.name || 'a CyberTwin'}, nice to meet you all!`;

  on(generateScriptBtn, 'click', async () => {
    generateScriptBtn.setAttribute('disabled', '');
    generateScriptBtn.textContent = 'Generating...';
    meetingStatus.textContent = '';

    try {
      const { supabase } = await import('../lib/supabase.js');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token || !store.agentId) {
        meetingStatus.textContent = 'Not signed in.';
        generateScriptBtn.removeAttribute('disabled');
        generateScriptBtn.textContent = 'Generate Script';
        return;
      }

      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: store.agentId,
          context: contextInput.value.trim() || undefined,
          duration: 'medium',
        }),
      });

      const data = await res.json();

      if (res.ok && data.script) {
        scriptInput.value = data.script;
        meetingStatus.textContent = `Script generated (${data.word_count} words)`;
      } else {
        meetingStatus.textContent = data.error || 'Script generation failed.';
      }
    } catch (err) {
      meetingStatus.textContent = err.message || 'Script generation failed.';
    }

    generateScriptBtn.removeAttribute('disabled');
    generateScriptBtn.textContent = 'Generate Script';
  });

  const createMeetingBtn = el('button', {
    class: 'btn btn--secondary',
    type: 'button',
    style: 'width:100%; margin-bottom:8px;',
  }, 'Create Meeting');

  const joinSubmitBtn = el('button', {
    class: 'btn btn--secondary',
    type: 'button',
    style: 'width:100%; margin-bottom:8px;',
  }, 'Join Meeting');

  const speakBtn = el('button', {
    class: 'btn btn--secondary',
    type: 'button',
    style: 'width:100%; display:none;',
  }, 'Speak Now');

  const meetingStatus = el('p', {
    class: 'secondary text-sm',
    'aria-live': 'polite',
    style: 'margin-top:4px;',
  });

  const meetingPanel = el('div', {
    class: 'meeting-panel',
    style: 'padding:12px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-top:12px;',
  },
    el('p', { class: 'bold', style: 'margin-bottom:8px;' }, 'Join Meeting'),
    meetingInput,
    joinSubmitBtn,
    speakBtn,
    meetingStatus,
  );

  on(speakBtn, 'click', async () => {
    speakBtn.setAttribute('disabled', '');
    meetingStatus.textContent = 'Twin is speaking...';
    try {
      await fetch('http://127.0.0.1:9999/play', { method: 'POST' });
      meetingStatus.textContent = 'Twin is speaking! Will return to idle when done.';
    } catch {
      meetingStatus.textContent = 'Could not trigger playback.';
    }
    speakBtn.removeAttribute('disabled');
  });

  on(createMeetingBtn, 'click', async () => {
    createMeetingBtn.setAttribute('disabled', '');
    meetingStatus.textContent = 'Creating meeting + starting camera...';

    try {
      const res = await fetch('/api/start-camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createMeeting: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        meetingStatus.textContent = data.error || 'Failed.';
        if (data.hint) meetingStatus.textContent += ' ' + data.hint;
        createMeetingBtn.removeAttribute('disabled');
        return;
      }

      if (data.meeting_url) {
        meetingInput.value = data.meeting_url;
        meetingStatus.textContent = `Meeting created! Share this link: ${data.meeting_url}`;
      }

      speakBtn.style.display = '';
      meetingStatus.textContent += '\nClick "Speak Now" when ready.';
    } catch (err) {
      meetingStatus.textContent = err.message || 'Failed to create meeting.';
    }

    createMeetingBtn.removeAttribute('disabled');
  });

  on(joinSubmitBtn, 'click', async () => {
    const meetingUrl = meetingInput.value.trim();
    if (!meetingUrl) {
      meetingStatus.textContent = 'Paste a meeting link first.';
      return;
    }

    joinSubmitBtn.setAttribute('disabled', '');
    meetingStatus.textContent = 'Generating script...';

    try {
      const { supabase } = await import('../lib/supabase.js');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token || !store.agentId) {
        meetingStatus.textContent = 'Not signed in or no agent found.';
        joinSubmitBtn.removeAttribute('disabled');
        return;
      }

      // Open meeting in new tab
      window.open(meetingUrl, '_blank');

      // Show speak button
      speakBtn.style.display = '';
      joinSubmitBtn.textContent = 'Rejoin';
      meetingStatus.textContent = 'Select "Unity Video Capture" as camera and "CABLE Output" as mic. Click "Speak Now" when ready.';
    } catch (err) {
      meetingStatus.textContent = err.message || 'Something went wrong.';
    }

    joinSubmitBtn.removeAttribute('disabled');
  });

  const headerIdentity = el('div', { class: 'dashboard-header-identity' }, profileImage, statusRow);
  const headerActions = el('div', { class: 'dashboard-header-actions' }, shareBtn);
  const headerTopRow = el('div', { class: 'dashboard-header-toprow' }, headerIdentity, headerActions);
  const headerCopy = el('div', { class: 'dashboard-header-copy' }, headerTopRow, shareStatus);

  function updateDisplayedName(name) {
    nameTitle.textContent = name && name.trim() ? name : 'Unnamed Twin';
  }

  const header = el('div', { class: 'dashboard-header' }, headerCopy);
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

  const tabs = ['welcome', 'chat', 'wallet'];
  let activeTab = 'welcome';
  let settingsOpen = false;
  let profileExpanded = false;
  const scrollPositions = {
    chat: null,
    wallet: null,
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
  let closeShareDropdown = null;

  function renderShareState(message = '') {
    shareStatus.textContent = message;
  }

  function renderShareButton({ busy = false } = {}) {
    shareBtn.disabled = sharing;
    shareBtn.setAttribute('aria-busy', String(busy));
  }

  on(shareBtn, 'click', async () => {
    if (sharing && closeShareDropdown) {
      closeShareDropdown();
      return;
    }
    if (sharing) return;
    sharing = true;
    renderShareButton();

    const twinName = (store.name && store.name.trim()) || 'Unnamed Twin';
    try {
      if (!store.agentId) {
        throw new Error('Create your twin before sharing.');
      }

      renderShareButton({ busy: true });
      const { promise, close } = openShareLayover(container, {
        agentId: store.agentId,
        twinName,
        ownerReferenceName: store.ownerReferenceName,
        ownerReferenceFallback: getOwnerReferenceFallback(),
        anchor: shareBtn,
      });
      closeShareDropdown = close;
      await promise;
      renderShareState('');
    } catch (err) {
      if (err?.name === 'AbortError') {
        renderShareState('');
        return;
      }
      renderShareState(err?.message || 'Could not create share link.');
    } finally {
      closeShareDropdown = null;
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
        case 'welcome':
          createWelcomeTab(tabContent);
          break;
        case 'chat': {
          const chat = createChat(tabContent, { initialScrollTop: scrollPositions.chat });
          panelScroller = chat.scrollEl;
          break;
        }
        case 'wallet':
          createSolanaWalletTab(tabContent);
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

  const dashboardChrome = el('div', { class: 'dashboard-chrome' }, header, profilePanel, meetingPanel, tabBar);
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

function createWelcomeTab(parent) {
  const wrapper = el('div', { class: 'welcome-tab', style: 'padding:16px;' });

  const loading = el('p', { class: 'secondary', style: 'text-align:center; padding:32px 0;' }, 'Loading twin video...');
  wrapper.appendChild(loading);

  (async () => {
    try {
      const { supabase } = await import('../lib/supabase.js');
      const { data } = await supabase
        .from('agents')
        .select('video_url, personality')
        .eq('id', store.agentId)
        .single();

      if (data?.video_url) {
        const player = buildVideoPlayer(data.video_url);
        wrapper.replaceChild(player, loading);
      } else {
        loading.textContent = 'No video yet. Complete onboarding to generate your twin video.';
      }

      if (data?.personality) {
        const soulText = data.personality
          .replace(/^#+\s.*/gm, '')
          .replace(/\*\*/g, '')
          .replace(/[#*_~`]/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (soulText) {
          const soulSection = el('div', { style: 'margin-top:16px;' },
            el('p', { class: 'bold', style: 'margin-bottom:8px;' }, 'Soul'),
            el('p', { class: 'secondary', style: 'white-space:pre-wrap; font-size:13px; line-height:1.5;' }, soulText.slice(0, 600) + (soulText.length > 600 ? '...' : '')),
          );
          wrapper.appendChild(soulSection);
        }
      }
    } catch {
      loading.textContent = 'Could not load video.';
    }
  })();

  parent.appendChild(wrapper);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function svgIcon(pathD, viewBox = '0 0 24 24') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

const ICON_PLAY = 'M8 5v14l11-7z';
const ICON_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
const ICON_VOL_ON = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.3v7.4a4.5 4.5 0 0 0 2.5-3.7zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1A9 9 0 0 0 14 3.2z';
const ICON_VOL_OFF = 'M16.5 12A4.5 4.5 0 0 0 14 8.3v1.5l2.4 2.4c.1-.4.1-.8.1-1.2zm2.5 0a7 7 0 0 1-.6 2.8l1.5 1.5A9 9 0 0 0 21 12a9 9 0 0 0-7-8.8v2.1a7 7 0 0 1 5 6.7zM4.3 3 3 4.3 7.7 9H3v6h4l5 5v-6.7l4.2 4.2c-.7.5-1.4.9-2.2 1.2v2.1a9 9 0 0 0 3.6-1.8l2.1 2.1L21 20.3l-1-1-4.6-4.6L12 11.4 4.3 3zM12 4l-2.1 2.1L12 8.3V4z';
const ICON_FS = 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z';

function buildVideoPlayer(src) {
  const video = el('video', { playsinline: '', preload: 'metadata' });
  video.src = src;

  const playIcon = el('div', { class: 'vp-play-icon' });
  playIcon.appendChild(svgIcon(ICON_PLAY));
  const overlay = el('div', { class: 'vp-overlay' }, playIcon);

  const playBtn = el('button', { class: 'vp-btn vp-btn--play', type: 'button', 'aria-label': 'Play' });
  playBtn.appendChild(svgIcon(ICON_PLAY));

  const timeEl = el('span', { class: 'vp-time' }, '00:00 / 00:00');
  const progressFill = el('div', { class: 'vp-progress-fill' });
  const progressTrack = el('div', { class: 'vp-progress-track' }, progressFill);
  const progressBar = el('div', { class: 'vp-progress' }, progressTrack);

  const volBtn = el('button', { class: 'vp-btn vp-btn--vol', type: 'button', 'aria-label': 'Mute' });
  volBtn.appendChild(svgIcon(ICON_VOL_ON));
  const volSlider = el('input', {
    class: 'vp-volume-slider',
    type: 'range',
    min: '0',
    max: '1',
    step: '0.05',
    value: '1',
    'aria-label': 'Volume',
  });
  const volTrack = el('div', { class: 'vp-volume-track' }, volSlider);
  const volGroup = el('div', { class: 'vp-volume' }, volBtn, volTrack);

  const fsBtn = el('button', { class: 'vp-btn vp-btn--fs', type: 'button', 'aria-label': 'Fullscreen' });
  fsBtn.appendChild(svgIcon(ICON_FS));

  const controls = el('div', { class: 'vp-controls' }, playBtn, timeEl, progressBar, volGroup, fsBtn);

  const spinner = el('div', { class: 'vp-spinner' });
  const loadingEl = el('div', { class: 'vp-loading' }, spinner);

  const container = el('div', { class: 'vp vp--paused' }, video, overlay, loadingEl, controls);

  function togglePlay() {
    if (video.paused || video.ended) {
      video.play();
    } else {
      video.pause();
    }
  }

  function syncPlayState() {
    const paused = video.paused || video.ended;
    container.classList.toggle('vp--paused', paused);
    playBtn.innerHTML = '';
    playBtn.appendChild(svgIcon(paused ? ICON_PLAY : ICON_PAUSE));
    playBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    playIcon.innerHTML = '';
    playIcon.appendChild(svgIcon(paused ? ICON_PLAY : ICON_PAUSE));
  }

  function syncProgress() {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    progressFill.style.width = `${pct}%`;
    timeEl.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
  }

  function syncVolume() {
    volBtn.innerHTML = '';
    volBtn.appendChild(svgIcon(video.muted || video.volume === 0 ? ICON_VOL_OFF : ICON_VOL_ON));
    volSlider.value = video.muted ? 0 : video.volume;
  }

  on(overlay, 'click', togglePlay);
  on(playBtn, 'click', togglePlay);

  on(video, 'play', syncPlayState);
  on(video, 'pause', syncPlayState);
  on(video, 'ended', syncPlayState);
  on(video, 'timeupdate', syncProgress);
  on(video, 'loadedmetadata', () => {
    syncProgress();
    loadingEl.hidden = true;
  });
  on(video, 'waiting', () => { loadingEl.hidden = false; });
  on(video, 'canplay', () => { loadingEl.hidden = true; });

  let scrubbing = false;
  function seekFromEvent(e) {
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * (video.duration || 0);
    syncProgress();
  }

  on(progressBar, 'pointerdown', (e) => {
    scrubbing = true;
    container.classList.add('vp--scrubbing');
    progressBar.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });
  on(progressBar, 'pointermove', (e) => { if (scrubbing) seekFromEvent(e); });
  on(progressBar, 'pointerup', () => {
    scrubbing = false;
    container.classList.remove('vp--scrubbing');
  });

  on(volBtn, 'click', () => {
    video.muted = !video.muted;
    syncVolume();
  });
  on(volSlider, 'input', () => {
    video.volume = parseFloat(volSlider.value);
    video.muted = video.volume === 0;
    syncVolume();
  });

  on(fsBtn, 'click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(() => {});
    }
  });

  on(video, 'dblclick', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(() => {});
    }
  });

  video.autoplay = true;

  return container;
}

function createSolanaWalletTab(parent) {
  const wrapper = el('div', { class: 'wallet-tab', style: 'padding:16px;' });

  const loading = el('p', { class: 'secondary' }, 'Loading wallet...');
  wrapper.appendChild(loading);

  (async () => {
    try {
      const { supabase } = await import('../lib/supabase.js');
      const { data } = await supabase
        .from('agents')
        .select('solana_address')
        .eq('id', store.agentId)
        .single();

      const addr = data?.solana_address;
      if (!addr) {
        loading.textContent = 'No wallet connected.';
        return;
      }

      const addrShort = addr.slice(0, 8) + '...' + addr.slice(-8);
      const explorerUrl = `https://explorer.solana.com/address/${addr}?cluster=devnet`;

      const walletCard = el('div', { style: 'background:rgba(255,255,255,0.05); border-radius:12px; padding:16px;' },
        el('p', { class: 'bold', style: 'margin-bottom:8px;' }, 'Solana Wallet'),
        el('div', { style: 'display:flex; align-items:center; gap:8px;' },
          el('code', { style: 'font-size:13px; color:#a78bfa; word-break:break-all;' }, addr),
        ),
        el('div', { style: 'margin-top:12px; display:flex; gap:8px;' },
          (() => {
            const copyBtn = el('button', { class: 'btn btn--secondary', type: 'button', style: 'font-size:12px;' }, 'Copy');
            on(copyBtn, 'click', () => {
              navigator.clipboard.writeText(addr).then(() => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); });
            });
            return copyBtn;
          })(),
          el('a', {
            href: explorerUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'btn btn--secondary',
            style: 'font-size:12px; text-decoration:none;',
          }, 'Explorer'),
        ),
      );

      wrapper.replaceChild(walletCard, loading);
    } catch {
      loading.textContent = 'Could not load wallet.';
    }
  })();

  parent.appendChild(wrapper);
}

function createSettings(parent, { updateDisplayedName }) {
  const wrapper = el('div', { class: 'settings-panel' });
  let settingsView = 'main';
  let savedOwnerReferenceName = store.ownerReferenceName || '';
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
    const ownerLabel = el('label', { for: 'settings-owner-reference-name', class: 'bold' }, 'How your twin calls you');
    const ownerInput = el('input', {
      id: 'settings-owner-reference-name',
      class: 'input settings-name-input',
      type: 'text',
      value: savedOwnerReferenceName || getOwnerReferenceFallback(),
    });
    const ownerActions = el('div', { class: 'settings-name-actions' });
    const ownerStatus = el('p', { class: 'secondary text-sm' });
    let savingOwnerReferenceName = false;

    function getDraftOwnerReferenceName() {
      return ownerInput.value.trim();
    }

    function renderOwnerActions() {
      clear(ownerActions);
      const draftOwnerReferenceName = getDraftOwnerReferenceName();
      const hasChanges = draftOwnerReferenceName !== savedOwnerReferenceName;

      if (savingOwnerReferenceName) {
        ownerActions.appendChild(
          el('button', { class: 'btn btn--secondary', type: 'button', disabled: '' }, 'Saving...'),
        );
        return;
      }

      if (!hasChanges) return;

      const saveBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Save');
      on(saveBtn, 'click', async () => {
        const nextOwnerReferenceName = getDraftOwnerReferenceName();
        if (!nextOwnerReferenceName) {
          ownerStatus.textContent = 'This name cannot be empty.';
          renderOwnerActions();
          return;
        }

        const previousSavedOwnerReferenceName = savedOwnerReferenceName;
        const previousStoreOwnerReferenceName = store.ownerReferenceName;
        const previousStoreOwnerReferenceFallbackName = store.ownerReferenceFallbackName;

        savingOwnerReferenceName = true;
        savedOwnerReferenceName = nextOwnerReferenceName;
        store.ownerReferenceName = nextOwnerReferenceName;
        store.ownerReferenceFallbackName = nextOwnerReferenceName;
        ownerStatus.textContent = 'Saving...';
        renderOwnerActions();

        try {
          const savedOwnerName = await saveOwnerReferenceName(nextOwnerReferenceName);
          savedOwnerReferenceName = savedOwnerName;
          store.ownerReferenceName = savedOwnerName;
          store.ownerReferenceFallbackName = savedOwnerName;
          ownerInput.value = savedOwnerName;
          ownerStatus.textContent = 'Saved.';
        } catch (err) {
          savedOwnerReferenceName = previousSavedOwnerReferenceName;
          store.ownerReferenceName = previousStoreOwnerReferenceName;
          store.ownerReferenceFallbackName = previousStoreOwnerReferenceFallbackName;
          ownerInput.value = previousSavedOwnerReferenceName || getOwnerReferenceFallback();
          ownerStatus.textContent = err.message;
        } finally {
          savingOwnerReferenceName = false;
          renderOwnerActions();
        }
      });
      ownerActions.appendChild(saveBtn);
    }

    on(ownerInput, 'input', () => {
      ownerStatus.textContent = '';
      renderOwnerActions();
    });

    characterSection.appendChild(ownerLabel);
    characterSection.appendChild(ownerInput);
    characterSection.appendChild(ownerActions);
    characterSection.appendChild(ownerStatus);
    characterSection.appendChild(el('hr', { class: 'divider' }));
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
    renderOwnerActions();
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
  const subtitle = el('p', { class: 'secondary' }, 'Manage usage and plans.');

  const usageFold = el('details', { class: 'billing-fold', open: '' });
  const usageSummary = el('summary', { class: 'bold billing-fold-summary' }, 'Usage this month');
  const usageBody = el('div', { class: 'billing-fold-body' });
  usageFold.append(usageSummary, usageBody);

  const planFold = el('details', { class: 'billing-fold' });
  const planSummary = el('summary', { class: 'bold billing-fold-summary' }, 'Plan');
  const planBody = el('div', { class: 'billing-fold-body' });
  planFold.append(planSummary, planBody);

  const statusLine = el('p', { class: 'secondary' });

  on(backBtn, 'click', onBack);

  page.append(header, subtitle, usageFold, planFold, statusLine);
  parent.appendChild(page);

  renderUsage();
  renderPlanControls();

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

}

function ensureBillingDefaults() {
  if (store.monthlyTokenUsage == null) {
    const plan = getSelectedPlan();
    const baseTokens = plan ? getPlanTokenQuota(plan.id) : 100000;
    store.monthlyTokenUsage = Math.round(baseTokens * 0.34);
  }
}

function getBillingUsageSummary() {
  ensureBillingDefaults();
  const selected = getSelectedPlan();
  const totalTokens = selected ? getPlanTokenQuota(selected.id) : 0;
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

function getOwnerReferenceFallback() {
  if (store.ownerReferenceFallbackName) {
    return store.ownerReferenceFallbackName;
  }
  const displayName = store.user?.user_metadata?.display_name;
  if (typeof displayName !== 'string') return '';
  const trimmedName = displayName.trim();
  if (!trimmedName || trimmedName === GENERIC_DISPLAY_NAME) return '';
  return trimmedName;
}
