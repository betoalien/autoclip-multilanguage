#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Configuración Inicial del Entorno (Español)
# =============================================================================
# Prepara automáticamente el entorno virtual Python, dependencias, .env, base de datos y frontend.
# =============================================================================

set -euo pipefail

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

# -----------------------------------------------------------------------------
# 1. Comprobación de Requisitos Previos del Sistema
# -----------------------------------------------------------------------------
check_prerequisites() {
    log_header "Paso 1/6: Verificación de Requisitos del Sistema"

    # Verificación de Sistema Operativo
    if [[ "$OSTYPE" == "darwin"* ]]; then
        log_success "Sistema Operativo: macOS detectado"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_success "Sistema Operativo: Linux detectado"
    else
        log_warning "Sistema Operativo no reconocido: $OSTYPE. El instalador intentará continuar."
    fi

    local missing_tools=()

    # Python 3
    if command_exists python3; then
        local py_version=$(python3 --version 2>&1 | cut -d' ' -f2)
        log_success "Python 3 instalado ($py_version)"
    else
        missing_tools+=("python3 (Python 3.10+ recomendado)")
    fi

    # Node.js y npm
    if command_exists node; then
        local node_ver=$(node --version)
        log_success "Node.js instalado ($node_ver)"
    else
        missing_tools+=("node (Node.js 18+ recomendado)")
    fi

    if command_exists npm; then
        local npm_ver=$(npm --version)
        log_success "npm instalado (v$npm_ver)"
    else
        missing_tools+=("npm")
    fi

    # Redis
    if command_exists redis-cli || command_exists redis-server; then
        log_success "Redis CLI/Servidor instalado"
    else
        log_warning "Redis no fue encontrado. Instálalo con: 'brew install redis' (macOS) o 'sudo apt install redis-server' (Linux)"
    fi

    # FFmpeg
    if command_exists ffmpeg; then
        local ffmpeg_ver=$(ffmpeg -version 2>&1 | head -n 1 | cut -d' ' -f3)
        log_success "FFmpeg instalado ($ffmpeg_ver)"
    else
        log_warning "FFmpeg no detectado. Es obligatorio para procesar clips y quemar subtítulos."
        log_warning "Instálalo vía: 'brew install ffmpeg' (macOS) o 'sudo apt install ffmpeg' (Linux)"
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Faltan herramientas esenciales en el sistema:"
        for tool in "${missing_tools[@]}"; do
            echo -e "  ${RED}- $tool${NC}"
        done
        echo ""
        log_error "Por favor instala las herramientas faltantes y vuelve a ejecutar el instalador."
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# 2. Configuración del Entorno Virtual de Python
# -----------------------------------------------------------------------------
setup_virtualenv() {
    log_header "Paso 2/6: Configuración del Entorno Virtual Python"

    if [[ ! -d "venv" ]]; then
        log_info "Creando entorno virtual en ./venv..."
        python3 -m venv venv
        log_success "Entorno virtual creado"
    else
        log_success "Entorno virtual existente encontrado en ./venv"
    fi

    # Activar
    log_info "Activando entorno virtual..."
    source venv/bin/activate

    # Actualizar pip e instalar requirements
    log_info "Actualizando pip e instalando dependencias de Python (puede tardar 1-2 minutos)..."
    pip install --upgrade pip --quiet
    pip install -r requirements.txt
    log_success "Dependencias de Python instaladas con éxito"
}

# -----------------------------------------------------------------------------
# 3. Configuración del Archivo de Entorno (.env)
# -----------------------------------------------------------------------------
setup_env_file() {
    log_header "Paso 3/6: Configuración de Variables de Entorno (.env)"

    if [[ ! -f ".env" ]]; then
        log_info "Creando archivo .env a partir de .env.example..."
        cp .env.example .env
        log_success "Archivo .env creado correctamente"
        log_info "La configuración por defecto utiliza Ollama local (gemma4/qwen2.5) con cero costo y privacidad total."
    else
        log_success "Archivo .env existente detectado (sin modificaciones)"
    fi
}

# -----------------------------------------------------------------------------
# 4. Creación de Directorios de Datos
# -----------------------------------------------------------------------------
setup_directories() {
    log_header "Paso 4/6: Preparación de Directorios del Sistema"

    local dirs=("data" "logs" "uploads" "temp")
    for d in "${dirs[@]}"; do
        mkdir -p "$d"
        touch "$d/.gitkeep"
    done
    log_success "Directorios listos: data/, logs/, uploads/, temp/"
}

# -----------------------------------------------------------------------------
# 5. Inicialización de la Base de Datos
# -----------------------------------------------------------------------------
setup_database() {
    log_header "Paso 5/6: Inicialización de la Base de Datos SQLite"

    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    python3 init_database.py
    log_success "Tablas y esquemas creados en ./data/autoclip.db"
}

# -----------------------------------------------------------------------------
# 6. Instalación de Dependencias del Frontend
# -----------------------------------------------------------------------------
setup_frontend() {
    log_header "Paso 6/6: Instalación de Dependencias del Frontend"

    if [[ ! -d "frontend" ]]; then
        log_error "¡No se encontró el directorio frontend!"
        exit 1
    fi

    cd frontend
    if [[ ! -f ".env" && -f ".env.example" ]]; then
        cp .env.example .env
    fi

    log_info "Ejecutando npm install en frontend/ (puede tardar un momento)..."
    npm install
    cd ..
    log_success "Paquetes del frontend instalados con éxito"
}

# -----------------------------------------------------------------------------
# Resumen y Próximos Pasos
# -----------------------------------------------------------------------------
show_summary() {
    log_header "🎉 ¡Configuración de AutoClip Multi-Language Completada!"

    echo -e "${WHITE}El backend, frontend, base de datos y entorno están listos para trabajar.${NC}\n"
    echo -e "${CYAN}🚀 Pasos para Iniciar el Sistema:${NC}"
    echo -e "  1. Iniciar en Español:              ${GREEN}./start_autoclip_es.sh${NC}"
    echo -e "  2. O iniciar con el lanzador común: ${GREEN}./start_autoclip.sh${NC}"
    echo -e "  3. Abrir la interfaz web en:        ${BLUE}http://localhost:3001${NC}"
    echo -e "  4. Detener servicios cuando desees: ${YELLOW}./stop_autoclip_es.sh${NC}\n"
    echo -e "${YELLOW}💡 Consejo:${NC} Si deseas usar IA local sin costo de API, asegúrate de correr Ollama:"
    echo -e "       ${GREEN}ollama run gemma4${NC}  o  ${GREEN}ollama run qwen2.5${NC}\n"
}

main() {
    check_prerequisites
    setup_virtualenv
    setup_env_file
    setup_directories
    setup_database
    setup_frontend
    show_summary
}

main "$@"
