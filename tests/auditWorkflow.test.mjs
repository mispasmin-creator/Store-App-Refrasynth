import test from 'node:test';
import assert from 'node:assert/strict';
import { auditStage, sourceChecks, transition, validateDocument, readVoucher, remarkText, englishReport, liftingProgress, nameMatches, humanReviewUpdate } from '../src/lib/auditWorkflow.ts';

const row = { id: 1, firm_name_match: 'Factory', party_name: 'Supplier', po_number: 'PO-1', lift_number: 'L-1', indent_number: 'I-1', product_name: 'Brick', bill_no: 'INV-1', bill_amt: '1180', qty: '10', rate: '100' };
const po = [{ id: 1, product: 'Brick', party_name: 'Supplier', quantity: '100', rate: '100' }];
const stores = [{ id: 1, firm_name_match: 'Factory', po_number: 'PO-1', lift_number: 'L-1', indent_no: 'I-1', product_name: 'Brick', qty: '10', hod_status: 'Approved', received_quantity: '10', quantity_as_per_bill: 'Yes', damage_order: 'Yes', bill_received2: 'Yes', bill_no: 'INV-1', bill_amount: '1180' }];
const bill = { billNo: 'INV-1', partyName: 'Supplier', firmName: 'Factory', total: 1180, voucherNo: '', voucherDate: '', items: [{ product: 'Brick', quantity: 10, rate: 100 }] };
const now = '2026-10-20T08:00:00.000Z';
const report = (stage, outcome) => ({ kind: 'ai-audit', version: 1, stage, outcome, at: now, summary: 'Checked', checks: [], corrections: [], fingerprint: 'test', attempts: 1 });

test('name tolerance accepts common abbreviations and one minor typo but protects identities and grades', () => {
  assert.equal(nameMatches('ABC Pvt. Ltd.', 'ABC Private Limited'), true);
  assert.equal(nameMatches('Ultra Tech Cement', 'UltraTech Cement'), true);
  assert.equal(nameMatches('Cemant', 'Cement'), true);
  assert.equal(nameMatches('Cement 43', 'Cement 53'), false);
  assert.equal(nameMatches('ABC', 'ABD'), false);
  assert.equal(nameMatches('ABC Limited', 'XYZ Limited'), false);
  assert.equal(nameMatches('', ''), false);
  const checks = sourceChecks(row, po, stores, false, { ...bill, partyName: 'Supplizr', total: 1181 });
  assert.deepEqual(checks.map(check => check.name), ['Lift qty', 'Bill qty', 'Bill amount', 'Lift amount']);
  assert.equal(checks.find(check => check.name === 'Bill amount').passed, false);
  assert.equal(checks.find(check => check.name === 'Lift amount').passed, false);
  assert.equal(checks.find(check => check.name === 'Bill qty').passed, true);
});

test('old numbered AI remarks are shortened while manual remarks stay intact', () => {
  const old = '1. Quantity: Bill 100; received 90.\n2. Store checks: Qty check Yes; physical No; price Yes.';
  assert.equal(remarkText(old, 'AUDIT'), 'Qty: Bill 100 / received 90. | Store: Physical check needed.');
  assert.equal(remarkText(old, 'RECTIFY'), old);
});

test('legacy generic reports show short issues without inventing missing values', () => {
  const input = { ...report('AUDIT', 'exception'), checks: [
    { name: 'Firm', passed: false, detail: 'Invoice buyer must match the record firm.' },
    { name: 'Invoice total', passed: false, detail: 'Bill and app totals differ.' },
    { name: 'Quantity', passed: false, detail: 'Bill, app and received quantities differ.' },
    { name: 'Rate', passed: false, detail: 'Bill, app and PO rates differ.' },
  ] };
  assert.equal(remarkText(JSON.stringify(input), 'AUDIT'), 'Company mismatch. | Amount mismatch. | Qty mismatch. | Rate mismatch.');
});

test('happy path requires a passed reaudit and a passed final audit', () => {
  assert.equal(auditStage(row), 'AUDIT');
  const audited = { ...row, ...transition(row, 'AUDIT', report('AUDIT', 'passed'), now) };
  assert.equal(auditStage(audited), 'TALLY_ENTRY');
  const entered = { ...audited, actual4: now, status4: 'Done' };
  assert.equal(auditStage(entered), 'AGAIN_AUDIT');
  assert.equal(auditStage({ ...entered, ...humanReviewUpdate('AGAIN_AUDIT', 'Yes', 'admin', now) }), 'COMPLETED');
});
test('failed reaudit never releases to Tally and failed final timestamp never completes', () => {
  assert.equal(auditStage({ ...row, actual1: now, status1: 'Not Done', actual2: now, actual3: now, status3: 'Not Done' }), 'RECTIFY');
  assert.equal(auditStage({ ...row, actual1: now, status1: 'Done', actual4: now, status4: 'Done', actual5: now, status5: 'Not Done' }), 'AGAIN_AUDIT');
});
test('failed Rectify and failed Tally timestamps cannot advance the workflow', () => {
  assert.equal(auditStage({ ...row, actual1: now, status1: 'Not Done', actual2: now, status2: 'Not Done' }), 'RECTIFY');
  assert.equal(auditStage({ ...row, actual1: now, status1: 'Done', actual4: now, status4: 'Not Done', actual5: now, status5: 'Done' }), 'TALLY_ENTRY');
  assert.equal(auditStage({ ...row, actual1: now, status1: 'Not Done', actual2: now, status2: 'Done' }), 'REAUDIT');
});
test('small quantity differences are not treated as matching currency rounding', () => {
  assert.equal(sourceChecks(row, po, [{ ...stores[0], qty: '9.995' }], false, bill).find(c => c.name === 'Lift qty').passed, false);
});
test('malformed reports cannot crash rendering or leak an AI report into human remarks', () => {
  assert.doesNotThrow(() => remarkText('{"kind":"ai-audit","version":1,"checks":[null]}'));
  assert.equal(remarkText(JSON.stringify(report('AUDIT', 'passed')), 'RECTIFY'), '');
  assert.equal(remarkText(JSON.stringify(report('REAUDIT', 'passed')), 'AUDIT'), '');
  assert.equal(remarkText('Manually corrected bill number.', 'RECTIFY'), 'Manually corrected bill number.');
});
test('matching invoice, approved PO and receipt pass including tax in gross total', () => {
  assert.equal(sourceChecks(row, po, stores, false, bill).every(c => c.passed), true);
});
test('a PO of 100 allows separate 30 and 20 liftings with separate bills', () => {
  const first = { ...row, qty: '30', bill_amt: '3540', bill_no: 'B30' };
  const second = { ...row, id: 2, lift_number: 'L-2', qty: '20', bill_amt: '2360', bill_no: 'B20' };
  const receipts = [
    { ...stores[0], qty: '30', received_quantity: '30', bill_no: 'B30', bill_amount: '3540' },
    { ...stores[0], id: 2, lift_number: 'L-2', qty: '20', received_quantity: '20', bill_no: 'B20', bill_amount: '2360' },
  ];
  const firstBill = { ...bill, billNo: 'B30', total: 3540, items: [{ product: 'Brick', quantity: 30, rate: 100 }] };
  const secondBill = { ...bill, billNo: 'B20', total: 2360, items: [{ product: 'Brick', quantity: 20, rate: 100 }] };
  assert.equal(sourceChecks(first, po, receipts, false, firstBill).every(c => c.passed), true);
  assert.equal(sourceChecks(second, po, receipts, false, secondBill).every(c => c.passed), true);
  const progress = liftingProgress(second, po, receipts);
  assert.deepEqual(progress, { ordered: 100, current: 20, lifted: 50, received: 50, pending: 50, valid: true });
  assert.equal(remarkText(JSON.stringify({ ...report('AUDIT', 'passed'), lifting: progress })), 'Checks passed. Lift 20; total 50/100; pending 50.');
});
test('cumulative excess is detected even when each individual bill is below PO quantity', () => {
  const current = { ...row, qty: '20', bill_amt: '2360' };
  const receipts = [
    { ...stores[0], id: 9, lift_number: 'L-9', qty: '90', received_quantity: '90' },
    { ...stores[0], qty: '20', received_quantity: '20', bill_amount: '2360' },
  ];
  const invoice = { ...bill, total: 2360, items: [{ product: 'Brick', quantity: 20, rate: 100 }] };
  assert.equal(sourceChecks(current, po, receipts, false, invoice).every(c => c.passed), true);
  assert.equal(liftingProgress(current, po, receipts).pending, -10);
});
test('partial delivery is tracked in lifting progress without failing the four audit checks', () => {
  const current = { ...row, qty: '30', bill_amt: '3540' };
  const receipts = [{ ...stores[0], qty: '30', received_quantity: '28', bill_amount: '3540' }];
  const invoice = { ...bill, total: 3540, items: [{ product: 'Brick', quantity: 30, rate: 100 }] };
  assert.equal(sourceChecks(current, po, receipts, false, invoice).every(c => c.passed), true);
  assert.deepEqual(liftingProgress(current, po, receipts), { ordered: 100, current: 30, lifted: 30, received: 28, pending: 70, valid: true });
});
test('cancelled, unrelated and repeated copies do not inflate lifting totals', () => {
  const receipts = [stores[0], { ...stores[0] }, { ...stores[0], id: 2, qty: '90', lifting_status: 'Cancelled' }, { ...stores[0], id: 3, po_number: 'OTHER', qty: '999' }, { ...stores[0], id: 4, firm_name_match: 'OTHER', qty: '999' }];
  assert.equal(liftingProgress(row, po, receipts).lifted, 10);
});
test('wrong bill qty, lift qty, bill amount or lift amount is blocked', () => {
  for (const [inputRow, inputStores, failing] of [
    [{ ...row, qty: '9' }, stores, 'Bill qty'],
    [row, [{ ...stores[0], qty: '9' }], 'Lift qty'],
    [{ ...row, bill_amt: '1000' }, stores, 'Bill amount'],
    [row, [{ ...stores[0], bill_amount: '1000' }], 'Lift amount'],
  ]) assert.equal(sourceChecks(inputRow, po, inputStores, false, bill).find(c => c.name === failing).passed, false);
});
test('only the four audit checks run; company, vendor, rate, damage, approval and duplicates are ignored', () => {
  const lenient = { ...bill, firmName: 'Other firm', partyName: 'Someone else', billNo: 'OTHER' };
  assert.equal(sourceChecks(row, [{ ...po[0], rate: '99', party_name: 'X' }], [{ ...stores[0], damage_order: 'No', hod_status: '', received_quantity: '0' }], true, lenient).every(c => c.passed), true);
});
test('amount may match the bill total or the amount before tax', () => {
  const taxed = { ...bill, total: 1180, taxableValue: 1000 };
  const beforeTax = { ...row, bill_amt: '1000' };
  const checks = sourceChecks(beforeTax, po, [{ ...stores[0], bill_amount: '1000' }], false, taxed);
  assert.equal(checks.every(c => c.passed), true);
  assert.equal(sourceChecks({ ...row, bill_amt: '1100' }, po, stores, false, taxed).find(c => c.name === 'Bill amount').passed, false);
  assert.equal(sourceChecks(beforeTax, po, stores, false, { ...bill, taxableValue: -1 }).find(c => c.name === 'Bill amount').passed, false);
});
test('a handwritten single-line slip matches without the same product name', () => {
  const slip = { ...bill, total: 19190, billNo: '', firmName: '', partyName: '', items: [{ product: 'सुखी लकड़ी', quantity: 2020, rate: 9.5 }] };
  const wooden = { ...row, product_name: 'Wooden', qty: '2020', bill_amt: '19190' };
  const receipt = [{ ...stores[0], product_name: 'Wooden', qty: '2020', bill_amount: '19190' }];
  assert.equal(sourceChecks(wooden, po, receipt, false, slip).every(c => c.passed), true);
  const two = { ...slip, items: [...slip.items, { product: 'दूसरा', quantity: 1, rate: 1 }] };
  assert.equal(sourceChecks(wooden, po, receipt, false, two).find(c => c.name === 'Bill qty').passed, false);
});
test('ambiguous or missing bill products and missing lift receipt fail closed', () => {
  const twice = { ...bill, items: [...bill.items, ...bill.items] };
  assert.equal(sourceChecks(row, po, stores, false, twice).find(c => c.name === 'Bill qty').passed, false);
  assert.equal(sourceChecks(row, po, [], false, bill).find(c => c.name === 'Lift qty').passed, false);
  assert.equal(sourceChecks(row, po, [], false, bill).find(c => c.name === 'Lift amount').passed, false);
});
test('AI cannot process the human Rectify stage', () => {
  assert.throws(() => transition(row, 'RECTIFY', report('RECTIFY', 'passed'), now), /human-only/);
  assert.throws(() => transition(row, 'RECTIFY', report('RECTIFY', 'error'), now), /human-only/);
});
test('AI stages write only their own remarks and reject a mismatched report', () => {
  for (const [stage, field] of [['AUDIT', 'remarks1'], ['REAUDIT', 'remarks3']]) {
    const patch = transition(row, stage, report(stage, 'exception'), now);
    assert.deepEqual(Object.keys(patch).filter(k => k.startsWith('remarks')), [field]);
    assert.equal(patch.remarks2, undefined);
    assert.equal(patch.remarks4, undefined);
  }
  assert.throws(() => transition(row, 'AUDIT', report('REAUDIT', 'passed'), now), /stage mismatch/);
  assert.throws(() => transition(row, 'AUDIT', report('AUDIT', 'processing'), now), /incomplete/);
  assert.throws(() => transition(row, 'AUDIT', { ...report('AUDIT', 'passed'), checks: [{ name: 'Quantity', passed: false, detail: 'Mismatch' }] }, now), /failed check/);
});
test('system errors remain visible instead of displaying stale discarded checks', () => {
  const input = { ...report('AUDIT', 'error'), summary: 'Source data changed; retry required.', checks: [{ name: 'Quantity', passed: false, detail: 'Old mismatch' }] };
  assert.equal(remarkText(JSON.stringify(input)), 'Source data changed; retry required.');
});
test('legacy Hindi AI reports render in English without changing human remarks', () => {
  const localized = englishReport({ ...report('AUDIT', 'exception'), checks: [{ name: 'Quantity', passed: false, detail: 'बिल 100; प्राप्त 90; ऐप 100।' }] });
  assert.equal(remarkText(JSON.stringify(localized)), 'Qty: Bill 100 / received 90 / app 100.');
  assert.equal(localized.summary, '1 issue. Correction needed.');
  assert.equal(remarkText('Human correction: INV-123'), 'Human correction: INV-123');
  assert.equal(remarkText(JSON.stringify(report('AUDIT', 'passed'))), 'All checks passed.');
});
test('failed AI Reaudit sends the record back to human Rectify', () => {
  const input = { ...row, actual1: now, status1: 'Not Done', actual2: now };
  const updates = transition(input, 'REAUDIT', report('REAUDIT', 'exception'), now);
  assert.equal(auditStage({ ...input, ...updates }), 'RECTIFY');
});
test('AI remarks list every failed check briefly, without successful checks', () => {
  const text = remarkText(JSON.stringify({ ...report('AUDIT', 'exception'), checks: [
    { name: 'Quantity', passed: false, detail: 'Bill 100; received 90.' },
    { name: 'Vendor', passed: true, detail: 'Matches' },
    { name: 'Rate', passed: false, detail: 'Bill 50; PO 45.' },
  ] }));
  assert.equal(text, 'Qty: Bill 100 / received 90. | Rate: Bill 50 / PO 45.');
});
test('human final rejection returns to Tally and confirmation resubmits for human review', () => {
  const input = { ...row, actual1: now, status1: 'Done', actual4: now, status4: 'Done' };
  const rejected = { ...input, ...humanReviewUpdate('AGAIN_AUDIT', 'No', 'admin', now) };
  assert.equal(auditStage(rejected), 'TALLY_ENTRY');
  assert.equal(rejected.actual5, null);
  const resubmitted = { ...rejected, ...humanReviewUpdate('TALLY_ENTRY', 'Yes', 'admin', now) };
  assert.equal(auditStage(resubmitted), 'AGAIN_AUDIT');
  assert.equal(resubmitted.remarks5, '');
  assert.deepEqual(humanReviewUpdate('TALLY_ENTRY', 'No', 'admin', now), {});
});
test('provider errors never move workflow or correct business data', () => {
  const updates = transition(row, 'AUDIT', report('AUDIT', 'error'), now);
  assert.equal(updates.actual1, undefined);
  assert.equal(updates.status1, 'AI Error');
});
test('AI cannot approve or reject the human Again Audit stage', () => {
  for (const outcome of ['passed', 'exception', 'error']) {
    assert.throws(() => transition(row, 'AGAIN_AUDIT', report('AGAIN_AUDIT', outcome), now), /human-only/);
  }
  assert.throws(() => humanReviewUpdate('AGAIN_AUDIT', 'Maybe', 'admin', now));
  assert.throws(() => humanReviewUpdate('AGAIN_AUDIT', 'Yes', '', now));
});
test('invalid and incomplete model results are rejected', () => {
  assert.throws(() => validateDocument({ total: 1180 }));
  assert.throws(() => validateDocument({ ...bill, items: [{ product: 'Brick', quantity: '10', rate: 100 }] }));
});
test('proof metadata is required and reports remain readable', () => {
  assert.equal(readVoucher('legacy remarks'), null);
  assert.equal(readVoucher(JSON.stringify({ kind: 'tally-voucher', voucherNo: '1', voucherDate: now })), null);
  assert.equal(remarkText(JSON.stringify(report('AUDIT', 'exception'))), 'Checked');
});
