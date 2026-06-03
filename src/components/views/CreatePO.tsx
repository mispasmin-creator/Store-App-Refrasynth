import { ChevronsRightLeft, FilePlus2, Pencil, Save, Trash, Eye, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { z } from 'zod';
import { Button } from '../ui/button';
import { SidebarTrigger } from '../ui/sidebar';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import type { PoMasterSheet } from '@/types';
import { uploadFile } from '@/lib/fetchers';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
    calculateGrandTotal,
    calculateSubtotal,
    calculateTotal,
    calculateTotalGst,
    cn,
    formatDate,
    formatDateTime,
    parseCustomDate,
} from '@/lib/utils';
import { toast } from 'sonner';
import { ClipLoader as Loader } from 'react-spinners';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '../ui/textarea';
import { pdf } from '@react-pdf/renderer';
import POPdf, { type POPdfProps } from '../element/POPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { PDFViewer } from '@react-pdf/renderer';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { fetchIndents, fetchPoMaster, fetchMasterData, insertPoRecords, updateIndentsAfterPoCreation } from '@/services/poService';
import Heading from '../element/Heading';

function generatePoNumber(poNumbers: string[]): string {
    const prefix = 'STORE-PO-25-26-';
    if (!poNumbers || poNumbers.length === 0) {
        return `${prefix}1`;
    }

    // Extract all numbers for this prefix
    const existingNumbers = poNumbers
        .filter(po => po && typeof po === 'string' && po.trim() !== '')
        .map(po => {
            const poStr = po.trim();

            // Check if it matches our prefix pattern exactly
            if (poStr.startsWith(prefix)) {
                const numberStr = poStr.replace(prefix, '').trim();
                const num = parseInt(numberStr, 10);
                return isNaN(num) ? 0 : num;
            }

            return 0;
        })
        .filter(n => n > 0);

    // Find highest number and add 1
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;

    return `${prefix}${nextNumber}`;
}

function incrementPoRevision(poNumber: string, allPOs: any[]): string {
    // Extract the base prefix and find the highest number
    const prefix = 'STORE-PO-25-26-';

    // For existing PO numbers, we need to find the highest number in the entire system
    const allPoNumbers = allPOs
        .filter((po: any) => po.poNumber && typeof po.poNumber === 'string' && po.poNumber.trim() !== '')
        .map((po: any) => po.poNumber.trim());

    // Also include the current PO number we're revising
    allPoNumbers.push(poNumber);

    // Extract numbers from all PO numbers with the same prefix
    const existingNumbers = allPoNumbers
        .filter(po => po.startsWith(prefix))
        .map(po => {
            const numberStr = po.replace(prefix, '').trim();
            const num = parseInt(numberStr, 10);
            return isNaN(num) ? 0 : num;
        })
        .filter(n => n > 0);


    // Find highest number and add 1
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;

    const newPoNumber = `${prefix}${nextNumber}`;

    return newPoNumber;
}

function filterUniquePoNumbers(data: any[]): any[] {
    const seen = new Set<string>();
    const result: any[] = [];

    for (const po of data) {
        if (!seen.has(po.poNumber)) {
            seen.add(po.poNumber);
            result.push(po);
        }
    }

    return result;
}

interface IndentSheetItem {
    planned4?: string;
    actual4?: string;
    id?: number;
    approvedVendorName?: string | number; // ✅ Allow both string and number
    firmName?: string;
    firmNameMatch?: string;
    indentNumber?: string;
    productName?: string;
    specifications?: string;
    taxValue1?: string | number;
    taxValue4?: string | number;
    approvedQuantity?: number;
    uom?: string;
    approvedRate?: number;
    quotationNumber?: string;
    quotationDate?: string;
    approvedPaymentTerm?: string;
    approvedAdvancePercent?: string;
}

interface MasterDetails {
    destinationAddress?: string;
    defaultTerms?: string[];
    vendors?: Array<{
        vendorName?: string;
        address?: string;
        gstin?: string;
        vendorEmail?: string;
        email?: string;
    }>;
    firmCompanyMap?: Record<string, {
        companyName?: string;
        companyAddress?: string;
        destinationAddress?: string;
        companyEmail?: string;
        companyPhone?: string;
        companyGstin?: string;
        companyPan?: string;
    }>;
    companyName?: string;
    paymentTerms?: string[];
    companyPhone?: string;
    companyGstin?: string;
    companyPan?: string;
    companyAddress?: string;
    billingAddress?: string;
}


const schema = z.object({
    poNumber: z.string().nonempty(),
    poDate: z.coerce.date(),
    supplierName: z.string().nonempty(),
    supplierAddress: z.string().nonempty(),
    gstin: z.string().optional(),
    companyEmail: z.union([z.string().email(), z.literal('')]).optional(),

    ourEnqNo: z.string().optional(),
    enquiryDate: z.coerce.date().optional(),
    description: z.string(),
    indents: z.array(
        z.object({
            id: z.number(), 
            indentNumber: z.string().nonempty(),
            quotationNumber: z.string().optional(),
            productName: z.string().optional(),
            specifications: z.string().optional(),
            gst: z.coerce.number(),
            discount: z.coerce.number().default(0).optional(),
            quantity: z.coerce.number().optional(),
            unit: z.string().optional(),
            rate: z.coerce.number().optional(),
            packaging: z.coerce.number().default(0).optional(),
            forwarding: z.coerce.number().default(0).optional(),
            packagingAndForwarding: z.coerce.number().default(0).optional(),
        })
    ),
    terms: z.array(z.string().nonempty()).max(10),
    deliveryDate: z.coerce.date(),
    deliveryDays: z.coerce.number().optional(),
    deliveryType: z.enum(['for', 'exfactory']).optional(),
    paymentTerms: z.string().nonempty(),
    numberOfDays: z.coerce.number().optional(),
});

type FormData = z.infer<typeof schema>;

const CreatePO = () => {
    const { user } = useAuth();

    // Supabase state
    const [indentSheet, setIndentSheet] = useState<IndentSheetItem[]>([]);
    const [poMasterSheet, setPoMasterSheet] = useState<any[]>([]);
    const [details, setDetails] = useState<MasterDetails | null>(null);
    const [dataLoading, setDataLoading] = useState(false);

    const [readOnly, setReadOnly] = useState(-1);
    const [mode, setMode] = useState<'create' | 'revise'>('create');
    const [isEditingDestination, setIsEditingDestination] = useState(false);
    const [destinationAddress, setDestinationAddress] = useState(`${localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited'}, Khasra No 297/2 & 297/6 Village AKoli, Near Tarpongi Toll Plaza, PO- Devri, Raipur - 493221 (CG)`);
    const [firmCompanyName, setFirmCompanyName] = useState(localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited');
    const [firmCompanyAddress, setFirmCompanyAddress] = useState('Shri Ram Business Park , Block - C, 2nd floor , Room No. 212');
    const [firmCompanyPhone, setFirmCompanyPhone] = useState('+91 7223844007');
    const [firmCompanyGstin, setFirmCompanyGstin] = useState('22AAHCP9274B1ZI');
    const [firmCompanyPan, setFirmCompanyPan] = useState('AACCJ1154B');
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<POPdfProps | null>(null);

    // Fetch all data from Supabase on mount
    useEffect(() => {
        async function loadData() {
            if (!supabaseEnabled) return;

            try {
                setDataLoading(true);
                const [indents, poMaster, masterData] = await Promise.all([
                    fetchIndents(),
                    fetchPoMaster(),
                    fetchMasterData(),
                ]);

                setIndentSheet(indents);
                setPoMasterSheet(poMaster);
                setDetails(masterData);
            } catch (error) {
                console.error('Error loading data:', error);
                toast.error('Failed to load data');
            } finally {
                setDataLoading(false);
            }
        }

        loadData();
    }, []);

    useEffect(() => {
        if (details?.destinationAddress) {
            setDestinationAddress(details.destinationAddress);
        }
    }, [details]);
    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            poNumber: '',
            poDate: new Date(),
            supplierName: '',
            supplierAddress: '',
            gstin: '',
            companyEmail: '',
            ourEnqNo: '',
            enquiryDate: undefined as any,
            description: '',
            indents: [],
            terms: (details as MasterDetails)?.defaultTerms || [],
            deliveryDate: new Date(),
            deliveryDays: undefined,
            deliveryType: undefined,
            paymentTerms: undefined as any,
            numberOfDays: undefined,
        },
    });

    useEffect(() => {
        if (details) {
            form.setValue('terms', (details as MasterDetails).defaultTerms || []);
        }
    }, [details, form]);

    const indents = form.watch('indents');
    const vendor = form.watch('supplierName');
    const poDate = form.watch('poDate');
    const poNumber = form.watch('poNumber');

    const termsArray = useFieldArray({
        control: form.control,
        name: 'terms' as any,
    });

    const itemsArray = useFieldArray({
        control: form.control,
        name: 'indents' as any,
    });

    // Vendor selection effect for CREATE mode
    useEffect(() => {
        if (!vendor || !details || !(details as MasterDetails).vendors || mode !== 'create') return;


        const normalize = (str: any) => {
            // ✅ FIX: Handle cases where str might not be a string
            if (!str) return '';
            if (typeof str !== 'string') return String(str).trim().toLowerCase();
            return str.trim().toLowerCase();
        };

        const selectedVendor = (details as MasterDetails).vendors?.find(
            (v) => normalize(v.vendorName) === normalize(vendor)
        );

        if (selectedVendor) {
            form.setValue('supplierAddress', selectedVendor.address || '', { shouldValidate: true });
            form.setValue('gstin', selectedVendor.gstin || '', { shouldValidate: true });
            form.setValue('companyEmail', selectedVendor.email || selectedVendor.vendorEmail || '', { shouldValidate: true });
        } else {
            console.warn("⚠️ Vendor not found in master list:", vendor);
            form.setValue('supplierAddress', '', { shouldValidate: true });
            form.setValue('gstin', '', { shouldValidate: true });
            form.setValue('companyEmail', '', { shouldValidate: true });
        }

        // ✅ FIX: Update the matching indents filter to handle non-string vendor names
        const matchingIndents = indentSheet.filter((i: IndentSheetItem) => {
            const vendorName = i.approvedVendorName;
            const hasVendor = vendorName && (typeof vendorName === 'string' || typeof vendorName === 'number');
            const normalizedVendorName = normalize(vendorName);
            const normalizedSelectedVendor = normalize(vendor);

            return hasVendor &&
                i.approvedVendorName !== '' &&
                i.planned4 !== '' &&
                i.actual4 === '' &&
                normalizedVendorName === normalizedSelectedVendor;
        });
        const firmName = matchingIndents[0]?.firmName?.trim();
        if (firmName && (details as MasterDetails).firmCompanyMap) {
            const firmKey = Object.keys((details as MasterDetails).firmCompanyMap!).find(
                (key) => normalize(key) === normalize(firmName)
            );

            const companyDetails = firmKey ? (details as MasterDetails).firmCompanyMap![firmKey] : null;

            if (companyDetails) {
                setFirmCompanyName(companyDetails.companyName || '');
                setFirmCompanyAddress(companyDetails.companyAddress || '');
                setFirmCompanyPhone(companyDetails.companyPhone || '');
                setFirmCompanyGstin(companyDetails.companyGstin || '');
                setFirmCompanyPan(companyDetails.companyPan || '');
                setDestinationAddress(
                    companyDetails.destinationAddress || (details as MasterDetails).destinationAddress || ''
                );
            } else {
                setFirmCompanyName((details as MasterDetails).companyName || localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited');
                setFirmCompanyAddress((details as MasterDetails).companyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212');
                setFirmCompanyPhone((details as MasterDetails).companyPhone || '+91 7223844007');
                setFirmCompanyGstin((details as MasterDetails).companyGstin || '22AAHCP9274B1ZI');
                setFirmCompanyPan((details as MasterDetails).companyPan || 'AACCJ1154B');
                setDestinationAddress((details as MasterDetails).destinationAddress || '');
            }
        }

        if (matchingIndents.length > 0) {
            const first = matchingIndents[0];
            form.setValue('paymentTerms', first.approvedPaymentTerm || '');
            form.setValue('numberOfDays', Number(first.approvedAdvancePercent) || 0);
        }

        form.setValue(
            'indents',
            matchingIndents.map((i: IndentSheetItem) => {
                let gstValue = 0;

                if (i.taxValue1 && !isNaN(Number(i.taxValue1)) && Number(i.taxValue1) > 0) {
                    gstValue = Number(i.taxValue1);
                }
                else if (i.taxValue4 && !isNaN(Number(i.taxValue4)) && Number(i.taxValue4) > 0) {
                    gstValue = Number(i.taxValue4);
                }

                return {
                    id: i.id as number,
                    indentNumber: i.indentNumber || '',
                    quotationNumber: i.quotationNumber || '',
                    productName: i.productName || '',
                    specifications: i.specifications || '',
                    gst: gstValue,
                    discount: 0,
                    quantity: i.approvedQuantity || 0,
                    unit: i.uom || '',
                    rate: i.approvedRate || 0,
                    packaging: 0,
                    forwarding: 0,
                    packagingAndForwarding: 0,
                };
            })
        );

        setTimeout(() => form.trigger(['supplierAddress', 'gstin']), 100);

    }, [vendor, details, indentSheet, mode, form]);

    // Mode change effect
    useEffect(() => {
        if (mode === 'revise') {
            form.reset({
                poNumber: '',
                poDate: new Date(),
                supplierName: '',
                supplierAddress: '',
                gstin: '',
                companyEmail: '',
                enquiryDate: undefined as any,
                indents: [],
                terms: (details as MasterDetails)?.defaultTerms || [],
                deliveryDate: new Date(),
                deliveryDays: undefined,
                deliveryType: undefined,
                paymentTerms: undefined as any,
                numberOfDays: undefined,
                description: '',
            });
        } else {
            if (poMasterSheet && poMasterSheet.length > 0) {
                const poNumbers = poMasterSheet.map((p) => p.poNumber).filter(po => po && po.trim() !== '');
                const newPoNumber = generatePoNumber(poNumbers);
                form.reset({
                    poNumber: newPoNumber,
                    poDate: new Date(),
                    supplierName: '',
                    supplierAddress: '',
                    gstin: '',
                    companyEmail: '',
                    ourEnqNo: '',
                    enquiryDate: undefined as any,
                    indents: [],
                    terms: (details as MasterDetails)?.defaultTerms || [],
                    deliveryDate: new Date(),
                    deliveryDays: undefined,
                    deliveryType: undefined,
                    paymentTerms: undefined as any,
                    numberOfDays: undefined,
                    description: '',
                });
            } else {
                form.reset({
                    poNumber: 'STORE-PO-25-26-1',
                    poDate: new Date(),
                    supplierName: '',
                    supplierAddress: '',
                    gstin: '',
                    companyEmail: '',
                    ourEnqNo: '',
                    enquiryDate: undefined as any,
                    indents: [],
                    terms: (details as MasterDetails)?.defaultTerms || [],
                    deliveryDate: new Date(),
                    deliveryDays: undefined,
                    deliveryType: undefined,
                    paymentTerms: undefined as any,
                    numberOfDays: undefined,
                    description: '',
                });
            }
        }
    }, [mode, poMasterSheet, details, form]);

    // REVISE MODE - Load PO data when PO number is selected
    useEffect(() => {
        if (mode === 'revise' && poNumber && poNumber.trim() !== '') {
            const poItems = poMasterSheet.filter((p) => p.poNumber === poNumber);
            if (poItems.length > 0) {
                const firstPoItem = poItems[0];
                const vendor = (details as MasterDetails)?.vendors?.find((v) => {
                    const vendorName = v.vendorName?.toLowerCase()?.trim();
                    const partyName = firstPoItem.partyName?.toLowerCase()?.trim();
                    return vendorName === partyName;
                });
                form.setValue('poDate', parseCustomDate(firstPoItem.timestamp));
                form.setValue('supplierName', firstPoItem.partyName || '');

                if (vendor) {
                    form.setValue('supplierAddress', vendor.address || '');
                    form.setValue('gstin', vendor.gstin || '');
                    form.setValue('companyEmail', vendor.vendorEmail || '');
                } else {
                    const storedAddress = (firstPoItem as any)?.supplierAddress || '';
                    const storedGstin = (firstPoItem as any)?.supplierGstin || '';
                    const storedEmail = (firstPoItem as any)?.companyEmail || '';

                    form.setValue('supplierAddress', storedAddress);
                    form.setValue('gstin', storedGstin);
                    form.setValue('companyEmail', storedEmail);
                }

                form.setValue('ourEnqNo', firstPoItem.enquiryNumber || '');
                form.setValue('enquiryDate', parseCustomDate(firstPoItem.enquiryDate));
                form.setValue('deliveryDate', parseCustomDate(firstPoItem.deliveryDate));
                form.setValue('deliveryDays', firstPoItem.deliveryDays || 0);
                form.setValue('deliveryType', (firstPoItem.deliveryType === 'for' || firstPoItem.deliveryType === 'exfactory') ? firstPoItem.deliveryType : undefined);
                form.setValue('paymentTerms', firstPoItem.paymentTerms as any || undefined);
                form.setValue('numberOfDays', firstPoItem.numberOfDays || 0);

                const poIndents = poItems.map((poItem) => {
                    const originalIndent = indentSheet.find(i =>
                        i.indentNumber === poItem.internalCode &&
                        i.productName === poItem.product
                    );
                    return {
                        id: originalIndent?.id || 0,
                        indentNumber: poItem.internalCode || '',
                        quotationNumber: poItem.quotationNumber || '',
                        productName: poItem.product || '',
                        specifications: poItem.description || '',
                        gst: poItem.gstPercent || 18,
                        discount: poItem.discountPercent || 0,
                        quantity: poItem.quantity || 0,
                        unit: poItem.unit || '',
                        rate: poItem.rate || 0,
                        packaging: poItem.packaging || 0,
                        forwarding: poItem.forwarding || 0,
                        packagingAndForwarding: poItem.packagingAndForwarding || ((poItem.packaging || 0) + (poItem.forwarding || 0)),
                    };
                });
                form.setValue('indents', poIndents);

                const terms = [];
                for (let i = 1; i <= 10; i++) {
                    const termKey = `term${i}` as keyof PoMasterSheet;
                    const term = firstPoItem[termKey] as string;
                    if (term && typeof term === 'string' && term.trim() !== '') {
                        terms.push(term.trim());
                    }
                }
                form.setValue('terms', terms.length > 0 ? terms : ((details as MasterDetails)?.defaultTerms || []));
            }
        }
    }, [poNumber, mode, poMasterSheet, details, form]);

    const handleDestinationEdit = () => setIsEditingDestination(true);
    const handleDestinationSave = () => {
        setIsEditingDestination(false);
        toast.success('Destination address updated');
    };
    const handleDestinationCancel = () => {
        setDestinationAddress((details as MasterDetails)?.destinationAddress || '');
        setIsEditingDestination(false);
    };

    const getLogoBase64 = async (): Promise<string> => {
        try {
            const logoResponse = await fetch('/Passary.jpeg');
            const logoBlob = await logoResponse.blob();
            return await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(logoBlob);
            });
        } catch (error) {
            console.error('Error fetching logo:', error);
            return '';
        }
    };

    async function generatePreviewData(): Promise<POPdfProps> {
        const values = form.getValues();

        const totalPackaging = values.indents.reduce(
            (sum, item) => sum + (item.packaging || 0),
            0
        );
        const totalForwarding = values.indents.reduce(
            (sum, item) => sum + (item.forwarding || 0),
            0
        );
        const totalPackagingAndForwarding = totalPackaging + totalForwarding;

        const subtotal = values.indents.reduce((sum, item) => {
            const base = (item.rate || 0) * (item.quantity || 0);
            const discounted = base - (base * (item.discount || 0)) / 100;
            const pkg = item.packaging || 0;
            const fwd = item.forwarding || 0;
            return sum + discounted + pkg + fwd;
        }, 0);

        const totalGst = values.indents.reduce((sum, item) => {
            const base = (item.rate || 0) * (item.quantity || 0);
            const discounted = base - (base * (item.discount || 0)) / 100;
            const pkg = item.packaging || 0;
            const fwd = item.forwarding || 0;
            const taxable = discounted + pkg + fwd;
            return sum + (taxable * (item.gst || 0)) / 100;
        }, 0);

        const grandTotal = subtotal + totalGst;

        return {
            companyName: firmCompanyName || localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited',
            companyPhone: firmCompanyPhone || '+91 7223844007',
            companyGstin: firmCompanyGstin || '22AAHCP9274B1ZI',
            companyPan: firmCompanyPan || 'AACCJ1154B',
            companyAddress: firmCompanyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212',
            billingAddress: `${firmCompanyName || localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited'}, ${firmCompanyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212'}`,
            destinationAddress: destinationAddress || `${localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited'}, Khasra No 297/2 & 297/6 Village AKoli, Near Tarpongi Toll Plaza, PO- Devri, Raipur - 493221 (CG)`,
            supplierName: values.supplierName,
            supplierAddress: values.supplierAddress,
            supplierGstin: values.gstin || '',
            orderNumber: mode === 'create' ? values.poNumber : incrementPoRevision(values.poNumber, poMasterSheet),
            orderDate: formatDate(values.poDate),
            deliveryDate: formatDate(values.deliveryDate),
            paymentTerms: values.paymentTerms,
            numberOfDays: values.numberOfDays || 0,
            description: values.description,
            items: values.indents.map((item) => {
                const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === item.indentNumber);
                return {
                    internalCode: indent?.indentNumber || item.indentNumber,
                    quotationNumber: item.quotationNumber || '',
                    product: item.productName || indent?.productName || '',
                    description: item.specifications || indent?.specifications || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    rate: item.rate || 0,
                    packaging: item.packaging || 0,
                    forwarding: item.forwarding || 0,
                    packagingAndForwarding: (item.packaging || 0) + (item.forwarding || 0),
                    gst: item.gst || 0,
                    discount: item.discount || 0,
                    amount: (() => {
                        const base = (item.rate || 0) * (item.quantity || 0);
                        const discounted = base - (base * (item.discount || 0)) / 100;
                        const pkg = item.packaging || 0;
                        const fwd = item.forwarding || 0;
                        const taxable = discounted + pkg + fwd;
                        const itemAmount = taxable + (taxable * (item.gst || 0)) / 100;
                        return parseFloat(itemAmount.toFixed(2));
                    })(),
                };
            }),
            total: parseFloat(subtotal.toFixed(2)),
            gstAmount: parseFloat(totalGst.toFixed(2)),
            packaging: totalPackaging,
            forwarding: totalForwarding,
            packagingAndForwarding: totalPackagingAndForwarding,
            grandTotal: parseFloat(grandTotal.toFixed(2)),
            terms: values.terms,
            preparedBy: user.username || 'Unknown',
            approvedBy: 'Sayan Das',
            logo: await getLogoBase64(),
        };
    }

    async function handlePreview() {
        try {
            const data = await generatePreviewData();
            setPreviewData(data);
            setShowPreview(true);
        } catch (error) {
            console.error('Preview error:', error);
            toast.error('Failed to generate preview');
        }
    }

    async function onSubmit(values: FormData) {
        try {
            const poNumber = mode === 'create' ? values.poNumber : incrementPoRevision(values.poNumber, poMasterSheet);
            const totalPackaging = values.indents.reduce(
                (sum, item) => sum + (item.packaging || 0),
                0
            );
            const totalForwarding = values.indents.reduce(
                (sum, item) => sum + (item.forwarding || 0),
                0
            );
            const totalPackagingAndForwarding = totalPackaging + totalForwarding;

            const subtotal = values.indents.reduce((sum, item) => {
                const base = (item.rate || 0) * (item.quantity || 0);
                const discounted = base - (base * (item.discount || 0)) / 100;
                const pkg = item.packaging || 0;
                const fwd = item.forwarding || 0;
                return sum + discounted + pkg + fwd;
            }, 0);

            const totalGst = values.indents.reduce((sum, item) => {
                const base = (item.rate || 0) * (item.quantity || 0);
                const discounted = base - (base * (item.discount || 0)) / 100;
                const pkg = item.packaging || 0;
                const fwd = item.forwarding || 0;
                const taxable = discounted + pkg + fwd;
                return sum + (taxable * (item.gst || 0)) / 100;
            }, 0);

            const grandTotal = subtotal + totalGst;

            const logoBase64 = await getLogoBase64();

            const pdfProps: POPdfProps = {
                companyName: firmCompanyName || localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited',
                companyPhone: firmCompanyPhone || '+91 7223844007',
                companyGstin: firmCompanyGstin || '22AAHCP9274B1ZI',
                companyPan: firmCompanyPan || 'AACCJ1154B',
                companyAddress: firmCompanyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212',
                billingAddress: `${firmCompanyName || localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited'}, ${firmCompanyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212'}`,
                destinationAddress: destinationAddress || `${localStorage.getItem('company_name') || 'M/S Refrasynth Minerals India Private Limited'}, Khasra No 297/2 & 297/6 Village AKoli, Near Tarpongi Toll Plaza, PO- Devri, Raipur - 493221 (CG)`,
                supplierName: values.supplierName,
                supplierAddress: values.supplierAddress,
                supplierGstin: values.gstin || '',
                orderNumber: poNumber,
                orderDate: formatDate(values.poDate),
                deliveryDate: formatDate(values.deliveryDate),
                paymentTerms: values.paymentTerms,
                numberOfDays: values.numberOfDays || 0,
                description: values.description,

                items: values.indents.map((item) => {
                    const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === item.indentNumber);
                    return {
                        internalCode: indent?.indentNumber || item.indentNumber,
                        quotationNumber: item.quotationNumber || '',
                        product: item.productName || indent?.productName || '',
                        description: item.specifications || indent?.specifications || '',
                        quantity: item.quantity || 0,
                        unit: item.unit || '',
                        rate: item.rate || 0,
                        packaging: item.packaging || 0,
                        forwarding: item.forwarding || 0,
                        packagingAndForwarding: (item.packaging || 0) + (item.forwarding || 0),
                        gst: item.gst || 0,
                        discount: item.discount || 0,
                        amount: (() => {
                            const base = (item.rate || 0) * (item.quantity || 0);
                            const discounted = base - (base * (item.discount || 0)) / 100;
                            const pkg = item.packaging || 0;
                            const fwd = item.forwarding || 0;
                            const taxable = discounted + pkg + fwd;
                            const itemAmount = taxable + (taxable * (item.gst || 0)) / 100;
                            return parseFloat(itemAmount.toFixed(2));
                        })(),
                    };
                }),
                total: parseFloat(subtotal.toFixed(2)),
                gstAmount: parseFloat(totalGst.toFixed(2)),
                packaging: totalPackaging,
                forwarding: totalForwarding,
                packagingAndForwarding: totalPackagingAndForwarding,
                grandTotal: parseFloat(grandTotal.toFixed(2)),
                terms: values.terms,
                preparedBy: user.username || 'Unknown',
                approvedBy: 'Sayan Das',
                logo: logoBase64,
            };

            const blob = await pdf(<POPdf {...pdfProps} />).toBlob();
            const file = new File([blob], `PO-${poNumber}.pdf`, {
                type: 'application/pdf',
            });

            const email = (details as MasterDetails)?.vendors?.find((v) => v.vendorName === values.supplierName)?.email;

            const uploadParams: {
                file: File;
                folderId: string;
                uploadType?: 'upload' | 'email';
                email?: string;
                emailSubject?: string;
                emailBody?: string;
            } = {
                file,
                folderId: 'po_image',
                uploadType: 'upload',
            };

            if (email && email.trim() && email.includes('@')) {
                uploadParams.uploadType = 'email';
                uploadParams.email = email;
                uploadParams.emailSubject = `Purchase Order - ${poNumber}`;
                uploadParams.emailBody = `Please find attached Purchase Order ${poNumber}`;
            }

            // Upload PDF — if storage bucket not set up yet, continue without PDF link
            let url = '';
            try {
                url = await uploadFile(uploadParams);
            } catch (uploadErr: any) {
                console.warn('⚠️ PDF upload skipped:', uploadErr?.message);
                toast.warning('PDF upload skipped — PO will be saved without attachment.');
            }

            const rows: PoMasterSheet[] = values.indents.map((v) => {
                const indent = indentSheet.find((i: IndentSheetItem) => i.indentNumber === v.indentNumber);



                return {
                    timestamp: values.poDate.toISOString(),
                    partyName: values.supplierName,
                    poNumber,
                    internalCode: v.indentNumber,
                    product: v.productName || indent?.productName || '',
                    description: values.description,
                    quantity: v.quantity || 0,
                    unit: v.unit || '',
                    rate: v.rate || 0,
                    gst: v.gst,
                    companyEmail: values.companyEmail || '',
                    discount: v.discount || 0,
                    amount: (() => {
                        const base = (v.rate || 0) * (v.quantity || 0);
                        const discounted = base - (base * (v.discount || 0)) / 100;
                        const pkg = v.packaging || 0;
                        const fwd = v.forwarding || 0;
                        const taxable = discounted + pkg + fwd;
                        const itemAmount = taxable + (taxable * (v.gst || 0)) / 100;
                        return parseFloat(itemAmount.toFixed(2));
                    })(),
                    totalPoAmount: grandTotal,
                    packaging: v.packaging || 0,
                    forwarding: v.forwarding || 0,
                    packagingAndForwarding: (v.packaging || 0) + (v.forwarding || 0),
                    pdf: url,
                    quotationNumber: v.quotationNumber || '',
                    quotationDate: '',
                    enquiryNumber: values.ourEnqNo || '',
                    enquiryDate: values.enquiryDate ? formatDateTime(values.enquiryDate) : '',
                    term1: values.terms[0],
                    term2: values.terms[1],
                    term3: values.terms[2],
                    term4: values.terms[3],
                    term5: values.terms[4],
                    term6: values.terms[5],
                    term7: values.terms[6],
                    term8: values.terms[7],
                    term9: values.terms[8],
                    term10: values.terms[9],
                    discountPercent: v.discount || 0,
                    gstPercent: v.gst,
                    deliveryDate: formatDateTime(values.deliveryDate),
                    paymentTerms: values.paymentTerms,
                    numberOfDays: values.numberOfDays || 0,
                    deliveryDays: values.deliveryDays || 0,
                    deliveryType: values.deliveryType || '',
                    firmNameMatch: (indent as any)?.firmNameMatch ?? '',
                    advancePercent: (values.paymentTerms.toLowerCase().includes('partly') && (values.paymentTerms.toLowerCase().includes('advance') || values.paymentTerms.toLowerCase().includes('pi'))) ? (values.numberOfDays || 0) : 0,
                    advanceAmount: (values.paymentTerms.toLowerCase().includes('partly') && (values.paymentTerms.toLowerCase().includes('advance') || values.paymentTerms.toLowerCase().includes('pi'))) ? (calculateTotal(v.rate || 0, v.gst, v.discount || 0, v.quantity || 0) * (values.numberOfDays || 0)) / 100 : 0
                };
            });

            await insertPoRecords(rows);

            // Update indents to mark PO as created (set actual4 and delivery_date)
            const indentIds = values.indents.map(v => v.id).filter(id => id > 0);
            // Use ISO string for database compatibility to avoid "out of range" error
            const databaseDeliveryDate = values.deliveryDate.toISOString();
            if (indentIds.length > 0) {
                await updateIndentsAfterPoCreation(indentIds, databaseDeliveryDate, poNumber, url || undefined);
            }

            toast.success(`Successfully ${mode}d purchase order`);
            form.reset();

            // Refresh data from Supabase
            const [indents, poMaster] = await Promise.all([
                fetchIndents(),
                fetchPoMaster(),
            ]);
            setIndentSheet(indents);
            setPoMasterSheet(poMaster);
        } catch (e: any) {
            console.error('❌ PO Save Error:', e);
            const msg = e?.message || e?.error_description || String(e) || 'Unknown error';
            toast.error(`Failed to ${mode} purchase order: ${msg}`, { duration: 8000 });
        }
    }

    function onError() {
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Heading heading="Create or Revise PO" subtext="Create purchase order for indents or revise previous orders">
                <FilePlus2 size={50} className="text-primary" />
            </Heading>
            <div className="grid place-items-center w-full">
                <div className="sm:p-4 max-w-6xl w-full">
                <div className="w-full">
                    <Tabs defaultValue="create" onValueChange={(v) => setMode(v === 'create' ? v : 'revise')}>
                        <TabsList className="h-10 w-full rounded-none">
                            <TabsTrigger value="create">Create</TabsTrigger>
                            <TabsTrigger value="revise">Revise</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col items-center">
                        <div className="space-y-4 p-4 w-full bg-white shadow-md rounded-sm">
                            {/* Header Section */}
                            <div className="flex items-center justify-center gap-4 bg-green-50 p-2 h-25 rounded">
                                <img src="/Passary.jpeg" alt="Company Logo" className="w-40  object-contain" />
                                <div className="text-center">
                                    <h1 className="text-2xl font-bold">
                                        {firmCompanyName || 'Refrasynth Minerals India Private Limited'}
                                    </h1>
                                    <div>
                                        <p className="text-sm">
                                            {firmCompanyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212'}
                                        </p>
                                        <p className="text-sm">Phone No: +91 {firmCompanyPhone || '+91 7223844007'}</p>
                                    </div>
                                </div>
                            </div>
                            <hr />
                            <h2 className="text-center font-bold text-lg">Purchase Order</h2>
                            <hr />

                            {/* Form Fields */}
                            <div className="grid gap-5 px-4 py-2 text-foreground/80">
                                <div className="grid grid-cols-2 gap-x-5">
                                    <FormField control={form.control} name="poNumber" render={({ field }) => (
                                        <FormItem>
                                            {mode === 'create' ? (
                                                <>
                                                    <FormLabel>PO Number</FormLabel>
                                                    <FormControl>
                                                        <Input className="h-9" readOnly placeholder="Enter PO number" {...field} />
                                                    </FormControl>
                                                </>
                                            ) : (
                                                <FormControl>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormLabel>PO Number</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger size="sm" className="w-full">
                                                                <SelectValue placeholder="Select PO" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {filterUniquePoNumbers(poMasterSheet)
                                                                .filter(i => i.poNumber && i.poNumber.trim() !== '')
                                                                .map((i, k) => (
                                                                    <SelectItem key={k} value={i.poNumber}>
                                                                        {i.poNumber}
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            )}
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="poDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>PO Date</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" type="date" value={field.value && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-3 gap-x-5">
                                    <FormField control={form.control} name="supplierName" render={({ field }) => (
                                        <FormItem>
                                            {mode === 'create' ? (
                                                <FormControl>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormLabel>Supplier Name</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger size="sm" className="w-full">
                                                                <SelectValue placeholder="Select supplier" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {[...new Map(
                                                                indentSheet
                                                                    .filter((i: IndentSheetItem) => {
                                                                        const vendorName = i.approvedVendorName;
                                                                        const hasVendor = vendorName && typeof vendorName === 'string' && vendorName.trim() !== '';
                                                                        const hasApprovedVendor = i.approvedVendorName && typeof i.approvedVendorName === 'string' && i.approvedVendorName.trim() !== '';
                                                                        const hasPlannedDate = i.planned4 !== '';
                                                                        const hasNoActualDate = i.actual4 === '';
                                                                        return hasVendor && hasApprovedVendor && hasPlannedDate && hasNoActualDate;
                                                                    })
                                                                    .map((i) => [i.approvedVendorName, i])
                                                            ).values()]
                                                                .map((i, k) => (
                                                                    <SelectItem key={k} value={i.approvedVendorName as string}>
                                                                        {i.approvedVendorName as string}
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            ) : (
                                                <>
                                                    <FormLabel>Supplier Name</FormLabel>
                                                    <FormControl>
                                                        <Input className="h-9" readOnly placeholder="Enter supplier name" {...field} />
                                                    </FormControl>
                                                </>
                                            )}
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-3 gap-x-5">
                                    {/* Supplier Address - Changed to always be editable */}
                                    <FormField control={form.control} name="supplierAddress" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Supplier Address</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9"
                                                    readOnly={false}
                                                    placeholder="Enter supplier address"
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />

                                    {/* GSTIN - Changed to always be editable */}
                                    <FormField control={form.control} name="gstin" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>GSTIN</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9"
                                                    readOnly={false}
                                                    placeholder="Enter GSTIN"
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />

                                    {/* Supplier Email */}
                                    <FormField control={form.control} name="companyEmail" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Supplier Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    className="h-9"
                                                    type="email"
                                                    readOnly={false}
                                                    placeholder="Enter supplier email"
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-3 gap-x-5">
                                    <FormField control={form.control} name="deliveryDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Delivery Date</FormLabel>
                                            <FormControl>
                                                <Input className="h-9" type="date" value={field.value && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="paymentTerms" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Payment Terms</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                <FormControl>
                                                    <SelectTrigger size="sm" className="h-9">
                                                        <SelectValue placeholder="Select payment terms" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {details?.paymentTerms?.map((term, index) => (
                                                        <SelectItem key={index} value={term}>
                                                            {term}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>

                                {form.watch('paymentTerms') && (form.watch('paymentTerms').toLowerCase().includes('delivery') || (form.watch('paymentTerms').toLowerCase().includes('partly') && (form.watch('paymentTerms').toLowerCase().includes('advance') || form.watch('paymentTerms').toLowerCase().includes('pi')))) && (
                                    <div className="flex gap-4">
                                        <FormField control={form.control} name="numberOfDays" render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormLabel>
                                                    {form.watch('paymentTerms').toLowerCase().includes('partly') ? 'Advance %' : 'Number of Days'}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input className="h-9" type="number" placeholder={form.watch('paymentTerms').toLowerCase().includes('partly') ? 'Enter advance %' : 'Enter number of days'} {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )} />
                                        {form.watch('paymentTerms').toLowerCase().includes('partly') && (
                                            <div className="flex-1">
                                                <FormLabel>Advance Amount</FormLabel>
                                                <div className="h-9 flex items-center px-3 border rounded-md bg-muted/50 font-semibold text-sm">
                                                    ₹{(() => {
                                                        const indents = form.watch('indents') || [];
                                                        const subtotal = indents.reduce((sum, item) => {
                                                            const base = (item.rate || 0) * (item.quantity || 0);
                                                            const discounted = base - (base * (item.discount || 0)) / 100;
                                                            const pkg = item.packaging || 0;
                                                            const fwd = item.forwarding || 0;
                                                            return sum + discounted + pkg + fwd;
                                                        }, 0);
                                                        const gst = indents.reduce((sum, item) => {
                                                            const base = (item.rate || 0) * (item.quantity || 0);
                                                            const discounted = base - (base * (item.discount || 0)) / 100;
                                                            const pkg = item.packaging || 0;
                                                            const fwd = item.forwarding || 0;
                                                            const taxable = discounted + pkg + fwd;
                                                            return sum + (taxable * (item.gst || 0)) / 100;
                                                        }, 0);
                                                        const grandTotal = subtotal + gst;
                                                        const days = form.watch('numberOfDays') || 0;
                                                        return ((grandTotal * days) / 100).toFixed(2);
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <hr />

                            {/* Commercial Details Cards */}
                            <div className="grid md:grid-cols-3 gap-3">
                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-5 py-2">
                                        <CardTitle className="text-center">Our Commercial Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        <p><span className="font-semibold">GSTIN:</span> {firmCompanyGstin || '22AAHCP9274B1ZI'}</p>
                                        <p><span className="font-semibold">Pan No.</span> {firmCompanyPan || 'AACCJ1154B'}</p>
                                    </CardContent>
                                </Card>

                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-5 py-2">
                                        <CardTitle className="text-center">Billing Address</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        {vendor ? (
                                            <>
                                                <p className="font-semibold text-xs">{firmCompanyName || 'M/S Refrasynth Minerals India Private Limited'}</p>
                                                <p className="text-xs">{firmCompanyAddress || 'Shri Ram Business Park , Block - C, 2nd floor , Room No. 212'}</p>
                                            </>
                                        ) : (
                                            <p className="text-gray-400 text-center">Select Supplier</p>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="p-0 gap-0 shadow-xs rounded-[3px]">
                                    <CardHeader className="bg-muted px-5 py-2">
                                        <CardTitle className="text-center flex items-center justify-between">
                                            Destination Address
                                            {vendor && (
                                                <Button type="button" variant="ghost" size="sm"
                                                    onClick={isEditingDestination ? handleDestinationSave : handleDestinationEdit}
                                                    className="h-6 w-6 p-0 hover:bg-gray-200">
                                                    {isEditingDestination ? (
                                                        <Save size={14} className="text-green-600" />
                                                    ) : (
                                                        <Pencil size={14} className="text-gray-600" />
                                                    )}
                                                </Button>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 text-sm">
                                        {vendor ? (
                                            <>
                                                <p className="font-semibold text-xs">{firmCompanyName || 'M/S Refrasynth Minerals India Private Limited'}</p>
                                                {isEditingDestination ? (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Input value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)}
                                                            className="h-7 text-sm" placeholder="Enter destination address"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleDestinationSave();
                                                                } else if (e.key === 'Escape') {
                                                                    handleDestinationCancel();
                                                                }
                                                            }} autoFocus />
                                                        <Button type="button" variant="ghost" size="sm" onClick={handleDestinationCancel}
                                                            className="h-6 w-6 p-0 hover:bg-red-100">
                                                            <Trash size={12} className="text-red-500" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p>{destinationAddress}</p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-gray-400 text-center">Select Supplier</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <hr />

                            {/* Description */}
                            <div>
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Enter message" className="resize-y" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </div>

                            <hr />

                            {/* Items Table */}
                            <div className="mx-4 grid">
                                <div className="rounded-[3px] w-full min-w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>S/N</TableHead>
                                                <TableHead>Internal Code</TableHead>
                                                <TableHead>Quotation No.</TableHead>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Unit</TableHead>
                                                <TableHead>Rate</TableHead>
                                                <TableHead>Packaging (₹)</TableHead>
                                                <TableHead>Forwarding (₹)</TableHead>
                                                <TableHead>GST (%)</TableHead>
                                                <TableHead>Discount (%)</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {itemsArray.fields.map((field, index) => {
                                                const formValue = form.watch(`indents.${index}`);
                                                const amount = (() => {
                                                    const base = (formValue?.rate || 0) * (formValue?.quantity || 0);
                                                    const discounted = base - (base * (formValue?.discount || 0)) / 100;
                                                    const pkg = formValue?.packaging || 0;
                                                    const fwd = formValue?.forwarding || 0;
                                                    const taxable = discounted + pkg + fwd;
                                                    return taxable + (taxable * (formValue?.gst || 0)) / 100;
                                                })();

                                                return (
                                                    <TableRow key={field.id}>
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell className="font-medium">{formValue?.indentNumber || 'N/A'}</TableCell>
                                                        <TableCell className="font-medium">
                                                            <FormField control={form.control} name={`indents.${index}.quotationNumber`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input className="h-9 w-32 text-center bg-gray-50" value={field.value || ''} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>{formValue?.productName || 'No Product'}</TableCell>
                                                        <TableCell>{formValue?.specifications || <span className="text-muted-foreground italic">No description</span>}</TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.quantity`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input type="number" readOnly className="h-9 w-20 text-center bg-gray-50 cursor-not-allowed" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.unit`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input readOnly className="h-9 w-16 text-center bg-gray-50 cursor-not-allowed" value={field.value || ''} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.rate`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input type="number" readOnly className="h-9 w-24 text-center bg-gray-50 cursor-not-allowed" value={field.value || 0} onChange={field.onChange} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.packaging`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input 
                                                                             type="number" 
                                                                             className="h-9 w-24 text-center" 
                                                                             value={field.value === undefined || field.value === null ? '' : field.value} 
                                                                             onChange={(e) => {
                                                                                 const val = e.target.value;
                                                                                 field.onChange(val === '' ? '' : Number(val));
                                                                             }} 
                                                                         />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.forwarding`} render={({ field }) => (
                                                                <FormItem className="flex justify-center">
                                                                    <FormControl>
                                                                        <Input 
                                                                             type="number" 
                                                                             className="h-9 w-24 text-center" 
                                                                             value={field.value === undefined || field.value === null ? '' : field.value} 
                                                                             onChange={(e) => {
                                                                                 const val = e.target.value;
                                                                                 field.onChange(val === '' ? '' : Number(val));
                                                                             }} 
                                                                         />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.gst`} render={({ field }) => (
                                                                <FormItem className="flex items-center justify-center gap-1">
                                                                    <FormControl>
                                                                        <Input type="number" min={0} max={100} className="h-9 w-16 text-center" value={field.value || 0} onChange={(e) => field.onChange(Number(e.target.value))} />
                                                                    </FormControl>
                                                                    <span>%</span>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <FormField control={form.control} name={`indents.${index}.discount`} render={({ field }) => (
                                                                <FormItem className="flex items-center justify-center gap-1">
                                                                    <FormControl>
                                                                        <Input type="number" min={0} max={100} className="h-9 w-16 text-center" value={field.value || 0} onChange={(e) => field.onChange(Number(e.target.value))} />
                                                                    </FormControl>
                                                                    <span>%</span>
                                                                </FormItem>
                                                            )} />
                                                        </TableCell>
                                                        <TableCell className="font-medium">₹{amount.toFixed(2)}</TableCell>
                                                        <TableCell>
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => itemsArray.remove(index)}>
                                                                <Trash size={16} className="text-red-500" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Total Calculation */}
                                <div className="flex justify-end p-4">
                                    <div className="w-80 rounded-[3px] bg-muted">
                                        <p className="flex px-7 py-2 justify-between">
                                            <span>Total:</span>
                                            <span className="text-end">
{form.watch('indents')?.reduce((sum, item) => {
                                                    const base = (item.rate || 0) * (item.quantity || 0);
                                                    const discounted = base - (base * (item.discount || 0)) / 100;
                                                    const pkg = item.packaging || 0;
                                                    const fwd = item.forwarding || 0;
                                                    return sum + discounted + pkg + fwd;
                                                }, 0).toFixed(2)}
                                            </span>
                                        </p>
                                        <hr />
                                        <p className="flex px-7 py-2 justify-between">
                                            <span>GST Amount:</span>
                                            <span className="text-end">
{form.watch('indents')?.reduce((sum, item) => {
                                                    const base = (item.rate || 0) * (item.quantity || 0);
                                                    const discounted = base - (base * (item.discount || 0)) / 100;
                                                    const pkg = item.packaging || 0;
                                                    const fwd = item.forwarding || 0;
                                                    const taxable = discounted + pkg + fwd;
                                                    return sum + (taxable * (item.gst || 0)) / 100;
                                                }, 0).toFixed(2)}
                                            </span>
                                        </p>
                                        <hr />

                                        <p className="flex px-7 py-2 justify-between font-bold">
                                             <span>Grand Total:</span>
                                             <span className="text-end">
{(() => {
                                                     const indents = form.watch('indents') || [];
                                                     const subtotal = indents.reduce((sum, item) => {
                                                         const base = (item.rate || 0) * (item.quantity || 0);
                                                         const discounted = base - (base * (item.discount || 0)) / 100;
                                                         const pkg = item.packaging || 0;
                                                         const fwd = item.forwarding || 0;
                                                         return sum + discounted + pkg + fwd;
                                                     }, 0);
                                                     const gst = indents.reduce((sum, item) => {
                                                         const base = (item.rate || 0) * (item.quantity || 0);
                                                         const discounted = base - (base * (item.discount || 0)) / 100;
                                                         const pkg = item.packaging || 0;
                                                         const fwd = item.forwarding || 0;
                                                         const taxable = discounted + pkg + fwd;
                                                         return sum + (taxable * (item.gst || 0)) / 100;
                                                     }, 0);
                                                     return (subtotal + gst).toFixed(2);
                                                 })()}
                                             </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <hr />

                            {/* Terms Section */}
                            <div>
                                <p className="text-sm px-3 font-semibold">THE ABOVE</p>
                                <div>
                                    {termsArray.fields.map((field, index) => {
                                        const write = readOnly === index;
                                        return (
                                            <div className="flex items-center" key={field.id}>
                                                <span className="px-3">{index + 1}.</span>
                                                <FormField control={form.control} name={`terms.${index}`} render={({ field: termField }) => (
                                                    <FormItem className="w-full">
                                                        <FormControl>
                                                            <Input className={cn('border-transparent rounded-xs h-6 shadow-none', !write ? '' : 'border-b border-b-foreground')}
                                                                readOnly={!write} {...termField} />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                                <Button variant="ghost" type="button" onClick={(e) => {
                                                    e.preventDefault();
                                                    if (write) {
                                                        setReadOnly(-1);
                                                    } else if (readOnly === -1) {
                                                        setReadOnly(index);
                                                    } else {
                                                        toast.error(`Please save term ${readOnly + 1} before editing`);
                                                    }
                                                }}>
                                                    {!write ? <Pencil size={20} /> : <Save size={20} />}
                                                </Button>
                                                <Button variant="ghost" type="button" onClick={(e) => {
                                                    e.preventDefault();
                                                    if (readOnly === index) setReadOnly(-1);
                                                    termsArray.remove(index);
                                                }}>
                                                    <Trash className="text-red-300" size={20} />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="w-full flex justify-end p-3">
                                    <Button className="w-48" variant="outline" type="button" onClick={(e) => {
                                        e.preventDefault();
                                        if (termsArray.fields.length < 11) {
                                            if (readOnly === -1) {
                                                termsArray.append('');
                                                setReadOnly(termsArray.fields.length);
                                            } else {
                                                toast.error(`Please save term ${readOnly + 1} before creating`);
                                            }
                                        } else {
                                            toast.error('Only 10 terms are allowed');
                                        }
                                    }}>
                                        Add Term
                                    </Button>
                                </div>
                            </div>

                            <hr />

                            <div className="text-center flex justify-between gap-5 px-7 items-center">
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="grid grid-cols-3 gap-3 p-3 w-full max-w-6xl bg-background m-5 shadow-md rounded-md">
                            <Button type="reset" variant="outline" onClick={() => form.reset()}>
                                Reset
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handlePreview}
                                disabled={!vendor || indents.length === 0}
                            >
                                <Eye size={20} className="mr-2" />
                                Preview
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader size={20} color="white" aria-label="Loading Spinner" />}
                                Save And Send PO
                            </Button>
                        </div>

                        {/* Preview Dialog */}
                        <Dialog open={showPreview} onOpenChange={setShowPreview}>
                            <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 gap-0">
                                <DialogHeader className="px-6 py-4 border-b">
                                    <DialogTitle>PO Preview</DialogTitle>
                                </DialogHeader>
                                <div className="w-full h-[calc(95vh-70px)]">
                                    {previewData && (
                                        <PDFViewer
                                            width="100%"
                                            height="100%"
                                            showToolbar={true}
                                            style={{ border: 'none' }}
                                        >
                                            <POPdf {...previewData} />
                                        </PDFViewer>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </form>
                </Form>
            </div>
        </div>
        </div>
    );
};

export default CreatePO;
