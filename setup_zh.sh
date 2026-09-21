#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - 初始环境配置脚本 (中文)
# =============================================================================
# 自动准备 Python 虚拟环境、安装依赖、初始化数据库与前端
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 颜色与样式定义
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
# 1. 系统要求与工具检查
# -----------------------------------------------------------------------------
check_prerequisites() {
    log_header "步骤 1/6: 检查系统运行环境"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        log_success "操作系统: 检测到 macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_success "操作系统: 检测到 Linux"
    else
        log_warning "未识别的操作系统: $OSTYPE，将尝试继续配置"
    fi

    local missing_tools=()

    # Python 3
    if command_exists python3; then
        local py_version=$(python3 --version 2>&1 | cut -d' ' -f2)
        log_success "Python 3 已安装 ($py_version)"
    else
        missing_tools+=("python3 (推荐 Python 3.10+)")
    fi

    # Node.js & npm
    if command_exists node; then
        local node_ver=$(node --version)
        log_success "Node.js 已安装 ($node_ver)"
    else
        missing_tools+=("node (推荐 Node.js 18+)")
    fi

    if command_exists npm; then
        local npm_ver=$(npm --version)
        log_success "npm 已安装 (v$npm_ver)"
    else
        missing_tools+=("npm")
    fi

    # Redis
    if command_exists redis-cli || command_exists redis-server; then
        log_success "Redis 工具/服务已就绪"
    else
        log_warning "未检测到 Redis，请使用 'brew install redis' (macOS) 或 'sudo apt install redis-server' (Linux) 安装"
    fi

    # FFmpeg
    if command_exists ffmpeg; then
        local ffmpeg_ver=$(ffmpeg -version 2>&1 | head -n 1 | cut -d' ' -f3)
        log_success "FFmpeg 已安装 ($ffmpeg_ver)"
    else
        log_warning "未检测到 FFmpeg。视频切片与烧录字幕必须依赖 FFmpeg。"
        log_warning "请安装: 'brew install ffmpeg' (macOS) 或 'sudo apt install ffmpeg' (Linux)"
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "缺少以下必要开发工具:"
        for tool in "${missing_tools[@]}"; do
            echo -e "  ${RED}- $tool${NC}"
        done
        echo ""
        log_error "请先安装缺失工具后再运行此脚本。"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# 2. Python 虚拟环境配置
# -----------------------------------------------------------------------------
setup_virtualenv() {
    log_header "步骤 2/6: 配置 Python 虚拟环境"

    if [[ ! -d "venv" ]]; then
        log_info "正在 ./venv 创建虚拟环境..."
        python3 -m venv venv
        log_success "虚拟环境创建完成"
    else
        log_success "发现已存在的虚拟环境 (./venv)"
    fi

    # 激活环境
    log_info "激活虚拟环境..."
    source venv/bin/activate

    # 更新 pip 并安装依赖
    log_info "升级 pip 并安装后端依赖包 (可能需要 1-2 分钟)..."
    pip install --upgrade pip --quiet
    pip install -r requirements.txt
    log_success "Python 依赖包安装完成"
}

# -----------------------------------------------------------------------------
# 3. 环境变量配置 (.env)
# -----------------------------------------------------------------------------
setup_env_file() {
    log_header "步骤 3/6: 配置环境变量文件 (.env)"

    if [[ ! -f ".env" ]]; then
        log_info "从 .env.example 复制生成 .env..."
        cp .env.example .env
        log_success "默认 .env 文件创建完成"
        log_info "默认配置已预设支持本地 Ollama (gemma4/qwen2.5)，零 API 成本。"
    else
        log_success "已存在 .env 配置文件 (保持原样)"
    fi
}

# -----------------------------------------------------------------------------
# 4. 创建运行目录
# -----------------------------------------------------------------------------
setup_directories() {
    log_header "步骤 4/6: 准备运行时目录"

    local dirs=("data" "logs" "uploads" "temp")
    for d in "${dirs[@]}"; do
        mkdir -p "$d"
        touch "$d/.gitkeep"
    done
    log_success "目录就绪: data/, logs/, uploads/, temp/"
}

# -----------------------------------------------------------------------------
# 5. 数据库初始化
# -----------------------------------------------------------------------------
setup_database() {
    log_header "步骤 5/6: 初始化本地 SQLite 数据库"

    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    python3 init_database.py
    log_success "数据库表结构初始化成功: ./data/autoclip.db"
}

# -----------------------------------------------------------------------------
# 6. 前端依赖安装
# -----------------------------------------------------------------------------
setup_frontend() {
    log_header "步骤 6/6: 安装前端依赖包"

    if [[ ! -d "frontend" ]]; then
        log_error "未找到 frontend 目录！"
        exit 1
    fi

    cd frontend
    if [[ ! -f ".env" && -f ".env.example" ]]; then
        cp .env.example .env
    fi

    log_info "在 frontend/ 目录下运行 npm install..."
    npm install
    cd ..
    log_success "前端依赖包安装完成"
}

# -----------------------------------------------------------------------------
# 总结与后续步骤
# -----------------------------------------------------------------------------
show_summary() {
    log_header "🎉 AutoClip Multi-Language 配置完成！"

    echo -e "${WHITE}后端、前端、数据库及环境依赖已全部准备就绪。${NC}\n"
    echo -e "${CYAN}🚀 启动命令:${NC}"
    echo -e "  1. 中文启动脚本:     ${GREEN}./start_autoclip_zh.sh${NC}"
    echo -e "  2. 通用自适应启动:   ${GREEN}./start_autoclip.sh${NC}"
    echo -e "  3. 访问前端控制台:   ${BLUE}http://localhost:3001${NC}"
    echo -e "  4. 停止系统服务:     ${YELLOW}./stop_autoclip_zh.sh${NC}\n"
    echo -e "${YELLOW}💡 提示:${NC} 如需使用本地离线 AI，请确保已启动 Ollama:"
    echo -e "       ${GREEN}ollama run gemma4${NC}  或  ${GREEN}ollama run qwen2.5${NC}\n"
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
