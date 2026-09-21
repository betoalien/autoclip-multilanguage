import React, { useState, useEffect, useMemo } from 'react'
import { Form, Input, Select, Switch, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { settingsApi } from '../services/api'
import SpeechRecognitionConfig from '../components/SpeechRecognitionConfig'
import FeedbackDialog from '../components/FeedbackDialog'
import { isDesktopMode } from '../utils/desktopMode'
import { openExternalLink } from '../utils/externalLinks'
import { trackApiKeyConfigured } from '../analytics/events'
import { isAnalyticsEnabled, setAnalyticsEnabled } from '../analytics/posthog'
import { getRuntimeInfo } from '../analytics/lifecycle'
import { FEEDBACK_FORM_URL, FEEDBACK_ISSUES_URL } from '../analytics/feedback'
import { useTheme } from '../context/ThemeContext'
import { Btn, Icon, Row, Section, Segmented, StatusDot } from '../ui'
import i18n from '../i18n'

const normalizeBaseUrl = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''

// 模型选择框是 mode="tags" 的 Select，用户手动输入后拿到的是数组；后端只接受字符串
const normalizeModelName = (value: unknown): string => {
  if (Array.isArray(value)) return String(value[value.length - 1] ?? '').trim()
  return typeof value === 'string' ? value.trim() : ''
}
const toNumber = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : fallback
}

type ProviderKey = 'dashscope' | 'openai' | 'gemini' | 'siliconflow' | 'ollama' | 'lmstudio'
type LocalPreset = { baseUrl: string; defaultModel: string; docsUrl: string; app: string }
const PROVIDERS: Record<ProviderKey, { name: string; short: string; hint: string; apiKeyField: string; placeholder: string; keyUrl: string; local?: LocalPreset }> = {
  get dashscope() { return { name: i18n.t('settings.providerDashscopeName'), short: i18n.t('settings.providerDashscopeShort'), hint: i18n.t('settings.providerDashscopeHint'), apiKeyField: 'dashscope_api_key', placeholder: 'sk-…', keyUrl: 'https://dashscope.console.aliyun.com/apiKey' } },
  get openai() { return { name: i18n.t('settings.providerOpenaiName'), short: i18n.t('settings.providerOpenaiShort'), hint: i18n.t('settings.providerOpenaiHint'), apiKeyField: 'openai_api_key', placeholder: i18n.t('settings.providerOpenaiPlaceholder'), keyUrl: 'https://platform.openai.com/api-keys' } },
  get gemini() { return { name: 'Google Gemini', short: 'Gemini', hint: i18n.t('settings.providerGeminiHint'), apiKeyField: 'gemini_api_key', placeholder: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey' } },
  get siliconflow() { return { name: i18n.t('settings.providerSiliconflowName'), short: i18n.t('settings.providerSiliconflowName'), hint: i18n.t('settings.providerSiliconflowHint'), apiKeyField: 'siliconflow_api_key', placeholder: 'sk-…', keyUrl: 'https://cloud.siliconflow.cn/account/ak' } },
  // 本地预设：底层是 openai 兼容 + base_url，后端 core/local_presets.py 负责还原；无需密钥、不花钱、离线可用
  get ollama() { return { name: 'Ollama', short: 'Ollama', hint: i18n.t('settings.providerOllamaHint'), apiKeyField: 'openai_api_key', placeholder: '', keyUrl: 'https://ollama.com/download', local: { baseUrl: 'http://localhost:11434/v1', defaultModel: 'qwen2.5:7b', docsUrl: 'https://ollama.com/download', app: 'Ollama' } } },
  get lmstudio() { return { name: 'LM Studio', short: 'LM Studio', hint: i18n.t('settings.providerLmstudioHint'), apiKeyField: 'openai_api_key', placeholder: '', keyUrl: 'https://lmstudio.ai', local: { baseUrl: 'http://localhost:1234/v1', defaultModel: '', docsUrl: 'https://lmstudio.ai', app: 'LM Studio' } } },
}
const isLocalProvider = (p: ProviderKey) => !!PROVIDERS[p]?.local

const CLOUD_DEFAULT_MODEL: Partial<Record<ProviderKey, string>> = {
  dashscope: 'qwen-plus', openai: 'gpt-4o-mini', gemini: 'gemini-2.5-flash', siliconflow: 'deepseek-ai/DeepSeek-V3',
}

type SectionKey = 'model' | 'speech' | 'app' | 'feedback'

// Calm Premium settings — left nav + setting rows (see DESIGN.md → App Layer)
const SettingsPage: React.FC = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const location = useLocation()

  const navItems = useMemo<Array<{ key: SectionKey; label: string }>>(() => [
    { key: 'model', label: t('settings.navModel') },
    { key: 'speech', label: t('settings.navSpeech') },
    { key: 'app', label: t('settings.navApp') },
    { key: 'feedback', label: t('settings.navFeedback') },
  ], [t])

  const modelGroups = useMemo<Array<{ label: string; models: string[] }>>(() => [
    { label: t('settings.providerDashscopeShort'), models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'] },
    { label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'] },
    { label: 'Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { label: t('settings.providerSiliconflowGroupLabel'), models: ['deepseek-ai/DeepSeek-V3', 'deepseek-chat', 'Qwen/Qwen2.5-72B-Instruct'] },
  ], [t])

  const initialSection = useMemo<SectionKey>(() => {
    const s = new URLSearchParams(location.search).get('section')
    return (navItems.find((n) => n.key === s)?.key as SectionKey) || 'model'
  }, [location.search, navItems])
  const [active, setActive] = useState<SectionKey>(initialSection)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [currentProvider, setCurrentProvider] = useState<any>({})
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>('dashscope')
  // 本地预设的模型探测：{ reachable, models } —— 让用户从下拉里选，而不是手敲 qwen2.5:7b
  const [localModels, setLocalModels] = useState<{ loading: boolean; reachable: boolean | null; models: string[] }>({ loading: false, reachable: null, models: [] })
  const [analyticsOn, setAnalyticsOn] = useState(isAnalyticsEnabled())
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const runtime = getRuntimeInfo()

  useEffect(() => { loadData() }, [])
  useEffect(() => { setActive(initialSection) }, [initialSection])

  const loadData = async () => {
    try {
      const isDesktop = await isDesktopMode()
      if (isDesktop) {
        const [settings, provider] = await Promise.allSettled([
          settingsApi.getSettings(),
          settingsApi.getCurrentProvider()
        ])
        const settingsData = settings.status === 'fulfilled' ? settings.value : {}
        const providerData = provider.status === 'fulfilled'
          ? provider.value
          : { available: false, provider: 'dashscope', display_name: t('settings.providerDashscopeName'), model: 'qwen-plus' }
        // 以 settings.json 里保存的提供商为准；旧配置没有该字段时退回后端上报的当前提供商
        let providerName = (settingsData.api?.api_provider || providerData.provider || 'dashscope') as ProviderKey
        const savedBaseUrl = settingsData.api?.api_base_url || ''
        if (providerName === 'openai' && savedBaseUrl.includes(':11434')) {
          providerName = 'ollama'
        } else if (providerName === 'openai' && savedBaseUrl.includes(':1234')) {
          providerName = 'lmstudio'
        }
        setCurrentProvider(providerData)
        const localPreset = PROVIDERS[providerName]?.local
        const effectiveLocalBaseUrl = savedBaseUrl || (localPreset ? localPreset.baseUrl : '')
        form.setFieldsValue({
          llm_provider: providerName,
          dashscope_api_key: settingsData.api?.api_keys?.dashscope || '',
          openai_api_key: settingsData.api?.api_keys?.openai || '',
          openai_base_url: localPreset ? '' : savedBaseUrl,
          local_base_url: effectiveLocalBaseUrl,
          gemini_api_key: settingsData.api?.api_keys?.gemini || '',
          siliconflow_api_key: settingsData.api?.api_keys?.siliconflow || '',
          jimeng_access_key: settingsData.api?.api_keys?.jimeng_access || '',
          jimeng_secret_key: settingsData.api?.api_keys?.jimeng_secret || '',
          model_name: settingsData.api?.api_model || 'qwen-plus',
          chunk_size: settingsData.processing?.processing_chunk_size || 5000,
          min_score_threshold: settingsData.processing?.processing_min_score || 0.7,
          max_clips_per_collection: settingsData.processing?.processing_max_clips || 5
        })
        const activeProvider = PROVIDERS[providerName] ? providerName : 'dashscope'
        setSelectedProvider(activeProvider)
        if (isLocalProvider(activeProvider)) {
          void detectLocalModels(activeProvider, effectiveLocalBaseUrl)
        }
      } else {
        // Web 模式：只展示默认值，不调用桌面 API
        form.setFieldsValue({ llm_provider: 'dashscope', model_name: 'qwen-plus', chunk_size: 5000, min_score_threshold: 0.7, max_clips_per_collection: 5 })
        setSelectedProvider('dashscope')
        setCurrentProvider({ available: false, provider: 'dashscope', display_name: t('settings.providerDashscopeName'), model: 'qwen-plus' })
      }
    } catch (err) {
      console.error('加载数据失败:', err)
    }
  }

  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      const isDesktop = await isDesktopMode()
      if (!isDesktop) {
        message.info(t('settings.webModeCannotSave'))
        return
      }
      // 先读现有配置，避免清空其它 provider 已保存的 key
      let existing: any = null
      try { existing = await settingsApi.getSettings() } catch (err) { console.warn('获取现有配置失败:', err) }
      const keys = existing?.api?.api_keys || {}
      const provider = (values.llm_provider || selectedProvider) as ProviderKey

      await settingsApi.updateSettings({
        basic: { app_name: 'AutoClip Desktop', app_version: runtime.version !== 'unknown' ? runtime.version : '1.0.0', debug_mode: false, auto_start: true },
        service: { host: '127.0.0.1', port: 8000, max_memory_usage: 2048 },
        api: {
          api_keys: {
            dashscope: values.dashscope_api_key || keys.dashscope || '',
            openai: values.openai_api_key || keys.openai || (isLocalProvider(provider) ? 'ollama' : ''),
            gemini: values.gemini_api_key || keys.gemini || '',
            siliconflow: values.siliconflow_api_key || keys.siliconflow || '',
            jimeng_access: values.jimeng_access_key || keys.jimeng_access || '',
            jimeng_secret: values.jimeng_secret_key || keys.jimeng_secret || ''
          },
          api_provider: provider,
          api_base_url: provider === 'openai'
            ? normalizeBaseUrl(values.openai_base_url)
            : isLocalProvider(provider) ? (normalizeBaseUrl(values.local_base_url) || PROVIDERS[provider]?.local?.baseUrl || '') : '',
          api_model: normalizeModelName(values.model_name) || 'qwen-plus',
          api_max_tokens: 4096,
          api_timeout: 60
        },
        processing: {
          processing_chunk_size: toNumber(values.chunk_size, 5000),
          processing_min_score: toNumber(values.min_score_threshold, 0.7),
          processing_max_clips: toNumber(values.max_clips_per_collection, 5),
          processing_max_retries: 3
        },
        logs: { log_level: 'INFO', log_retention_days: 7 }
        // paths 由后端根据实际数据目录决定，前端不下发
      })
      message.success(t('settings.saved'))
      trackApiKeyConfigured({ provider, hasKey: isLocalProvider(provider) || !!values[PROVIDERS[provider].apiKeyField] })
      await loadData()
    } catch (err: any) {
      message.error(t('settings.saveFailed', { reason: err.message || t('settings.unknownError') }))
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    const cfg = PROVIDERS[selectedProvider]
    const local = isLocalProvider(selectedProvider)
    const apiKey: string = local ? '' : (form.getFieldValue(cfg.apiKeyField) || '')
    const baseUrl = selectedProvider === 'openai'
      ? normalizeBaseUrl(form.getFieldValue('openai_base_url'))
      : local ? (normalizeBaseUrl(form.getFieldValue('local_base_url')) || cfg.local!.baseUrl) : ''
    const modelName = normalizeModelName(form.getFieldValue('model_name'))
    if (local && !modelName) {
      message.error(t('settings.selectModelFirst'))
      return
    }
    // 自建兼容服务（Ollama / vLLM 等）通常不需要 key，有地址就能测
    if (!apiKey.trim() && !baseUrl) {
      message.error(t('settings.fillApiKeyFirst'))
      return
    }
    try {
      setTesting(true)
      const r = await settingsApi.testApiKey(selectedProvider, apiKey, { baseUrl: baseUrl || undefined, model: modelName || undefined })
      if (r.success) message.success(t('settings.connectionOk'))
      else message.error(t('settings.connectionFailed', { reason: r.error || t('settings.unknownError') }))
    } catch (err: any) {
      message.error(t('settings.testFailed', { reason: err.message || t('settings.unknownError') }))
    } finally {
      setTesting(false)
    }
  }

  const detectLocalModels = async (p: ProviderKey, baseUrl?: string) => {
    const preset = PROVIDERS[p]?.local
    if (!preset) return
    setLocalModels((s) => ({ ...s, loading: true }))
    try {
      const r = await settingsApi.listCompatibleModels({ provider: p, baseUrl: normalizeBaseUrl(baseUrl) || undefined })
      setLocalModels({ loading: false, reachable: r.reachable, models: r.models || [] })
      // 探测到模型且当前没选 / 选的不在列表里 → 帮用户选一个（优先预设默认）
      const current = normalizeModelName(form.getFieldValue('model_name'))
      if (r.reachable && r.models.length && (!current || !r.models.includes(current))) {
        form.setFieldsValue({ model_name: r.models.includes(preset.defaultModel) ? preset.defaultModel : r.models[0] })
      }
    } catch {
      setLocalModels({ loading: false, reachable: false, models: [] })
    }
  }

  const handleProviderChange = (p: ProviderKey) => {
    const prev = selectedProvider
    setSelectedProvider(p)
    form.setFieldsValue({ llm_provider: p })
    const preset = PROVIDERS[p]?.local
    const current = normalizeModelName(form.getFieldValue('model_name'))
    if (preset) {
      // 从云端切到本地时，qwen-plus 这类云端模型名对本地服务没意义
      if (!current || modelGroups.some((g) => g.models.includes(current))) {
        form.setFieldsValue({ model_name: preset.defaultModel || undefined })
      }
      void detectLocalModels(p, form.getFieldValue('local_base_url'))
    } else if (isLocalProvider(prev) || !current) {
      // 从本地切回云端：qwen2.5:7b 这类本地模型名对云端没意义，给该提供商一个常用默认
      form.setFieldsValue({ model_name: CLOUD_DEFAULT_MODEL[p] })
    }
  }

  // 打开设置页时若已是本地预设，顺手探测一次
  useEffect(() => {
    if (isLocalProvider(selectedProvider)) void detectLocalModels(selectedProvider, form.getFieldValue('local_base_url'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider])

  const openaiBaseUrl = Form.useWatch('openai_base_url', form)
  const usingCustomEndpoint = selectedProvider === 'openai' && !!normalizeBaseUrl(openaiBaseUrl)
  const cfg = PROVIDERS[selectedProvider]
  const localCfg = cfg.local

  return (
    <div className="ac-page">
      <header>
        <h1 className="ac-title" style={{ marginTop: 0 }}>{t('settings.title')}</h1>
        <div className="ac-meta">
          <span className="ac-mono">{runtime.version !== 'unknown' ? `v${runtime.version}` : 'dev'}</span>
          <span className="dot" />
          <span className="ac-mono">{runtime.os}/{runtime.arch}</span>
          {currentProvider?.available && (
            <>
              <span className="dot" />
              <span>{t('settings.currentModel')} <span className="ac-mono">{currentProvider.provider} · {currentProvider.model}</span></span>
            </>
          )}
        </div>
      </header>

      <div className="ac-settings" style={{ marginTop: 36 }}>
        <nav className="ac-settings-nav" aria-label={t('settings.navAriaLabel')}>
          {navItems.map((n) => (
            <button key={n.key} aria-current={active === n.key} onClick={() => setActive(n.key)}>{n.label}</button>
          ))}
        </nav>

        <div className="ac-settings-body">
          {/* ---------------- 模型 ---------------- */}
          {active === 'model' && (
            <Section title={t('settings.navModel')} description={t('settings.modelSectionDescription')}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                requiredMark={false}
                initialValues={{ llm_provider: 'dashscope', model_name: 'qwen-plus', chunk_size: 5000, min_score_threshold: 0.7, max_clips_per_collection: 5 }}
              >
                <Form.Item name="llm_provider" hidden><Input /></Form.Item>
                <div className="ac-rows">
                  <Row label={t('settings.providerLabel')} hint={cfg.hint} stack>
                    <Segmented
                      size="sm"
                      ariaLabel={t('settings.providerLabel')}
                      value={selectedProvider}
                      onChange={handleProviderChange}
                      options={(Object.keys(PROVIDERS) as ProviderKey[]).map((k) => ({ value: k, label: PROVIDERS[k].short }))}
                    />
                  </Row>

                  {localCfg && (
                    <Row
                      wide
                      label={t('settings.serviceAddressLabel')}
                      hint={<>{t('settings.serviceAddressHintDefault')} <span className="ac-mono">{localCfg.baseUrl}</span>{t('settings.serviceAddressHintChanged')} <a href={localCfg.docsUrl} onClick={(e) => { e.preventDefault(); openExternalLink(localCfg.docsUrl) }} style={{ color: 'var(--ac-accent)' }}>{t('settings.appOfficialSite', { app: localCfg.app })}</a> {t('settings.download')}</>}
                    >
                      <Form.Item
                        name="local_base_url"
                        style={{ width: '100%' }}
                        rules={[{
                          validator: (_, value) => {
                            const url = normalizeBaseUrl(value)
                            if (!url || /^https?:\/\/\S+$/.test(url)) return Promise.resolve()
                            return Promise.reject(new Error(i18n.t('settings.urlValidationError')))
                          },
                        }]}
                      >
                        <Input
                          placeholder={localCfg.baseUrl}
                          allowClear
                          className="ac-mono"
                          onBlur={(e) => void detectLocalModels(selectedProvider, e.target.value)}
                        />
                      </Form.Item>
                    </Row>
                  )}

                  {selectedProvider === 'openai' && (
                    <Row
                      wide
                      label={t('settings.endpointAddressLabel')}
                      hint={<>{t('settings.endpointAddressHint')} <span className="ac-mono">https://api.deepseek.com/v1</span>, <span className="ac-mono">http://localhost:11434/v1</span> (Ollama).</>}
                    >
                      <Form.Item
                        name="openai_base_url"
                        style={{ width: '100%' }}
                        rules={[{
                          validator: (_, value) => {
                            const url = normalizeBaseUrl(value)
                            if (!url || /^https?:\/\/\S+$/.test(url)) return Promise.resolve()
                            return Promise.reject(new Error(i18n.t('settings.urlValidationError')))
                          },
                        }]}
                      >
                        <Input placeholder="https://api.openai.com/v1" allowClear className="ac-mono" />
                      </Form.Item>
                    </Row>
                  )}

                  {!localCfg && <Row
                    wide
                    label="API Key"
                    hint={usingCustomEndpoint
                      ? t('settings.apiKeyHintCustomEndpoint')
                      : <>{t('settings.apiKeyHintGetFrom')} <a href={cfg.keyUrl} onClick={(e) => { e.preventDefault(); openExternalLink(cfg.keyUrl) }} style={{ color: 'var(--ac-accent)' }}>{t('settings.providerConsole', { provider: cfg.name })}</a> {t('settings.apiKeyHintObtain')}</>}
                  >
                    <Form.Item
                      name={cfg.apiKeyField}
                      style={{ width: '100%' }}
                      rules={usingCustomEndpoint ? [] : [
                        { required: true, message: t('settings.apiKeyRequired') },
                        { min: 10, message: t('settings.apiKeyMinLength') }
                      ]}
                    >
                      <Input.Password placeholder={cfg.placeholder} className="ac-mono" />
                    </Form.Item>
                  </Row>}

                  <Row
                    wide
                    label={t('settings.modelLabel')}
                    hint={localCfg
                      ? (localModels.loading
                          ? t('settings.detectingLocalService')
                          : localModels.reachable
                            ? <>{t('settings.connectedModelsFound', { count: localModels.models.length })}<a onClick={() => void detectLocalModels(selectedProvider, form.getFieldValue('local_base_url'))} style={{ color: 'var(--ac-accent)', cursor: 'pointer' }}>{t('settings.refresh')}</a></>
                            : localModels.reachable === false
                              ? <>{t('settings.notConnectedTo', { app: localCfg.app })}{localCfg.defaultModel ? <>{t('settings.andRun')} <span className="ac-mono">ollama pull {localCfg.defaultModel}</span></> : ''}{t('settings.thenRetryDetect')} <a onClick={() => void detectLocalModels(selectedProvider, form.getFieldValue('local_base_url'))} style={{ color: 'var(--ac-accent)', cursor: 'pointer' }}>{t('settings.redetect')}</a>{t('settings.orTypeModelName')}</>
                              : t('settings.selectFromLocalModels'))
                      : usingCustomEndpoint
                        ? t('settings.modelHintCustomEndpoint')
                        : t('settings.modelHintDefault')}
                  >
                    <Form.Item name="model_name" style={{ width: '100%' }} rules={[{ required: true, message: t('settings.modelRequired') }]}>
                      <Select
                        placeholder={localCfg ? (localCfg.defaultModel || t('settings.modelPlaceholder')) : 'qwen-plus'}
                        showSearch
                        allowClear
                        mode="tags"
                        maxCount={1}
                        loading={localCfg ? localModels.loading : false}
                        className="ac-mono"
                        options={(localCfg
                          ? localModels.models.map((m) => ({ value: m, label: m }))
                          : modelGroups.map((g) => ({ label: g.label, options: g.models.map((m) => ({ value: m, label: m })) }))) as any}
                      />
                    </Form.Item>
                  </Row>

                  <Row label={t('settings.connectionTestLabel')} hint={localCfg ? t('settings.connectionTestHintLocal') : t('settings.connectionTestHintCloud')}>
                    <Btn size="sm" loading={testing} onClick={handleTest}>{t('settings.testConnection')}</Btn>
                  </Row>
                </div>

                <div className="ac-eyebrow" style={{ marginTop: 40, marginBottom: 12 }}>{t('settings.clipParams')}</div>
                <div className="ac-rows">
                  <Row label={t('settings.chunkSizeLabel')} hint={t('settings.chunkSizeHint')}>
                    <Form.Item name="chunk_size">
                      <input className="ac-input ac-input--mono" type="number" min={1000} step={500} style={{ width: 120, textAlign: 'right' }} />
                    </Form.Item>
                    <span className="ac-unit">{t('settings.characters')}</span>
                  </Row>
                  <Row label={t('settings.minScoreLabel')} hint={t('settings.minScoreHint')}>
                    <Form.Item name="min_score_threshold">
                      <input className="ac-input ac-input--mono" type="number" min={0} max={1} step={0.05} style={{ width: 120, textAlign: 'right' }} />
                    </Form.Item>
                    <span className="ac-unit" />
                  </Row>
                  <Row label={t('settings.maxClipsLabel')} hint={t('settings.maxClipsHint')}>
                    <Form.Item name="max_clips_per_collection">
                      <input className="ac-input ac-input--mono" type="number" min={1} max={20} style={{ width: 120, textAlign: 'right' }} />
                    </Form.Item>
                    <span className="ac-unit">{t('settings.clipsUnit')}</span>
                  </Row>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 28 }}>
                  {currentProvider?.available && (
                    <StatusDot tone="ok" label={<>{t('settings.configured')} <span className="ac-mono">{(PROVIDERS[currentProvider.provider as ProviderKey]?.short || currentProvider.provider)} · {currentProvider.model}</span></>} />
                  )}
                  <Btn variant="cta" loading={loading} onClick={() => form.submit()}>{t('common.save')}</Btn>
                </div>
              </Form>
            </Section>
          )}

          {/* ---------------- 转写 ---------------- */}
          {active === 'speech' && (
            <Section
              title={t('settings.navSpeech')}
              description={t('settings.speechSectionDescription')}
            >
              <SpeechRecognitionConfig />
            </Section>
          )}

          {/* ---------------- 应用 ---------------- */}
          {active === 'app' && (
            <AppSection analyticsOn={analyticsOn} onAnalyticsChange={(on) => { setAnalyticsEnabled(on); setAnalyticsOn(on) }} />
          )}

          {/* ---------------- 反馈 ---------------- */}
          {active === 'feedback' && (
            <Section title={t('settings.navFeedback')} description={t('settings.feedbackSectionDescription')}>
              <div className="ac-rows">
                <Row label={t('settings.sendFeedbackLabel')} hint={t('settings.sendFeedbackHint')}>
                  <Btn variant="cta" size="sm" style={{ height: 32, fontSize: 13, padding: '0 16px' }} onClick={() => setFeedbackOpen(true)}>
                    <Icon.Chat size={13} /> {t('settings.writeFeedback')}
                  </Btn>
                </Row>
                <Row label={t('settings.feedbackFormLabel')} hint={t('settings.feedbackFormHint')}>
                  <Btn size="sm" onClick={() => openExternalLink(FEEDBACK_FORM_URL)}>{t('settings.openForm')} <Icon.External size={12} /></Btn>
                </Row>
                <Row label="GitHub" hint={t('settings.githubHint')}>
                  <Btn size="sm" onClick={() => openExternalLink(FEEDBACK_ISSUES_URL)}>{t('settings.newIssue')} <Icon.External size={12} /></Btn>
                </Row>
                <Row label={t('settings.statusIssueLabel')} hint={t('settings.statusIssueHint')}>
                  <Btn variant="text" size="sm" onClick={() => openExternalLink('https://github.com/zhouxiaoka/autoclip/issues/96')}>#96 <Icon.External size={12} /></Btn>
                </Row>
              </div>
            </Section>
          )}
        </div>
      </div>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} context={{ source: 'settings' }} />
    </div>
  )
}

/* ---------------- 应用 ---------------- */
const AppSection: React.FC<{ analyticsOn: boolean; onAnalyticsChange: (on: boolean) => void }> = ({ analyticsOn, onAnalyticsChange }) => {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const [autostart, setAutostart] = useState(false)
  const [busy, setBusy] = useState(false)
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const isDesktop = await isDesktopMode()
        setDesktop(isDesktop)
        if (isDesktop) {
          const { invoke } = await import('@tauri-apps/api/core')
          setAutostart(Boolean(await invoke('is_autostart_enabled')))
        }
      } catch (err) {
        console.error('检查自动启动状态失败:', err)
      }
    })()
  }, [])

  const toggleAutostart = async (enabled: boolean) => {
    if (!desktop) { message.error(t('settings.desktopOnlyFeature')); return }
    setBusy(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke(enabled ? 'enable_autostart' : 'disable_autostart')
      setAutostart(enabled)
    } catch (err) {
      console.error('切换自动启动状态失败:', err)
      message.error(t('settings.operationFailed', { reason: String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title={t('settings.navApp')} description={t('settings.appSectionDescription')}>
      <div className="ac-rows">
        <Row label={t('settings.appearanceLabel')} hint={t('settings.appearanceHint')}>
          <Segmented size="sm" ariaLabel={t('settings.appearanceLabel')} value={theme} onChange={setTheme} options={[{ value: 'light', label: t('settings.appearanceLight') }, { value: 'dark', label: t('settings.appearanceDark') }]} />
        </Row>
        <Row label={t('settings.autostartLabel')} hint={t('settings.autostartHint')}>
          <Switch checked={autostart} onChange={toggleAutostart} loading={busy} disabled={!desktop} />
        </Row>
        <Row label={t('settings.analyticsLabel')} hint={t('settings.analyticsHint')}>
          <Switch checked={analyticsOn} onChange={onAnalyticsChange} />
        </Row>
        <Row label={t('settings.bilibiliAccountLabel')} hint={t('settings.bilibiliAccountHint')}>
          <span className="ac-hint" style={{ margin: 0 }}>{t('settings.comingSoon')}</span>
        </Row>
      </div>
    </Section>
  )
}

export default SettingsPage
