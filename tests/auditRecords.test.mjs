import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptKey, uniqueReceipts, sameAuditSnapshot } from '../src/lib/auditRecords.ts';

const source = { firm_name_match: 'Firm A', po_number: 'PO-1', lift_number: 'L-1', indent_no: 'I-1', product_name: 'Brick' };
test('receipt joins separate firms, PO numbers and products', () => {
  const otherFirm = { ...source, firm_name_match: 'Firm B' };
  const otherProduct = { ...source, product_name: 'Mortar' };
  const rows = uniqueReceipts([source, otherFirm, otherProduct]);
  assert.equal(rows.get(receiptKey(source)), source);
  assert.equal(rows.get(receiptKey(otherFirm)), otherFirm);
  assert.equal(rows.get(receiptKey(otherProduct)), otherProduct);
  assert.notEqual(receiptKey(source), receiptKey({ ...source, po_number: 'PO-2' }));
  assert.equal(receiptKey(source), receiptKey({ ...source, indent_number: source.indent_no }, true));
});
test('ambiguous and unidentified receipts never select an arbitrary row', () => {
  assert.equal(uniqueReceipts([source, { ...source }]).get(receiptKey(source)), null);
  assert.equal(receiptKey({ ...source, firm_name_match: '' }), null);
});
test('stale forms detect amount, quantity, document and identity changes', () => {
  const expected = { billNo: 'B1', billAmt: 100, qty: 10, rate: 10, billImage: 'bill.pdf', productName: 'Brick', partyName: 'Vendor', poNumber: 'PO-1', liftNumber: 'L-1', indentNumber: 'I-1', firmNameMatch: 'Firm A' };
  const row = { ...source, indent_number: 'I-1', bill_no: 'B1', bill_amt: '100.00', qty: '10', rate: '10', bill_image: 'bill.pdf', party_name: 'Vendor' };
  assert.equal(sameAuditSnapshot(row, expected), true);
  for (const patch of [{ qty: '9.995' }, { bill_amt: '100.01' }, { bill_image: 'new.pdf' }, { product_name: 'Other' }, { party_name: 'Other' }]) assert.equal(sameAuditSnapshot({ ...row, ...patch }, expected), false);
  // Legacy blank rates display as zero; unchanged records must remain saveable.
  assert.equal(sameAuditSnapshot({ ...row, rate: null }, { ...expected, rate: 0 }), true);
  assert.equal(sameAuditSnapshot({ ...row, rate: '1' }, { ...expected, rate: 0 }), false);
});
