import React from 'react'
import { Select } from 'antd'
import { useLanguage } from '../context/LanguageContext'
import { SUPPORTED_LANGUAGES } from '../i18n'

// Calm Premium language switcher — see DESIGN.md
const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage()

  return (
    <Select
      size="middle"
      value={language}
      onChange={setLanguage}
      variant="borderless"
      popupMatchSelectWidth={false}
      options={SUPPORTED_LANGUAGES.map((lang) => ({ value: lang.code, label: lang.label }))}
      style={{
        border: '1px solid var(--ac-line)',
        borderRadius: '999px',
        height: '36px',
        background: 'var(--ac-card)',
      }}
    />
  )
}

export default LanguageSwitcher
