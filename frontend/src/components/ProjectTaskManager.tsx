import React, { useState } from 'react'
import { Card, Table, Tag, Progress, Space, Typography, Button, Modal, message, Row, Col, Statistic } from 'antd'
import { ReloadOutlined, EyeOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useTaskStatus } from '../hooks/useTaskStatus'
import { TaskStatus as TaskStatusType } from '../hooks/useTaskStatus'

const { Text } = Typography
const { confirm } = Modal

interface ProjectTaskManagerProps {
  projectId: string
  projectName?: string
}

export const ProjectTaskManager: React.FC<ProjectTaskManagerProps> = ({ 
  projectId
}) => {
  const { t } = useTranslation()
  const { tasks, loading, loadProjectTasks } = useTaskStatus()
  const [selectedTask, setSelectedTask] = useState<TaskStatusType | null>(null)
  const [taskDetailVisible, setTaskDetailVisible] = useState(false)

  // 获取当前项目的任务
  const allTasks = tasks || []
  const projectTasks = allTasks.filter((task: TaskStatusType) => task.project_id === projectId)
  const activeTasks = projectTasks.filter((task: TaskStatusType) => 
    task.status === 'running' || task.status === 'pending'
  )
  const completedTasks = projectTasks.filter((task: TaskStatusType) => task.status === 'completed')
  const failedTasks = projectTasks.filter((task: TaskStatusType) => task.status === 'failed')

  // 刷新任务列表
  const handleRefresh = () => {
    loadProjectTasks(projectId)
    message.success(t('project.taskListRefreshed'))
  }

  // 查看任务详情
  const handleViewTask = (task: TaskStatusType) => {
    setSelectedTask(task)
    setTaskDetailVisible(true)
  }

  // 删除任务
  const handleDeleteTask = (taskId: string) => {
    confirm({
      title: t('project.confirmDelete'),
      icon: <ExclamationCircleOutlined />,
      content: t('project.deleteTaskConfirm'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk() {
        message.success(t('project.taskDeleted', { taskId }))
      }
    })
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'running':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
    }
  }

  // 表格列定义
  const columns = [
    {
      title: t('project.taskName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: TaskStatusType) => (
        <Space>
          {getStatusIcon(record.status)}
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: t('project.taskStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'success' : status === 'running' ? 'processing' : status === 'failed' ? 'error' : status === 'pending' ? 'warning' : 'default'}>
          {status === 'completed' ? t('project.completed') :
           status === 'running' ? t('project.running') :
           status === 'failed' ? t('common.failed') :
           status === 'pending' ? t('project.pending') : status}
        </Tag>
      )
    },
    {
      title: t('project.taskProgress'),
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number, record: TaskStatusType) => (
        <Progress
          percent={Math.round(progress)}
          size="small"
          status={record.status === 'failed' ? 'exception' : 'normal'}
        />
      )
    },
    {
      title: t('project.currentStep'),
      dataIndex: 'current_step',
      key: 'current_step',
      render: (step: string) => step || '-'
    },
    {
      title: t('project.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp: string) => (
        <Text type="secondary">
          {new Date(timestamp).toLocaleString('zh-CN')}
        </Text>
      )
    },
    {
      title: t('project.actions'),
      key: 'actions',
      width: 120,
      render: (_: any, record: TaskStatusType) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewTask(record)}
            title={t('project.viewDetails')}
          />
          <Button
            type="text"
            size="small"
            icon={<ExclamationCircleOutlined />}
            onClick={() => handleDeleteTask(record.id)}
            title={t('project.deleteTask')}
            danger
          />
        </Space>
      )
    }
  ]

  if (projectTasks.length === 0) {
    return (
      <Card title={t('project.taskManagement')} size="small">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Text type="secondary">{t('project.noTaskRecords')}</Text>
        </div>
      </Card>
    )
  }

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('project.taskManagement')}</span>
          <Button
            type="primary"
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            {t('project.refresh')}
          </Button>
        </div>
      }
      size="small"
    >
      {/* 任务统计 */}
      <Row gutter={16} style={{ marginBottom: '16px' }}>
        <Col span={6}>
          <Statistic
            title={t('project.totalTasks')}
            value={projectTasks.length}
            prefix={<ClockCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('project.activeTasks')}
            value={activeTasks.length}
            valueStyle={{ color: '#1890ff' }}
            prefix={<ClockCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('project.completed')}
            value={completedTasks.length}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('project.failedTasks')}
            value={failedTasks.length}
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<CloseCircleOutlined />}
          />
        </Col>
      </Row>

      {/* 活跃任务 */}
      {activeTasks.length > 0 && (
        <Card 
          size="small" 
          style={{ marginBottom: '16px' }}
          title={t('project.activeTasksCount', { count: activeTasks.length })}
        >
          <Space wrap>
            {activeTasks.map((task: TaskStatusType) => (
              <div key={task.id} style={{ marginBottom: '8px' }}>
                <Text>{task.message || task.id}</Text>
                <Progress percent={task.progress} size="small" />
              </div>
            ))}
          </Space>
        </Card>
      )}

      {/* 任务列表 */}
      <Table
        columns={columns}
        dataSource={projectTasks}
        rowKey="id"
        pagination={{
          pageSize: 5,
          showSizeChanger: false,
          showTotal: (total, range) =>
            t('project.paginationTotal', { from: range[0], to: range[1], total })
        }}
        size="small"
        loading={loading}
      />

      {/* 任务详情弹窗 */}
      <Modal
        title={t('project.taskDetails')}
        open={taskDetailVisible}
        onCancel={() => setTaskDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTaskDetailVisible(false)}>
            {t('common.close')}
          </Button>
        ]}
        width={800}
      >
        {selectedTask && (
          <div>
            <Text>{t('project.taskId')}: {selectedTask.id}</Text>
            <br />
            <Text>{t('project.taskStatus')}: {selectedTask.status}</Text>
            <br />
            <Text>{t('project.taskProgress')}: {selectedTask.progress}%</Text>
            <br />
            <Text>{t('project.taskMessage')}: {selectedTask.message}</Text>
          </div>
        )}
      </Modal>
    </Card>
  )
}
