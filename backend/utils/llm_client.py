"""
大模型客户端 - 兼容性包装器，使用新的LLM管理器
"""
import json
import logging
import os
import re
from typing import Dict, Any, List
from collections.abc import Generator

# 修复导入问题
try:
    from ..core.shared_config import MODEL_NAME
except ImportError:
    # 如果相对导入失败，尝试绝对导入
    import sys
    from pathlib import Path
    backend_path = Path(__file__).parent.parent
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))
    from core.shared_config import MODEL_NAME

# 导入新的LLM管理器
try:
    from ..core.llm_manager import get_llm_manager
except ImportError:
    # 如果相对导入失败，尝试绝对导入
    import sys
    from pathlib import Path
    backend_path = Path(__file__).parent.parent
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))
    from core.llm_manager import get_llm_manager

logger = logging.getLogger(__name__)

class LLMClient:
    """LLM客户端 - 兼容性包装器"""
    
    def __init__(self):
        self.model = MODEL_NAME
        self.llm_manager = get_llm_manager()
    
    def call(self, prompt: str, input_data: Any = None) -> str:
        """
        调用大模型API - 使用新的LLM管理器
        
        Args:
            prompt: 提示词
            input_data: 输入数据
            
        Returns:
            模型响应文本
        """
        try:
            return self.llm_manager.call(prompt, input_data)
        except Exception as e:
            logger.error(f"LLM调用失败: {str(e)}")
            raise
    
    def call_with_retry(self, prompt: str, input_data: Any = None, max_retries: int = 3) -> str:
        """
        带重试机制的API调用
        
        Args:
            prompt: 提示词
            input_data: 输入数据
            max_retries: 最大重试次数
            
        Returns:
            模型响应文本
        """
        try:
            return self.llm_manager.call_with_retry(prompt, input_data, max_retries)
        except Exception as e:
            logger.error(f"LLM重试调用失败: {str(e)}")
            raise
    
    def _preprocess_llm_response(self, response: str) -> str:
        """
        预处理LLM响应，移除常见的非JSON内容
        """
        response = response.lstrip('\ufeff').strip()
        # 如果包含 markdown 代码块，保留原样以便正则提取
        if '```' in response:
            return response
        
        # 寻找首个 JSON 开头符号
        lines = response.split('\n')
        json_start = -1
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('[') or stripped.startswith('{'):
                json_start = i
                break
        
        if json_start >= 0:
            response = '\n'.join(lines[json_start:])
        
        return response.strip()
    
    def _auto_fix_response(self, response: str) -> str:
        """
        自动修复常见的响应问题
        """
        # 移除BOM和特殊字符
        response = response.lstrip('\ufeff')
        response = response.strip()
        
        # 修复中文引号
        response = response.replace('“', '\"').replace('”', '\"')
        
        return response
    
    def _validate_json_structure(self, parsed_data: Any) -> bool:
        """
        验证JSON结构的有效性
        """
        try:
            if isinstance(parsed_data, (list, dict)):
                return True
            logger.error(f"响应不是数组或对象格式，实际类型: {type(parsed_data)}")
            return False
        except Exception as e:
            logger.error(f"验证JSON结构时出错: {e}")
            return False
    
    def parse_json_response(self, response: str) -> Any:
        """
        从可能包含Markdown格式的文本中解析JSON对象。
        具备多层容错机制：
        1. Markdown代码块优先提取
        2. 直接整体解析
        3. 正则精准识别合法JSON边界
        4. 栈式括号闭合与常见语法自动修复
        """
        
        def sanitize_string(s: str) -> str:
            """增强的净化函数，移除可能导致JSON解析失败的控制字符"""
            s = s.lstrip('\ufeff').strip()
            s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
            return s
        
        def balance_json_brackets(s: str) -> str:
            """使用栈结构补全未闭合的括号与引号"""
            in_string = False
            escape = False
            stack = []
            for ch in s:
                if ch == '\\' and not escape:
                    escape = True
                    continue
                if ch == '"' and not escape:
                    in_string = not in_string
                elif not in_string:
                    if ch in '{[':
                        stack.append(ch)
                    elif ch == '}' and stack and stack[-1] == '{':
                        stack.pop()
                    elif ch == ']' and stack and stack[-1] == '[':
                        stack.pop()
                escape = False
            
            if in_string:
                s += '"'
            s = s.strip().rstrip(',')
            for ch in reversed(stack):
                s += '}' if ch == '{' else ']'
            return s
        
        def fix_common_json_errors(json_str: str) -> str:
            """修复常见的JSON格式错误"""
            # 1. 修复缺少逗号的问题
            json_str = re.sub(r'}\s*{', '},{', json_str)
            json_str = re.sub(r']\s*\[', '],[', json_str)
            json_str = re.sub(r'}\s*\n\s*{', '},\n{', json_str)
            
            # 2. 修复多余的逗号
            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)
            
            # 3. 修复单引号为双引号
            json_str = re.sub(r"'([^']*?)'\s*:", r'"\1":', json_str)
            json_str = re.sub(r":\s*'([^']*?)'", r': "\1"', json_str)
            
            # 4. 修复中文引号
            json_str = json_str.replace('“', '\"').replace('”', '\"')
            
            # 5. 确保括号正确闭合
            json_str = balance_json_brackets(json_str)
            return json_str

        raw_cleaned = sanitize_string(response)
        if not raw_cleaned:
            return []
        
        # 1. 优先尝试从Markdown代码块中提取
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_cleaned, re.DOTALL)
        if match:
            json_str = sanitize_string(match.group(1))
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                try:
                    return json.loads(fix_common_json_errors(json_str))
                except json.JSONDecodeError:
                    logger.debug("从Markdown提取的内容直接与修复后解析均失败，继续尝试其他策略")
        
        # 2. 直接解析整个响应
        try:
            return json.loads(raw_cleaned)
        except json.JSONDecodeError:
            pass
        
        # 3. 精准正则：跳过前缀文本，寻找符合规范的 JSON 起始（[{ 或 {" 等）
        json_start_match = re.search(r'(\[\s*(?:\{|"|\[|-?\d|true|false|null|\])|\{\s*"[\w_]+"\s*:)', raw_cleaned)
        if json_start_match:
            candidate = raw_cleaned[json_start_match.start():]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                try:
                    return json.loads(balance_json_brackets(candidate))
                except json.JSONDecodeError:
                    try:
                        return json.loads(fix_common_json_errors(candidate))
                    except json.JSONDecodeError:
                        pass
        
        # 4. 通用正则寻找最外层大括号或方括号
        json_match = re.search(r'\[[\s\S]*\]|\{[\s\S]*\}', raw_cleaned, re.DOTALL)
        if json_match:
            candidate = sanitize_string(json_match.group())
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                try:
                    return json.loads(fix_common_json_errors(candidate))
                except json.JSONDecodeError:
                    pass
        
        # 5. 终极尝试：修复整段内容后解析
        try:
            return json.loads(fix_common_json_errors(raw_cleaned))
        except json.JSONDecodeError as final_e:
            logger.error(f"最终尝试解析JSON失败: {final_e}")
            raise ValueError(f"无法从响应中解析出有效的JSON: {raw_cleaned[:200]}...") from final_e
    
    def get_current_provider_info(self) -> Dict[str, Any]:
        """获取当前提供商信息"""
        return self.llm_manager.get_current_provider_info()