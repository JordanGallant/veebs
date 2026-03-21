const fs = require('fs');
const path = require('path');

const VIRTUAL_CAMERA_SERVER = 'http://127.0.0.1:9999';

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
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
 * POST /api/start-camera
 *
 * Start the virtual camera with vid.mp4 and open a meeting link.
 * No video generation — just uses the existing video file.
 *
 * Body:
 *   - meetingUrl (string, required)
 */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const { meetingUrl, createMeeting } = parseBody(req);
  if (!meetingUrl && !createMeeting) {
    return sendJson(res, 400, { error: 'meetingUrl or createMeeting:true is required.' });
  }

  // Check virtual camera server is running
  try {
    const health = await fetch(`${VIRTUAL_CAMERA_SERVER}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!health.ok) throw new Error('not ok');
  } catch {
    return sendJson(res, 503, {
      error: 'Virtual camera server not running.',
      hint: 'Run: python virtual-camera-server.py',
    });
  }

  // Use vid.mp4 from api folder
  const videoPath = path.join(__dirname, 'vid.mp4');
  if (!fs.existsSync(videoPath)) {
    return sendJson(res, 404, { error: 'vid.mp4 not found in api/ folder.' });
  }

  // Start virtual camera with the video
  try {
    const camRes = await fetch(`${VIRTUAL_CAMERA_SERVER}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_path: videoPath.replace(/\\/g, '/') }),
    });
    const camData = await camRes.json();

    let finalMeetingUrl = meetingUrl;

    // If createMeeting, tell Playwright to create a Google Meet
    if (createMeeting) {
      try {
        const meetRes = await fetch(`${VIRTUAL_CAMERA_SERVER}/create-meeting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const meetData = await meetRes.json();
        if (meetData.meeting_url) {
          finalMeetingUrl = meetData.meeting_url;
        }
      } catch (err) {
        return sendJson(res, 502, {
          error: `Meeting creation failed: ${err.message}`,
          hint: 'Run python google-login.py first to save your Google session.',
        });
      }
    }

    return sendJson(res, 200, {
      success: true,
      meeting_url: finalMeetingUrl,
      camera: camData,
      created: !!createMeeting,
      hint: 'Select "Unity Video Capture" as camera and "CABLE Output" as mic.',
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: `Camera start failed: ${err.message}`,
      hint: 'Make sure virtual-camera-server.py is running.',
    });
  }
};
