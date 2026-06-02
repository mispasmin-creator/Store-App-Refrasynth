import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { z } from 'zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '../ui/tabs';
import { UserCheck, PenSquare, X, Search, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate, formatDateTime } from '@/lib/utils';
import { supabase, supabaseEnabled } from '@/lib/supabase';

interface VendorUpdateData {
    id: number;
    indentNo: string;
    firmNameMatch?: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Three Party' | 'Regular';
    planned2: string;
    actual2: string;
    specifications: string;
    areaOfUse: string;
}

interface HistoryData {
    id: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    vendorType: 'Three Party' | 'Regular';
    date: string;
    planned2: string;
    actual2: string;
    specifications: string;
    firmNameMatch?: string;
    areaOfUse: string;
    // For Three Party
    vendorName1?: string;
    rate1?: number;
    vendorName2?: string;
    rate2?: number;
    vendorName3?: string;
    rate3?: number;
}

export default () => {
    const { masterSheet: options } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<VendorUpdateData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<VendorUpdateData[]>([]);
    const [filteredTableData, setFilteredTableData] = useState<VendorUpdateData[]>([]);
    const [filteredHistoryData, setFilteredHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [dialogStep, setDialogStep] = useState(1);
    const [amountToDetermineType, setAmountToDetermineType] = useState<number>(0);
    const [computedVendorType, setComputedVendorType] = useState<'Regular' | 'Three Party'>('Regular');
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [dataLoading, setDataLoading] = useState(false);

    // Filter states
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedUOM, setSelectedUOM] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('');
    const [selectedHistoryUOM, setSelectedHistoryUOM] = useState<string>('');
    const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
    const [vendorSearch, setVendorSearch] = useState<string>('');
    const [productSearch, setProductSearch] = useState<string>('');
    const [searchTermVendor, setSearchTermVendor] = useState('');

    // Fetch pending vendor updates from Supabase
    const fetchPendingVendorUpdates = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned2', 'is', null)
                .is('actual2', null);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            const mappedData = rows.map((r) => ({
                id: r.id,
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name_match || '',
                indenter: r.indenter_name || '',
                department: r.department || '',
                product: r.product_name || '',
                quantity: r.approved_quantity || 0,
                uom: r.uom || '',
                vendorType: (r.vendor_type || 'Regular') as VendorUpdateData['vendorType'],
                planned2: r.planned2 || '',
                actual2: r.actual2 || '',
                specifications: r.specifications || '',
                areaOfUse: r.area_of_use || '',
            }));

            setTableData(mappedData);
            setFilteredTableData(mappedData);
        } catch (err) {
            console.error('Error fetching pending vendor updates:', err);
            toast.error('Failed to fetch pending vendor updates');
        } finally {
            setDataLoading(false);
        }
    };

    // Fetch completed vendor updates from Supabase
    const fetchCompletedVendorUpdates = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned2', 'is', null)
                .not('actual2', 'is', null);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            const mappedData = rows.map((r): HistoryData => ({
                id: r.id,
                date: formatDate(new Date(r.actual2)),
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name_match || '',
                indenter: r.indenter_name || '',
                department: r.department || '',
                product: r.product_name || '',
                quantity: r.approved_quantity || r.quantity || 0,
                uom: r.uom || '',
                rate: parseFloat(r.approved_rate) || 0,
                vendorType: (r.vendor_type || 'Regular') as HistoryData['vendorType'],
                planned2: r.planned2 || '',
                actual2: r.actual2 || '',
                specifications: r.specifications || '',
                areaOfUse: r.area_of_use || '',
                vendorName1: r.vendor_name1 || '',
                rate1: parseFloat(r.rate1) || 0,
                vendorName2: r.vendor_name2 || '',
                rate2: parseFloat(r.rate2) || 0,
                vendorName3: r.vendor_name3 || '',
                rate3: parseFloat(r.rate3) || 0,
            }));

            setHistoryData(mappedData);
            setFilteredHistoryData(mappedData);
        } catch (err) {
            console.error('Error fetching completed vendor updates:', err);
            toast.error('Failed to fetch completed vendor updates');
        } finally {
            setDataLoading(false);
        }
    };

    // Fetch data on mount and when firm name changes
    useEffect(() => {
        fetchPendingVendorUpdates();
        fetchCompletedVendorUpdates();
    }, [user.firmNameMatch]);

    // Filter pending data by date, UOM, and search query
    useEffect(() => {
        let filtered = [...tableData];

        if (selectedDate) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.planned2).toISOString().split('T')[0];
                return itemDate === selectedDate;
            });
        }

        if (selectedUOM && selectedUOM !== '__all__') {
            filtered = filtered.filter(item => item.uom === selectedUOM);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.indentNo.toLowerCase().includes(query) ||
                item.firmNameMatch?.toLowerCase().includes(query) ||
                item.indenter.toLowerCase().includes(query) ||
                item.department.toLowerCase().includes(query) ||
                item.product.toLowerCase().includes(query) ||
                item.specifications.toLowerCase().includes(query) ||
                item.areaOfUse?.toLowerCase().includes(query)
            );
        }

        if (vendorSearch.trim()) {
            const query = vendorSearch.toLowerCase();
            // In pending, we don't have vendor name usually, but if it comes from history we might. 
            // However, the user asked for this filter "specifically for the vendor rate comparison table" which usually means history/approval.
            // I'll leave it for now but focus on history.
        }

        if (productSearch.trim()) {
            const query = productSearch.toLowerCase();
            filtered = filtered.filter(item => item.product.toLowerCase().includes(query));
        }

        setFilteredTableData(filtered);
    }, [selectedDate, selectedUOM, searchQuery, vendorSearch, productSearch, tableData]);

    // Filter history data by date, UOM, and search query
    useEffect(() => {
        let filtered = [...historyData];

        if (selectedHistoryDate) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.actual2).toISOString().split('T')[0];
                return itemDate === selectedHistoryDate;
            });
        }

        if (selectedHistoryUOM && selectedHistoryUOM !== '__all__') {
            filtered = filtered.filter(item => item.uom === selectedHistoryUOM);
        }

        if (historySearchQuery.trim()) {
            const query = historySearchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.indentNo.toLowerCase().includes(query) ||
                item.firmNameMatch?.toLowerCase().includes(query) ||
                item.indenter.toLowerCase().includes(query) ||
                item.department.toLowerCase().includes(query) ||
                item.product.toLowerCase().includes(query) ||
                item.specifications.toLowerCase().includes(query) ||
                item.areaOfUse?.toLowerCase().includes(query)
            );
        }

        if (vendorSearch.trim()) {
            const query = vendorSearch.toLowerCase();
            filtered = filtered.filter(item =>
                (item.vendorName1?.toLowerCase().includes(query)) ||
                (item.vendorName2?.toLowerCase().includes(query)) ||
                (item.vendorName3?.toLowerCase().includes(query))
            );
        }

        if (productSearch.trim()) {
            const query = productSearch.toLowerCase();
            filtered = filtered.filter(item => item.product.toLowerCase().includes(query));
        }

        setFilteredHistoryData(filtered);
    }, [selectedHistoryDate, selectedHistoryUOM, historySearchQuery, vendorSearch, productSearch, historyData]);

    // Get unique UOMs for filter dropdown
    const uniqueUOMs = Array.from(new Set(tableData.map(item => item.uom))).sort();
    const uniqueHistoryUOMs = Array.from(new Set(historyData.map(item => item.uom))).sort();

    const handleEditClick = (row: HistoryData) => {
        setEditingRow(row.id);
        setEditValues({
            quantity: row.quantity,
            uom: row.uom,
            vendorType: row.vendorType,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (id: number) => {
        try {
            const updates = {
                approved_quantity: editValues.quantity,
                uom: editValues.uom,
                vendor_type: editValues.vendorType,
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', editingRow);

            if (error) throw error;

            toast.success(`Updated indent ${id}`);
            fetchCompletedVendorUpdates();
            setEditingRow(null);
            setEditValues({});
        } catch (err) {
            console.error('Error updating indent:', err);
            toast.error('Failed to update indent');
        }
    };

    const handleInputChange = (field: keyof HistoryData, value: any) => {
        setEditValues((prev) => ({ ...prev, [field]: value }));
    };

    // Clear all filters function
    const clearAllFilters = () => {
        setSelectedDate('');
        setSelectedUOM('');
        setSearchQuery('');
    };

    const clearAllHistoryFilters = () => {
        setSelectedHistoryDate('');
        setSelectedHistoryUOM('');
        setHistorySearchQuery('');
        setVendorSearch('');
        setProductSearch('');
    };

    // Upload file to Supabase Storage
    const uploadFileToSupabase = async (file: File, indentNumber: string): Promise<string> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${indentNumber}_comparison_${Date.now()}.${fileExt}`;
            const filePath = `comparison-sheets/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    };

    // Creating table columns
    const columns: ColumnDef<VendorUpdateData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<VendorUpdateData> }) => {
                        const indent = row.original;
                        return (
                            <div onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedHistory(null);
                                        setSelectedIndent(indent);
                                        setDialogStep(1);
                                        setAmountToDetermineType(0);
                                        setComputedVendorType(indent.vendorType);
                                        setOpenDialog(true);
                                    }}
                                >
                                    Update
                                </Button>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[200px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'areaOfUse',
            header: 'Area of Use',
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const status = row.original.vendorType;
                const variant = status === 'Regular' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        {
            accessorKey: 'planned2',
            header: 'Planned Date',
            cell: ({ row }) => formatDateTime(row.original.planned2)
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const indent = row.original;

                        return (
                            <div onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedIndent(null);
                                        setSelectedHistory(indent);
                                        setOpenDialog(true);
                                    }}
                                >
                                    Update
                                </Button>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'date',
            header: 'Date',
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[200px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'areaOfUse',
            header: 'Area of Use',
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                const rate = row.original.rate;
                const vendorType = row.original.vendorType;
                if (!rate && vendorType === 'Three Party') {
                    return <span className="text-muted-foreground">Not Decided</span>;
                }
                return <>&#8377;{rate}</>;
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const status = row.original.vendorType;
                const variant = status === 'Regular' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        {
            accessorKey: 'planned2',
            header: 'Planned Date',
            cell: ({ row }) =>
                row.original.planned2
                    ? formatDateTime(row.original.planned2)
                    : '-',
        },
        {
            accessorKey: 'actual2',
            header: 'Actual Date',
            cell: ({ row }) =>
                row.original.actual2
                    ? formatDateTime(row.original.actual2)
                    : '-',
        },
    ];

    // Creating Regular Vendor form
    const regularSchema = z.object({
        vendorName: z.string().min(1, "Vendor name is required"),
        rate: z.coerce.number().gt(0, "Rate must be greater than 0"),
        gstPercent: z.coerce.number().min(0, 'GST % is required'),
        paymentTerm: z.string().min(1, "Payment term is required"),
        advancePercent: z.coerce.number().min(0).max(100).optional(),
        quotationNo: z.string().optional(),
        quotationDate: z.string().optional(),
        deliveryTime: z.coerce.number().gt(0, "Delivery time must be greater than 0").optional(),
        make: z.string().optional(),
        transportType: z.string().optional(),
    });

    type RegularFormValues = z.infer<typeof regularSchema>;

    const regularForm = useForm<z.infer<typeof regularSchema>>({
        resolver: zodResolver(regularSchema),
        defaultValues: {
            vendorName: '',
            rate: 0,
            gstPercent: 0,
            paymentTerm: '',
            advancePercent: 0,
            deliveryTime: undefined,
            make: '',
            transportType: '',
        },
    });

    async function onSubmitRegular(values: z.infer<typeof regularSchema>) {
        try {
            const finalRate = values.rate * (1 + (values.gstPercent || 0) / 100);

            const updates = {
                actual2: new Date().toISOString(),
                planned3: new Date().toISOString(),
                po_requred: 'Yes', // Automatically set PO Required to Yes
                vendor_name1: values.vendorName,
                rate1: values.rate.toString(),
                select_rate_type1: 'Basic Rate',
                with_tax_or_not1: 'No',
                tax_value1: (values.gstPercent || 0).toString(),
                payment_term1: values.paymentTerm,
                advance_percent1: values.advancePercent?.toString(),
                quotation_no1: values.quotationNo || '',
                quotation_date1: values.quotationDate || '',
                delivery_time1: values.deliveryTime?.toString() || '',
                make1: values.make || '',
                transport_type1: values.transportType || '',
                vendor_type: computedVendorType,
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', selectedIndent?.id);

            if (error) throw error;

            toast.success(`Updated vendor of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            regularForm.reset();
            fetchPendingVendorUpdates();
            fetchCompletedVendorUpdates();
        } catch (error) {
            console.error('Error updating vendor:', error);
            toast.error('Failed to update vendor');
        }
    }

    // Creating Three Party Vendor form
    const threePartySchema = z.object({
        vendors: z.array(z.object({
            vendorName: z.string().optional(),
            rate: z.coerce.number().optional(),
            gstPercent: z.coerce.number().optional(),
            paymentTerm: z.string().optional(),
            advancePercent: z.coerce.number().optional(),
            whatsappNumber: z.string().optional(),
            emailId: z.string().optional(),
            quotationNo: z.string().optional(),
            quotationDate: z.string().optional(),
            deliveryTime: z.coerce.number().optional(),
            make: z.string().optional(),
            transportType: z.string().optional(),
        })).length(3).superRefine((vendors, ctx) => {
            // Vendors 1 and 2 are mandatory
            [0, 1].forEach(index => {
                const v = vendors[index];
                if (!v.vendorName?.trim()) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vendor Name is required', path: [index, 'vendorName'] });
                }
                if (!v.rate || v.rate <= 0) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rate must be > 0', path: [index, 'rate'] });
                }
                if (!v.paymentTerm) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pay terms required', path: [index, 'paymentTerm'] });
                }
                if (!v.whatsappNumber || v.whatsappNumber.length < 10) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Min 10 digits', path: [index, 'whatsappNumber'] });
                }
                if (!v.emailId || !/^\S+@\S+\.\S+$/.test(v.emailId)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email', path: [index, 'emailId'] });
                }
            });

            // Vendor 3 is optional, but if vendorName is entered, validate others
            const v3 = vendors[2];
            if (v3.vendorName?.trim()) {
                if (!v3.rate || v3.rate <= 0) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rate must be > 0', path: [2, 'rate'] });
                }
                if (!v3.paymentTerm) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pay terms required', path: [2, 'paymentTerm'] });
                }
                if (v3.whatsappNumber && v3.whatsappNumber.length < 10) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Min 10 digits', path: [2, 'whatsappNumber'] });
                }
                if (v3.emailId && !/^\S+@\S+\.\S+$/.test(v3.emailId)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email', path: [2, 'emailId'] });
                }
            }
        }),
        comparisonSheet: z.any().optional(),
        productCode: z.string().optional(),
    });

    const threePartyForm = useForm<z.infer<typeof threePartySchema>>({
        resolver: zodResolver(threePartySchema),
        defaultValues: {
            productCode: '',
            vendors: [
                {
                    vendorName: '',
                    rate: 0,
                    gstPercent: 0,
                    paymentTerm: '',
                    advancePercent: 0,
                    whatsappNumber: '',
                    emailId: '',
                    quotationNo: '',
                    quotationDate: '',
                    deliveryTime: undefined,
                    make: '',
                    transportType: '',
                },
                {
                    vendorName: '',
                    rate: 0,
                    gstPercent: 0,
                    paymentTerm: '',
                    advancePercent: 0,
                    whatsappNumber: '',
                    emailId: '',
                    quotationNo: '',
                    quotationDate: '',
                    deliveryTime: undefined,
                    make: '',
                    transportType: '',
                },
                {
                    vendorName: '',
                    rate: 0,
                    gstPercent: 0,
                    paymentTerm: '',
                    advancePercent: 0,
                    whatsappNumber: '',
                    emailId: '',
                    quotationNo: '',
                    quotationDate: '',
                    deliveryTime: undefined,
                    make: '',
                    transportType: '',
                },
            ],
        },
    });

    const { fields } = useFieldArray({
        control: threePartyForm.control,
        name: 'vendors',
    });

    useEffect(() => {
        if (amountToDetermineType > 0) {
            regularForm.setValue('rate', amountToDetermineType);
            // Three Party rates should be manually input as requested
        }
    }, [amountToDetermineType, regularForm]);

    // Watch for vendor selection to fetch payment term
    const watchVendorRegular = regularForm.watch('vendorName');
    const watchVendor0 = threePartyForm.watch('vendors.0.vendorName');
    const watchVendor1 = threePartyForm.watch('vendors.1.vendorName');
    const watchVendor2 = threePartyForm.watch('vendors.2.vendorName');

    useEffect(() => {
        if (watchVendorRegular && options?.vendors) {
            const vendor = options.vendors.find(v => v.vendorName === watchVendorRegular);
            if (vendor?.paymentTerm) {
                regularForm.setValue('paymentTerm', vendor.paymentTerm);
            }
        }
    }, [watchVendorRegular, options?.vendors, regularForm]);

    useEffect(() => {
        if (watchVendor0 && options?.vendors) {
            const vendor = options.vendors.find(v => v.vendorName === watchVendor0);
            if (vendor?.paymentTerm) {
                threePartyForm.setValue('vendors.0.paymentTerm', vendor.paymentTerm);
            }
        }
    }, [watchVendor0, options?.vendors, threePartyForm]);

    useEffect(() => {
        if (watchVendor1 && options?.vendors) {
            const vendor = options.vendors.find(v => v.vendorName === watchVendor1);
            if (vendor?.paymentTerm) {
                threePartyForm.setValue('vendors.1.paymentTerm', vendor.paymentTerm);
            }
        }
    }, [watchVendor1, options?.vendors, threePartyForm]);

    useEffect(() => {
        if (watchVendor2 && options?.vendors) {
            const vendor = options.vendors.find(v => v.vendorName === watchVendor2);
            if (vendor?.paymentTerm) {
                threePartyForm.setValue('vendors.2.paymentTerm', vendor.paymentTerm);
            }
        }
    }, [watchVendor2, options?.vendors, threePartyForm]);

    async function onSubmitThreeParty(values: z.infer<typeof threePartySchema>) {
        try {
            let url: string = '';

            if (values.comparisonSheet) {
                url = await uploadFileToSupabase(values.comparisonSheet, selectedIndent?.indentNo || '');
            }

            const processVendorData = (vendor: any) => {
                const rateTypeText = 'Basic Rate';
                let withTaxOrNot = 'No';
                let taxValue = vendor.gstPercent || 0;

                return {
                    rateType: rateTypeText,
                    rate: vendor.rate || 0,
                    withTaxOrNot,
                    taxValue,
                    advancePercent: vendor.advancePercent?.toString() || '0',
                    quotationNo: vendor.quotationNo || '',
                    quotationDate: vendor.quotationDate || '',
                    deliveryTime: vendor.deliveryTime?.toString() || '',
                    make: vendor.make || '',
                };
            };

            const vendor1Data = processVendorData(values.vendors[0]);
            const vendor2Data = processVendorData(values.vendors[1]);
            const vendor3Data = processVendorData(values.vendors[2]);

            const updates = {
                actual2: new Date().toISOString(),
                planned3: new Date().toISOString(), // Set planned3 for three party approval workflow

                // Vendor 1
                vendor_name1: values.vendors[0].vendorName,
                select_rate_type1: vendor1Data.rateType,
                rate1: vendor1Data.rate.toString(),
                with_tax_or_not1: vendor1Data.withTaxOrNot,
                tax_value1: vendor1Data.taxValue.toString(),
                payment_term1: values.vendors[0].paymentTerm,
                advance_percent1: vendor1Data.advancePercent,
                whatsapp_number1: values.vendors[0].whatsappNumber,
                email_id1: values.vendors[0].emailId,
                quotation_no1: vendor1Data.quotationNo,
                quotation_date1: vendor1Data.quotationDate,
                delivery_time1: vendor1Data.deliveryTime,
                make1: vendor1Data.make,
                transport_type1: values.vendors[0].transportType || '',

                // Vendor 2
                vendor_name2: values.vendors[1].vendorName,
                select_rate_type2: vendor2Data.rateType,
                rate2: vendor2Data.rate.toString(),
                with_tax_or_not2: vendor2Data.withTaxOrNot,
                tax_value2: vendor2Data.taxValue.toString(),
                payment_term2: values.vendors[1].paymentTerm,
                advance_percent2: vendor2Data.advancePercent,
                whatsapp_number2: values.vendors[1].whatsappNumber,
                email_id2: values.vendors[1].emailId,
                quotation_no2: vendor2Data.quotationNo,
                quotation_date2: vendor2Data.quotationDate,
                delivery_time2: vendor2Data.deliveryTime,
                make2: vendor2Data.make,
                transport_type2: values.vendors[1].transportType || '',

                // Vendor 3
                vendor_name3: values.vendors[2].vendorName,
                select_rate_type3: vendor3Data.rateType,
                rate3: vendor3Data.rate.toString(),
                with_tax_or_not3: vendor3Data.withTaxOrNot,
                tax_value3: vendor3Data.taxValue.toString(),
                payment_term3: values.vendors[2].paymentTerm,
                advance_percent3: vendor3Data.advancePercent,
                whatsapp_number3: values.vendors[2].whatsappNumber,
                email_id3: values.vendors[2].emailId,
                quotation_no3: vendor3Data.quotationNo,
                quotation_date3: vendor3Data.quotationDate,
                delivery_time3: vendor3Data.deliveryTime,
                make3: vendor3Data.make,
                transport_type3: values.vendors[2].transportType || '',

                comparison_sheet: url,
                product_code: values.productCode || '',
                vendor_type: computedVendorType,
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', selectedIndent?.id);

            if (error) throw error;

            toast.success(`Updated vendors of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            threePartyForm.reset();
            fetchPendingVendorUpdates();
            fetchCompletedVendorUpdates();
        } catch (error) {
            console.error('Error updating vendors:', error);
            toast.error('Failed to update vendors');
        }
    }

    // History Update form
    const historyUpdateSchema = z.object({
        rate: z.coerce.number().optional(),
        vendors: z.array(z.object({
            vendorName: z.string(),
            rate: z.coerce.number(),
        })).optional(),
    });

    const historyUpdateForm = useForm<z.infer<typeof historyUpdateSchema>>({
        resolver: zodResolver(historyUpdateSchema),
        defaultValues: {
            rate: 0,
            vendors: [],
        },
    });

    useEffect(() => {
        if (selectedHistory) {
            if (selectedHistory.vendorType === 'Regular') {
                historyUpdateForm.reset({
                    rate: selectedHistory.rate,
                    vendors: [],
                });
            } else {
                const vendors = [];
                if (selectedHistory.vendorName1) vendors.push({ vendorName: selectedHistory.vendorName1, rate: selectedHistory.rate1 || 0 });
                if (selectedHistory.vendorName2) vendors.push({ vendorName: selectedHistory.vendorName2, rate: selectedHistory.rate2 || 0 });
                if (selectedHistory.vendorName3) vendors.push({ vendorName: selectedHistory.vendorName3, rate: selectedHistory.rate3 || 0 });

                historyUpdateForm.reset({
                    rate: 0,
                    vendors: vendors,
                });
            }
        }
    }, [selectedHistory]);

    async function onSubmitHistoryUpdate(values: z.infer<typeof historyUpdateSchema>) {
        try {
            let updates: any = {};

            if (selectedHistory?.vendorType === 'Regular') {
                updates = {
                    rate1: values.rate?.toString(),
                    approved_rate: values.rate?.toString(),
                };
            } else {
                // Three Party update
                if (values.vendors?.[0]) updates.rate1 = values.vendors[0].rate.toString();
                if (values.vendors?.[1]) updates.rate2 = values.vendors[1].rate.toString();
                if (values.vendors?.[2]) updates.rate3 = values.vendors[2].rate.toString();
            }

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', selectedHistory?.id);

            if (error) throw error;

            toast.success(`Updated history for ${selectedHistory?.indentNo}`);
            setOpenDialog(false);
            historyUpdateForm.reset();
            fetchCompletedVendorUpdates();
        } catch (err) {
            console.error('Error updating history:', err);
            toast.error('Failed to update vendor');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog
                open={openDialog}
                onOpenChange={(open) => {
                    setOpenDialog(open);
                    if (!open) {
                        setSelectedIndent(null);
                        setSelectedHistory(null);
                    }
                }}
            >
                <Tabs defaultValue="pending">

                    <Heading
                        heading="Vendor Rate Update"
                        subtext="Update vendors for Regular and Three Party indents"
                        tabs
                        pendingCount={tableData.length}
                        historyCount={historyData.length}
                    >
                        <UserCog size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        {/* Compact Centered Filters for Pending Tab */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-center p-4 bg-muted/30 rounded-lg border">
                            {/* Date Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-32 sm:w-36"
                                        placeholder="Select Date"
                                    />
                                    {selectedDate && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedDate('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* UOM Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Select value={selectedUOM} onValueChange={setSelectedUOM}>
                                        <SelectTrigger className="w-32 sm:w-36">
                                            <SelectValue placeholder="Select UOM" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All UOMs</SelectItem>
                                            {uniqueUOMs.map((uom) => (
                                                <SelectItem key={uom} value={uom}>
                                                    {uom}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedUOM && selectedUOM !== '__all__' && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedUOM('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="w-full sm:w-auto flex-1 max-w-sm">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Filter by Product..."
                                        className="flex-1"
                                    />
                                    {productSearch && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setProductSearch('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Search Filter */}
                            <div className="w-full sm:w-auto flex-1 max-w-sm">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Global Search..."
                                        className="flex-1"
                                    />
                                    {searchQuery && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSearchQuery('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Clear All Button */}
                            {(selectedDate || selectedUOM || searchQuery) && (
                                <Button
                                    variant="outline"
                                    onClick={clearAllFilters}
                                    className="w-full sm:w-auto"
                                >
                                    Clear All
                                </Button>
                            )}
                        </div>

                        <DataTable
                            data={filteredTableData}
                            columns={columns}
                            searchFields={[]}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>

                    <TabsContent value="history">
                        {/* Compact Centered Filters for History Tab */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-center p-4 bg-muted/30 rounded-lg border">
                            {/* Date Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="date"
                                        value={selectedHistoryDate}
                                        onChange={(e) => setSelectedHistoryDate(e.target.value)}
                                        className="w-32 sm:w-36"
                                        placeholder="Select Date"
                                    />
                                    {selectedHistoryDate && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedHistoryDate('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* UOM Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Select value={selectedHistoryUOM} onValueChange={setSelectedHistoryUOM}>
                                        <SelectTrigger className="w-32 sm:w-36">
                                            <SelectValue placeholder="Select UOM" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All UOMs</SelectItem>
                                            {uniqueHistoryUOMs.map((uom) => (
                                                <SelectItem key={uom} value={uom}>
                                                    {uom}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedHistoryUOM && selectedHistoryUOM !== '__all__' && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedHistoryUOM('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Vendor Filter */}
                            <div className="w-full sm:w-auto flex-1 max-w-sm">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="text"
                                        value={vendorSearch}
                                        onChange={(e) => setVendorSearch(e.target.value)}
                                        placeholder="Filter by Party..."
                                        className="flex-1"
                                    />
                                    {vendorSearch && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setVendorSearch('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Product Filter */}
                            <div className="w-full sm:w-auto flex-1 max-w-sm">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Filter by Product..."
                                        className="flex-1"
                                    />
                                    {productSearch && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setProductSearch('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Search Filter */}
                            <div className="w-full sm:w-auto flex-1 max-w-sm">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="text"
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="flex-1"
                                    />
                                    {historySearchQuery && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setHistorySearchQuery('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Clear All Button */}
                            {(selectedHistoryDate || selectedHistoryUOM || historySearchQuery) && (
                                <Button
                                    variant="outline"
                                    onClick={clearAllHistoryFilters}
                                    className="w-full sm:w-auto"
                                >
                                    Clear All
                                </Button>
                            )}
                        </div>

                        <DataTable
                            data={filteredHistoryData}
                            columns={historyColumns}
                            searchFields={[]}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {/* Step 1 and Regular Vendor Step 2 */}
                {selectedIndent && !(dialogStep === 2 && computedVendorType === 'Three Party') && (
                    <DialogContent className={`${dialogStep === 2 ? 'max-w-5xl' : 'max-w-2xl'} max-h-[95vh] overflow-y-auto`}>
                        {dialogStep === 1 ? (
                            <div className="grid gap-5">
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Step 1: Determine Vendor Type</DialogTitle>
                                    <DialogDescription>
                                        <span className="font-medium">{selectedIndent?.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label>Amount of Item</Label>
                                        <Input
                                            type="number"
                                            value={amountToDetermineType || ''}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setAmountToDetermineType(val);
                                                if (val >= 5000) {
                                                    setComputedVendorType('Three Party');
                                                } else if (val > 0) {
                                                    // Default to Regular for < 5000, but allow user selection
                                                    if (computedVendorType !== 'Three Party' && computedVendorType !== 'Regular') {
                                                        setComputedVendorType('Regular');
                                                    }
                                                }
                                            }}
                                            placeholder="Enter amount"
                                        />
                                    </div>

                                    {amountToDetermineType < 5000 ? (
                                        <div className="grid gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <Label>Vendor Type Selection</Label>
                                            <Select
                                                value={computedVendorType}
                                                onValueChange={(val: 'Regular' | 'Three Party') => setComputedVendorType(val)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select Vendor Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Regular">Regular Vendor</SelectItem>
                                                    <SelectItem value="Three Party">Three Party (3 Party)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-muted-foreground font-medium italic">
                                                * Amount is less than 5000. Please select vendor type manually.
                                            </p>
                                        </div>
                                    ) : amountToDetermineType >= 5000 ? (
                                        <div className="p-3 bg-muted rounded-md text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-muted-foreground">Vendor Type:</span>
                                                <Pill variant="secondary">Three Party</Pill>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                    <Button
                                        onClick={() => setDialogStep(2)}
                                        disabled={!amountToDetermineType || amountToDetermineType <= 0}
                                    >
                                        Next
                                    </Button>
                                </DialogFooter>
                            </div>
                        ) : computedVendorType === 'Regular' ? (
                            <Form {...regularForm}>
                                <form
                                    onSubmit={regularForm.handleSubmit(onSubmitRegular, onError)}
                                    className="grid gap-5"
                                >
                                    <DialogHeader className="grid gap-2">
                                        <DialogTitle>Step 2: Update Regular Vendor</DialogTitle>
                                        <DialogDescription>
                                            Update vendor for indent{' '}
                                            <span className="font-medium">{selectedIndent?.indentNo}</span>
                                        </DialogDescription>
                                    </DialogHeader>
                                    {/* Copy existing form fields... */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <FormField
                                                control={regularForm.control}
                                                name="vendorName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Vendor Name</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select vendor" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search vendors..."
                                                                        value={searchTermVendor}
                                                                        onChange={(e) => setSearchTermVendor(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {options?.vendorNames
                                                                    ?.filter((v) =>
                                                                        v.toLowerCase().includes(searchTermVendor.toLowerCase())
                                                                    )
                                                                    .map((v, i) => (
                                                                        <SelectItem key={i} value={v}>
                                                                            {v}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:col-span-2 border-t pt-4">
                                            <FormField
                                                control={regularForm.control}
                                                name="quotationNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Quotation No</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="Quotation no." />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={regularForm.control}
                                                name="quotationDate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Quotation Date</FormLabel>
                                                        <FormControl>
                                                            <Input type="date" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 md:col-span-2">
                                            <FormField
                                                control={regularForm.control}
                                                name="rate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Basic Rate</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={regularForm.control}
                                                name="gstPercent"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>GST %</FormLabel>
                                                        <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select GST %" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="0">0%</SelectItem>
                                                                <SelectItem value="5">5%</SelectItem>
                                                                <SelectItem value="18">18%</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className={`grid gap-4 md:col-span-2 ${regularForm.watch('paymentTerm') === 'Partly Advance/ Partly PI' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                            <FormField
                                                control={regularForm.control}
                                                name="paymentTerm"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Payment Term</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select payment term" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {options?.paymentTerms?.map((term, i) => (
                                                                    <SelectItem key={i} value={term}>
                                                                        {term}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {regularForm.watch('paymentTerm') === 'Partly Advance/ Partly PI' && (
                                                <FormField
                                                    control={regularForm.control}
                                                    name="advancePercent"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Advance %</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" placeholder="Enter % e.g. 50" {...field} min={0} max={100} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 md:col-span-2 border-t pt-4">
                                            <FormField
                                                control={regularForm.control}
                                                name="deliveryTime"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Delivery Time (Days)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" placeholder="e.g. 4" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={regularForm.control}
                                                name="make"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Make</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Enter make" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <FormField
                                                control={regularForm.control}
                                                name="transportType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Transport Type</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select transport type" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Ex-Factory">Ex-Factory</SelectItem>
                                                                <SelectItem value="FOR">FOR</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setDialogStep(1)}>Back</Button>
                                        <Button type="submit" disabled={regularForm.formState.isSubmitting}>
                                            {regularForm.formState.isSubmitting && (
                                                <Loader size={20} color="white" aria-label="Loading Spinner" />
                                            )}
                                            Update
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        ) : null}
                    </DialogContent>
                )}

                {/* Unique Three Party Vendor Step 2 */}
                {selectedIndent && dialogStep === 2 && computedVendorType === 'Three Party' && (
                    <DialogContent
                        className="max-h-[95vh] overflow-y-auto"
                        style={{ maxWidth: '98vw', width: '98vw' }}
                    >
                        <Form {...threePartyForm}>
                            <form
                                onSubmit={threePartyForm.handleSubmit(onSubmitThreeParty, onError)}
                                className="grid gap-6"
                            >
                                <DialogHeader>
                                    <DialogTitle>Step 2: Update Three Party Vendors</DialogTitle>
                                    <DialogDescription>
                                        Update vendors for indent <span className="font-medium">{selectedIndent.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                                    <FormField
                                        control={threePartyForm.control}
                                        name="productCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Product Code (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter product code" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="border p-4 rounded-xl shadow-sm space-y-4">
                                            <h3 className="font-bold border-b pb-2 text-green-600">Vendor {index + 1} {index === 2 && "(Optional)"}</h3>

                                            <div className="grid gap-4">
                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.vendorName`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Vendor Name</FormLabel>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                defaultValue={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select vendor" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <div className="flex items-center border-b px-3 pb-2 sticky top-0 bg-background z-10">
                                                                        <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                        <input
                                                                            placeholder="Search vendors..."
                                                                            value={searchTermVendor}
                                                                            onChange={(e) => setSearchTermVendor(e.target.value)}
                                                                            className="h-10 w-full border-0 bg-transparent text-sm outline-none"
                                                                        />
                                                                    </div>
                                                                    {options?.vendorNames
                                                                        ?.filter((v) => v.toLowerCase().includes(searchTermVendor.toLowerCase()))
                                                                        .map((v, i) => (
                                                                            <SelectItem key={i} value={v}>{v}</SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className="grid grid-cols-1 gap-4">
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.quotationNo`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Quotation No</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} placeholder="Quotation no." />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.quotationDate`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Quotation Date</FormLabel>
                                                                <FormControl>
                                                                    <Input type="date" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.rate`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Basic Rate</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.gstPercent`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>GST %</FormLabel>
                                                                <Select
                                                                    onValueChange={(val) => field.onChange(Number(val))}
                                                                    value={field.value?.toString()}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select GST %" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="0">0%</SelectItem>
                                                                        <SelectItem value="5">5%</SelectItem>
                                                                        <SelectItem value="18">18%</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.paymentTerm`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Payment Term</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select payment term" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {options?.paymentTerms?.map((term, i) => (
                                                                        <SelectItem key={i} value={term}>{term}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                {threePartyForm.watch(`vendors.${index}.paymentTerm`) === 'Partly Advance/ Partly PI' && (
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.advancePercent`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Advance %</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" placeholder="Enter % e.g. 50" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}

                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.whatsappNumber`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>WhatsApp</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} placeholder="WhatsApp no." />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.emailId`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Email ID</FormLabel>
                                                                <FormControl>
                                                                    <Input type="email" {...field} placeholder="Email" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.deliveryTime`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Delivery Time (Days)</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" placeholder="Days" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.make`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Make</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} placeholder="Make" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.transportType`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Transport Type</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select transport type" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="Ex-Factory">Ex-Factory</SelectItem>
                                                                    <SelectItem value="FOR">FOR</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogStep(1)}>Back</Button>
                                    <Button type="submit" disabled={threePartyForm.formState.isSubmitting}>
                                        {threePartyForm.formState.isSubmitting && (
                                            <Loader size={20} color="white" aria-label="Loading Spinner" />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {selectedHistory && (
                    <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                        <Form {...historyUpdateForm}>
                            <form
                                onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Update Rate</DialogTitle>
                                    <DialogDescription>
                                        Update rate for indent{' '}
                                        <span className="font-medium">{selectedHistory?.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                {selectedHistory?.vendorType === 'Regular' ? (
                                    <FormField
                                        control={historyUpdateForm.control}
                                        name="rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Approved Rate (Regular)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm font-semibold text-muted-foreground border-b pb-2">Three Party Vendor Rates</p>
                                        {selectedHistory?.vendorName1 && (
                                            <FormField
                                                control={historyUpdateForm.control}
                                                name="vendors.0.rate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{selectedHistory.vendorName1}</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        {selectedHistory?.vendorName2 && (
                                            <FormField
                                                control={historyUpdateForm.control}
                                                name="vendors.1.rate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{selectedHistory.vendorName2}</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        {selectedHistory?.vendorName3 && (
                                            <FormField
                                                control={historyUpdateForm.control}
                                                name="vendors.2.rate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{selectedHistory.vendorName3}</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                )}

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={historyUpdateForm.formState.isSubmitting}>
                                        {historyUpdateForm.formState.isSubmitting && (
                                            <Loader size={20} color="white" aria-label="Loading Spinner" />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};
