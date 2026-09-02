# Non-sensitive visual measurements

Measured from the existing official MeineSV results page in Chrome, 2026-09-02.
Only computed styles and element geometry were read; no claim text or screenshot
was copied. Reference viewport measured 1069 × 854 CSS pixels.

| Element | Observed properties |
| --- | --- |
| Body | White; #475256 text; Roboto/sans-serif, 16px |
| Header | #008e5c; 90px height |
| H1 | #008859; Roboto Condensed, 40px, weight 300 |
| Open-section H2 | #ee4300; Roboto Condensed, 24px, weight 400 |
| Claim row | Flex; 25px top/side padding; light-weight title text |
| Reimbursement badge | #008e5c; white 12px text; 10px radius; 2px 5px padding |
| Text input | #fcfcfc; 1px #ddd border; square corners; 50px tall; 16px text |

Recreate this visual language with locally distributable fonts and original CSS.
Do not represent a close match as a pixel-identical or official reproduction.

Local synthetic review checked desktop search/results/login, both detail types,
and empty/validation states. Search was also checked at 390×844 with no horizontal
overflow. System Arial/Arial Narrow substitutes deliberately avoid copying font
files with unverified redistribution rights. The reference measured above was
the results page only; styling other states applies that measured visual language,
not a claim of independently measured pixel parity for every official screen.

## Compact overview revision (spec 018)

Fresh structural/geometry inspection of the already-open official results tab at
1455×862 confirmed no invoice-amount, treatment-period or reimbursement-date
detail block in overview rows. Open rows have `.cb_date`, `.cb_title`,
`.cb_details`, `.cb_download`; reimbursed rows add `.cb_status` with a badge.
No personal text, dates or claim amounts were retained in these notes.

Measured official card width: 768.23 px; section header: 100 px high; typical row:
69.80 px high with 25 px top/side padding. Date and detail-action columns: 100 px;
download space: 40 px. The left date is unlabelled; its meaning was not inferred.

The demo now removes detail blocks entirely, keeps separate action columns and
uses compact rows with those dimensions. Desktop and 390×844 mobile synthetic
screens were visually checked, including reimbursement badges. Mobile page width
was 390 px without horizontal overflow. Temporary emulation/scroll was restored.
The fictional-data banner, alternative fonts and unavailable document actions
remain deliberate differences; this is not a pixel-identical reproduction.
