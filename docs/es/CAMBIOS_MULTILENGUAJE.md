# Registro de Adaptaciones y Mejoras Multilingües

**AutoClip Multi-Language** es una versión extendida e internacionalizada del proyecto de código abierto [AutoClip](https://github.com/).

Este documento detalla todas las adaptaciones y mejoras realizadas sobre el código base original en chino para transformarlo en una herramienta global y accesible.

---

## 🌍 Detalle de las Mejoras Implementadas

### 1. Internacionalización Completa (100% Sin Chino Residual)
- **Situación en el proyecto original**: El código estaba diseñado exclusivamente para chino simplificado (`zh-CN`), con textos fijos en componentes, mensajes del backend en chino y configuraciones de zona horaria forzadas a Asia/Shanghai.
- **Mejoras aplicadas**:
  - Traducción exhaustiva al **Español (`es`)** e **Inglés (`en`)** con más de 1,400 claves en los archivos de localización.
  - Detección automática del idioma del navegador al abrir la aplicación por primera vez, evitando valores residuales en `localStorage`.
  - Sincronización estricta entre el contexto de React y la instancia global de `i18n`.
  - Localización de rutas del backend: `/api/v1/video-categories`, estados de descarga de YouTube y Bilibili, y mensajes de avance de pipeline.
  - Traductor en tiempo de ejecución (`getLocalizedProgressMessage`) que traduce al vuelo cualquier mensaje histórico o almacenado en la base de datos antes de mostrarlo en pantalla.

### 2. Traducción Automática de Subtítulos con Respaldo en Ollama
- **Situación en el proyecto original**: Solo admitía subtítulos en el idioma nativo del video o traducción únicamente hacia el chino.
- **Mejoras aplicadas**:
  - Traducción automática al idioma seleccionado por el usuario (ej. video en inglés ➔ subtítulos en español).
  - Sistema de respaldo de dos niveles: traducción rápida por lotes vía Google Translate con conmutación automática a modelos locales de **Ollama** (`gemma4`, `qwen2.5`) si hay fallos de red o límites de tasa.

### 3. Ajuste de Fragmentos para Formato Reels (45–90 Segundos)
- **Situación en el proyecto original**: Frecuentemente generaba fragmentos de 5 a 8 minutos, inapropiados para redes sociales de formato vertical.
- **Mejoras aplicadas**:
  - Se ajustaron los límites de corte para generar clips de entre **45 y 90 segundos** (máximo 95s de techo).
  - Optimización de las instrucciones del modelo de IA para detectar ganchos y mantener una estructura de inicio, desarrollo y conclusión rápida.

### 4. Motor de Quema de Subtítulos con Alto Contraste
- **Situación en el proyecto original**: Los subtítulos no se quemaban en el video o usaban formatos de bajo contraste.
- **Mejoras aplicadas**:
  - Quema directa en el MP4 mediante el filtro libass de FFmpeg.
  - Estilo de alta visibilidad para video vertical: **texto amarillo brillante (`&H0000FFFF&`) con contorno negro sólido (`&H00000000&`, grosor 2.5px)**.
  - Recorte temporal sincronizado del archivo SRT para cada clip generado.

### 5. Descargas de YouTube Robustas y Anti-Bot
- **Situación en el proyecto original**: Las descargas de YouTube solían fallar o quedarse trabadas en 15% por verificaciones de bots o error 429.
- **Mejoras aplicadas**:
  - Estrategia múltiple de yt-dlp: detección de cookies de Firefox sin alertas del sistema en macOS/Linux y respaldo automático en clientes móviles (`android`/`tv`).
  - Generación de SRT por defecto para evitar que la ausencia de subtítulos detenga el pipeline.
  - Notificación de progreso con porcentaje y velocidad en megabytes por segundo en tiempo real.

---

## 🙏 Agradecimientos y Créditos
Reconocemos y agradecemos el trabajo de los autores originales del proyecto AutoClip por la base y diseño del sistema. Esta versión multi-idioma busca expandir el alcance de la herramienta a creadores y editores de todo el mundo.
