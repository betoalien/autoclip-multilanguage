# AutoClip Multi-Language - Configuration Guide

This guide details all configuration options for LLMs, Whisper speech recognition, video clipping, and internationalization.

---

## 🤖 LLM Provider Setup

AutoClip Multi-Language supports multiple LLM providers. Configure them in `.env` or in the in-app **Settings** UI (`/settings`).

### 1. Local Offline LLM via Ollama (Recommended: Zero Cost & Complete Privacy)
Ollama runs completely locally on your GPU/CPU with no API fees and zero telemetry.

1. Install Ollama from [ollama.ai](https://ollama.ai).
2. Pull a recommended model:
   ```bash
   ollama pull gemma4:latest
   # or
   ollama pull qwen2.5:latest
   ```
3. Set in `.env`:
   ```bash
   LLM_PROVIDER=openai
   OPENAI_BASE_URL=http://localhost:11434/v1
   API_OPENAI_API_KEY=ollama
   API_MODEL_NAME=gemma4:latest
   ```

### 2. OpenAI
```bash
LLM_PROVIDER=openai
API_OPENAI_API_KEY=sk-your-openai-api-key
API_MODEL_NAME=gpt-4o-mini
```

### 3. DeepSeek
```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.deepseek.com/v1
API_OPENAI_API_KEY=sk-your-deepseek-api-key
API_MODEL_NAME=deepseek-chat
```

### 4. Google Gemini
```bash
LLM_PROVIDER=gemini
API_GEMINI_API_KEY=your-gemini-api-key
API_MODEL_NAME=gemini-1.5-flash
```

---

## 🎙️ Speech Recognition (Whisper ASR)

Whisper models are downloaded automatically on first use into `data/whisper-models/`:
- **Default model**: `base` (Fast, lightweight, excellent balance of speed and accuracy).
- **Available models**: `tiny`, `base`, `small`, `medium`, `large-v3`.
- **Language detection**: Set to `auto` by default, automatically identifying whether speech is Spanish, English, Chinese, Japanese, etc.

---

## ✂️ Reel & Short-Form Video Clip Tuning

In `.env`, you can customize the duration and scoring criteria for generated clips:

```bash
# Minimum relevance score to qualify as a highlight (0.0 to 1.0)
PROCESSING_MIN_SCORE_THRESHOLD=0.7

# Maximum number of clips produced per imported video
PROCESSING_MAX_CLIPS_PER_COLLECTION=5

# Target clip duration bounds (seconds)
TARGET_CLIP_MIN_DURATION=45
TARGET_CLIP_MAX_DURATION=90
```

---

## 🎨 Subtitle Styling & Burning

Subtitles burned into video clips follow the high-contrast social media preset:
- **Font**: Arial / Sans-serif bold
- **Font size**: 16 (scaled to canvas)
- **Text color**: Yellow (`&H0000FFFF&` in ASS format)
- **Outline color**: Solid Black (`&H00000000&`)
- **Outline thickness**: 2.5px
- **Alignment**: Bottom-center (`Alignment=2`) with 25px bottom margin
