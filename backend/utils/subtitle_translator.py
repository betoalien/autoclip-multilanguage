"""
Subtitle translation utilities
Translates SRT subtitle files to Spanish (or another target language)
while preserving exact timestamps and indices.
"""

import logging
import re
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

SPANISH_STOPWORDS = {
    "de", "la", "que", "el", "en", "y", "a", "los", "se", "del", "las", "por", "un", "para", "con",
    "no", "una", "su", "al", "lo", "como", "más", "pero", "sus", "le", "ya", "o", "este", "sí",
    "porque", "esta", "entre", "cuando", "muy", "sin", "sobre", "también", "me", "hasta", "hay",
    "donde", "quien", "desde", "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra",
    "otros", "ese", "eso", "ante", "ellos", "esto", "mí", "antes", "algunos", "qué", "unos", "yo",
    "otro", "otras", "otra", "él", "tanto", "esa", "estos", "mucho", "quienes", "nada", "muchos",
    "cual", "sea", "poco", "ella", "estar", "haber", "estas", "estaba", "estamos", "algunas", "algo",
    "nosotros", "mi", "mis", "tú", "te", "ti", "tu", "tus", "fue", "había", "son", "era", "bien"
}


def is_spanish_text(sample_text: str) -> bool:
    """
    Check if a text sample appears to be in Spanish based on stop words.
    """
    if not sample_text:
        return False
    words = re.findall(r'[a-záéíóúñü]+', sample_text.lower())
    if not words:
        return False
    spanish_hits = sum(1 for w in words if w in SPANISH_STOPWORDS)
    ratio = spanish_hits / max(1, len(words))
    # If more than 12% of words are Spanish stopwords, it's Spanish
    return ratio >= 0.12 or (spanish_hits >= 5 and ratio >= 0.08)


def parse_srt_string(content: str) -> List[Dict[str, str]]:
    """Parse SRT content into structured entries."""
    blocks = re.split(r'\n\s*\n', content.strip())
    entries = []
    for b in blocks:
        lines = [l.strip() for l in b.strip().splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        idx_str = lines[0]
        time_line = lines[1]
        text_lines = lines[2:]
        if '-->' not in time_line:
            # Maybe index wasn't separate
            if '-->' in idx_str:
                time_line = idx_str
                idx_str = str(len(entries) + 1)
                text_lines = lines[1:]
            else:
                continue
        parts = time_line.split('-->')
        if len(parts) != 2:
            continue
        start_t = parts[0].strip()
        end_t = parts[1].strip()
        text = " ".join(text_lines).strip()
        entries.append({
            "index": idx_str,
            "start_time": start_t,
            "end_time": end_t,
            "text": text
        })
    return entries


def format_srt_string(entries: List[Dict[str, str]]) -> str:
    """Format structured entries back to standard SRT string."""
    blocks = []
    for i, e in enumerate(entries, 1):
        idx = e.get("index") or str(i)
        start_t = e.get("start_time", "00:00:00,000")
        end_t = e.get("end_time", "00:00:01,000")
        text = e.get("text", "").strip()
        blocks.append(f"{idx}\n{start_t} --> {end_t}\n{text}")
    return "\n\n".join(blocks) + "\n"


def _translate_batch_google(texts: List[str], target_lang: str = "es") -> Optional[List[str]]:
    """Translate a batch of texts using Google free translate endpoint."""
    if not texts:
        return []
    import requests
    sep = " /// "
    joined = sep.join(texts)
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": target_lang,
            "dt": "t",
            "q": joined
        }
        res = requests.get(url, params=params, timeout=12)
        if res.status_code == 200:
            data = res.json()
            full_trans = "".join([p[0] for p in data[0] if p and p[0]])
            # Split back by separator
            split_parts = [p.strip() for p in re.split(r'\s*///\s*', full_trans)]
            if len(split_parts) == len(texts):
                return split_parts
            # If separator split didn't match count exactly, try fallback
            logger.warning(f"Batch delimiter split mismatch: got {len(split_parts)}, expected {len(texts)}")
    except Exception as e:
        logger.warning(f"Google batch translation failed: {e}")
    return None


def _translate_batch_ollama(texts: List[str], target_lang: str = "es") -> Optional[List[str]]:
    """Translate batch using local Ollama model if available."""
    try:
        import requests
        lang_name = "Spanish" if target_lang.startswith("es") else "English"
        sep = " [SEP] "
        joined = sep.join(texts)
        prompt = (
            f"You are a professional subtitle translator. Translate the following text into natural {lang_name}.\n"
            f"Keep the exact '[SEP]' separator between the segments. Return ONLY the translated segments separated by '[SEP]'. No markdown, no explanations.\n\n"
            f"{joined}"
        )
        res = requests.post("http://localhost:11434/api/generate", json={
            "model": "gemma4:latest",
            "prompt": prompt,
            "stream": False
        }, timeout=25)
        if res.status_code == 200:
            out = res.json().get("response", "").strip()
            parts = [p.strip() for p in out.split("[SEP]")]
            if len(parts) == len(texts):
                return parts
    except Exception as e:
        logger.debug(f"Ollama translation fallback unavailable: {e}")
    return None


def _translate_individual_fallback(texts: List[str], target_lang: str = "es") -> List[str]:
    """Fallback translator using deep_translator or individual requests."""
    translated = []
    try:
        from deep_translator import MyMemoryTranslator
        translator = MyMemoryTranslator(source='auto', target='es-ES' if target_lang == 'es' else target_lang)
        for t in texts:
            if not t.strip():
                translated.append("")
                continue
            try:
                res = translator.translate(t)
                translated.append(res or t)
            except Exception:
                translated.append(t)
    except Exception:
        translated = texts
    return translated


def translate_srt_entries(entries: List[Dict[str, str]], target_lang: str = "es", batch_size: int = 25) -> List[Dict[str, str]]:
    """
    Translate the text in all SRT entries to target_lang while preserving timings.
    """
    if not entries:
        return []
    
    total = len(entries)
    logger.info(f"开始翻译字幕，共 {total} 条字幕行，目标语言: {target_lang}")
    
    translated_entries = []
    for i in range(0, total, batch_size):
        chunk = entries[i:i + batch_size]
        texts = [e["text"] for e in chunk]
        
        # Try batch translation first
        batch_res = _translate_batch_google(texts, target_lang=target_lang)
        if batch_res is None or len(batch_res) != len(texts):
            batch_res = _translate_batch_ollama(texts, target_lang=target_lang)
        if batch_res is None or len(batch_res) != len(texts):
            # Fallback to individual
            batch_res = _translate_individual_fallback(texts, target_lang=target_lang)
            
        for orig_entry, trans_text in zip(chunk, batch_res):
            new_entry = dict(orig_entry)
            new_entry["text"] = trans_text if trans_text else orig_entry["text"]
            translated_entries.append(new_entry)
            
        # Tiny delay to avoid aggressive rate limiting
        time.sleep(0.05)
        
    logger.info(f"字幕翻译完成: {len(translated_entries)} 条字幕")
    return translated_entries


def ensure_target_language_srt(srt_path: Path, target_lang: str = "es") -> Path:
    """
    Checks if the SRT file is already in the target language.
    If not, translates it and saves as a sibling file (e.g. `input_es.srt`),
    returning the translated file path.
    """
    if not srt_path or not srt_path.exists():
        return srt_path
        
    if target_lang != "es":
        # Only Spanish auto-translation is required for now
        return srt_path

    try:
        content = srt_path.read_text(encoding="utf-8", errors="ignore")
        entries = parse_srt_string(content)
        if not entries:
            return srt_path

        # Sample first 20 entries
        sample_texts = " ".join([e["text"] for e in entries[:25]])
        if is_spanish_text(sample_texts):
            logger.info(f"字幕文件 {srt_path.name} 已为西班牙语，跳过翻译")
            return srt_path

        logger.info(f"字幕文件 {srt_path.name} 检测为非西班牙语，启动自动翻译到西班牙语...")
        translated_entries = translate_srt_entries(entries, target_lang="es")
        
        out_srt = srt_path.with_name(f"{srt_path.stem}_es.srt")
        out_content = format_srt_string(translated_entries)
        out_srt.write_text(out_content, encoding="utf-8")
        logger.info(f"西班牙语字幕已生成并保存到: {out_srt}")
        return out_srt

    except Exception as e:
        logger.error(f"确保西班牙语字幕过程中发生异常: {e}")
        return srt_path
