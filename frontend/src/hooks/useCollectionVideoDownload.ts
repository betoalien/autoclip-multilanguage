import { useState } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import { projectApi } from '../services/api'

export const useCollectionVideoDownload = () => {
  const { t } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)

  const generateAndDownloadCollectionVideo = async (
    projectId: string, 
    collectionId: string,
    _collectionTitle: string
  ) => {
    if (isGenerating) return

    setIsGenerating(true)
    
    try {
      // 直接按用户当前调整的顺序生成合集视频
      message.info(t('collectionDownload.generating'))

      // 生成合集视频（按用户调整的顺序）
      await projectApi.generateCollectionVideo(projectId, collectionId)

      // 等待1秒让后端完成文件生成，然后下载
      message.success(t('collectionDownload.generateSuccess'))

      setTimeout(async () => {
        try {
          await projectApi.downloadVideo(projectId, undefined, collectionId)
          message.success(t('collectionDownload.downloadComplete'))
        } catch (downloadError) {
          console.error('下载失败:', downloadError)
          message.error(t('collectionDownload.downloadFailed'))
        }
      }, 1000)

    } catch (error) {
      console.error('生成合集视频失败:', error)
      message.error(t('collectionDownload.generateFailed'))
    } finally {
      setIsGenerating(false)
    }
  }

  return {
    isGenerating,
    generateAndDownloadCollectionVideo
  }
} 