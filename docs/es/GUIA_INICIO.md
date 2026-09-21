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

## ⚡ Inicio Rápido (Scripts por Idioma)

En macOS o Linux, utiliza los scripts adaptados a tu idioma preferido:

```bash
# 1. Clonar el repositorio
git clone https://github.com/betoalien/autoclip-multilanguage.git
cd autoclip-multilanguage

# 2. Instalación inicial (venv, dependencias, base de datos y frontend)
./setup_es.sh   # O ./setup.sh para autodetección según tu sistema

# 3. Iniciar todos los servicios
./start_autoclip_es.sh   # O ./start_autoclip.sh
```

### Tabla de Scripts Disponibles

| Operación | Español | English | 中文 | Universal |
| :--- | :--- | :--- | :--- | :--- |
| **Instalación Inicial** | `./setup_es.sh` | `./setup_en.sh` | `./setup_zh.sh` | `./setup.sh` |
| **Iniciar Servicios** | `./start_autoclip_es.sh` | `./start_autoclip_en.sh` | `./start_autoclip_zh.sh` | `./start_autoclip.sh` |
| **Ver Estado** | `./status_autoclip_es.sh` | `./status_autoclip_en.sh` | `./status_autoclip_zh.sh` | `./status_autoclip.sh` |
| **Detener Servicios** | `./stop_autoclip_es.sh` | `./stop_autoclip_en.sh` | `./stop_autoclip_zh.sh` | `./stop_autoclip.sh` |
| **Inicio Rápido** | `./quick_start_es.sh` | `./quick_start_en.sh` | `./quick_start_zh.sh` | `./quick_start.sh` |

Una vez iniciado:
- **Panel Web**: [http://localhost:3001](http://localhost:3001)
- **Documentación API (Swagger)**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **Estado de Salud**: [http://localhost:8001/api/v1/health/](http://localhost:8001/api/v1/health/)

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
