import { useTranslation } from 'react-i18next';
import { languages, setLanguage, type Language } from '@/lib/i18n';
import { Select } from './Select';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-body">
      {t('language.label')}
      <Select
        aria-label={t('language.label')}
        className="w-32"
        value={i18n.language}
        onValueChange={(lng) => void setLanguage(i18n, lng as Language)}
        options={languages.map((lng) => ({ value: lng, label: t(`language.${lng}`) }))}
      />
    </div>
  );
}
