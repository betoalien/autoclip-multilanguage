# AutoClip Multi-Language - Getting Started

This guide walks you through setting up and running **AutoClip Multi-Language** on your machine.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:
- **Python**: Version 3.10, 3.11, or 3.12 (`python3 --version`)
- **Node.js**: Version 18+ and npm (`node -v`, `npm -v`)
- **FFmpeg**: Required for media processing (`ffmpeg -version`)
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt update && sudo apt install -y ffmpeg`
  - Windows: `winget install Gyan.FFmpeg`
- **Redis**: Required for the task queue
  - macOS: `brew install redis && brew services start redis`
  - Linux: `sudo apt install redis-server && sudo systemctl start redis`
  - Docker: `docker run -d -p 6379:6379 redis:alpine`
- **Ollama** (Optional, recommended for 100% free offline LLM):
  - Download from [ollama.ai](https://ollama.ai)
  - Pull a model: `ollama run gemma4` or `ollama run qwen2.5`

---

## ⚡ Quick Start (One-Click Script)

The easiest way to start on macOS or Linux is using the included launcher:

```bash
# 1. Clone your repository
git clone <your-repo-url>
cd autoclip_multi

# 2. Copy the environment configuration template
cp .env.example .env

# 3. Launch everything with one command
./start_autoclip.sh
```

The startup script will automatically:
- Verify Python, Node, Redis, and FFmpeg installations.
- Create a Python virtual environment and install backend dependencies.
- Install frontend dependencies (`npm install`).
- Initialize the local SQLite database.
- Start Redis, Celery Worker, FastAPI backend, and Vite dev server.

Once running:
- **Frontend Dashboard**: [http://localhost:3001](http://localhost:3001)
- **Backend API & Swagger Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **System Health Check**: [http://localhost:8001/api/v1/health/](http://localhost:8001/api/v1/health/)

To stop all services cleanly:
```bash
./stop_autoclip.sh
```

---

## 🛠️ Manual Installation (Step-by-Step)

If you prefer to run services manually or on a remote server:

### 1. Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python requirements
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Initialize database
python3 init_database.py

# Terminal 1: Start Celery Worker
celery -A backend.core.celery_app worker --loglevel=info -Q celery,processing,video,notification,upload

# Terminal 2: Start FastAPI Backend
uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend Setup

```bash
# Terminal 3: In the frontend directory
cd frontend
npm install
npm run dev -- --port 3001
```

---

## 🐳 Running with Docker

You can run the entire stack with Docker Compose:

```bash
docker-compose up -d
```
