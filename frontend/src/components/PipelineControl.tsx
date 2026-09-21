import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Space, Typography, Alert, Spin, Progress, Tag, List, Modal, message } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  ReloadOutlined, 
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface PipelineControlProps {
  projectId: string;
  onStatusChange?: (status: string) => void;
}

interface TaskInfo {
  id: string;
  name: string;
  status: string;
  progress: number;
  current_step: string;
  realtime_progress?: number;
  realtime_step?: string;
  step_details?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface PipelineStatus {
  project_id: string;
  project_status: string;
  tasks: TaskInfo[];
  total_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
}

const PipelineControl: React.FC<PipelineControlProps> = ({ 
  projectId, 
  onStatusChange
}) => {
  const { t } = useTranslation();
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  // 获取流水线状态
  const fetchPipelineStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/pipeline/status/${projectId}`);
      if (!response.ok) {
        throw new Error(t('pipeline.fetchStatusFailed'));
      }
      
      const data = await response.json();
      setPipelineStatus(data);
      
      // 通知父组件状态变化
      if (onStatusChange) {
        onStatusChange(data.project_status);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : t('taskProgress.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  // 启动流水线
  const startPipeline = async () => {
    try {
      setActionLoading(true);
      
      const response = await fetch(`/api/v1/pipeline/start/${projectId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(t('pipeline.startPipelineFailed'));
      }

      const result = await response.json();
      message.success(result.message);

      // 刷新状态
      await fetchPipelineStatus();

    } catch (err) {
      message.error(err instanceof Error ? err.message : t('pipeline.startFailedFallback'));
    } finally {
      setActionLoading(false);
    }
  };

  // 停止流水线
  const stopPipeline = async () => {
    try {
      setActionLoading(true);
      
      const response = await fetch(`/api/v1/pipeline/stop/${projectId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(t('pipeline.stopPipelineFailed'));
      }

      const result = await response.json();
      message.success(result.message);

      // 刷新状态
      await fetchPipelineStatus();

    } catch (err) {
      message.error(err instanceof Error ? err.message : t('pipeline.stopFailedFallback'));
    } finally {
      setActionLoading(false);
    }
  };

  // 重启流水线
  const restartPipeline = async () => {
    try {
      setActionLoading(true);
      
      const response = await fetch(`/api/v1/pipeline/restart/${projectId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(t('pipeline.restartPipelineFailed'));
      }

      const result = await response.json();
      message.success(result.message);

      // 刷新状态
      await fetchPipelineStatus();

    } catch (err) {
      message.error(err instanceof Error ? err.message : t('pipeline.restartFailedFallback'));
    } finally {
      setActionLoading(false);
    }
  };

  // 定期刷新状态
  useEffect(() => {
    if (projectId) {
      fetchPipelineStatus();
      
      // 每10秒刷新一次
      const interval = setInterval(fetchPipelineStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [projectId]);

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'processing':
        return { color: 'processing', text: t('status.processing'), icon: <PlayCircleOutlined /> };
      case 'completed':
        return { color: 'success', text: t('status.completed'), icon: <CheckCircleOutlined /> };
      case 'failed':
        return { color: 'error', text: t('common.failed'), icon: <CloseCircleOutlined /> };
      case 'pending':
        return { color: 'default', text: t('status.pending'), icon: <ClockCircleOutlined /> };
      case 'paused':
        return { color: 'warning', text: t('status.paused'), icon: <PauseCircleOutlined /> };
      default:
        return { color: 'default', text: status, icon: <ClockCircleOutlined /> };
    }
  };

  // 获取任务状态配置
  const getTaskStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return { color: 'processing', text: t('pipeline.taskRunning') };
      case 'completed':
        return { color: 'success', text: t('status.completed') };
      case 'failed':
        return { color: 'error', text: t('common.failed') };
      case 'pending':
        return { color: 'default', text: t('status.pending') };
      case 'cancelled':
        return { color: 'warning', text: t('status.cancelled') };
      default:
        return { color: 'default', text: status };
    }
  };

  if (loading) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>{t('pipeline.fetchingStatus')}</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Alert
          message={t('pipeline.fetchStatusFailed')}
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchPipelineStatus}>
              {t('common.retry')}
            </Button>
          }
        />
      </Card>
    );
  }

  if (!pipelineStatus) {
    return null;
  }

  const statusConfig = getStatusConfig(pipelineStatus.project_status);
  const canStart = pipelineStatus.project_status === 'pending' || pipelineStatus.project_status === 'failed';
  const canStop = pipelineStatus.project_status === 'processing';
  const canRestart = pipelineStatus.project_status === 'processing' || pipelineStatus.project_status === 'failed';

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            {statusConfig.icon}
            <Title level={5} style={{ margin: 0 }}>
              {t('pipeline.title')}
            </Title>
            <Tag color={statusConfig.color}>
              {statusConfig.text}
            </Tag>
          </Space>
        </div>

        {/* 控制按钮 */}
        <Space style={{ marginBottom: 16 }}>
          {canStart && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startPipeline}
              loading={actionLoading}
            >
              {t('pipeline.start')}
            </Button>
          )}

          {canStop && (
            <Button
              danger
              icon={<PauseCircleOutlined />}
              onClick={stopPipeline}
              loading={actionLoading}
            >
              {t('pipeline.stop')}
            </Button>
          )}

          {canRestart && (
            <Button
              icon={<ReloadOutlined />}
              onClick={restartPipeline}
              loading={actionLoading}
            >
              {t('pipeline.restart')}
            </Button>
          )}

          <Button
            icon={<EyeOutlined />}
            onClick={() => setStatusModalVisible(true)}
          >
            {t('pipeline.viewDetails')}
          </Button>
        </Space>

        {/* 任务统计 */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
              {pipelineStatus.total_tasks}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>{t('pipeline.totalTasks')}</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
              {pipelineStatus.running_tasks}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>{t('pipeline.taskRunning')}</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
              {pipelineStatus.completed_tasks}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>{t('status.completed')}</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
              {pipelineStatus.failed_tasks}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>{t('common.failed')}</div>
          </div>
        </div>

        {/* 当前任务进度 */}
        {pipelineStatus.tasks.length > 0 && (
          <div>
            <Text strong>{t('pipeline.currentTasksLabel')}</Text>
            {pipelineStatus.tasks.map((task) => (
              <div key={task.id} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>{task.name}</Text>
                  <Tag color={getTaskStatusConfig(task.status).color}>
                    {getTaskStatusConfig(task.status).text}
                  </Tag>
                </div>
                
                <Progress
                  percent={task.realtime_progress || task.progress}
                  size="small"
                  status={task.status === 'failed' ? 'exception' : 'normal'}
                />
                
                <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                  {t('pipeline.stepLabel')}{task.realtime_step || task.current_step}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Text type="secondary">{t('pipeline.autoUpdateNotice')}</Text>
        </div>
      </Card>

      {/* 状态详情模态框 */}
      <Modal
        title={t('pipeline.detailModalTitle')}
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
        width={800}
      >
        {pipelineStatus && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('pipeline.projectStatusLabel')}</Text>
              <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
            </div>

            <List
              header={<Text strong>{t('pipeline.taskListLabel')}</Text>}
              dataSource={pipelineStatus.tasks}
              renderItem={(task) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text>{task.name}</Text>
                        <Tag color={getTaskStatusConfig(task.status).color}>
                          {getTaskStatusConfig(task.status).text}
                        </Tag>
                      </div>
                    }
                    description={
                      <div>
                        <div>{t('pipeline.stepLabel')}{task.realtime_step || task.current_step}</div>
                        {task.step_details && <div>{t('pipeline.detailsLabel')}{task.step_details}</div>}
                        <div>{t('pipeline.createdAtLabel')}{new Date(task.created_at).toLocaleString()}</div>
                        {task.started_at && (
                          <div>{t('pipeline.startedAtLabel')}{new Date(task.started_at).toLocaleString()}</div>
                        )}
                        {task.completed_at && (
                          <div>{t('pipeline.completedAtLabel')}{new Date(task.completed_at).toLocaleString()}</div>
                        )}
                      </div>
                    }
                  />
                  
                  <div style={{ width: 200 }}>
                    <Progress
                      percent={task.realtime_progress || task.progress}
                      status={task.status === 'failed' ? 'exception' : 'normal'}
                    />
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>
    </>
  );
};

export default PipelineControl;
