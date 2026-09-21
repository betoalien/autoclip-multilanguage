"""
健康检查API路由
"""

from fastapi import APIRouter, Request
from datetime import datetime
from typing import Dict, Any

router = APIRouter()


@router.get("/")
async def health_check() -> Dict[str, Any]:
    """健康检查端点."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


@router.get("/video-categories")
async def get_video_categories(request: Request) -> Dict[str, Any]:
    """获取视频分类配置 (soporta español, inglés y chino)."""
    accept_lang = request.headers.get("accept-language", "").lower()
    is_zh = "zh" in accept_lang and not ("es" in accept_lang or "en" in accept_lang)
    is_en = "en" in accept_lang and not ("es" in accept_lang)

    if is_zh:
        categories = [
            {"value": "default", "name": "默认", "description": "通用视频内容处理", "icon": "🎬", "color": "#4facfe"},
            {"value": "knowledge", "name": "知识科普", "description": "科学、技术、历史、文化等知识类内容", "icon": "📚", "color": "#1890ff"},
            {"value": "entertainment", "name": "娱乐休闲", "description": "游戏、音乐、电影、综艺等娱乐内容", "icon": "🎮", "color": "#52c41a"},
            {"value": "experience", "name": "生活经验", "description": "生活技巧、美食、旅行、手工等实用内容", "icon": "🌟", "color": "#fa8c16"},
            {"value": "opinion", "name": "观点评论", "description": "时事评论、观点分享、社会话题等", "icon": "💭", "color": "#722ed1"},
            {"value": "business", "name": "商业财经", "description": "商业分析、财经资讯、投资理财等", "icon": "💼", "color": "#13c2c2"},
            {"value": "speech", "name": "演讲访谈", "description": "演讲、访谈、对话等口语化内容", "icon": "🎤", "color": "#eb2f96"},
            {"value": "content_review", "name": "解说", "description": "影视解说、游戏解说等内容", "icon": "🎭", "color": "#f5222d"}
        ]
    elif is_en:
        categories = [
            {"value": "default", "name": "Default", "description": "General video clip processing", "icon": "🎬", "color": "#4facfe"},
            {"value": "knowledge", "name": "Education", "description": "Science, technology, history, and education", "icon": "📚", "color": "#1890ff"},
            {"value": "entertainment", "name": "Entertainment", "description": "Gaming, music, movies, and entertainment", "icon": "🎮", "color": "#52c41a"},
            {"value": "experience", "name": "Experience", "description": "Personal experiences and lifestyle insights", "icon": "🌟", "color": "#fa8c16"},
            {"value": "opinion", "name": "Opinion", "description": "Commentary, opinions, and social topics", "icon": "💭", "color": "#722ed1"},
            {"value": "business", "name": "Business", "description": "Business, entrepreneurship, and finance", "icon": "💼", "color": "#13c2c2"},
            {"value": "speech", "name": "Speech", "description": "Keynotes, lectures, and TED-style talks", "icon": "🎤", "color": "#eb2f96"},
            {"value": "content_review", "name": "Review", "description": "Film, series, and media reviews", "icon": "🎭", "color": "#f5222d"}
        ]
    else: # Default Spanish
        categories = [
            {"value": "default", "name": "Predeterminado", "description": "Procesamiento general de video", "icon": "🎬", "color": "#4facfe"},
            {"value": "knowledge", "name": "Educación", "description": "Ciencia, tecnología, historia y cultura", "icon": "📚", "color": "#1890ff"},
            {"value": "entertainment", "name": "Entretenimiento", "description": "Juegos, música, cine y entretenimiento", "icon": "🎮", "color": "#52c41a"},
            {"value": "experience", "name": "Experiencia", "description": "Experiencias personales y estilo de vida", "icon": "🌟", "color": "#fa8c16"},
            {"value": "opinion", "name": "Opinión", "description": "Opinión, comentarios y debate social", "icon": "💭", "color": "#722ed1"},
            {"value": "business", "name": "Negocios", "description": "Negocios, emprendimiento y finanzas", "icon": "💼", "color": "#13c2c2"},
            {"value": "speech", "name": "Charla", "description": "Charlas TED, conferencias y discursos", "icon": "🎤", "color": "#eb2f96"},
            {"value": "content_review", "name": "Reseña", "description": "Reseñas de cine, series o videojuegos", "icon": "🎭", "color": "#f5222d"}
        ]
    return {
        "categories": categories,
        "default_category": "default"
    } 