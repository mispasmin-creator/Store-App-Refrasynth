import { norm, present, quantityMatches } from './auditWorkflow.ts';

export type AuditSnapshot = { billNo: string; billAmt: number; qty: number; rate: number; billImage: string; productName: string; partyName: string; poNumber: string; liftNumber: string; indentNumber: string; firmNameMatch: string };
export function sameAuditSnapshot(row: Record<string, unknown>, expected: AuditSnapshot): boolean {
  // The screen maps legacy null numeric fields to zero. Compare that same view
  // here; the database claim still uses the original raw values when saving.
  const displayedNumber = (value: unknown) => Number(value) || 0;
  return [
    ['bill_no', expected.billNo], ['bill_image', expected.billImage], ['product_name', expected.productName],
    ['party_name', expected.partyName], ['po_number', expected.poNumber], ['lift_number', expected.liftNumber],
    ['indent_number', expected.indentNumber], ['firm_name_match', expected.firmNameMatch],
  ].every(([field, value]) => String(row[field] ?? '') === value) && quantityMatches(displayedNumber(row.bill_amt), expected.billAmt) && quantityMatches(displayedNumber(row.qty), expected.qty) && quantityMatches(displayedNumber(row.rate), expected.rate);
}
export function receiptKey(row: Record<string, unknown>, tally = false): string | null {
  const fields = ['firm_name_match', 'po_number', 'lift_number', tally ? 'indent_number' : 'indent_no', 'product_name'];
  if (!fields.every(field => present(row[field]))) return null;
  return JSON.stringify(fields.map(field => norm(row[field])));
}
export function uniqueReceipts<T extends Record<string, unknown>>(rows: T[]): Map<string, T | null> {
  const result = new Map<string, T | null>();
  for (const row of rows) {
    const key = receiptKey(row);
    if (key) result.set(key, result.has(key) ? null : row);
  }
  return result;
}
