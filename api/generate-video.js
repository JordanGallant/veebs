const { getSupabaseAdmin } = require('./supabase-admin.js');
const { HttpError, requireAuthenticatedUser } = require('./request-auth.js');

const CLONE_VOICE_MODEL = 'fal-ai/qwen-3-tts/clone-voice/0.6b';
const TTS_MODEL = 'fal-ai/qwen-3-tts/text-to-speech/0.6b';
const FABRIC_MODEL = 'veed/fabric-1.0';

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
 * POST /api/generate-video
 *
 * Generate a lip-synced talking-head video from the agent's portrait + voice.
 *
 * Pipeline (all fal.ai):
 *   1. Get agent portrait from Supabase Storage
 *   2. Get onboarding audio for voice reference
 *   3. Lux TTS: text + voice reference → cloned speech
 *   4. Fabric 1.0: portrait + speech → lip-synced MP4
 *   5. Store MP4 in Supabase Storage (agent-videos bucket)
 *
 * Body:
 *   - agentId (string, required) — Supabase agent UUID
 *   - script (string, required) — what the agent says (max 2000 chars)
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

  const { agentId, script, resolution: rawRes, referenceText: bodyRefText } = parseBody(req);
  const resolution = rawRes === '720p' ? '720p' : '480p';
  // Reference text: what was said in the demo.mp3 — helps Qwen learn the voice better
  const referenceText = bodyRefText || 'this is jordan gallants bot he wants to say hello';

  if (!agentId) return sendJson(res, 400, { error: 'agentId is required.' });
  if (!script || typeof script !== 'string' || !script.trim()) {
    return sendJson(res, 400, { error: 'script is required.' });
  }
  if (script.length > 2000) {
    return sendJson(res, 400, { error: 'script too long (max 2000 chars).' });
  }

  // Get agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, name, profile_image_url')
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

  // Step 1: Get portrait image and upload to fal
  let falImageUrl;
  try {
    let imageUrl = agent.profile_image_url;
    if (!imageUrl) {
      return sendJson(res, 400, { error: 'Agent has no portrait. Complete onboarding first.' });
    }

    // If it's a storage path (not a full URL), get a signed URL
    if (!imageUrl.startsWith('http')) {
      const { data: signed } = await supabase.storage
        .from('profile-images')
        .createSignedUrl(imageUrl, 60 * 30);
      imageUrl = signed?.signedUrl;
    }

    if (!imageUrl) {
      return sendJson(res, 400, { error: 'Could not resolve portrait image URL.' });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const imgBlob = new Blob([new Uint8Array(imgBuffer)], { type: contentType });
    falImageUrl = await fal.storage.upload(imgBlob);
  } catch (err) {
    return sendJson(res, 502, { error: `Portrait upload failed: ${err.message}` });
  }

  // Step 2: Check for onboarding audio (voice cloning)
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_audio_path')
    .eq('id', agent.user_id)
    .single();

  let videoUrl;
  let mode;

  // Voice clone from onboarding audio in Supabase, fallback to demo.mp3
  {
    mode = 'voice_clone';

    let falAudioRefUrl;
    try {
      if (profile?.onboarding_audio_path) {
        // Download from Supabase bucket — upload directly to fal (no ffmpeg needed)
        const { data: audioBlob, error: dlErr } = await supabase.storage
          .from('onboarding-audio')
          .download(profile.onboarding_audio_path);

        if (dlErr || !audioBlob) throw new Error(dlErr?.message || 'No audio in bucket');

        const ext = profile.onboarding_audio_path.split('.').pop() || 'webm';
        const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', webm: 'audio/webm' };
        const audioFile = new Blob([await audioBlob.arrayBuffer()], { type: mimeMap[ext] || 'audio/webm' });
        falAudioRefUrl = await fal.storage.upload(audioFile);
      } else {
        throw new Error('No onboarding audio');
      }
    } catch (err) {
      // Fallback: use demo.mp3 bundled with the app
      console.warn('Onboarding audio failed, using demo.mp3:', err.message);
      try {
        const fs = require('fs');
        const path = require('path');
        const demoPath = path.join(__dirname, 'demo.mp3');
        const audioBuffer = fs.readFileSync(demoPath);
        const audioFile = new Blob([audioBuffer], { type: 'audio/mpeg' });
        falAudioRefUrl = await fal.storage.upload(audioFile);
      } catch (err2) {
        return sendJson(res, 502, { error: `Audio upload failed: ${err2.message}` });
      }
    }

    // Step 1: Clone voice → get speaker embedding
    let speakerEmbeddingUrl;
    try {
      const cloneResult = await fal.subscribe(CLONE_VOICE_MODEL, {
        input: {
          audio_url: falAudioRefUrl,
          reference_text: referenceText,
        },
      });

      const cloneData = cloneResult?.data;
      speakerEmbeddingUrl = cloneData?.speaker_embedding?.url || cloneData?.speaker_embedding_url || '';
      if (!speakerEmbeddingUrl) {
        return sendJson(res, 502, { error: 'Voice clone returned no embedding.' });
      }
    } catch (err) {
      return sendJson(res, 502, { error: `Voice cloning failed: ${err.message}` });
    }

    // Step 2: TTS with cloned voice → generate speech
    let clonedSpeechUrl;
    try {
      const ttsResult = await fal.subscribe(TTS_MODEL, {
        input: {
          text: script.trim(),
          speaker_voice_embedding_file_url: speakerEmbeddingUrl,
          reference_text: referenceText,
          language: 'English',
        },
      });

      const ttsData = ttsResult?.data;
      clonedSpeechUrl = ttsData?.audio?.url || ttsData?.audio_url || '';
      if (!clonedSpeechUrl) {
        return sendJson(res, 502, { error: 'TTS returned no audio.' });
      }
    } catch (err) {
      return sendJson(res, 502, { error: `TTS generation failed: ${err.message}` });
    }

    // Step 3: Fabric lip-sync → video
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

  // Step 5: Store in Supabase Storage
  let storagePath = null;
  let signedUrl = null;
  try {
    const vidRes = await fetch(videoUrl);
    if (!vidRes.ok) throw new Error(`Download failed: ${vidRes.status}`);
    const buffer = Buffer.from(await vidRes.arrayBuffer());

    const videoId = crypto.randomUUID();
    storagePath = `${agentId}/${videoId}.mp4`;

    const { error } = await supabase.storage
      .from('agent-videos')
      .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: false });

    if (!error) {
      const { data: signed } = await supabase.storage
        .from('agent-videos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      signedUrl = signed?.signedUrl || null;

      // Save video URL on the agent record
      await supabase
        .from('agents')
        .update({ video_url: signedUrl || videoUrl })
        .eq('id', agentId);
    }
  } catch {
    // Non-fatal — video was generated, just storage failed
  }

  return sendJson(res, 200, {
    success: true,
    mode,
    video_url: videoUrl,
    video_storage_path: storagePath,
    video_signed_url: signedUrl,
    resolution,
    agent_name: agent.name,
  });
};
