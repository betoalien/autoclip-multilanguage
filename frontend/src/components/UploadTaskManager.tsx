import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Progress,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Divider
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { uploadApi, BILIBILI_PARTITIONS, UploadRecord } from '../services/uploadApi'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
interface UploadTask {
  id: string
  project_id: string
  account_id: string
  clip_id: string
  title: string
  description: string
  tags: string
  partition_id: number
  bvid?: string
  status: string
  error_message?: string
  created_at: string
  updated_at: string
  progress?: number
  current_step?: string
}

const mapRecordToTask = (record: UploadRecord, fallbackTitle: string): UploadTask => ({
  id: String(record.id),
  project_id: record.project_id ? String(record.project_id) : '',
  account_id: String(record.account_id),
  clip_id: record.clip_id || '',
  title: record.title || fallbackTitle,
  description: record.description || '',
  tags: record.tags || '[]',
  partition_id: record.partition_id,
  bvid: record.bv_id,
  status: record.status,
  error_message: record.error_message,
  created_at: record.created_at,
  updated_at: record.updated_at,
  progress: record.progress,
})

interface UploadTaskManagerProps {
  projectId?: string
}

const UploadTaskManager: React.FC<UploadTaskManagerProps> = ({ projectId }) => {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [loading, setLoading] = useState(false)
  const [filteredTasks, setFilteredTasks] = useState<UploadTask[]>([])
  const [selectedTask, setSelectedTask] = useState<UploadTask | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    accountId: '',
    dateRange: null as any,
    keyword: ''
  })

  // 获取投稿任务列表
  const fetchTasks = async () => {
    try {
      setLoading(true)
      const records = await uploadApi.getUploadRecords(projectId)
      const safeRecords = Array.isArray(records) ? records.map((r) => mapRecordToTask(r, t('uploadTaskManager.untitledTask'))) : []
      setTasks(safeRecords)
      setFilteredTasks(safeRecords)
    } catch (error: any) {
      message.error(t('uploadTaskManager.fetchFailed', { error: error.message || t('uploadTaskManager.unknownError') }))
      setTasks([])
      setFilteredTasks([])
    } finally {
      setLoading(false)
    }
  }

  // 重试失败的任务
  const retryTask = async (_taskId: string) => {
    message.info(t('uploadTaskManager.featureInDevelopment'), 3);
    return;

    // 原有代码已禁用
    try {
      // 这里需要调用重试API
      message.success(t('uploadTaskManager.retryStarted'))
      fetchTasks() // 刷新列表
    } catch (error: any) {
      message.error(t('uploadTaskManager.retryFailed', { error: error.message || t('uploadTaskManager.unknownError') }))
    }
  }

  // 取消进行中的任务
  const cancelTask = async (_taskId: string) => {
    message.info(t('uploadTaskManager.featureInDevelopment'), 3);
    return;

    // 原有代码已禁用
    try {
      // 这里需要调用取消API
      message.success(t('uploadTaskManager.taskCancelled'))
      fetchTasks() // 刷新列表
    } catch (error: any) {
      message.error(t('uploadTaskManager.cancelFailed', { error: error.message || t('uploadTaskManager.unknownError') }))
    }
  }

  // 查看任务详情
  const showTaskDetail = (task: UploadTask) => {
    setSelectedTask(task)
    setDetailModalVisible(true)
  }

  // 应用筛选条件
  const applyFilters = () => {
    const safeTasks = Array.isArray(tasks) ? tasks : []
    let filtered = safeTasks

    if (filters.status) {
      filtered = filtered.filter(task => task.status === filters.status)
    }

    if (filters.accountId) {
      filtered = filtered.filter(task => task.account_id === filters.accountId)
    }

    if (filters.keyword) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(filters.keyword.toLowerCase()) ||
        task.description.toLowerCase().includes(filters.keyword.toLowerCase())
      )
    }

    if (filters.dateRange && filters.dateRange.length === 2) {
      const startDate = filters.dateRange[0].startOf('day')
      const endDate = filters.dateRange[1].endOf('day')
      filtered = filtered.filter(task => {
        const taskDate = dayjs(task.created_at)
        return taskDate.isAfter(startDate) && taskDate.isBefore(endDate)
      })
    }

    setFilteredTasks(filtered)
  }

  // 重置筛选条件
  const resetFilters = () => {
    setFilters({
      status: '',
      accountId: '',
      dateRange: null,
      keyword: ''
    })
    setFilteredTasks(Array.isArray(tasks) ? tasks : [])
  }

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'orange'
      case 'processing':
        return 'blue'
      case 'success':
        return 'green'
      case 'failed':
        return 'red'
      default:
        return 'default'
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined />
      case 'processing':
        return <ExclamationCircleOutlined />
      case 'success':
        return <CheckCircleOutlined />
      case 'failed':
        return <CloseCircleOutlined />
      default:
        return null
    }
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return t('uploadTaskManager.statusPending')
      case 'processing':
        return t('uploadTaskManager.statusProcessing')
      case 'success':
        return t('uploadTaskManager.statusSuccess')
      case 'failed':
        return t('uploadTaskManager.statusFailed')
      default:
        return status
    }
  }

  // 计算统计数据
  const getStatistics = () => {
    const safeTasks = Array.isArray(tasks) ? tasks : []
    const total = safeTasks.length
    const pending = safeTasks.filter(t => t.status === 'pending').length
    const processing = safeTasks.filter(t => t.status === 'processing').length
    const success = safeTasks.filter(t => t.status === 'success').length
    const failed = safeTasks.filter(t => t.status === 'failed').length

    return { total, pending, processing, success, failed }
  }

  useEffect(() => {
    fetchTasks()
  }, [projectId])

  useEffect(() => {
    applyFilters()
  }, [filters, tasks])

  const columns = [
    {
      title: t('uploadTaskManager.columnTaskInfo'),
      key: 'task_info',
      render: (record: UploadTask) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.title}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {t('uploadTaskManager.projectIdPrefix')}{record.project_id.slice(0, 8)}...
          </div>
        </div>
      )
    },
    {
      title: t('uploadTaskManager.columnClipCount'),
      key: 'clip_count',
      render: (record: UploadTask) => {
        const clipCount = record.clip_id.split(',').filter(id => id.trim()).length
        return <Tag>{t('uploadTaskManager.clipsCount', { count: clipCount })}</Tag>
      }
    },
    {
      title: t('uploadTaskManager.columnPartition'),
      key: 'partition',
      render: (record: UploadTask) => {
        const partition = BILIBILI_PARTITIONS.find(p => p.id === record.partition_id)
        return partition ? partition.name : t('uploadTaskManager.partitionFallback', { partitionId: record.partition_id })
      }
    },
    {
      title: t('uploadTaskManager.columnStatus'),
      key: 'status',
      render: (record: UploadTask) => (
        <Tag color={getStatusColor(record.status)} icon={getStatusIcon(record.status)}>
          {getStatusText(record.status)}
        </Tag>
      )
    },
    {
      title: t('uploadTaskManager.columnProgress'),
      key: 'progress',
      render: (record: UploadTask) => {
        if (record.status === 'processing' && record.progress !== undefined) {
          return <Progress percent={record.progress} size="small" />
        } else if (record.status === 'success') {
          return <Progress percent={100} size="small" status="success" />
        } else if (record.status === 'failed') {
          return <Progress percent={0} size="small" status="exception" />
        }
        return <Progress percent={0} size="small" />
      }
    },
    {
      title: t('uploadTaskManager.columnCreatedAt'),
      key: 'created_at',
      render: (record: UploadTask) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm')
    },
    {
      title: t('uploadTaskManager.columnActions'),
      key: 'actions',
      render: (record: UploadTask) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showTaskDetail(record)}
          >
            {t('uploadTaskManager.details')}
          </Button>

          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => retryTask(record.id)}
            >
              {t('common.retry')}
            </Button>
          )}

          {record.status === 'processing' && (
            <Popconfirm
              title={t('uploadTaskManager.confirmCancelTitle')}
              onConfirm={() => cancelTask(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
              >
                {t('common.cancel')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const stats = getStatistics()

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={4}>
          <Card>
            <Statistic title={t('uploadTaskManager.statTotal')} value={stats.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title={t('uploadTaskManager.statusPending')} value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title={t('uploadTaskManager.statusProcessing')} value={stats.processing} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title={t('uploadTaskManager.statusSuccess')} value={stats.success} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title={t('uploadTaskManager.statusFailed')} value={stats.failed} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title={t('uploadTaskManager.statSuccessRate')}
              value={stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Form.Item label={t('uploadTaskManager.columnStatus')} style={{ marginBottom: 0 }}>
              <Select
                placeholder={t('uploadTaskManager.selectStatusPlaceholder')}
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                allowClear
              >
                <Option value="pending">{t('uploadTaskManager.statusPending')}</Option>
                <Option value="processing">{t('uploadTaskManager.statusProcessing')}</Option>
                <Option value="success">{t('uploadTaskManager.statusSuccess')}</Option>
                <Option value="failed">{t('uploadTaskManager.statusFailed')}</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={t('uploadTaskManager.dateRangeLabel')} style={{ marginBottom: 0 }}>
              <RangePicker
                value={filters.dateRange}
                onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
                placeholder={[t('uploadTaskManager.startDatePlaceholder'), t('uploadTaskManager.endDatePlaceholder')]}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={t('uploadTaskManager.keywordLabel')} style={{ marginBottom: 0 }}>
              <Input
                placeholder={t('uploadTaskManager.keywordPlaceholder')}
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Space>
              <Button type="primary" onClick={applyFilters}>
                {t('uploadTaskManager.filterButton')}
              </Button>
              <Button onClick={resetFilters}>
                {t('uploadTaskManager.resetButton')}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={fetchTasks}>
                {t('common.retry')}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 任务列表 */}
      <Card title={t('uploadTaskManager.taskListTitle', { count: filteredTasks.length })}>
        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => t('uploadTaskManager.paginationTotal', { from: range[0], to: range[1], total })
          }}
        />
      </Card>

      {/* 任务详情弹窗 */}
      <Modal
        title={t('uploadTaskManager.details')}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            {t('common.close')}
          </Button>
        ]}
        width={800}
      >
        {selectedTask && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <div><strong>{t('uploadTaskManager.detailTaskId')}</strong> {selectedTask.id}</div>
                <div><strong>{t('uploadTaskManager.detailProjectId')}</strong> {selectedTask.project_id}</div>
                <div><strong>{t('uploadTaskManager.detailTitle')}</strong> {selectedTask.title}</div>
                <div><strong>{t('uploadTaskManager.detailDescription')}</strong> {selectedTask.description}</div>
              </Col>
              <Col span={12}>
                <div><strong>{t('uploadTaskManager.detailStatus')}</strong>
                  <Tag color={getStatusColor(selectedTask.status)} style={{ marginLeft: 8 }}>
                    {getStatusText(selectedTask.status)}
                  </Tag>
                </div>
                <div><strong>{t('uploadTaskManager.detailPartition')}</strong>
                  {(() => {
                    const partition = BILIBILI_PARTITIONS.find(p => p.id === selectedTask.partition_id)
                    return partition ? partition.name : t('uploadTaskManager.partitionFallback', { partitionId: selectedTask.partition_id })
                  })()}
                </div>
                <div><strong>{t('uploadTaskManager.detailCreatedAt')}</strong> {dayjs(selectedTask.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                <div><strong>{t('uploadTaskManager.detailUpdatedAt')}</strong> {dayjs(selectedTask.updated_at).format('YYYY-MM-DD HH:mm:ss')}</div>
              </Col>
            </Row>

            <Divider />

            <div>
              <strong>{t('uploadTaskManager.detailClipInfo')}</strong>
              <div style={{ marginTop: 8 }}>
                {selectedTask.clip_id.split(',').filter(id => id.trim()).map((clipId, index) => (
                  <Tag key={index} style={{ marginBottom: 4 }}>{clipId.trim()}</Tag>
                ))}
              </div>
            </div>

            {selectedTask.tags && (
              <>
                <Divider />
                <div>
                  <strong>{t('uploadTaskManager.detailTags')}</strong>
                  <div style={{ marginTop: 8 }}>
                    {JSON.parse(selectedTask.tags).map((tag: string, index: number) => (
                      <Tag key={index} color="blue">{tag}</Tag>
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedTask.bvid && (
              <>
                <Divider />
                <div>
                  <strong>{t('uploadTaskManager.detailBvId')}</strong> {selectedTask.bvid}
                </div>
              </>
            )}

            {selectedTask.error_message && (
              <>
                <Divider />
                <div>
                  <strong>{t('uploadTaskManager.detailErrorMessage')}</strong>
                  <div style={{ marginTop: 8, color: '#ff4d4f', backgroundColor: '#fff2f0', padding: 8, borderRadius: 4 }}>
                    {selectedTask.error_message}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default UploadTaskManager



