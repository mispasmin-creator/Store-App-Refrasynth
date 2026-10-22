import test from 'node:test';
import assert from 'node:assert/strict';
import { issuedStockByProduct } from '../src/lib/issueStock.ts';

const issue = (overrides = {}) => ({ product_name: 'Steel Pipe', actual1: '2026-10-21', status: 'Yes', given_qty: 20, ...overrides });

test('Update Issue deducts the given quantity, rather than requested quantity', () => {
    const issued = issuedStockByProduct([issue({ quantity: 50 })]);
    assert.equal(100 - issued.get('steel pipe'), 80);
});
test('pending and rejected issues do not deduct stock', () => {
    const issued = issuedStockByProduct([issue({ actual1: '' }), issue({ status: 'No' })]);
    assert.equal(issued.size, 0);
});
test('separate products on the same issue remain separate movements', () => {
    const issued = issuedStockByProduct([issue({ issue_no: 'IS-1' }), issue({ issue_no: 'IS-1', product_name: 'Cement', given_qty: 5 }), issue({ product_name: ' steel  PIPE ', given_qty: 10 })]);
    assert.equal(issued.get('steel pipe'), 30);
    assert.equal(issued.get('cement'), 5);
});
test('invalid quantities cannot create stock or corrupt totals', () => {
    const issued = issuedStockByProduct([issue({ given_qty: -2 }), issue({ given_qty: NaN }), issue({ given_qty: Infinity }), issue({ given_qty: 0 })]);
    assert.equal(issued.size, 0);
});
