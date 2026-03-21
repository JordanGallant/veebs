const { getSupabaseAdmin } = require('./supabase-admin.js');
const { HttpError, requireAuthenticatedUser } = require('./request-auth.js');

const CLONE_VOICE_MODEL = 'fal-ai/qwen-3-tts/clone-voice/0.6b';
const TTS_MODEL = 'fal-ai/qwen-3-tts/text-to-speech/0.6b';
const FABRIC_MODEL = 'veed/fabric-1.0';
const VIRTUAL_CAMERA_SERVER = 'http://127.0.0.1:9999';

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/**
 * POST /api/join-meeting
 *
 * Full automated flow:
 *   1. Generate lip-synced video from agent's cyborg portrait + cloned voice
 *   2. Send video to local virtual camera server (OBS)
 *   3. Return meeting URL for frontend to open in new tab
 *
 * Body:
 *   - agentId (string, required) — Supabase agent UUID
 *   - meetingUrl (string, required) — Google Meet / Zoom link
 *   - script (string, optional) — what the agent says (auto-generates if omitted)
 *   - resolution (string, optional) — "480p" (default) or "720p"
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'FAL_KEY not configured.' });
  }

  let user, supabase;
  try {
    ({ user, supabase } = await requireAuthenticatedUser(req));
  } catch (err) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    return sendJson(res, status, { error: err.message || 'Unauthorized.' });
  }

  const { agentId, meetingUrl, script: userScript, resolution: rawRes } = parseBody(req);
  const resolution = rawRes === '720p' ? '720p' : '480p';

  if (!agentId) return sendJson(res, 400, { error: 'agentId is required.' });
  if (!meetingUrl) return sendJson(res, 400, { error: 'meetingUrl is required.' });

  // Check virtual camera server is running
  try {
    const health = await fetch(`${VIRTUAL_CAMERA_SERVER}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!health.ok) throw new Error('not ok');
  } catch {
    return sendJson(res, 503, {
      error: 'Virtual camera server not running.',
      hint: 'Start it with: python virtual-camera-server.py',
    });
  }

  // Get agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, name, personality, profile_image_url')
    .eq('id', agentId)
    .single();

  if (!agent) return sendJson(res, 404, { error: 'Agent not found.' });
  if (agent.user_id !== user.id) return sendJson(res, 403, { error: 'Not your agent.' });

  let fal;
  try {
    ({ fal } = await import('@fal-ai/client'));
  } catch {
    return sendJson(res, 500, { error: 'Could not load @fal-ai/client.' });
  }
  fal.config({ credentials: apiKey });

  // Step 1: Get portrait image
  let falImageUrl;
  try {
    let imageUrl = agent.profile_image_url;
    if (!imageUrl) {
      return sendJson(res, 400, { error: 'Agent has no portrait. Complete onboarding first.' });
    }

    if (!imageUrl.startsWith('http')) {
      const { data: signed } = await supabase.storage
        .from('profile-images')
        .createSignedUrl(imageUrl, 60 * 30);
      imageUrl = signed?.signedUrl;
    }
    if (!imageUrl) return sendJson(res, 400, { error: 'Could not resolve portrait.' });

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const imgBlob = new Blob([new Uint8Array(imgBuffer)], { type: contentType });
    falImageUrl = await fal.storage.upload(imgBlob);
  } catch (err) {
    return sendJson(res, 502, { error: `Portrait upload failed: ${err.message}` });
  }

  // Auto-generate script if not provided
  const script = userScript?.trim() || generateScript(agent.name, agent.personality);

  // Step 2: Check for voice reference audio
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_audio_path')
    .eq('id', agent.user_id)
    .single();

  let videoUrl;
  let mode;

  // Always use voice clone with demo.mp3 for now
  {
    mode = 'voice_clone';

    let falAudioRefUrl;
    try {
      const fs = require('fs');
      const path = require('path');
      const demoPath = path.join(__dirname, 'demo.mp3');
      const audioBuffer = fs.readFileSync(demoPath);
      const audioFile = new Blob([audioBuffer], { type: 'audio/mpeg' });
      falAudioRefUrl = await fal.storage.upload(audioFile);
    } catch (err) {
      return sendJson(res, 502, { error: `Demo audio upload failed: ${err.message}` });
    }

    // Step 1: Clone voice → speaker embedding
    let speakerEmbeddingUrl;
    try {
      const cloneResult = await fal.subscribe(CLONE_VOICE_MODEL, {
        input: {
          audio_url: falAudioRefUrl,
          reference_text: 'this is jordan gallants bot he wants to say hello',
        },
      });
      speakerEmbeddingUrl = cloneResult?.data?.speaker_embedding?.url || '';
      if (!speakerEmbeddingUrl) return sendJson(res, 502, { error: 'Voice clone returned no embedding.' });
    } catch (err) {
      return sendJson(res, 502, { error: `Voice cloning failed: ${err.message}` });
    }

    // Step 2: TTS with cloned voice
    let clonedSpeechUrl;
    try {
      const ttsResult = await fal.subscribe(TTS_MODEL, {
        input: {
          text: script,
          speaker_voice_embedding_file_url: speakerEmbeddingUrl,
          language: 'English',
        },
      });
      clonedSpeechUrl = ttsResult?.data?.audio?.url || '';
      if (!clonedSpeechUrl) return sendJson(res, 502, { error: 'TTS returned no audio.' });
    } catch (err) {
      return sendJson(res, 502, { error: `TTS failed: ${err.message}` });
    }

    // Step 3: Fabric lip-sync
    try {
      const result = await fal.subscribe(FABRIC_MODEL, {
        input: { image_url: falImageUrl, audio_url: clonedSpeechUrl, resolution },
      });
      videoUrl = result?.data?.video?.url;
      if (!videoUrl) return sendJson(res, 502, { error: 'Fabric returned no video.' });
    } catch (err) {
      return sendJson(res, 502, { error: `Video generation failed: ${err.message}` });
    }
  }

  // Step 3: Tell virtual camera server to start streaming
  let cameraResult = {};
  try {
    const camRes = await fetch(`${VIRTUAL_CAMERA_SERVER}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: videoUrl }),
    });
    cameraResult = await camRes.json();
  } catch (err) {
    return sendJson(res, 502, {
      error: `Video generated but camera failed: ${err.message}`,
      video_url: videoUrl,
      hint: 'Start virtual-camera-server.py and try again.',
    });
  }

  return sendJson(res, 200, {
    success: true,
    meeting_url: meetingUrl,
    video_url: videoUrl,
    camera: cameraResult,
    script,
    resolution,
    mode,
    agent_name: agent.name,
  });
};

function generateScript(name, personality) {
  const intro = `Hello everyone, I'm ${name}, a digital twin.`;
  if (personality) {
    const snippet = personality.slice(0, 200).replace(/\n/g, ' ');
    return `${intro} ${snippet}`;
  }
  return `${intro} I can attend meetings and represent my human in the digital world. Nice to meet you all!`;
}
