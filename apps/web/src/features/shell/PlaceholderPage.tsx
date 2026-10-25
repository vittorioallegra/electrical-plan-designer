import { useTranslation } from 'react-i18next';

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return <h1 className="text-xl font-semibold">{t(titleKey)}</h1>;
}
