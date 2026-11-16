// Shared by the Audit Data screen and the server worker. No provider or secret code here.
export type AuditStage = 'AUDIT' | 'RECTIFY' | 'REAUDIT' | 'TALLY_ENTRY' | 'AGAIN_AUDIT' | 'COMPLETED';
export type AuditRow = Record<string, unknown> & { id: number };
export type AuditCheck = { name: string; passed: boolean; detail: string };
export type DocumentData = {
  billNo: string; partyName: string; firmName: string; total: number;
  /** Amount before tax, when the document shows one; -1/absent when it does not. */
  taxableValue?: number;
  voucherNo: string; voucherDate: string;
  items: { product: string; quantity: number; rate: number }[];
};
export type AuditReport = {
  kind: 'ai-audit'; version: 1; stage: AuditStage; outcome: 'passed' | 'exception' | 'error' | 'processing';
  at: string; summary: string; checks: AuditCheck[];
  corrections: { field: string; before: unknown; after: unknown; reason: string }[];
  fingerprint: string; attempts: number; retryAt?: string; previous?: string;
  lifting?: LiftingProgress;
};
export type LiftingProgress = { ordered: number; current: number; lifted: number; received: number; pending: number; valid: boolean };
export type VoucherProof = { kind: 'tally-voucher'; voucherNo: string; voucherDate: string; proofUrl: string; remarks: string; enteredBy: string };
export const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
// Name tolerance never applies to invoice IDs, quantities, rates or amounts.
export function nameMatches(a: unknown, b: unknown): boolean {
  const words = (value: unknown) => norm(value).replace(/\b(pvt|ltd|co|mfg)\./g, '$1')
    .replace(/&/g, ' and ').replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
    .map(word => ({ pvt: 'private', ltd: 'limited', co: 'company', mfg: 'manufacturing' }[word] || word));
  const left = words(a), right = words(b);
  if (!left.length || !right.length) return false;
  if (left.join('') === right.join('')) return true;
  if (left.length !== right.length) return false;
  let typos = 0;
  return left.every((word, index) => {
    const other = right[index];
    if (word === other) return true;
    // Only one single-letter substitution in a long word; protect grades and digits.
    if (!/^[a-z]{6,}$/.test(word) || !/^[a-z]{6,}$/.test(other) || word.length !== other.length) return false;
    const differences = [...word].filter((letter, i) => letter !== other[i]).length;
    return differences === 1 && ++typos === 1;
  });
}
// The app stores a short firm name (e.g. "Refrasynth") while bills carry the full legal name
// (e.g. "REFRASYNTH MINERALS INDIA PRIVATE LIMITED"), so the app name's words only need to appear in the bill's.
export function firmMatches(bill: unknown, app: unknown): boolean {
  if (nameMatches(bill, app)) return true;
  const words = (value: unknown) => norm(value).replace(/&/g, ' and ').replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  const billWords = new Set(words(bill)), appWords = words(app);
  return appWords.length > 0 && appWords.every(word => billWords.has(word));
}
export function numberValue(v: unknown): number {
  if (!present(v)) return NaN;
  return Number(String(v).replace(/,/g, '').trim());
}
export const moneyMatches = (a: unknown, b: unknown) => Number.isFinite(numberValue(a)) && Number.isFinite(numberValue(b)) && Math.abs(numberValue(a) - numberValue(b)) <= 0.01;
export const quantityMatches = (a: unknown, b: unknown) => Number.isFinite(numberValue(a)) && Number.isFinite(numberValue(b)) && Math.abs(numberValue(a) - numberValue(b)) <= 0.000001;
export function auditStage(row: Record<string, unknown>): AuditStage {
  const status = (n: number) => norm(row[`status${n}`]);
  const actual = (n: number) => present(row[`actual${n}`]);
  const auditPassed = actual(1) && status(1) === 'done';
  const reauditPassed = actual(1) && actual(2) && status(2) === 'done' && actual(3) && status(3) === 'done';
  if (auditPassed || reauditPassed) {
    // Failed/manual timestamps alone cannot complete a stage.
    if (!actual(4) || status(4) !== 'done') return 'TALLY_ENTRY';
    if (actual(5) && ['done', 'okay'].includes(status(5))) return 'COMPLETED';
    return 'AGAIN_AUDIT';
  }
  if (!actual(1)) return 'AUDIT';
  if (!actual(2) || status(2) !== 'done' || (actual(3) && status(3) !== 'done')) return 'RECTIFY';
  return 'REAUDIT';
}
export const stageNumber = (stage: AuditStage) => ({ AUDIT: 1, RECTIFY: 2, REAUDIT: 3, TALLY_ENTRY: 4, AGAIN_AUDIT: 5, COMPLETED: 5 })[stage];
export function readReport(value: unknown): AuditReport | null {
  try {
    const parsed = JSON.parse(String(value));
    return parsed?.kind === 'ai-audit' && parsed.version === 1 &&
      ['AUDIT', 'RECTIFY', 'REAUDIT', 'TALLY_ENTRY', 'AGAIN_AUDIT', 'COMPLETED'].includes(parsed.stage) &&
      ['passed', 'exception', 'error', 'processing'].includes(parsed.outcome) && typeof parsed.summary === 'string' &&
      Array.isArray(parsed.checks) && parsed.checks.every((check: unknown) => {
        if (!check || typeof check !== 'object') return false;
        const c = check as AuditCheck;
        return typeof c.name === 'string' && typeof c.passed === 'boolean' && typeof c.detail === 'string';
      }) ? parsed : null;
  } catch { return null; }
}
export function readVoucher(value: unknown): VoucherProof | null {
  try {
    const parsed = JSON.parse(String(value));
    return parsed?.kind === 'tally-voucher' && present(parsed.voucherNo) && present(parsed.voucherDate) && present(parsed.proofUrl) ? parsed : null;
  } catch { return null; }
}
export function tallyConfirmed(value: unknown): boolean {
  try {
    const entry = JSON.parse(String(value));
    return entry?.kind === 'tally-confirmation' && entry.answer === 'Yes' &&
      typeof entry.enteredBy === 'string' && present(entry.enteredBy) &&
      typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at));
  } catch { return false; }
}
const legacyHindiDetails: Record<string, string> = {
  'Invoice buyer must match the record firm.': 'बिल और ऐप में कंपनी का नाम अलग है।',
  'Exactly one matching PO product is required.': 'खरीद आदेश में सामान का मिलान नहीं हुआ।',
  'Exactly one HOD-approved receipt is required.': 'स्वीकृत माल प्राप्ति का मिलान नहीं हुआ।',
  'Invoice, record and PO vendor must match.': 'बिल, ऐप और खरीद आदेश में विक्रेता अलग है।',
  'Invoice number must match the attached bill.': 'संलग्न बिल और ऐप का बिल नंबर अलग है।',
  'Recorded gross bill total must equal the invoice gross total, including charges and taxes.': 'बिल और ऐप की कुल राशि अलग है।',
  'Exactly one matching invoice product is required; ambiguous names need source correction.': 'बिल में सामान का मिलान नहीं हुआ।',
  'Invoice quantity must match recorded and received quantity.': 'बिल, ऐप और प्राप्त माल की मात्रा अलग है।',
  'Invoice quantity must not exceed ordered quantity.': 'बिल की मात्रा ऑर्डर से अधिक या अस्पष्ट है।',
  'Invoice, record and approved PO unit rates must match.': 'बिल, ऐप और खरीद आदेश की दर अलग है।',
  'Quantity, physical condition and PO price must be approved.': 'मात्रा, माल की स्थिति या दर की जाँच अधूरी है।',
  'Quantity and PO price must be approved; damaged material needs resolution.': 'मात्रा, माल की स्थिति या दर की जाँच अधूरी है।',
  'Same firm/vendor/invoice on another PO or receipt is held for review.': 'यही बिल दूसरी प्रविष्टि में भी मिला।',
  'Same invoice found on another entry.': 'यही बिल दूसरी प्रविष्टि में भी मिला।',
  'Mismatch': 'विवरण अलग हैं।',
  'Missing proof': 'प्रमाण उपलब्ध नहीं है।',
  'Multiple matching PO lines.': 'खरीद आदेश में एक से अधिक मिलते सामान हैं।',
  'Matching approved receipt missing/ambiguous.': 'स्वीकृत माल प्राप्ति गायब या अस्पष्ट है।',
  'Multiple matching bill products.': 'बिल में एक से अधिक मिलते सामान हैं।',
  'Tally Entry must include voucher number, date and uploaded proof.': 'वाउचर नंबर, तारीख या प्रमाण नहीं दिया गया।',
  'Tally voucher number, date, company, invoice, vendor, gross total and every product quantity/rate must match.': 'वाउचर का नंबर, तारीख, कंपनी, बिल, राशि या सामान का मिलान नहीं हुआ।',
};
/** English output; legacy Hindi templates are decoded without changing source names. */
export function englishCheckDetail(detail: string): string {
  const legacy = Object.entries(legacyHindiDetails).find(([, translated]) => translated === detail);
  const shortDetails: Record<string, string> = {
    'Invoice buyer must match the record firm.': 'Bill and app company names differ.',
    'Exactly one matching PO product is required.': 'PO product missing or ambiguous.',
    'Exactly one HOD-approved receipt is required.': 'Approved receipt missing or ambiguous.',
    'Invoice, record and PO vendor must match.': 'Bill, app and PO vendors differ.',
    'Invoice number must match the attached bill.': 'Bill and app invoice numbers differ.',
    'Recorded gross bill total must equal the invoice gross total, including charges and taxes.': 'Bill and app totals differ.',
    'Exactly one matching invoice product is required; ambiguous names need source correction.': 'Bill product missing or ambiguous.',
    'Invoice quantity must match recorded and received quantity.': 'Bill, app and received quantities differ.',
    'Invoice quantity must not exceed ordered quantity.': 'Bill quantity exceeds PO or cannot be verified.',
    'Invoice, record and approved PO unit rates must match.': 'Bill, app and PO rates differ.',
    'Quantity, physical condition and PO price must be approved.': 'Quantity, physical or price check pending.',
  };
  const english = legacy ? legacy[0] : detail;
  if (shortDetails[english]) return shortDetails[english];
  const patterns: [RegExp, string][] = [
    [/^बिल (.*); प्राप्त (.*); ऐप (.*)।$/, 'Bill $1; received $2; app $3.'],
    [/^बिल (.*); खरीद आदेश (.*); ऐप (.*)।$/, 'Bill $1; PO $2; app $3.'],
    [/^बिल (.*); ऐप (.*)।$/, 'Bill $1; app $2.'],
    [/^बिल (.*); ऑर्डर (.*)।$/, 'Bill $1; ordered $2.'],
    [/^बिल (.*); प्राप्त (.*)।$/, 'Bill $1; received $2.'],
    [/^बिल (.*); खरीद आदेश (.*)।$/, 'Bill $1; PO $2.'],
    [/^खरीद आदेश में सामान नहीं मिला: (.*)।$/, 'PO product missing: $1.'],
    [/^बिल में सामान नहीं मिला: (.*)।$/, 'Bill product missing: $1.'],
    [/^विभागीय स्वीकृति: (.*)।$/, 'HOD: $1.'],
    [/^मात्रा जाँच (.*); माल की स्थिति (.*); दर जाँच (.*)।$/, 'Qty check $1; physical $2; price $3.'],
  ];
  for (const [pattern, replacement] of patterns) {
    const match = pattern.exec(english);
    if (match) {
      const labels: Record<string, string> = { अनुपलब्ध: 'missing', हाँ: 'Yes', नहीं: 'No', स्वीकृत: 'Approved', अस्वीकृत: 'Rejected' };
      return replacement.replace(/\$(\d)/g, (_, n: string) => labels[match[Number(n)]] || match[Number(n)]);
    }
  }
  if (legacy) return english;
  return detail;
}
export function englishSummary(report: AuditReport): string {
  if (report.outcome === 'passed') return report.lifting?.valid ? `Checks passed. Lift ${report.lifting.current}; total ${report.lifting.lifted}/${report.lifting.ordered}; pending ${report.lifting.pending}.` : 'All checks passed.';
  if (report.outcome === 'processing') return 'Checking documents...';
  if (report.outcome === 'error') return !/[\u0900-\u097f]/.test(report.summary) ? report.summary : 'AI check could not be completed. Please retry.';
  const failures = report.checks.filter(c => !c.passed).length;
  if (failures) return `${failures} ${failures === 1 ? 'issue' : 'issues'}. Correction needed.`;
  if (!/[\u0900-\u097f]/.test(report.summary)) return report.summary;
  return 'AI check could not be completed. Please retry.';
}
export function englishReport(report: AuditReport): AuditReport {
  return { ...report, summary: englishSummary(report), checks: report.checks.map(check => ({ ...check, detail: englishCheckDetail(check.detail) })) };
}
// Keep the complete checks in the report; shorten only the visible remarks.
function shortCheckRemark(check: AuditCheck): string {
  const labels: Record<string, string> = {
    Firm: 'Company', 'Invoice number': 'Bill no.', 'Lifting bill': 'Lifting bill no.',
    'Invoice total': 'Amount', 'Invoice line': 'Bill product', 'PO line': 'PO product',
    'PO quantity': 'PO qty', 'PO lifting total': 'PO lifting', Quantity: 'Qty',
    'Voucher details': 'Tally voucher',
  };
  const messages: Record<string, string> = {
    'Multiple matching PO lines.': 'Multiple matches; check PO.',
    'Matching approved receipt missing/ambiguous.': 'Missing or multiple receipts; check source.',
    'Multiple matching bill products.': 'Multiple matches; check bill.',
    'PO lifting quantities are missing or invalid.': 'Missing/invalid lifting qty.',
    'Same invoice found on another entry.': 'Possible duplicate; review entry.',
    'Same firm/vendor/invoice on another PO or receipt is held for review.': 'Possible duplicate; review entry.',
    'Tally Entry must include voucher number, date and uploaded proof.': 'Add voucher no., date and proof.',
    'Tally voucher number, date, company, invoice, vendor, gross total and every product quantity/rate must match.': 'Details differ; check uploaded voucher.',
  };
  const detail = englishCheckDetail(check.detail);
  const legacyIssues: Record<string, string> = {
    'Bill and app company names differ.': 'Company mismatch.',
    'Bill, app and PO vendors differ.': 'Vendor mismatch.',
    'Bill and app invoice numbers differ.': 'Bill no. mismatch.',
    'Bill and app totals differ.': 'Amount mismatch.',
    'Bill product missing or ambiguous.': 'Bill product missing / unclear.',
    'PO product missing or ambiguous.': 'PO product missing / unclear.',
    'Bill, app and received quantities differ.': 'Qty mismatch.',
    'Bill quantity exceeds PO or cannot be verified.': 'PO qty exceeded / unverified.',
    'Bill, app and PO rates differ.': 'Rate mismatch.',
    'Quantity, physical or price check pending.': 'Store checks pending.',
  };
  if (legacyIssues[detail]) return legacyIssues[detail];
  if (check.name === 'Store checks') {
    const flags = /^Qty check (.*); physical (.*); price (.*)\.$/.exec(detail);
    if (flags) {
      const pending = ['Qty', 'Physical', 'Price'].filter((_, i) => norm(flags[i + 1]) !== 'yes');
      if (pending.length) return `Store: ${pending.join(', ')} check needed.`;
    }
  }
  const concise = messages[detail] || detail.replace(/; /g, ' / ').replace(/^HOD: /, 'HOD ');
  return `${labels[check.name] || check.name}: ${concise}`;
}
export function remarkText(value: unknown, expectedStage?: AuditStage): string {
  const report = readReport(value);
  if (report) {
    if (expectedStage && (['RECTIFY', 'TALLY_ENTRY'].includes(expectedStage) || report.stage !== expectedStage)) return '';
    if (report.outcome === 'error' || report.outcome === 'processing') return englishSummary(report);
    const issues = report.checks.filter(check => !check.passed);
    if (issues.length) return issues.map(shortCheckRemark).join(' | ');
    return englishSummary(report);
  }
  const voucher = readVoucher(value);
  if (tallyConfirmed(value)) return 'Yes';
  if (!voucher && expectedStage && ['AUDIT', 'REAUDIT', 'AGAIN_AUDIT'].includes(expectedStage)) {
    // Older plain-text AI remarks can use the same presentation, without editing human text.
    const lines = String(value ?? '').split('\n');
    if (lines.length && lines.every(line => /^\d+\. [^:]+: .+/.test(line))) {
      return lines.map(line => {
        const match = /^(\d+)\. ([^:]+): (.+)$/.exec(line)!;
        return shortCheckRemark({ name: match[2], detail: match[3], passed: false });
      }).join(' | ');
    }
  }
  return voucher ? `Voucher ${voucher.voucherNo} | ${voucher.voucherDate}\n${voucher.remarks}\n${voucher.proofUrl}` : String(value ?? '');
}
export function validateDocument(value: unknown): DocumentData {
  const v = value as DocumentData;
  if (!v || !['billNo', 'partyName', 'firmName', 'voucherNo', 'voucherDate'].every(k => typeof (v as unknown as Record<string, unknown>)[k] === 'string') || typeof v.total !== 'number' || !Number.isFinite(v.total) || (v.taxableValue !== undefined && !Number.isFinite(v.taxableValue)) || !Array.isArray(v.items) || v.items.length > 500 || !v.items.every(i => typeof i.product === 'string' && Number.isFinite(i.quantity) && Number.isFinite(i.rate))) throw new Error('Invalid AI document extraction');
  return v;
}
export function liftingProgress(row: AuditRow, po: AuditRow[], stores: AuditRow[]): LiftingProgress {
  const lines = po.filter(line => norm(line.product) === norm(row.product_name));
  const ordered = lines.length === 1 ? numberValue(lines[0].quantity) : NaN;
  const active = stores.filter(store => norm(store.firm_name_match) === norm(row.firm_name_match) && norm(store.po_number) === norm(row.po_number) && norm(store.product_name) === norm(row.product_name) && !['cancelled', 'canceled'].includes(norm(store.lifting_status)) && !['cancelled', 'canceled'].includes(norm(store.status)));
  const seen = new Set<number>();
  const distinct = active.filter(store => { if (seen.has(store.id)) return false; seen.add(store.id); return true; });
  const quantities = distinct.map(store => numberValue(store.qty));
  const lifted = quantities.reduce((total, qty) => total + qty, 0);
  const received = distinct.reduce((total, store) => total + (Number.isFinite(numberValue(store.received_quantity)) ? numberValue(store.received_quantity) : 0), 0);
  const currentIncluded = distinct.some(store => norm(store.lift_number) === norm(row.lift_number) && norm(store.indent_no) === norm(row.indent_number));
  const valid = ordered > 0 && currentIncluded && quantities.length > 0 && quantities.every(qty => Number.isFinite(qty) && qty > 0) && Number.isFinite(lifted);
  const round = (qty: number) => Number(qty.toFixed(6));
  return { ordered, current: numberValue(row.qty), lifted: round(lifted), received: round(received), pending: round(ordered - lifted), valid };
}
export function sourceChecks(row: AuditRow, po: AuditRow[], stores: AuditRow[], duplicate: boolean, bill: DocumentData): AuditCheck[] {
  // Only four checks are audited: lift qty, bill qty, bill amount and lift amount.
  // Company, vendor, PO, rate, received qty, store checks and duplicates are intentionally not checked.
  void po; void duplicate;
  const checks: AuditCheck[] = [];
  const value = (v: unknown) => !present(v) || v === -1 ? 'missing' : String(v).slice(0, 60);
  const add = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });
  const receipts = stores.filter(s => norm(s.firm_name_match) === norm(row.firm_name_match) && norm(s.po_number) === norm(row.po_number) && norm(s.product_name) === norm(row.product_name) && norm(s.lift_number) === norm(row.lift_number) && norm(s.indent_no) === norm(row.indent_number));
  const receipt = receipts.length === 1 ? receipts[0] : null;
  // A bill (or handwritten slip) with a single line may name the product differently, e.g. in Hindi.
  const named = bill.items.filter(i => nameMatches(i.product, row.product_name));
  const invoiceItems = named.length ? named : bill.items.length === 1 ? bill.items : [];
  const item = invoiceItems.length === 1 ? invoiceItems[0] : null;
  const itemIssue = invoiceItems.length ? 'Multiple matching bill products.' : `Bill product missing: ${value(row.product_name)}.`;
  // App amounts are often entered before GST, while the bill total includes it; either may match.
  const billAmounts = [bill.total, bill.taxableValue].filter(amount => numberValue(amount) > 0);
  const amountMatches = (app: unknown) => numberValue(app) > 0 && billAmounts.some(amount => moneyMatches(app, amount));
  const billAmountText = bill.taxableValue !== undefined && numberValue(bill.taxableValue) > 0 && !moneyMatches(bill.taxableValue, bill.total)
    ? `${value(bill.total)} (before tax ${value(bill.taxableValue)})` : value(bill.total);
  add('Lift qty', !!item && !!receipt && numberValue(item.quantity) > 0 && quantityMatches(item.quantity, receipt.qty),
    !item ? itemIssue : !receipt ? 'Matching lift receipt missing/ambiguous.' : `Bill ${value(item.quantity)}; lift ${value(receipt.qty)}.`);
  add('Bill qty', !!item && numberValue(item.quantity) > 0 && quantityMatches(item.quantity, row.qty),
    !item ? itemIssue : `Bill ${value(item.quantity)}; app ${value(row.qty)}.`);
  add('Bill amount', amountMatches(row.bill_amt), `Bill ${billAmountText}; app ${value(row.bill_amt)}.`);
  add('Lift amount', !!receipt && amountMatches(receipt.bill_amount),
    !receipt ? 'Matching lift receipt missing/ambiguous.' : `Bill ${billAmountText}; lift ${value(receipt.bill_amount)}.`);
  return checks;
}
export function humanReviewUpdate(stage: 'TALLY_ENTRY' | 'AGAIN_AUDIT', answer: string, reviewer: string, now: string): Record<string, unknown> {
  if (!['Yes', 'No'].includes(answer) || !reviewer.trim() || !Number.isFinite(Date.parse(now))) throw new Error('Valid Yes/No answer, reviewer and date are required.');
  if (stage === 'TALLY_ENTRY') {
    if (answer === 'No') return {};
    return { status4: 'Done', actual4: now, planned5: now,
      remarks4: JSON.stringify({ kind: 'tally-confirmation', answer, at: now, enteredBy: reviewer }),
      status5: '', actual5: null, remarks5: '' };
  }
  return { status5: answer === 'Yes' ? 'Done' : 'Not Done', actual5: answer === 'Yes' ? now : null,
    remarks5: `Human final audit: ${answer}. Reviewed by ${reviewer}.`,
    ...(answer === 'No' ? { status4: 'Correction Needed', actual4: null, planned4: now } : {}) };
}
export function transition(row: AuditRow, stage: AuditStage, report: AuditReport, now: string): Record<string, unknown> {
  if (stage === 'RECTIFY' || stage === 'TALLY_ENTRY' || stage === 'AGAIN_AUDIT' || stage === 'COMPLETED') throw new Error('This is a human-only or completed stage.');
  if (report.stage !== stage) throw new Error('Audit report stage mismatch.');
  if (report.outcome === 'processing') throw new Error('An incomplete AI report cannot advance a stage.');
  if (report.outcome === 'passed' && report.checks.some(check => !check.passed)) throw new Error('A failed check cannot be marked passed.');
  const n = stageNumber(stage);
  const updates: Record<string, unknown> = { [`remarks${n}`]: JSON.stringify(report), [`status${n}`]: report.outcome === 'passed' ? 'Done' : report.outcome === 'error' ? 'AI Error' : 'Exception' };
  if (report.outcome === 'error') return updates;
  if (stage === 'AUDIT') {
    updates.actual1 = now;
    updates.status1 = report.outcome === 'passed' ? 'Done' : 'Not Done';
    updates[report.outcome === 'passed' ? 'planned4' : 'planned2'] = now;

  } else if (stage === 'REAUDIT' && report.outcome === 'passed') {
    updates.actual3 = now; updates.planned4 = now;
  } else if (stage === 'REAUDIT' && report.outcome === 'exception') {
    updates.actual2 = null; updates.status2 = 'Correction Needed'; updates.planned2 = now;
    updates.actual3 = null; updates.status3 = 'Not Done';
  }
  void row;
  return updates;
}
