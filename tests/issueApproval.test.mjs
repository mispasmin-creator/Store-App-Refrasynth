import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual service with a database client double, without modifying stock.
let result = { data: [{ id: 28 }], error: null };
let filters = [];
let payload;
const query = {
  update(value) { payload = value; return this; },
  eq(field, value) { filters.push(['eq', field, value]); return this; },
  is(field, value) { filters.push(['is', field, value]); return this; },
  select() { return Promise.resolve(result); },
};
globalThis.__issueApprovalTestClient = { from(table) { assert.equal(table, 'issue'); return query; } };
const source = readFileSync(new URL('../src/services/issueService.ts', import.meta.url), 'utf8')
  .replace("import { supabase } from '@/lib/supabase';", 'const supabase = globalThis.__issueApprovalTestClient;');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { updateIssueApproval } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
delete globalThis.__issueApprovalTestClient;

test('issue approval checks NULL timestamp without an invalid empty-date comparison', async () => {
  filters = [];
  await updateIssueApproval(28, { actual1: '2026-10-23T07:00:00Z', status: 'Yes', given_qty: 20 });
  assert.deepEqual(filters, [['eq', 'id', 28], ['is', 'actual1', null]]);
  assert.equal(payload.given_qty, 20);
});

test('rejected issue clears quantity and cannot deduct stock', async () => {
  await updateIssueApproval(28, { actual1: '2026-10-23T07:00:00Z', status: 'No', given_qty: 20 });
  assert.equal(payload.given_qty, null);
});

test('concurrent approval and invalid quantities cannot report success', async (context) => {
  context.mock.method(console, 'error', () => {});
  result = { data: [], error: null };
  await assert.rejects(updateIssueApproval(28, { actual1: '2026-10-23T07:00:00Z', status: 'Yes', given_qty: 20 }), /already updated/);
  await assert.rejects(updateIssueApproval(28, { actual1: '2026-10-23T07:00:00Z', status: 'Yes', given_qty: -1 }), /greater than zero/);
  await assert.rejects(updateIssueApproval(28, { actual1: '2026-10-23T07:00:00Z', status: 'Other' }), /Yes or No/);
});
