#!/bin/bash

# =============================================================================
# AutoClip Multi-Language - Universal Setup Dispatcher
# =============================================================================
# Automatically detects language from system locale (or accepts --lang)
# and runs the corresponding setup script: setup_en.sh, setup_es.sh, setup_zh.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect language
detect_language() {
    # Check command-line argument first
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

    # Fallback to environment locale
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
        exec "$SCRIPT_DIR/setup_es.sh" "$@"
        ;;
    zh)
        exec "$SCRIPT_DIR/setup_zh.sh" "$@"
        ;;
    *)
        exec "$SCRIPT_DIR/setup_en.sh" "$@"
        ;;
esac
