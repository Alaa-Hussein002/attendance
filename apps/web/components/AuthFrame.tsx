import { ReactNode } from 'react';
import { useI18n } from '@attendance/i18n/react';
import { Lockup, Mark } from './Logo';
import LangToggle from './LangToggle';

/** Split screen from the identity: the interlocked mark as a cropped black mass, the slogan, the form on paper. */
export default function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="auth">
      <div className="art">
        <Lockup invert height={60} />
        <Mark invert size={640} style={{ position: 'absolute', insetInlineEnd: '-16%', bottom: '-14%', height: 'auto', width: '82%' }} />
        <div className="claim"><h2>{t('w.auth.claim1')}<br />{t('w.auth.claim2')}</h2><div className="rule" /><div className="tagline">{t('w.auth.tagline')}</div></div>
      </div>
      <div className="form"><LangToggle /><div className="box">{children}</div></div>
    </div>
  );
}
