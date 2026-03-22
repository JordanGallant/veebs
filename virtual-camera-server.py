"""
CyberTwin Virtual Camera + Audio Server

Streams video to Unity Capture virtual camera and audio to VB-CABLE virtual microphone.
Google Meet sees both as camera + mic input.

Endpoints:
  POST /start { video_path }  → load video, show idle portrait
  POST /play                  → play video + audio synced
  POST /stop                  → stop everything
  GET  /status                → current state
  GET  /health                → alive check
"""

import os
import sys
import json
import threading
import time
import tempfile
import wave
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    import cv2
    import numpy as np
    import pyvirtualcam
    import sounddevice as sd
except ImportError:
    print("Missing dependencies. Run:")
    print("  pip install pyvirtualcam opencv-python numpy sounddevice")
    sys.exit(1)

import requests

PORT = 9999

# State
camera_thread = None
stop_event = threading.Event()
play_event = threading.Event()
current_status = {"streaming": False, "mode": "off", "video": None, "error": None}
idle_frame = None
audio_data = None
audio_samplerate = None
vb_cable_device = None


def find_vb_cable_output():
    """Find the VB-CABLE input device (where we send audio TO). Prefer WASAPI 2-channel."""
    devices = sd.query_devices()
    # Prefer WASAPI (2-channel) devices — they actually work
    for i, d in enumerate(devices):
        name = d['name'].lower()
        if 'vb-audio' in name and 'speaker' in name and d['max_output_channels'] == 2:
            return i
    for i, d in enumerate(devices):
        name = d['name'].lower()
        if 'cable in' in name and d['max_output_channels'] == 2:
            return i
    # Fallback to any VB-Audio output
    for i, d in enumerate(devices):
        name = d['name'].lower()
        if 'vb-audio' in name and d['max_output_channels'] > 0:
            return i
    return None


def extract_audio_from_video(video_path):
    """Extract audio from video as WAV using ffmpeg."""
    wav_path = video_path + ".audio.wav"
    if os.path.exists(wav_path):
        return wav_path

    # Find ffmpeg
    ffmpeg = "ffmpeg"
    # Check common Windows paths
    for p in [
        os.path.expanduser("~/Desktop/ffmpeg/bin/ffmpeg.exe"),
        r"C:\ffmpeg\bin\ffmpeg.exe",
        "ffmpeg",
    ]:
        if os.path.exists(p):
            ffmpeg = p
            break

    try:
        subprocess.run(
            [ffmpeg, "-i", video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1", wav_path, "-y"],
            capture_output=True, timeout=30,
        )
        if os.path.exists(wav_path):
            return wav_path
    except Exception as e:
        print(f"[Audio] ffmpeg failed: {e}")

    return None


def load_audio(video_path, audio_path=None):
    """Load audio data for playback. Uses separate audio file or extracts from video."""
    global audio_data, audio_samplerate

    # Try explicit audio file first (e.g. demo.mp3 converted)
    if audio_path and os.path.exists(audio_path):
        src = audio_path
    else:
        # Extract from video
        src = extract_audio_from_video(video_path)

    if not src or not os.path.exists(src):
        print("[Audio] No audio available")
        return False

    try:
        with wave.open(src, 'rb') as wf:
            frames = wf.readframes(wf.getnframes())
            audio_data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            audio_samplerate = wf.getframerate()
            channels = wf.getnchannels()
            if channels > 1:
                audio_data = audio_data.reshape(-1, channels)[:, 0]  # mono
            duration = len(audio_data) / audio_samplerate
            print(f"[Audio] Loaded {duration:.1f}s audio @ {audio_samplerate}Hz")
            return True
    except Exception as e:
        print(f"[Audio] Failed to load: {e}")
        return False


def play_audio_to_vb_cable():
    """Play audio through VB-CABLE virtual microphone."""
    global vb_cable_device

    if audio_data is None:
        print("[Audio] No audio loaded — skipping")
        return

    if vb_cable_device is None:
        vb_cable_device = find_vb_cable_output()

    if vb_cable_device is None:
        print("[Audio] VB-CABLE not found — skipping audio")
        return

    try:
        device_name = sd.query_devices(vb_cable_device)['name']
        target_sr = int(sd.query_devices(vb_cable_device)['default_samplerate'])
        print(f"[Audio] Playing to: {device_name} @ {target_sr}Hz")

        # Resample if needed
        play_data = audio_data
        if audio_samplerate != target_sr:
            from scipy.signal import resample
            new_length = int(len(audio_data) * target_sr / audio_samplerate)
            play_data = resample(audio_data, new_length).astype(np.float32)
            print(f"[Audio] Resampled {audio_samplerate}Hz → {target_sr}Hz")

        sd.play(play_data, samplerate=target_sr, device=vb_cable_device)
    except Exception as e:
        print(f"[Audio] Playback error: {e}")


def download_file(url, dest):
    """Download file from URL."""
    print(f"[Download] {url[:80]}...")
    res = requests.get(url, stream=True, timeout=120)
    res.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in res.iter_content(chunk_size=8192):
            f.write(chunk)
    size_mb = os.path.getsize(dest) / (1024 * 1024)
    print(f"[Download] Saved {size_mb:.1f} MB to {dest}")
    return dest


def get_idle_frame(width, height):
    global idle_frame
    if idle_frame is not None:
        resized = cv2.resize(idle_frame, (width, height))
        return cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    return np.zeros((height, width, 3), dtype=np.uint8)


def stream_loop(vid_path, img_path=None):
    global current_status, idle_frame

    cap = cv2.VideoCapture(vid_path)
    if not cap.isOpened():
        current_status = {"streaming": False, "mode": "error", "video": vid_path, "error": "Could not open video"}
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    cap.release()

    # Load portrait
    if img_path and os.path.exists(img_path):
        idle_frame = cv2.imread(img_path)
    else:
        tmp_cap = cv2.VideoCapture(vid_path)
        ret, frame = tmp_cap.read()
        if ret:
            idle_frame = frame
            print("[Camera] Using first video frame as idle portrait")
        tmp_cap.release()

    # Load pre-extracted audio from video.mp4
    vid_audio = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'api', 'video-audio.wav')
    load_audio(vid_path, vid_audio)

    print(f"[Camera] Starting virtual camera: {width}x{height} @ {fps:.0f}fps")

    try:
        with pyvirtualcam.Camera(width=width, height=height, fps=fps, backend='unitycapture') as cam:
            print(f"[Camera] Active: {cam.device}")
            print(f"[Camera] Mode: IDLE (showing portrait)")
            print(f"[Camera] POST /play to start speaking")
            current_status = {
                "streaming": True,
                "mode": "idle",
                "video": vid_path,
                "error": None,
                "device": cam.device,
            }

            while not stop_event.is_set():
                if play_event.is_set():
                    play_event.clear()
                    current_status["mode"] = "playing"
                    print("[Camera] PLAYING video + audio...")

                    # Start audio playback (async, plays in background)
                    play_audio_to_vb_cable()

                    # Play video frames
                    play_cap = cv2.VideoCapture(vid_path)
                    while not stop_event.is_set():
                        ret, frame = play_cap.read()
                        if not ret:
                            break
                        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        cam.send(frame_rgb)
                        cam.sleep_until_next_frame()
                    play_cap.release()

                    # Stop any remaining audio
                    try:
                        sd.stop()
                    except:
                        pass

                    current_status["mode"] = "idle"
                    print("[Camera] Video finished → back to IDLE")

                else:
                    idle_rgb = get_idle_frame(width, height)
                    cam.send(idle_rgb)
                    cam.sleep_until_next_frame()

    except Exception as e:
        current_status = {"streaming": False, "mode": "error", "video": vid_path, "error": str(e)}
        print(f"[Camera] Error: {e}")
    finally:
        current_status["streaming"] = False
        current_status["mode"] = "off"
        print("[Camera] Stopped")


meet_browser = None

def join_meeting_with_playwright(meeting_url):
    """Join a Google Meet with virtual camera + mic using Playwright."""
    global meet_browser

    session_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.google-session')
    if not os.path.exists(session_dir):
        print("[Meet] No Google session. Run: python google-login.py")
        return

    try:
        from playwright.sync_api import sync_playwright

        print(f"[Meet] Joining {meeting_url}...")

        pw = sync_playwright().start()
        browser = pw.chromium.launch_persistent_context(
            session_dir,
            headless=False,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--use-fake-ui-for-media-stream',  # auto-grant camera/mic
            ],
            permissions=['camera', 'microphone'],
            ignore_default_args=['--mute-audio'],
        )
        meet_browser = browser

        page = browser.new_page()
        page.goto(meeting_url, wait_until='networkidle', timeout=20000)
        print("[Meet] Page loaded")

        # Dismiss any popups
        time.sleep(2)
        try:
            page.locator('button:has-text("Dismiss")').first.click(timeout=2000)
        except:
            pass
        try:
            page.locator('button:has-text("Got it")').first.click(timeout=2000)
        except:
            pass

        # Turn off mic and camera initially (we control them via virtual devices)
        time.sleep(1)
        try:
            # Mic toggle
            mic_btn = page.locator('[data-is-muted="false"][aria-label*="microphone" i]').first
            mic_btn.click(timeout=2000)
            print("[Meet] Muted mic")
        except:
            pass

        try:
            # Camera toggle
            cam_btn = page.locator('[data-is-muted="false"][aria-label*="camera" i]').first
            cam_btn.click(timeout=2000)
            print("[Meet] Turned off camera")
        except:
            pass

        # Click "Join now" or "Ask to join"
        time.sleep(1)
        joined = False
        for text in ['Join now', 'Ask to join', 'Switch here']:
            try:
                btn = page.locator(f'button:has-text("{text}")').first
                btn.click(timeout=3000)
                print(f"[Meet] Clicked '{text}'")
                joined = True
                break
            except:
                continue

        if not joined:
            # Try any primary action button
            try:
                page.locator('[jsname="Qx7uuf"]').first.click(timeout=3000)
                print("[Meet] Clicked join button (jsname)")
                joined = True
            except:
                print("[Meet] Could not find join button")

        if joined:
            print("[Meet] Twin is in the meeting!")
            print("[Meet] POST /play to make the twin speak")

            # Now unmute mic (VB-CABLE) and enable camera (Unity Capture)
            time.sleep(2)
            try:
                mic_btn = page.locator('[data-is-muted="true"][aria-label*="microphone" i]').first
                mic_btn.click(timeout=2000)
                print("[Meet] Unmuted mic (VB-CABLE)")
            except:
                pass

            try:
                cam_btn = page.locator('[data-is-muted="true"][aria-label*="camera" i]').first
                cam_btn.click(timeout=2000)
                print("[Meet] Turned on camera (Unity Capture)")
            except:
                pass

        # Keep browser open until stop
        while not stop_event.is_set():
            time.sleep(1)

        browser.close()
        pw.stop()
        meet_browser = None

    except Exception as e:
        print(f"[Meet] Error: {e}")
        import traceback
        traceback.print_exc()


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/status":
            self._json(200, current_status)
        elif path == "/health":
            self._json(200, {"ok": True, "port": PORT})
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        global camera_thread, stop_event, play_event, current_status
        path = self.path.split("?")[0]

        if path == "/start":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}

            vid_url = body.get("video_url")
            vid_file = body.get("video_path")
            img_url = body.get("image_url")
            img_file = body.get("image_path")

            if not vid_url and not vid_file:
                self._json(400, {"error": "video_url or video_path required"})
                return

            # Stop existing
            if camera_thread and camera_thread.is_alive():
                stop_event.set()
                camera_thread.join(timeout=5)

            # Download if URL
            if vid_url and not vid_file:
                vid_file = os.path.join(tempfile.gettempdir(), "cybertwin_stream.mp4")
                try:
                    download_file(vid_url, vid_file)
                except Exception as e:
                    self._json(502, {"error": f"Video download failed: {e}"})
                    return

            if img_url and not img_file:
                img_file = os.path.join(tempfile.gettempdir(), "cybertwin_portrait.png")
                try:
                    download_file(img_url, img_file)
                except:
                    img_file = None

            if not os.path.exists(vid_file):
                self._json(404, {"error": f"Video not found: {vid_file}"})
                return

            stop_event = threading.Event()
            play_event = threading.Event()
            camera_thread = threading.Thread(target=stream_loop, args=(vid_file, img_file), daemon=True)
            camera_thread.start()
            time.sleep(1.5)

            self._json(200, {
                "success": True,
                "mode": "idle",
                "streaming": current_status.get("streaming", False),
                "device": current_status.get("device"),
            })
            return

        if path == "/play":
            if not camera_thread or not camera_thread.is_alive():
                self._json(409, {"error": "Camera not running. POST /start first."})
                return
            if current_status.get("mode") == "playing":
                self._json(409, {"error": "Already playing"})
                return
            play_event.set()
            self._json(200, {"success": True, "mode": "playing"})
            return

        if path == "/create-meeting":
            # Create a Google Meet, join with virtual camera + mic, return link
            threading.Thread(target=self._handle_create_meeting, daemon=True).start()
            # Wait for meeting URL
            for _ in range(30):
                time.sleep(1)
                if current_status.get("meeting_url"):
                    self._json(200, {
                        "success": True,
                        "meeting_url": current_status["meeting_url"],
                    })
                    return
            self._json(504, {"error": "Timed out waiting for meeting to be created"})
            return

        if path == "/join-meeting":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}
            meeting_url = body.get("meeting_url")

            if not meeting_url:
                self._json(400, {"error": "meeting_url required"})
                return

            # Start camera if not already running
            if not camera_thread or not camera_thread.is_alive():
                vid_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'api', 'video.mp4')
                if os.path.exists(vid_file):
                    stop_event_copy = threading.Event()
                    play_event_copy = threading.Event()
                    global stop_event, play_event, camera_thread
                    stop_event = stop_event_copy
                    play_event = play_event_copy
                    camera_thread = threading.Thread(target=stream_loop, args=(vid_file, None), daemon=True)
                    camera_thread.start()
                    time.sleep(2)

            # Join meeting in background
            threading.Thread(target=join_meeting_with_playwright, args=(meeting_url,), daemon=True).start()
            time.sleep(3)

            self._json(200, {
                "success": True,
                "meeting_url": meeting_url,
                "hint": "Twin is joining the meeting. Click 'Speak Now' when ready.",
            })
            return

        if path == "/stop":
            if camera_thread and camera_thread.is_alive():
                stop_event.set()
                camera_thread.join(timeout=5)
                self._json(200, {"success": True, "stopped": True})
            else:
                self._json(200, {"success": True, "stopped": False})
            return

        self._json(404, {"error": "Not found"})

    def _handle_create_meeting(self):
        """Create a Google Meet using Playwright with saved session."""
        global current_status
        current_status["meeting_url"] = None

        session_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.google-session')
        if not os.path.exists(session_dir):
            current_status["error"] = "No Google session. Run: python google-login.py"
            return

        try:
            from playwright.sync_api import sync_playwright

            print("[Meet] Launching browser...")
            with sync_playwright() as p:
                browser = p.chromium.launch_persistent_context(
                    session_dir,
                    headless=False,
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream',
                    ],
                )

                page = browser.new_page()

                # Go to Google Meet and create a new meeting
                print("[Meet] Opening Google Meet...")
                page.goto('https://meet.google.com')
                page.wait_for_load_state('networkidle', timeout=15000)

                # Click "New meeting"
                try:
                    new_meeting_btn = page.locator('button:has-text("New meeting")').first
                    new_meeting_btn.click(timeout=5000)
                    print("[Meet] Clicked 'New meeting'")
                except:
                    # Try alternative selector
                    try:
                        page.locator('[data-is-primary-action="true"]').first.click(timeout=5000)
                        print("[Meet] Clicked primary action button")
                    except:
                        print("[Meet] Could not find 'New meeting' button")
                        browser.close()
                        return

                # Click "Start an instant meeting"
                time.sleep(1)
                try:
                    instant_btn = page.locator('li:has-text("Start an instant meeting")').first
                    instant_btn.click(timeout=5000)
                    print("[Meet] Starting instant meeting...")
                except:
                    try:
                        page.locator('text=Start an instant meeting').first.click(timeout=5000)
                    except:
                        print("[Meet] Could not find 'Start an instant meeting'")
                        browser.close()
                        return

                # Wait for meeting to load and get the URL
                time.sleep(3)
                page.wait_for_url('**/meet.google.com/**', timeout=15000)
                meeting_url = page.url
                print(f"[Meet] Meeting created: {meeting_url}")

                current_status["meeting_url"] = meeting_url

                # Try to select Unity Video Capture as camera
                try:
                    # Click the three dots menu
                    page.locator('[aria-label="More options"]').first.click(timeout=3000)
                    time.sleep(0.5)
                    page.locator('text=Settings').first.click(timeout=3000)
                    time.sleep(1)
                    # Click Video tab
                    page.locator('text=Video').first.click(timeout=3000)
                    time.sleep(0.5)
                    # Select Unity Video Capture
                    page.locator('text=Unity Video Capture').first.click(timeout=3000)
                    print("[Meet] Selected Unity Video Capture")
                except:
                    print("[Meet] Could not auto-select camera — select manually")

                # Try to select CABLE Output as microphone
                try:
                    page.locator('text=Audio').first.click(timeout=3000)
                    time.sleep(0.5)
                    page.locator('text=CABLE Output').first.click(timeout=3000)
                    print("[Meet] Selected CABLE Output mic")
                except:
                    print("[Meet] Could not auto-select mic — select manually")

                # Keep browser open — don't close it
                print("[Meet] Browser staying open. Twin is in the meeting.")
                print("[Meet] POST /play to make the twin speak")

                # Wait until server stops
                while not stop_event.is_set():
                    time.sleep(1)

                browser.close()

        except Exception as e:
            print(f"[Meet] Error: {e}")
            current_status["error"] = str(e)

    def log_message(self, format, *args):
        if "/health" not in str(args):
            print(f"[Server] {args[0]}")


def main():
    # Find VB-CABLE on startup
    global vb_cable_device
    vb_cable_device = find_vb_cable_output()
    if vb_cable_device:
        name = sd.query_devices(vb_cable_device)['name']
        print(f"[Audio] VB-CABLE found: {name} (device {vb_cable_device})")
        print(f"[Audio] Set this as your microphone in Google Meet: 'CABLE Output'")
    else:
        print("[Audio] WARNING: VB-CABLE not found — audio will not work in meetings")

    print()
    print(f"  CyberTwin Virtual Camera + Audio Server")
    print(f"  http://localhost:{PORT}")
    print()
    print(f"  POST /start  → load video + idle")
    print(f"  POST /play   → play video + audio synced")
    print(f"  POST /stop   → stop camera")
    print()

    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down...")
        stop_event.set()
        if camera_thread and camera_thread.is_alive():
            camera_thread.join(timeout=3)
        server.server_close()


if __name__ == "__main__":
    main()
