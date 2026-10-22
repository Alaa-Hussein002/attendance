import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { I18nProvider as SharedProvider } from '@attendance/i18n/react';
import { isLocale } from '@attendance/i18n';

const KEY = 'locale';

export function MobileI18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <SharedProvider
      deviceLocales={Localization.getLocales().map((l) => l.languageTag)}
      load={async () => {
        const v = await SecureStore.getItemAsync(KEY);
        return isLocale(v) ? v : null;
      }}
      save={async (l) => { await SecureStore.setItemAsync(KEY, l); }}
    >
      {children}
    </SharedProvider>
  );
}
