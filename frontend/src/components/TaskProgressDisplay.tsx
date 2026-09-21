import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Progress, Card, Typography, Tag, Space, Button, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTaskProgress, TaskProgressState } from '../hooks/useTaskProgress';

const { Text } = Typography;

interface TaskProgressDisplayProps {
  userId: string;
  taskId: string;
  onTaskComplete?: (state: TaskProgressState) => void;
  onTaskFailed?: (state: TaskProgressState) => void;
}

export const TaskProgressDisplay: React.FC<TaskProgressDisplayProps> = ({
  userId,
  taskId,
  onTaskComplete,
  onTaskFailed
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    taskState,
    isConnected,
    isSubscribed,
    performFinalStateCheck
  } = useTaskProgress({
    userId,
    taskId,
    onProgressUpdate: (state) => {
      console.log('任务进度更新:', state);
    },
    onTaskComplete: (state) => {
      console.log('任务完成:', state);
      message.success(t('taskProgress.taskCompleteMsg'));
      onTaskComplete?.(state);
    },
    onTaskFailed: (state) => {
      console.log('任务失败:', state);
      message.error(t('taskProgress.taskFailedMsg', { message: state.message }));
      onTaskFailed?.(state);
    }
  });

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'transcribe': return 'blue';
      case 'analyze': return 'green';
      case 'clip': return 'orange';
      case 'encode': return 'purple';
      case 'upload': return 'red';
      default: return 'default';
    }
  };

  const getPhaseText = (phase: string) => {
    switch (phase) {
      case 'transcribe': return t('taskProgress.phaseTranscribe');
      case 'analyze': return t('taskProgress.phaseAnalyze');
      case 'clip': return t('taskProgress.phaseClip');
      case 'encode': return t('taskProgress.phaseEncode');
      case 'upload': return t('taskProgress.phaseUpload');
      default: return phase;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'default';
      case 'PROGRESS': return 'processing';
      case 'DONE': return 'success';
      case 'FAIL': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return t('status.pending');
      case 'PROGRESS': return t('taskProgress.inProgress');
      case 'DONE': return t('status.completed');
      case 'FAIL': return t('common.failed');
      default: return status;
    }
  };

  if (!taskState) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text type="secondary">{t('taskProgress.taskLabel', { taskId })}</Text>
          <Tag color={isConnected ? 'success' : 'error'}>
            {isConnected ? t('taskProgress.connected') : t('taskProgress.disconnected')}
          </Tag>
          <Tag color={isSubscribed ? 'success' : 'default'}>
            {isSubscribed ? t('taskProgress.subscribed') : t('taskProgress.unsubscribed')}
          </Tag>
        </Space>
      </Card>
    );
  }

  return (
    <Card 
      size="small" 
      style={{ marginBottom: 16 }}
      title={
        <Space>
          <Text strong>{t('taskProgress.cardTitle')}</Text>
          <Tag color={getStatusColor(taskState.status)}>
            {getStatusText(taskState.status)}
          </Tag>
          <Tag color={getPhaseColor(taskState.phase)}>
            {getPhaseText(taskState.phase)}
          </Tag>
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={performFinalStateCheck}
            title={t('taskProgress.finalStateCheckTooltip')}
          />
          <Button
            size="small"
            type="text"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? t('taskProgress.collapse') : t('taskProgress.expand')}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 进度条 */}
        <div>
          <Progress 
            percent={taskState.progress}
            status={taskState.status === 'FAIL' ? 'exception' : 
                   taskState.status === 'DONE' ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {t('taskProgress.stepsCount', { current: taskState.step, total: taskState.total })}
          </Text>
        </div>

        {/* 当前消息 */}
        <Text>{taskState.message}</Text>

        {/* 展开的详细信息 */}
        {isExpanded && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text strong>{t('taskProgress.taskIdLabel')}</Text> {taskState.task_id}
              </div>
              <div>
                <Text strong>{t('taskProgress.seqLabel')}</Text> {taskState.seq}
              </div>
              <div>
                <Text strong>{t('taskProgress.timestampLabel')}</Text> {new Date(taskState.ts * 1000).toLocaleString()}
              </div>
              <div>
                <Text strong>{t('taskProgress.lastUpdatedLabel')}</Text> {new Date(taskState.last_updated).toLocaleString()}
              </div>
              {taskState.meta && (
                <div>
                  <Text strong>{t('taskProgress.metadataLabel')}</Text> {JSON.stringify(taskState.meta, null, 2)}
                </div>
              )}
              <div>
                <Text strong>{t('taskProgress.connectionStatusLabel')}</Text>
                <Tag color={isConnected ? 'success' : 'error'} style={{ marginLeft: 8 }}>
                  {isConnected ? t('taskProgress.connected') : t('taskProgress.disconnected')}
                </Tag>
                <Tag color={isSubscribed ? 'success' : 'default'} style={{ marginLeft: 4 }}>
                  {isSubscribed ? t('taskProgress.subscribed') : t('taskProgress.unsubscribed')}
                </Tag>
              </div>
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
};

