#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Universal Status Dispatcher
# =============================================================================
# Automatically detects language from system locale (or accepts --lang)
# and runs the corresponding status script:
# - status_autoclip_en.sh (English)
# - status_autoclip_es.sh (Spanish)
# - status_autoclip_zh.sh (Chinese)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect language
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
        exec "$SCRIPT_DIR/status_autoclip_es.sh" "$@"
        ;;
    zh)
        exec "$SCRIPT_DIR/status_autoclip_zh.sh" "$@"
        ;;
    *)
        exec "$SCRIPT_DIR/status_autoclip_en.sh" "$@"
        ;;
esac
