"""
Step 2: 时间线提取 - 为大纲中的每个话题定位具体时间区间
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
from pathlib import Path
from collections import defaultdict

# 导入依赖
from ..utils.llm_client import LLMClient
from ..utils.text_processor import TextProcessor
from ..core.shared_config import PROMPT_FILES, METADATA_DIR

logger = logging.getLogger(__name__)

class TimelineExtractor:
    """从大纲和SRT字幕中提取精确时间线"""
    
    def __init__(self, metadata_dir: Path = None, prompt_files: Dict = None, language: str = "es"):
        self.llm_client = LLMClient()
        self.text_processor = TextProcessor()
        self.language = language or "es"
        
        # 使用传入的metadata_dir或默认值
        if metadata_dir is None:
            metadata_dir = METADATA_DIR
        self.metadata_dir = metadata_dir
        
        # 加载提示词
        prompt_files_to_use = prompt_files if prompt_files is not None else PROMPT_FILES
        with open(prompt_files_to_use['timeline'], 'r', encoding='utf-8') as f:
            self.timeline_prompt = f.read()
            
        # SRT块的目录
        self.srt_chunks_dir = self.metadata_dir / "step1_srt_chunks"
        self.timeline_chunks_dir = self.metadata_dir / "step2_timeline_chunks"
        self.llm_raw_output_dir = self.metadata_dir / "step2_llm_raw_output"

    def extract_timeline(self, outlines: List[Dict]) -> List[Dict]:
        """
        提取话题时间区间。
        新版特性：
        - 基于预先分块的SRT
        - 按块批量处理
        - 缓存原始LLM响应，避免重复调用
        - 保存每个块的处理结果作为中间文件，增强健壮性
        """
        logger.info(f"开始提取话题时间区间... (语言: {self.language})")
        
        if not outlines:
            logger.warning("大纲数据为空，无法提取时间线。")
            return []

        if not self.srt_chunks_dir.exists():
            logger.error(f"SRT块目录不存在: {self.srt_chunks_dir}。请先运行Step 1。")
            return []

        # 1. 创建本步骤需要的目录
        self.timeline_chunks_dir.mkdir(parents=True, exist_ok=True)
        self.llm_raw_output_dir.mkdir(parents=True, exist_ok=True)

        # 时长画像追加到提示词（覆盖提示词里写死的 90 秒 / 3–6 分钟）
        from .quality import load_profile
        profile = load_profile(self.metadata_dir)
        timeline_prompt = self.timeline_prompt + (profile.prompt_hint(language=self.language) if profile else "")

        # 2. 按 chunk_index 对所有大纲进行分组
        outlines_by_chunk = defaultdict(list)
        for outline in outlines:
            chunk_index = outline.get('chunk_index')
            if chunk_index is not None:
                outlines_by_chunk[chunk_index].append(outline)
            else:
                logger.warning(f"  > 话题 '{outline.get('title', '未知')}' 缺少 chunk_index，将被跳过。")

        all_timeline_data = []
        # 3. 遍历每个块，批量处理，并将结果存为独立的JSON文件
        for chunk_index, chunk_outlines in outlines_by_chunk.items():
            logger.info(f"处理块 {chunk_index}，其中包含 {len(chunk_outlines)} 个话题...")
            
            # 每次都重新处理，不使用缓存
            chunk_output_path = self.timeline_chunks_dir / f"chunk_{chunk_index}.json"

            try:
                # 首先加载对应的SRT块文件，无论是否使用缓存都需要这些信息
                srt_chunk_path = self.srt_chunks_dir / f"chunk_{chunk_index}.json"
                if not srt_chunk_path.exists():
                    logger.warning(f"  > 找不到对应的SRT块文件: {srt_chunk_path}，跳过整个块。")
                    continue
                
                with open(srt_chunk_path, 'r', encoding='utf-8') as f:
                    srt_chunk_data = json.load(f)

                if not srt_chunk_data:
                    logger.warning(f"  > SRT块文件为空: {srt_chunk_path}，跳过整个块。")
                    continue

                # 获取时间范围信息
                chunk_start_time = srt_chunk_data[0]['start_time']
                chunk_end_time = srt_chunk_data[-1]['end_time']

                raw_response = ""
                llm_cache_path = self.llm_raw_output_dir / f"chunk_{chunk_index}.txt"

                if llm_cache_path.exists():
                    logger.info(f"  > 找到块 {chunk_index} 的LLM原始响应缓存，直接读取。")
                    with open(llm_cache_path, 'r', encoding='utf-8') as f:
                        raw_response = f.read()
                else:
                    logger.info(f"  > 未找到LLM缓存，开始调用API...")
                    
                    # 构建用于LLM的SRT文本
                    srt_text_for_prompt = ""
                    for sub in srt_chunk_data:
                        srt_text_for_prompt += f"{sub['index']}\\n{sub['start_time']} --> {sub['end_time']}\\n{sub['text']}\\n\\n"
                    
                    # 为LLM准备一个"干净"的输入，只包含它需要的信息
                    llm_input_outlines = [
                        {"title": o.get("title"), "subtopics": o.get("subtopics")}
                        for o in chunk_outlines
                    ]

                    input_data = {
                        "outline": llm_input_outlines,  # 使用干净的数据
                        "srt_text": srt_text_for_prompt
                    }
                    
                    # 调用LLM获取原始响应，带重试机制
                    parsed_items = None
                    max_parse_retries = 2
                    
                    for retry_count in range(max_parse_retries + 1):
                        try:
                            raw_response = self.llm_client.call_with_retry(timeline_prompt, input_data)
                            
                            if not raw_response:
                                logger.warning(f"  > 块 {chunk_index} LLM响应为空，跳过")
                                break
                            
                            # 保存原始响应到缓存
                            cache_file = self.llm_raw_output_dir / f"chunk_{chunk_index}_attempt_{retry_count}.txt"
                            with open(cache_file, 'w', encoding='utf-8') as f:
                                f.write(raw_response)
                            
                            # 解析LLM的原始响应
                            parsed_items = self._parse_and_validate_response(
                                raw_response, 
                                chunk_start_time, 
                                chunk_end_time,
                                chunk_index,
                                chunk_outlines,
                                srt_chunk_data
                            )
                            
                            if parsed_items:
                                # 保存解析后的结果
                                with open(chunk_output_path, 'w', encoding='utf-8') as f:
                                    json.dump(parsed_items, f, ensure_ascii=False, indent=2)
                                
                                logger.info(f"  > 块 {chunk_index} 成功解析 {len(parsed_items)} 个时间段")
                                break  # 成功解析，跳出重试循环
                            else:
                                if retry_count < max_parse_retries:
                                    logger.warning(f"  > 块 {chunk_index} 解析失败，尝试重试 ({retry_count + 1}/{max_parse_retries + 1})")
                                    # 在重试时强化提示词，强调JSON格式
                                    input_data['additional_instruction'] = (
                                        "\n\n【重要要求】请严格仅返回包含 outline、start_time、end_time 的合法 JSON 数组，例如：\n"
                                        '[{"outline": "话题标题", "start_time": "00:01:20,000", "end_time": "00:04:30,000"}]\n'
                                        "不要输出任何对话前缀、Markdown标记或解释文字。"
                                    )
                                else:
                                    logger.error(f"  > 块 {chunk_index} 经过 {max_parse_retries + 1} 次尝试仍然解析失败")
                                    # 保存最后一次的原始响应以便调试
                                    self._save_debug_response(raw_response, chunk_index, "final_parse_failure")
                                    
                        except Exception as parse_error:
                            logger.error(f"  > 块 {chunk_index} 第 {retry_count + 1} 次尝试解析过程中发生异常: {parse_error}")
                            if retry_count == max_parse_retries:
                                # 保存原始响应以便调试
                                self._save_debug_response(raw_response if 'raw_response' in locals() else "No response", chunk_index, "parse_exception")
                            continue
                    
                    if not parsed_items:
                         logger.warning(f"  > 块 {chunk_index} LLM解析无有效片段，执行基于字幕的兜底划分")
                         parsed_items = self._fallback_extract_timeline(chunk_outlines, srt_chunk_data, chunk_index)
                         if parsed_items:
                             with open(chunk_output_path, 'w', encoding='utf-8') as f:
                                 json.dump(parsed_items, f, ensure_ascii=False, indent=2)

            except Exception as e:
                logger.error(f"  > 处理块 {chunk_index} 时出错: {str(e)}")
                continue
        
        # 4. 从所有中间文件中拼接最终结果
        logger.info("所有块处理完毕，开始从中间文件拼接最终结果...")
        all_timeline_data = []
        chunk_files = sorted(self.timeline_chunks_dir.glob("*.json"))
        for chunk_file in chunk_files:
            with open(chunk_file, 'r', encoding='utf-8') as f:
                chunk_data = json.load(f)
                all_timeline_data.extend(chunk_data)

        logger.info(f"成功从 {len(chunk_files)} 个块文件中加载了 {len(all_timeline_data)} 个话题。")
        
        # 最终排序：在返回所有结果前，按开始时间进行全局排序
        if all_timeline_data:
            logger.info("按开始时间对所有话题进行最终排序...")
            try:
                # 使用 text_processor 将时间字符串转换为秒数以便正确排序
                all_timeline_data.sort(key=lambda x: self.text_processor.time_to_seconds(x['start_time']))
                logger.info("排序完成。")
                
                # 为所有片段按时间顺序分配固定的ID
                logger.info("为所有片段按时间顺序分配固定ID...")
                for i, timeline_item in enumerate(all_timeline_data):
                    timeline_item['id'] = str(i + 1)
                logger.info(f"已为 {len(all_timeline_data)} 个片段分配了固定ID（1-{len(all_timeline_data)}）")
                
            except Exception as e:
                logger.error(f"对最终结果排序时出错: {e}。返回未排序的结果。")

        # 5. 程序化校正：对齐字幕边界 / 时长上下限 / 去重合并（docs/QUALITY_AND_PUBLISH_PLAN.md 线 1-B）
        if all_timeline_data:
            try:
                from .quality import load_srt_chunks, refine_timeline, save_report
                srt_entries = load_srt_chunks(self.metadata_dir)
                refined, report = refine_timeline(all_timeline_data, srt_entries, profile)
                save_report({"step2": report}, self.metadata_dir)
                logger.info(
                    f"时间线校正: {report['input']} → {report['output']} 段，"
                    f"合并 {len(report['merged'])}，丢弃 {len(report['dropped'])}，"
                    f"延长 {report['extended']}，截断 {report['trimmed']}，"
                    f"吸附偏移 p90={report.get('snap_offset_p90', 0)}s"
                )
                all_timeline_data = refined
            except Exception as e:  # noqa: BLE001
                logger.error(f"时间线校正失败，沿用原始结果: {e}")

        return all_timeline_data
        
    def _parse_and_validate_response(self, response: str, chunk_start: str, chunk_end: str, chunk_index: int, chunk_outlines: List[Dict] = None, srt_chunk_data: List[Dict] = None) -> List[Dict]:
        """增强的解析LLM批量响应、自动归一化键名并验证时间范围"""
        validated_items = []
        chunk_outlines = chunk_outlines or []
        
        # 保存原始响应用于调试
        self._save_debug_response(response, chunk_index, "original_response")
        
        try:
            # 尝试解析JSON
            parsed_response = self.llm_client.parse_json_response(response)
            
            # 如果是字典，解包内部列表（例如 transcription / timeline / clips / items / data）
            if isinstance(parsed_response, dict):
                for k in ["timeline", "transcription", "clips", "segments", "topics", "items", "data", "results"]:
                    if k in parsed_response and isinstance(parsed_response[k], list):
                        parsed_response = parsed_response[k]
                        break
                else:
                    # 查找字典值中的首个非空字典列表
                    for v in parsed_response.values():
                        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                            parsed_response = v
                            break
            
            # 如果解析结果为单个对象，包装为列表
            if isinstance(parsed_response, dict):
                parsed_response = [parsed_response]
            elif not isinstance(parsed_response, list):
                logger.warning(f"  > 块 {chunk_index} LLM返回的不是列表或对象: {type(parsed_response)}")
                self._save_debug_response(f"类型: {type(parsed_response)}, 内容: {parsed_response}", chunk_index, "not_list")
                return []
            
            chunk_start_sec = self.text_processor.time_to_seconds(chunk_start)
            chunk_end_sec = self.text_processor.time_to_seconds(chunk_end)
            
            for idx, item in enumerate(parsed_response):
                if not isinstance(item, dict):
                    continue
                
                # 键名归一化
                start_raw = item.get('start_time') or item.get('start') or item.get('begin') or item.get('begin_time')
                end_raw = item.get('end_time') or item.get('end') or item.get('stop') or item.get('stop_time')
                outline_raw = item.get('outline') or item.get('title') or item.get('topic') or item.get('name')
                content_raw = item.get('content') or item.get('text') or item.get('subtopics') or ""
                
                if not start_raw or not end_raw:
                    continue
                
                # 如果缺少 outline，则从本块的大纲列表中按顺序对齐
                if not outline_raw:
                    outline_idx = min(idx, len(chunk_outlines) - 1) if chunk_outlines else -1
                    if outline_idx >= 0:
                        outline_raw = chunk_outlines[outline_idx].get('title', f"话题_{idx+1}")
                    else:
                        outline_raw = f"话题_{idx+1}"
                elif isinstance(outline_raw, dict):
                    outline_raw = outline_raw.get('title', f"话题_{idx+1}")
                outline_raw = str(outline_raw).strip()
                
                # 转换并校准时间
                try:
                    start_sec = self.text_processor.time_to_seconds(start_raw)
                    end_sec = self.text_processor.time_to_seconds(end_raw)
                except Exception as te:
                    logger.warning(f"  > 时间格式无法解析: {start_raw} - {end_raw} ({te})")
                    continue
                
                if end_sec <= start_sec:
                    logger.warning(f"  > 结束时间早于或等于开始时间: {start_raw} -> {end_raw}，自动延长时间")
                    end_sec = start_sec + 90.0
                
                # 限制在当前分块时间范围内
                start_sec = max(chunk_start_sec, start_sec)
                end_sec = min(chunk_end_sec, max(end_sec, start_sec + 30.0))
                
                timeline_item = {
                    'outline': outline_raw,
                    'start_time': self.text_processor.seconds_to_srt_time(start_sec),
                    'end_time': self.text_processor.seconds_to_srt_time(end_sec),
                    'content': content_raw if isinstance(content_raw, str) else json.dumps(content_raw, ensure_ascii=False),
                    'chunk_index': chunk_index
                }
                logger.info(f"  > 定位成功: {outline_raw} ({timeline_item['start_time']} -> {timeline_item['end_time']})")
                validated_items.append(timeline_item)
            
            return validated_items

        except Exception as e:
            logger.error(f"  > 块 {chunk_index} 解析LLM响应时出错: {e}")
            error_info = {
                "error": str(e),
                "error_type": type(e).__name__,
                "response_length": len(response),
                "response_preview": response[:200],
                "chunk_index": chunk_index,
                "chunk_start": chunk_start,
                "chunk_end": chunk_end
            }
            self._save_debug_response(json.dumps(error_info, indent=2, ensure_ascii=False), chunk_index, "parse_error")
            return []

    def _fallback_extract_timeline(self, chunk_outlines: List[Dict], srt_chunk_data: List[Dict], chunk_index: int) -> List[Dict]:
        """
        兜底方案：当LLM未返回有效时间线时，基于大纲数量按字幕自然切分，确保后续步骤不会因为0切片而失败。
        """
        logger.warning(f"  > 块 {chunk_index} 启用兜底时间线提取逻辑（字幕总数: {len(srt_chunk_data)}，大纲数: {len(chunk_outlines)}）")
        if not srt_chunk_data:
            return []
        
        n_outlines = len(chunk_outlines) if chunk_outlines else 1
        n_subs = len(srt_chunk_data)
        items_per_outline = max(1, n_subs // n_outlines)
        
        fallback_items = []
        for i in range(n_outlines):
            sub_start_idx = i * items_per_outline
            sub_end_idx = min((i + 1) * items_per_outline, n_subs) - 1
            if sub_start_idx > sub_end_idx:
                break
            
            sub_start = srt_chunk_data[sub_start_idx]
            sub_end = srt_chunk_data[sub_end_idx]
            
            title = chunk_outlines[i].get('title') if i < len(chunk_outlines) else f"片段 {i+1}"
            content_snippets = " ".join([s.get('text', '') for s in srt_chunk_data[sub_start_idx:min(sub_start_idx+10, sub_end_idx+1)]])
            
            item = {
                'id': str(len(fallback_items) + 1),
                'outline': title,
                'start_time': sub_start['start_time'],
                'end_time': sub_end['end_time'],
                'content': content_snippets,
                'chunk_index': chunk_index
            }
            fallback_items.append(item)
            logger.info(f"  > 兜底生成片段: {title} ({item['start_time']} -> {item['end_time']})")
            
        return fallback_items

    def _validate_time_format(self, time_str: str) -> bool:
        """
        验证时间格式是否正确 (HH:MM:SS,mmm)
        """
        pattern = r'^\d{2}:\d{2}:\d{2},\d{3}$'
        return bool(re.match(pattern, time_str))
    
    def _convert_time_format(self, time_str: str) -> str:
        """
        转换时间格式：SRT格式 -> FFmpeg格式
        """
        if not time_str or time_str == "end":
            return time_str
        return time_str.replace(',', '.')

    def _save_debug_response(self, response: str, chunk_index: int, error_type: str) -> None:
        """保存调试响应到文件"""
        try:
            debug_dir = self.metadata_dir / "debug_responses"
            debug_dir.mkdir(parents=True, exist_ok=True)
            debug_file = debug_dir / f"chunk_{chunk_index}_{error_type}.txt"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(response)
            logger.info(f"调试响应已保存到: {debug_file}")
        except Exception as e:
            logger.error(f"保存调试响应失败: {e}")

    def save_timeline(self, timeline_data: List[Dict], output_path: Optional[Path] = None) -> Path:
        """
        保存时间区间数据
        """
        if output_path is None:
            output_path = METADATA_DIR / "step2_timeline.json"
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(timeline_data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"时间数据已保存到: {output_path}")
        return output_path

    def load_timeline(self, input_path: Path) -> List[Dict]:
        """
        从文件加载时间数据
        """
        with open(input_path, 'r', encoding='utf-8') as f:
            return json.load(f)

def run_step2_timeline(outline_path: Path, metadata_dir: Path = None, output_path: Optional[Path] = None, prompt_files: Dict = None, language: str = "es") -> List[Dict]:
    """
    运行Step 2: 时间点提取
    """
    if metadata_dir is None:
        metadata_dir = METADATA_DIR
        
    extractor = TimelineExtractor(metadata_dir, prompt_files, language=language)
    
    # 加载大纲
    with open(outline_path, 'r', encoding='utf-8') as f:
        outlines = json.load(f)
        
    timeline_data = extractor.extract_timeline(outlines)
    
    # 保存结果
    if output_path is None:
        output_path = metadata_dir / "step2_timeline.json"
        
    extractor.save_timeline(timeline_data, output_path)
    
    return timeline_data