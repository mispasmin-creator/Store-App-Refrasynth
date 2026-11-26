import test from 'node:test';
import assert from 'node:assert/strict';
import { storeInDecisionSchema, submitStoreInSelection } from '../src/lib/storeInDecision.ts';

const at = '2026-11-26T06:00:00.000Z';
const selection = (status, items) => ({ items: items.map(item => ({ ...item, status })) });

test('receive selection first, then reject remaining items in a separate submission', async () => {
    const pending = new Set([101, 102, 103]);
    const saved = new Map();
    const save = async (id, update) => { saved.set(id, update); pending.delete(id); };
    await submitStoreInSelection(selection('Received', [{ id: 101, remark: 'Checked' }]), [...pending], at, save);
    assert.deepEqual([...pending], [102, 103]);
    assert.equal(saved.size, 1);
    assert.equal(saved.get(101).receiving_status, 'Received');
    assert.equal(saved.get(101).hod_planned, at);
    assert.equal(saved.get(101).planned7, null);
    await submitStoreInSelection(selection('Not Received', [{ id: 102, remark: '  Damaged  ' }]), [...pending], at, save);
    assert.deepEqual([...pending], [103]);
    assert.equal(saved.get(101).remark, 'Checked');
    assert.equal(saved.get(102).receiving_status, 'Not Received');
    assert.equal(saved.get(102).remark, 'Damaged');
    assert.equal(saved.get(102).planned7, at);
    assert.equal(saved.get(102).hod_planned, null);
});

test('empty, duplicate, stale and invalid selections cannot write records', async () => {
    let writes = 0;
    const save = async () => { writes++; };
    for (const values of [
        selection('Received', []),
        { items: [{ id: 101, remark: '' }] },
        selection('Received', [{ id: 101, remark: '' }, { id: 101, remark: '' }]),
        selection('Received', [{ id: 999, remark: '' }]),
        selection('Not Received', [{ id: 101, remark: '  ' }]),
    ]) await assert.rejects(submitStoreInSelection(values, [101, 102], at, save));
    assert.equal(writes, 0);
});

test('rejection requires a separate reason for each selected item', () => {
    const result = storeInDecisionSchema.safeParse(selection('Not Received', [
        { id: 101, remark: 'Damaged' }, { id: 102, remark: '' },
    ]));
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues[0].path, ['items', 1, 'remark']);
    assert.equal(storeInDecisionSchema.safeParse(selection('Received', [{ id: 101, remark: '' }])).success, true);
});

test('failed save stops the batch and leaves later items untouched', async () => {
    const saved = [];
    await assert.rejects(submitStoreInSelection(selection('Received', [
        { id: 101, remark: '' }, { id: 102, remark: '' }, { id: 103, remark: '' },
    ]), [101, 102, 103], at, async id => {
        if (id === 102) throw new Error('Save failed');
        saved.push(id);
    }), /Save failed/);
    assert.deepEqual(saved, [101]);
});

test('each selected row saves its own decision and remark', async () => {
    const saved = new Map();
    await submitStoreInSelection({ items: [
        { id: 101, status: 'Received', remark: 'Checked' },
        { id: 102, status: 'Not Received', remark: 'Damaged' },
    ] }, [101, 102, 103], at, async (id, update) => { saved.set(id, update); });
    assert.equal(saved.get(101).receiving_status, 'Received');
    assert.equal(saved.get(101).remark, 'Checked');
    assert.equal(saved.get(101).hod_planned, at);
    assert.equal(saved.get(102).receiving_status, 'Not Received');
    assert.equal(saved.get(102).remark, 'Damaged');
    assert.equal(saved.get(102).planned7, at);
    assert.equal(saved.has(103), false);
});

test('an undecided selected row prevents all writes', async () => {
    let writes = 0;
    await assert.rejects(submitStoreInSelection({ items: [
        { id: 101, status: 'Received', remark: '' },
        { id: 102, status: '', remark: '' },
    ] }, [101, 102], at, async () => { writes++; }));
    assert.equal(writes, 0);
});
