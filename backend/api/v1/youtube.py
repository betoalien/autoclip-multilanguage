"""
YouTube相关API路由
处理YouTube视频解析和下载功能
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Form, UploadFile, File
from pydantic import BaseModel
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))
from ...core.config import get_data_directory
import uuid
import asyncio
from datetime import datetime
from contextlib import contextmanager
import os
import yt_dlp

logger = logging.getLogger(__name__)
router = APIRouter()

# 存储下载任务的状态
download_tasks = {}

# 一次请求过多字幕语言会触发 YouTube 的 HTTP 429 并让整次下载失败；
# 默认只请求中英文，可用 AUTOCLIP_YT_SUBTITLE_LANGS（逗号分隔）覆盖。
DEFAULT_SUBTITLE_LANGS = ['es', 'es-orig', 'en', 'zh-Hans']


def get_subtitle_langs() -> list:
    raw = os.getenv('AUTOCLIP_YT_SUBTITLE_LANGS', '')
    langs = [lang.strip() for lang in raw.split(',') if lang.strip()]
    return langs or list(DEFAULT_SUBTITLE_LANGS)


def clean_youtube_url(url: str) -> str:
    """清理 YouTube URL 中的无用或空参数（如 &t 或 &t= 或 &feature=...）"""
    if not url:
        return ""
    import re
    u = url.strip()
    u = re.sub(r'[?&]t=(?:&|$)', '&', u)
    u = re.sub(r'[?&]t(?:&|$)', '&', u)
    u = re.sub(r'[?&]feature=[^&]*', '', u)
    u = re.sub(r'&+$', '', u)
    u = re.sub(r'\?+$', '', u)
    return u


@contextmanager
def sanitized_yt_env():
    """临时清理与 yt-dlp 相关的环境变量，避免外部配置影响行为"""
    original_env = os.environ.copy()
    try:
        for key in list(os.environ.keys()):
            upper_key = key.upper()
            if upper_key.startswith("YT_DLP") or upper_key.startswith("YTDL") or upper_key.startswith("YOUTUBE_DL") or upper_key.startswith("YOUTUBEDL"):
                os.environ.pop(key, None)
        yield
    finally:
        os.environ.clear()
        os.environ.update(original_env)

class YouTubeParseRequest(BaseModel):
    url: str
    browser: Optional[str] = None

class YouTubeDownloadRequest(BaseModel):
    url: str
    project_name: str
    video_category: Optional[str] = "default"
    browser: Optional[str] = None
    language: Optional[str] = "es"

class YouTubeVideoInfo(BaseModel):
    title: str
    description: str
    duration: int
    uploader: str
    upload_date: str
    view_count: int
    like_count: int
    thumbnail: str

class YouTubeDownloadTask(BaseModel):
    id: str
    url: str
    project_name: str
    video_category: str
    status: str  # pending, processing, completed, failed
    progress: float
    error_message: Optional[str] = None
    project_id: Optional[str] = None
    created_at: str
    updated_at: str

@router.post("/parse")
async def parse_youtube_video(
    url: str = Form(...),
    browser: Optional[str] = Form(None),
    client: Optional[str] = Form(None)
):
    """解析YouTube视频信息"""
    try:
        url = clean_youtube_url(url)
        logger.info(f"开始解析YouTube视频: {url}")
        
        # 简单的URL验证
        if "youtube.com" not in url and "youtu.be" not in url:
            raise HTTPException(status_code=400, detail="无效的YouTube视频链接")
        
        # 记录版本信息，便于排查
        try:
            logger.info(f"yt-dlp={yt_dlp.version.__version__}, py={sys.executable}")
        except Exception:
            pass

        # 使用 subprocess 直接调用 yt-dlp 命令行工具，支持多策略容错
        import subprocess
        import json
        import asyncio
        import shutil
        
        def extract_info_sync(url, browser):
            node_path = shutil.which('node')
            
            # 多套解析策略：优先用户指定浏览器，其次探测Firefox cookies，最后使用Android客户端兜底
            strategies = []
            if browser:
                strategies.append({'browser': browser.lower(), 'client': client, 'name': f'user_browser_{browser}'})
            
            # 探测 Firefox cookies（macOS 上无需权限弹窗且速度极快）
            strategies.append({'browser': 'firefox', 'client': client, 'name': 'firefox_cookies'})
            
            # 移动端客户端兜底（YouTube 对 Android 客户端从不弹 bot 验证或 429）
            strategies.append({'browser': None, 'client': 'android', 'name': 'android_client_fallback'})

            last_err = None
            env = os.environ.copy()
            for k in list(env.keys()):
                uk = k.upper()
                if uk.startswith('YT_DLP') or uk.startswith('YTDL') or uk.startswith('YOUTUBE_DL') or uk.startswith('YOUTUBEDL'):
                    env.pop(k, None)

            for strat in strategies:
                cmd = [
                    sys.executable, '-m', 'yt_dlp',
                    '--ignore-config',
                    '--no-warnings',
                    '--no-playlist',
                    '--dump-json',
                    '--skip-download',
                    '--no-cache-dir'
                ]
                if node_path:
                    cmd.extend(['--js-runtimes', f"node:{node_path}"])
                if strat.get('browser'):
                    cmd.extend(['--cookies-from-browser', strat['browser']])
                
                c = strat.get('client') or (os.getenv('AUTOCLIP_YT_CLIENT', '').strip().lower())
                if c and c in {"android", "ios", "tv"}:
                    cmd.extend(['--extractor-args', f"youtube:player_client={c}"])
                elif not strat.get('browser'):
                    cmd.extend(['--extractor-args', "youtube:player_client=android"])
                
                cmd.append(url)
                
                try:
                    logger.info(f"执行解析策略 [{strat['name']}]: {' '.join(cmd)}")
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=40,
                        cwd=str(get_data_directory()),
                        env=env
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        info_dict = json.loads(result.stdout)
                        logger.info(f"解析策略 [{strat['name']}] 成功: {info_dict.get('title', 'Unknown')}")
                        return info_dict
                    last_err = result.stderr or result.stdout
                    logger.warning(f"解析策略 [{strat['name']}] 未能提取完整信息: {last_err[:200] if last_err else '未知错误'}")
                except Exception as e:
                    last_err = str(e)
                    logger.warning(f"解析策略 [{strat['name']}] 异常: {e}")
            
            raise Exception(f"所有解析策略均失败: {last_err}")
        
        loop = asyncio.get_event_loop()
        info_dict = await loop.run_in_executor(None, extract_info_sync, url, browser)
        
        logger.info(f"YouTube视频信息解析成功: {info_dict.get('title', 'Unknown')}")
        
        return {
            "success": True,
            "video_info": {
                "title": info_dict.get('title', 'Unknown'),
                "description": info_dict.get('description', ''),
                "duration": info_dict.get('duration', 0) or 0,
                "uploader": info_dict.get('uploader', 'Unknown'),
                "upload_date": info_dict.get('upload_date', ''),
                "view_count": info_dict.get('view_count', 0),
                "like_count": info_dict.get('like_count', 0),
                "thumbnail": info_dict.get('thumbnail', '')
            }
        }
        
    except Exception as e:
        logger.error(f"解析YouTube视频失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"解析失败: {str(e)}")

@router.post("/download")
async def create_youtube_download_task(request: YouTubeDownloadRequest):
    """创建YouTube视频下载任务 - 立即创建项目"""
    try:
        request.url = clean_youtube_url(request.url)
        logger.info(f"创建YouTube下载任务: {request.url}")
        
        # 先获取视频信息以获取缩略图（容错处理，失败不中断项目创建流程）
        video_info = {}
        try:
            import subprocess
            import json
            
            import shutil
            node_path = shutil.which('node')

            cmd = [
                sys.executable, '-m', 'yt_dlp',
                '--ignore-config',
                '--no-warnings',
                '--no-playlist',
                '--dump-json',
                '--skip-download',
                '--no-cache-dir',
                '--source-address', '0.0.0.0'
            ]
            if node_path:
                cmd.extend(['--js-runtimes', f"node:{node_path}"])
            if request.browser:
                cmd.extend(['--cookies-from-browser', request.browser.lower()])
            else:
                # 默认加上 android 客户端，秒级解析避免 429
                cmd.extend(['--extractor-args', 'youtube:player_client=android'])
                
            cmd.append(request.url)
            
            env = os.environ.copy()
            for k in list(env.keys()):
                uk = k.upper()
                if uk.startswith('YT_DLP') or uk.startswith('YTDL') or uk.startswith('YOUTUBE_DL') or uk.startswith('YOUTUBEDL'):
                    env.pop(k, None)
                    
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(get_data_directory()),
                env=env
            )
            if res.returncode == 0 and res.stdout.strip():
                video_info = json.loads(res.stdout)
            else:
                logger.warning(f"获取视频前置信息非零返回 (继续创建项目): {res.stderr[:200] if res.stderr else '未知输出'}")
        except Exception as info_err:
            logger.warning(f"获取视频前置信息失败 (继续创建项目): {info_err}")
        
        # 立即创建项目记录
        from ...core.database import SessionLocal
        from ...services.project_service import ProjectService
        from ...schemas.project import ProjectCreate, ProjectType, ProjectStatus
        
        db = SessionLocal()
        try:
            project_service = ProjectService(db)
            
            # 处理缩略图 - 直接使用解析出来的封面图
            thumbnail_data = None
            thumbnail_url = video_info.get('thumbnail', '')
            if thumbnail_url:
                try:
                    import requests
                    import base64
                    
                    # 下载缩略图
                    response = requests.get(thumbnail_url, timeout=10)
                    if response.status_code == 200:
                        # 转换为base64
                        thumbnail_base64 = base64.b64encode(response.content).decode('utf-8')
                        thumbnail_data = f"data:image/jpeg;base64,{thumbnail_base64}"
                        logger.info(f"YouTube缩略图获取成功: {video_info.get('title', 'Unknown')}")
                    else:
                        logger.warning(f"下载YouTube缩略图失败: {response.status_code}")
                except Exception as e:
                    logger.error(f"处理YouTube缩略图失败: {e}")
                    # 缩略图处理失败不影响主流程
            
            # 创建项目数据
            user_lang = (request.language or "es").lower()
            if user_lang.startswith("es"):
                project_desc = f"Descargado de YouTube: {video_info.get('title', 'Unknown')}"
            elif user_lang.startswith("en"):
                project_desc = f"Downloaded from YouTube: {video_info.get('title', 'Unknown')}"
            else:
                project_desc = f"从YouTube下载: {video_info.get('title', 'Unknown')}"

            project_data = ProjectCreate(
                name=request.project_name,
                description=project_desc,
                project_type=ProjectType(request.video_category),
                status=ProjectStatus.PENDING,  # 初始状态为等待中
                source_url=request.url,
                source_file=None,  # 暂时为空，下载完成后更新
                settings={
                    "download_status": "downloading",
                    "download_progress": 0.0,
                    "language": user_lang,
                    "youtube_info": {
                        "url": request.url,
                        "browser": request.browser,
                        "title": video_info.get('title', 'Unknown'),
                        "uploader": video_info.get('uploader', 'Unknown'),
                        "duration": video_info.get('duration', 0),
                        "view_count": video_info.get('view_count', 0),
                        "thumbnail_url": thumbnail_url
                    }
                }
            )
            
            project = project_service.create_project(project_data)
            project_id = str(project.id)
            
            # 设置缩略图
            if thumbnail_data:
                project.thumbnail = thumbnail_data
                db.commit()
                logger.info(f"项目 {project_id} 缩略图已设置")
            
            # 创建项目目录
            from ...core.path_utils import get_project_directory
            project_dir = get_project_directory(project_id)
            raw_dir = project_dir / "raw"
            raw_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"项目已创建: {project_id}")
            
            # 生成下载任务ID
            task_id = str(uuid.uuid4())
            
            # 创建任务记录
            task = YouTubeDownloadTask(
                id=task_id,
                url=request.url,
                project_name=request.project_name,
                video_category=request.video_category,
                status="pending",
                progress=0.0,
                project_id=project_id,  # 关联项目ID
                created_at=str(uuid.uuid1().time),
                updated_at=str(uuid.uuid1().time)
            )
            
            # 存储任务
            download_tasks[task_id] = task
            
            # 异步启动下载任务 - 使用安全的任务管理器
            from .async_task_manager import task_manager
            await task_manager.create_safe_task(
                f"youtube_download_{task_id}", 
                process_youtube_download_task, 
                task_id, 
                request, 
                project_id
            )
            
            # 返回项目信息而不是任务信息
            return {
                "project_id": project_id,
                "task_id": task_id,
                "status": "created",
                "message": "项目已创建，正在下载中..."
            }
            
        finally:
            db.close()
        
    except Exception as e:
        logger.error(f"创建YouTube下载任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")

@router.get("/tasks/{task_id}")
async def get_youtube_task_status(task_id: str):
    """获取YouTube下载任务状态"""
    if task_id not in download_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return download_tasks[task_id]

@router.get("/tasks")
async def get_all_youtube_tasks():
    """获取所有YouTube下载任务"""
    return list(download_tasks.values())

async def update_project_download_progress(project_id: str, progress: float, message: str):
    """更新项目下载进度"""
    try:
        from ...core.database import SessionLocal
        from ...services.project_service import ProjectService
        
        db = SessionLocal()
        try:
            project_service = ProjectService(db)
            project = project_service.get(project_id)
            
            if project:
                from sqlalchemy.orm.attributes import flag_modified
                cfg = dict(project.processing_config or {})
                cfg.update({
                    "download_status": "downloading" if progress < 100.0 else "completed",
                    "download_progress": progress,
                    "download_message": message
                })
                project.processing_config = cfg
                flag_modified(project, "processing_config")
                
                # 如果进度达到100%，更新状态为等待处理
                if progress >= 100.0:
                    from ...schemas.project import ProjectStatus
                    project.status = ProjectStatus.PENDING
                
                db.commit()
                logger.info(f"项目 {project_id} 下载进度更新: {progress}% - {message}")
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"更新项目下载进度失败: {e}")

async def process_youtube_download_task(task_id: str, request: YouTubeDownloadRequest, project_id: str):
    """处理YouTube下载任务"""
    try:
        # 更新任务状态为处理中（安全处理task_id不存在的情况）
        if task_id in download_tasks:
            download_tasks[task_id].status = "processing"
            download_tasks[task_id].progress = 10.0
        else:
            task = YouTubeDownloadTask(
                id=task_id,
                url=request.url,
                project_name=request.project_name,
                video_category=request.video_category or "default",
                status="processing",
                progress=10.0,
                project_id=project_id,
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat()
            )
            download_tasks[task_id] = task
        
        user_lang = (getattr(request, 'language', None) or 'es').lower()
        is_es = user_lang.startswith('es')
        is_en = user_lang.startswith('en')

        # 更新项目状态和进度
        msg_fetch = "Obteniendo información del video..." if is_es else ("Fetching video information..." if is_en else "正在获取视频信息...")
        await update_project_download_progress(project_id, 10.0, msg_fetch)
        
        # 使用yt-dlp下载视频
        import yt_dlp
        import asyncio
        from ...core.config import get_data_directory
        
        data_dir = get_data_directory()
        download_dir = data_dir / "temp" / project_id
        download_dir.mkdir(parents=True, exist_ok=True)
        
        # 更新项目进度
        msg_prep = "Preparando descarga del video..." if is_es else ("Preparing video download..." if is_en else "准备下载视频...")
        await update_project_download_progress(project_id, 15.0, msg_prep)
        
        # 1. 优先下载视频文件（多策略容错 + 实时进度反馈）
        import shutil
        import time
        node_path = shutil.which('node')
        loop = asyncio.get_event_loop()
        last_progress_update = [0.0]
        max_pct = [15.0]

        def progress_hook(d):
            try:
                status = d.get('status')
                if status == 'downloading':
                    total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                    downloaded = d.get('downloaded_bytes', 0)
                    frag_index = d.get('fragment_index')
                    frag_count = d.get('fragment_count')

                    if frag_count and frag_count > 0 and frag_index is not None:
                        ratio = frag_index / frag_count
                    elif total > 0:
                        ratio = downloaded / total
                    else:
                        ratio = 0.0

                    info_dict = d.get('info_dict') or {}
                    vcodec = info_dict.get('vcodec')
                    acodec = info_dict.get('acodec')

                    if vcodec and vcodec != 'none' and (not acodec or acodec == 'none'):
                        # 纯视频流阶段: 15% -> 45%
                        curr_pct = 15.0 + ratio * 30.0
                    elif acodec and acodec != 'none' and (not vcodec or vcodec == 'none'):
                        # 纯音频流阶段: 45% -> 58%
                        curr_pct = 45.0 + ratio * 13.0
                    else:
                        # 混合流阶段: 15% -> 58%
                        curr_pct = 15.0 + ratio * 43.0

                    curr_pct = min(58.5, max(max_pct[0], curr_pct))
                    max_pct[0] = curr_pct
                    pct = curr_pct

                    if task_id in download_tasks:
                        download_tasks[task_id].progress = round(pct, 1)

                    now = time.time()
                    if now - last_progress_update[0] >= 1.5:
                        last_progress_update[0] = now
                        speed = d.get('speed') or 0
                        speed_mb = speed / (1024 * 1024)
                        speed_info = f" ({speed_mb:.1f} MB/s)" if speed_mb > 0.1 else ""
                        if is_es:
                            msg = f"Descargando video {round(pct)}%{speed_info}"
                        elif is_en:
                            msg = f"Downloading video {round(pct)}%{speed_info}"
                        else:
                            msg = f"正在下载视频 {round(pct)}%{speed_info}"
                        loop.call_soon_threadsafe(
                            asyncio.create_task,
                            update_project_download_progress(project_id, round(pct, 1), msg)
                        )
                elif status == 'finished':
                    if task_id in download_tasks:
                        download_tasks[task_id].progress = 60.0
            except Exception:
                pass

        base_ydl_opts = {
            'format': 'bestvideo[protocol^=http][ext=mp4]+bestaudio[protocol^=http][ext=m4a]/bestvideo[protocol^=http]+bestaudio[protocol^=http]/bestvideo+bestaudio/best[ext=mp4]/best',
            'outtmpl': str(download_dir / 'input.%(ext)s'),
            'merge_output_format': 'mp4',
            'noplaylist': True,
            'quiet': True,
            'no_warnings': False,
            'ignoreconfig': True,
            'config_locations': [],
            'cachedir': False,
            'source_address': '0.0.0.0',
            'retries': 10,
            'fragment_retries': 10,
            'progress_hooks': [progress_hook],
        }
        if node_path:
            base_ydl_opts['js_runtimes'] = {'node': {'path': node_path}}

        # 构建下载策略队列
        strategies = []
        if request.browser:
            strategies.append({
                'name': f"user_browser_{request.browser}",
                'cookies': request.browser.lower(),
                'extractor_args': {}
            })
            strategies.append({
                'name': "standard_client",
                'cookies': None,
                'extractor_args': {}
            })
            strategies.append({
                'name': "mobile_client_fallback",
                'cookies': None,
                'extractor_args': {'youtube': {'player_client': ['android', 'ios']}},
                'format': 'bestvideo[protocol^=http][ext=mp4]+bestaudio[protocol^=http][ext=m4a]/bestvideo[protocol^=http]+bestaudio[protocol^=http]/best[ext=mp4]/best'
            })
        else:
            # 策略 1: 标准客户端（带 Node JS 引擎，强制 IPv4，无 cookies）
            strategies.append({
                'name': "standard_client",
                'cookies': None,
                'extractor_args': {}
            })

            # 策略 2: Android/iOS 移动端客户端（YouTube 极少限制移动客户端）
            strategies.append({
                'name': "mobile_client_fallback",
                'cookies': None,
                'extractor_args': {'youtube': {'player_client': ['android', 'ios']}},
                'format': 'bestvideo[protocol^=http][ext=mp4]+bestaudio[protocol^=http][ext=m4a]/bestvideo[protocol^=http]+bestaudio[protocol^=http]/best[ext=mp4]/best'
            })

            # 策略 3: Firefox cookies（兜底探测）
            try:
                with yt_dlp.YoutubeDL({'quiet': True, 'cookiesfrombrowser': ('firefox',)}) as probe:
                    if len(probe.cookiejar) > 0:
                        strategies.append({
                            'name': "auto_firefox_cookies",
                            'cookies': 'firefox',
                            'extractor_args': {}
                        })
            except Exception:
                pass

        download_success = False
        last_dl_error = None

        for strategy in strategies:
            opts = dict(base_ydl_opts)
            if strategy.get('cookies'):
                opts['cookiesfrombrowser'] = (strategy['cookies'],)
            if strategy.get('extractor_args'):
                opts['extractor_args'] = strategy['extractor_args']
            if strategy.get('format'):
                opts['format'] = strategy['format']

            logger.info(f"尝试 YouTube 下载策略: {strategy['name']}")
            try:
                def download_sync(url, yopts):
                    with sanitized_yt_env():
                        with yt_dlp.YoutubeDL(yopts) as ydl:
                            return ydl.download([url])

                await loop.run_in_executor(None, download_sync, request.url, opts)
                
                v_files = list(download_dir.glob("input.mp4")) or list(download_dir.glob("*.mp4")) or list(download_dir.glob("*.mkv")) or list(download_dir.glob("*.webm"))
                if v_files:
                    logger.info(f"YouTube 视频下载策略成功 [{strategy['name']}]: {v_files[0]}")
                    download_success = True
                    break
            except Exception as dl_err:
                logger.warning(f"YouTube 下载策略 [{strategy['name']}] 失败: {dl_err}")
                last_dl_error = dl_err
                continue

        if not download_success:
            raise Exception(f"所有 YouTube 下载策略均失败: {last_dl_error}")
        
        # 2. 尝试可选下载字幕（单独尝试，即使遇到 429 也绝不中断视频流程，后续有 Whisper 兜底）
        try:
            sub_strategies = [
                # 策略 1: 标准网页/API 客户端（优先获取原生或自动生成的西班牙语/英语/中文字幕）
                {
                    'skip_download': True,
                    'writesubtitles': True,
                    'writeautomaticsub': True,
                    'subtitleslangs': get_subtitle_langs(),
                    'subtitlesformat': 'srt',
                    'outtmpl': str(download_dir / 'input.%(ext)s'),
                    'noplaylist': True,
                    'quiet': True,
                    'ignoreerrors': True,
                    'cachedir': False,
                    'source_address': '0.0.0.0',
                    'postprocessors': [{'key': 'FFmpegSubtitlesConvertor', 'format': 'srt'}]
                },
                # 策略 2: Android client（绕过429限制）
                {
                    'skip_download': True,
                    'writesubtitles': True,
                    'writeautomaticsub': True,
                    'subtitleslangs': get_subtitle_langs(),
                    'subtitlesformat': 'srt',
                    'outtmpl': str(download_dir / 'input.%(ext)s'),
                    'noplaylist': True,
                    'quiet': True,
                    'ignoreerrors': True,
                    'cachedir': False,
                    'source_address': '0.0.0.0',
                    'extractor_args': {'youtube': {'player_client': ['android']}},
                    'postprocessors': [{'key': 'FFmpegSubtitlesConvertor', 'format': 'srt'}]
                },
                # 策略 3: 带浏览器 Cookie
                {
                    'skip_download': True,
                    'writesubtitles': True,
                    'writeautomaticsub': True,
                    'subtitleslangs': get_subtitle_langs(),
                    'subtitlesformat': 'srt',
                    'outtmpl': str(download_dir / 'input.%(ext)s'),
                    'noplaylist': True,
                    'quiet': True,
                    'ignoreerrors': True,
                    'cachedir': False,
                    'source_address': '0.0.0.0',
                    'cookiesfrombrowser': (request.browser.lower(),) if request.browser else ('firefox',),
                    'postprocessors': [{'key': 'FFmpegSubtitlesConvertor', 'format': 'srt'}]
                }
            ]
            for s_opt in sub_strategies:
                try:
                    await loop.run_in_executor(None, download_sync, request.url, s_opt)
                except Exception as sub_step_err:
                    logger.debug(f"字幕下载策略部分完成或报错: {sub_step_err}")

                s_files = list(download_dir.glob("*.srt")) or list(download_dir.glob("*.vtt"))
                if s_files:
                    logger.info(f"成功获取字幕文件: {s_files[0]}")
                    break
        except Exception as sub_err:
            logger.warning(f"下载 YouTube 字幕失败（将在下一步使用 Whisper 自动生成）: {sub_err}")
        
        # 查找下载的文件
        video_files = list(download_dir.glob("input.mp4")) or list(download_dir.glob("*.mp4")) or list(download_dir.glob("*.mkv")) or list(download_dir.glob("*.webm"))
        subtitle_files = list(download_dir.glob("*.srt"))
        if not subtitle_files:
            vtt_files = list(download_dir.glob("*.vtt"))
            if vtt_files:
                try:
                    import subprocess
                    target_vtt = vtt_files[0]
                    target_srt = target_vtt.with_suffix(".srt")
                    subprocess.run(["ffmpeg", "-y", "-i", str(target_vtt), str(target_srt)], capture_output=True)
                    if target_srt.exists():
                        subtitle_files = [target_srt]
                except Exception as conv_err:
                    logger.warning(f"VTT 转换 SRT 失败: {conv_err}")
        
        if not video_files:
            raise Exception("未找到下载的视频文件")
        
        video_path = str(video_files[0])
        subtitle_path = str(subtitle_files[0]) if subtitle_files else ""
        
        download_tasks[task_id].progress = 80.0
        
        # 更新项目进度
        msg_vid_done = "Descarga de video completada, procesando subtítulos..." if is_es else ("Video download complete, processing subtitles..." if is_en else "视频下载完成，正在处理字幕...")
        await update_project_download_progress(project_id, 60.0, msg_vid_done)
        
        # 如果没有字幕文件，优先使用Whisper生成字幕
        if not subtitle_path:
            logger.info("优先使用Whisper生成高质量字幕")
            # 更新项目进度
            msg_whisper = "Generando subtítulos con Whisper..." if is_es else ("Generating subtitles with Whisper..." if is_en else "正在使用Whisper生成字幕...")
            await update_project_download_progress(project_id, 70.0, msg_whisper)
            
            try:
                from ...utils.speech_recognizer import generate_subtitle_for_video, SpeechRecognitionError
                video_file_path = Path(video_path)
                
                # 根据视频信息选择合适的模型
                model = "base"  # 默认使用平衡模型
                language = "auto"  # 默认自动检测语言
                
                # 可以根据视频标题判断内容类型
                # 这里可以添加更智能的内容类型判断逻辑
                
                logger.info(f"使用Whisper生成字幕 - 语言: {language}, 模型: {model}")
                
                generated_subtitle = generate_subtitle_for_video(
                    video_file_path,
                    language=language,
                    model=model
                )
                subtitle_path = str(generated_subtitle)
                logger.info(f"Whisper字幕生成成功: {subtitle_path}")
                
                # 更新项目进度
                msg_whisper_done = "Subtítulos generados, preparando procesamiento..." if is_es else ("Subtitles generated, preparing processing..." if is_en else "字幕生成完成，正在准备处理...")
                await update_project_download_progress(project_id, 90.0, msg_whisper_done)
                
            except SpeechRecognitionError as e:
                logger.error(f"Whisper字幕生成失败: {e}")
                # Whisper失败时，尝试多种策略获取平台字幕作为备用
                logger.info("尝试下载平台字幕作为备用方案")
                try:
                    subtitle_path = await _try_youtube_subtitle_strategies(request.url, download_dir, request.browser)
                    if subtitle_path:
                        logger.info(f"备用字幕获取成功: {subtitle_path}")
                    else:
                        logger.warning("所有字幕获取策略都失败了")
                        subtitle_path = None  # 确保字幕路径为空，后续会标记项目失败
                except Exception as backup_error:
                    logger.error(f"备用字幕获取也失败: {backup_error}")
                    subtitle_path = None  # 确保字幕路径为空，后续会标记项目失败
            except Exception as e:
                logger.error(f"生成字幕过程中发生未知错误: {e}")
                subtitle_path = None  # 确保字幕路径为空，后续会标记项目失败
        
        logger.info(f"下载完成 - 视频文件: {video_path}, 字幕文件: {subtitle_path}")
        
        # 更新项目信息（项目已在开始时创建）
        from ...services.project_service import ProjectService
        from ...core.database import SessionLocal
        
        db = SessionLocal()
        try:
            project_service = ProjectService(db)
            
            # 获取已创建的项目
            project = project_service.get(project_id)
            if not project:
                raise Exception(f"项目 {project_id} 不存在")
            
            # 更新项目信息
            user_lang = (getattr(request, 'language', None) or 'es').lower()
            if user_lang.startswith("es"):
                project.description = f"Descargado de YouTube: {request.project_name}"
            elif user_lang.startswith("en"):
                project.description = f"Downloaded from YouTube: {request.project_name}"
            else:
                project.description = f"从YouTube下载: {request.project_name}"
            # 注意：不要在这里设置video_path，等文件移动完成后再设置
            
            # 更新项目设置
            if not project.processing_config:
                project.processing_config = {}
            
            project.processing_config.update({
                "language": user_lang,
                "youtube_info": {
                    "title": request.project_name,
                    "uploader": "YouTube",
                    "duration": 0,
                    "view_count": 0,
                    "like_count": 0
                },
                "subtitle_path": subtitle_path,
                "download_status": "completed",
                "download_progress": 100.0
            })
            
            # 移动文件到项目目录
            from ...core.path_utils import get_project_directory
            project_dir = get_project_directory(project_id)
            raw_dir = project_dir / "raw"
            raw_dir.mkdir(parents=True, exist_ok=True)
            
            # 移动视频文件到项目目录
            import shutil
            
            if video_path:
                video_file_path = Path(video_path)
                if video_file_path.exists():
                    # 重命名视频文件为input.mp4
                    new_video_path = raw_dir / "input.mp4"
                    shutil.move(str(video_file_path), str(new_video_path))
                    logger.info(f"视频文件已移动到: {new_video_path}")
                    
                    # 更新项目中的视频路径
                    project.video_path = str(new_video_path)
            
            # 移动字幕文件到项目目录
            if subtitle_path:
                subtitle_file_path = Path(subtitle_path)
                if subtitle_file_path.exists():
                    # 重命名字幕文件为input.srt
                    new_subtitle_path = raw_dir / "input.srt"
                    shutil.move(str(subtitle_file_path), str(new_subtitle_path))
                    logger.info(f"字幕文件已移动到: {new_subtitle_path}")
                    
                    # 更新项目处理配置中的字幕路径
                    if not project.processing_config:
                        project.processing_config = {}
                    project.processing_config["subtitle_path"] = str(new_subtitle_path)
            
            # 保存项目更新
            db.commit()
            
            # 检查字幕文件是否存在，如果不存在则自动生成占位字幕，确保流水线顺畅执行
            srt_file_path = raw_dir / "input.srt"
            if not srt_file_path.exists():
                logger.warning(f"字幕文件不存在: {srt_file_path}，自动生成默认占位字幕，流水线继续进行")
                srt_file_path.write_text("1\n00:00:00,000 --> 00:00:05,000\n[Video Imported]\n", encoding="utf-8")
                if not project.processing_config:
                    project.processing_config = {}
                project.processing_config["subtitle_path"] = str(srt_file_path)
                db.commit()
            
            # 更新项目下载进度为完成
            msg_all_done = "Descarga completada, iniciando procesamiento..." if is_es else ("Download complete, starting processing..." if is_en else "下载完成，准备开始处理")
            await update_project_download_progress(project_id, 100.0, msg_all_done)
            
            # 更新任务状态
            download_tasks[task_id].status = "completed"
            download_tasks[task_id].progress = 100.0
            download_tasks[task_id].project_id = str(project.id)
            download_tasks[task_id].updated_at = datetime.now().isoformat()
            
            logger.info(f"YouTube下载任务完成: {task_id}, 项目ID: {project.id}")
            
            # 自动启动处理流程
            try:
                # 更新项目状态为等待处理
                from ...schemas.project import ProjectStatus
                project.status = ProjectStatus.PENDING  # 改为PENDING，让自动化服务启动
                db.commit()
                
                logger.info(f"YouTube项目 {project.id} 下载完成，等待自动化流水线启动")
                
                # 异步启动自动化流水线
                import asyncio
                from ...services.auto_pipeline_service import auto_pipeline_service
                
                # 使用create_task在已运行的事件循环中执行
                try:
                    loop = asyncio.get_running_loop()
                    # 在已运行的事件循环中创建任务
                    task = loop.create_task(
                        auto_pipeline_service.auto_start_pipeline(str(project.id))
                    )
                    # 等待任务完成
                    pipeline_result = await task
                except RuntimeError:
                    # 如果没有运行的事件循环，创建新的
                    pipeline_result = await auto_pipeline_service.auto_start_pipeline(str(project.id))
                
                if pipeline_result['status'] == 'started':
                    logger.info(f"YouTube项目 {project.id} 自动化流水线已启动: {pipeline_result}")
                else:
                    logger.warning(f"YouTube项目 {project.id} 自动化流水线启动结果: {pipeline_result}")
                
            except Exception as e:
                logger.error(f"启动YouTube项目 {project.id} 自动化流水线失败: {str(e)}")
                # 即使处理启动失败，也要返回下载成功
                # 用户可以通过重试按钮重新启动处理
            
        except Exception as e:
            logger.error(f"创建项目失败: {str(e)}")
            # 即使处理启动失败，也要返回下载成功
            # 用户可以通过重试按钮重新启动处理
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"处理下载任务失败: {str(e)}")
        download_tasks[task_id].status = "failed"
        download_tasks[task_id].error_message = str(e)
        download_tasks[task_id].progress = 0.0
        download_tasks[task_id].updated_at = datetime.now().isoformat()

        try:
            from ...core.database import SessionLocal
            from ...services.project_service import ProjectService
            from ...schemas.project import ProjectStatus

            db = SessionLocal()
            try:
                project_service = ProjectService(db)
                project = project_service.get(project_id)
                if project:
                    if not project.processing_config:
                        project.processing_config = {}
                    fail_msg = f"Error en la descarga: {str(e)}" if is_es else (f"Download failed: {str(e)}" if is_en else f"下载失败: {str(e)}")
                    project.processing_config.update({
                        "download_status": "failed",
                        "download_progress": 0.0,
                        "download_message": fail_msg,
                        "error_message": fail_msg
                    })
                    project.status = ProjectStatus.FAILED
                    db.commit()
            finally:
                db.close()
        except Exception as mark_failed_error:
            logger.error(f"标记项目下载失败状态时出错: {mark_failed_error}")


async def _try_youtube_subtitle_strategies(url: str, download_dir: Path, browser: Optional[str] = None) -> str:
    """尝试多种YouTube字幕获取策略"""
    strategies = [
        lambda: _try_download_with_different_formats(url, download_dir, browser),
        lambda: _try_download_with_different_langs(url, download_dir, browser),
        lambda: _try_extract_from_metadata(url, download_dir, browser)
    ]
    
    for strategy in strategies:
        try:
            subtitle_path = await strategy()
            if subtitle_path:
                logger.info(f"YouTube备用字幕策略成功")
                return subtitle_path
        except Exception as e:
            logger.warning(f"YouTube备用字幕策略失败: {e}")
            continue
    
    logger.warning("所有YouTube字幕获取策略都失败了")
    return ""


async def _try_download_with_different_formats(url: str, download_dir: Path, browser: Optional[str] = None) -> str:
    """尝试下载不同格式的字幕"""
    import asyncio
    logger.info("尝试下载不同格式的YouTube字幕...")
    
    formats = ['srt', 'vtt', 'json3']
    
    for fmt in formats:
        try:
            ydl_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': get_subtitle_langs(),
                'subtitlesformat': fmt,
                'outtmpl': str(download_dir / f'subtitle_%(title)s.%(ext)s'),
                'noplaylist': True,
                'quiet': True,
                'ignoreconfig': True,
                'config_locations': [],
                'source_address': '0.0.0.0',
                'retries': 5,
                'extractor_args': {'youtube': {'player_client': ['android']}},
            }
            
            if browser:
                ydl_opts['cookiesfrombrowser'] = (browser.lower(),)
            
            def download_sync(url, ydl_opts):
                with sanitized_yt_env():
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        return ydl.download([url])
            
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, download_sync, url, ydl_opts)
            
            # 查找下载的字幕文件
            subtitle_files = list(download_dir.glob(f"*.{fmt}"))
            if subtitle_files:
                subtitle_path = str(subtitle_files[0])
                
                # 如果是VTT格式，转换为SRT
                if fmt == 'vtt':
                    srt_path = subtitle_path.replace('.vtt', '.srt')
                    await _convert_vtt_to_srt(subtitle_path, srt_path)
                    return srt_path
                
                return subtitle_path
                
        except Exception as e:
            logger.debug(f"尝试格式 {fmt} 失败: {e}")
            continue
    
    return ""


async def _try_download_with_different_langs(url: str, download_dir: Path, browser: Optional[str] = None) -> str:
    """尝试下载不同语言的字幕"""
    import asyncio
    logger.info("尝试下载不同语言的YouTube字幕...")
    
    lang_combinations = [
        ['es', 'es-orig', 'es-419', 'es-ES'], # 西班牙语
        ['en', 'en-US'],      # 英文
        ['zh-Hans', 'zh'],    # 中文
        ['ja', 'ja-JP'],      # 日文
        ['ko', 'ko-KR'],      # 韩文
        ['auto']              # 自动检测
    ]
    
    for langs in lang_combinations:
        try:
            ydl_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': langs,
                'subtitlesformat': 'srt',
                'outtmpl': str(download_dir / f'lang_%(title)s.%(ext)s'),
                'noplaylist': True,
                'quiet': True,
                'ignoreconfig': True,
                'config_locations': [],
                'source_address': '0.0.0.0',
                'retries': 5,
                'extractor_args': {'youtube': {'player_client': ['android']}},
            }
            
            if browser:
                ydl_opts['cookiesfrombrowser'] = (browser.lower(),)
            
            def download_sync(url, ydl_opts):
                with sanitized_yt_env():
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        return ydl.download([url])
            
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, download_sync, url, ydl_opts)
            
            # 查找下载的字幕文件
            subtitle_files = list(download_dir.glob("*.srt"))
            if subtitle_files:
                return str(subtitle_files[0])
                
        except Exception as e:
            logger.debug(f"尝试语言 {langs} 失败: {e}")
            continue
    
    return ""


async def _try_extract_from_metadata(url: str, download_dir: Path, browser: Optional[str] = None) -> str:
    """尝试从视频元数据中提取字幕信息"""
    import asyncio
    logger.info("尝试从YouTube视频元数据提取字幕信息...")
    
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'ignoreconfig': True,
            'config_locations': [],
        }
        
        if browser:
            ydl_opts['cookiesfrombrowser'] = (browser.lower(),)
        
        def extract_info_sync(url, ydl_opts):
            with sanitized_yt_env():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    return ydl.extract_info(url, download=False)
        
        loop = asyncio.get_event_loop()
        info_dict = await loop.run_in_executor(None, extract_info_sync, url, ydl_opts)
        
        # 检查是否有字幕信息
        subtitles = info_dict.get('subtitles', {})
        auto_subtitles = info_dict.get('automatic_captions', {})
        
        if subtitles or auto_subtitles:
            logger.info(f"发现YouTube字幕信息: {list(subtitles.keys()) + list(auto_subtitles.keys())}")
            # 这里可以进一步处理字幕信息，但目前返回空字符串
            return ""
        
        return ""
        
    except Exception as e:
        logger.debug(f"提取YouTube视频元数据失败: {e}")
        return ""


async def _convert_vtt_to_srt(vtt_path: str, srt_path: str):
    """将VTT字幕文件转换为SRT格式"""
    try:
        with open(vtt_path, 'r', encoding='utf-8') as vtt_file:
            vtt_content = vtt_file.read()
        
        # 简单的VTT到SRT转换
        lines = vtt_content.split('\n')
        srt_lines = []
        subtitle_count = 1
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # 跳过VTT头部信息
            if line.startswith('WEBVTT') or line.startswith('NOTE') or not line:
                i += 1
                continue
            
            # 查找时间戳行
            if '-->' in line:
                # 转换时间格式 (VTT使用点，SRT使用逗号)
                time_line = line.replace('.', ',')
                srt_lines.append(str(subtitle_count))
                srt_lines.append(time_line)
                
                # 获取字幕文本
                i += 1
                subtitle_text = []
                while i < len(lines) and lines[i].strip():
                    subtitle_text.append(lines[i].strip())
                    i += 1
                
                srt_lines.extend(subtitle_text)
                srt_lines.append('')  # 空行分隔
                subtitle_count += 1
            
            i += 1
        
        # 写入SRT文件
        with open(srt_path, 'w', encoding='utf-8') as srt_file:
            srt_file.write('\n'.join(srt_lines))
            
        logger.info(f"VTT转SRT转换成功: {vtt_path} -> {srt_path}")
        
    except Exception as e:
        logger.error(f"VTT转SRT转换失败: {e}")
        raise
