import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Tag, Space, Typography } from 'antd'
import { BILIBILI_PARTITIONS } from '../services/uploadApi'

const { Text } = Typography

interface UploadToBilibiliProps {
  partitionId?: number
}

const UploadToBilibili: React.FC<UploadToBilibiliProps> = ({ partitionId }) => {
  const { t } = useTranslation()
  // 获取分区名称
  const getPartitionName = (id: number) => {
    const partition = BILIBILI_PARTITIONS.find(p => p.id === id)
    return partition ? partition.name : t('bilibili.uploadInfo.unknownPartition')
  }

  return (
    <Card
      title={
        <Space>
          <span>{t('bilibili.uploadInfo.title')}</span>
          {partitionId && (
            <Tag color="blue">{t('bilibili.uploadInfo.currentPartition', { name: getPartitionName(partitionId) })}</Tag>
          )}
        </Space>
      }
      size="small"
      style={{ marginBottom: '16px' }}
    >
      <div>
        <Text type="secondary">
          {t('bilibili.uploadInfo.supportedTypes')}
        </Text>
        <div style={{ marginTop: '12px' }}>
          <Text strong>{t('bilibili.uploadInfo.partitionIdLabel')} </Text>
          <Text code>{partitionId || t('bilibili.uploadInfo.notSet')}</Text>
        </div>
      </div>
    </Card>
  )
}

export default UploadToBilibili

