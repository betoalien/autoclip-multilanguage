# Multi-Language Fork - Changelog & Enhancements

**AutoClip Multi-Language** is an enhanced, internationalized fork of the open-source project [AutoClip](https://github.com/).

This document outlines the modifications, enhancements, and architectural upgrades implemented to transform the original Chinese-centric project into a versatile, globally accessible video clipping tool.

---

## 🌍 Summary of Major Enhancements

### 1. 100% Comprehensive Internationalization (i18n)
- **Problem in Original**: The upstream project was strictly hardcoded for Chinese (`zh-CN`), with residual untranslated strings, Chinese progress messages returned from backend APIs, and forced `zh-CN` Day.js locales and Asia/Shanghai timezones.
- **Enhancements Implemented**:
  - Full translations for **English (`en`)** and **Spanish (`es`)** covering all 1,400+ keys in the application.
  - Dynamic browser language detection: automatically displays Spanish or English on first visit depending on user browser settings.
  - Zero-desync state management between React context and `i18n.language`.
  - Backend API localization: `/api/v1/video-categories`, task status updates, and download progress messages now adapt dynamically to the client's `Accept-Language` header or project language parameter.
  - Dynamic runtime translator (`getLocalizedProgressMessage`) mapping any backend or cached messages into the active user language.

### 2. Multi-Tier Subtitle Translation with Offline LLM Fallback
- **Problem in Original**: Only supported original language subtitles or Chinese translations through cloud APIs.
- **Enhancements Implemented**:
  - Integrated automatic subtitle translation targeting the user's selected interface language.
  - Dual-tier fallback engine: attempts high-speed Google Translate first, and seamlessly falls back to offline local **Ollama** models (`gemma4`, `qwen2.5`) if offline or rate-limited.

### 3. Reel & Short-Form Clip Optimization (45–90 Seconds)
- **Problem in Original**: Video highlights frequently produced 5–8 minute clips that were too long for modern social media short-form video algorithms.
- **Enhancements Implemented**:
  - Re-tuned pipeline prompt constraints and duration boundaries to enforce concise segments between **45 and 90 seconds** (maximum 95 seconds ceiling).
  - Optimized viral hook detection and topic-clustering for TikTok, Instagram Reels, and YouTube Shorts.

### 4. High-Contrast Subtitle Burning Engine
- **Problem in Original**: Subtitles were either not burned or used low-contrast styles that washed out on dynamic video backgrounds.
- **Enhancements Implemented**:
  - Implemented hardcoded subtitle burning via FFmpeg libass filter.
  - Configured high-contrast social media styling: **bold yellow text (`&H0000FFFF&`) with solid black outline (`&H00000000&`, Outline=2.5) and subtle shadow**, guaranteeing readability on any video background.
  - Automatic time-sliced SRT generation perfectly synchronized to each extracted clip segment.

### 5. Enhanced YouTube Ingestion & Anti-Bot Resilience
- **Problem in Original**: YouTube downloads often stalled at 15% due to bot checks, HTTP 429 rate limits, and missing subtitle tracks.
- **Enhancements Implemented**:
  - Multi-strategy `yt-dlp` parsing: user browser selection, zero-popup Firefox cookie inspection on macOS/Linux, and automatic fallback to Android/TV mobile clients.
  - Fallback placeholder SRT generation to prevent pipeline stalls if subtitles are absent.
  - Real-time download progress broadcasting with localized percentage and download speed indicators.

---

## 🙏 Credits & Acknowledgments
We express our appreciation to the original creators and contributors of the upstream AutoClip project for establishing the foundational architecture. AutoClip Multi-Language builds upon that foundation to empower creators and editors across the globe.
