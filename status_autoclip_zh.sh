#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - 系统运行状态检查脚本 (中文)
# =============================================================================
# 全面检测后端、前端、Celery 与 Redis 的运行状态、PID 及健康端点。
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PORT=8001
FRONTEND_PORT=3001
REDIS_PORT=6379

BACKEND_PID_FILE="backend.pid"
FRONTEND_PID_FILE="frontend.pid"
CELERY_PID_FILE="celery.pid"
LOG_DIR="logs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

ICON_SUCCESS="✅"
ICON_ERROR="❌"
ICON_WARNING="⚠️"
ICON_INFO="ℹ️"
ICON_HEALTH="💚"
ICON_SICK="🤒"
ICON_WEB="🌐"

log_info() { echo -e "${BLUE}${ICON_INFO} $1${NC}"; }
log_success() { echo -e "${GREEN}${ICON_SUCCESS} $1${NC}"; }
log_warning() { echo -e "${YELLOW}${ICON_WARNING} $1${NC}"; }
log_error() { echo -e "${RED}${ICON_ERROR} $1${NC}"; }
log_header() {
    echo -e "\n${PURPLE}🔍 $1${NC}"
    echo -e "${PURPLE}$(printf '=%.0s' {1..55})${NC}"
}

check_service() {
    local name="$1"
    local pid_file="$2"
    local pgrep_pattern="$3"
    local health_url="${4:-}"
    
    local pid=""
    if [[ -f "$pid_file" ]]; then
        pid=$(cat "$pid_file" 2>/dev/null || true)
    fi
    
    local is_running=false
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        is_running=true
    elif pgrep -f "$pgrep_pattern" >/dev/null 2>&1; then
        is_running=true
        pid=$(pgrep -f "$pgrep_pattern" | head -n 1)
    fi
    
    if [[ "$is_running" == true ]]; then
        if [[ -n "$health_url" ]]; then
            if curl -fsS "$health_url" >/dev/null 2>&1; then
                echo -e "  ${GREEN}${ICON_HEALTH} $name:${NC} 运行正常 (PID: $pid)"
            else
                echo -e "  ${YELLOW}${ICON_WARNING} $name:${NC} 进程运行中 (PID: $pid)，但健康检查接口异常"
            fi
        else
            echo -e "  ${GREEN}${ICON_SUCCESS} $name:${NC} 运行中 (PID: $pid)"
        fi
    else
        echo -e "  ${RED}${ICON_ERROR} $name:${NC} 未运行 / 已停止"
    fi
}

main() {
    log_header "AutoClip 系统运行状态概览"
    
    echo -e "${CYAN}核心服务状态:${NC}"
    check_service "FastAPI 后端接口" "$BACKEND_PID_FILE" "uvicorn.*backend.main:app" "http://localhost:$BACKEND_PORT/api/v1/health/"
    check_service "前端 Web 界面" "$FRONTEND_PID_FILE" "npm.*dev|vite" "http://localhost:$FRONTEND_PORT/"
    check_service "Celery Worker" "$CELERY_PID_FILE" "celery.*backend.core.celery_app" ""
    
    echo ""
    echo -e "${CYAN}Redis 缓存服务检查:${NC}"
    if redis-cli ping >/dev/null 2>&1; then
        echo -e "  ${GREEN}${ICON_HEALTH} Redis 消息队列:${NC} 连接正常 (PONG)"
    else
        echo -e "  ${RED}${ICON_ERROR} Redis 消息队列:${NC} 未连接 (端口 $REDIS_PORT 无响应)"
    fi
    
    echo ""
    echo -e "${CYAN}系统访问地址:${NC}"
    echo -e "  前端控制台:  ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  API 文档:    ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
    echo ""
    echo -e "${CYAN}日志查看:${NC}"
    if [[ -d "$LOG_DIR" ]]; then
        echo -e "  tail -n 20 $LOG_DIR/backend.log"
        echo -e "  tail -n 20 $LOG_DIR/celery.log"
    fi
    echo ""
}

main "$@"
