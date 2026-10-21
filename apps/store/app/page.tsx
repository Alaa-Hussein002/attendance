'use client';
import { useI18n } from '@attendance/i18n/react';
import Link from 'next/link';

export default function Landing() {
  const { t, locale, setLocale } = useI18n();
  return (
    <>
      <header className="container navbar">
        <Link href="/" style={{ fontWeight: 700, fontSize: 18 }}>Bayt Al Mosawer</Link>
        <nav className="links">
          <a href="#features">{t('store.nav.features')}</a>
          <a href="#how">{t('store.nav.how')}</a>
          <a href="#pricing">{t('store.nav.pricing')}</a>
          <a href="/download">{t('store.nav.download')}</a>
          <button className="lang-btn" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{locale === 'ar' ? 'English' : 'العربية'}</button>
          <Link href="/account" className="btn ghost" style={{ padding: '8px 16px' }}>{t('store.nav.account')}</Link>
        </nav>
      </header>

      <section className="hero container">
        <span className="badge">{t('store.hero.badge')}</span>
        <h1>{t('store.hero.title')}</h1>
        <p>{t('store.hero.subtitle')}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link href="/plans" className="btn primary">{t('store.hero.ctaPrimary')}</Link>
          <Link href="/download" className="btn ghost">{t('store.hero.ctaSecondary')}</Link>
        </div>
        <div className="spacer" />
        <img src="/hero.svg" alt="" style={{ maxWidth: 760, width: '100%' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
      </section>

      <section id="features" className="section container">
        <h2>{t('store.features.title')}</h2>
        <p className="lead">{t('store.features.lead')}</p>
        <div className="grid grid-3">
          {[
            ['store.features.f1.t', 'store.features.f1.b'],
            ['store.features.f2.t', 'store.features.f2.b'],
            ['store.features.f3.t', 'store.features.f3.b'],
            ['store.features.f4.t', 'store.features.f4.b'],
            ['store.features.f5.t', 'store.features.f5.b'],
            ['store.features.f6.t', 'store.features.f6.b'],
          ].map(([th, bh]) => (
            <div className="card feature" key={th}>
              <div className="dot">✓</div>
              <div><h3 style={{ margin: '0 0 6px' }}>{t(th)}</h3><p style={{ margin: 0, color: 'var(--muted)' }}>{t(bh)}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="section container">
        <h2>{t('store.how.title')}</h2>
        <p className="lead">{t('store.how.lead')}</p>
        <div className="grid grid-3">
          {[1, 2, 3, 4].map((n) => (
            <div className="card" key={n}>
              <div className="badge" style={{ marginBottom: 10 }}>{n}</div>
              <h3 style={{ margin: '0 0 6px' }}>{t(`store.how.s${n}.t`)}</h3>
              <p style={{ margin: 0, color: 'var(--muted)' }}>{t(`store.how.s${n}.b`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="section container">
        <h2>{t('store.pricing.title')}</h2>
        <p className="lead">{t('store.pricing.lead')}</p>
        <div className="grid grid-3">
          {(['STARTER', 'BUSINESS', 'ENTERPRISE'] as const).map((code) => (
            <div className="card" key={code} style={{ textAlign: 'center' }}>
              <h3>{t(`store.plan.${code.toLowerCase()}.name`)}</h3>
              <div className="price">{t(`store.plan.${code.toLowerCase()}.price`)} <small>{t('store.pricing.perMonth')}</small></div>
              <p style={{ color: 'var(--muted)' }}>{t(`store.plan.${code.toLowerCase()}.desc`)}</p>
              <ul style={{ textAlign: 'start', color: 'var(--muted)', fontSize: 14, lineHeight: 1.9, paddingInlineStart: 18 }}>
                <li>{t(`store.plan.${code.toLowerCase()}.f1`)}</li>
                <li>{t(`store.plan.${code.toLowerCase()}.f2`)}</li>
                <li>{t(`store.plan.${code.toLowerCase()}.f3`)}</li>
              </ul>
              <Link href={`/checkout?plan=${code}`} className="btn primary" style={{ marginTop: 12 }}>{t('store.pricing.choose')}</Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 24, fontSize: 13 }}>{t('store.pricing.trialNote')}</p>
      </section>

      <section className="section container">
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>{t('store.cta.title')}</h2>
          <p style={{ color: 'var(--muted)' }}>{t('store.cta.body')}</p>
          <Link href="/plans" className="btn primary">{t('store.cta.button')}</Link>
        </div>
      </section>

      <footer className="container footer">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>© {new Date().getFullYear()} Bayt Al Mosawer</span>
          <span>{t('store.footer.tagline')}</span>
        </div>
      </footer>
    </>
  );
}
