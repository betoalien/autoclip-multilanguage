"""
Step 5: 主题聚类 - 将相似内容聚类成合集
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
from pathlib import Path

# 导入依赖
from ..utils.llm_client import LLMClient
from ..core.shared_config import PROMPT_FILES, METADATA_DIR, MAX_CLIPS_PER_COLLECTION

logger = logging.getLogger(__name__)

class ClusteringEngine:
    """主题聚类引擎"""
    
    def __init__(self, metadata_dir: Optional[Path] = None, prompt_files: Dict = None, language: str = "es"):
        self.llm_client = LLMClient()
        self.language = language or "es"
        
        # 加载提示词
        prompt_files_to_use = prompt_files if prompt_files is not None else PROMPT_FILES
        with open(prompt_files_to_use['clustering'], 'r', encoding='utf-8') as f:
            self.clustering_prompt = f.read()
        
        # 使用传入的metadata_dir或默认值
        if metadata_dir is None:
            metadata_dir = METADATA_DIR
        self.metadata_dir = metadata_dir
    
    def cluster_clips(self, clips_with_titles: List[Dict]) -> List[Dict]:
        """
        对片段进行主题聚类
        
        Args:
            clips_with_titles: 带标题的片段列表
            
        Returns:
            合集数据列表
        """
        logger.info(f"开始进行主题聚类... (语言: {self.language})")
        
        # 准备聚类数据
        clips_for_clustering = []
        for clip in clips_with_titles:
            clips_for_clustering.append({
                'id': clip['id'],
                'title': clip.get('generated_title', clip['outline']),
                'summary': clip.get('recommend_reason', ''),
                'score': clip.get('final_score', 0)
            })
        
        # 首先进行基于关键词的预聚类
        pre_clusters = self._pre_cluster_by_keywords(clips_for_clustering)
        
        # 构建完整的提示词
        full_prompt = self.clustering_prompt + "\n\n以下是视频切片列表：\n"
        for i, clip in enumerate(clips_for_clustering, 1):
            full_prompt += f"{i}. 标题：{clip['title']}\n   摘要：{clip['summary']}\n   评分：{clip['score']:.2f}\n\n"
        
        # 添加预聚类结果作为参考
        if pre_clusters:
            full_prompt += "\n\n基于关键词的预聚类结果（仅供参考）：\n"
            for theme, clip_ids in pre_clusters.items():
                full_prompt += f"{theme}: {', '.join(clip_ids)}\n"
        
        if self.language.startswith("es"):
            full_prompt += "\n\nOBLIGATORIO: Genera todos los nombres de colección (collection_title) y resúmenes (collection_summary) obligatoriamente en ESPAÑOL (Spanish).\n"
        elif self.language.startswith("en"):
            full_prompt += "\n\nIMPORTANT: Generate all collection titles and summaries strictly in ENGLISH.\n"
        
        try:
            # 调用大模型进行聚类
            response = self.llm_client.call_with_retry(full_prompt)
            
            # 解析JSON响应
            collections_data = self.llm_client.parse_json_response(response)
            
            # 验证和清理合集数据
            validated_collections = self._validate_collections(collections_data, clips_with_titles)
            
            # 如果LLM聚类结果为空，才尝试备选方案
            if not validated_collections:
                logger.warning("LLM聚类结果为空，尝试使用预聚类或默认合集")
                if pre_clusters:
                    validated_collections = self._create_collections_from_pre_clusters(pre_clusters, clips_with_titles)
                if not validated_collections:
                    validated_collections = self._create_default_collections(clips_with_titles)
            
            logger.info(f"主题聚类完成，共{len(validated_collections)}个合集")
            return validated_collections
            
        except Exception as e:
            logger.error(f"主题聚类失败: {str(e)}")
            # 使用预聚类结果作为备选
            if pre_clusters:
                logger.info("使用预聚类结果作为备选方案")
                res = self._create_collections_from_pre_clusters(pre_clusters, clips_with_titles)
                if res:
                    return res
            # 返回默认聚类结果
            return self._create_default_collections(clips_with_titles)
    
    def _pre_cluster_by_keywords(self, clips: List[Dict]) -> Dict[str, List[str]]:
        """
        基于关键词进行预聚类
        
        Args:
            clips: 片段列表
            
        Returns:
            预聚类结果
        """
        # 定义主题关键词
        theme_keywords = {
            '投资理财': ['投资', '理财', '股票', '基金', '炒股', '赚钱', '收益', '涨跌', '解套', '散户', 'A股', '北交所', '中免', '种业'],
            '职场成长': ['职场', '工作', '技能', '学习', '日语', '董秘', '逆袭', '教育', '大学生', '财商'],
            '社会观察': ['社会', '现象', '网络', '乱象', '垃圾', '分类', '平台', '机制', '主播', '行业'],
            '文化差异': ['文化', '差异', '欧美', '日本', '韩国', '饮食', '语言', '狐臭', '蒸锅', '邮轮'],
            '直播互动': ['直播', '互动', '弹幕', '粉丝', '舰长', '打赏', '连麦', 'PK', '抽奖'],
            '情感关系': ['恋爱', '情感', '社交', '搭讪', '关系', '心理', '心动', '冷淡'],
            '健康生活': ['健康', '运动', '跑步', '饮食', '牛奶', '生活方式', '锻炼'],
            '创作平台': ['创作', '平台', 'B站', '小红书', '摄影', '内容', '运营', '自媒体']
        }
        
        pre_clusters = {theme: [] for theme in theme_keywords.keys()}
        
        for clip in clips:
            # 合并标题和摘要进行关键词匹配
            text = f"{clip['title']} {clip['summary']}".lower()
            
            # 计算每个主题的匹配分数
            theme_scores = {}
            for theme, keywords in theme_keywords.items():
                score = sum(1 for keyword in keywords if keyword in text)
                if score > 0:
                    theme_scores[theme] = score
            
            # 选择匹配分数最高的主题
            if theme_scores:
                best_theme = max(theme_scores.keys(), key=lambda k: theme_scores[k])
                pre_clusters[best_theme].append(clip['id'])
        
        # 过滤掉空的主题
        return {theme: clip_ids for theme, clip_ids in pre_clusters.items() if len(clip_ids) >= 2}
    
    def _create_collections_from_pre_clusters(self, pre_clusters: Dict[str, List[str]], clips_with_titles: List[Dict]) -> List[Dict]:
        """
        从预聚类结果创建合集
        
        Args:
            pre_clusters: 预聚类结果
            clips_with_titles: 片段数据
            
        Returns:
            合集数据列表
        """
        collections = []
        collection_id = 1
        
        # 主题标题映射
        theme_titles = {
            '投资理财': '投资理财启示',
            '职场成长': '职场成长记', 
            '社会观察': '社会观察笔记',
            '文化差异': '文化差异趣谈',
            '直播互动': '直播互动现场',
            '情感关系': '情感与关系',
            '健康生活': '健康生活方式',
            '创作平台': '创作与平台生态'
        }
        
        # 主题简介映射
        theme_summaries = {
            '投资理财': '通过生活化案例分享投资理念，兼具实用与共鸣。',
            '职场成长': '探讨职业发展、技能提升与职场心态变化。',
            '社会观察': '理性点评社会现象与网络乱象，观点鲜明。',
            '文化差异': '从饮食到语言，展现跨文化交流的趣味视角。',
            '直播互动': '还原真实直播间互动场景，展现主播临场反应。',
            '情感关系': '解析恋爱心理、社交困惑与情感共鸣话题。',
            '健康生活': '分享运动、饮食、心理调适等健康管理经验。',
            '创作平台': '剖析内容创作困境与平台机制，适合创作者参考。'
        }
        
        for theme, clip_ids in pre_clusters.items():
            # 限制每个合集的片段数量
            if len(clip_ids) > MAX_CLIPS_PER_COLLECTION:
                clip_ids = clip_ids[:MAX_CLIPS_PER_COLLECTION]
            
            collections.append({
                'id': str(collection_id),
                'collection_title': theme_titles.get(theme, theme),
                'collection_summary': theme_summaries.get(theme, f'{theme}相关精彩片段合集'),
                'clip_ids': clip_ids
            })
            collection_id += 1
        
        return collections
    
    def _validate_collections(self, collections_data: Any, clips_with_titles: List[Dict]) -> List[Dict]:
        """
        验证和清理合集数据
        
        Args:
            collections_data: 原始合集数据
            clips_with_titles: 片段数据
            
        Returns:
            验证后的合集数据
        """
        validated_collections = []
        if not isinstance(collections_data, list):
            if isinstance(collections_data, dict):
                # 可能被包装在某个键中
                for k in ['collections', 'clusters', 'results', 'data', 'items']:
                    if k in collections_data and isinstance(collections_data[k], list):
                        collections_data = collections_data[k]
                        break
                else:
                    collections_data = [collections_data]
            else:
                return []
        
        for i, collection in enumerate(collections_data):
            try:
                if not isinstance(collection, dict):
                    continue
                
                # 兼容不同键名
                title = collection.get('collection_title') or collection.get('title') or collection.get('name') or collection.get('theme')
                summary = collection.get('collection_summary') or collection.get('summary') or collection.get('description') or ""
                raw_clips = collection.get('clips') or collection.get('clip_ids') or collection.get('items') or []
                
                if not title or not raw_clips:
                    logger.warning(f"合集 {i} 缺少必需字段（title 或 clips），跳过")
                    continue
                
                valid_clip_ids = []
                for clip_ref in raw_clips:
                    ref_str = str(clip_ref).strip()
                    matched_id = None
                    for clip in clips_with_titles:
                        cid = str(clip.get('id', '')).strip()
                        gen_t = str(clip.get('generated_title', '')).strip()
                        out_t = str(clip.get('outline', '')).strip()
                        if ref_str == cid:
                            matched_id = cid
                            break
                        elif ref_str.lower() in [gen_t.lower(), out_t.lower()]:
                            matched_id = cid
                            break
                        elif ref_str.lower() in gen_t.lower() or gen_t.lower() in ref_str.lower() or ref_str.lower() in out_t.lower():
                            matched_id = cid
                            break
                    if matched_id and matched_id not in valid_clip_ids:
                        valid_clip_ids.append(matched_id)
                
                if len(valid_clip_ids) < 1:
                    logger.warning(f"合集 '{title}' 未匹配到任何有效片段ID，跳过")
                    continue
                
                # 限制每个合集的片段数量
                if len(valid_clip_ids) > MAX_CLIPS_PER_COLLECTION:
                    valid_clip_ids = valid_clip_ids[:MAX_CLIPS_PER_COLLECTION]
                
                validated_collection = {
                    'id': str(len(validated_collections) + 1),
                    'collection_title': str(title).strip(),
                    'collection_summary': str(summary).strip() or f"合集: {title}",
                    'clip_ids': valid_clip_ids
                }
                validated_collections.append(validated_collection)
                
            except Exception as e:
                logger.error(f"验证合集 {i} 失败: {str(e)}")
                continue
        
        return validated_collections
    
    def _create_default_collections(self, clips_with_titles: List[Dict]) -> List[Dict]:
        """
        创建默认合集（当聚类失败或无有效合集时）
        
        Args:
            clips_with_titles: 片段数据
            
        Returns:
            默认合集数据
        """
        logger.info("创建默认合集...")
        if not clips_with_titles:
            return []
        
        # 判断是否包含中文字符
        sample_text = " ".join([str(c.get('generated_title', '')) for c in clips_with_titles[:3]])
        is_zh = any('\u4e00' <= char <= '\u9fff' for char in sample_text)
        
        # 按评分降序排列
        sorted_clips = sorted(clips_with_titles, key=lambda c: float(c.get('final_score') or 0), reverse=True)
        collections = []
        
        if self.language.startswith("es"):
            title1 = "Momentos Destacados"
            summary1 = "Los mejores momentos seleccionados del video"
            title2 = "Recomendaciones Principales"
            summary2 = "Colección de momentos destacados de alto valor"
        elif is_zh:
            title1 = "精选高分片段"
            summary1 = "评分最高的核心精彩片段合集"
            title2 = "优质内容推荐"
            summary2 = "精选优质内容片段"
        else:
            title1 = "Featured Highlights"
            summary1 = "Curated highlights with the highest quality moments"
            title2 = "Recommended Moments"
            summary2 = "Additional recommended moments from the video"

        # 创建主要精彩片段合集
        top_clips = [c['id'] for c in sorted_clips[:MAX_CLIPS_PER_COLLECTION]]
        if top_clips:
            collections.append({
                'id': '1',
                'collection_title': title1,
                'collection_summary': summary1,
                'clip_ids': top_clips
            })
        
        # 若切片较多，创建第二个合集
        if len(sorted_clips) > 4:
            rem_clips = [c['id'] for c in sorted_clips[4:4 + MAX_CLIPS_PER_COLLECTION]]
            if len(rem_clips) >= 2:
                collections.append({
                    'id': '2',
                    'collection_title': title2,
                    'collection_summary': summary2,
                    'clip_ids': rem_clips
                })
        
        return collections
    
    def save_collections(self, collections_data: List[Dict], output_path: Optional[Path] = None) -> Path:
        """
        保存合集数据
        
        Args:
            collections_data: 合集数据
            output_path: 输出路径
            
        Returns:
            保存的文件路径
        """
        if output_path is None:
            output_path = self.metadata_dir / "collections.json"
        
        # 确保目录存在
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存数据
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(collections_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"合集数据已保存到: {output_path}")
        return output_path
    
    def load_collections(self, input_path: Path) -> List[Dict]:
        """
        从文件加载合集数据
        
        Args:
            input_path: 输入文件路径
            
        Returns:
            合集数据
        """
        with open(input_path, 'r', encoding='utf-8') as f:
            return json.load(f)

def run_step5_clustering(clips_with_titles_path: Path, output_path: Optional[Path] = None, metadata_dir: Optional[str] = None, prompt_files: Dict = None, language: str = "es") -> List[Dict]:
    """
    运行Step 5: 主题聚类
    
    Args:
        clips_with_titles_path: 带标题的片段文件路径
        output_path: 输出文件路径
        prompt_files: 自定义提示词文件
        language: 目标语言 (默认 'es')
        
    Returns:
        合集数据
    """
    # 加载数据
    with open(clips_with_titles_path, 'r', encoding='utf-8') as f:
        clips_with_titles = json.load(f)
    
    # 创建聚类器
    if metadata_dir is None:
        metadata_dir = METADATA_DIR
    clusterer = ClusteringEngine(metadata_dir=Path(metadata_dir), prompt_files=prompt_files, language=language)
    
    # 进行聚类
    collections_data = clusterer.cluster_clips(clips_with_titles)
    
    # 保存结果
    if output_path is None:
        if metadata_dir is None:
            metadata_dir = METADATA_DIR
        output_path = Path(metadata_dir) / "step5_collections.json"
    
    clusterer.save_collections(collections_data, output_path)
    
    return collections_data