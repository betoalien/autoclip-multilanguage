# AutoClip Multi-Language - Core Features

AutoClip Multi-Language transforms long-form videos into viral short-form clips (45–90s) ready for TikTok, Instagram Reels, and YouTube Shorts.

---

## 🌟 Key Capabilities

### 1. Automatic Multilingual Interface (i18n)
- **Zero-Friction Language Selection**: Automatically detects the user's browser language on first visit.
- **Native Support**: Full English (`en`), Spanish (`es`), and Chinese (`zh`) support across 100% of interface views, cards, modals, notifications, and backend status messages.
- **Persistent Choice**: Remembers language preference in local storage with immediate live-switching without page reloads.

### 2. Dual Platform Ingestion (YouTube & Bilibili)
- **Universal URL Parsing**: Directly paste video links from YouTube (`youtube.com`, `youtu.be`) or Bilibili.
- **Anti-Bot & 429 Resilience**: Built-in multi-strategy downloading utilizing:
  - User-selected browser cookies (Firefox, Chrome, Safari, Edge).
  - Silent Firefox session extraction (no system permission prompts on macOS/Linux).
  - Mobile client fallback (`android`/`tv` clients) bypassing bot checks and rate limits.
- **Direct Video Upload**: Drag-and-drop local MP4, MKV, MOV, or WEBM files.

### 3. Automated Subtitle Generation & Translation
- **Whisper Speech Recognition**: If platform subtitles are missing or low quality, Whisper automatically transcribes the audio into timecoded SRT.
- **Cross-Lingual Subtitle Translation**: If an English or Chinese video is processed with a Spanish UI, subtitles are automatically translated into Spanish (or vice versa).
- **Offline Fallback Engine**: Uses fast Google Translate, with automatic fallback to local Ollama LLMs (`gemma4`, `qwen2.5`) when offline or rate-limited.

### 4. Viral Short-Form Reel Clipping (45–90 Seconds)
- Unlike traditional video splitters that make 5–10 minute segments, AutoClip's AI models identify concise, high-retention moments strictly between **45 and 90 seconds**.
- Perfect for the algorithms of TikTok, YouTube Shorts, and Instagram Reels.

### 5. High-Contrast Subtitle Burning
- Automatically hardcodes subtitles into the video clips.
- Styled specifically for mobile screens: **large bold yellow typography with a sharp solid black outline** (`Outline=2.5`), ensuring 100% readability against any scene background.

### 6. Privacy-First Local AI Support
- Full compatibility with **Ollama**: Run entire video analysis, title generation, and highlight scoring completely locally on your hardware.
- No cloud dependencies, no recurring API subscriptions, and total data privacy.
