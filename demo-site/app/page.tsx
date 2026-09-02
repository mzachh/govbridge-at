import { Button } from '@/components/ui/button';
import { HEADER_TITLE } from '@/server/i18n';
import { DEMO_USERNAME, DEMO_PASSWORD } from '@/server/demo-login';
import { LanguageMarker } from './language-marker';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = (await searchParams).lang === 'de' ? 'de' : 'en';
  const t = (en: string, de: string) => (lang === 'en' ? en : de);
  const href = (path: string) => path + '?lang=' + lang;
  return (
    <div lang={lang}>
      <LanguageMarker lang={lang} />
      <header className="portal-header">
        <a href={href('/')}>{HEADER_TITLE}</a>
        <nav className="language-switch" aria-label={t('Language', 'Sprache')}>
          <a
            href="/?lang=en"
            lang="en"
            aria-current={lang === 'en' ? 'true' : undefined}
          >
            English
          </a>
          <a
            href="/?lang=de"
            lang="de"
            aria-current={lang === 'de' ? 'true' : undefined}
          >
            Deutsch
          </a>
        </nav>
      </header>
      <div className="demo-banner">
        {t(
          'Synthetic demo — not MeineSV or OEGK. All records are fictional.',
          'Synthetische Demo — nicht MeineSV oder OEGK. Alle Daten sind frei erfunden.',
        )}
      </div>
      <main className="portal-main">
        <p className="breadcrumb">
          {t('Home / Demonstration', 'Startseite / Demonstration')}
        </p>
        <h1>
          {t(
            'Healthcare. Digital. Try it out.',
            'Gesundheit. Digital. Ausprobieren.',
          )}
        </h1>
        <section className="intro">
          <h2>
            {t(
              'Search claims — no real account required.',
              'Rechnungen abfragen — ohne echtes Konto.',
            )}
          </h2>
          <p>
            {t(
              'Explore 20 fictional doctor receipts with the real GovBridge AT extension. No ID Austria, no personal data.',
              'Entdecken Sie 20 erfundene Arztrechnungen mit der echten GovBridge AT Erweiterung. Keine ID Austria, keine persönlichen Daten.',
            )}
          </p>
          <form action="/login" method="get">
            <input type="hidden" name="lang" value={lang} />
            <Button type="submit" className="portal-button">
              {t('Open demo →', 'Demo öffnen →')}
            </Button>
          </form>
          <p>
            {t('Demo login:', 'Demo-Anmeldung:')} <code>{DEMO_USERNAME}</code> /{' '}
            <code>{DEMO_PASSWORD}</code>.{' '}
            {t(
              'Never enter a real password.',
              'Bitte niemals ein echtes Passwort eingeben.',
            )}
          </p>
        </section>
        <div className="guide-grid">
          <section>
            <h2>{t('01 · Open the demo', '01 · Demo öffnen')}</h2>
            <p>
              {t(
                'Sign in with the public credentials. Fixed sample period:',
                'Melden Sie sich mit den öffentlichen Zugangsdaten an. Fester Beispielzeitraum:',
              )}{' '}
              03.09.2021–02.09.2026.
            </p>
            <a href={href('/vsInfo/views/KE/einreichungTyp.xhtml')}>
              {t('Private doctor / therapist →', 'Wahlarzt / Wahltherapeut →')}
            </a>
          </section>
          <section>
            <h2>
              {t('02 · Add the extension', '02 · Erweiterung hinzufügen')}
            </h2>
            <p>
              {t(
                'In external Chrome, open chrome://extensions, enable Developer mode, then load the unpacked GovBridge AT build.',
                'Öffnen Sie chrome://extensions in externem Chrome, aktivieren Sie den Entwicklermodus und laden Sie GovBridge AT als entpackte Erweiterung.',
              )}
            </p>
            <p>
              {t(
                'Use the existing dist extension folder for both MeineSV and this demo. Public release remains deferred until verification is complete.',
                'Verwenden Sie den bestehenden dist-Ordner für MeineSV und diese Demo. Die Veröffentlichung bleibt bis zum Abschluss der Überprüfung ausgesetzt.',
              )}
            </p>
          </section>
          <section>
            <h2>{t('03 · Ask your agent', '03 · Agenten fragen')}</h2>
            <p>
              {t(
                '“Search the synthetic demo from 2021-09-03 to 2026-09-02, then summarize the currently displayed claims.”',
                '„Durchsuche die synthetische Demo von 2021-09-03 bis 2026-09-02 und fasse die aktuell angezeigten Einreichungen zusammen.“',
              )}
            </p>
            <p>
              {t(
                'Requires callable native WebMCP or supported CDP access. This page does not register substitute tools.',
                'Erfordert aufrufbares natives WebMCP oder unterstützten CDP-Zugriff. Diese Seite registriert keine Ersatz-Tools.',
              )}
            </p>
          </section>
        </div>
        <a href={href('/demo/scenarios')}>
          {t('Developer scenarios →', 'Entwickler-Szenarien →')}
        </a>
      </main>
      <footer>
        {t(
          'GovBridge AT Demo · Independently authored examples · No official affiliation',
          'GovBridge AT Demo · Unabhängig erstellte Beispiele · Keine offizielle Verbindung zu OEGK',
        )}
      </footer>
    </div>
  );
}
