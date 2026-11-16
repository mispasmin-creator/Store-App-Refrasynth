type StockIssue = { product_name: string; actual1: string; status: string; given_qty: number };

export const stockProductKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

// The issue table records product-level movements, without a firm allocation.
// With `since`, issues dated before it are skipped (already reflected in a physical count).
export function issuedStockByProduct(issues: StockIssue[], since?: Date | null): Map<string, number> {
    const totals = new Map<string, number>();
    for (const issue of issues) {
        const key = stockProductKey(issue.product_name);
        const quantity = Number(issue.given_qty);
        if (!key || !issue.actual1?.trim() || issue.status.trim().toLowerCase() !== 'yes' || !Number.isFinite(quantity) || quantity <= 0) continue;
        if (since && new Date(issue.actual1) < since) continue;
        totals.set(key, (totals.get(key) || 0) + quantity);
    }
    return totals;
}
