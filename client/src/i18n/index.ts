import { useAppStore } from '../stores/use-app-store';
import { translations, type TranslationKey, type Locale } from './translations';

export type { Locale, TranslationKey };
export { LOCALE_LABELS } from './translations';

export function useT() {
  const locale = useAppStore((s) => s.locale);
  return (key: TranslationKey): string => translations[locale]?.[key] ?? translations.en[key];
}
