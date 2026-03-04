export function createAudioRecorder(stream) {
  let recorder = null;
  let chunks = [];
  let recording = false;
  let recordedMimeType = '';

  return {
    start() {
      if (recording) return;

      chunks = [];
      const audioTracks = stream.getAudioTracks().filter((track) => track.readyState === 'live');
      if (audioTracks.length === 0) {
        throw new Error('No live audio track available.');
      }

      const audioOnlyStream = new MediaStream(audioTracks);
      const candidates = getSupportedMimes();
      let lastError = null;

      for (const mimeType of [...candidates, null]) {
        try {
          recorder = mimeType
            ? new MediaRecorder(audioOnlyStream, { mimeType })
            : new MediaRecorder(audioOnlyStream);
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.start();
          recordedMimeType = recorder.mimeType || mimeType || '';
          recording = true;
          return;
        } catch (err) {
          lastError = err;
          recorder = null;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new DOMException('There was an error starting the MediaRecorder.', 'NotSupportedError');
    },

    stop() {
      return new Promise((resolve) => {
        if (!recorder || recorder.state === 'inactive') {
          resolve(new Blob(chunks, { type: recordedMimeType || 'audio/webm' }));
          return;
        }
        recorder.onstop = () => {
          recording = false;
          const blobType = recorder?.mimeType || recordedMimeType || 'audio/webm';
          resolve(new Blob(chunks, { type: blobType }));
          recorder = null;
        };
        recorder.stop();
      });
    },

    isRecording() {
      return recording;
    },
  };
}

function getSupportedMimes() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return types.filter((t) => MediaRecorder.isTypeSupported(t));
}
