# AutoClip Multi-Language - Guía de Configuración

En esta guía encontrarás todas las opciones de configuración para proveedores de IA, Whisper, duración de clips y personalización de subtítulos.

---

## 🤖 Configuración de Proveedores de LLM

Puedes configurar el modelo en el archivo `.env` o directamente en la interfaz de usuario en **Ajustes** (`/settings`).

### 1. IA Local con Ollama (Recomendado: Sin costos y Privacidad Total)
1. Instala Ollama desde [ollama.ai](https://ollama.ai).
2. Descarga un modelo recomendado:
   ```bash
   ollama pull gemma4:latest
   # o
   ollama pull qwen2.5:latest
   ```
3. En tu `.env`:
   ```bash
   LLM_PROVIDER=openai
   OPENAI_BASE_URL=http://localhost:11434/v1
   API_OPENAI_API_KEY=ollama
   API_MODEL_NAME=gemma4:latest
   ```

### 2. OpenAI
```bash
LLM_PROVIDER=openai
API_OPENAI_API_KEY=sk-tu-clave-aqui
API_MODEL_NAME=gpt-4o-mini
```

### 3. DeepSeek
```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.deepseek.com/v1
API_OPENAI_API_KEY=sk-tu-clave-aqui
API_MODEL_NAME=deepseek-chat
```

### 4. Google Gemini
```bash
LLM_PROVIDER=gemini
API_GEMINI_API_KEY=tu-clave-gemini-aqui
API_MODEL_NAME=gemini-1.5-flash
```

---

## 🎙️ Reconocimiento de Voz (Whisper ASR)

Los modelos de Whisper se descargan automáticamente en su primer uso en `data/whisper-models/`:
- **Modelo por defecto**: `base` (Excelente balance entre velocidad y precisión en CPU/GPU).
- **Modelos disponibles**: `tiny`, `base`, `small`, `medium`, `large-v3`.
- **Detección de idioma**: Modo `auto`, detecta si el audio está en español, inglés, chino, japonés, etc.

---

## ✂️ Ajuste de Clips para Reels (45–90s)

En `.env`, puedes ajustar el criterio de duración y relevancia para los clips:

```bash
# Puntuación mínima de interés para seleccionar un fragmento (0.0 a 1.0)
PROCESSING_MIN_SCORE_THRESHOLD=0.7

# Cantidad máxima de clips a generar por video
PROCESSING_MAX_CLIPS_PER_COLLECTION=5

# Rango de duración objetivo en segundos
TARGET_CLIP_MIN_DURATION=45
TARGET_CLIP_MAX_DURATION=90
```

---

## 🎨 Estilo y Quemado de Subtítulos

Los subtítulos quemados en el video utilizan el estándar de alta legibilidad para redes sociales:
- **Tipografía**: Arial / Sans-serif negrita
- **Tamaño**: 16 (escalable a la resolución del video)
- **Color de texto**: Amarillo brillante (`&H0000FFFF&` en formato ASS)
- **Color de contorno**: Negro sólido (`&H00000000&`)
- **Grosor de contorno**: 2.5px
- **Alineación**: Inferior centrado (`Alignment=2`) con margen de 25px
