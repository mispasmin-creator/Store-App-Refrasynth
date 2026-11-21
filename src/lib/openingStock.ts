import { supabase } from '@/lib/supabase';
import { stockProductKey } from '@/lib/issueStock';

export type OpeningItem = {
    itemName: string;
    uom: string;
    loc: string;
    groupMaster: string;
    groupHead: string;
    qty: number;
};

export type OpeningStock = {
    items: Map<string, OpeningItem>;
    /** Receipts/issues dated before this are already part of the physical count. */
    cutoff: Date | null;
};

// Physical-count stock (opening_stock table). Only rows matched to a master item are used.
export async function fetchOpeningStock(): Promise<OpeningStock> {
    const items = new Map<string, OpeningItem>();
    let cutoff: Date | null = null;
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('opening_stock')
            .select('item_name, uom, loc, group_master, group_head, qty, created_at, matched')
            .eq('matched', true).order('id').range(offset, offset + 999);
        if (error) throw error;
        for (const r of data || []) {
            const key = stockProductKey(r.item_name || '');
            if (!key) continue;
            const existing = items.get(key);
            if (existing) {
                existing.qty += Number(r.qty) || 0;
            } else {
                items.set(key, {
                    itemName: r.item_name,
                    uom: r.uom || '',
                    loc: r.loc || '',
                    groupMaster: r.group_master || '',
                    groupHead: r.group_head || '',
                    qty: Number(r.qty) || 0,
                });
            }
            const created = new Date(r.created_at);
            created.setHours(0, 0, 0, 0);
            if (!cutoff || created < cutoff) cutoff = created;
        }
        if (!data || data.length < 1000) break;
    }
    return { items, cutoff };
}

// True when the movement happened on/after the physical count (or there is no count).
export function afterCutoff(timestamp: string | null | undefined, cutoff: Date | null): boolean {
    if (!cutoff) return true;
    const date = new Date(timestamp || '');
    return Number.isNaN(date.getTime()) || date >= cutoff;
}
