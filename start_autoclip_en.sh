#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Startup Script (English)
# =============================================================================
# Launches Backend API + Celery Worker + Frontend Interface with health checks.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
BACKEND_PORT=8001
FRONTEND_PORT=3001
REDIS_PORT=6379

BACKEND_STARTUP_TIMEOUT=60
FRONTEND_STARTUP_TIMEOUT=90

LOG_DIR="logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
CELERY_LOG="$LOG_DIR/celery.log"

BACKEND_PID_FILE="backend.pid"
FRONTEND_PID_FILE="frontend.pid"
CELERY_PID_FILE="celery.pid"

# -----------------------------------------------------------------------------
# Terminal Styling
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

ICON_SUCCESS="✅"
ICON_ERROR="❌"
ICON_WARNING="⚠️"
ICON_INFO="ℹ️"
ICON_ROCKET="🚀"
ICON_GEAR="⚙️"
ICON_WEB="🌐"
ICON_HEALTH="💚"

log_info() { echo -e "${BLUE}${ICON_INFO} $1${NC}"; }
log_success() { echo -e "${GREEN}${ICON_SUCCESS} $1${NC}"; }
log_warning() { echo -e "${YELLOW}${ICON_WARNING} $1${NC}"; }
log_error() { echo -e "${RED}${ICON_ERROR} $1${NC}"; }
log_header() {
    echo -e "\n${PURPLE}${ICON_ROCKET} $1${NC}"
    echo -e "${PURPLE}$(printf '=%.0s' {1..55})${NC}"
}
log_step() { echo -e "\n${CYAN}${ICON_GEAR} $1${NC}"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }
port_in_use() { lsof -i ":$1" >/dev/null 2>&1; }

wait_for_service() {
    local url="$1"
    local timeout="$2"
    local service_name="$3"
    
    log_info "Waiting for $service_name to start..."
    for _ in $(seq 1 "$timeout"); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            log_success "$service_name is ready"
            return 0
        fi
        sleep 1
    done
    
    log_error "$service_name failed to start within ${timeout}s"
    return 1
}

stop_process_by_pid_file() {
    local pid_file="$1"
    local service_name="$2"
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping previous $service_name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$pid_file"
    fi
}

# -----------------------------------------------------------------------------
# Pre-flight Checks
# -----------------------------------------------------------------------------
check_environment() {
    log_header "Environment Pre-flight Check"

    # Auto-run setup if venv doesn't exist
    if [[ ! -d "venv" ]]; then
        log_warning "Virtual environment (./venv) not found. Running initial setup first..."
        ./setup_en.sh
    fi

    mkdir -p "$LOG_DIR" data uploads temp

    if [[ ! -f ".env" ]]; then
        log_info "Copying default configuration from .env.example..."
        cp .env.example .env
    fi

    # Activate virtual environment
    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    log_success "Environment verified and virtualenv activated"
}

# -----------------------------------------------------------------------------
# Service Launchers
# -----------------------------------------------------------------------------
start_redis() {
    log_step "Checking Redis Service"

    if redis-cli ping >/dev/null 2>&1; then
        log_success "Redis is already running"
        return 0
    fi

    log_info "Starting Redis..."
    if [[ "$OSTYPE" == "darwin"* ]] && command_exists brew; then
        brew services start redis >/dev/null 2>&1 || true
        sleep 2
    elif command_exists systemctl; then
        sudo systemctl start redis 2>/dev/null || sudo service redis-server start 2>/dev/null || true
    fi

    if redis-cli ping >/dev/null 2>&1; then
        log_success "Redis service started successfully"
    else
        log_warning "Could not connect to Redis automatically. Please ensure Redis is running on port 6379."
    fi
}

start_celery() {
    log_step "Starting Celery Background Worker"

    pkill -f "celery.*backend.core.celery_app" 2>/dev/null || true
    sleep 1

    nohup celery -A backend.core.celery_app worker \
        --loglevel=info \
        --pool=solo \
        --prefetch-multiplier=1 \
        -Q celery,processing,video,notification,upload \
        > "$CELERY_LOG" 2>&1 &

    local celery_pid=$!
    echo "$celery_pid" > "$CELERY_PID_FILE"
    sleep 3

    if kill -0 "$celery_pid" 2>/dev/null; then
        log_success "Celery Worker started (PID: $celery_pid)"
    else
        log_error "Failed to start Celery Worker. Check logs: tail -f $CELERY_LOG"
        exit 1
    fi
}

start_backend() {
    log_step "Starting FastAPI Backend"

    if port_in_use "$BACKEND_PORT"; then
        log_warning "Port $BACKEND_PORT is busy, stopping old process..."
        stop_process_by_pid_file "$BACKEND_PID_FILE" "Backend API"
    fi

    nohup python -m uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --reload \
        --reload-dir backend \
        > "$BACKEND_LOG" 2>&1 &

    local backend_pid=$!
    echo "$backend_pid" > "$BACKEND_PID_FILE"

    if wait_for_service "http://localhost:$BACKEND_PORT/api/v1/health/" "$BACKEND_STARTUP_TIMEOUT" "FastAPI Backend"; then
        log_success "Backend API started (PID: $backend_pid)"
    else
        log_error "Backend failed to respond. Check logs: tail -f $BACKEND_LOG"
        exit 1
    fi
}

start_frontend() {
    log_step "Starting Frontend Dashboard"

    if port_in_use "$FRONTEND_PORT"; then
        log_warning "Port $FRONTEND_PORT is busy, stopping old process..."
        stop_process_by_pid_file "$FRONTEND_PID_FILE" "Frontend"
    fi

    cd frontend
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi

    BACKEND_URL="http://localhost:$BACKEND_PORT" nohup npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" \
        > "../$FRONTEND_LOG" 2>&1 &

    local frontend_pid=$!
    echo "$frontend_pid" > "../$FRONTEND_PID_FILE"
    cd ..

    if wait_for_service "http://localhost:$FRONTEND_PORT/" "$FRONTEND_STARTUP_TIMEOUT" "Frontend"; then
        log_success "Frontend interface started (PID: $frontend_pid)"
    else
        log_error "Frontend failed to start. Check logs: tail -f $FRONTEND_LOG"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# System Information & Summary
# -----------------------------------------------------------------------------
show_dashboard() {
    log_header "🎉 AutoClip Multi-Language is Live!"

    echo -e "${WHITE}All components are active and ready for video processing.${NC}\n"
    echo -e "${CYAN}🌐 Service Access Endpoints:${NC}"
    echo -e "  Frontend UI:          ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Backend API:          ${BLUE}http://localhost:$BACKEND_PORT${NC}"
    echo -e "  API Documentation:    ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
    echo -e "  System Health Check:  ${GREEN}http://localhost:$BACKEND_PORT/api/v1/health/${NC}\n"
    echo -e "${CYAN}📝 Live Logs:${NC}"
    echo -e "  tail -f $BACKEND_LOG"
    echo -e "  tail -f $FRONTEND_LOG"
    echo -e "  tail -f $CELERY_LOG\n"
    echo -e "${CYAN}🛑 Management Commands:${NC}"
    echo -e "  Check status:         ${YELLOW}./status_autoclip_en.sh${NC}"
    echo -e "  Stop all services:    ${RED}./stop_autoclip_en.sh${NC} (or press Ctrl+C)\n"
}

cleanup() {
    log_info "Shutting down services..."
    stop_process_by_pid_file "$BACKEND_PID_FILE" "Backend"
    stop_process_by_pid_file "$FRONTEND_PID_FILE" "Frontend"
    stop_process_by_pid_file "$CELERY_PID_FILE" "Celery Worker"
    pkill -f "celery.*backend.core.celery_app" 2>/dev/null || true
    pkill -f "uvicorn.*backend.main:app" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    log_success "All services stopped cleanly"
}

trap cleanup EXIT INT TERM

main() {
    check_environment
    start_redis
    start_celery
    start_backend
    start_frontend
    show_dashboard

    # Keep script alive in background
    log_info "System is running. Press Ctrl+C to stop."
    while true; do
        sleep 3600
    done
}

main "$@"
