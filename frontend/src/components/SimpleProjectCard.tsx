/**
 * 简化的项目卡片组件 - 集成新的进度系统
 */

import React, { useState, useEffect } from 'react'
import { Card, Typography, Space, Button, Tag, Tooltip, Modal, message } from 'antd'
import { 
  PlayCircleOutlined, 
  EyeOutlined, 
  DeleteOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SimpleProgressBar } from './SimpleProgressBar'
import { 
  useSimpleProgressStore, 
  isCompleted, 
  isFailed,
  SimpleProgress 
} from '../stores/useSimpleProgressStore'

const { Title, Text } = Typography

interface Project {
  id: string
  title: string
  description?: string
  status: string
  created_at: string
  updated_at: string
  video_path?: string
  srt_path?: string
  category?: string
}

interface SimpleProjectCardProps {
  project: Project
  onStartProcessing?: (projectId: string) => void
  onViewDetails?: (projectId: string) => void
  onDelete?: (projectId: string) => void
  onRetry?: (projectId: string) => void
}

export const SimpleProjectCard: React.FC<SimpleProjectCardProps> = ({
  project,
  onStartProcessing,
  onViewDetails,
  onDelete,
  onRetry
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getProgress, startPolling, stopPolling } = useSimpleProgressStore()
  const [showProgress, setShowProgress] = useState(false)
  
  const progress = getProgress(project.id)

  // 根据项目状态决定是否显示进度
  useEffect(() => {
    if (project.status === 'processing') {
      setShowProgress(true)
      // 开始轮询这个项目的进度
      startPolling([project.id], 2000)
    } else {
      setShowProgress(false)
      stopPolling()
    }
  }, [project.status, project.id, startPolling, stopPolling])

  const handleStartProcessing = () => {
    if (onStartProcessing) {
      onStartProcessing(project.id)
    }
  }

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(project.id)
    } else {
      navigate(`/project/${project.id}`)
    }
  }

  const handleDelete = () => {
    Modal.confirm({
      title: t('project.confirmDelete'),
      content: t('project.deleteProjectConfirm', { title: project.title }),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: () => {
        if (onDelete) {
          onDelete(project.id)
        }
      }
    })
  }

  const handleRetry = () => {
    if (onRetry) {
      onRetry(project.id)
    }
  }

  // 获取状态图标和颜色
  const getStatusConfig = (status: string, progress?: SimpleProgress) => {
    if (progress && isFailed(progress.message)) {
      return {
        icon: <ExclamationCircleOutlined />,
        color: '#ff4d4f',
        text: t('project.processingFailed')
      }
    }

    if (progress && isCompleted(progress.stage)) {
      return {
        icon: <CheckCircleOutlined />,
        color: '#52c41a',
        text: t('project.processingComplete')
      }
    }

    if (status === 'processing' || (progress && !isCompleted(progress.stage))) {
      return {
        icon: <ReloadOutlined spin />,
        color: '#1890ff',
        text: t('project.processing')
      }
    }

    return {
      icon: <PlayCircleOutlined />,
      color: '#666666',
      text: t('project.waitingToProcess')
    }
  }

  const statusConfig = getStatusConfig(project.status, progress || undefined)
  const canStart = project.status === 'pending' || project.status === 'failed'
  const canRetry = project.status === 'failed' || (progress && isFailed(progress.message))

  return (
    <Card
      hoverable
      style={{ margin: '8px 0' }}
      actions={[
        canStart && (
          <Tooltip title={t('project.startProcessing')}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartProcessing}
            >
              {t('project.startProcessing')}
            </Button>
          </Tooltip>
        ),
        canRetry && (
          <Tooltip title={t('common.retry')}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRetry}
            >
              {t('common.retry')}
            </Button>
          </Tooltip>
        ),
        <Tooltip title={t('project.viewDetails')}>
          <Button
            icon={<EyeOutlined />}
            onClick={handleViewDetails}
          >
            {t('project.viewDetails')}
          </Button>
        </Tooltip>,
        <Tooltip title={t('project.deleteProject')}>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleDelete}
          >
            {t('common.delete')}
          </Button>
        </Tooltip>
      ].filter(Boolean)}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 项目标题和状态 */}
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={5} style={{ margin: 0, flex: 1 }}>
            {project.title}
          </Title>
          <Tag 
            color={statusConfig.color} 
            icon={statusConfig.icon}
            style={{ margin: 0 }}
          >
            {statusConfig.text}
          </Tag>
        </Space>

        {/* 项目描述 */}
        {project.description && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {project.description}
          </Text>
        )}

        {/* 分类标签 */}
        {project.category && (
          <Tag color="blue" style={{ fontSize: '11px' }}>
            {(() => {
              const catMap: Record<string, string> = {
                default: t('projectCard.categoryDefault', 'Predeterminado'),
                '默认': t('projectCard.categoryDefault', 'Predeterminado'),
                knowledge: t('projectCard.categoryKnowledge', 'Educación'),
                '知识科普': t('projectCard.categoryKnowledge', 'Educación'),
                business: t('projectCard.categoryBusiness', 'Negocios'),
                '商业': t('projectCard.categoryBusiness', 'Negocios'),
                '商业财经': t('projectCard.categoryBusiness', 'Negocios'),
                opinion: t('projectCard.categoryOpinion', 'Opinión'),
                '观点': t('projectCard.categoryOpinion', 'Opinión'),
                '观点评论': t('projectCard.categoryOpinion', 'Opinión'),
                experience: t('projectCard.categoryExperience', 'Experiencia'),
                '生活经验': t('projectCard.categoryExperience', 'Experiencia'),
                '经验分享': t('projectCard.categoryExperience', 'Experiencia'),
                speech: t('projectCard.categorySpeech', 'Charla'),
                '演讲': t('projectCard.categorySpeech', 'Charla'),
                '演讲脱口秀': t('projectCard.categorySpeech', 'Charla'),
                content_review: t('projectCard.categoryContentReview', 'Reseña'),
                '解说': t('projectCard.categoryContentReview', 'Reseña'),
                '内容解说': t('projectCard.categoryContentReview', 'Reseña'),
                entertainment: t('projectCard.categoryEntertainment', 'Entretenimiento'),
                '娱乐': t('projectCard.categoryEntertainment', 'Entretenimiento'),
                '娱乐休闲': t('projectCard.categoryEntertainment', 'Entretenimiento'),
              }
              return catMap[project.category] || project.category
            })()}
          </Tag>
        )}

        {/* 进度条 */}
        {showProgress && (
          <SimpleProgressBar
            projectId={project.id}
            autoStart={false} // 已经在useEffect中处理
            showDetails={true}
            onProgressUpdate={(progress) => {
              // 如果处理完成，更新显示状态
              if (isCompleted(progress.stage)) {
                setShowProgress(false)
                message.success(t('project.projectProcessComplete'))
              } else if (isFailed(progress.message)) {
                message.error(t('project.projectProcessFailed'))
              }
            }}
          />
        )}

        {/* 时间信息 */}
        <Space style={{ fontSize: '11px', color: '#999' }}>
          <Text type="secondary">
            {t('projectCard.createdAt', 'Creado: ')} {new Date(project.created_at).toLocaleDateString()}
          </Text>
          <Text type="secondary">
            {t('projectCard.updatedAt', 'Actualizado: ')} {new Date(project.updated_at).toLocaleDateString()}
          </Text>
        </Space>
      </Space>
    </Card>
  )
}
