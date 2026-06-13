import { supabase } from '@/lib/supabase';

/**
 * Indent Service
 * Handles all Supabase operations for Indents
 */

// ==================== INTERFACES ====================

export interface IndentRecord {
    id: number; // Added
    indent_number: string;
    indenter_name: string;
    department: string;
    product_name: string;
    quantity: number;
    uom: string;
    attachment: string;
    specifications: string;
    area_of_use: string; // Added
    vendor_type: string;
    indent_status: string;
    indent_type: string;
    no_day: number;
    planned1: string;
    actual1: string;
    firm_name_match: string;
    approved_quantity: number;
    timestamp: string;
    price: number;
    total_rate: number;
    // Approval fields
    indent_approved_by: string;
    approved_date: string;
    // Stage 2 fields
    planned2: string;
    actual2: string;
    vendor_name: string;
    negotiated_rate: number;
    // Stage 3 fields
    planned3: string;
    actual3: string;
    attachment3: string;
    comparative_analysis: string;
    // Stage 4 fields
    planned4: string;
    actual4: string;
    po_number: string;
    po_date: string;
    po_copy: string;
    // Stage 5 fields
    planned5: string;
    actual5: string;
    transportation_include: string;
    tax_extra: string;
    credit_days: number;
    remarks5: string;
    status: string;
    lifting_status?: string;
    po_qty?: number;
    received_quantity?: number;
    pending_qty?: number;
    vendor1_rank?: string;
    vendor2_rank?: string;
    vendor3_rank?: string;
    expected_req_date: string;
    group_head: string;
    firm_name: string;
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all indent records from Supabase
 */
export async function fetchIndentRecords(): Promise<IndentRecord[]> {
    try {
        const { data, error } = await supabase
            .from('indent')
            .select('*')
            .order('indent_number', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            id: r.id, // Added
            indent_number: r.indent_number || '',
            indenter_name: r.indenter_name || '',
            department: r.department || '',
            product_name: r.product_name || '',
            quantity: Number(r.quantity) || 0,
            uom: r.uom || '',
            attachment: r.attachment || '',
            specifications: r.specifications || '',
            area_of_use: r.area_of_use || '', // Added
            vendor_type: r.vendor_type || 'Pending',
            indent_status: r.indent_status || '',
            indent_type: r.indent_type || '',
            no_day: Number(r.no_day) || 0,
            planned1: r.planned1 || '',
            actual1: r.actual1 || '',
            firm_name_match: r.firm_name || r.firm_name_match || '',
            approved_quantity: Number(r.approved_quantity) || 0,
            timestamp: r.timestamp || '',
            price: Number(r.price) || 0,
            total_rate: Number(r.total_rate) || 0,
            indent_approved_by: r.indent_approved_by || '',
            approved_date: r.approved_date || '',
            planned2: r.planned2 || '',
            actual2: r.actual2 || '',
            vendor_name: r.vendor_name || '',
            negotiated_rate: Number(r.negotiated_rate) || 0,
            planned3: r.planned3 || '',
            actual3: r.actual3 || '',
            attachment3: r.attachment3 || '',
            comparative_analysis: r.comparative_analysis || '',
            planned4: r.planned4 || '',
            actual4: r.actual4 || '',
            po_number: r.po_number || '',
            po_date: r.po_date || '',
            po_copy: r.po_copy || '',
            planned5: r.planned5 || '',
            actual5: r.actual5 || '',
            transportation_include: r.transportation_include || '',
            tax_extra: r.tax_extra || '',
            credit_days: Number(r.credit_days) || 0,
            remarks5: r.remarks5 || '',
            status: r.status || '',
            lifting_status: r.lifting_status || '',
            po_qty: Number(r.po_qty) || 0,
            received_quantity: Number(r.received_quantity) || 0,
            pending_qty: Number(r.pending_qty) || 0,
            vendor1_rank: r.vendor1_rank || '',
            vendor2_rank: r.vendor2_rank || '',
            vendor3_rank: r.vendor3_rank || '',
            expected_req_date: r.expected_req_date || '',
            group_head: r.group_head || '',
            firm_name: r.firm_name || r.firm_name_match || '',
        }));
    } catch (error) {
        console.error('Error fetching indent records:', error);
        throw error;
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update indent record for Stage 1: Approval
 */
export async function updateIndentApproval(
    id: number,
    updateData: {
        actual1: string;
        vendor_type: string;
        approved_quantity: number;
        planned2?: string;
    }
) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({
                actual1: updateData.actual1,
                vendor_type: updateData.vendor_type,
                approved_quantity: updateData.approved_quantity,
                planned2: updateData.planned2,
            })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating indent approval:', error);
        throw error;
    }
}

/**
 * Update indent specifications
 */
export async function updateIndentSpecifications(id: number, specifications: string) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({ specifications })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating indent specifications:', error);
        throw error;
    }
}

/**
 * Update indent fields from history edit
 */
export async function updateIndentHistoryFields(
    id: number,
    updateData: {
        approved_quantity?: number;
        uom?: string;
        vendor_type?: string;
    }
) {
    try {
        const { error } = await supabase
            .from('indent')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating indent history fields:', error);
        throw error;
    }
}

/**
 * Update indent for Stage 2: Vendor Selection
 */
export async function updateIndentVendorSelection(
    indentNumber: string,
    updateData: {
        actual2: string;
        vendor_name: string;
        negotiated_rate: number;
        planned3: string;
    }
) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({
                actual2: updateData.actual2,
                vendor_name: updateData.vendor_name,
                negotiated_rate: updateData.negotiated_rate,
                planned3: updateData.planned3,
            })
            .eq('indent_number', indentNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating indent vendor selection:', error);
        throw error;
    }
}

/**
 * Update indent for Stage 3: HOD Approval (Comparative Analysis)
 */
export async function updateIndentHODApproval(
    indentNumber: string,
    updateData: {
        actual3: string;
        comparative_analysis: string;
        attachment3: string;
        planned4: string;
    }
) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({
                actual3: updateData.actual3,
                comparative_analysis: updateData.comparative_analysis,
                attachment3: updateData.attachment3,
                planned4: updateData.planned4,
            })
            .eq('indent_number', indentNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating indent HOD approval:', error);
        throw error;
    }
}

/**
 * Update indent for Stage 4: PO Creation
 */
export async function updateIndentPOCreation(
    indentNumber: string,
    updateData: {
        actual4: string;
        po_number: string;
        po_date: string;
        po_copy: string;
        planned5: string;
    }
) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({
                actual4: updateData.actual4,
                po_number: updateData.po_number,
                po_date: updateData.po_date,
                po_copy: updateData.po_copy,
                planned5: updateData.planned5,
            })
            .eq('indent_number', indentNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating indent PO creation:', error);
        throw error;
    }
}

/**
 * Update indent for Stage 5: Payment Terms (Final Stage)
 */
export async function updateIndentPaymentTerms(
    indentNumber: string,
    updateData: {
        actual5: string;
        transportation_include: string;
        tax_extra: string;
        credit_days: number;
        remarks5: string;
    }
) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({
                actual5: updateData.actual5,
                transportation_include: updateData.transportation_include,
                tax_extra: updateData.tax_extra,
                credit_days: updateData.credit_days,
                remarks5: updateData.remarks5,
            })
            .eq('indent_number', indentNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating indent payment terms:', error);
        throw error;
    }
}

/**
 * Update indent for Store Out Approval
 */
export async function updateIndentStoreOutApproval(
    indentNumber: string,
    updateData: {
        approved_by: string;
        approved_date: string;
        approved_quantity: number;
        status: string; // 'Approved' or 'Rejected'
        // We might want to update notes/remarks if available in schema
    }
) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({
                indent_approved_by: updateData.approved_by, // Map to correct column
                approved_date: updateData.approved_date,
                approved_quantity: updateData.approved_quantity,
                indent_status: updateData.status, // Assuming this is the status column
            })
            .eq('indent_number', indentNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating Store Out Approval:', error);
        throw error;
    }
}
