#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Quick Background Start (English)
# =============================================================================

set -euo pipefail

BACKEND_PORT=8001
FRONTEND_PORT=3001

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

main() {
    echo -e "${GREEN}🚀 AutoClip Multi-Language Quick Start${NC}\n"

    if [[ ! -d "venv" ]]; then
        log_warning "Virtual environment not found. Please run ./setup_en.sh first."
        exit 1
    fi

    log_info "Activating virtual environment..."
    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    if [[ -f ".env" ]]; then
        set -a
        source .env
        set +a
    fi

    if ! redis-cli ping >/dev/null 2>&1; then
        log_info "Starting Redis..."
        if command -v brew >/dev/null; then
            brew services start redis >/dev/null 2>&1 || true
            sleep 2
        fi
    fi

    mkdir -p logs

    log_info "Starting Backend API..."
    nohup python -m uvicorn backend.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload > logs/backend.log 2>&1 &
    echo $! > backend.pid

    log_info "Starting Celery Worker..."
    nohup celery -A backend.core.celery_app worker --loglevel=info --pool=solo --prefetch-multiplier=1 -Q celery,processing,video,notification,upload > logs/celery.log 2>&1 &
    echo $! > celery.pid

    log_info "Starting Frontend..."
    cd frontend
    BACKEND_URL="http://localhost:$BACKEND_PORT" nohup npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > ../logs/frontend.log 2>&1 &
    echo $! > ../frontend.pid
    cd ..

    log_info "Waiting for services to spin up..."
    sleep 5

    echo ""
    log_success "Quick launch completed!"
    echo "🌐 Access Links:"
    echo "  Frontend UI:  http://localhost:$FRONTEND_PORT"
    echo "  Backend API:  http://localhost:$BACKEND_PORT"
    echo "  Docs:         http://localhost:$BACKEND_PORT/docs"
    echo ""
    echo "🛑 Stop services anytime with: ./stop_autoclip_en.sh"
}

main "$@"
