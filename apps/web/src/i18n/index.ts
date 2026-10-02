import { createI18n } from 'vue-i18n';
import en from './en.json';
import uk from './uk.json';

export const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  fallbackLocale: 'en',
  messages: { uk, en },
});
