"""
Step 1: 大纲提取 - 从转写文本中提取结构性大纲
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
from pathlib import Path

# 导入依赖
from ..utils.llm_client import LLMClient
from ..utils.text_processor import TextProcessor
from ..core.shared_config import PROMPT_FILES, METADATA_DIR

logger = logging.getLogger(__name__)

class OutlineExtractor:
    """大纲提取器（重构版）"""
    
    def __init__(self, metadata_dir: Path = None, prompt_files: Dict = None, language: str = "es"):
        self.llm_client = LLMClient()
        self.text_processor = TextProcessor()
        self.language = language or "es"
        
        # 使用传入的metadata_dir或默认值
        if metadata_dir is None:
            metadata_dir = METADATA_DIR
        self.metadata_dir = metadata_dir
        
        # 使用传入的prompt_files或默认值
        if prompt_files is None:
            prompt_files = PROMPT_FILES
        
        # 加载提示词
        with open(prompt_files['outline'], 'r', encoding='utf-8') as f:
            self.outline_prompt = f.read()
            
        # 创建用于存放中间文本块的目录
        self.chunks_dir = self.metadata_dir / "step1_chunks"
        self.chunks_dir.mkdir(parents=True, exist_ok=True)
        # 创建用于存放中间SRT块的目录
        self.srt_chunks_dir = self.metadata_dir / "step1_srt_chunks"
        self.srt_chunks_dir.mkdir(parents=True, exist_ok=True)

    def extract_outline(self, srt_path: Path) -> List[Dict]:
        """
        从SRT文件提取视频大纲
        
        Args:
            srt_path: SRT文件路径
            
        Returns:
            视频大纲列表
        """
        logger.info(f"开始提取视频大纲... (语言: {self.language})")
        
        # 1. 解析SRT文件
        try:
            srt_data = self.text_processor.parse_srt(srt_path)
            if not srt_data:
                logger.warning("SRT文件为空或解析失败")
                return []
        except Exception as e:
            logger.error(f"解析SRT文件失败: {e}")
            return []
            
        # 1.5 时长画像：短视频不能套播客参数（#59）。写盘给 step2 / step3 复用
        from .quality import profile_from_srt, save_profile
        profile = profile_from_srt(srt_data)
        save_profile(profile, self.metadata_dir)
        outline_prompt = self.outline_prompt + profile.prompt_hint(language=self.language)
        if self.language.startswith("es"):
            outline_prompt += "\n\nOBLIGATORIO: Genera todos los títulos de temas y subtópicos estrictamente en ESPAÑOL.\n"
        elif self.language.startswith("en"):
            outline_prompt += "\n\nIMPORTANT: Generate all topic titles and subtopics strictly in ENGLISH.\n"
        logger.info(f"时长画像: {profile.tier}，总时长 {profile.total_sec:.0f}s，建议话题数 {profile.topics_hint}")

        # 2. 基于时间智能分块（短 / 中视频整条一块，长视频 ~30 分钟一块）
        interval = 30 if profile.tier == "long" else max(1, int(profile.total_sec // 60) + 1)
        chunks = self.text_processor.chunk_srt_data(srt_data, interval_minutes=interval)
        logger.info(f"文本已按~{interval}分钟/块切分，共{len(chunks)}个块")
        
        # 3. 保存文本块和SRT块到中间文件
        chunk_files = self._save_chunks_to_files(chunks)
        self._save_srt_chunks(chunks)
        
        all_outlines = []
        
        # 4. 逐一处理每个文本块文件
        for i, chunk_file in enumerate(chunk_files):
            logger.info(f"处理第{i+1}/{len(chunks)}个文本块: {chunk_file.name}")
            try:
                # 读取文本块内容
                with open(chunk_file, 'r', encoding='utf-8') as f:
                    chunk_text = f.read()
                
                # 为每个块调用LLM
                input_data = {"text": chunk_text}
                response = self.llm_client.call_with_retry(outline_prompt, input_data)
                
                if response:
                    # 保存原始响应便于排查
                    raw_dir = self.metadata_dir / "step1_llm_raw_output"
                    raw_dir.mkdir(parents=True, exist_ok=True)
                    with open(raw_dir / f"chunk_{i}.txt", 'w', encoding='utf-8') as rf:
                        rf.write(response)
                    
                    # 解析响应并附加块索引
                    # 注意：这里的chunk_index直接用i，与文件名和原始chunk对应
                    parsed_outlines = self._parse_outline_response(response, i)
                    all_outlines.extend(parsed_outlines)
                else:
                    logger.warning(f"处理第{i+1}个文本块时返回空响应")
            except Exception as e:
                logger.error(f"处理第{i+1}个文本块失败: {e}")
                continue
        
        # 如果模型输出未被解析出大纲，启用基于文本的兜底大纲提取
        if not all_outlines:
            logger.warning("所有文本块大纲解析为空，启用字幕兜底大纲生成")
            all_outlines = self._fallback_create_outlines(chunks)
        
        # 5. 合并和去重
        final_outlines = self._merge_outlines(all_outlines)
        
        logger.info(f"大纲提取完成，共{len(final_outlines)}个话题")
        return final_outlines

    def _fallback_create_outlines(self, chunks: List[Dict]) -> List[Dict]:
        """兜底创建大纲，防止大模型未按格式返回时整个流程中止"""
        fallback = []
        for chunk in chunks:
            chunk_idx = chunk.get('chunk_index', 0)
            srt_entries = chunk.get('srt_entries', [])
            
            # 从该块中提取2个均匀分布的话题
            n_entries = len(srt_entries)
            if n_entries > 0:
                t1 = srt_entries[0].get('text', '')[:40].strip() or f"核心要点 1 (第{chunk_idx+1}部分)"
                mid_idx = n_entries // 2
                t2 = srt_entries[mid_idx].get('text', '')[:40].strip() or f"核心要点 2 (第{chunk_idx+1}部分)"
                
                fallback.append({
                    'title': t1.rstrip('。，！？,!?…:：'),
                    'subtopics': [],
                    'chunk_index': chunk_idx
                })
                fallback.append({
                    'title': t2.rstrip('。，！？,!?…:：'),
                    'subtopics': [],
                    'chunk_index': chunk_idx
                })
            else:
                fallback.append({
                    'title': f"精彩片段 {chunk_idx+1}",
                    'subtopics': [],
                    'chunk_index': chunk_idx
                })
        logger.warning(f"已为 {len(chunks)} 个块生成 {len(fallback)} 个兜底大纲")
        return fallback

    def _save_chunks_to_files(self, chunks: List[Dict]) -> List[Path]:
        """将文本块保存为单独的 .txt 文件"""
        chunk_files = []
        for chunk in chunks:
            chunk_index = chunk['chunk_index']
            text_content = chunk['text']
            file_path = self.chunks_dir / f"chunk_{chunk_index}.txt"
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(text_content)
            chunk_files.append(file_path)
        
        logger.info(f"所有文本块已保存到: {self.chunks_dir}")
        return chunk_files

    def _save_srt_chunks(self, chunks: List[Dict]):
        """将SRT数据块保存为单独的 .json 文件"""
        for chunk in chunks:
            chunk_index = chunk['chunk_index']
            srt_entries = chunk['srt_entries']
            file_path = self.srt_chunks_dir / f"chunk_{chunk_index}.json"
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(srt_entries, f, ensure_ascii=False, indent=2)
        
        logger.info(f"所有SRT块已保存到: {self.srt_chunks_dir}")

    def _parse_outline_response(self, response: str, chunk_index: int) -> List[Dict]:
        """
        多格式兼容解析大模型的大纲响应：
        - 支持去除 <think> 思考过程
        - 支持 JSON 格式
        - 支持 Markdown 编号加粗（1. **标题**）
        - 支持普通编号（1. 标题）
        - 支持标题语法（### 标题）
        - 支持子话题提取
        """
        if not response:
            return []
        
        # 移除思考标签
        cleaned = re.sub(r'<think>[\s\S]*?</think>', '', response).strip()
        
        # 1. 尝试作为 JSON 解析
        try:
            parsed = self.llm_client.parse_json_response(cleaned)
            if isinstance(parsed, dict):
                for k in ["outline", "outlines", "topics", "items", "data", "results"]:
                    if k in parsed and isinstance(parsed[k], list):
                        parsed = parsed[k]
                        break
            if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                json_outlines = []
                for item in parsed:
                    title = item.get('title') or item.get('topic') or item.get('outline') or item.get('name')
                    subtopics = item.get('subtopics') or item.get('points') or []
                    if title:
                        json_outlines.append({
                            'title': str(title).strip().rstrip('。，！？,!?…:：'),
                            'subtopics': [str(s) for s in subtopics] if isinstance(subtopics, list) else [],
                            'chunk_index': chunk_index
                        })
                if json_outlines:
                    logger.info(f"  > 块 {chunk_index} 成功从 JSON 解析出 {len(json_outlines)} 个大纲话题")
                    return json_outlines
        except Exception:
            pass
        
        # 2. 正则解析 Markdown
        outlines = []
        lines = cleaned.split('\n')
        current_outline = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 判断是否是一级标题/话题行
            is_num_header = bool(re.match(r'^(?:#+\s*)?(?:\d+[\.\、\)]|\-|\*)\s*(?:\*\*)?', line))
            is_md_header = bool(re.match(r'^#{1,4}\s+', line))
            is_bullet = line.startswith(('-', '*', '•'))
            
            if is_bullet and current_outline and not (line.startswith('- **') or line.startswith('* **') or is_num_header):
                # 认为是子话题
                subtopic = re.sub(r'^[\-\*\•]\s*', '', line).strip().strip('*_ ')
                if subtopic and len(subtopic) <= 200:
                    current_outline['subtopics'].append(subtopic)
            elif is_num_header or is_md_header:
                # 提取标题文本
                raw = line
                if '**' in raw:
                    m = re.search(r'\*\*(.+?)\*\*', raw)
                    topic_name = m.group(1).strip() if m else raw
                else:
                    topic_name = re.sub(r'^(?:#+\s*)?(?:\d+[\.\、\)]|\-|\*)\s*', '', raw).strip()
                
                # 剔除预估时长等尾随信息
                topic_name = re.sub(r'[\(（].*?[\)）]', '', topic_name).strip()
                topic_name = topic_name.strip('*#:： ')
                
                # 过滤无意义的词语如 "大纲"
                if topic_name and topic_name not in ["大纲", "大纲：", "大纲:", "大纲如下", "大纲：", "视频大纲", "核心话题"] and len(topic_name) > 2:
                    if current_outline:
                        outlines.append(current_outline)
                    current_outline = {
                        'title': topic_name,
                        'subtopics': [],
                        'chunk_index': chunk_index
                    }
                    logger.info(f"  > 提取话题: {topic_name}")
        
        if current_outline:
            outlines.append(current_outline)
        
        return outlines
    
    def _merge_outlines(self, outlines: List[Dict]) -> List[Dict]:
        """
        合并和去重大纲，保留最先出现的版本
        """
        unique_outlines = {}
        for outline in outlines:
            title = outline['title']
            if title not in unique_outlines:
                unique_outlines[title] = outline
        return list(unique_outlines.values())
    
    def save_outline(self, outlines: List[Dict], output_path: Optional[Path] = None) -> Path:
        """
        保存大纲到文件
        """
        if output_path is None:
            output_path = self.metadata_dir / "step1_outline.json"
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(outlines, f, ensure_ascii=False, indent=2)
        
        logger.info(f"大纲已保存到: {output_path}")
        return output_path
    
    def load_outline(self, input_path: Path) -> List[Dict]:
        """
        从文件加载大纲
        """
        with open(input_path, 'r', encoding='utf-8') as f:
            return json.load(f)

def run_step1_outline(srt_path: Path, metadata_dir: Path = None, output_path: Optional[Path] = None, prompt_files: Dict = None, language: str = "es") -> List[Dict]:
    """
    运行Step 1: 大纲提取
    """
    if metadata_dir is None:
        metadata_dir = METADATA_DIR
        
    extractor = OutlineExtractor(metadata_dir, prompt_files, language=language)
    outlines = extractor.extract_outline(srt_path)
    
    if output_path is None:
        output_path = metadata_dir / "step1_outline.json"
        
    extractor.save_outline(outlines, output_path)
    
    return outlines