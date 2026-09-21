# AutoClip Multi-Language 智能视频切片系统 🎬🤖

<div align="center">

![AutoClip Multi-Language Logo](https://img.shields.io/badge/AutoClip-Multi--Language-blue?style=for-the-badge&logo=video)

### 基于AI的智能视频切片与短视频生成系统（多语言增强版）

**自动从 YouTube、B站等平台下载长视频，通过 AI 提取 45–90 秒高能片段，支持多语言字幕自动翻译与高对比度字幕烧录。**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

**语言 / Languages / Idiomas**:  
[English](README.md) | [Español](README.es.md) | [中文](README.zh.md)

</div>

---

## 📖 关于 AutoClip Multi-Language

**AutoClip Multi-Language** 是基于周笑卡开源项目 [AutoClip](https://github.com/zhouxiaoka/autoclip) 进行深度国际化拓展的开源版本。

针对原版在多语言环境下的痛点（残余中文字符、硬编码时区、长达5-8分钟的切片过长问题），本版本进行了全面升级：

### 🌟 核心升级特性
- 🌐 **全栈多语言彻底支持**: 前后端 100% 国际化（中文 `zh`、英文 `en`、西班牙语 `es`），根据用户浏览器语言自动精准切换，零残留中文字符。
- 📱 **短视频算法专属优化 (45–90 秒)**: 重新调优提示词与片段切片时长边界，精准锁定 TikTok、YouTube Shorts 和 Instagram Reels 最利于完播率的 45–90 秒区间。
- 🗣️ **字幕跨语言自动翻译**: 当视频原语言与用户所选界面语言不同时，系统自动调用翻译管道转换为目标语言字幕，并具备本地 **Ollama** 模型兜底机制。
- 🎨 **移动端高对比度黄字黑边字幕**: 使用 FFmpeg 烧录 **粗体黄色文字 + 实体黑色描边 (`Outline=2.5`)**，在任何背景明暗画面上均清晰可读。
- 🛡️ **YouTube 下载防封禁增强**: 自动探测浏览器 Cookie 并支持移动端 Client 容错策略，彻底解决 429 报错与卡死在 15% 的问题。
- 🔒 **隐私优先与本地 Ollama 支持**: 原生兼容 Ollama 本地离线模型（`gemma4`、`qwen2.5` 等），零 API 成本，数据不离本地。

---

## ⚡ 快速启动

### 前置要求
- **Python 3.10+**
- **Node.js 18+** 及 npm
- **FFmpeg** (`brew install ffmpeg` / `sudo apt install ffmpeg`)
- **Redis** (`brew services start redis` / `sudo systemctl start redis`)

### 1. 克隆代码仓库
```bash
git clone https://github.com/betoalien/autoclip-multilanguage.git
cd autoclip-multilanguage
```

### 2. 初始化环境与依赖 (Setup)
支持针对特定语言的安装脚本或自适应环境检测：

| 语言 | 安装命令 | 说明 |
| :--- | :--- | :--- |
| 🌐 **自动识别** | `./setup.sh` | 根据操作系统语言环境自动调用对应的初始化配置脚本 |
| 🇨🇳 **中文** | `./setup_zh.sh` | 自动创建 Python 虚拟环境、安装依赖、初始化数据库与前端 |
| 🇬🇧 **English** | `./setup_en.sh` | Sets up venv, installs requirements, builds frontend in English |
| 🇪🇸 **Español** | `./setup_es.sh` | Prepara venv, instala dependencias Python y paquetes npm en español |

初始化脚本将全自动完成：
1. 创建 Python 虚拟环境 (`venv`)。
2. 安装后端 Python 依赖 (`requirements.txt`)。
3. 从 `.env.example` 生成默认 `.env` 配置文件（预设 Ollama 本地模型）。
4. 初始化本地 SQLite 数据库 (`data/autoclip.db`)。
5. 安装前端 npm 依赖包。

### 3. 配置大语言模型提供商 (.env)
如需使用完全免费、隐私安全的本地大模型，请安装 [Ollama](https://ollama.ai) 并运行：
```bash
ollama run gemma4:latest
# 或: ollama run qwen2.5:latest
```
默认 `.env` 已经预设为本地 Ollama，开箱即用：
```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:11434/v1
API_OPENAI_API_KEY=ollama
API_MODEL_NAME=gemma4:latest
```

### 4. 启动系统服务
启动全部核心服务（Redis、Celery Worker、FastAPI 后端、前端界面）：

```bash
# 中文输出
./start_autoclip_zh.sh

# 英文输出 (English)
./start_autoclip_en.sh

# 西班牙语输出 (Español)
./start_autoclip_es.sh

# 通用自适应启动
./start_autoclip.sh
```

服务就绪后访问：
- **Web 控制台**: [http://localhost:3001](http://localhost:3001)
- **FastAPI 接口文档**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **系统健康检查**: [http://localhost:8001/api/v1/health/](http://localhost:8001/api/v1/health/)

### 5. 系统管理脚本

| 功能 | 中文 | English | Español | 通用自适应 |
| :--- | :--- | :--- | :--- | :--- |
| **检查运行状态** | `./status_autoclip_zh.sh` | `./status_autoclip_en.sh` | `./status_autoclip_es.sh` | `./status_autoclip.sh` |
| **停止系统服务** | `./stop_autoclip_zh.sh` | `./stop_autoclip_en.sh` | `./stop_autoclip_es.sh` | `./stop_autoclip.sh` |
| **快速后台启动** | `./quick_start_zh.sh` | `./quick_start_en.sh` | `./quick_start_es.sh` | `./quick_start.sh` |

---

## 📚 文档目录

| 语言 | 目录 | 核心文档 |
| :--- | :--- | :--- |
| **English** | [`docs/en/`](docs/en/) | [Architecture](docs/en/ARCHITECTURE.md) • [Getting Started](docs/en/GETTING_STARTED.md) • [Configuration](docs/en/CONFIGURATION.md) • [Features](docs/en/FEATURES.md) • [Changelog](docs/en/CHANGELOG_MULTILANGUAGE.md) |
| **Español** | [`docs/es/`](docs/es/) | [Arquitectura](docs/es/ARQUITECTURA.md) • [Guía de Inicio](docs/es/GUIA_INICIO.md) • [Configuración](docs/es/CONFIGURACION.md) • [Características](docs/es/CARACTERISTICAS.md) • [Cambios](docs/es/CAMBIOS_MULTILENGUAJE.md) |
| **中文 (原版)** | [`docs/cn/`](docs/cn/) | [原架构与开发文档](docs/cn/DEVELOPER_GUIDE.md) • [系统架构](docs/cn/SYSTEM_ARCHITECTURE.md) |

---

## 🛠️ 支持的 LLM 模型提供商

以下所有提供商均已在 AutoClip Multi-Language 中完整接入并支持：

| 提供商 | 支持状态 | 部署类型 | 配置方式 (.env) | 推荐与主流模型 |
| :--- | :---: | :--- | :--- | :--- |
| **Ollama** | ✅ 完全支持 | 💻 本地离线 (免Key/免费) | `OPENAI_BASE_URL=http://localhost:11434/v1` | `gemma4:latest`, `qwen2.5:latest` |
| **LM Studio** | ✅ 完全支持 | 💻 本地离线 (免Key/免费) | `OPENAI_BASE_URL=http://localhost:1234/v1` | 任意本地 GGUF 模型 |
| **OpenAI** | ✅ 完全支持 | ☁️ 云端 API | `API_OPENAI_API_KEY=sk-...` | `gpt-4o-mini`, `gpt-4o` |
| **DeepSeek** | ✅ 完全支持 | ☁️ 云端 API (OpenAI 兼容) | `OPENAI_BASE_URL=https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-reasoner` |
| **Google Gemini** | ✅ 完全支持 | ☁️ 云端 API | `API_GEMINI_API_KEY=...` | `gemini-1.5-flash`, `gemini-1.5-pro` |
| **Alibaba DashScope** | ✅ 完全支持 | ☁️ 云端 API | `API_DASHSCOPE_API_KEY=...` | `qwen-plus`, `qwen-turbo` |
| **SiliconFlow** | ✅ 完全支持 | ☁️ 云端 API | `API_SILICONFLOW_API_KEY=...` | DeepSeek, Qwen, GLM 系列 |

---

## 🙏 致谢与许可

- **原版项目**: [AutoClip](https://github.com/zhouxiaoka/autoclip) 由 **周笑卡** 开发。
- **许可证**: [MIT License](LICENSE)。
