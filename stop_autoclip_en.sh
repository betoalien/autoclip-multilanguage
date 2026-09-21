#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Shutdown Script (English)
# =============================================================================
# Gracefully stops all AutoClip services (Backend, Frontend, Celery Worker).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PID_FILE="backend.pid"
FRONTEND_PID_FILE="frontend.pid"
CELERY_PID_FILE="celery.pid"
LOG_DIR="logs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

ICON_SUCCESS="✅"
ICON_ERROR="❌"
ICON_WARNING="⚠️"
ICON_INFO="ℹ️"
ICON_STOP="🛑"

log_info() { echo -e "${BLUE}${ICON_INFO} $1${NC}"; }
log_success() { echo -e "${GREEN}${ICON_SUCCESS} $1${NC}"; }
log_warning() { echo -e "${YELLOW}${ICON_WARNING} $1${NC}"; }
log_error() { echo -e "${RED}${ICON_ERROR} $1${NC}"; }
log_header() {
    echo -e "\n${PURPLE}${ICON_STOP} $1${NC}"
    echo -e "${PURPLE}$(printf '=%.0s' {1..55})${NC}"
}

stop_process() {
    local pid_file="$1"
    local service_name="$2"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping $service_name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
            log_success "$service_name stopped"
        else
            log_info "$service_name is not running"
        fi
        rm -f "$pid_file"
    else
        log_info "$service_name (no PID file found)"
    fi
}

stop_all_services() {
    log_header "Stopping AutoClip Services"
    
    stop_process "$BACKEND_PID_FILE" "FastAPI Backend"
    stop_process "$FRONTEND_PID_FILE" "Frontend Server"
    stop_process "$CELERY_PID_FILE" "Celery Worker"
    
    # Process-pattern cleanup fallback
    pkill -f "celery.*backend.core.celery_app" 2>/dev/null || true
    pkill -f "uvicorn.*backend.main:app" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    # Cleanup caches
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -name "*.pyc" -delete 2>/dev/null || true
    rm -f /tmp/celerybeat-schedule /tmp/celerybeat.pid 2>/dev/null || true
    
    echo ""
    log_success "All AutoClip services stopped successfully."
}

main() {
    stop_all_services
}

main "$@"
