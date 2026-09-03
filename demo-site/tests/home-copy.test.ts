import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

describe('Homepage extension installation copy', () => {
  it('links to the public prebuilt extension ZIP in both languages', () => {
    expect(source).toContain(
      'href="https://github.com/mzachh/govbridge-at/raw/refs/heads/main/downloads/govbridge-at-0.1.0.zip"',
    );
    expect(source).toContain("t('Download GovBridge AT', 'GovBridge AT herunterladen')");
    expect(source).toContain("t('and unzip it.', 'und die ZIP-Datei entpacken.')");
  });

  it('describes unpacked installation without the retired publication gate', () => {
    expect(source).toContain('select the extracted folder containing manifest.json');
    expect(source).toContain('wählen Sie den entpackten Ordner mit manifest.json aus');
    expect(source).toContain('No build is needed.');
    expect(source).toContain('Ein Build ist nicht erforderlich.');
    expect(source).not.toContain('Public release remains deferred');
    expect(source).not.toContain('Die Veröffentlichung bleibt');
  });
});
