export type DemoClaim = Readonly<{
  id: string;
  provider: string;
  invoiceDate: string;
  /** Fictional unlabelled overview date; not a canonical claim event date. */
  overviewDate: string;
  treatmentDate: string;
  treatmentEndDate: string;
  reimbursementDate?: string;
  status: 'processing' | 'completed' | 'rejected';
  invoiceAmount: number;
  reimbursementAmount?: number;
}>;
// Independently invented fixtures. Do not replace with exported account records.
const rows: Array<[string, string, DemoClaim['status'], number, number?]> = [
  ['Dr. Lena Berg — Dermatologie', '2021-10-14', 'completed', 120, 42],
  ['Dr. Thomas Auer — Allgemeinmedizin', '2022-01-19', 'completed', 85, 28.5],
  ['Dr. Clara Lindner — Orthopädie', '2022-04-07', 'rejected', 160],
  ['Dr. Martin Seidl — Augenheilkunde', '2022-07-22', 'completed', 110, 39.2],
  ['Dr. Eva Hartmann — HNO', '2022-10-05', 'completed', 95, 31.4],
  ['Praxis am Park — Physiotherapie', '2023-01-11', 'processing', 240],
  ['Dr. Paul Wieser — Innere Medizin', '2023-04-18', 'completed', 180, 67.8],
  ['Dr. Nora Leitner — Neurologie', '2023-07-26', 'rejected', 210],
  ['Dr. Lena Berg — Dermatologie', '2023-10-16', 'completed', 130, 46.1],
  ['Dr. Thomas Auer — Allgemeinmedizin', '2024-01-24', 'completed', 90, 30],
  ['Dr. Clara Lindner — Orthopädie', '2024-04-09', 'processing', 170],
  ['Dr. Martin Seidl — Augenheilkunde', '2024-07-15', 'completed', 125, 44.5],
  ['Dr. Eva Hartmann — HNO', '2024-10-23', 'rejected', 105],
  ['Praxis am Park — Physiotherapie', '2025-01-13', 'completed', 260, 92.4],
  ['Dr. Paul Wieser — Innere Medizin', '2025-04-21', 'completed', 195, 70.2],
  ['Dr. Nora Leitner — Neurologie', '2025-07-09', 'processing', 220],
  ['Dr. Lena Berg — Dermatologie', '2025-10-27', 'completed', 145],
  ['Dr. Thomas Auer — Allgemeinmedizin', '2026-01-20', 'rejected', 98],
  [
    'Therapiezentrum Sonnenweg — Physiotherapie',
    '2026-04-14',
    'processing',
    280,
  ],
  [
    'Therapiezentrum Sonnenweg — Physiotherapie',
    '2026-04-14',
    'processing',
    280,
  ],
];
function offsetDate(iso: string, days: number): string {
  const date = new Date(iso + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export const CLAIMS: readonly DemoClaim[] = Object.freeze(
  rows.map(
    ([provider, invoiceDate, status, invoiceAmount, reimbursementAmount], i) =>
      Object.freeze({
        id: `demo-claim-${String(i + 1).padStart(3, '0')}`,
        provider,
        invoiceDate,
        overviewDate: offsetDate(invoiceDate, 2),
        treatmentDate: offsetDate(
          invoiceDate,
          provider.includes('Physiotherapie') ? -21 : -1,
        ),
        treatmentEndDate: offsetDate(invoiceDate, -1),
        ...(status === 'completed'
          ? { reimbursementDate: offsetDate(invoiceDate, 18 + (i % 9)) }
          : {}),
        status,
        invoiceAmount,
        ...(reimbursementAmount === undefined ? {} : { reimbursementAmount }),
      }),
  ),
);
export const REFERENCE_DATE = '2026-09-02';
export const DEFAULT_FROM = '2021-09-03';
export const GOLDEN = Object.freeze({
  total: 20,
  processing: 5,
  completed: 11,
  rejected: 4,
  knownReimbursements: 10,
  reimbursementTotal: 492.1,
});
export const SCENARIOS = [
  'mixed',
  'empty-type',
  'empty-results',
  'validation',
  'partial',
  'unknown-status',
  'duplicates',
  'missing-fields',
  'paginated',
  'loading',
  'hidden-rows',
  'expired-session',
  'broken-layout',
  'ajax-replace',
  'ajax-text-only',
] as const;
export type Scenario = (typeof SCENARIOS)[number];
