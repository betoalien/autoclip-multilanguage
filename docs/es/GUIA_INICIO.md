# AutoClip Multi-Language - Guía de Inicio Rápido

Esta guía detalla los pasos para instalar y ejecutar **AutoClip Multi-Language** en tu entorno.

---

## 📋 Requisitos Previos

- **Python**: Versión 3.10, 3.11 o 3.12 (`python3 --version`)
- **Node.js**: Versión 18 o superior y npm (`node -v`, `npm -v`)
- **FFmpeg**: Necesario para el corte y procesamiento de video (`ffmpeg -version`)
  - macOS: `brew install ffmpeg`
  - Linux (Ubuntu/Debian): `sudo apt update && sudo apt install -y ffmpeg`
  - Windows: `winget install Gyan.FFmpeg`
- **Redis**: Requerido para la cola de tareas Celery
  - macOS: `brew install redis && brew services start redis`
  - Linux: `sudo apt install redis-server && sudo systemctl start redis`
  - Docker: `docker run -d -p 6379:6379 redis:alpine`
- **Ollama** (Opcional pero recomendado para usar IA 100% gratuita y privada):
  - Descárgalo desde [ollama.ai](https://ollama.ai)
  - Descarga un modelo: `ollama run gemma4` o `ollama run qwen2.5`

---

## ⚡ Inicio en Un Clic (Recomendado)

En macOS o Linux, utiliza el script automatizado:

```bash
# 1. Clonar el repositorio
git clone <tu-url-del-repo>
cd autoclip_multi

# 2. Crear archivo de variables de entorno
cp .env.example .env

# 3. Iniciar todos los servicios
./start_autoclip.sh
```

El script se encargará automáticamente de:
- Comprobar las herramientas requeridas (Python, Node, Redis, FFmpeg).
- Crear el entorno virtual e instalar las dependencias de Python.
- Instalar dependencias del frontend (`npm install`).
- Inicializar la base de datos SQLite local.
- Levantar Redis, el Worker de Celery, el backend FastAPI y el servidor frontend Vite.

Una vez iniciado:
- **Panel Web**: [http://localhost:3001](http://localhost:3001)
- **Documentación API (Swagger)**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **Estado de Salud**: [http://localhost:8001/api/v1/health/](http://localhost:8001/api/v1/health/)

Para detener los servicios limpiamente:
```bash
./stop_autoclip.sh
```

---

## 🛠️ Instalación Manual

Si prefieres ejecutar cada servicio por separado:

```bash
# 1. Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 init_database.py

# En Terminal 1 (Celery Worker):
celery -A backend.core.celery_app worker --loglevel=info -Q celery,processing,video,notification,upload

# En Terminal 2 (FastAPI):
uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# En Terminal 3 (Frontend):
cd frontend
npm install
npm run dev -- --port 3001
```

---

## 🐳 Ejecución con Docker

Puedes levantar el sistema completo mediante Docker Compose:

```bash
docker-compose up -d
```
