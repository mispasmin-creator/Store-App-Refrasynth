import { supabase } from '@/lib/supabase';

/**
 * Fullkitting Service
 * Handles all Supabase operations for the Fullkitting component
 */

export interface FullkittingRecord {
    id?: number;
    timestamp: string;
    indentNumber: string;
    vendorName: string;
    productName: string;
    qty: number;
    billNo: string;
    transportingInclude: string;
    transporterName: string;
    amount: number;
    vehicalNo: string;
    driverName: string;
    driverMobileNo: string;
    planned: string;
    actual: string;
    timeDelay: string;
    fmsName: string;
    status: string;
    vehicleNumber: string;
    from: string;
    to: string;
    materialLoadDetails: string;
    biltyNumber: string;
    rateType: string;
    amount1: number;
    biltyImage: string;
    firmNameMatch: string;
}

/**
 * Fetch all fullkitting records from Supabase
 */
export async function fetchFullkittingRecords(): Promise<FullkittingRecord[]> {
    try {
        const { data, error } = await supabase
            .from('fullkitting')
            .select('*')
            .order('indent_number', { ascending: false })
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            id: r.id,
            timestamp: r.timestamp || '',
            indentNumber: r.indent_number || '',
            vendorName: r.vendor_name || '',
            productName: r.product_name || '',
            qty: Number(r.qty) || 0,
            billNo: r.bill_no || '',
            transportingInclude: r.transporting_include || '',
            transporterName: r.transporter_name || '',
            amount: Number(r.amount) || 0,
            vehicalNo: r.vehical_no || '',
            driverName: r.driver_name || '',
            driverMobileNo: r.driver_mobile_no || '',
            planned: r.planned || '',
            actual: r.actual || '',
            timeDelay: r.time_delay || '',
            fmsName: r.fms_name || '',
            status: r.status || '',
            vehicleNumber: r.vehicle_number || '',
            from: r.from || '',
            to: r.to || '',
            materialLoadDetails: r.material_load_details || '',
            biltyNumber: r.bilty_number || '',
            rateType: r.rate_type || '',
            amount1: Number(r.amount1) || 0,
            biltyImage: r.bilty_image || '',
            firmNameMatch: r.firm_name_match || '',
        }));
    } catch (error) {
        console.error('Error fetching fullkitting records:', error);
        throw error;
    }
}

/**
 * Update fullkitting record with form data
 */
export async function updateFullkittingRecord(
    indentNumber: string,
    updateData: {
        actual?: string;
        status?: string;
        vehicleNumber?: string;
        from?: string;
        to?: string;
        materialLoadDetails?: string;
        biltyNumber?: string;
        rateType?: string;
        amount1?: number;
        biltyImage?: string;
    }
) {
    try {
        const mappedData: any = {};

        if (updateData.actual) mappedData.actual = updateData.actual;
        if (updateData.status) mappedData.status = updateData.status;
        if (updateData.vehicleNumber) mappedData.vehicle_number = updateData.vehicleNumber;
        if (updateData.from) mappedData.from = updateData.from;
        if (updateData.to) mappedData.to = updateData.to;
        if (updateData.materialLoadDetails) mappedData.material_load_details = updateData.materialLoadDetails;
        if (updateData.biltyNumber) mappedData.bilty_number = updateData.biltyNumber;
        if (updateData.rateType) mappedData.rate_type = updateData.rateType;
        if (updateData.amount1 !== undefined) mappedData.amount1 = updateData.amount1.toString();
        if (updateData.biltyImage) mappedData.bilty_image = updateData.biltyImage;

        const { error } = await supabase
            .from('fullkitting')
            .update(mappedData)
            .eq('indent_number', indentNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating fullkitting record:', error);
        throw error;
    }
}

/**
 * Upload bilty image to Supabase Storage
 */
export async function uploadBiltyImage(file: File, indentNumber: string): Promise<string> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${indentNumber}_bilty_${Date.now()}.${fileExt}`;
        const filePath = `bilty-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Bilty image upload error:', error);
        throw error;
    }
}
