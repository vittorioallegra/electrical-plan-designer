import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import it from './locales/it.json';

export const languages = ['en', 'it'] as const;
export type Language = (typeof languages)[number];

const storageKey = 'epd.lang';

export function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'en' || stored === 'it') return stored;
  } catch {
    // Storage may be unavailable (private mode); fall through to the browser language.
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('it')
    ? 'it'
    : 'en';
}

export function createI18n(lng: Language = detectLanguage()): i18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: { en: { translation: en }, it: { translation: it } },
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

export async function setLanguage(instance: i18n, lng: Language): Promise<void> {
  try {
    localStorage.setItem(storageKey, lng);
  } catch {
    // Ignore: the choice just won't persist.
  }
  await instance.changeLanguage(lng);
}
