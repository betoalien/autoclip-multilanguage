#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - 快速后台启动脚本 (中文)
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
    echo -e "${GREEN}🚀 AutoClip Multi-Language 快速启动${NC}\n"

    if [[ ! -d "venv" ]]; then
        log_warning "未找到虚拟环境，请先运行 ./setup_zh.sh 初始化配置。"
        exit 1
    fi

    log_info "激活虚拟环境..."
    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH:-}"

    if [[ -f ".env" ]]; then
        set -a
        source .env
        set +a
    fi

    if ! redis-cli ping >/dev/null 2>&1; then
        log_info "启动 Redis..."
        if command -v brew >/dev/null; then
            brew services start redis >/dev/null 2>&1 || true
            sleep 2
        fi
    fi

    mkdir -p logs

    log_info "启动后端服务..."
    nohup python -m uvicorn backend.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload > logs/backend.log 2>&1 &
    echo $! > backend.pid

    log_info "启动 Celery Worker..."
    nohup celery -A backend.core.celery_app worker --loglevel=info --pool=solo --prefetch-multiplier=1 -Q celery,processing,video,notification,upload > logs/celery.log 2>&1 &
    echo $! > celery.pid

    log_info "启动前端服务..."
    cd frontend
    BACKEND_URL="http://localhost:$BACKEND_PORT" nohup npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > ../logs/frontend.log 2>&1 &
    echo $! > ../frontend.pid
    cd ..

    log_info "等待服务就绪..."
    sleep 5

    echo ""
    log_success "快速启动完成！"
    echo "🌐 访问地址:"
    echo "  前端控制台:  http://localhost:$FRONTEND_PORT"
    echo "  后端接口:    http://localhost:$BACKEND_PORT"
    echo "  Swagger文档: http://localhost:$BACKEND_PORT/docs"
    echo ""
    echo "🛑 停止服务请运行: ./stop_autoclip_zh.sh"
}

main "$@"
