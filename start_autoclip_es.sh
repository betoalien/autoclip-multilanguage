#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Script de Inicio (Español)
# =============================================================================
# Inicia la API Backend + Worker Celery + Interfaz Frontend con comprobación de salud.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# -----------------------------------------------------------------------------
# Configuración
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
# Colores y Estilos de Consola
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
    
    log_info "Esperando que $service_name esté listo..."
    for _ in $(seq 1 "$timeout"); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            log_success "$service_name está activo y respondiendo"
            return 0
        fi
        sleep 1
    done
    
    log_error "$service_name no respondió en un plazo de ${timeout}s"
    return 1
}

stop_process_by_pid_file() {
    local pid_file="$1"
    local service_name="$2"
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_info "Deteniendo proceso anterior de $service_name (PID: $pid)..."
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
# Verificaciones Previas al Inicio
# -----------------------------------------------------------------------------
check_environment() {
    log_header "Verificación de Entorno"

    # Si no existe el entorno virtual, ejecutar el instalador inicial
    if [[ ! -d "venv" ]]; then
        log_warning "Entorno virtual (./venv) no detectado. Ejecutando instalación inicial..."
        ./setup_es.sh
    fi

    mkdir -p "$LOG_DIR" data uploads temp

    if [[ ! -f ".env" ]]; then
        log_info "Copiando configuración inicial desde .env.example..."
        cp .env.example .env
    fi

    # Activar entorno virtual
    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    log_success "Entorno verificado y entorno virtual activado"
}

# -----------------------------------------------------------------------------
# Lanzamiento de Servicios
# -----------------------------------------------------------------------------
start_redis() {
    log_step "Comprobando Servicio Redis"

    if redis-cli ping >/dev/null 2>&1; then
        log_success "Redis ya se encuentra en ejecución"
        return 0
    fi

    log_info "Iniciando servicio Redis..."
    if [[ "$OSTYPE" == "darwin"* ]] && command_exists brew; then
        brew services start redis >/dev/null 2>&1 || true
        sleep 2
    elif command_exists systemctl; then
        sudo systemctl start redis 2>/dev/null || sudo service redis-server start 2>/dev/null || true
    fi

    if redis-cli ping >/dev/null 2>&1; then
        log_success "Servicio Redis iniciado correctamente"
    else
        log_warning "No se pudo conectar a Redis automáticamente. Asegúrate de tener Redis corriendo en el puerto 6379."
    fi
}

start_celery() {
    log_step "Iniciando Worker en Segundo Plano (Celery)"

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
        log_success "Worker de Celery iniciado (PID: $celery_pid)"
    else
        log_error "Error al iniciar el worker de Celery. Revisa los registros: tail -f $CELERY_LOG"
        exit 1
    fi
}

start_backend() {
    log_step "Iniciando Servidor API Backend (FastAPI)"

    if port_in_use "$BACKEND_PORT"; then
        log_warning "El puerto $BACKEND_PORT está ocupado, deteniendo proceso anterior..."
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

    if wait_for_service "http://localhost:$BACKEND_PORT/api/v1/health/" "$BACKEND_STARTUP_TIMEOUT" "Backend API"; then
        log_success "API Backend iniciada correctamente (PID: $backend_pid)"
    else
        log_error "El backend no respondió. Revisa los registros: tail -f $BACKEND_LOG"
        exit 1
    fi
}

start_frontend() {
    log_step "Iniciando Interfaz de Usuario (Frontend)"

    if port_in_use "$FRONTEND_PORT"; then
        log_warning "El puerto $FRONTEND_PORT está ocupado, deteniendo proceso anterior..."
        stop_process_by_pid_file "$FRONTEND_PID_FILE" "Frontend"
    fi

    cd frontend
    if [[ ! -d "node_modules" ]]; then
        log_info "Instalando paquetes del frontend..."
        npm install
    fi

    BACKEND_URL="http://localhost:$BACKEND_PORT" nohup npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" \
        > "../$FRONTEND_LOG" 2>&1 &

    local frontend_pid=$!
    echo "$frontend_pid" > "../$FRONTEND_PID_FILE"
    cd ..

    if wait_for_service "http://localhost:$FRONTEND_PORT/" "$FRONTEND_STARTUP_TIMEOUT" "Frontend"; then
        log_success "Interfaz Frontend iniciada (PID: $frontend_pid)"
    else
        log_error "El frontend no respondió. Revisa los registros: tail -f $FRONTEND_LOG"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# Información del Sistema y Panel
# -----------------------------------------------------------------------------
show_dashboard() {
    log_header "🎉 ¡AutoClip Multi-Language está Listo!"

    echo -e "${WHITE}Todos los componentes están activos y procesando en segundo plano.${NC}\n"
    echo -e "${CYAN}🌐 Enlaces de Acceso:${NC}"
    echo -e "  Interfaz Web (Dashboard):  ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  API Backend (Swagger):     ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
    echo -e "  Verificación de Salud:     ${GREEN}http://localhost:$BACKEND_PORT/api/v1/health/${NC}\n"
    echo -e "${CYAN}📝 Monitoreo de Registros en Tiempo Real:${NC}"
    echo -e "  tail -f $BACKEND_LOG"
    echo -e "  tail -f $FRONTEND_LOG"
    echo -e "  tail -f $CELERY_LOG\n"
    echo -e "${CYAN}🛑 Comandos de Gestión:${NC}"
    echo -e "  Ver estado de servicios:   ${YELLOW}./status_autoclip_es.sh${NC}"
    echo -e "  Detener todos los servicios:${RED}./stop_autoclip_es.sh${NC} (o presiona Ctrl+C)\n"
}

cleanup() {
    log_info "Deteniendo todos los servicios..."
    stop_process_by_pid_file "$BACKEND_PID_FILE" "Backend"
    stop_process_by_pid_file "$FRONTEND_PID_FILE" "Frontend"
    stop_process_by_pid_file "$CELERY_PID_FILE" "Celery Worker"
    pkill -f "celery.*backend.core.celery_app" 2>/dev/null || true
    pkill -f "uvicorn.*backend.main:app" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    log_success "Todos los servicios se detuvieron limpiamente"
}

trap cleanup EXIT INT TERM

main() {
    check_environment
    start_redis
    start_celery
    start_backend
    start_frontend
    show_dashboard

    # Mantener el script en ejecución
    log_info "Sistema en funcionamiento. Presiona Ctrl+C para detener."
    while true; do
        sleep 3600
    done
}

main "$@"
