export interface AudioRecorder {
  start(): void;
  stop(): Promise<Blob>;
  isRecording(): boolean;
}

export function createAudioRecorder(stream: MediaStream): AudioRecorder {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recording = false;

  return {
    start(): void {
      chunks = [];
      const mime = getSupportedMime();
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(100);
      recording = true;
    },

    stop(): Promise<Blob> {
      return new Promise((resolve) => {
        if (!recorder || recorder.state === 'inactive') {
          resolve(new Blob(chunks));
          return;
        }
        recorder.onstop = () => {
          recording = false;
          resolve(new Blob(chunks, { type: recorder!.mimeType }));
        };
        recorder.stop();
      });
    },

    isRecording(): boolean {
      return recording;
    },
  };
}

function getSupportedMime(): string | null {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}
