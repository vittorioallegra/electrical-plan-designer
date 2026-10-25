import { useTranslation } from 'react-i18next';
import { languages, setLanguage, type Language } from '@/i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <label className="flex items-center gap-2 text-sm">
      {t('language.label')}
      <select
        className="rounded border border-border px-1 py-0.5"
        value={i18n.language}
        onChange={(e) => void setLanguage(i18n, e.target.value as Language)}
      >
        {languages.map((lng) => (
          <option key={lng} value={lng}>
            {t(`language.${lng}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
