import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Row, Col, Statistic, Button } from 'antd';
import TaskProgress from './TaskProgress';
import { NotificationList } from './NotificationList';
import { useNotifications } from '../hooks/useNotifications';
import { useProjectStore } from '../store/useProjectStore';

interface RealTimeStatusProps {
  userId: string;
  projectId?: string;
}

export const RealTimeStatus: React.FC<RealTimeStatusProps> = ({ userId, projectId }) => {
  const { t } = useTranslation();
  const currentProject = useProjectStore((state) => state.currentProject);
  
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      status: string;
      progress: number;
      message: string;
      updatedAt: string;
      project_id?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  
  // 直接使用简单的状态管理，不使用复杂的Hook
  const loadProjectTasks = useCallback(async (projectId: string) => {
    console.log('📤 开始加载项目任务:', projectId);
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/tasks/project/${projectId}`);
      console.log('📡 API响应状态:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const projectTasks = data.items || []; // 使用正确的字段名
        console.log('📋 获取到任务数量:', projectTasks.length);
        
        // 转换为TaskProgress组件期望的格式
        const formattedTasks = projectTasks.map((task: any) => ({
          id: task.id,
          status: task.status,
          progress: task.progress || 0,
          message: task.name || t('taskProgress.taskLabel', { taskId: task.id }), // 使用name字段或默认值
          updatedAt: task.created_at || task.updated_at || new Date().toISOString(),
          project_id: task.project_id // 添加项目ID字段
        }));
        
        setTasks(formattedTasks);
      } else {
        console.error('❌ API调用失败:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ 加载项目任务失败:', error);
    } finally {
      setLoading(false);
      console.log('✅ 任务加载完成');
    }
  }, []);

  const {
    notifications,
    unreadCount,
    markAsRead,
    removeNotification,
    markAllAsRead,
    clearAll: clearAllNotifications
  } = useNotifications();

  // 加载项目任务
  useEffect(() => {
    const activeProjectId = projectId || currentProject?.id;
    if (!activeProjectId) {
      setTasks([]);
      return;
    }
    console.log('🔄 开始加载项目任务:', activeProjectId);
    loadProjectTasks(activeProjectId);
  }, [projectId, currentProject?.id, loadProjectTasks]);

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        {/* 统计信息 */}
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t('taskProgress.totalTasks')}
              value={tasks.length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t('taskProgress.loadingStatus')}
              value={loading ? t('taskProgress.loadingValue') : t('status.completed')}
              valueStyle={{ color: loading ? '#52c41a' : '#999' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t('notification.unreadCount')}
              value={unreadCount}
              valueStyle={{ color: unreadCount > 0 ? '#ff4d4f' : '#999' }}
            />
          </Card>
        </Col>

        {/* 任务进度 */}
        <Col span={12}>
          <Card
            title={t('taskProgress.cardTitle')}
            size="small"
            extra={
              <Button size="small" onClick={() => setTasks([])}>
                {t('taskProgress.clear')}
              </Button>
            }
          >
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  {t('taskProgress.noTasks')}
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskProgress 
                    key={task.id} 
                    projectId={task.project_id || userId}
                    taskId={task.id}
                    status={task.status === 'running' ? 'processing' : task.status}
                  />
                ))
              )}
            </div>
          </Card>
        </Col>

        {/* 通知列表 */}
        <Col span={12}>
          <NotificationList
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onRemove={removeNotification}
            onMarkAllAsRead={markAllAsRead}
            onClearAll={clearAllNotifications}
            maxHeight={300}
          />
        </Col>
      </Row>
    </div>
  );
}; 
