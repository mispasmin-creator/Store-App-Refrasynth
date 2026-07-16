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
    areasOfUse: string[];
    firmCompanyMap: Record<string, { companyName: string; companyAddress: string; destinationAddress: string; }>;
}

/**
 * Fetch all master data options for dropdowns
 */
export async function fetchMasterOptions(): Promise<MasterData> {
    try {
        const { data, error } = await supabase
            .from('master')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        const records = data || [];

        const departments = Array.from(new Set(records.map(r => r.category).filter(Boolean)));
        const uoms = Array.from(new Set(records.map(r => r.uom).filter(Boolean)));
        const firms = Array.from(new Set(records.map(r => r.firm_name).filter(Boolean)));
        const fmsNames = Array.from(new Set(records.map(r => r.fms_name).filter(Boolean)));
        const paymentTerms = Array.from(new Set(records.map(r => r.payment_term).filter(Boolean)));
        const defaultTerms = Array.from(
            new Set(
                records
                    .map(r => (typeof r.default_terms === 'string' ? r.default_terms.trim() : ''))
                    .filter(Boolean)
            )
        );
        const locations = Array.from(new Set(records.map(r => r.where).filter(Boolean)));
        const allGroupHeads = Array.from(new Set(records.map(r => r.group_name).filter(Boolean))).sort();
        const groupMasters = Array.from(new Set(records.map(r => r.department).filter(Boolean))).sort();
        const areasOfUse = Array.from(new Set(records.map(r => r.area_of_use).filter(Boolean))).sort();

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
            if (r.category && r.group_name) {
                if (!groupHeads[r.category]) {
                    groupHeads[r.category] = [];
                }
                if (!groupHeads[r.category].includes(r.group_name)) {
                    groupHeads[r.category].push(r.group_name);
                }
            }
            if (r.group_name && r.item_name) {
                if (!products[r.group_name]) {
                    products[r.group_name] = [];
                }
                if (!products[r.group_name].includes(r.item_name)) {
                    products[r.group_name].push(r.item_name);
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
            areasOfUse,
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
            defaultTerms,
            firmCompanyMap,
        };
    } catch (error) {
        console.error('Error fetching master options:', error);
        return {
            departments: [],
            groupHeads: {},
            allGroupHeads: [],
            areasOfUse: [],
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
