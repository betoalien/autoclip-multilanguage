#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - 启动脚本 (中文)
# =============================================================================
# 一键启动后端 API、Celery 异步 Worker 与前端 Web 界面，带健康监测。
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# -----------------------------------------------------------------------------
# 服务端口与配置
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
# 终端样式与颜色
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
    
    log_info "等待 $service_name 启动..."
    for _ in $(seq 1 "$timeout"); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            log_success "$service_name 已就绪并正常响应"
            return 0
        fi
        sleep 1
    done
    
    log_error "$service_name 在 ${timeout} 秒内未成功启动"
    return 1
}

stop_process_by_pid_file() {
    local pid_file="$1"
    local service_name="$2"
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_info "正在停止先前的 $service_name (PID: $pid)..."
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
# 环境检查
# -----------------------------------------------------------------------------
check_environment() {
    log_header "运行环境预检"

    # 若虚拟环境不存在，自动运行初始化配置
    if [[ ! -d "venv" ]]; then
        log_warning "未发现虚拟环境 (./venv)，将自动执行环境初始化脚本..."
        ./setup_zh.sh
    fi

    mkdir -p "$LOG_DIR" data uploads temp

    if [[ ! -f ".env" ]]; then
        log_info "正在从 .env.example 复制默认配置文件..."
        cp .env.example .env
    fi

    # 激活虚拟环境
    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    log_success "运行环境与 Python 虚拟环境已激活"
}

# -----------------------------------------------------------------------------
# 启动各项服务
# -----------------------------------------------------------------------------
start_redis() {
    log_step "检查 Redis 服务"

    if redis-cli ping >/dev/null 2>&1; then
        log_success "Redis 服务运行正常"
        return 0
    fi

    log_info "尝试启动 Redis 服务..."
    if [[ "$OSTYPE" == "darwin"* ]] && command_exists brew; then
        brew services start redis >/dev/null 2>&1 || true
        sleep 2
    elif command_exists systemctl; then
        sudo systemctl start redis 2>/dev/null || sudo service redis-server start 2>/dev/null || true
    fi

    if redis-cli ping >/dev/null 2>&1; then
        log_success "Redis 服务启动成功"
    else
        log_warning "未能自动连接到 Redis，请确认 Redis 已在 6379 端口运行。"
    fi
}

start_celery() {
    log_step "启动 Celery 异步任务 Worker"

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
        log_success "Celery Worker 已启动 (PID: $celery_pid)"
    else
        log_error "Celery Worker 启动失败，请查看日志: tail -f $CELERY_LOG"
        exit 1
    fi
}

start_backend() {
    log_step "启动 FastAPI 后端接口服务"

    if port_in_use "$BACKEND_PORT"; then
        log_warning "端口 $BACKEND_PORT 已被占用，正在清理旧进程..."
        stop_process_by_pid_file "$BACKEND_PID_FILE" "后端服务"
    fi

    nohup python -m uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --reload \
        --reload-dir backend \
        > "$BACKEND_LOG" 2>&1 &

    local backend_pid=$!
    echo "$backend_pid" > "$BACKEND_PID_FILE"

    if wait_for_service "http://localhost:$BACKEND_PORT/api/v1/health/" "$BACKEND_STARTUP_TIMEOUT" "FastAPI 后端"; then
        log_success "后端服务启动成功 (PID: $backend_pid)"
    else
        log_error "后端服务未响应，请查看日志: tail -f $BACKEND_LOG"
        exit 1
    fi
}

start_frontend() {
    log_step "启动前端 Web 界面"

    if port_in_use "$FRONTEND_PORT"; then
        log_warning "端口 $FRONTEND_PORT 已被占用，正在清理旧进程..."
        stop_process_by_pid_file "$FRONTEND_PID_FILE" "前端界面"
    fi

    cd frontend
    if [[ ! -d "node_modules" ]]; then
        log_info "正在安装前端依赖包..."
        npm install
    fi

    BACKEND_URL="http://localhost:$BACKEND_PORT" nohup npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" \
        > "../$FRONTEND_LOG" 2>&1 &

    local frontend_pid=$!
    echo "$frontend_pid" > "../$FRONTEND_PID_FILE"
    cd ..

    if wait_for_service "http://localhost:$FRONTEND_PORT/" "$FRONTEND_STARTUP_TIMEOUT" "前端服务"; then
        log_success "前端服务启动成功 (PID: $frontend_pid)"
    else
        log_error "前端服务未响应，请查看日志: tail -f $FRONTEND_LOG"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# 系统状态与访问信息
# -----------------------------------------------------------------------------
show_dashboard() {
    log_header "🎉 AutoClip Multi-Language 系统已就绪！"

    echo -e "${WHITE}所有服务组件均已正常启动。${NC}\n"
    echo -e "${CYAN}🌐 访问入口:${NC}"
    echo -e "  前端界面 (Dashboard):  ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  后端 API (Swagger):    ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
    echo -e "  服务健康状态:          ${GREEN}http://localhost:$BACKEND_PORT/api/v1/health/${NC}\n"
    echo -e "${CYAN}📝 实时日志监控:${NC}"
    echo -e "  tail -f $BACKEND_LOG"
    echo -e "  tail -f $FRONTEND_LOG"
    echo -e "  tail -f $CELERY_LOG\n"
    echo -e "${CYAN}🛑 常用管理命令:${NC}"
    echo -e "  查看系统运行状态:      ${YELLOW}./status_autoclip_zh.sh${NC}"
    echo -e "  停止所有服务:          ${RED}./stop_autoclip_zh.sh${NC} (或按 Ctrl+C)\n"
}

cleanup() {
    log_info "正在安全停止各项服务..."
    stop_process_by_pid_file "$BACKEND_PID_FILE" "后端服务"
    stop_process_by_pid_file "$FRONTEND_PID_FILE" "前端服务"
    stop_process_by_pid_file "$CELERY_PID_FILE" "Celery Worker"
    pkill -f "celery.*backend.core.celery_app" 2>/dev/null || true
    pkill -f "uvicorn.*backend.main:app" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    log_success "所有服务已完全停止"
}

trap cleanup EXIT INT TERM

main() {
    check_environment
    start_redis
    start_celery
    start_backend
    start_frontend
    show_dashboard

    # 保持进程在前台运行
    log_info "系统正在持续运行中，按 Ctrl+C 即可退出..."
    while true; do
        sleep 3600
    done
}

main "$@"
