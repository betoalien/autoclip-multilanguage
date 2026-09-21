/**
 * 简化的进度状态管理 - 基于固定阶段和轮询
 */

import { create } from 'zustand'
import i18n from '../i18n'

export interface SimpleProgress {
  project_id: string
  stage: string
  percent: number
  message: string
  ts: number
}

interface SimpleProgressState {
  // 状态数据
  byId: Record<string, SimpleProgress>
  
  // 轮询控制
  pollingInterval: number | null
  isPolling: boolean
  
  // 操作方法
  upsert: (progress: SimpleProgress) => void
  startPolling: (projectIds: string[], intervalMs?: number) => void
  stopPolling: () => void
  clearProgress: (projectId: string) => void
  clearAllProgress: () => void
  
  // 获取方法
  getProgress: (projectId: string) => SimpleProgress | null
  getAllProgress: () => Record<string, SimpleProgress>
}

export const useSimpleProgressStore = create<SimpleProgressState>((set, get) => {
  let timer: number | null = null

  return {
    // 初始状态
    byId: {},
    pollingInterval: null,
    isPolling: false,

    // 更新或插入进度数据
    upsert: (progress: SimpleProgress) => {
      set((state) => ({
        byId: {
          ...state.byId,
          [progress.project_id]: progress
        }
      }))
    },

    // 开始轮询
    startPolling: (projectIds: string[], intervalMs: number = 5000) => {
      const { stopPolling, isPolling } = get()
      
      // 如果已经在轮询，先停止
      if (isPolling) {
        stopPolling()
      }

      if (projectIds.length === 0) {
        console.warn('没有项目ID，跳过轮询')
        return
      }

      console.log(`开始轮询进度: ${projectIds.join(', ')}`)

      // 立即获取一次
      const fetchSnapshots = async () => {
        try {
          const queryString = projectIds.map(id => `project_ids=${id}`).join('&')
          const response = await fetch(`/api/v1/simple-progress/snapshot?${queryString}`)
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const snapshots: SimpleProgress[] = await response.json()
          
          // 更新状态
          snapshots.forEach(snapshot => {
            console.log(`更新进度: ${snapshot.project_id} - ${snapshot.stage} (${snapshot.percent}%)`)
            get().upsert(snapshot)
          })
          
          console.log(`轮询更新: ${snapshots.length} 个项目`)
          
          // 如果没有任何进度，或所有项目均已到达终态，则自动停止轮询
          try {
            const allTerminal = snapshots.length > 0 && snapshots.every(s => {
              return isCompleted(s.stage) || isFailed(s.message)
            })
            // 只有当有进度且所有项目都已完成时才停止轮询
            // 如果snapshots.length === 0，说明项目可能还在pending状态，不应该停止轮询
            if (snapshots.length > 0 && allTerminal) {
              console.log('所有项目已完成，自动停止轮询')
              get().stopPolling()
            } else if (snapshots.length === 0) {
              console.log('项目可能还在pending状态，继续轮询等待')
            }
          } catch (e) {
            // 保护性捕获，避免影响后续轮询逻辑
            console.warn('检测终态时出现问题，但不影响继续运行:', e)
          }
          
        } catch (error) {
          console.error('轮询进度失败:', error)
        }
      }

      // 立即执行一次
      fetchSnapshots()

      // 设置定时器
      timer = window.setInterval(fetchSnapshots, intervalMs)

      set({
        isPolling: true,
        pollingInterval: intervalMs
      })
    },

    // 停止轮询
    stopPolling: () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      
      set({
        isPolling: false,
        pollingInterval: null
      })
      
      console.log('停止轮询进度')
    },

    // 清除单个项目进度
    clearProgress: (projectId: string) => {
      set((state) => {
        const newById = { ...state.byId }
        delete newById[projectId]
        return { byId: newById }
      })
    },

    // 清除所有进度
    clearAllProgress: () => {
      set({ byId: {} })
    },

    // 获取单个项目进度
    getProgress: (projectId: string) => {
      return get().byId[projectId] || null
    },

    // 获取所有进度
    getAllProgress: () => {
      return get().byId
    }
  }
})

// 阶段显示名称映射（通过 i18n 动态获取，按当前语言显示）
export const STAGE_DISPLAY_NAMES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, prop: string) => {
    const rawMap: Record<string, string> = {
      'INGEST': i18n.t('simpleProgress.stageIngest', 'Ingesta'),
      'SUBTITLE': i18n.t('simpleProgress.stageSubtitle', 'Subtítulos'),
      'ANALYZE': i18n.t('simpleProgress.stageAnalyze', 'Análisis'),
      'HIGHLIGHT': i18n.t('simpleProgress.stageHighlight', 'Detección de momentos'),
      'EXPORT': i18n.t('simpleProgress.stageExport', 'Exportación'),
      'DONE': i18n.t('simpleProgress.stageDone', 'Completado')
    }
    return rawMap[prop] || prop
  }
})


// 阶段颜色映射
export const STAGE_COLORS: Record<string, string> = {
  'INGEST': '#1890ff',      // 蓝色
  'SUBTITLE': '#52c41a',    // 绿色
  'ANALYZE': '#fa8c16',     // 橙色
  'HIGHLIGHT': '#722ed1',   // 紫色
  'EXPORT': '#eb2f96',      // 粉色
  'DONE': '#13c2c2'         // 青色
}

// 获取阶段显示名称
export const getStageDisplayName = (stage: string): string => {
  return STAGE_DISPLAY_NAMES[stage] || stage
}

// 获取阶段颜色
export const getStageColor = (stage: string): string => {
  return STAGE_COLORS[stage] || '#666666'
}

// 判断是否为完成状态
export const isCompleted = (stage: string): boolean => {
  return stage === 'DONE'
}

// 判断是否为失败状态
export const isFailed = (message?: string): boolean => {
  if (!message) return false
  return /失败|错误|fail|error|falló|rechazad/i.test(message)
}

// 进度消息本地化转换
export const getLocalizedProgressMessage = (msg?: string): string => {
  if (!msg) return ''
  const currentLang = (i18n.language || 'es').toLowerCase()
  if (currentLang.startsWith('es')) {
    const msgMap: Record<string, string> = {
      '正在获取视频信息': 'Obteniendo información del video...',
      '准备下载视频': 'Preparando descarga del video...',
      '正在下载视频': 'Descargando video',
      '视频下载完成，正在处理字幕': 'Descarga completada, procesando subtítulos...',
      '正在使用Whisper生成字幕': 'Generando subtítulos con Whisper...',
      '字幕生成完成，正在准备处理': 'Subtítulos generados, preparando procesamiento...',
      '下载完成，准备开始处理': 'Descarga completada, iniciando procesamiento...',
      '下载失败：字幕文件不存在': 'Descarga fallida: Subtítulos no encontrados',
      '下载失败': 'Error al descargar',
      '素材准备': 'Preparación de material',
      '开始字幕处理': 'Iniciando procesamiento de subtítulos',
      '字幕处理完成': 'Subtítulos procesados con éxito',
      '开始内容分析': 'Iniciando análisis de contenido',
      '时间线提取完成': 'Línea de tiempo extraída',
      '内容分析完成': 'Análisis de contenido completado',
      '开始片段定位': 'Iniciando selección de fragmentos',
      '标题生成完成': 'Títulos generados',
      '片段定位完成': 'Momentos destacados localizados',
      '开始视频导出': 'Iniciando exportación de video',
      '导出切片视频': 'Exportando clips de video',
      '视频导出完成': 'Video exportado con éxito',
      '处理完成': 'Procesamiento completado',
      '处理失败': 'Error en el procesamiento',
      '下载完成': 'Descarga completada',
      '开始下载': 'Iniciando descarga',
      '初始化': 'Inicialización',
      '自动视频处理流水线': 'Procesamiento automático de video',
      '流水线处理已启动': 'Procesamiento iniciado'
    }
    for (const [zhKey, esVal] of Object.entries(msgMap)) {
      if (msg.includes(zhKey)) {
        return msg.replace(zhKey, esVal)
      }
    }
  } else if (currentLang.startsWith('en')) {
    const msgMapEn: Record<string, string> = {
      '正在获取视频信息': 'Fetching video info...',
      '准备下载视频': 'Preparing video download...',
      '正在下载视频': 'Downloading video',
      '视频下载完成，正在处理字幕': 'Video download complete, processing subtitles...',
      '正在使用Whisper生成字幕': 'Generating subtitles with Whisper...',
      '字幕生成完成，正在准备处理': 'Subtitles generated, preparing processing...',
      '下载完成，准备开始处理': 'Download complete, starting processing...',
      '下载失败：字幕文件不存在': 'Download failed: Subtitles not found',
      '下载失败': 'Download failed',
      '素材准备': 'Preparing material',
      '开始字幕处理': 'Starting subtitle processing',
      '字幕处理完成': 'Subtitles processed',
      '开始内容分析': 'Starting content analysis',
      '时间线提取完成': 'Timeline extracted',
      '内容分析完成': 'Content analysis complete',
      '开始片段定位': 'Locating clips',
      '标题生成完成': 'Titles generated',
      '片段定位完成': 'Highlights located',
      '开始视频导出': 'Starting video export',
      '导出切片视频': 'Exporting video clips',
      '视频导出完成': 'Video export complete',
      '处理完成': 'Processing complete',
      '处理失败': 'Processing failed',
      '下载完成': 'Download complete',
      '开始下载': 'Starting download',
      '初始化': 'Initializing',
      '自动视频处理流水线': 'Auto Video Pipeline',
      '流水线处理已启动': 'Pipeline started'
    }
    for (const [zhKey, enVal] of Object.entries(msgMapEn)) {
      if (msg.includes(zhKey)) {
        return msg.replace(zhKey, enVal)
      }
    }
  }
  return msg
}

