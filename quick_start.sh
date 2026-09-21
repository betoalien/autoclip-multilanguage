#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Universal Quick Start Dispatcher
# =============================================================================
# Automatically detects language from system locale (or accepts --lang)
# and runs the corresponding quick start script:
# - quick_start_en.sh (English)
# - quick_start_es.sh (Spanish)
# - quick_start_zh.sh (Chinese)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

detect_language() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lang=*)
                echo "${1#*=}"
                return 0
                ;;
            --lang|-l)
                echo "$2"
                return 0
                ;;
            *)
                shift
                ;;
        esac
    done

    local sys_locale="${LANG:-${LC_ALL:-${LC_MESSAGES:-en}}}"
    case "$sys_locale" in
        es*|ES*)
            echo "es"
            ;;
        zh*|ZH*|cn*|CN*)
            echo "zh"
            ;;
        *)
            echo "en"
            ;;
    esac
}

LANG_CHOICE=$(detect_language "$@")

case "$LANG_CHOICE" in
    es)
        exec "$SCRIPT_DIR/quick_start_es.sh" "$@"
        ;;
    zh)
        exec "$SCRIPT_DIR/quick_start_zh.sh" "$@"
        ;;
    *)
        exec "$SCRIPT_DIR/quick_start_en.sh" "$@"
        ;;
esac
