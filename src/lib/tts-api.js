import { blobToWav } from './audio-convert.js';

const HF_SPACE = 'https://huggingfacem4-faster-qwen3-tts-demo.hf.space';
const DEFAULT_API = localStorage.getItem('ttsApiUrl') || HF_SPACE;

export function setApiBase(url) {
  localStorage.setItem('ttsApiUrl', url);
}

export function getApiBase() {
  return localStorage.getItem('ttsApiUrl') || DEFAULT_API;
}

export async function checkStatus() {
  const res = await fetch(`${getApiBase()}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export async function loadModel(modelId = 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice') {
  const form = new FormData();
  form.append('model_id', modelId);

  const res = await fetch(`${getApiBase()}/load`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`Model load failed: ${res.status}`);
  return res.json();
}

export async function transcribeAudio(audioBlob) {
  const wavBlob = await blobToWav(audioBlob);
  const form = new FormData();
  form.append('audio', wavBlob, 'recording.wav');

  const res = await fetch(`${getApiBase()}/transcribe`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`Transcribe failed: ${res.status}`);
  const data = await res.json();
  return data.text;
}

export async function generateSpeech(text, { refAudioBlob, refText = '', language = 'English' } = {}) {
  const form = new FormData();
  form.append('text', text);
  form.append('language', language);
  form.append('mode', 'voice_clone');

  if (refAudioBlob) {
    const wavRef = await blobToWav(refAudioBlob);
    form.append('ref_audio', wavRef, 'voice-sample.wav');
  }
  if (refText) {
    form.append('ref_text', refText);
  }

  const res = await fetch(`${getApiBase()}/generate`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`Speech generation failed: ${res.status}`);
  const data = await res.json();

  const bytes = atob(data.audio_b64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function generateSpeechStream(text, { refAudioBlob, refText = '', language = 'English', onChunk } = {}) {
  const form = new FormData();
  form.append('text', text);
  form.append('language', language);
  form.append('mode', 'voice_clone');

  if (refAudioBlob) {
    const wavRef = await blobToWav(refAudioBlob);
    form.append('ref_audio', wavRef, 'voice-sample.wav');
  }
  if (refText) {
    form.append('ref_text', refText);
  }

  const res = await fetch(`${getApiBase()}/generate/stream`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`Stream generation failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let partial = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    partial += decoder.decode(value, { stream: true });
    const lines = partial.split('\n');
    partial = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const json = trimmed.slice(5).trim();
      if (!json) continue;

      try {
        const event = JSON.parse(json);
        if (event.type === 'chunk' && event.audio_b64 && onChunk) {
          const bytes = atob(event.audio_b64);
          const buf = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
          onChunk(new Blob([buf], { type: 'audio/wav' }), event);
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}
