import { message } from 'antd'
import i18n from '../i18n'

export async function validateApiConfigBeforeProjectCreation(): Promise<boolean> {
  try {
    return true
  } catch (error) {
    console.error('API配置检查失败:', error)
    message.error(i18n.t('apiConfig.checkFailed') || 'API配置检查失败')
    return false
  }
}
