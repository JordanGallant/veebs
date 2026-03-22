const { getSupabaseAdmin } = require('./supabase-admin.js');
const { HttpError, requireAuthenticatedUser } = require('./request-auth.js');

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
 * POST /api/generate-soul
 *
 * Generate a personality profile (soul) for an agent.
 *
 * Pipeline:
 *   1. Download onboarding audio from Supabase
 *   2. Transcribe via fal.ai Whisper
 *   3. Combine transcript + onboarding answers into a personality profile
 *   4. Save to Supabase agent.personality
 *
 * Body:
 *   - agentId (string, required) — Supabase agent UUID
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

  const { agentId } = parseBody(req);
  if (!agentId) return sendJson(res, 400, { error: 'agentId is required.' });

  // Get agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, name, personality')
    .eq('id', agentId)
    .single();

  if (!agent) return sendJson(res, 404, { error: 'Agent not found.' });
  if (agent.user_id !== user.id) return sendJson(res, 403, { error: 'Not your agent.' });

  // Get profile with onboarding data
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_audio_path, onboarding_answers, onboarding_character_profile, twin_name, owner_reference_name')
    .eq('id', user.id)
    .single();

  let fal;
  try {
    ({ fal } = await import('@fal-ai/client'));
  } catch {
    return sendJson(res, 500, { error: 'Could not load @fal-ai/client.' });
  }
  fal.config({ credentials: apiKey });

  // Step 1: Transcribe onboarding audio if available
  let transcript = '';
  if (profile?.onboarding_audio_path) {
    try {
      // Get a signed URL for the audio
      const { data: signed } = await supabase.storage
        .from('onboarding-audio')
        .createSignedUrl(profile.onboarding_audio_path, 60 * 30);

      if (signed?.signedUrl) {
        const whisperResult = await fal.subscribe('fal-ai/whisper', {
          input: {
            audio_url: signed.signedUrl,
            task: 'transcribe',
            chunk_level: 'segment',
          },
        });

        transcript = whisperResult?.data?.text || '';
        if (transcript) {
          // Save transcript to profile
          await supabase.from('profiles').update({ voice_transcript: transcript }).eq('id', user.id);
        }
      }
    } catch (err) {
      console.warn('Whisper transcription failed:', err.message);
    }
  }

  // Step 2: Build personality from all available data
  const answers = profile?.onboarding_answers;
  const existingProfile = profile?.onboarding_character_profile || '';
  const twinName = profile?.twin_name || agent.name || 'CyberTwin';
  const ownerName = profile?.owner_reference_name || '';

  // Build a natural spoken intro from the twin's perspective
  const displayName = twinName === 'Unnamed Twin' ? (ownerName || agent.name || 'your twin') : twinName;
  let personality;

  const parts = [];

  // Twin introduces itself
  if (ownerName) {
    parts.push(`Hey there, I'm ${displayName}, ${ownerName}'s digital twin. I'm here to help ${ownerName} with everything digital so they can focus on the real world.`);
  } else {
    parts.push(`Hey there, I'm ${displayName}, a digital twin. I'm here to help my human with everything digital.`);
  }

  // Rewrite transcript content from twin's perspective
  if (transcript) {
    const clean = transcript
      .replace(/^(yeah|um|uh|so|like|well|okay|ok|hi|hello)[,.\s]*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length > 10) {
      // Reframe: "I want to make money" → "My human wants to make money, and I'm here to help with that"
      parts.push(`My human told me: ${clean}. That's what I'm here to help with.`);
    }
  }

  // Rewrite answers from twin's perspective
  if (answers && typeof answers === 'object') {
    const entries = Object.entries(answers).filter(([q, a]) => a && typeof a === 'string' && a.trim().length > 5);
    for (const [question, answer] of entries) {
      const q = question.toLowerCase();
      const a = answer.trim();
      if (q.includes('goal')) {
        parts.push(`My human's goals are: ${a}. I'll do everything I can to support that.`);
      } else if (q.includes('hobbi') || q.includes('interest')) {
        parts.push(`They're into ${a}, which shapes how I think and communicate.`);
      } else if (q.includes('important')) {
        parts.push(`What matters most to them is ${a}.`);
      } else if (q.includes('duties') || q.includes('twin') || q.includes('handle')) {
        parts.push(`I'm responsible for ${a}.`);
      } else {
        parts.push(a);
      }
    }
  }

  personality = parts.join(' ').replace(/\s+/g, ' ').trim();

  if (personality.length > 500) {
    personality = personality.slice(0, 497) + '...';
  }

  // Save personality to agent
  await supabase
    .from('agents')
    .update({ personality })
    .eq('id', agentId);

  return sendJson(res, 200, {
    success: true,
    agent_name: twinName,
    personality,
    transcript: transcript || null,
    has_audio: !!profile?.onboarding_audio_path,
  });
};
