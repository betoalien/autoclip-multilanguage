import React, { useState, useEffect } from 'react'
import { Card, Button, Space, Typography, Popconfirm, message, Tooltip } from 'antd'
import { PlayCircleOutlined, DeleteOutlined, DownloadOutlined, ReloadOutlined, LoadingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Project } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import { UnifiedStatusBar } from './UnifiedStatusBar'
import FeedbackDialog from './FeedbackDialog'
import { useSimpleProgressStore } from '../stores/useSimpleProgressStore'
import { Btn } from '../ui'
import dayjs from 'dayjs'


const pulseAnimation = `
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`

if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = pulseAnimation
  document.head.appendChild(style)
}

const { Text } = Typography

const autoStartedProjectIds = new Set<string>()

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  onRetry?: (id: string) => void
  onClick?: () => void
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete, onRetry, onClick }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const getCategoryInfo = (category?: string) => {
    const categoryMap: Record<string, { name: string; icon: string; color: string }> = {
      'default': { name: t('projectCard.categoryDefault'), icon: '🎬', color: '#4facfe' },
      '默认': { name: t('projectCard.categoryDefault'), icon: '🎬', color: '#4facfe' },
      'knowledge': { name: t('projectCard.categoryKnowledge'), icon: '📚', color: '#52c41a' },
      '知识科普': { name: t('projectCard.categoryKnowledge'), icon: '📚', color: '#52c41a' },
      'business': { name: t('projectCard.categoryBusiness'), icon: '💼', color: '#faad14' },
      '商业财经': { name: t('projectCard.categoryBusiness'), icon: '💼', color: '#faad14' },
      '商业': { name: t('projectCard.categoryBusiness'), icon: '💼', color: '#faad14' },
      'opinion': { name: t('projectCard.categoryOpinion'), icon: '💭', color: '#722ed1' },
      '观点评论': { name: t('projectCard.categoryOpinion'), icon: '💭', color: '#722ed1' },
      '观点': { name: t('projectCard.categoryOpinion'), icon: '💭', color: '#722ed1' },
      'experience': { name: t('projectCard.categoryExperience'), icon: '🌟', color: '#13c2c2' },
      '生活经验': { name: t('projectCard.categoryExperience'), icon: '🌟', color: '#13c2c2' },
      '经验分享': { name: t('projectCard.categoryExperience'), icon: '🌟', color: '#13c2c2' },
      'speech': { name: t('projectCard.categorySpeech'), icon: '🎤', color: '#eb2f96' },
      '演讲脱口秀': { name: t('projectCard.categorySpeech'), icon: '🎤', color: '#eb2f96' },
      '演讲': { name: t('projectCard.categorySpeech'), icon: '🎤', color: '#eb2f96' },
      'content_review': { name: t('projectCard.categoryContentReview'), icon: '🎭', color: '#f5222d' },
      '内容解说': { name: t('projectCard.categoryContentReview'), icon: '🎭', color: '#f5222d' },
      '解说': { name: t('projectCard.categoryContentReview'), icon: '🎭', color: '#f5222d' },
      'entertainment': { name: t('projectCard.categoryEntertainment'), icon: '🎪', color: '#fa8c16' },
      '娱乐休闲': { name: t('projectCard.categoryEntertainment'), icon: '🎪', color: '#fa8c16' },
      '娱乐': { name: t('projectCard.categoryEntertainment'), icon: '🎪', color: '#fa8c16' }
    }
    return categoryMap[category || 'default'] || categoryMap['default']
  }

  const thumbnailCacheKey = `thumbnail_${project.id}`

  useEffect(() => {
    const generateThumbnail = async () => {
      if (thumbnailLoading) return;

      if (project.thumbnail) {
        setVideoThumbnail(project.thumbnail)
        return
      }

      if (!project.video_path) return;

      const cachedThumbnail = localStorage.getItem(thumbnailCacheKey)
      if (cachedThumbnail) {
        setVideoThumbnail(cachedThumbnail)
        return
      }

      setThumbnailLoading(true)

      try {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.preload = 'metadata'

        const possiblePaths = [
          'input/input.mp4',
          'input.mp4',
          project.video_path,
          `${project.video_path}/input.mp4`
        ].filter(Boolean)

        let videoLoaded = false

        for (const path of possiblePaths) {
          if (videoLoaded) break

          try {
            const videoUrl = projectApi.getProjectFileUrl(project.id, path)

            await new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error(t('projectCard.videoLoadTimeout')))
              }, 10000)

              video.onloadedmetadata = () => {
                clearTimeout(timeoutId)
                video.currentTime = Math.min(5, video.duration / 4)
              }

              video.onseeked = () => {
                clearTimeout(timeoutId)
                try {
                  const canvas = document.createElement('canvas')
                  const ctx = canvas.getContext('2d')
                  if (!ctx) {
                    reject(new Error(t('projectCard.canvasContextError')))
                    return
                  }

                  const maxWidth = 320
                  const maxHeight = 180
                  const aspectRatio = video.videoWidth / video.videoHeight

                  let width = maxWidth
                  let height = maxHeight
                  if (aspectRatio > maxWidth / maxHeight) {
                    height = maxWidth / aspectRatio
                  } else {
                    width = maxHeight * aspectRatio
                  }

                  canvas.width = width
                  canvas.height = height
                  ctx.drawImage(video, 0, 0, width, height)
                  const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
                  setVideoThumbnail(thumbnail)

                  try {
                    localStorage.setItem(thumbnailCacheKey, thumbnail)
                  } catch (e) {
                    const keys = Object.keys(localStorage).filter(key => key.startsWith('thumbnail_'))
                    if (keys.length > 50) {
                      keys.slice(0, 10).forEach(key => localStorage.removeItem(key))
                      localStorage.setItem(thumbnailCacheKey, thumbnail)
                    }
                  }
                  videoLoaded = true
                  resolve(thumbnail)
                } catch (error) {
                  reject(error)
                }
              }

              video.onerror = (error) => {
                clearTimeout(timeoutId)
                reject(error)
              }

              video.src = videoUrl
            })
            break
          } catch (error) {
            continue
          }
        }
      } catch (error) {
        console.warn('Thumbnail generation failed:', error)
      } finally {
        setThumbnailLoading(false)
      }
    }

    generateThumbnail()
  }, [project.id, project.video_path, project.thumbnail, thumbnailCacheKey])

  const config = project.processing_config || project.settings || {}
  const downloadStatus = config.download_status
  const downloadProgress = typeof config.download_progress === 'number' ? config.download_progress : 0
  const hasSourceUrl = Boolean(project.source_url)
  const hasVideoFile = Boolean(project.video_path)

  const isDownloading = project.status === 'pending' && (
    downloadStatus === 'downloading' ||
    (hasSourceUrl && !hasVideoFile) ||
    (downloadProgress > 0 && downloadProgress < 100)
  )

  const isImporting = project.status === 'pending' && !isDownloading

  const normalizedStatus = project.status === 'error' ? 'failed' :
                          isDownloading ? 'downloading' :
                          isImporting ? 'importing' : project.status

  useEffect(() => {
    if (
      project.status === 'pending' &&
      !isDownloading &&
      hasVideoFile &&
      !autoStartedProjectIds.has(project.id)
    ) {
      autoStartedProjectIds.add(project.id)
      handleRetry({ silent: true })
    }
  }, [project.status, project.id, isDownloading, hasVideoFile])

  const progressPercent = project.status === 'completed' ? 100 :
                         project.status === 'failed' ? 0 :
                         isDownloading ? (downloadProgress > 0 ? downloadProgress : 10) :
                         isImporting ? 5 :
                         project.current_step && project.total_steps ?
                         Math.round((project.current_step / project.total_steps) * 100) :
                         project.status === 'processing' ? 10 : 0

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const failedProgress = useSimpleProgressStore((st) => st.getProgress(project.id))
  const failureContext = {
    source: 'failure' as const,
    project_id: project.id,
    stage: failedProgress?.stage,
    error_message: project.error_message || failedProgress?.message || undefined,
  }

  const handleRetry = async (opts?: { silent?: boolean }) => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      if (project.status === 'pending') {
        await projectApi.startProcessing(project.id)
      } else {
        await projectApi.retryProcessing(project.id)
      }
      if (onRetry && !opts?.silent) {
        onRetry(project.id)
      }
    } catch (error) {
      console.error(t('projectCard.consoleRetryFailed'), error)
      if (!opts?.silent) {
        message.error(t('projectCard.retryFailed'))
      }
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <>
    <Card
      hoverable
      className="project-card"
      style={{
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'var(--ac-card)',
        border: '1px solid var(--ac-line)',
        boxShadow: 'none',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        marginBottom: '0px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--ac-shadow)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
      bodyStyle={{
        padding: '18px 20px 20px',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column'
      }}
      cover={
        <div
          style={{
            height: 160,
            position: 'relative',
            background: videoThumbnail
              ? `url(${videoThumbnail}) center/cover`
              : 'var(--ac-thumb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
          onClick={() => {
            if (project.status === 'pending') {
              message.warning(t('projectCard.importingCannotView'))
              return
            }
            if (project.status === 'processing') {
              message.warning(t('projectCard.processingCannotView'))
              return
            }
            if (onClick) {
              onClick()
            } else {
              navigate(`/project/${project.id}`)
            }
          }}
        >
          {thumbnailLoading && (
            <div style={{ textAlign: 'center', color: 'var(--ac-muted)' }}>
              <LoadingOutlined style={{ fontSize: '22px', marginBottom: '4px' }} />
              <div style={{ fontSize: '12px' }}>{t('projectCard.generatingThumbnail')}</div>
            </div>
          )}
          {!videoThumbnail && !thumbnailLoading && (
            <PlayCircleOutlined style={{ fontSize: '32px', color: 'var(--ac-muted)' }} />
          )}
          {project.video_category && project.video_category !== 'default' && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px'
            }}>
              <span className="ac-tag ac-tag--sans" style={{ position: 'static', fontSize: 11 }}>
                {getCategoryInfo(project.video_category).name}
              </span>
            </div>
          )}
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            background: 'linear-gradient(to top, rgba(0,0,0,0.42), rgba(0,0,0,0))',
            borderRadius: '0',
            padding: '10px 12px',
            height: '52px'
          }}>
            <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.92)' }}>
              {dayjs(project.created_at).fromNow()}
            </Text>
            <div
              className="card-action-buttons"
              style={{
                display: 'flex',
                gap: '4px',
                opacity: 0,
                transition: 'opacity 0.3s ease'
              }}
            >
              {normalizedStatus === 'failed' ? (
                <>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    loading={isRetrying}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRetry()
                    }}
                    style={{
                      height: '22px',
                      width: '22px',
                      borderRadius: '999px',
                      color: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(20,20,19,0.45)',
                      padding: 0,
                      minWidth: '22px',
                      fontSize: '10px'
                    }}
                  />
                  <Popconfirm
                    title={t('projectCard.confirmDeleteTitle')}
                    description={t('projectCard.confirmDeleteDescription')}
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      onDelete(project.id)
                    }}
                    onCancel={(e) => {
                      e?.stopPropagation()
                    }}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      style={{
                      height: '22px',
                      width: '22px',
                      borderRadius: '999px',
                      color: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(20,20,19,0.45)',
                      padding: 0,
                      minWidth: '22px',
                      fontSize: '10px'
                    }}
                    />
                  </Popconfirm>
                </>
              ) : (
                <>
                  <Space size={4}>
                    {(normalizedStatus === 'processing' || normalizedStatus === 'importing' || project.status === 'pending') && (
                      <Tooltip title={project.status === 'pending' ? t('projectCard.startProcessing') : t('projectCard.resubmitTask')}>
                        <Button
                          type="text"
                          icon={<ReloadOutlined />}
                          loading={isRetrying}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRetry()
                          }}
                          style={{
                      height: '22px',
                      width: '22px',
                      borderRadius: '999px',
                      color: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(20,20,19,0.45)',
                      padding: 0,
                      minWidth: '22px',
                      fontSize: '10px'
                    }}
                        />
                      </Tooltip>
                    )}
                    {normalizedStatus === 'completed' && (
                      <Button
                        type="text"
                        icon={<DownloadOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          message.info(t('projectCard.downloadInDevelopment'))
                        }}
                        style={{
                      height: '22px',
                      width: '22px',
                      borderRadius: '999px',
                      color: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(20,20,19,0.45)',
                      padding: 0,
                      minWidth: '22px',
                      fontSize: '10px'
                    }}
                      />
                    )}
                    <Popconfirm
                      title={t('projectCard.confirmDeleteTitle')}
                      description={t('projectCard.confirmDeleteDescription')}
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        onDelete(project.id)
                      }}
                      onCancel={(e) => {
                        e?.stopPropagation()
                      }}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                    >
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        style={{
                      height: '22px',
                      width: '22px',
                      borderRadius: '999px',
                      color: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(20,20,19,0.45)',
                      padding: 0,
                      minWidth: '22px',
                      fontSize: '10px'
                    }}
                      />
                    </Popconfirm>
                  </Space>
                 </>
               )}
            </div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <Tooltip title={project.name} placement="top">
              <Text
                strong
                style={{
                  fontSize: '13px',
                  color: '#ffffff',
                  fontWeight: 600,
                  lineHeight: '16px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'help',
                  height: '32px'
                }}
              >
                {project.name}
              </Text>
            </Tooltip>
          </div>
          {(normalizedStatus === 'importing' || normalizedStatus === 'downloading' || normalizedStatus === 'processing' || normalizedStatus === 'failed') ? (
            <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <UnifiedStatusBar
                projectId={project.id}
                status={normalizedStatus}
                downloadProgress={progressPercent}
                onStatusChange={(newStatus) => {
                  console.log('Project status changed', project.id, normalizedStatus, newStatus)
                }}
                onDownloadProgressUpdate={(progress) => {
                  console.log('Project progress updated', project.id, progress)
                }}
              />
              {normalizedStatus === 'failed' && (
                <div style={{ display: 'flex', gap: 2, flex: '0 0 auto' }} onClick={(e) => e.stopPropagation()}>
                  <Btn variant="text" size="sm" style={{ height: 26, padding: '0 8px', fontSize: 12.5 }} loading={isRetrying} onClick={() => handleRetry()}>{t('common.retry')}</Btn>
                  <Btn variant="text" size="sm" style={{ height: 26, padding: '0 8px', fontSize: 12.5 }} onClick={() => setFeedbackOpen(true)}>{t('projectCard.feedback')}</Btn>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <UnifiedStatusBar
                projectId={project.id}
                status={normalizedStatus}
                downloadProgress={progressPercent}
                onStatusChange={() => {}}
              />
              <div style={{ color: 'var(--ac-muted)', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                <span className="ac-mono">{project.total_clips || 0}</span> {t('projectCard.clipsUnit')}
                <span style={{ margin: '0 6px' }}>·</span>
                <span className="ac-mono">{project.total_collections || 0}</span> {t('projectCard.collectionsUnit')}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
    <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} context={failureContext} />
    </>
  )
}

export default ProjectCard