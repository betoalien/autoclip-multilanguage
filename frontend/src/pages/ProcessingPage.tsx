import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Card, Progress, Steps, Typography, Button, Alert, Space, Spin, message } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { projectApi } from '../services/api'
import { useProjectStore } from '../store/useProjectStore'

const { Content } = Layout
const { Title, Text } = Typography
const { Step } = Steps

interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

const ProcessingPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const steps = [
    { title: t('processing.stepOutlineTitle'), description: t('processing.stepOutlineDescription') },
    { title: t('processing.stepTimingTitle'), description: t('processing.stepTimingDescription') },
    { title: t('processing.stepScoringTitle'), description: t('processing.stepScoringDescription') },
    { title: t('processing.stepTitlingTitle'), description: t('processing.stepTitlingDescription') },
    { title: t('processing.stepClusteringTitle'), description: t('processing.stepClusteringDescription') },
    { title: t('processing.stepCuttingTitle'), description: t('processing.stepCuttingDescription') }
  ]

  useEffect(() => {
    if (!id) return
    
    loadProject()
    const interval = setInterval(checkStatus, 2000) // 每2秒检查一次状态
    
    return () => clearInterval(interval)
  }, [id])

  const loadProject = async () => {
    if (!id) return
    
    try {
      const project = await projectApi.getProject(id)
      setCurrentProject(project)
      
      // 如果项目已完成，直接跳转到详情页
      if (project.status === 'completed') {
        navigate(`/project/${id}`)
        return
      }
      
      // 如果项目状态是等待处理，开始处理
      if (project.status === 'pending') {
        await startProcessing()
      }
    } catch (error) {
      message.error(t('processing.loadFailed'))
      console.error('Load project error:', error)
    } finally {
      setLoading(false)
    }
  }

  const startProcessing = async () => {
    if (!id) return
    
    try {
      await projectApi.startProcessing(id)
      message.success(t('processing.startedProject'))
    } catch (error) {
      message.error(t('processing.startFailed'))
      console.error('Start processing error:', error)
    }
  }

  const checkStatus = async () => {
    if (!id) return
    
    try {
      const statusData = await projectApi.getProcessingStatus(id)
      setStatus(statusData)
      
      // 如果处理完成，跳转到项目详情页
      if (statusData.status === 'completed') {
        message.success(t('processing.completedRedirecting'))
        setTimeout(() => {
          navigate(`/project/${id}`)
        }, 2000)
      }

      // 如果处理失败，显示详细错误信息
      if (statusData.status === 'error') {
        const errorMsg = statusData.error_message || t('processing.unknownError')
        message.error(t('processing.failedWithReason', { reason: errorMsg }))

        // 提供重试选项
        message.info(t('processing.retrySuggestion'), 5)
      }
      
    } catch (error: any) {
      console.error('Check status error:', error)
      
      // 根据错误类型提供不同的处理建议
      if (error.response?.status === 404) {
        message.error(t('processing.projectNotFound'))
        setTimeout(() => navigate('/'), 2000)
      } else if (error.code === 'ECONNABORTED') {
        message.warning(t('processing.connectionTimeout'))
      } else {
        message.error(t('processing.statusFetchFailed'))
      }
    }
  }

  const getStepStatus = (stepIndex: number) => {
    if (!status) return 'wait'
    
    if (status.status === 'error') {
      return stepIndex < status.current_step ? 'finish' : 'error'
    }
    
    if (stepIndex < status.current_step) return 'finish'
    if (stepIndex === status.current_step) return 'process'
    return 'wait'
  }

  const getStepIcon = (stepIndex: number) => {
    const stepStatus = getStepStatus(stepIndex)
    
    if (stepStatus === 'finish') return <CheckCircleOutlined />
    if (stepStatus === 'process') return <LoadingOutlined />
    if (stepStatus === 'error') return <ExclamationCircleOutlined />
    return null
  }

  if (loading) {
    return (
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip={t('common.loading')} />
      </Content>
    )
  }

  return (
    <Content style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={2}>{t('processing.title')}</Title>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            {t('processing.backHome')}
          </Button>
        </div>

        {currentProject && (
          <Card>
            <Title level={4}>{currentProject.name}</Title>
            <Text type="secondary">{t('processing.projectId')}: {currentProject.id}</Text>
          </Card>
        )}

        {status?.status === 'error' && (
          <Alert
            message={t('processing.failedTitle')}
            description={
              <div>
                <p>{status.error_message || t('processing.unknownError')}</p>
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  {t('processing.possibleReasons')}
                </p>
              </div>
            }
            type="error"
            showIcon
            action={
              <Space>
                <Button size="small" onClick={() => window.location.reload()}>
                  {t('processing.refreshPage')}
                </Button>
                <Button size="small" onClick={() => navigate('/')}>
                  {t('processing.backHome')}
                </Button>
              </Space>
            }
          />
        )}

        {status && status.status === 'processing' && (
          <Card title={t('processing.progressTitle')}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Text strong>{t('processing.overallProgress')}</Text>
                  <Text>{Math.round(status.progress)}%</Text>
                </div>
                <Progress 
                  percent={status.progress} 
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
              </div>

              <div>
                <Text strong>{t('processing.currentStep')}: </Text>
                <Text>{status.step_name}</Text>
              </div>

              <Steps 
                direction="vertical" 
                current={status.current_step}
                status="process"
              >
                {steps.map((step, index) => (
                  <Step
                    key={index}
                    title={step.title}
                    description={step.description}
                    status={getStepStatus(index)}
                    icon={getStepIcon(index)}
                  />
                ))}
              </Steps>
            </Space>
          </Card>
        )}

        {status?.status === 'completed' && (
          <Alert
            message={t('processing.completedTitle')}
            description={t('processing.completedDescription')}
            type="success"
            showIcon
          />
        )}
      </Space>
    </Content>
  )
}

export default ProcessingPage