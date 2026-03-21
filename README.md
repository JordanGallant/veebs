# VEED Fabric Virtual Camera

Generate a talking-head avatar video from a photo and stream it as a virtual camera to Google Meet (or any video call app).

## How It Works

1. Takes a photo of you (`me.jpg`) and either text or audio input
2. Calls the [VEED Fabric 1.0](https://fal.ai/models/veed/fabric-1.0) API via fal.ai to generate a lip-synced video
3. Streams the generated video to a virtual camera using `pyvirtualcam`
4. Google Meet (or any app) picks up the virtual camera as a webcam input

## Prerequisites

- Python 3.10+
- [OBS Studio](https://obsproject.com/) installed (required for the virtual camera driver on Windows)
- A [fal.ai](https://fal.ai) API key

## Setup

```bash
pip install -r requirements.txt
export FAL_KEY="your-fal-api-key"
```

## Usage

1. Place a photo of yourself as `me.jpg` in this folder
2. Edit the `TEXT` variable in `run.py` with what you want the avatar to say
3. Run:

```bash
python run.py
```

4. Open Google Meet and select **OBS Virtual Camera** as your camera

### Modes

- **Text mode** (default): Provide text and Fabric generates speech + lip-synced video
- **Audio mode**: Provide an `audio.mp3` file and Fabric lip-syncs the video to it

Set `MODE = "text"` or `MODE = "audio"` in `run.py`.

### Flags

- `--regenerate` — force regenerate the video even if `output.mp4` already exists

## API Reference

- **Text-to-video**: `POST https://fal.run/veed/fabric-1.0/text` — takes `image_url`, `text`, `resolution`, optional `voice_description`
- **Audio-to-video**: `POST https://fal.run/veed/fabric-1.0` — takes `image_url`, `audio_url`, `resolution`
- **Output**: `{ "video": { "url": "...", "content_type": "video/mp4" } }`
- **Resolution**: `720p` ($0.15/sec) or `480p` ($0.08/sec)

## File Structure

```
VEED/
├── run.py              # Main script
├── requirements.txt    # Python dependencies
├── me.jpg              # Your photo (you provide this)
├── audio.mp3           # Audio input (only for audio mode)
└── output.mp4          # Generated video (created by script)
```
