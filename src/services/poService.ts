import { supabase } from '@/lib/supabase';

/**
 * Fetch all indent data from Supabase
 * Used for populating PO creation form with indent details
 */
export async function fetchIndents() {
    try {
        const { data, error } = await supabase
            .from('indent')
            .select('*')
            .order('indent_number', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => {
            // Priority: pending_po_qty > approved_quantity > quantity
            // Need to handle "0" string which is truthy in JS
            const rawPending = Number(r.pending_po_qty) || 0;
            const rawApproved = Number(r.approved_quantity) || 0;
            const rawQuantity = Number(r.quantity) || 0;

            const finalApprovedQty = rawPending > 0 ? rawPending : (rawApproved > 0 ? rawApproved : rawQuantity);

            return {
                id: r.id,
                planned4: r.planned4 || '',
                actual4: r.actual4 || '',
                approvedVendorName: r.approved_vendor_name || '',
                firmName: r.firm_name || '',
                firmNameMatch: r.firm_name_match || '',
                indentNumber: r.indent_number || '',
                productName: r.product_name || '',
                specifications: r.specifications || '',
                taxValue1: r.tax_value1 || 0,
                taxValue4: r.tax_value4 || 0,
                approvedQuantity: finalApprovedQty,
                pendingPoQty: rawPending,
                uom: r.uom || '',
                approvedRate: r.approved_rate || 0,
                quotationNumber: r.approved_quotation_no || '',
                quotationDate: r.approved_quotation_date || '',
                approvedPaymentTerm: r.approved_payment_term || '',
                approvedAdvancePercent: r.approved_advance_percent || '',
            };
        });
    } catch (error) {
        console.error('Error fetching indents:', error);
        throw error;
    }
}

/**
 * Fetch all PO Master records from Supabase
 * Used for generating PO numbers and revising existing POs
 */
export async function fetchPoMaster() {
    try {
        const { data, error } = await supabase
            .from('po_master')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            timestamp: r.timestamp,
            partyName: r.party_name || '',
            poNumber: r.po_number || '',
            internalCode: r.internal_code || '',
            product: r.product || '',
            description: r.description || '',
            quantity: Number(r.quantity) || 0,
            unit: r.unit || '',
            rate: Number(r.rate) || 0,
            gst: Number(r.gst) || 0,
            gstPercent: Number(r.gst) || 0, // gst field is used for percentage
            companyEmail: r.company_email || '',
            discount: Number(r.discount) || 0,
            discountPercent: Number(r.discount) || 0, // discount field is used for percentage
            amount: Number(r.amount) || 0,
            totalPoAmount: Number(r.total_po_amount) || 0,
            packaging: Number(r.packaging) || 0,
            forwarding: Number(r.forwarding) || 0,
            packagingAndForwarding: Number(r.packaging_and_forwarding) || ((Number(r.packaging) || 0) + (Number(r.forwarding) || 0)),
            pdf: r.pdf || '',
            quotationNumber: r.quotation_number || '',
            quotationDate: r.quotation_date || '',
            enquiryNumber: r.enquiry_number || '',
            enquiryDate: r.enquiry_date || '',
            term1: r.term1 || '',
            term2: r.term2 || '',
            term3: r.term3 || '',
            term4: r.term4 || '',
            term5: r.term5 || '',
            term6: r.term6 || '',
            term7: r.term7 || '',
            term8: r.term8 || '',
            term9: r.term9 || '',
            term10: r.term10 || '',
            deliveryDate: r.delivery_date || '',
            paymentTerms: r.payment_terms || '',
            numberOfDays: Number(r.number_of_days) || 0,
            deliveryDays: Number(r.delivery_days) || 0,
            deliveryType: r.delivery_type || '',
            firmNameMatch: r.firm_name_match || '',
            emailSendStatus: r.email_send_status || '',
            preparedBy: r.prepared_by || '',
            approvedBy: r.approved_by || '',
        }));
    } catch (error) {
        console.error('Error fetching PO master:', error);
        throw error;
    }
}

/**
 * Fetch master data (vendors, company info, terms, etc.)
 * Used for populating vendor details and default terms
 */
/**
 * Fetch master data (vendors, company info, terms, etc.)
 * Used for populating vendor details and default terms
 */
export async function fetchMasterData() {
    try {
        const { data: records, error } = await supabase
            .from('master')
            .select('*');

        if (error) throw error;

        if (!records || records.length === 0) {
            return {
                destinationAddress: '',
                defaultTerms: [],
                vendors: [],
                firmCompanyMap: {},
                companyName: '',
                companyPhone: '',
                companyGstin: '',
                companyPan: '',
                companyAddress: '',
                billingAddress: '',
                paymentTerms: [],
            };
        }

        // Aggregate vendors
        const vendors = records
            .filter(r => r.vendor_name)
            .map(r => ({
                vendorName: r.vendor_name,
                gstin: r.vendor_gstin || '',
                address: r.vendor_address || '',
                email: r.vendor_email || '',
            }));

        // Deduplicate vendors by name
        const uniqueVendors = Array.from(new Map(vendors.map(v => [v.vendorName, v])).values());

        // Extract payment terms
        const paymentTerms = Array.from(new Set(records.map(r => r.payment_term).filter(Boolean)));

        // Firm to Company Mapping
        const firmCompanyMap: Record<string, any> = {};
        records.forEach(r => {
            if (r.firm_name && r.company_name) {
                firmCompanyMap[r.firm_name] = {
                    companyName: r.company_name,
                    companyAddress: r.company_address || '',
                    destinationAddress: r.destination_address || '',
                    companyEmail: r.company_email || '',
                    companyPhone: r.company_phone || '',
                    companyGstin: r.company_gstin || '',
                    companyPan: r.company_pan || '',
                };
            }
        });

        // Company info (usually the first record or common values)
        const firstWithCompany = records.find(r => r.company_name) || {};

        return {
            destinationAddress: firstWithCompany.destination_address || '',
            defaultTerms: firstWithCompany.default_terms ? firstWithCompany.default_terms.split('\n') : [],
            vendors: uniqueVendors,
            firmCompanyMap,
            companyName: firstWithCompany.company_name || '',
            companyPhone: firstWithCompany.company_phone || '',
            companyGstin: firstWithCompany.company_gstin || '',
            companyPan: firstWithCompany.company_pan || '',
            companyAddress: firstWithCompany.company_address || '',
            billingAddress: firstWithCompany.billing_address || '',
            paymentTerms,
        };
    } catch (error) {
        console.error('Error fetching master data:', error);
        return {
            destinationAddress: '',
            defaultTerms: [],
            vendors: [],
            firmCompanyMap: {},
            companyName: '',
            companyPhone: '',
            companyGstin: '',
            companyPan: '',
            companyAddress: '',
            billingAddress: '',
            paymentTerms: [],
        };
    }
}

/**
 * Insert new PO records into Supabase
 * @param poRecords - Array of PO records to insert
 */
export async function insertPoRecords(poRecords: any[]) {
    try {
        // Map the records to Supabase schema (snake_case)
        // Note: Most fields in po_master are text type, so we convert numbers to strings
        const mappedRecords = poRecords.map((record) => ({
            timestamp: record.timestamp,
            party_name: record.partyName || '',
            po_number: record.poNumber || '',
            internal_code: record.internalCode || '',
            product: record.product || '',
            description: record.description || '',
            quantity: String(record.quantity || 0),
            unit: record.unit || '',
            rate: String(record.rate || 0),
            gst: String(record.gstPercent || record.gst || 0),
            discount: String(record.discountPercent || record.discount || 0),
            amount: String(record.amount || 0),
            total_po_amount: String(record.totalPoAmount || 0),
            pdf: record.pdf || '',
            quotation_number: record.quotationNumber || '',
            quotation_date: record.quotationDate || '',
            enquiry_number: record.enquiryNumber || '',
            enquiry_date: record.enquiryDate || '',
            term1: record.term1 || '',
            term2: record.term2 || '',
            term3: record.term3 || '',
            term4: record.term4 || '',
            term5: record.term5 || '',
            term6: record.term6 || '',
            term7: record.term7 || '',
            term8: record.term8 || '',
            term9: record.term9 || '',
            term10: record.term10 || '',
            delivery_date: record.deliveryDate || '',
            payment_terms: record.paymentTerms || '',
            number_of_days: String(record.numberOfDays || 0),
            delivery_days: String(record.deliveryDays || 0),
            delivery_type: record.deliveryType || '',
            firm_name_match: record.firmNameMatch || '',
            company_email: record.companyEmail || '',
            advance_percent: record.advancePercent || 0,
            advance_amount: record.advanceAmount || 0,
            packaging: String(record.packaging || 0),
            forwarding: String(record.forwarding || 0),
        }));

        const { data, error } = await supabase
            .from('po_master')
            .insert(mappedRecords)
            .select();

        if (error) {
            // Check if packaging or forwarding column error
            if (error.code === 'PGRST204' || (error.message && (
                error.message.includes('packaging') || 
                error.message.includes('forwarding')
            ))) {
                console.warn('packaging or forwarding columns not found, retrying insert without them');
                const cleanedRecords = mappedRecords.map((r) => {
                    const { packaging, forwarding, ...rest } = r as any;
                    return rest;
                });
                const { data: retryData, error: retryError } = await supabase
                    .from('po_master')
                    .insert(cleanedRecords)
                    .select();
                if (retryError) throw retryError;
                return retryData;
            }
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error inserting PO records:', error);
        throw error;
    }
}

/**
 * Update indent records to mark them as having PO created
 * Sets actual4 timestamp and delivery_date for indents that are included in the PO
 * @param indentNumbers - Array of indent numbers to update
 * @param deliveryDate - The delivery date from the PO
 */
export async function updateIndentsAfterPoCreation(ids: number[], deliveryDate?: string, poNumber?: string, poCopy?: string) {
    try {
        const now = new Date().toISOString();
        const updateData: any = {
            actual4: now,
            planned5: now
        };
        if (deliveryDate) {
            updateData.delivery_date = deliveryDate;
        }
        if (poNumber) {
            updateData.po_number = poNumber;
        }
        if (poCopy) {
            updateData.po_copy = poCopy;
        }

        const { error } = await supabase
            .from('indent')
            .update(updateData)
            .in('id', ids);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating indents after PO creation:', error);
        throw error;
    }
}