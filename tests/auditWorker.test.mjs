import test from 'node:test';
import assert from 'node:assert/strict';

let handler;
const settings = {
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  AUDIT_WORKER_SECRET: 'test-worker-secret', OPENAI_API_KEY: 'test-ai-key',
  AUDIT_AI_MODEL: 'test-model', AUDIT_AUTOMATION_ENABLED: 'true',
};
globalThis.Deno = { env: { get: key => settings[key] }, serve: fn => { handler = fn; } };
await import('../supabase/functions/audit-automation/index.ts');

const original = { id: 1, firm_name_match: 'Factory', party_name: 'Supplier', po_number: 'PO-1', lift_number: 'L-1', indent_number: 'I-1', product_name: 'Brick', bill_no: 'INV-1', bill_amt: '1180', qty: '10', rate: '100', bill_image: 'https://example.supabase.co/storage/v1/object/public/images/bill.pdf', actual1: null, actual2: null, actual3: null, actual4: null, actual5: null, status1: null, status3: null, status5: null, remarks1: null, remarks4: null };
const invoice = { billNo: 'INV-1', partyName: 'Supplier', firmName: 'Factory', total: 1180, voucherNo: '', voucherDate: '', items: [{ product: 'Brick', quantity: 10, rate: 100 }] };
const response = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const post = body => new Request('https://example.supabase.co/functions/v1/audit-automation', { method: 'POST', headers: { 'x-audit-worker-secret': settings.AUDIT_WORKER_SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function mockBackend({ modelFailure = false, conflict = false, sourceConflict = false, customRow = {} } = {}) {
  let saved = { ...original, ...customRow };
  const writes = [];
  let providerCalls = 0;
  let poReads = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.hostname === 'api.openai.com') {
      providerCalls++;
      const payload = JSON.parse(init.body);
      assert.equal(payload.store, false);
      assert.equal(payload.text.format.strict, true);
      assert.equal(payload.input[0].content[1].type, 'input_file');
      assert.match(payload.input[0].content[1].file_data, /^data:application\/pdf;base64,/);
      return modelFailure ? new Response('unavailable', { status: 503 }) : response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(invoice) }] }] });
    }
    if (url.pathname.startsWith('/storage/')) return new Response('%PDF mock', { headers: { 'Content-Type': 'application/pdf' } });
    if (url.pathname === '/rest/v1/po_master') { poReads++; return response([{ id: 1, product: 'Brick', party_name: 'Supplier', quantity: '100', rate: sourceConflict && poReads > 1 ? '99' : '100' }]); }
    if (url.pathname === '/rest/v1/store_in') return response([{ id: 1, firm_name_match: 'Factory', po_number: 'PO-1', lift_number: 'L-1', indent_no: 'I-1', product_name: 'Brick', qty: '10', hod_status: 'Approved', received_quantity: '10', quantity_as_per_bill: 'Yes', damage_order: 'Yes', bill_received2: 'Yes', bill_no: 'INV-1', bill_amount: '1180' }]);
    if (url.pathname === '/rest/v1/tally_entry') {
      if (init.method === 'PATCH') {
        if (conflict && writes.length === 0) return response([]);
        const patch = JSON.parse(init.body);
        writes.push(patch); saved = { ...saved, ...patch };
        return response([saved]);
      }
      if (url.searchParams.get('select') !== '*') return response([{ id: saved.id, bill_no: saved.bill_no, po_number: saved.po_number, lift_number: saved.lift_number, indent_number: saved.indent_number, product_name: saved.product_name }]);
      return response([saved]);
    }
    throw new Error(`Unexpected fetch ${url.origin}${url.pathname}`);
  };
  return { writes, get providerCalls() { return providerCalls; }, get saved() { return saved; } };
}

test('worker health exposes no credentials and rejects anonymous POST', async () => {
  const health = await (await handler(new Request('https://example.test'))).json();
  assert.deepEqual(health, { configured: true, enabled: true, mode: 'scheduled-worker' });
  const denied = await handler(new Request('https://example.test', { method: 'POST', body: '{}' }));
  assert.equal(denied.status, 401);
});
test('default dry run extracts real document bytes but makes no database writes', async () => {
  const backend = mockBackend();
  const result = await (await handler(post({}))).json();
  assert.equal(result.dryRun, true);
  assert.equal(result.results[0].report.outcome, 'passed');
  assert.equal(backend.providerCalls, 1);
  assert.equal(backend.writes.length, 0);
});
test('live worker claims and commits passed Audit to manual Tally Entry', async () => {
  const backend = mockBackend();
  const result = await (await handler(post({ dryRun: false }))).json();
  assert.equal(result.results[0].report.outcome, 'passed');
  assert.equal(backend.writes.length, 2);
  assert.equal(backend.saved.status1, 'Done');
  assert.ok(backend.saved.actual1);
  assert.ok(backend.saved.planned4);
  assert.equal(backend.saved.actual4, null);
  assert.equal(backend.saved.actual5, null);
});

test('Again Audit is human-only and never calls AI or writes', async () => {
  const now = new Date().toISOString();
  const backend = mockBackend({ customRow: { actual1: now, status1: 'Done', actual4: now, status4: 'Done' } });
  const result = await (await handler(post({ id: 1, dryRun: false }))).json();
  assert.equal(result.results[0].skipped, 'AGAIN_AUDIT');
  assert.equal(backend.providerCalls, 0);
  assert.equal(backend.writes.length, 0);
});


test('conflicting claim does not call AI or advance workflow', async () => {
  const backend = mockBackend({ conflict: true });
  const result = await (await handler(post({ dryRun: false }))).json();
  assert.match(result.results[0].skipped, /another worker/);
  assert.equal(backend.providerCalls, 0);
  assert.equal(backend.saved.actual1, null);
});
test('provider outage stores a retry report and preserves pending stage', async () => {
  const backend = mockBackend({ modelFailure: true });
  const result = await (await handler(post({ dryRun: false }))).json();
  assert.equal(result.results[0].report.outcome, 'error');
  assert.equal(backend.saved.status1, 'AI Error');
  assert.equal(backend.saved.actual1, null);
  assert.ok(JSON.parse(backend.saved.remarks1).retryAt);
});
test('external invoice URL is rejected before any provider call', async () => {
  const backend = mockBackend({ customRow: { bill_image: 'http://169.254.169.254/metadata' } });
  const result = await (await handler(post({ dryRun: false }))).json();
  assert.equal(result.results[0].report.outcome, 'error');
  assert.equal(backend.providerCalls, 0);
  assert.equal(backend.saved.actual1, null);
});
test('disabled worker does not access documents or database', async () => {
  const backend = mockBackend();
  settings.AUDIT_AUTOMATION_ENABLED = 'false';
  try { assert.equal((await handler(post({ dryRun: false }))).status, 503); }
  finally { settings.AUDIT_AUTOMATION_ENABLED = 'true'; }
  assert.equal(backend.providerCalls, 0);
  assert.equal(backend.writes.length, 0);
});
test('source edit during inference discards the result before stage advancement', async () => {
  const backend = mockBackend({ sourceConflict: true });
  const result = await (await handler(post({ dryRun: false }))).json();
  assert.equal(result.results[0].report.outcome, 'error');
  assert.match(result.results[0].report.summary, /Source data changed/);
  assert.equal(backend.saved.actual1, null);
});
test('a paused worker allows authenticated dry runs without accounting writes', async () => {
  const backend = mockBackend();
  settings.AUDIT_AUTOMATION_ENABLED = 'false';
  try {
    const result = await (await handler(post({ dryRun: true }))).json();
    assert.equal(result.results[0].report.outcome, 'passed');
    assert.equal(backend.writes.length, 0);
  } finally { settings.AUDIT_AUTOMATION_ENABLED = 'true'; }
});
test('the worker leaves Rectify to humans without AI calls or writes', async () => {
  const backend = mockBackend({ customRow: { actual1: '2026-10-21T06:00:00Z', status1: 'Not Done', actual2: null } });
  const result = await (await handler(post({ id: 1, dryRun: false }))).json();
  assert.equal(result.results[0].skipped, 'RECTIFY');
  assert.equal(backend.providerCalls, 0);
  assert.equal(backend.writes.length, 0);
});
test('old completed records cannot hide a pending bill on a later page', async () => {
  const backend = mockBackend({ customRow: { id: 101 } });
  const mocked = globalThis.fetch;
  let pages = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/rest/v1/tally_entry' && url.searchParams.get('select') === '*' && init.method !== 'PATCH') {
      pages++;
      if (url.searchParams.get('offset') === '0') return response(Array.from({ length: 100 }, (_, i) => ({ ...original, id: i + 1, actual1: '2026-10-21', status1: 'Done', actual4: '2026-10-21', status4: 'Done', actual5: '2026-10-21', status5: 'Done' })));
    }
    return mocked(input, init);
  };
  const result = await (await handler(post({ dryRun: true }))).json();
  assert.equal(pages, 2);
  assert.equal(result.results[0].id, 101);
  assert.equal(backend.providerCalls, 1);
  assert.equal(backend.writes.length, 0);
});
test('invalid requested record ID is rejected before accessing invoices', async () => {
  const backend = mockBackend();
  assert.equal((await handler(post({ id: -1 }))).status, 400);
  assert.equal(backend.providerCalls, 0);
});
test('all lifting-source pages are read before matching the current receipt', async () => {
  mockBackend(); const mocked = globalThis.fetch;
  let pages = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/rest/v1/store_in') {
      pages++;
      if (url.searchParams.get('offset') === '0') return response(Array.from({ length: 500 }, (_, i) => ({ id: i + 1, product_name: 'Other product', qty: '1' })));
      return response([{ id: 501, firm_name_match: 'Factory', po_number: 'PO-1', lift_number: 'L-1', indent_no: 'I-1', product_name: 'Brick', qty: '10', received_quantity: '10', hod_status: 'Approved', quantity_as_per_bill: 'Yes', damage_order: 'Yes', bill_received2: 'Yes', bill_no: 'INV-1', bill_amount: '1180' }]);
    }
    return mocked(input, init);
  };
  const result = await (await handler(post({ dryRun: true }))).json();
  assert.equal(pages, 2);
  assert.equal(result.results[0].report.outcome, 'passed');
  assert.equal(result.results[0].report.lifting.lifted, 10);
});
test('deployed configuration uses a protected token hash without an environment worker secret', async () => {
  const secret = settings.AUDIT_WORKER_SECRET;
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))).toString('hex');
  const backend = mockBackend(); const mocked = globalThis.fetch;
  globalThis.fetch = async (input, init) => new URL(input).pathname === '/rest/v1/audit_automation_config' ? response([{ id: 1, enabled: false, model: 'gpt-5.4-mini', worker_secret_hash: hash }]) : mocked(input, init);
  delete settings.AUDIT_WORKER_SECRET;
  try {
    const request = new Request('https://example.test', { method: 'POST', headers: { 'x-audit-worker-secret': secret, 'Content-Type': 'application/json' }, body: '{"dryRun":true}' });
    const result = await (await handler(request)).json();
    assert.equal(result.results[0].report.outcome, 'passed');
    assert.equal(backend.writes.length, 0);
  } finally { settings.AUDIT_WORKER_SECRET = secret; }
});
