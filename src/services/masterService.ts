import { supabase } from '@/lib/supabase';

/**
 * Master Service
 * Handles fetching global options and master data from Supabase
 */

export interface MasterData {
    vendors: {
        vendorName: string;
        gstin: string;
        address: string;
        email: string;
        paymentTerm: string;
    }[];
    vendorNames: string[];
    paymentTerms: string[];
    departments: string[];
    groupHeads: Record<string, string[]>;
    groupMasters: string[];
    products: Record<string, string[]>;
    companyName: string;
    companyAddress: string;
    companyGstin: string;
    companyPhone: string;
    billingAddress: string;
    companyPan: string;
    destinationAddress: string;
    defaultTerms: string[];
    uoms: string[];
    firms: string[];
    firmsnames: string[];
    fmsNames: string[];
    locations: string[];
    allGroupHeads: string[];
    firmCompanyMap: Record<string, { companyName: string; companyAddress: string; destinationAddress: string; }>;
}

/**
 * Fetch all master data options for dropdowns
 */
export async function fetchMasterOptions(): Promise<MasterData> {
    try {
        const { data, error } = await supabase
            .from('master')
            .select('*');

        if (error) throw error;

        const records = data || [];

        const departments = Array.from(new Set(records.map(r => r.department).filter(Boolean)));
        const uoms = Array.from(new Set(records.map(r => r.uom).filter(Boolean)));
        const firms = Array.from(new Set(records.map(r => r.firm_name).filter(Boolean)));
        const fmsNames = Array.from(new Set(records.map(r => r.fms_name).filter(Boolean)));
        const paymentTerms = Array.from(new Set(records.map(r => r.payment_term).filter(Boolean)));
        const locations = Array.from(new Set(records.map(r => r.where).filter(Boolean)));
        const allGroupHeads = Array.from(new Set(records.map(r => r.group_head).filter(Boolean))).sort();
        const groupMasters = Array.from(new Set(records.map(r => r.group_master).filter(Boolean))).sort();

        // Aggregate vendors
        const vendors = records
            .filter(r => r.vendor_name)
            .map(r => ({
                vendorName: r.vendor_name,
                gstin: r.vendor_gstin || '',
                address: r.vendor_address || '',
                email: r.vendor_email || '',
                paymentTerm: r.payment_term || '',
            }));

        // Deduplicate vendors by name
        const uniqueVendors = Array.from(new Map(vendors.map(v => [v.vendorName, v])).values());
        const vendorNames = uniqueVendors.map(v => v.vendorName);

        // Map group heads to departments and products to group heads
        const groupHeads: Record<string, string[]> = {};
        const products: Record<string, string[]> = {};
        records.forEach(r => {
            if (r.department && r.group_head) {
                if (!groupHeads[r.department]) {
                    groupHeads[r.department] = [];
                }
                if (!groupHeads[r.department].includes(r.group_head)) {
                    groupHeads[r.department].push(r.group_head);
                }
            }
            if (r.group_head && r.item_name) {
                if (!products[r.group_head]) {
                    products[r.group_head] = [];
                }
                if (!products[r.group_head].includes(r.item_name)) {
                    products[r.group_head].push(r.item_name);
                }
            }
        });

        // Company info (usually the first record or common values)
        const firstWithCompany = records.find(r => r.company_name) || {};

        // Firm to Company Mapping
        const firmCompanyMap: Record<string, { companyName: string; companyAddress: string; destinationAddress: string; }> = {};
        records.forEach(r => {
            if (r.firm_name && r.company_name) {
                firmCompanyMap[r.firm_name] = {
                    companyName: r.company_name,
                    companyAddress: r.company_address || '',
                    destinationAddress: r.destination_address || '',
                };
            }
        });

        return {
            departments,
            groupHeads,
            allGroupHeads,
            groupMasters,
            products,
            uoms,
            firms,
            firmsnames: firms,
            fmsNames,
            paymentTerms,
            locations,
            vendors: uniqueVendors,
            vendorNames,
            companyName: firstWithCompany.company_name || '',
            companyAddress: firstWithCompany.company_address || '',
            companyGstin: firstWithCompany.company_gstin || '',
            companyPhone: firstWithCompany.company_phone || '',
            billingAddress: firstWithCompany.billing_address || '',
            companyPan: firstWithCompany.company_pan || '',
            destinationAddress: firstWithCompany.destination_address || '',
            defaultTerms: firstWithCompany.default_terms ? firstWithCompany.default_terms.split('\n') : [],
            firmCompanyMap,
        };
    } catch (error) {
        console.error('Error fetching master options:', error);
        return {
            departments: [],
            groupHeads: {},
            allGroupHeads: [],
            groupMasters: [],
            products: {},
            uoms: [],
            firms: [],
            firmsnames: [],
            fmsNames: [],
            paymentTerms: [],
            locations: [],
            vendors: [],
            vendorNames: [],
            companyName: '',
            companyAddress: '',
            companyGstin: '',
            companyPhone: '',
            billingAddress: '',
            companyPan: '',
            destinationAddress: '',
            defaultTerms: [],
            firmCompanyMap: {},
        };
    }
}
