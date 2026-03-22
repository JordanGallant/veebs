import { el } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';
import { createCyborgPortraitFromSnapshot } from '../lib/fal-edit.js';
import { getActiveSessionUser, isEmailVerified, saveProfileImage, generateSoul, updateProfile, getProfile, loadOnboardingPhoto } from '../lib/api.js';

const BIRTHING_MESSAGES = [
  'Analyzing voice patterns...',
  'Cloning voice signature...',
  'Mapping facial features...',
  'Generating soul...',
  'Initializing neural pathways...',
  'Calibrating empathy circuits...',
  'Generating cyborg portrait...',
  'Weaving personality threads...',
  'Bootstrapping consciousness...',
];

let cam = null;
let revealTimer = 0;
let startTimer = 0;
let msgTimer = 0;
let exitTimer = 0;
let stopHeadingType = null;

export function registerBirthing() {
  registerScreen('birthing', {
    render,
    cleanup() {
      if (cam) {
        cam.stop();
        if (cam.el.parentNode) cam.el.parentNode.removeChild(cam.el);
      }
      cam = null;
      clearTimeout(revealTimer);
      clearTimeout(startTimer);
      clearInterval(msgTimer);
      clearTimeout(exitTimer);
      if (stopHeadingType) stopHeadingType();
      stopHeadingType = null;
    },
  });
}

async function generateAndSavePortrait(status) {
  // Use the photo taken during recording, or fetch from Supabase if cleared
  let photoBlob = store.photoBlob;
  if (!photoBlob) {
    photoBlob = await loadOnboardingPhoto();
  }
  if (!photoBlob) return;

  try {
    status.textContent = 'Generating cyborg portrait...';
    const result = await createCyborgPortraitFromSnapshot(photoBlob);

    if (result?.imageUrl || result?.storagePath || result?.blob) {
      store.photoBlob = result.blob || null;
      store.photoUrl = result.blob ? URL.createObjectURL(result.blob) : null;

      try {
        if (result.storagePath) {
          await saveProfileImage(result.storagePath);
        }
      } catch (err) {
        console.warn('Could not persist profile image:', err.message);
      }
    }
  } catch (err) {
    console.warn('Portrait generation failed:', err.message);
    // Continue anyway — user keeps their original photo
  }
}

async function render(container) {
  console.log('[Birthing] pendingTwinBirth:', store.pendingTwinBirth, 'agentId:', store.agentId);
  if (!store.pendingTwinBirth) {
    console.log('[Birthing] No pendingTwinBirth — redirecting to welcome');
    navigate('welcome');
    return;
  }
  const sessionUser = await getActiveSessionUser();
  if (!sessionUser) {
    console.log('[Birthing] No session — redirecting to auth');
    navigate('auth');
    return;
  }
  // Email verification disabled for hackathon
  if (!store.agentId) {
    console.log('[Birthing] No agentId — redirecting to dashboard');
    navigate('dashboard');
    return;
  }
  console.log('[Birthing] Starting birthing flow for agent:', store.agentId);

  cam = createAsciiCamera({
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-xl bold birthing-heading' }, '');
  const status = el('p', { class: 'birthing-status' }, BIRTHING_MESSAGES[0]);
  const panel = el('div', { class: 'overlay-panel overlay-panel--compact overlay-shell' }, heading, status);
  const content = el('div', { class: 'birthing-content screen-content' }, panel);
  const wrapper = el('div', { class: 'screen recording-screen screen-shell' }, content);

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  container.appendChild(wrapper);
  cam.startBody();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Birthing Your Twin...', {
      speed: 30,
      swap: false,
    });
  }, 300);

  startTimer = window.setTimeout(() => {
    if (cam) cam.beginBirthing();
  }, 520);

  let msgIdx = 0;
  msgTimer = window.setInterval(() => {
    msgIdx = (msgIdx + 1) % BIRTHING_MESSAGES.length;
    status.textContent = BIRTHING_MESSAGES[msgIdx];
  }, 1200);

  // Step 1: Generate cyborg portrait
  const portraitPromise = generateAndSavePortrait(status);

  // Step 2: Transcribe audio + generate soul (all via fal.ai)
  const soulPromise = (async () => {
    if (store.audioBlob) {
      store.voiceRefAudioBlob = store.audioBlob;
    }

    try {
      // Save onboarding answers first
      if (store.characterProfile) {
        await updateProfile({ onboarding_character_profile: store.characterProfile });
      }
    } catch (err) {
      console.warn('Profile update failed:', err.message);
    }

    // Generate soul via local API (transcribes audio via fal Whisper + builds personality)
    try {
      const { supabase } = await import('../lib/supabase.js');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (store.agentId && token) {
        status.textContent = 'Transcribing voice & generating soul...';
        const soulRes = await fetch('/api/generate-soul', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ agentId: store.agentId }),
        });

        if (soulRes.ok) {
          const soulData = await soulRes.json();
          if (soulData.personality) {
            store.characterProfile = soulData.personality;
          }
          if (soulData.transcript) {
            store.voiceTranscript = soulData.transcript;
          }
        }
      }
    } catch (err) {
      console.warn('Soul generation failed:', err.message);
    }
  })();

  // Wait for portrait + profile, then generate video
  const minWait = new Promise((r) => setTimeout(r, 5600));

  Promise.all([minWait, portraitPromise, soulPromise]).then(async () => {
    // Step 3: Generate lip-synced video from portrait + voice
    status.textContent = 'Generating your twin video...';
    try {
      const session = await import('@supabase/supabase-js').then(() => {
        // Get auth token for API call
        return null; // We'll get it from supabase below
      }).catch(() => null);

      const { supabase } = await import('../lib/supabase.js');
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      if (store.agentId && token) {
        // Use the personality as the script — it's already a natural spoken intro
        const personality = store.characterProfile || '';
        const script = personality.length > 20
          ? personality.slice(0, 500)
          : `Hey, I'm ${store.name || 'your CyberTwin'}. I'm a digital twin, here to represent my human. Nice to meet you!`;

        status.textContent = 'Generating lip-synced video... (this takes ~60s)';

        const videoRes = await fetch('/api/generate-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            agentId: store.agentId,
            script,
            resolution: '480p',
          }),
        });

        if (videoRes.ok) {
          const videoData = await videoRes.json();
          store.twinVideoUrl = videoData.video_signed_url || videoData.video_url;
          status.textContent = 'Twin video ready!';

          // Try to start virtual camera if server is running
          try {
            const camHealth = await fetch('http://127.0.0.1:9999/health', {
              signal: AbortSignal.timeout(1000),
            });
            if (camHealth.ok) {
              status.textContent = 'Starting virtual camera...';
              await fetch('http://127.0.0.1:9999/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_url: videoData.video_url }),
              });
              status.textContent = 'Virtual camera streaming!';
            }
          } catch {
            // Virtual camera server not running — that's fine
            console.log('Virtual camera server not running — skip auto-start');
          }
        } else {
          const err = await videoRes.json().catch(() => ({}));
          console.error('Video generation failed:', JSON.stringify(err));
          status.textContent = `Video failed: ${err.error || videoRes.status}`;
          // Wait 3s so user can see the error
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    } catch (err) {
      console.warn('Video generation error:', err.message);
      status.textContent = 'Continuing to dashboard...';
    }

    // Navigate to dashboard
    clearInterval(msgTimer);
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    exitTimer = window.setTimeout(() => {
      store.pendingTwinBirth = false;
      navigate('dashboard');
    }, 420);
  });
}
