import { supabase } from '@/lib/supabase';

/**
 * Issue Service
 * Handles all Supabase operations for the Issue component
 */

// ==================== INTERFACES ====================

export interface IssueRecord {
    issue_no: string;
    issue_to: string;
    uom: string;
    product_name: string;
    quantity: number;
    department: string;
    group_head: string;
    planned1: string;
    actual1: string;
    status: string;
    given_qty: number;
    timestamp?: string;
    location?: string;
    firm_name_match?: string;
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all issue records from Supabase
 */
export async function fetchIssueRecords(): Promise<IssueRecord[]> {
    try {
        const { data, error } = await supabase
            .from('issue')
            .select('*')
            .order('issue_no', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            issue_no: r.issue_no || '',
            issue_to: r.issue_to || '',
            uom: r.uom || '',
            product_name: r.product_name || '',
            quantity: Number(r.quantity) || 0,
            department: r.category || '',
            group_head: r.group_name || '',
            planned1: r.planned1 || '',
            actual1: r.actual1 || '',
            status: r.status || '',
            given_qty: Number(r.given_qty) || 0,
            timestamp: r.timestamp || '',
            location: r.location || '',
            firm_name_match: r.firm_name_match || '',
        }));
    } catch (error) {
        console.error('Error fetching issue records:', error);
        throw error;
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update issue record with approval details
 * @param issue_no - Issue number to identify the record
 * @param updateData - Data to update
 */
export async function updateIssueApproval(
    issue_no: string,
    updateData: {
        actual1: string;
        status: string;
        given_qty?: number | null;
    }
) {
    try {
        const { error } = await supabase
            .from('issue')
            .update({
                actual1: updateData.actual1,
                status: updateData.status,
                given_qty: updateData.given_qty,
            })
            .eq('issue_no', issue_no);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating issue approval:', error);
        throw error;
    }
}
/**
 * Create new issue records in Supabase
 * @param rows - Array of issue records to insert
 */
export async function createIssueRecords(rows: Partial<IssueRecord>[]) {
    try {
        const mappedRows = rows.map(r => ({
            timestamp: r.timestamp || r.planned1 || new Date().toISOString(),
            issue_no: r.issue_no,
            issue_to: r.issue_to,
            uom: r.uom,
            product_name: r.product_name,
            quantity: String(r.quantity),
            category: r.department,
            group_name: r.group_head,
            planned1: r.planned1,
            actual1: r.actual1,
            status: r.status || 'Pending',
            given_qty: r.given_qty ? String(r.given_qty) : '0'
        }));

        const { data, error } = await supabase
            .from('issue')
            .insert(mappedRows)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating issue records:', error);
        throw error;
    }
}
