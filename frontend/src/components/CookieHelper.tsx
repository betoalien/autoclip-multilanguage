import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Steps, Card, Typography, Alert, Button, Space, Divider } from 'antd'
import { QuestionCircleOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'

const { Paragraph, Text } = Typography
const { Step } = Steps

interface CookieHelperProps {
  visible: boolean
  onClose: () => void
}

const CookieHelper: React.FC<CookieHelperProps> = ({ visible, onClose }) => {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(0)
  const [copied, setCopied] = useState(false)

  const steps = [
    {
      title: t('bilibili.cookieHelper.step1Title'),
      description: t('bilibili.cookieHelper.step1Description'),
      content: (
        <div>
          <Alert
            message={t('bilibili.cookieHelper.step1AlertTitle')}
            description={t('bilibili.cookieHelper.step1AlertDescription')}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              {t('bilibili.cookieHelper.step1Line1')} <Text code>https://www.bilibili.com</Text>
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step1Line2')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step1Line3')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step1Line4')}
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: t('bilibili.cookieHelper.step2Title'),
      description: t('bilibili.cookieHelper.step2Description'),
      content: (
        <div>
          <Alert
            message={t('bilibili.cookieHelper.step2AlertTitle')}
            description={t('bilibili.cookieHelper.step2AlertDescription')}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              <Text strong>Windows/Linux:</Text> {t('bilibili.cookieHelper.step2WindowsKey')} <Text code>F12</Text> {t('bilibili.cookieHelper.step2KeySuffix')}
            </Paragraph>
            <Paragraph>
              <Text strong>Mac:</Text> {t('bilibili.cookieHelper.step2MacKey')} <Text code>Command + Option + I</Text>
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step2AltMethod')}
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              {t('bilibili.cookieHelper.step2Hint')}
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: t('bilibili.cookieHelper.step3Title'),
      description: t('bilibili.cookieHelper.step3Description'),
      content: (
        <div>
          <Alert
            message={t('bilibili.cookieHelper.step3AlertTitle')}
            description={t('bilibili.cookieHelper.step3AlertDescription')}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              {t('bilibili.cookieHelper.step3Line1')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step3Line2Prefix')} <Text code>Network</Text> {t('bilibili.cookieHelper.step3Line2Suffix')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step3Line3')}
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              {t('bilibili.cookieHelper.step3Hint')}
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: t('bilibili.cookieHelper.step4Title'),
      description: t('bilibili.cookieHelper.step4Description'),
      content: (
        <div>
          <Alert
            message={t('bilibili.cookieHelper.step4AlertTitle')}
            description={t('bilibili.cookieHelper.step4AlertDescription')}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              {t('bilibili.cookieHelper.step4Line1')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step4Line2Prefix')} <Text code>F5</Text> {t('bilibili.cookieHelper.step4Line2Suffix')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step4Line3')}
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              {t('bilibili.cookieHelper.step4Hint')}
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: t('bilibili.cookieHelper.step5Title'),
      description: t('bilibili.cookieHelper.step5Description'),
      content: (
        <div>
          <Alert
            message={t('bilibili.cookieHelper.step5AlertTitle')}
            description={t('bilibili.cookieHelper.step5AlertDescription')}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              {t('bilibili.cookieHelper.step5Line1')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step5Line2Prefix')} <Text code>Headers</Text> {t('bilibili.cookieHelper.step5Line2Suffix')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step5Line3Prefix')} <Text code>Request Headers</Text> {t('bilibili.cookieHelper.step5Line3Middle')} <Text code>Cookie</Text> {t('bilibili.cookieHelper.step5Line3Suffix')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step5Line4')}
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              {t('bilibili.cookieHelper.step5Hint')}
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: t('bilibili.cookieHelper.step6Title'),
      description: t('bilibili.cookieHelper.step6Description'),
      content: (
        <div>
          <Alert
            message={t('bilibili.cookieHelper.step6AlertTitle')}
            description={t('bilibili.cookieHelper.step6AlertDescription')}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              {t('bilibili.cookieHelper.step6Line1')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step6Line2')}
            </Paragraph>
            <Paragraph>
              {t('bilibili.cookieHelper.step6Line3Prefix')} <Text code>Ctrl+C</Text> {t('bilibili.cookieHelper.step6Line3Suffix')}
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              {t('bilibili.cookieHelper.step6Hint')}
            </Paragraph>
            <Alert
              message={t('bilibili.cookieHelper.step6WarningTitle')}
              description={t('bilibili.cookieHelper.step6WarningDescription')}
              type="warning"
              showIcon
            />
          </Card>
        </div>
      )
    }
  ]

  const handleCopy = () => {
    const cookieExample = "SESSDATA=your_sessdata_here; bili_jct=your_bili_jct_here; DedeUserID=your_dedeuserid_here"
    navigator.clipboard.writeText(cookieExample).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal
      title={
        <Space>
          <QuestionCircleOutlined />
          <span>{t('bilibili.cookieHelper.modalTitle')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose}>
          {t('common.close')}
        </Button>,
        <Button
          key="copy"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
        >
          {copied ? t('bilibili.cookieHelper.copied') : t('bilibili.cookieHelper.copyExample')}
        </Button>
      ]}
      width={700}
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message={t('bilibili.cookieHelper.safestMethodTitle')}
          description={t('bilibili.cookieHelper.safestMethodDescription')}
          type="success"
          showIcon
        />
      </div>

      <Steps current={currentStep} onChange={setCurrentStep} direction="vertical" size="small">
        {steps.map((step, index) => (
          <Step key={index} title={step.title} description={step.description} />
        ))}
      </Steps>

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
        {steps[currentStep].content}
      </div>

      <Divider />

      <Card size="small" title={t('bilibili.cookieHelper.formatExampleTitle')}>
        <Paragraph code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
          SESSDATA=your_sessdata_here; bili_jct=your_bili_jct_here; DedeUserID=your_dedeuserid_here; buvid3=your_buvid3_here
        </Paragraph>
        <Paragraph type="secondary" style={{ fontSize: '12px' }}>
          {t('bilibili.cookieHelper.formatExampleNote')}
        </Paragraph>
      </Card>
    </Modal>
  )
}

export default CookieHelper
