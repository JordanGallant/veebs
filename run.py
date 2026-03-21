"""
VEED Fabric Virtual Camera — streams a generated talking-head video as a webcam.

Prerequisites:
  - OBS Studio installed (provides the virtual camera driver on Windows)
  - pip install -r requirements.txt
  - FAL_KEY env var set

Usage:
  1. Generate video via the API first, or provide a local output.mp4
  2. python run.py                     # stream existing output.mp4
  3. python run.py --regenerate        # force regenerate from me.jpg + script
  4. python run.py --text "Hello..."   # override script text
  5. python run.py --audio audio.mp3   # use audio file instead of text
  6. python run.py --image photo.jpg   # use specific image (default: me.jpg)

Then open Google Meet / Zoom and select "OBS Virtual Camera" as your webcam.
"""

import os
import sys
import json
import argparse
import time
import requests
import cv2
import numpy as np

try:
    import pyvirtualcam
except ImportError:
    print("ERROR: pyvirtualcam not installed. Run: pip install pyvirtualcam")
    print("Also make sure OBS Studio is installed (provides the virtual camera driver).")
    sys.exit(1)

FAL_API_BASE = "https://fal.run"
FAL_UPLOAD_URL = "https://fal.run/fal-ai/any/upload"

DEFAULT_TEXT = (
    "Hello! I am your CyberTwin, a digital replica of you. "
    "I can attend meetings on your behalf, answer questions, "
    "and represent you in the digital world. "
    "Nice to meet everyone!"
)


def get_fal_key():
    key = os.environ.get("FAL_KEY", "")
    if not key:
        print("ERROR: Set FAL_KEY environment variable")
        sys.exit(1)
    return key


def upload_to_fal(filepath, fal_key):
    """Upload a local file to fal.ai storage and return the URL."""
    with open(filepath, "rb") as f:
        content_type = "image/jpeg"
        if filepath.endswith(".png"):
            content_type = "image/png"
        elif filepath.endswith(".mp3"):
            content_type = "audio/mpeg"
        elif filepath.endswith(".wav"):
            content_type = "audio/wav"
        elif filepath.endswith(".webm"):
            content_type = "audio/webm"

        res = requests.post(
            "https://fal.ai/api/storage/upload",
            headers={
                "Authorization": f"Key {fal_key}",
                "Content-Type": content_type,
            },
            data=f.read(),
        )
        res.raise_for_status()
        return res.json().get("url") or res.text.strip().strip('"')


def generate_video_text_mode(image_url, text, resolution, fal_key):
    """Generate video using Fabric text-to-video (built-in TTS)."""
    print(f"[Fabric] Generating video from text ({resolution})...")
    print(f"[Fabric] Script: {text[:80]}...")

    res = requests.post(
        f"{FAL_API_BASE}/veed/fabric-1.0/text",
        headers={
            "Authorization": f"Key {fal_key}",
            "Content-Type": "application/json",
        },
        json={
            "image_url": image_url,
            "text": text,
            "resolution": resolution,
        },
        timeout=300,
    )
    res.raise_for_status()
    data = res.json()
    video_url = data.get("video", {}).get("url")
    if not video_url:
        print("ERROR: Fabric returned no video URL")
        print(json.dumps(data, indent=2))
        sys.exit(1)
    return video_url


def generate_video_audio_mode(image_url, audio_url, resolution, fal_key):
    """Generate video using Fabric with provided audio (lip-sync)."""
    print(f"[Fabric] Generating lip-synced video from audio ({resolution})...")

    res = requests.post(
        f"{FAL_API_BASE}/veed/fabric-1.0",
        headers={
            "Authorization": f"Key {fal_key}",
            "Content-Type": "application/json",
        },
        json={
            "image_url": image_url,
            "audio_url": audio_url,
            "resolution": resolution,
        },
        timeout=300,
    )
    res.raise_for_status()
    data = res.json()
    video_url = data.get("video", {}).get("url")
    if not video_url:
        print("ERROR: Fabric returned no video URL")
        print(json.dumps(data, indent=2))
        sys.exit(1)
    return video_url


def download_video(url, output_path):
    """Download video from URL to local file."""
    print(f"[Download] {url[:60]}... -> {output_path}")
    res = requests.get(url, stream=True, timeout=120)
    res.raise_for_status()
    with open(output_path, "wb") as f:
        for chunk in res.iter_content(chunk_size=8192):
            f.write(chunk)
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"[Download] Saved {size_mb:.1f} MB")


def stream_video(video_path, fps=24):
    """Stream a video file to the OBS Virtual Camera in a loop."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: Could not open {video_path}")
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    video_fps = cap.get(cv2.CAP_PROP_FPS) or fps

    print(f"[Camera] Video: {width}x{height} @ {video_fps:.0f}fps")
    print(f"[Camera] Starting virtual camera... (Ctrl+C to stop)")
    print(f"[Camera] Select 'OBS Virtual Camera' in your meeting app")

    with pyvirtualcam.Camera(width=width, height=height, fps=video_fps) as cam:
        print(f"[Camera] Virtual camera active: {cam.device}")

        while True:
            ret, frame = cap.read()
            if not ret:
                # Loop the video
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:
                    break

            # OpenCV reads BGR, pyvirtualcam expects RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            cam.send(frame_rgb)
            cam.sleep_until_next_frame()

    cap.release()


def main():
    parser = argparse.ArgumentParser(description="VEED Fabric Virtual Camera")
    parser.add_argument("--image", default="me.jpg", help="Path to portrait image")
    parser.add_argument("--text", default=None, help="Script text for the agent to say")
    parser.add_argument("--audio", default=None, help="Audio file path (skips TTS, uses lip-sync)")
    parser.add_argument("--output", default="output.mp4", help="Output video path")
    parser.add_argument("--resolution", default="480p", choices=["480p", "720p"])
    parser.add_argument("--regenerate", action="store_true", help="Force regenerate video")
    parser.add_argument("--stream-only", action="store_true", help="Only stream existing video")
    args = parser.parse_args()

    # If just streaming, skip generation
    if args.stream_only or (os.path.exists(args.output) and not args.regenerate):
        if not os.path.exists(args.output):
            print(f"ERROR: {args.output} not found. Run without --stream-only first.")
            sys.exit(1)
        print(f"[Stream] Using existing {args.output}")
        stream_video(args.output)
        return

    # Need to generate
    fal_key = get_fal_key()

    if not os.path.exists(args.image):
        print(f"ERROR: Image not found: {args.image}")
        print("Place your photo as me.jpg or use --image <path>")
        sys.exit(1)

    # Upload image
    print(f"[Upload] Uploading {args.image}...")
    image_url = upload_to_fal(args.image, fal_key)
    print(f"[Upload] Image URL: {image_url[:60]}...")

    if args.audio:
        # Audio mode: upload audio, generate lip-synced video
        if not os.path.exists(args.audio):
            print(f"ERROR: Audio file not found: {args.audio}")
            sys.exit(1)

        print(f"[Upload] Uploading {args.audio}...")
        audio_url = upload_to_fal(args.audio, fal_key)
        video_url = generate_video_audio_mode(image_url, audio_url, args.resolution, fal_key)
    else:
        # Text mode: Fabric generates speech + video
        text = args.text or DEFAULT_TEXT
        video_url = generate_video_text_mode(image_url, text, args.resolution, fal_key)

    # Download
    download_video(video_url, args.output)

    # Stream
    stream_video(args.output)


if __name__ == "__main__":
    main()
