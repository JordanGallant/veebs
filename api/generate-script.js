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
 * POST /api/generate-script
 *
 * Generate a meeting script for the agent using its personality + context.
 * Uses OpenAI-compatible API (works with LiteLLM, OpenAI, etc.)
 *
 * Body:
 *   - agentId (string, required)
 *   - context (string, optional) — e.g. "team standup", "client intro", "investor pitch"
 *   - duration (string, optional) — "short" (15s), "medium" (30s, default), "long" (60s)
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.FAL_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'No LLM API key configured (OPENAI_API_KEY or FAL_KEY).' });
  }

  let user, supabase;
  try {
    ({ user, supabase } = await requireAuthenticatedUser(req));
  } catch (err) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    return sendJson(res, status, { error: err.message || 'Unauthorized.' });
  }

  const { agentId, context, duration: rawDuration } = parseBody(req);
  if (!agentId) return sendJson(res, 400, { error: 'agentId is required.' });

  const wordCount = rawDuration === 'short' ? 30 : rawDuration === 'long' ? 120 : 60;

  // Get agent + profile data
  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, name, personality, description')
    .eq('id', agentId)
    .single();

  if (!agent) return sendJson(res, 404, { error: 'Agent not found.' });
  if (agent.user_id !== user.id) return sendJson(res, 403, { error: 'Not your agent.' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('twin_name, owner_reference_name, onboarding_answers, onboarding_character_profile, voice_transcript')
    .eq('id', user.id)
    .single();

  // Build context for the LLM
  const agentName = agent.name || profile?.twin_name || 'CyberTwin';
  const ownerName = profile?.owner_reference_name || '';
  const personality = agent.personality || profile?.onboarding_character_profile || '';
  const transcript = profile?.voice_transcript || '';
  const answers = profile?.onboarding_answers;

  let personalityContext = '';
  if (personality) personalityContext += `Personality: ${personality}\n`;
  if (transcript) personalityContext += `Voice recording transcript: "${transcript}"\n`;
  if (answers && typeof answers === 'object') {
    const entries = Object.entries(answers);
    if (entries.length > 0) {
      personalityContext += 'Onboarding Q&A:\n';
      for (const [q, a] of entries) {
        if (a) personalityContext += `  ${q}: ${a}\n`;
      }
    }
  }

  const meetingContext = context ? `Meeting context: ${context}` : 'A general meeting introduction';

  const prompt = `You are writing a script for a digital twin named "${agentName}"${ownerName ? ` (representing ${ownerName})` : ''} to speak in a video call meeting.

${personalityContext}
${meetingContext}

Write a natural, conversational meeting script in first person (~${wordCount} words). The twin should:
- Introduce itself naturally
- Reference its personality/background authentically
- Be warm and engaging
- Sound like a real person, not robotic

Just output the script text, nothing else. No quotes, no stage directions.`;

  // Call OpenAI-compatible API
  const baseUrl = process.env.LITELLM_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.INFERENCE_MODEL || 'gpt-4o-mini';

  try {
    const llmRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text().catch(() => '');
      return sendJson(res, 502, { error: `LLM error: ${llmRes.status}`, detail: err });
    }

    const llmData = await llmRes.json();
    const script = llmData.choices?.[0]?.message?.content?.trim() || '';

    if (!script) {
      return sendJson(res, 502, { error: 'LLM returned empty response.' });
    }

    return sendJson(res, 200, {
      success: true,
      script,
      agent_name: agentName,
      word_count: script.split(/\s+/).length,
    });
  } catch (err) {
    return sendJson(res, 502, { error: `Script generation failed: ${err.message}` });
  }
};
