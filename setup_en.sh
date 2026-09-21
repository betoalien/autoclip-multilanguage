#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Initial Environment Setup (English)
# =============================================================================
# Automatically prepares the Python venv, dependencies, .env, database, and frontend.
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Terminal Colors & Icons
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
ICON_CHECK="🔍"

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
# 1. System Requirements & Dependency Check
# -----------------------------------------------------------------------------
check_prerequisites() {
    log_header "Step 1/6: Checking System Prerequisites"

    # OS Check
    if [[ "$OSTYPE" == "darwin"* ]]; then
        log_success "Operating System: macOS detected"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_success "Operating System: Linux detected"
    else
        log_warning "Unrecognized OS: $OSTYPE. Setup will attempt to continue."
    fi

    local missing_tools=()

    # Python 3
    if command_exists python3; then
        local py_version=$(python3 --version 2>&1 | cut -d' ' -f2)
        log_success "Python 3 installed ($py_version)"
    else
        missing_tools+=("python3 (Python 3.10+ recommended)")
    fi

    # Node.js & npm
    if command_exists node; then
        local node_ver=$(node --version)
        log_success "Node.js installed ($node_ver)"
    else
        missing_tools+=("node (Node.js 18+ recommended)")
    fi

    if command_exists npm; then
        local npm_ver=$(npm --version)
        log_success "npm installed (v$npm_ver)"
    else
        missing_tools+=("npm")
    fi

    # Redis
    if command_exists redis-cli || command_exists redis-server; then
        log_success "Redis CLI/Server installed"
    else
        log_warning "Redis was not found. Please install it (e.g., 'brew install redis' on macOS or 'sudo apt install redis-server' on Linux)"
    fi

    # FFmpeg
    if command_exists ffmpeg; then
        local ffmpeg_ver=$(ffmpeg -version 2>&1 | head -n 1 | cut -d' ' -f3)
        log_success "FFmpeg installed ($ffmpeg_ver)"
    else
        log_warning "FFmpeg not detected. FFmpeg is required for video clipping and subtitle burning."
        log_warning "Install via: 'brew install ffmpeg' (macOS) or 'sudo apt install ffmpeg' (Linux)"
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required build tools:"
        for tool in "${missing_tools[@]}"; do
            echo -e "  ${RED}- $tool${NC}"
        done
        echo ""
        log_error "Please install the missing tools and re-run setup."
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# 2. Python Virtual Environment Setup
# -----------------------------------------------------------------------------
setup_virtualenv() {
    log_header "Step 2/6: Setting Up Python Virtual Environment"

    if [[ ! -d "venv" ]]; then
        log_info "Creating virtual environment in ./venv..."
        python3 -m venv venv
        log_success "Virtual environment created"
    else
        log_success "Existing virtual environment found in ./venv"
    fi

    # Activate
    log_info "Activating virtual environment..."
    source venv/bin/activate

    # Upgrade pip and install requirements
    log_info "Upgrading pip and installing backend dependencies (this may take 1-2 minutes)..."
    pip install --upgrade pip --quiet
    pip install -r requirements.txt
    log_success "Python dependencies installed successfully"
}

# -----------------------------------------------------------------------------
# 3. Environment File Configuration
# -----------------------------------------------------------------------------
setup_env_file() {
    log_header "Step 3/6: Configuring Environment Variables (.env)"

    if [[ ! -f ".env" ]]; then
        log_info "Creating .env from .env.example..."
        cp .env.example .env
        log_success "Default .env file created"
        log_info "Default configuration is set to use local Ollama (gemma4/qwen2.5) with zero cloud cost."
    else
        log_success "Existing .env file detected (leaving unchanged)"
    fi
}

# -----------------------------------------------------------------------------
# 4. Create Runtime Directories
# -----------------------------------------------------------------------------
setup_directories() {
    log_header "Step 4/6: Preparing Runtime Directories"

    local dirs=("data" "logs" "uploads" "temp")
    for d in "${dirs[@]}"; do
        mkdir -p "$d"
        touch "$d/.gitkeep"
    done
    log_success "Directories ready: data/, logs/, uploads/, temp/"
}

# -----------------------------------------------------------------------------
# 5. Database Initialization
# -----------------------------------------------------------------------------
setup_database() {
    log_header "Step 5/6: Initializing Local SQLite Database"

    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    python3 init_database.py
    log_success "Database schema initialized in ./data/autoclip.db"
}

# -----------------------------------------------------------------------------
# 6. Frontend Dependencies Setup
# -----------------------------------------------------------------------------
setup_frontend() {
    log_header "Step 6/6: Installing Frontend Dependencies"

    if [[ ! -d "frontend" ]]; then
        log_error "Frontend directory not found!"
        exit 1
    fi

    cd frontend
    if [[ ! -f ".env" && -f ".env.example" ]]; then
        cp .env.example .env
    fi

    log_info "Running npm install in frontend/ (this may take a minute)..."
    npm install
    cd ..
    log_success "Frontend packages installed successfully"
}

# -----------------------------------------------------------------------------
# Summary & Next Steps
# -----------------------------------------------------------------------------
show_summary() {
    log_header "🎉 AutoClip Multi-Language Setup Completed!"

    echo -e "${WHITE}All backend, frontend, database, and system prerequisites are ready.${NC}\n"
    echo -e "${CYAN}🚀 Next Steps to Launch:${NC}"
    echo -e "  1. Start the system in English:    ${GREEN}./start_autoclip_en.sh${NC}"
    echo -e "  2. Or start using universal runner: ${GREEN}./start_autoclip.sh${NC}"
    echo -e "  3. Access the web dashboard at:     ${BLUE}http://localhost:3001${NC}"
    echo -e "  4. Stop services anytime with:      ${YELLOW}./stop_autoclip_en.sh${NC}\n"
    echo -e "${YELLOW}💡 Tip:${NC} If you want to use local offline AI, ensure Ollama is running:"
    echo -e "       ${GREEN}ollama run gemma4${NC}  or  ${GREEN}ollama run qwen2.5${NC}\n"
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
