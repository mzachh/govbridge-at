import { describe, it, expect } from 'vitest';
import { CLAIMS } from '../fixtures/claims';
import { results, detail, login } from '../server/render';
import { localizeHtml } from '../server/i18n';

const context = {
  scenario: 'mixed' as const,
  from: '2021-09-03',
  to: '2026-09-02',
  page: 1,
};

describe('natural fictional claim presentation', () => {
  it('uses natural names, valid treatment periods and only known reimbursement dates', () => {
    for (const claim of CLAIMS) {
      expect(claim.provider).not.toMatch(/demo|synthetic/i);
      expect(claim.treatmentDate <= claim.treatmentEndDate).toBe(true);
      expect(claim.treatmentEndDate < claim.invoiceDate).toBe(true);
      expect(
        Date.parse(claim.overviewDate) - Date.parse(claim.invoiceDate),
      ).toBe(2 * 86400000);
      expect(new Date(claim.treatmentDate).toISOString().slice(0, 10)).toBe(
        claim.treatmentDate,
      );
      if (claim.status === 'completed') {
        expect(claim.reimbursementDate! > claim.invoiceDate).toBe(true);
      } else expect(claim.reimbursementDate).toBeUndefined();
    }
    const { id: firstId, ...first } = CLAIMS[18]!;
    const { id: secondId, ...second } = CLAIMS[19]!;
    expect(firstId).not.toBe(secondId);
    expect(first).toEqual(second);
  });

  it.each(['en', 'de'] as const)(
    'renders compact overview rows and disclosures in %s',
    (lang) => {
      const html = localizeHtml(results(context), lang);
      expect(html).not.toContain('claim-fields');
      expect(html).not.toContain('<dl');
      expect(html.match(/class="light date cb_date"/g)).toHaveLength(20);
      expect(html.match(/class="cb_details"/g)).toHaveLength(20);
      expect(html.match(/class="cb_download"/g)).toHaveLength(20);
      expect(
        html.match(/class="document-unavailable" type="button" disabled/g),
      ).toHaveLength(11);
      expect(html.match(/class="badge"/g)).toHaveLength(11);
      expect(html.match(/>↪ \d+\.\d{2} €<\/span>/g)).toHaveLength(11);
      expect(html).not.toMatch(/>Reimbursement:|>Rückerstattung:/);
      expect(html.match(/data-fixture=/g)).toHaveLength(20);
      for (const label of lang === 'en'
        ? [
            'Invoice amount:',
            'Treatment period:',
            'Reimbursement amount:',
            'Reimbursement date:',
          ]
        : [
            'Rechnungsbetrag:',
            'Behandlungszeitraum:',
            'Höhe der Kostenerstattung:',
            'Datum der Erstattung:',
          ]) {
        expect(html).not.toContain(label);
        expect(localizeHtml(detail(CLAIMS[0]!, context), lang)).toContain(
          label,
        );
      }
      expect(html).toContain(
        lang === 'en'
          ? 'All records are fictional.'
          : 'Alle Daten sind frei erfunden.',
      );
    },
  );

  it('shows requested display-only identity fields and natural rejection text', () => {
    const html = localizeHtml(detail(CLAIMS[2]!, context));
    expect(html).toContain('<td>Peter</td>');
    expect(html).toContain(
      '<th scope="row">Social security number:</th><td>1234010196</td>',
    );
    expect(html).toContain('<td>AT00 1234 1234 1234 1234</td>');
    expect(html).toContain('<td>SYNTHETIC-demo-claim-003</td>');
    expect(html).toContain('This service is not eligible for reimbursement.');
    expect(html).not.toContain('SENTINEL');
    expect(html).toContain(
      '<th scope="row">Reimbursement date:</th><td>Unknown</td>',
    );
  });

  it('preserves unknown amounts in the missing-fields scenario', () => {
    const html = localizeHtml(
      results({ ...context, scenario: 'missing-fields' }),
    );
    expect(html).not.toContain('data-field=');
    expect(html).not.toContain('class="badge"');
    expect(
      localizeHtml(
        detail(CLAIMS[0]!, { ...context, scenario: 'missing-fields' }),
      ),
    ).toContain('<th scope="row">Reimbursement amount:</th><td>Unknown</td>');
  });

  it.each(['en', 'de'] as const)('renders claim 017 reimbursement in %s', (lang) => {
    const claim = CLAIMS.find(({ id }) => id === 'demo-claim-017')!;
    expect(claim.invoiceAmount).toBe(145);
    expect(claim.reimbursementAmount).toBe(51.3);
    const html = localizeHtml(detail(claim, context), lang);
    expect(html).toContain('<td>51,30 €</td>');
    expect(html).toContain('<td>145,00 €</td>');
    expect(localizeHtml(results(context), lang)).toContain('↪ 51.30 €');
    expect(localizeHtml(detail(claim, { ...context, scenario: 'missing-fields' }), lang))
      .not.toContain('<td>51,30 €</td>');
  });

  it('displays exactly the new public credential pair', () => {
    const html = localizeHtml(login('/vsInfo/views/KE/einreichungListe.xhtml'));
    expect(html).toContain(
      '<code>peter</code> / <code>ThisIsJustADemo$</code>',
    );
    expect(html).not.toContain('<code>username</code>');
  });
});
