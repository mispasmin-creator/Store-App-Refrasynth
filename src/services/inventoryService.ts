import { supabase } from '@/lib/supabase';

/**
 * Inventory Service
 * Handles all Supabase operations for the Inventory component
 */

export interface InventoryRecord {
    itemName: string;
    groupHead: string;
    uom: string;
    opening: number;
    rate: number;
    indented: number;
    approved: number;
    purchaseQuantity: number;
    outQuantity: number;
    current: number;
    minStock: number;
    maxStock: number;
    totalPrice: number;
    status: string;
    firmName: string;
}

/**
 * Fetch all inventory records from Supabase
 */
export async function fetchInventoryRecords(): Promise<InventoryRecord[]> {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('item_name', { ascending: true });

        if (error) throw error;

        return (data || []).map((row: any) => ({
            itemName: row.item_name || '',
            groupHead: row.group_name || '',
            uom: row.uom || '',
            opening: Number(row.opening) || 0,
            rate: Number(row.rate) || 0,
            indented: Number(row.indented) || 0,
            approved: Number(row.approved) || 0,
            purchaseQuantity: Number(row.purchase_quantity) || 0,
            outQuantity: Number(row.out_quantity) || 0,
            current: Number(row.current) || 0,
            minStock: Number(row.min_stock) || 0,
            maxStock: Number(row.max_stock) || 0,
            totalPrice: Number(row.total_price) || 0,
            status: row.status || 'In Stock',
            firmName: row.firm_name || '',
        })) as InventoryRecord[];
    } catch (error) {
        console.error('Error fetching inventory records:', error);
        throw error;
    }
}
