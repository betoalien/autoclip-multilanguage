import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Table,
  Button,
  Progress,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tooltip,
  Statistic,
  Row,
  Col,
  Badge
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  UploadOutlined,
  EyeOutlined,
  StopOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;
const { Option } = Select;

interface UploadTask {
  task_id: string;
  video_path: string;
  title: string;
  description: string;
  tags: string;
  account_id?: number;
  priority: number;
  status: string;
  created_at: string;
  updated_at: string;
  progress: number;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  celery_task_id?: string;
  bv_id?: string;
}

interface QueueStatus {
  queued_tasks: number;
  processing_tasks: number;
  max_concurrent: number;
  queue_details: Array<{
    task_id: string;
    title: string;
    priority: number;
    created_at: string;
  }>;
  processing_details: Array<{
    task_id: string;
    title: string;
    progress: number;
    account_id: number;
  }>;
}

interface BilibiliAccount {
  id: number;
  username: string;
  nickname?: string;
  status: string;
  is_vip: boolean;
  level: number;
  can_upload: boolean;
}

const UploadQueueManager: React.FC = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [accounts, setAccounts] = useState<BilibiliAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [addTaskModalVisible, setAddTaskModalVisible] = useState(false);
  const [batchUploadModalVisible, setBatchUploadModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();

  // 获取队列状态
  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/upload-queue/status');
      if (response.ok) {
        const data = await response.json();
        setQueueStatus(data);
      }
    } catch (error) {
      console.error('获取队列状态失败:', error);
    }
  };

  // 获取上传历史
  const fetchUploadHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/upload-queue/history?limit=50');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.records || []);
      }
    } catch (error) {
      console.error('获取上传历史失败:', error);
      message.error(t('upload.queue.fetchHistoryFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 获取B站账号列表
  const fetchAccounts = async () => {
    try {
      const response = await fetch('/bilibili/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('获取账号列表失败:', error);
    }
  };

  // 添加单个任务
  const handleAddTask = async (values: any) => {
    try {
      const response = await fetch('/api/upload-queue/add-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const data = await response.json();
        message.success(t('upload.queue.taskAdded', { taskId: data.task_id }));
        setAddTaskModalVisible(false);
        form.resetFields();
        fetchQueueStatus();
        fetchUploadHistory();
      } else {
        const error = await response.json();
        message.error(t('upload.queue.addTaskFailed', { reason: error.detail }));
      }
    } catch (error) {
      console.error('添加任务失败:', error);
      message.error(t('upload.queue.addTaskFailedGeneric'));
    }
  };

  // 批量添加任务
  const handleBatchUpload = async (values: any) => {
    try {
      const tasks = values.tasks.split('\n').filter((line: string) => line.trim()).map((line: string) => {
        const [video_path, title, description = '', tags = ''] = line.split('|').map((s: string) => s.trim());
        return {
          video_path,
          title,
          description,
          tags,
          priority: values.priority || 'normal'
        };
      });

      const response = await fetch('/api/upload-queue/add-batch-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks }),
      });

      if (response.ok) {
        const data = await response.json();
        message.success(t('upload.queue.batchAdded', { count: data.count }));
        setBatchUploadModalVisible(false);
        batchForm.resetFields();
        fetchQueueStatus();
        fetchUploadHistory();
      } else {
        const error = await response.json();
        message.error(t('upload.queue.batchAddFailed', { reason: error.detail }));
      }
    } catch (error) {
      console.error('批量添加失败:', error);
      message.error(t('upload.queue.batchAddFailedGeneric'));
    }
  };

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/upload-queue/task/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        message.success(t('upload.queue.taskCancelled'));
        fetchQueueStatus();
        fetchUploadHistory();
      } else {
        const error = await response.json();
        message.error(t('upload.queue.cancelTaskFailed', { reason: error.detail }));
      }
    } catch (error) {
      console.error('取消任务失败:', error);
      message.error(t('upload.queue.cancelTaskFailedGeneric'));
    }
  };

  // 重试任务
  const handleRetryTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/upload-queue/retry/${taskId}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        message.success(t('upload.queue.taskReadded', { taskId: data.new_task_id }));
        fetchQueueStatus();
        fetchUploadHistory();
      } else {
        const error = await response.json();
        message.error(t('upload.queue.retryTaskFailed', { reason: error.detail }));
      }
    } catch (error) {
      console.error('重试任务失败:', error);
      message.error(t('upload.queue.retryTaskFailedGeneric'));
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: t('upload.queue.statusPending') },
      queued: { color: 'blue', text: t('upload.queue.statusQueued') },
      processing: { color: 'orange', text: t('upload.queue.statusProcessing') },
      completed: { color: 'green', text: t('upload.queue.statusCompleted') },
      failed: { color: 'red', text: t('common.failed') },
      cancelled: { color: 'gray', text: t('upload.queue.statusCancelled') }
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 获取优先级标签
  const getPriorityTag = (priority: number) => {
    const priorityConfig: Record<number, { color: string; text: string }> = {
      1: { color: 'default', text: t('upload.queue.priorityLow') },
      2: { color: 'blue', text: t('upload.queue.priorityNormal') },
      3: { color: 'orange', text: t('upload.queue.priorityHigh') },
      4: { color: 'red', text: t('upload.queue.priorityUrgent') }
    };

    const config = priorityConfig[priority] || { color: 'default', text: t('upload.queue.priorityNormal') };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns: ColumnsType<UploadTask> = [
    {
      title: t('bilibili.manager.columnTaskId'),
      dataIndex: 'task_id',
      key: 'task_id',
      width: 120,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text.substring(0, 8)}...</span>
        </Tooltip>
      ),
    },
    {
      title: t('bilibili.manager.columnTitle'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: t('bilibili.manager.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: t('upload.queue.columnPriority'),
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: number) => getPriorityTag(priority),
    },
    {
      title: t('bilibili.manager.columnProgress'),
      dataIndex: 'progress',
      key: 'progress',
      width: 120,
      render: (progress: number, record: UploadTask) => (
        <Progress
          percent={progress}
          size="small"
          status={record.status === 'failed' ? 'exception' : 'active'}
        />
      ),
    },
    {
      title: t('upload.queue.columnAccountId'),
      dataIndex: 'account_id',
      key: 'account_id',
      width: 80,
    },
    {
      title: t('bilibili.manager.bvIdLabel'),
      dataIndex: 'bv_id',
      key: 'bv_id',
      width: 120,
      render: (bvId: string) => bvId ? (
        <a href={`https://www.bilibili.com/video/${bvId}`} target="_blank" rel="noopener noreferrer">
          {bvId}
        </a>
      ) : '-',
    },
    {
      title: t('bilibili.manager.columnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: t('bilibili.manager.columnAction'),
      key: 'action',
      width: 150,
      render: (_, record: UploadTask) => (
        <Space size="small">
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetryTask(record.task_id)}
            >
              {t('common.retry')}
            </Button>
          )}
          {(record.status === 'queued' || record.status === 'processing') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancelTask(record.task_id)}
            >
              {t('bilibili.manager.cancelAction')}
            </Button>
          )}
          {record.error_message && (
            <Tooltip title={record.error_message}>
              <Button type="link" size="small" icon={<EyeOutlined />}>
                {t('upload.queue.errorLabel')}
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  useEffect(() => {
    fetchQueueStatus();
    fetchUploadHistory();
    fetchAccounts();

    // 定时刷新状态
    const interval = setInterval(() => {
      fetchQueueStatus();
      fetchUploadHistory();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="upload-queue-manager">
      {/* 队列状态统计 */}
      {queueStatus && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('upload.queue.statQueuedTasks')}
                value={queueStatus.queued_tasks}
                prefix={<Badge status="processing" />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('upload.queue.statProcessingTasks')}
                value={queueStatus.processing_tasks}
                prefix={<Badge status="success" />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('upload.queue.statMaxConcurrent')}
                value={queueStatus.max_concurrent}
                prefix={<Badge status="default" />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('upload.queue.statAvailableAccounts')}
                value={(accounts || []).filter(acc => acc.status === 'active' && acc.can_upload).length}
                prefix={<Badge status="success" />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 操作按钮 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddTaskModalVisible(true)}
          >
            添加任务
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setBatchUploadModalVisible(true)}
          >
            批量上传
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchQueueStatus();
              fetchUploadHistory();
            }}
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 任务列表 */}
      <Card title="上传任务">
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="task_id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 添加任务模态框 */}
      <Modal
        title="添加上传任务"
        open={addTaskModalVisible}
        onCancel={() => setAddTaskModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddTask}
        >
          <Form.Item
            name="video_path"
            label="视频文件路径"
            rules={[{ required: true, message: '请输入视频文件路径' }]}
          >
            <Input placeholder="/path/to/video.mp4" />
          </Form.Item>
          
          <Form.Item
            name="title"
            label="视频标题"
            rules={[{ required: true, message: '请输入视频标题' }]}
          >
            <Input placeholder="视频标题" maxLength={80} />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="视频描述"
          >
            <TextArea rows={4} placeholder="视频描述" maxLength={2000} />
          </Form.Item>
          
          <Form.Item
            name="tags"
            label="标签"
          >
            <Input placeholder="标签1,标签2,标签3" />
          </Form.Item>
          
          <Form.Item
            name="account_id"
            label="指定账号"
          >
            <Select placeholder="自动选择最佳账号" allowClear>
              {(accounts || []).filter(acc => acc.status === 'active' && acc.can_upload).map(account => (
                <Option key={account.id} value={account.id}>
                  {account.nickname || account.username} 
                  {account.is_vip && <Tag color="gold">VIP</Tag>}
                  <Tag color="blue">Lv.{account.level}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="priority"
            label="优先级"
            initialValue="normal"
          >
            <Select>
              <Option value="low">低</Option>
              <Option value="normal">普通</Option>
              <Option value="high">高</Option>
              <Option value="urgent">紧急</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量上传模态框 */}
      <Modal
        title="批量上传任务"
        open={batchUploadModalVisible}
        onCancel={() => setBatchUploadModalVisible(false)}
        onOk={() => batchForm.submit()}
        width={800}
      >
        <Form
          form={batchForm}
          layout="vertical"
          onFinish={handleBatchUpload}
        >
          <Form.Item
            name="tasks"
            label="任务列表"
            rules={[{ required: true, message: '请输入任务列表' }]}
            extra="每行一个任务，格式：视频路径|标题|描述|标签"
          >
            <TextArea
              rows={10}
              placeholder={`/path/to/video1.mp4|视频标题1|视频描述1|标签1,标签2
/path/to/video2.mp4|视频标题2|视频描述2|标签3,标签4`}
            />
          </Form.Item>
          
          <Form.Item
            name="priority"
            label="批量优先级"
            initialValue="normal"
          >
            <Select>
              <Option value="low">低</Option>
              <Option value="normal">普通</Option>
              <Option value="high">高</Option>
              <Option value="urgent">紧急</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UploadQueueManager;