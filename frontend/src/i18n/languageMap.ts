export const SUPPORTED_LANGUAGES = ['en', 'sw', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Settings store locale-like codes (en-KE, sw-KE, fr-FR, en-US, en-GB); i18next wants the bare language code. */
export function localeToLanguage(code: string | null | undefined): SupportedLanguage {
  const prefix = (code ?? '').split('-')[0]?.toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(prefix)
    ? (prefix as SupportedLanguage)
    : 'en';
}

export const LANGUAGE_STORAGE_KEY = 'nexora-language';
