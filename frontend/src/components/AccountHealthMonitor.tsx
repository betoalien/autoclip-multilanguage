import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Tooltip,
  Progress,
  Modal,
  message,
  Statistic,
  Row,
  Col,
  Alert,
  Spin,
  Badge
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
// 移除date-fns依赖，使用内置方法

// 接口定义
interface AccountHealth {
  account_id: number;
  username: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details: {
    cookie?: {
      status: string;
      message: string;
      expires_in?: number;
    };
    login?: {
      status: string;
      message: string;
      user_info?: {
        uname: string;
        mid: number;
        level: number;
      };
    };
    upload?: {
      status: string;
      message: string;
    };
  };
  last_check: string;
  expires_in?: number;
}

interface HealthSummary {
  total_accounts: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  unknown_count: number;
  accounts: AccountHealth[];
  last_updated: string;
}

interface AccountHealthMonitorProps {
  onRefresh?: () => void;
}

const AccountHealthMonitor: React.FC<AccountHealthMonitorProps> = () => {
  const { t } = useTranslation();
  const [healthData, setHealthData] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<number[]>([]);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountHealth | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // 时间格式化函数
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return t('account.justNow');
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return t('account.minutesAgo', { count: minutes });
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return t('account.hoursAgo', { count: hours });
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return t('account.daysAgo', { count: days });
    }
  };

  // 获取健康状态摘要
  const fetchHealthSummary = async (forceCheck = false) => {
    try {
      setLoading(true);
      const endpoint = forceCheck ? '/health/check' : '/health/summary';
      const method = forceCheck ? 'POST' : 'GET';
      const body = forceCheck ? JSON.stringify({ force_check: true }) : undefined;
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setHealthData(data);
      
      if (forceCheck) {
        message.success(t('account.healthCheckComplete'));
      }
    } catch (error) {
      console.error('获取健康状态失败:', error);
      message.error(t('account.fetchHealthFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 检查单个账号
  const checkSingleAccount = async (accountId: number, forceCheck = true) => {
    try {
      setRefreshing(prev => [...prev, accountId]);
      
      const response = await fetch(`/api/v1/health/check/${accountId}?force_check=${forceCheck}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const updatedAccount = await response.json();
      
      // 更新健康数据
      setHealthData(prev => {
        if (!prev) return prev;
        
        const updatedAccounts = prev.accounts.map(account => 
          account.account_id === accountId ? updatedAccount : account
        );
        
        // 重新计算统计数据
        const statusCounts = {
          healthy: 0,
          warning: 0,
          critical: 0,
          unknown: 0
        };
        
        updatedAccounts.forEach(account => {
          statusCounts[account.status as keyof typeof statusCounts]++;
        });
        
        return {
          ...prev,
          accounts: updatedAccounts,
          healthy_count: statusCounts.healthy,
          warning_count: statusCounts.warning,
          critical_count: statusCounts.critical,
          unknown_count: statusCounts.unknown,
          last_updated: new Date().toISOString()
        };
      });
      
      message.success(t('account.accountCheckComplete', { username: updatedAccount.username }));
    } catch (error) {
      console.error('检查账号失败:', error);
      message.error(t('account.checkAccountFailed'));
    } finally {
      setRefreshing(prev => prev.filter(id => id !== accountId));
    }
  };

  // 刷新Cookie
  const refreshCookie = async (accountId: number) => {
    try {
      const response = await fetch('/health/refresh-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          auto_refresh: true
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        message.success(result.message);
      } else {
        message.warning(result.message);
      }
    } catch (error) {
      console.error('刷新Cookie失败:', error);
      message.error(t('account.refreshCookieFailed'));
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      healthy: { color: 'success', icon: <CheckCircleOutlined />, text: t('account.healthy') },
      warning: { color: 'warning', icon: <ExclamationCircleOutlined />, text: t('account.warningStatus') },
      critical: { color: 'error', icon: <CloseCircleOutlined />, text: t('account.critical') },
      unknown: { color: 'default', icon: <QuestionCircleOutlined />, text: t('account.unknownStatus') }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取过期时间进度条
  const getExpirationProgress = (expiresIn?: number) => {
    if (expiresIn === undefined || expiresIn === null) {
      return null;
    }
    
    const totalDays = 30; // 假设Cookie总有效期为30天
    const percentage = Math.max(0, Math.min(100, (expiresIn / totalDays) * 100));
    
    let status: 'success' | 'normal' | 'exception' = 'success';
    if (expiresIn <= 0) {
      status = 'exception';
    } else if (expiresIn <= 7) {
      status = 'normal';
    }
    
    return (
      <Tooltip title={t('account.expiresInDays', { days: expiresIn })}>
        <Progress
          percent={percentage}
          status={status}
          size="small"
          showInfo={false}
          strokeWidth={6}
        />
      </Tooltip>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: t('account.account'),
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: AccountHealth) => (
        <Space>
          <span>{username}</span>
          {record.details.login?.user_info && (
            <Tooltip title={t('account.levelTooltip', { level: record.details.login.user_info.level })}>
              <Badge count={record.details.login.user_info.level} color="blue" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t('account.healthStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: t('account.cookieStatus'),
      key: 'cookie_status',
      render: (record: AccountHealth) => (
        <Space direction="vertical" size="small">
          {getStatusTag(record.details.cookie?.status || 'unknown')}
          {getExpirationProgress(record.expires_in)}
        </Space>
      ),
    },
    {
      title: t('account.lastCheck'),
      dataIndex: 'last_check',
      key: 'last_check',
      render: (lastCheck: string) => (
        <Tooltip title={new Date(lastCheck).toLocaleString()}>
          <Space>
            <ClockCircleOutlined />
            {getTimeAgo(lastCheck)}
          </Space>
        </Tooltip>
      ),
    },
    {
      title: t('account.actions'),
      key: 'actions',
      render: (record: AccountHealth) => (
        <Space>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            loading={refreshing.includes(record.account_id)}
            onClick={() => checkSingleAccount(record.account_id)}
          >
            {t('account.check')}
          </Button>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelectedAccount(record);
              setDetailsVisible(true);
            }}
          >
            {t('account.details')}
          </Button>
          {record.status === 'critical' || record.status === 'warning' ? (
            <Button
              type="text"
              danger
              onClick={() => refreshCookie(record.account_id)}
            >
              {t('account.refreshCookie')}
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  // 组件挂载时获取数据
  useEffect(() => {
    fetchHealthSummary();
  }, []);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      const interval = window.setInterval(() => {
        fetchHealthSummary();
      }, 60000); // 每分钟刷新一次
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('account.totalAccounts')}
              value={healthData?.total_accounts || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('account.healthyAccounts')}
              value={healthData?.healthy_count || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('account.warningAccounts')}
              value={healthData?.warning_count || 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('account.criticalIssues')}
              value={healthData?.critical_count || 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => fetchHealthSummary(true)}
          >
            {t('account.checkAll')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => fetchHealthSummary()}
          >
            {t('account.refreshStatus')}
          </Button>
          <Button
            type={autoRefresh ? 'primary' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? t('account.stopAutoRefresh') : t('account.startAutoRefresh')}
          </Button>
        </Space>

        {healthData?.last_updated && (
          <div style={{ float: 'right', color: '#666' }}>
            {t('account.lastUpdated', { time: getTimeAgo(healthData.last_updated) })}
          </div>
        )}
      </Card>

      {/* 警告信息 */}
      {healthData && (healthData.critical_count > 0 || healthData.warning_count > 0) && (
        <Alert
          message={t('account.healthWarningTitle')}
          description={t('account.healthWarningDesc', { critical: healthData.critical_count, warning: healthData.warning_count })}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 账号列表 */}
      <Card title={t('account.accountHealthStatus')}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={healthData?.accounts || []}
            rowKey="account_id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => t('account.totalCount', { total }),
            }}
          />
        </Spin>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={t('account.accountDetailTitle', { username: selectedAccount?.username })}
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsVisible(false)}>
            {t('common.close')}
          </Button>,
          <Button
            key="refresh"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => {
              if (selectedAccount) {
                checkSingleAccount(selectedAccount.account_id);
              }
            }}
          >
            {t('account.recheck')}
          </Button>,
        ]}
        width={600}
      >
        {selectedAccount && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Card title={t('account.basicInfo')} size="small">
                  <p><strong>{t('account.accountId')}</strong> {selectedAccount.account_id}</p>
                  <p><strong>{t('account.username')}</strong> {selectedAccount.username}</p>
                  <p><strong>{t('account.overallStatus')}</strong> {getStatusTag(selectedAccount.status)}</p>
                  <p><strong>{t('account.statusMessage')}</strong> {selectedAccount.message}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card title={t('account.checkTime')} size="small">
                  <p><strong>{t('account.lastCheck')}:</strong> {new Date(selectedAccount.last_check).toLocaleString()}</p>
                  {selectedAccount.expires_in !== undefined && (
                    <p><strong>{t('account.cookieExpiry')}</strong> {t('account.cookieExpiresIn', { days: selectedAccount.expires_in })}</p>
                  )}
                </Card>
              </Col>
            </Row>

            <Card title={t('account.detailStatus')} size="small" style={{ marginTop: 16 }}>
              {selectedAccount.details.cookie && (
                <div style={{ marginBottom: 12 }}>
                  <strong>{t('account.cookieStatus')}:</strong> {getStatusTag(selectedAccount.details.cookie.status)}
                  <p>{selectedAccount.details.cookie.message}</p>
                </div>
              )}

              {selectedAccount.details.login && (
                <div style={{ marginBottom: 12 }}>
                  <strong>{t('account.loginStatusLabel')}</strong> {getStatusTag(selectedAccount.details.login.status)}
                  <p>{selectedAccount.details.login.message}</p>
                  {selectedAccount.details.login.user_info && (
                    <p>{t('account.userInfoText', { uname: selectedAccount.details.login.user_info.uname, level: selectedAccount.details.login.user_info.level })}</p>
                  )}
                </div>
              )}

              {selectedAccount.details.upload && (
                <div>
                  <strong>{t('account.uploadPermissionLabel')}</strong> {getStatusTag(selectedAccount.details.upload.status)}
                  <p>{selectedAccount.details.upload.message}</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AccountHealthMonitor;