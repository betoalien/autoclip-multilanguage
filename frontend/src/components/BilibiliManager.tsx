import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, Form, Input, Table, Tag, Space, message, Popconfirm, Tabs, Alert, Typography, Select, Row, Col, Tooltip, Progress, Descriptions, Statistic, Card } from 'antd'
import { PlusOutlined, DeleteOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined, UploadOutlined, QuestionCircleOutlined, ReloadOutlined, EyeOutlined, RedoOutlined, StopOutlined, ExclamationCircleOutlined, ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { uploadApi, BilibiliAccount, BILIBILI_PARTITIONS, UploadRecord } from '../services/uploadApi'
import './BilibiliManager.css'

const { TextArea } = Input
const { Text } = Typography
const { Option } = Select
const { TabPane } = Tabs

interface BilibiliManagerProps {
  visible: boolean
  onClose: () => void
  projectId?: string
  clipIds?: string[]
  clipTitles?: string[]
  onUploadSuccess?: () => void
}

const BilibiliManager: React.FC<BilibiliManagerProps> = ({
  visible,
  onClose,
  projectId,
  clipIds = [],
  clipTitles = [],
  onUploadSuccess
}) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('upload')
  const [accounts, setAccounts] = useState<BilibiliAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [cookieForm] = Form.useForm()
  const [uploadForm] = Form.useForm()
  
  // 投稿状态相关状态
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<UploadRecord | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  // 获取账号列表
  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const data = await uploadApi.getAccounts()
      setAccounts(data)
    } catch (error: any) {
      message.error(t('bilibili.manager.fetchAccountsFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  // 获取投稿记录
  const fetchUploadRecords = async () => {
    try {
      setRecordsLoading(true)
      const data = await uploadApi.getUploadRecords()
      setUploadRecords(data)
    } catch (error: any) {
      message.error(t('bilibili.manager.fetchRecordsFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    } finally {
      setRecordsLoading(false)
    }
  }

  // 重试投稿
  const handleRetry = async (recordId: string | number) => {
    try {
      await uploadApi.retryUpload(recordId)
      message.success(t('bilibili.manager.retrySubmitted'))
      fetchUploadRecords()
    } catch (error: any) {
      message.error(t('bilibili.manager.retryFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    }
  }

  // 取消投稿
  const handleCancel = async (recordId: string | number) => {
    try {
      await uploadApi.cancelUpload(recordId)
      message.success(t('bilibili.manager.taskCancelled'))
      fetchUploadRecords()
    } catch (error: any) {
      message.error(t('bilibili.manager.cancelFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    }
  }

  // 删除投稿
  const handleDelete = async (recordId: string | number) => {
    try {
      await uploadApi.deleteUpload(recordId)
      message.success(t('bilibili.manager.taskDeleted'))
      fetchUploadRecords()
    } catch (error: any) {
      message.error(t('bilibili.manager.deleteFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    }
  }

  // 查看详情
  const handleViewDetail = (record: UploadRecord) => {
    setSelectedRecord(record)
    setDetailModalVisible(true)
  }

  useEffect(() => {
    if (visible) {
      fetchAccounts()
      fetchUploadRecords()
      // 如果有切片数据，默认显示上传标签页
      if (clipIds.length > 0) {
        setActiveTab('upload')
      } else {
        setActiveTab('accounts')
      }
    }
  }, [visible, clipIds])

  // Cookie导入登录
  const handleCookieLogin = async (values: any) => {
    try {
      setLoading(true)
      
      // 解析Cookie字符串
      const cookieStr = values.cookies.trim()
      const cookies: Record<string, string> = {}
      
      cookieStr.split(';').forEach((cookie: string) => {
        const trimmedCookie = cookie.trim()
        const equalIndex = trimmedCookie.indexOf('=')
        if (equalIndex > 0) {
          const key = trimmedCookie.substring(0, equalIndex).trim()
          const value = trimmedCookie.substring(equalIndex + 1).trim()
          if (key && value) {
            cookies[key] = value
          }
        }
      })
      
      if (Object.keys(cookies).length === 0) {
        message.error(t('bilibili.manager.cookieFormatInvalid'))
        return
      }

      await uploadApi.cookieLogin(cookies, values.nickname)
      message.success(t('bilibili.manager.addAccountSuccess'))
      setShowAddAccount(false)
      cookieForm.resetFields()
      fetchAccounts()
    } catch (error: any) {
      message.error(t('bilibili.manager.addAccountFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  // 删除账号
  const handleDeleteAccount = async (accountId: string) => {
    try {
      await uploadApi.deleteAccount(accountId)
      message.success(t('bilibili.manager.deleteAccountSuccess'))
      fetchAccounts()
    } catch (error: any) {
      message.error(t('bilibili.manager.deleteAccountFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    }
  }

  // 提交上传
  const handleUpload = async (values: any) => {
    // 显示开发中提示
    message.info(t('bilibili.manager.uploadFeatureInDevelopment'), 3)
    return

    // 原有代码已禁用
    if (!projectId || clipIds.length === 0) {
      message.error(t('bilibili.manager.noClipsSelected'))
      return
    }

    try {
      setLoading(true)
      
      const uploadData = {
        account_id: values.account_id,
        clip_ids: clipIds,
        title: values.title,
        description: values.description || '',
        tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()) : [],
        partition_id: values.partition_id
      }

      // 调用上传API
      const response = await fetch(`/api/v1/upload/projects/${projectId}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      })

      if (response.ok) {
        message.success(t('bilibili.manager.uploadTaskCreated'))
        onUploadSuccess?.()
        onClose()
      } else {
        const error = await response.json()
        message.error(t('bilibili.manager.uploadFailed', { reason: error.detail || t('bilibili.manager.unknownError') }))
      }
    } catch (error: any) {
      message.error(t('bilibili.manager.uploadFailed', { reason: error.message || t('bilibili.manager.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: t('bilibili.manager.statusPending') },
      processing: { color: 'processing', icon: <PlayCircleOutlined />, text: t('bilibili.manager.statusProcessing') },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: t('common.success') },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: t('bilibili.manager.statusCompleted') },
      failed: { color: 'error', icon: <ExclamationCircleOutlined />, text: t('common.failed') },
      cancelled: { color: 'default', icon: <StopOutlined />, text: t('bilibili.manager.statusCancelled') }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  // 获取分区名称
  const getPartitionName = (partitionId: number) => {
    const partition = BILIBILI_PARTITIONS.find(p => p.id === partitionId)
    return partition ? partition.name : t('bilibili.manager.partitionFallback', { id: partitionId })
  }

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // 格式化时长
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return t('bilibili.manager.durationHoursMinutes', { hours, minutes })
    } else if (minutes > 0) {
      return t('bilibili.manager.durationMinutesSeconds', { minutes, seconds: secs })
    } else {
      return t('bilibili.manager.durationSeconds', { seconds: secs })
    }
  }

  // 获取统计信息
  const getStatistics = () => {
    const safeRecords = Array.isArray(uploadRecords) ? uploadRecords : []
    const total = safeRecords.length
    const success = safeRecords.filter(r => r.status === 'success' || r.status === 'completed').length
    const failed = safeRecords.filter(r => r.status === 'failed').length
    const processing = safeRecords.filter(r => r.status === 'processing').length
    const pending = safeRecords.filter(r => r.status === 'pending').length
    
    return { total, success, failed, processing, pending }
  }

  // Cookie获取指南内容
  const cookieGuideContent = (
    <div style={{ maxWidth: 300 }}>
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('bilibili.manager.cookieGuideTitle')}</div>
      <ol style={{ margin: 0, paddingLeft: 16 }}>
        <li>{t('bilibili.manager.cookieGuideStep1')}</li>
        <li>{t('bilibili.manager.cookieGuideStep2')}</li>
        <li>{t('bilibili.manager.cookieGuideStep3')}</li>
        <li>{t('bilibili.manager.cookieGuideStep4')}</li>
        <li>{t('bilibili.manager.cookieGuideStep5')}</li>
        <li>{t('bilibili.manager.cookieGuideStep6')}</li>
        <li>{t('bilibili.manager.cookieGuideStep7')}</li>
      </ol>
    </div>
  )

  // 账号管理表格列
  const accountColumns = [
    {
      title: t('bilibili.manager.columnNickname'),
      dataIndex: 'nickname',
      key: 'nickname',
      render: (nickname: string, record: BilibiliAccount) => (
        <Space>
          <UserOutlined />
          <span>{nickname || record.username}</span>
        </Space>
      ),
    },
    {
      title: t('bilibili.manager.columnUsername'),
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: t('bilibili.manager.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'} icon={status === 'active' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {status === 'active' ? t('bilibili.manager.statusActive') : t('bilibili.manager.statusInactive')}
        </Tag>
      ),
    },
    {
      title: t('bilibili.manager.columnAction'),
      key: 'action',
      render: (_: any, record: BilibiliAccount) => (
        <Popconfirm
          title={t('bilibili.manager.confirmDeleteAccountTitle')}
          description={t('bilibili.manager.confirmDeleteAccountDescription')}
          onConfirm={() => handleDeleteAccount(record.id)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ]

  // 投稿状态表格列
  const uploadStatusColumns = [
    {
      title: t('bilibili.manager.columnTaskId'),
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string | number) => <Text code>{id}</Text>
    },
    {
      title: t('bilibili.manager.columnTitle'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string) => (
        <Tooltip title={title}>
          <Text>{title}</Text>
        </Tooltip>
      )
    },
    {
      title: t('bilibili.manager.columnUploadAccount'),
      dataIndex: 'account_nickname',
      key: 'account_nickname',
      width: 120,
      render: (nickname: string, record: UploadRecord) => (
        <div>
          <div>{nickname || record.account_username}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.account_username}
          </Text>
        </div>
      )
    },
    {
      title: t('bilibili.manager.columnPartition'),
      dataIndex: 'partition_id',
      key: 'partition_id',
      width: 100,
      render: (partitionId: number) => (
        <Tag>{getPartitionName(partitionId)}</Tag>
      )
    },
    {
      title: t('bilibili.manager.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: t('bilibili.manager.columnProgress'),
      dataIndex: 'progress',
      key: 'progress',
      width: 120,
      render: (progress: number, record: UploadRecord) => {
        if (record.status === 'success' || record.status === 'completed') {
          return <Progress percent={100} size="small" status="success" />
        } else if (record.status === 'failed') {
          return <Progress percent={progress} size="small" status="exception" />
        } else if (record.status === 'processing') {
          return <Progress percent={progress} size="small" status="active" />
        } else {
          return <Progress percent={progress} size="small" />
        }
      }
    },
    {
      title: t('bilibili.manager.columnFileSize'),
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (fileSize: number) => <span>{formatFileSize(fileSize)}</span>
    },
    {
      title: t('bilibili.manager.columnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => <span>{new Date(date).toLocaleString()}</span>
    },
    {
      title: t('bilibili.manager.columnAction'),
      key: 'actions',
      width: 200,
      render: (_: any, record: UploadRecord) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            size="small"
          >
            {t('bilibili.manager.details')}
          </Button>
          {record.status === 'failed' && (
            <Popconfirm
              title={t('bilibili.manager.confirmRetryTitle')}
              onConfirm={() => handleRetry(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button
                type="link"
                icon={<RedoOutlined />}
                size="small"
              >
                {t('common.retry')}
              </Button>
            </Popconfirm>
          )}
          {(record.status === 'pending' || record.status === 'processing') && (
            <Popconfirm
              title={t('bilibili.manager.confirmCancelTitle')}
              onConfirm={() => handleCancel(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button
                type="link"
                icon={<StopOutlined />}
                danger
                size="small"
              >
                {t('bilibili.manager.cancelAction')}
              </Button>
            </Popconfirm>
          )}
          {(record.status === 'success' || record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') && (
            <Popconfirm
              title={t('bilibili.manager.confirmDeleteTaskTitle')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button
                type="link"
                icon={<DeleteOutlined />}
                danger
                size="small"
              >
                {t('common.delete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
      className="bilibili-manager-modal"
    >
      {/* 自定义标题栏 */}
      <div className="bilibili-manager-header">
        <div className="bilibili-manager-header-icon">
          <UploadOutlined />
        </div>
        <div className="bilibili-manager-header-content">
          <h2 className="bilibili-manager-header-title">{t('bilibili.manager.headerTitle')}</h2>
          <p className="bilibili-manager-header-subtitle">
            {clipIds.length > 0
              ? t('bilibili.manager.readyToUploadClips', { count: clipIds.length })
              : t('bilibili.manager.headerSubtitle')
            }
          </p>
        </div>
      </div>

      <div className="bilibili-manager-tabs">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* 上传标签页 */}
        {clipIds.length > 0 && (
          <TabPane 
            tab={
              <span>
                <UploadOutlined />
                {t('bilibili.manager.tabUpload')}
              </span>
            }
            key="upload"
          >
            <div className="bilibili-manager-content">
              <Alert
                message={t('bilibili.manager.uploadInfoTitle')}
                description={t('bilibili.manager.readyToUploadClips', { count: clipIds.length })}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form
              form={uploadForm}
              onFinish={handleUpload}
              layout="vertical"
              initialValues={{
                title: clipTitles.length === 1 ? clipTitles[0] : t('bilibili.manager.multiClipTitle', { title: clipTitles[0], count: clipIds.length }),
                partition_id: 4 // 默认游戏分区
              }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label={t('bilibili.manager.selectAccountLabel')}
                    name="account_id"
                    rules={[{ required: true, message: t('bilibili.manager.selectAccountRequired') }]}
                  >
                    <Select
                      placeholder={t('bilibili.manager.selectAccountPlaceholder')}
                      notFoundContent={
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <p>{t('bilibili.manager.noAccountsAvailable')}</p>
                          <Button
                            type="link"
                            icon={<PlusOutlined />}
                            onClick={() => setShowAddAccount(true)}
                          >
                            {t('bilibili.manager.addAccount')}
                          </Button>
                        </div>
                      }
                    >
                      {(accounts || []).filter(acc => acc.status === 'active').map(account => (
                        <Option key={account.id} value={account.id}>
                          {account.nickname || account.username}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label={t('bilibili.manager.videoPartitionLabel')}
                    name="partition_id"
                    rules={[{ required: true, message: t('bilibili.manager.videoPartitionRequired') }]}
                  >
                    <Select placeholder={t('bilibili.manager.videoPartitionPlaceholder')} showSearch>
                      {BILIBILI_PARTITIONS.map(partition => (
                        <Option key={partition.id} value={partition.id}>
                          {partition.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={t('bilibili.manager.titleLabel')}
                name="title"
                rules={[{ required: true, message: t('bilibili.manager.titleRequired') }]}
              >
                <Input placeholder={t('bilibili.manager.titlePlaceholder')} maxLength={80} showCount />
              </Form.Item>

              <Form.Item
                label={t('bilibili.manager.descriptionLabel')}
                name="description"
              >
                <TextArea
                  placeholder={t('bilibili.manager.descriptionPlaceholder')}
                  rows={3}
                  maxLength={2000}
                  showCount
                />
              </Form.Item>

              <Form.Item
                label={t('bilibili.manager.tagsLabel')}
                name="tags"
              >
                <Input placeholder={t('bilibili.manager.tagsPlaceholder')} />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    onClick={() => message.info(t('bilibili.manager.inDevelopment'), 3)}
                    icon={<UploadOutlined />}
                  >
                    {t('bilibili.manager.startUpload')}
                  </Button>
                  <Button onClick={onClose}>
                    {t('common.cancel')}
                  </Button>
                </Space>
              </Form.Item>
              </Form>
            </div>
          </TabPane>
        )}

        {/* 账号管理标签页 */}
        <TabPane
          tab={
            <span>
              <UserOutlined />
              {t('bilibili.manager.tabAccounts')}
            </span>
          }
          key="accounts"
        >
          <div className="bilibili-manager-content">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowAddAccount(true)}
              >
                {t('bilibili.manager.addAccount')}
              </Button>
            </div>

            <Table
              columns={accountColumns}
              dataSource={accounts}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
            />
          </div>
        </TabPane>

        {/* 投稿状态标签页 */}
        <TabPane 
          tab={
            <span>
              <ReloadOutlined />
              {t('bilibili.manager.tabStatus')}
            </span>
          }
          key="status"
        >
          <div className="bilibili-manager-content">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#ffffff' }}>{t('bilibili.manager.uploadTaskStatusTitle')}</h3>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={fetchUploadRecords}
                loading={recordsLoading}
              >
                {t('common.retry')}
              </Button>
            </div>

            {/* 统计信息 */}
            {(() => {
              const stats = getStatistics()
              return (
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card style={{ background: '#262626', border: '1px solid #404040' }}>
                      <Statistic
                        title={<span style={{ color: '#ffffff' }}>{t('bilibili.manager.statTotalTasks')}</span>}
                        value={stats.total}
                        valueStyle={{ color: '#ffffff' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card style={{ background: '#262626', border: '1px solid #404040' }}>
                      <Statistic
                        title={<span style={{ color: '#ffffff' }}>{t('common.success')}</span>}
                        value={stats.success}
                        valueStyle={{ color: '#52c41a' }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card style={{ background: '#262626', border: '1px solid #404040' }}>
                      <Statistic
                        title={<span style={{ color: '#ffffff' }}>{t('common.failed')}</span>}
                        value={stats.failed}
                        valueStyle={{ color: '#ff4d4f' }}
                        prefix={<ExclamationCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card style={{ background: '#262626', border: '1px solid #404040' }}>
                      <Statistic
                        title={<span style={{ color: '#ffffff' }}>{t('bilibili.manager.statInProgress')}</span>}
                        value={stats.processing + stats.pending}
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<PlayCircleOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>
              )
            })()}

            {/* 任务列表 */}
            <Table
              columns={uploadStatusColumns}
              dataSource={uploadRecords}
              rowKey="id"
              loading={recordsLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => t('bilibili.manager.paginationTotal', { from: range[0], to: range[1], total })
              }}
              scroll={{ x: 1200 }}
              size="small"
            />
          </div>
        </TabPane>
      </Tabs>
      </div>

      {/* 添加账号弹窗 */}
      <Modal
        title={t('bilibili.manager.addAccountModalTitle')}
        open={showAddAccount}
        onCancel={() => {
          setShowAddAccount(false)
          cookieForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Alert
          message={t('bilibili.manager.recommendCookieTitle')}
          description={t('bilibili.manager.recommendCookieDescription')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={cookieForm} onFinish={handleCookieLogin} layout="vertical">
          <Form.Item
            name="nickname"
            label={t('bilibili.manager.accountNicknameLabel')}
            rules={[{ required: true, message: t('bilibili.manager.accountNicknameRequired') }]}
          >
            <Input placeholder={t('bilibili.manager.accountNicknamePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="cookies"
            label={
              <Space>
                <span>Cookie</span>
                <Tooltip title={cookieGuideContent} placement="topLeft">
                  <Button
                    type="link"
                    size="small"
                    icon={<QuestionCircleOutlined />}
                  >
                    {t('bilibili.manager.getGuide')}
                  </Button>
                </Tooltip>
              </Space>
            }
            rules={[
              { required: true, message: t('bilibili.manager.cookieRequired') },
              { min: 10, message: t('bilibili.manager.cookieMinLength') }
            ]}
          >
            <TextArea
              rows={4}
              placeholder={t('bilibili.manager.cookiePlaceholder')}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t('bilibili.manager.addAccount')}
              </Button>
              <Button onClick={() => setShowAddAccount(false)}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 投稿状态详情模态框 */}
      <Modal
        title={t('bilibili.manager.taskDetailModalTitle')}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
        className="bilibili-manager-modal"
      >
        {selectedRecord && (
          <div>
            <Descriptions 
              column={2} 
              bordered
              labelStyle={{ 
                background: '#1f1f1f', 
                color: '#ffffff',
                fontWeight: 'bold',
                borderRight: '1px solid #303030'
              }}
              contentStyle={{ 
                background: '#262626', 
                color: '#ffffff',
                borderLeft: '1px solid #303030'
              }}
              style={{ 
                background: '#262626',
                border: '1px solid #303030'
              }}
            >
              <Descriptions.Item label={t('bilibili.manager.columnTaskId')} span={1}>
                <Text code>{selectedRecord.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.columnStatus')} span={1}>
                {getStatusTag(selectedRecord.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.columnTitle')} span={2}>
                <Text>{selectedRecord.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.columnUploadAccount')} span={1}>
                <Text>{selectedRecord.account_nickname || selectedRecord.account_username}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.columnPartition')} span={1}>
                <Tag>{getPartitionName(selectedRecord.partition_id)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.projectNameLabel')} span={1}>
                <Text>{selectedRecord.project_name || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.clipIdLabel')} span={1}>
                <Text code>{selectedRecord.clip_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.columnProgress')} span={2}>
                <Progress
                  percent={selectedRecord.progress}
                  status={
                    selectedRecord.status === 'failed' ? 'exception' :
                    selectedRecord.status === 'success' || selectedRecord.status === 'completed' ? 'success' :
                    selectedRecord.status === 'processing' ? 'active' : 'normal'
                  }
                />
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.columnFileSize')} span={1}>
                <Text>{formatFileSize(selectedRecord.file_size)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.uploadDurationLabel')} span={1}>
                <Text>{formatDuration(selectedRecord.upload_duration)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.bvIdLabel')} span={1}>
                {selectedRecord.bv_id ? <Text code>{selectedRecord.bv_id}</Text> : <Text>-</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.avIdLabel')} span={1}>
                {selectedRecord.av_id ? <Text code>{selectedRecord.av_id}</Text> : <Text>-</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.columnCreatedAt')} span={1}>
                <Text>{new Date(selectedRecord.created_at).toLocaleString()}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('bilibili.manager.updatedAtLabel')} span={1}>
                <Text>{new Date(selectedRecord.updated_at).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>

            {selectedRecord.description && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ color: '#ffffff' }}>{t('bilibili.manager.descriptionLabel')}</h4>
                <Text>{selectedRecord.description}</Text>
              </div>
            )}

            {selectedRecord.tags && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ color: '#ffffff' }}>{t('bilibili.manager.tagsLabel')}</h4>
                <Text>{selectedRecord.tags}</Text>
              </div>
            )}

            {selectedRecord.error_message && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ color: '#ffffff' }}>{t('bilibili.manager.errorMessageLabel')}</h4>
                <Alert
                  message={t('bilibili.manager.uploadFailedTitle')}
                  description={selectedRecord.error_message}
                  type="error"
                  showIcon
                />
              </div>
            )}

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <Space>
                {selectedRecord.status === 'failed' && (
                  <Popconfirm
                    title={t('bilibili.manager.confirmRetryTitle')}
                    onConfirm={() => {
                      handleRetry(selectedRecord.id)
                      setDetailModalVisible(false)
                    }}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                  >
                    <Button type="primary" icon={<RedoOutlined />}>
                      {t('common.retry')}
                    </Button>
                  </Popconfirm>
                )}
                <Button onClick={() => setDetailModalVisible(false)}>
                  {t('common.close')}
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  )
}

export default BilibiliManager
