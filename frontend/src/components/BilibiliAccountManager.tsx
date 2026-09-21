import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Button, Modal, Form, Input, Table, Tag, Space, message, Popconfirm, Tabs, Alert, Typography, Divider, Tooltip, Statistic } from 'antd'
import { PlusOutlined, DeleteOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined, QrcodeOutlined, ExclamationCircleOutlined, QuestionCircleOutlined, HeartOutlined, TrophyOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { uploadApi, BilibiliAccount } from '../services/uploadApi'
import CookieHelper from './CookieHelper'
import AccountHealthMonitor from './AccountHealthMonitor'

const { TextArea } = Input
const { Text, Paragraph } = Typography
const { TabPane } = Tabs

interface AccountHealth {
  score: number
  status: 'excellent' | 'good' | 'warning' | 'poor'
  lastActive: string
  uploadCount: number
  successRate: number
}

const BilibiliAccountManager: React.FC = () => {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<BilibiliAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('cookie')
  const [cookieHelperVisible, setCookieHelperVisible] = useState(false)
  const [accountsHealth, setAccountsHealth] = useState<Record<string, AccountHealth>>({})
  const [refreshing, setRefreshing] = useState(false)
  
  // 表单相关状态
  const [passwordForm] = Form.useForm()
  const [cookieForm] = Form.useForm()
  const [qrSessionId, setQrSessionId] = useState<string>('')
  const [qrLoginStatus, setQrLoginStatus] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [statusCheckInterval, setStatusCheckInterval] = useState<number | null>(null)

  // 获取账号列表
  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const data = await uploadApi.getAccounts()
      setAccounts(data)
      // 同时获取账号健康状态
      await fetchAccountsHealth(data)
    } catch (error: any) {
      message.error(t('bilibili.accountManager.fetchAccountsFailed', { reason: error.message || t('bilibili.accountManager.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  // 获取账号健康状态
  const fetchAccountsHealth = async (accountList?: BilibiliAccount[]) => {
    try {
      const targetAccounts = accountList || accounts
      const healthData: Record<string, AccountHealth> = {}
      
      for (const account of targetAccounts) {
        // 模拟健康状态数据，实际应该从API获取
        const score = Math.floor(Math.random() * 40) + 60 // 60-100分
        const uploadCount = Math.floor(Math.random() * 50) + 10
        const successRate = Math.floor(Math.random() * 30) + 70
        
        let status: AccountHealth['status'] = 'good'
        if (score >= 90) status = 'excellent'
        else if (score >= 75) status = 'good'
        else if (score >= 60) status = 'warning'
        else status = 'poor'
        
        healthData[account.id] = {
          score,
          status,
          lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          uploadCount,
          successRate
        }
      }
      
      setAccountsHealth(healthData)
    } catch (error: any) {
      console.error('获取账号健康状态失败:', error)
    }
  }

  // 刷新账号健康状态
  const refreshAccountsHealth = async () => {
    try {
      setRefreshing(true)
      await fetchAccountsHealth()
      message.success(t('bilibili.accountManager.healthRefreshed'))
    } catch (error: any) {
      message.error(t('bilibili.accountManager.refreshFailed', { reason: error.message || t('bilibili.accountManager.unknownError') }))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
    
    // 清理定时器
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval)
      }
    }
  }, [])

  // 账号密码登录
  const handlePasswordLogin = async (values: any) => {
    try {
      setLoading(true)
      await uploadApi.passwordLogin(values.username, values.password, values.nickname)
      message.success(t('bilibili.accountManager.passwordLoginSuccess'))
      setModalVisible(false)
      passwordForm.resetFields()
      fetchAccounts()
    } catch (error: any) {
      message.error(t('bilibili.accountManager.passwordLoginFailed', { reason: error.message || t('bilibili.accountManager.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  // Cookie导入登录
  const handleCookieLogin = async (values: any) => {
    try {
      setLoading(true)
      
      // 解析Cookie字符串
      const cookieStr = values.cookies.trim()
      const cookies: Record<string, string> = {}
      
      cookieStr.split(';').forEach((cookie: string) => {
        const [key, value] = cookie.trim().split('=')
        if (key && value) {
          cookies[key] = value
        }
      })
      
      if (Object.keys(cookies).length === 0) {
        message.error(t('bilibili.accountManager.cookieFormatInvalid'))
        return
      }

      await uploadApi.cookieLogin(cookies, values.nickname)
      message.success(t('bilibili.accountManager.cookieImportSuccess'))
      setModalVisible(false)
      cookieForm.resetFields()
      fetchAccounts()
    } catch (error: any) {
      message.error(t('bilibili.accountManager.cookieImportFailed', { reason: error.message || t('bilibili.accountManager.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  // 开始二维码登录
  const startQRLogin = async (nickname?: string) => {
    try {
      setLoading(true)
      
      // 清除之前的轮询
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval)
        setStatusCheckInterval(null)
      }
      
      const response = await uploadApi.startQRLogin(nickname)
      setQrSessionId(response.session_id)
      setQrLoginStatus(response.status)
      
      // 开始轮询登录状态
      let pollCount = 0
      const maxPolls = 60
      
      const interval = window.setInterval(async () => {
        try {
          pollCount++
          if (pollCount > maxPolls) {
            message.error(t('bilibili.accountManager.qrLoginTimeout'))
            setQrSessionId('')
            setQrLoginStatus('')
            setQrCodeUrl('')
            clearInterval(interval)
            return
          }
          
          const statusResponse = await uploadApi.checkQRLoginStatus(response.session_id)
          setQrLoginStatus(statusResponse.status)
          
          if (statusResponse.qr_code) {
            setQrCodeUrl(statusResponse.qr_code)
          }
          
          if (statusResponse.status === 'success') {
            message.success(t('bilibili.accountManager.qrLoginSuccess'))
            clearInterval(interval)
            setModalVisible(false)
            fetchAccounts()
          } else if (statusResponse.status === 'failed') {
            message.error(t('bilibili.accountManager.qrLoginFailed'))
            clearInterval(interval)
          }
        } catch (error: any) {
          console.error('检查登录状态失败:', error)
        }
      }, 1000)

      setStatusCheckInterval(interval)

    } catch (error: any) {
      message.error(t('bilibili.accountManager.qrLoginStartFailed', { reason: error.message || t('bilibili.accountManager.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  // 删除账号
  const handleDeleteAccount = async (accountId: string) => {
    try {
      await uploadApi.deleteAccount(accountId)
      message.success(t('bilibili.accountManager.deleteSuccess'))
      fetchAccounts()
    } catch (error: any) {
      message.error(t('bilibili.accountManager.deleteFailed', { reason: error.message || t('bilibili.accountManager.unknownError') }))
    }
  }

  // 获取健康状态标签和颜色
  const getHealthStatusTag = (health?: AccountHealth) => {
    if (!health) return <Tag>{t('bilibili.accountManager.healthUnknown')}</Tag>

    const statusConfig = {
      excellent: { color: 'green', text: t('bilibili.accountManager.healthExcellent'), icon: <TrophyOutlined /> },
      good: { color: 'blue', text: t('bilibili.accountManager.healthGood'), icon: <CheckCircleOutlined /> },
      warning: { color: 'orange', text: t('bilibili.accountManager.healthWarning'), icon: <ExclamationCircleOutlined /> },
      poor: { color: 'red', text: t('bilibili.accountManager.healthPoor'), icon: <CloseCircleOutlined /> }
    }

    const config = statusConfig[health.status]
    return (
      <Tooltip title={t('bilibili.accountManager.healthScoreTooltip', { score: health.score })}>
        <Tag color={config.color} icon={config.icon}>
          {config.text} ({health.score})
        </Tag>
      </Tooltip>
    )
  }

  // 格式化最后活跃时间
  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return t('bilibili.accountManager.today')
    if (diffDays === 1) return t('bilibili.accountManager.yesterday')
    if (diffDays < 7) return t('bilibili.accountManager.daysAgo', { count: diffDays })
    return date.toLocaleDateString()
  }

  const columns = [
    {
      title: t('bilibili.accountManager.columnUsername'),
      dataIndex: 'username',
      key: 'username',
      render: (username: string) => (
        <Space>
          <UserOutlined />
          <span>{username}</span>
        </Space>
      ),
    },
    {
      title: t('bilibili.accountManager.columnNickname'),
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: t('bilibili.accountManager.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'} icon={status === 'active' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {status === 'active' ? t('bilibili.accountManager.statusActive') : t('bilibili.accountManager.statusInactive')}
        </Tag>
      ),
    },
    {
      title: t('bilibili.accountManager.columnHealth'),
      key: 'health',
      render: (_: any, record: BilibiliAccount) => getHealthStatusTag(accountsHealth[record.id]),
    },
    {
      title: t('bilibili.accountManager.columnActivity'),
      key: 'activity',
      render: (_: any, record: BilibiliAccount) => {
        const health = accountsHealth[record.id]
        if (!health) return '-'

        return (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EyeOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontSize: '12px' }}>{t('bilibili.accountManager.uploadsLabel', { count: health.uploadCount })}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartOutlined style={{ color: '#52c41a' }} />
              <span style={{ fontSize: '12px' }}>{t('bilibili.accountManager.successRateLabel', { rate: health.successRate })}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              {t('bilibili.accountManager.lastActiveLabel', { time: formatLastActive(health.lastActive) })}
            </div>
          </Space>
        )
      },
    },
    {
      title: t('bilibili.accountManager.columnAction'),
      key: 'action',
      render: (_: any, record: BilibiliAccount) => (
        <Space size="middle">
          <Tooltip title={t('bilibili.accountManager.viewDetails')}>
            <Button type="text" icon={<EyeOutlined />} size="small">
              {t('bilibili.accountManager.details')}
            </Button>
          </Tooltip>
          <Popconfirm
            title={t('bilibili.accountManager.confirmDeleteTitle')}
            description={t('bilibili.accountManager.confirmDeleteDescription')}
            onConfirm={() => handleDeleteAccount(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small">
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 计算总体统计数据
  const getTotalStats = () => {
    const safeAccounts = Array.isArray(accounts) ? accounts : []
    const totalAccounts = safeAccounts.length
    const activeAccounts = safeAccounts.filter(acc => acc.status === 'active').length
    const healthScores = Object.values(accountsHealth).map(h => h.score)
    const avgHealth = healthScores.length > 0 ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : 0
    const excellentCount = Object.values(accountsHealth).filter(h => h.status === 'excellent').length
    
    return { totalAccounts, activeAccounts, avgHealth, excellentCount }
  }

  const stats = getTotalStats()

  return (
    <div>
      <Tabs
        defaultActiveKey="accounts"
        items={[
          {
            key: 'accounts',
            label: (
              <span>
                <UserOutlined />
                {t('bilibili.accountManager.tabAccounts')}
              </span>
            ),
            children: (
              <div>
                {/* 统计卡片 */}
                <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <Card size="small">
                    <Statistic
                      title={t('bilibili.accountManager.statTotalAccounts')}
                      value={stats.totalAccounts}
                      prefix={<UserOutlined />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                  <Card size="small">
                    <Statistic
                      title={t('bilibili.accountManager.statActiveAccounts')}
                      value={stats.activeAccounts}
                      suffix={`/ ${stats.totalAccounts}`}
                      prefix={<CheckCircleOutlined />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                  <Card size="small">
                    <Statistic
                      title={t('bilibili.accountManager.statAvgHealth')}
                      value={stats.avgHealth}
                      suffix={t('bilibili.accountManager.pointsSuffix')}
                      prefix={<HeartOutlined />}
                      valueStyle={{ color: stats.avgHealth >= 80 ? '#52c41a' : stats.avgHealth >= 60 ? '#faad14' : '#ff4d4f' }}
                    />
                  </Card>
                  <Card size="small">
                    <Statistic
                      title={t('bilibili.accountManager.statExcellentAccounts')}
                      value={stats.excellentCount}
                      prefix={<TrophyOutlined />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </div>

                <Card
                  title={t('bilibili.accountManager.cardTitle')}
                  extra={
                    <Space>
                      <Tooltip title={t('bilibili.accountManager.refreshHealthTooltip')}>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={refreshAccountsHealth}
                          loading={refreshing}
                          size="small"
                        >
                          {t('common.retry')}
                        </Button>
                      </Tooltip>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                        {t('bilibili.accountManager.addAccount')}
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    columns={columns}
                    dataSource={accounts}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => t('bilibili.accountManager.paginationTotal', { from: range[0], to: range[1], total })
                    }}
                    scroll={{ x: 800 }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'health',
            label: (
              <span>
                <HeartOutlined />
                {t('bilibili.accountManager.tabHealthMonitor')}
              </span>
            ),
            children: <AccountHealthMonitor onRefresh={fetchAccounts} />,
          },
        ]}
      />

      <Modal
        title={t('bilibili.accountManager.addAccountModalTitle')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setQrSessionId('')
          setQrLoginStatus('')
          setQrCodeUrl('')
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval)
            setStatusCheckInterval(null)
          }
        }}
        footer={null}
        width={600}
      >
        <Alert
          message={t('bilibili.accountManager.loginMethodInfoTitle')}
          description={t('bilibili.accountManager.loginMethodInfoDescription')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={t('bilibili.accountManager.tabCookieImport')} key="cookie">
            <Form form={cookieForm} onFinish={handleCookieLogin} layout="vertical">
              <Form.Item
                name="nickname"
                label={t('bilibili.accountManager.nicknameLabel')}
                rules={[{ required: true, message: t('bilibili.accountManager.nicknameRequired') }]}
              >
                <Input placeholder={t('bilibili.accountManager.nicknamePlaceholder')} />
              </Form.Item>

                             <Form.Item
                 name="cookies"
                 label={
                   <Space>
                     <span>Cookie</span>
                     <Button
                       type="link"
                       size="small"
                       icon={<QuestionCircleOutlined />}
                       onClick={() => setCookieHelperVisible(true)}
                     >
                       {t('bilibili.accountManager.getHelp')}
                     </Button>
                   </Space>
                 }
                 rules={[{ required: true, message: t('bilibili.accountManager.cookieRequired') }]}
               >
                 <TextArea
                   rows={6}
                   placeholder={t('bilibili.accountManager.cookiePlaceholder')}
                 />
               </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  {t('bilibili.accountManager.importCookie')}
                </Button>
              </Form.Item>
            </Form>

                         <Divider />
             <Paragraph type="secondary" style={{ fontSize: '12px' }}>
               <Text strong>{t('bilibili.accountManager.quickCookieTitle')}</Text>
               <br />
               {t('bilibili.accountManager.quickCookieHint')}
             </Paragraph>
          </TabPane>

          <TabPane tab={t('bilibili.accountManager.tabPassword')} key="password">
            <Form form={passwordForm} onFinish={handlePasswordLogin} layout="vertical">
              <Form.Item
                name="username"
                label={t('bilibili.accountManager.usernameLabel')}
                rules={[{ required: true, message: t('bilibili.accountManager.usernameRequired') }]}
              >
                <Input placeholder={t('bilibili.accountManager.usernamePlaceholder')} />
              </Form.Item>

              <Form.Item
                name="password"
                label={t('bilibili.accountManager.passwordLabel')}
                rules={[{ required: true, message: t('bilibili.accountManager.passwordRequired') }]}
              >
                <Input.Password placeholder={t('bilibili.accountManager.passwordPlaceholder')} />
              </Form.Item>

              <Form.Item
                name="nickname"
                label={t('bilibili.accountManager.nicknameLabel')}
                rules={[{ required: true, message: t('bilibili.accountManager.nicknameRequired') }]}
              >
                <Input placeholder={t('bilibili.accountManager.nicknamePlaceholder')} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  {t('bilibili.accountManager.loginButton')}
                </Button>
              </Form.Item>
            </Form>

            <Alert
              message={t('bilibili.accountManager.noteTitle')}
              description={t('bilibili.accountManager.passwordLoginNote')}
              type="warning"
              showIcon
            />
          </TabPane>

          <TabPane tab={t('bilibili.accountManager.tabQrLogin')} key="qr">
            <div style={{ textAlign: 'center' }}>
              {!qrSessionId ? (
                <div>
                  <Form.Item label={t('bilibili.accountManager.nicknameLabel')}>
                    <Input placeholder={t('bilibili.accountManager.nicknameOptionalPlaceholder')} />
                  </Form.Item>
                  <Button
                    type="primary"
                    icon={<QrcodeOutlined />}
                    onClick={() => startQRLogin()}
                    loading={loading}
                    block
                  >
                    {t('bilibili.accountManager.startQrLogin')}
                  </Button>
                </div>
              ) : (
                <div>
                  {qrCodeUrl && (
                    <div style={{ marginBottom: '16px' }}>
                      <img src={qrCodeUrl} alt={t('bilibili.accountManager.qrCodeAlt')} style={{ maxWidth: '200px' }} />
                    </div>
                  )}

                  {qrLoginStatus === 'pending' && (
                    <p>{t('bilibili.accountManager.qrGenerating')}</p>
                  )}

                  {qrLoginStatus === 'processing' && (
                    <p>{t('bilibili.accountManager.qrScanPrompt')}</p>
                  )}

                  {qrLoginStatus === 'success' && (
                    <p style={{ color: '#52c41a' }}>✅ {t('bilibili.accountManager.qrLoginSuccessInline')}</p>
                  )}

                  {qrLoginStatus === 'failed' && (
                    <p style={{ color: '#ff4d4f' }}>❌ {t('bilibili.accountManager.qrLoginFailedInline')}</p>
                  )}
                </div>
              )}
            </div>

            <Alert
              message={t('bilibili.accountManager.riskWarningTitle')}
              description={t('bilibili.accountManager.qrRiskDescription')}
              type="error"
              showIcon
            />
          </TabPane>
        </Tabs>
      </Modal>

      <CookieHelper 
        visible={cookieHelperVisible}
        onClose={() => setCookieHelperVisible(false)}
      />
    </div>
  )
 }

export default BilibiliAccountManager
