import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { supabase } from '@/lib/supabase';
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
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ShoppingCart, X, Truck, FileText, IndianRupee, CreditCard, User, Phone, CheckCircle2, Package, Info, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime, parseCustomDate } from '@/lib/utils';
import {
    fetchIndentRecords,
    fetchStoreInRecords,
    fetchVendorOptions,
    insertStoreInRecord,
    updateCancelQuantity,
    uploadBillPhoto,
    updateActual5Timestamp,
    updateLiftingStatus,
    type GetLiftIndentRecord,
    type GetLiftStoreInRecord,
} from '@/services/getLiftService';

interface GetPurchaseData {
    indentNo: string;
    firmNameMatch: string;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    product?: string;
    quantity?: number;
    pendingLiftQty?: number;
    receivedQty?: number;
    pendingPoQty?: number;
    plannedDate?: string;
    approvedRate?: string;
    timestamp?: string;
    department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
    products?: string[];
    indentNumbers?: string[];
    expectedDate?: string;
    originalItems?: any[];
}

interface HistoryData {
    indentNo: string;
    firmNameMatch: string;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    product?: string;
    photoOfBill?: string;
    quantity?: number;
    pendingLiftQty?: number;
    receivedQty?: number;
    pendingPoQty?: number;
    timestamp?: string;
    department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
    products?: string[];
    indentNumbers?: string[];
    originalItems?: any[];
    liftNumber: string;
    qty?: number;
    billNo?: string;
    billStatus?: string;
    typeOfBill?: string;
    billAmount?: number;
    transportationInclude?: string;
    transporterName?: string;
    vehicleNo?: string;
    driverName?: string;
    driverMobileNo?: string;
    amount?: number;
    billRemark?: string;
    approvedRate?: string;
    taxValue?: number;
    withTax?: string;
}

interface AuthUser {
    firmNameMatch?: string;
    receiveItemAction?: boolean;
    administrate?: boolean;
}

export default function GetPurchase() {
    const { user } = useAuth() as { user: AuthUser };
    const [selectedIndent, setSelectedIndent] = useState<GetPurchaseData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<GetPurchaseData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [vendorOptions, setVendorOptions] = useState<string[]>([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showCancelQty, setShowCancelQty] = useState(false);
    const [cancelQtyValue, setCancelQtyValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [indentRecords, setIndentRecords] = useState<GetLiftIndentRecord[]>([]);
    const [storeInRecords, setStoreInRecords] = useState<GetLiftStoreInRecord[]>([]);

    // Fetch all data from Supabase
    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [vendors, indents, storeIns] = await Promise.all([
                    fetchVendorOptions(),
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                ]);

                setVendorOptions(vendors);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, []);

    // Process pending table data
    useEffect(() => {
        const filteredByFirm = indentRecords.filter(
            (sheet) =>
                user?.firmNameMatch?.toLowerCase() === 'all' ||
                sheet.firmNameMatch === user?.firmNameMatch
        );
        const processedData = filteredByFirm
            .map((sheet) => {
                // Calculate received quantity from STORE IN records
                const receivedQty = (Number(sheet.receivedQuantity) || 0) + storeInRecords
                    .filter(
                        (store) =>
                            store.indentNo === sheet.indentNumber?.toString() &&
                            store.firmNameMatch === sheet.firmNameMatch
                    )
                    .reduce(
                        (sum, store) =>
                            sum + (Number(store.qty) || 0),
                        0
                    );

                // Priority: Use approved_quantity if set (>0), otherwise original quantity.
                // Subtract receivedQty to determine what's left to lift.
                const approvedQtySafe = Number(sheet.approvedQuantity) || Number(sheet.quantity) || 0;
                const pendingPoQty = (approvedQtySafe - receivedQty);

                return { ...sheet, pendingPoQty, receivedQty, receivedQuantity: sheet.receivedQuantity };
            })
            .filter((item) => {
                // Show only Pending items with planned date but no actual date
                const hasPlanned5 = item.planned5 && item.planned5.toString().trim() !== '';
                const hasActual5 = item.actual5 && item.actual5.toString().trim() !== '';
                const isPending = item.liftingStatus === 'Pending' || item.liftingStatus === '' || item.liftingStatus === null;

                // ✅ Hide if no quantity left to lift
                return isPending && hasPlanned5 && !hasActual5 && item.pendingPoQty > 0;
            });

        // Group by PO Number
        const groupedMap = new Map<string, any>();

        processedData.forEach((item) => {
            const key = item.poNumber || `NO_PO_${item.indentNumber}`;
            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    indentNo: item.indentNumber?.toString() || '',
                    firmNameMatch: item.firmNameMatch || '',
                    vendorName: item.approvedVendorName || '',
                    poNumber: item.poNumber || '',
                    poDate: item.actual4 ? formatDate(parseCustomDate(item.actual4)) : '',
                    deliveryDate: item.deliveryDate
                        ? formatDate(parseCustomDate(item.deliveryDate))
                        : '',
                    plannedDate: item.planned5
                        ? formatDate(parseCustomDate(item.planned5))
                        : 'Not Set',
                    product: item.productName || '',
                    quantity: 0,
                    pendingLiftQty: 0,
                    receivedQty: 0,
                    pendingPoQty: 0,
                    approvedRate: item.approvedRate || '',
                    timestamp: item.timestamp || '',
                    department: item.department || '',
                    areaOfUse: item.areaOfUse || '',
                    approvedVendorName: item.approvedVendorName || '',
                    liftingStatus: item.liftingStatus || '',
                    indentNumbers: [],
                    products: [],
                    expectedDate: item.expectedDate ? formatDate(parseCustomDate(item.expectedDate)) : '',
                    rawExpectedDate: item.expectedDate || null,
                    originalItems: []
                });
            }

            const group = groupedMap.get(key);
            group.quantity += Number(item.approvedQuantity) || 0;
            group.pendingLiftQty += item.pendingPoQty;
            group.receivedQty += item.receivedQty;
            group.pendingPoQty += item.pendingPoQty;
            group.indentNumbers.push(item.indentNumber);
            group.products.push(item.productName);
            group.originalItems.push(item);
        });

        const sortedData = Array.from(groupedMap.values()).sort((a, b) => {
            const dateA = a.rawExpectedDate ? parseCustomDate(a.rawExpectedDate).getTime() : Infinity;
            const dateB = b.rawExpectedDate ? parseCustomDate(b.rawExpectedDate).getTime() : Infinity;
            return dateA - dateB;
        });

        setTableData(sortedData);
    }, [indentRecords, storeInRecords, user?.firmNameMatch]);

    // Process history data
    useEffect(() => {
        const filteredByFirm = indentRecords.filter(
            (sheet) =>
                user?.firmNameMatch?.toLowerCase() === 'all' ||
                sheet.firmNameMatch === user?.firmNameMatch
        );

        const completedIndents = filteredByFirm.filter((sheet) => {
            return (
                sheet.liftingStatus === 'Complete' &&
                sheet.planned5 &&
                sheet.planned5.toString().trim() !== ''
            );
        });

        const indentDataMap = new Map(
            completedIndents.map((sheet) => [
                `${sheet.indentNumber?.toString() || ''}_${sheet.firmNameMatch || ''}`,
                {
                    poNumber: sheet.poNumber || '',
                    poDate: sheet.actual4 ? formatDate(parseCustomDate(sheet.actual4)) : '',
                    deliveryDate: sheet.deliveryDate
                        ? formatDate(parseCustomDate(sheet.deliveryDate))
                        : '',
                    approvedVendorName: sheet.approvedVendorName || '',
                    productName: sheet.productName || '',
                    approvedQuantity: sheet.quantity || 0,
                    pendingLiftQty: sheet.pendingQty || 0,
                    firmNameMatch: sheet.firmNameMatch || '',
                },
            ])
        );

        const filteredStoreIn = storeInRecords.filter(
            (sheet) =>
                user?.firmNameMatch?.toLowerCase() === 'all' ||
                sheet.firmNameMatch === user?.firmNameMatch
        );

        setHistoryData(
            filteredStoreIn
                .filter((sheet) => indentDataMap.has(`${sheet.indentNo || ''}_${sheet.firmNameMatch || ''}`))
                .map((sheet) => {
                    const indentData = indentDataMap.get(`${sheet.indentNo || ''}_${sheet.firmNameMatch || ''}`)!;

                    const indentRecord = completedIndents.find(
                        (indent) => indent.indentNumber?.toString() === sheet.indentNo && indent.firmNameMatch === sheet.firmNameMatch
                    );

                    const approvedQty =
                        Number(indentRecord?.approvedQuantity) || 0;

                    const receivedQty = (Number(indentRecord?.receivedQuantity) || 0) + filteredStoreIn
                        .filter((store) => store.indentNo === sheet.indentNo && store.firmNameMatch === sheet.firmNameMatch)
                        .reduce(
                            (sum, store) =>
                                sum + (Number(store.qty) || 0),
                            0
                        );

                    const pendingLift = approvedQty - receivedQty;

                    return {
                        liftNumber: sheet.liftNumber || '',
                        indentNo: sheet.indentNo || '',
                        firmNameMatch: indentData.firmNameMatch || sheet.firmNameMatch || '',
                        vendorName: indentData.approvedVendorName || sheet.vendorName || '',
                        poNumber: indentData.poNumber,
                        poDate: indentData.poDate,
                        deliveryDate: indentData.deliveryDate,
                        product: indentData.productName,
                        quantity: approvedQty,
                        pendingLiftQty: pendingLift,
                        receivedQty: receivedQty,
                        pendingPoQty: Math.max(0, pendingLift),
                        photoOfBill: sheet.photoOfBill || '',
                        timestamp: sheet.timestamp || '',
                        department: indentRecord?.department || '',
                        areaOfUse: indentRecord?.areaOfUse || '',
                        approvedVendorName: indentRecord?.approvedVendorName || '',
                        liftingStatus: indentRecord?.liftingStatus || '',
                        qty: sheet.qty || 0,
                        billNo: sheet.billNo || '',
                        billStatus: sheet.billStatus || '',
                        typeOfBill: sheet.typeOfBill || '',
                        billAmount: sheet.billAmount || 0,
                        transportationInclude: sheet.transportationInclude || '',
                        transporterName: sheet.transporterName || '',
                        vehicleNo: sheet.vehicleNo || '',
                        driverName: sheet.driverName || '',
                        driverMobileNo: sheet.driverMobileNo || '',
                        amount: sheet.amount || 0,
                        billRemark: sheet.billRemark || '',
                        approvedRate: indentRecord?.approvedRate || '',
                        taxValue: indentRecord?.taxValue || 0,
                        withTax: indentRecord?.withTax || 'No',
                    };
                })
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [storeInRecords, indentRecords, user?.firmNameMatch]);

    // Creating table columns
    const columns: ColumnDef<GetPurchaseData>[] = [
        ...(user?.receiveItemAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GetPurchaseData> }) => {
                        const indent = row.original;
                        return (
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                            setShowCancelQty(false);
                                            setCancelQtyValue('');
                                        }}
                                    >
                                        Update
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div className="font-bold">{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'vendorName',
            header: 'Approved Vendor Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'products',
            header: 'Products',
            cell: ({ row }) => {
                const products = row.original.products || [];
                return (
                    <div className="max-w-[200px] truncate" title={products.join(', ')}>
                        {products.length > 1 ? `${products[0]} (+${products.length - 1})` : products[0]}
                    </div>
                );
            }
        },
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'expectedDate',
            header: 'Expected Date',
            cell: ({ getValue }) => <div className="text-gray-900">{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'plannedDate', // ✅ ADD THIS COLUMN
            header: 'Planned Date',
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div
                        className={`${plannedDate === 'Not Set' ? 'text-muted-foreground italic' : ''}`}
                    >
                        {plannedDate}
                    </div>
                );
            },
        },
        {
            accessorKey: 'pendingLiftQty',
            header: 'Pending Lift Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'receivedQty',
            header: 'Received Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'pendingPoQty',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user?.administrate
            ? [
                {
                    id: 'edit',
                    header: 'Edit',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const item = row.original;
                        return (
                            <div className="flex items-center justify-center">
                                <Checkbox
                                    checked={selectedHistory?.liftNumber === item.liftNumber}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedHistory(item);
                                            setSelectedIndent(null);
                                            setOpenDialog(true);
                                        } else {
                                            setSelectedHistory(null);
                                            setOpenDialog(false);
                                        }
                                    }}
                                />
                            </div>
                        );
                    },
                },
              ]
            : []),
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'vendorName',
            header: 'Approved Vendor Name',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ getValue }) => {
                const photoUrl = getValue() as string;
                if (!photoUrl) return <div className="text-muted-foreground">-</div>;

                return (
                    <div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(photoUrl, '_blank')}
                        >
                            View Bill
                        </Button>
                    </div>
                );
            },
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ getValue }) => <div>{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'pendingLiftQty',
            header: 'Pending Lift Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'receivedQty',
            header: 'Received Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'pendingPoQty',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div>{(getValue() as number) || 0}</div>,
        },
    ];

    // Creating form schema
    const formSchema = z.object({
        billStatus: z.string().min(1, 'Bill status is required'),
        billNo: z.string().optional(),
        qty: z.coerce.number().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        photoOfBill: z
            .union([z.instanceof(File), z.string()])
            .optional()
            .refine((file) => {
                // Allow both images and PDFs
                if (!file) return true; // Optional field
                if (typeof file === 'string') return true; // Already uploaded URL string
                const allowedTypes = [
                    'image/jpeg',
                    'image/jpg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'application/pdf',
                ];
                return allowedTypes.includes(file.type);
            }, 'File must be an image (JPEG, PNG, GIF, WebP) or PDF'),
        billRemark: z.string().optional(),
        vendorName: z.string().optional(),
        transportationInclude: z.string().optional(),
        transporterName: z.string().optional(),
        vehicleNo: z.string().optional(),
        driverName: z.string().optional(),
        driverMobileNo: z.string().optional(),
        amount: z.coerce.number().optional(),
        cancelPendingQty: z.coerce.number().optional(),
        items: z.array(z.object({
            indentNo: z.string(),
            product: z.string(),
            poNumber: z.string(),
            quantity: z.coerce.number(),
            pendingLiftQty: z.coerce.number(),
            receivedQty: z.coerce.number(),
            pendingPoQty: z.coerce.number(),
            approvedRate: z.union([z.string(), z.number()]),
            taxValue: z.coerce.number(),
            withTax: z.string(),
            liftQty: z.coerce.number().min(0),
        })).superRefine((items, ctx) => {
            items.forEach((item, index) => {
                const numericLiftQty = Number(item.liftQty) || 0;
                if (numericLiftQty > item.pendingLiftQty) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Lift quantity (${numericLiftQty}) cannot exceed Pending quantity (${item.pendingLiftQty})`,
                        path: [`${index}`, 'liftQty'],
                    });
                }
            });
        })
        // Removed discount/advance refinements
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any, // Add type assertion here
        defaultValues: {
            billStatus: '',
            billNo: '',
            qty: 0,
            typeOfBill: 'independent',
            billAmount: 0,
            billRemark: '',
            vendorName: '',
            transportationInclude: 'Yes',
            transporterName: '',
            vehicleNo: '',
            driverName: '',
            driverMobileNo: '',
            amount: 0,
            cancelPendingQty: 0,
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    const billStatus = form.watch('billStatus');
    const typeOfBill = form.watch('typeOfBill');

    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    // Handle cancel quantity only submission
    const handleCancelQtySubmit = async () => {
        if (!cancelQtyValue || Number(cancelQtyValue) <= 0) {
            toast.error('Please enter a valid quantity to cancel');
            return;
        }

        const cancelQty = Number(cancelQtyValue);
        if (cancelQty > (selectedIndent?.pendingPoQty || 0)) {
            toast.error(
                `Cancel quantity cannot exceed pending PO quantity: ${selectedIndent?.pendingPoQty || 0}`
            );
            return;
        }

        try {
            console.log('❌ Processing cancel pending quantity only:', cancelQty);

            if (!selectedIndent?.indentNo) {
                toast.error('Could not find the indent record to update');
                return;
            }

            await updateCancelQuantity(selectedIndent.indentNo, cancelQty);

            toast.success(`Cancelled ${cancelQty} quantity for ${selectedIndent?.indentNo}`);
            setShowCancelQty(false);
            setCancelQtyValue('');

            // Refresh data
            setTimeout(async () => {
                const [indents, storeIns] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                ]);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
                console.log('🔄 Data refreshed after cancel');
            }, 1500);
        } catch (error) {
            console.error('❌ Error in cancel quantity:', error);
            toast.error('Failed to cancel quantity. Please try again.');
        }
    };
    // Add this useEffect to set form values when selectedIndent changes
    useEffect(() => {
        if (selectedIndent) {
            // Find ALL individual items for this VENDOR across all pending POs
            const allVendorGroups = tableData.filter(group => group.vendorName === selectedIndent.vendorName);
            const allIndividualItems = allVendorGroups.flatMap(group => group.originalItems || []);

            form.reset({
                billStatus: '',
                billNo: '',
                qty: selectedIndent.pendingLiftQty || 0,
                typeOfBill: 'independent',
                billAmount: 0,
                billRemark: '',
                vendorName: selectedIndent.vendorName || '',
                transportationInclude: 'No',
                transporterName: '',
                vehicleNo: '',
                driverName: '',
                driverMobileNo: '',
                amount: 0,
                cancelPendingQty: 0,
                items: allIndividualItems.map(item => ({
                    indentNo: item.indentNumber?.toString() || '',
                    product: item.productName || '',
                    poNumber: item.poNumber || '',
                    quantity: Number(item.approvedQuantity) || 0,
                    pendingLiftQty: item.pendingPoQty || 0,
                    receivedQty: item.receivedQty || 0,
                    pendingPoQty: item.pendingPoQty || 0,
                    approvedRate: item.approvedRate || '0',
                    taxValue: item.taxValue || 0,
                    withTax: item.withTax || 'No',
                    liftQty: item.pendingPoQty || 0,
                })),
            });

            // Immediately calculate and set initial bill amount
            const initialTotal = allIndividualItems.reduce((sum, item) => {
                const rate = parseFloat(String(item.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
                const tax = item.taxValue || 0;
                const withTax = item.withTax || 'No';
                const effectiveRate = withTax === 'No' ? rate * (1 + tax / 100) : rate;
                const qty = item.pendingPoQty || 0;
                return sum + (effectiveRate * qty);
            }, 0);
            form.setValue('billAmount', initialTotal);

            setVendorSearch('');
        }
    }, [selectedIndent, form, tableData]);

    useEffect(() => {
        if (selectedHistory) {
            form.reset({
                billStatus: selectedHistory.billStatus === 'Not Received' ? 'Bill Not Received' : selectedHistory.billStatus || '',
                billNo: selectedHistory.billNo || '',
                qty: selectedHistory.qty || 0,
                typeOfBill: selectedHistory.typeOfBill || 'independent',
                billAmount: selectedHistory.billAmount || 0,
                billRemark: selectedHistory.billRemark || '',
                vendorName: selectedHistory.vendorName || '',
                transportationInclude: selectedHistory.transportationInclude || 'No',
                transporterName: selectedHistory.transporterName || '',
                vehicleNo: selectedHistory.vehicleNo || '',
                driverName: selectedHistory.driverName || '',
                driverMobileNo: selectedHistory.driverMobileNo || '',
                amount: selectedHistory.amount || 0,
                cancelPendingQty: 0,
                items: [
                    {
                        indentNo: selectedHistory.indentNo || '',
                        product: selectedHistory.product || '',
                        poNumber: selectedHistory.poNumber || '',
                        quantity: selectedHistory.quantity || 0,
                        pendingLiftQty: (selectedHistory.pendingLiftQty || 0) + (selectedHistory.qty || 0),
                        receivedQty: selectedHistory.receivedQty || 0,
                        pendingPoQty: selectedHistory.pendingPoQty || 0,
                        approvedRate: selectedHistory.approvedRate || '0',
                        taxValue: selectedHistory.taxValue || 0,
                        withTax: selectedHistory.withTax || 'No',
                        liftQty: selectedHistory.qty || 0,
                    }
                ],
            });
            setVendorSearch('');
        }
    }, [selectedHistory, form]);

    const typeOfBillWatcher = useWatch({ control: form.control, name: 'typeOfBill' }) || 'independent';
    const itemsWatcher = useWatch({ control: form.control, name: 'items' }) || [];

    const calculateTotalAmount = (items: any[]) => {
        return (items || []).reduce((sum: number, item: any) => {
            const qty = Number(item.liftQty) || 0;
            const rate = parseFloat(String(item.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
            const tax = Number(item.taxValue) || 0;
            const withTax = item.withTax || 'No';
            const effectiveRate = withTax === 'No' ? rate * (1 + tax / 100) : rate;
            return sum + (qty * effectiveRate);
        }, 0);
    };

    const currentCalculatedTotal = calculateTotalAmount(itemsWatcher);

    useEffect(() => {
        form.setValue('billAmount', currentCalculatedTotal);
    }, [currentCalculatedTotal, form]);

    const handleOpenChange = (open: boolean) => {
        setOpenDialog(open);
        if (!open) {
            setSelectedIndent(null);
            setSelectedHistory(null);
            setShowCancelQty(false);
            setCancelQtyValue('');
            form.reset();
        }
    };

    async function onSubmit() {
        const values = form.getValues();
        try {
            console.log('📋 Form values:', values);

            if (selectedHistory) {
                let photoUrl = selectedHistory.photoOfBill || '';
                if (values.photoOfBill) {
                    if (values.photoOfBill instanceof File) {
                        try {
                            photoUrl = await uploadBillPhoto(values.photoOfBill, selectedHistory.indentNo || '');
                            if (values.photoOfBill.type === 'application/pdf') {
                                toast.success('PDF document uploaded successfully');
                            } else {
                                toast.success('Image uploaded successfully');
                            }
                        } catch (uploadError) {
                            console.error('❌ File upload error:', uploadError);
                            toast.error('Failed to upload file. Please try again.');
                            return;
                        }
                    } else if (typeof values.photoOfBill === 'string') {
                        photoUrl = values.photoOfBill;
                    }
                }

                const newLiftQty = Number(values.items?.[0]?.liftQty || selectedHistory.qty || 0);

                const updatedStoreInRecord = {
                    bill_no: values.billNo || '',
                    vendor_name: values.vendorName || selectedHistory.vendorName || '',
                    qty: newLiftQty.toString(),
                    type_of_bill: values.typeOfBill || '',
                    bill_amount: Number(values.billAmount) || 0,
                    photo_of_bill: photoUrl,
                    transportation_include: values.transportationInclude || '',
                    transporter_name: values.transporterName || '',
                    amount: Number(values.amount) || 0,
                    bill_status: values.billStatus === 'Bill Not Received' ? 'Not Received' : values.billStatus,
                    quantity_as_per_bill: newLiftQty.toString(),
                    vehicle_no: values.vehicleNo || '',
                    driver_name: values.driverName || '',
                    driver_mobile_no: values.driverMobileNo || '',
                    bill_remark: values.billRemark || '',
                    not_bill_received_no: values.billStatus === 'Bill Not Received' ? values.billNo : '',
                };

                console.log('📤 Updating store-in record for lift number:', selectedHistory.liftNumber, updatedStoreInRecord);

                const { error: updateError } = await supabase
                    .from('store_in')
                    .update(updatedStoreInRecord)
                    .eq('lift_number', selectedHistory.liftNumber);

                if (updateError) {
                    console.error('❌ Supabase update error:', updateError);
                    throw updateError;
                }

                // Auto-complete status check for indent
                const originalPendingBeforeLift = (selectedHistory.pendingLiftQty || 0) + (selectedHistory.qty || 0);
                const remaining = originalPendingBeforeLift - newLiftQty;

                if (remaining <= 0) {
                    await updateLiftingStatus(selectedHistory.indentNo, 'Complete');
                } else {
                    await updateLiftingStatus(selectedHistory.indentNo, 'Pending');
                }

                toast.success(`Updated store record for Lift: ${selectedHistory.liftNumber}`);
                setOpenDialog(false);
                setSelectedHistory(null);
                form.reset();

                setTimeout(async () => {
                    const [indents, storeIns] = await Promise.all([
                        fetchIndentRecords(),
                        fetchStoreInRecords(),
                    ]);
                    setIndentRecords(indents);
                    setStoreInRecords(storeIns);
                    console.log('🔄 Data refreshed after update');
                }, 1500);

                return;
            }

            console.log('📝 Selected indent:', selectedIndent);

            // ✅ VALIDATION: Ensure lifting quantity does not exceed pending lift quantity
            if (Number(values.qty) > (selectedIndent?.pendingLiftQty || 0)) {
                toast.error(`Lifting quantity (${values.qty}) cannot exceed pending quantity (${selectedIndent?.pendingLiftQty || 0})`);
                return;
            }

            // Handle cancel pending quantity first (independent of bill status)
            if (values.cancelPendingQty && values.cancelPendingQty > 0) {
                console.log('❌ Processing cancel pending quantity:', values.cancelPendingQty);

                if (selectedIndent?.indentNo) {
                    await updateCancelQuantity(selectedIndent.indentNo, values.cancelPendingQty);
                    await updateActual5Timestamp(selectedIndent.indentNo);

                    toast.success(
                        `Cancelled ${values.cancelPendingQty} quantity for ${selectedIndent?.indentNo}`
                    );
                } else {
                    toast.error('Could not find the indent record to update');
                }
            } // Continue with original bill submission logic only if bill status is provided

            if (values.billStatus && values.items) {
                let photoUrl = '';
                if (values.photoOfBill) {
                    if (values.photoOfBill instanceof File) {
                        try {
                            photoUrl = await uploadBillPhoto(values.photoOfBill, selectedIndent?.indentNo || '');
                            if (values.photoOfBill.type === 'application/pdf') {
                                toast.success('PDF document uploaded successfully');
                            } else {
                                toast.success('Image uploaded successfully');
                            }
                        } catch (uploadError) {
                            console.error('❌ File upload error:', uploadError);
                            toast.error('Failed to upload file. Please try again.');
                            return;
                        }
                    } else if (typeof values.photoOfBill === 'string') {
                        photoUrl = values.photoOfBill;
                    }
                }

                const currentDateTime = new Date().toISOString();

                // Process each item in the product list
                for (const item of values.items) {
                    if (Number(item.liftQty) <= 0) continue;

                    const newStoreInRecord = {
                        timestamp: currentDateTime,
                        indentNo: item.indentNo,
                        billNo: values.billNo || '',
                        vendorName: values.vendorName || selectedIndent?.vendorName || '',
                        productName: item.product || '',
                        qty: Number(item.liftQty),
                        discountAmount: 0,
                        typeOfBill: values.typeOfBill || '',
                        billAmount: Number(values.billAmount) || 0,
                        paymentType: '',
                        advanceAmountIfAny: 0,
                        photoOfBill: photoUrl,
                        transportationInclude: values.transportationInclude || '',
                        transporterName: values.transporterName || '',
                        amount: Number(values.amount) || 0,
                        billStatus: values.billStatus === 'Bill Not Received' ? 'Not Received' : values.billStatus,
                        quantityAsPerBill: Number(item.liftQty),
                        poDate: selectedIndent?.poDate || '',
                        poNumber: item.poNumber || '',
                        vendor: values.vendorName || selectedIndent?.vendorName || '',
                        indentNumber: item.indentNo,
                        product: item.product || '',
                        quantity: Number(item.quantity),
                        vehicleNo: values.vehicleNo || '',
                        driverName: values.driverName || '',
                        driverMobileNo: values.driverMobileNo || '',
                        billRemark: values.billRemark || '',
                        firmNameMatch: selectedIndent?.firmNameMatch || user?.firmNameMatch || '',
                        rate: String(item.approvedRate || ''),
                        department: selectedIndent?.department || '',
                        areaOfUse: selectedIndent?.areaOfUse || '',
                        approvedVendorName: selectedIndent?.approvedVendorName || '',
                        liftingStatus: selectedIndent?.liftingStatus || '',
                        notBillReceivedNo: values.billStatus === 'Bill Not Received' ? values.billNo : '',
                    };

                    await insertStoreInRecord(newStoreInRecord);

                    // Auto-complete status check
                    const remaining = (item.pendingLiftQty) - (Number(item.liftQty));
                    if (remaining <= 0) {
                        await updateLiftingStatus(item.indentNo, 'Complete');
                    }
                }

                toast.success(`Created store records for PO: ${selectedIndent?.poNumber}`);
            }

            setOpenDialog(false);
            form.reset();
            setShowCancelQty(false);
            setCancelQtyValue('');

            setTimeout(async () => {
                const [indents, storeIns] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                ]);
                setIndentRecords(indents);
                setStoreInRecords(storeIns);
                console.log('🔄 Data refreshed after insert');
            }, 1500);
        } catch (error) {
            console.error('❌ Error in onSubmit:', error);
            toast.error('Failed to process request. Please try again.');
        }
    }

    function onError(e: any) {
        console.log('❌ Form validation errors:', e);
        
        // Extract field names from errors
        const errorFields = Object.keys(e).map(field => {
            // Make field names more readable
            return field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
        });

        if (errorFields.length > 0) {
            toast.error(`Please fill required fields: ${errorFields.join(', ')}`);
        } else {
            toast.error('Please fill all required fields correctly');
        }
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={handleOpenChange}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Get Purchase"
                        subtext="Manage purchase bill details and status"
                        tabs
                        pendingCount={tableData.length}
                        historyCount={historyData.length}
                    >
                        <ShoppingCart size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                            dataLoading={loading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                            dataLoading={false}
                        />
                    </TabsContent>
                </Tabs>

                {(selectedIndent || selectedHistory) && (
                    <DialogContent
                        className="max-h-[95vh] overflow-y-auto"
                        style={{ maxWidth: '80vw', width: '60vw' }}
                    >
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-6"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle className="text-xl font-bold flex items-center justify-between w-full border-b pb-3 mb-2">
                                        <div className="flex items-center gap-2 text-primary">
                                            <ShoppingCart size={22} />
                                            <span>{selectedHistory ? 'Edit History Purchase Details' : 'Update Purchase Details'}</span>
                                        </div>
                                    </DialogTitle>
                                </DialogHeader>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-xl border shadow-sm">
                                    {[
                                        ["Indent Number", selectedIndent?.indentNo || selectedHistory?.indentNo],
                                        ["PO Number", selectedIndent?.poNumber || selectedHistory?.poNumber],
                                        ["Approved Vendor Name", selectedIndent?.vendorName || selectedHistory?.vendorName || "-"],
                                    ].map(([label, value]) => (
                                        <div key={label} className="space-y-1">
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                            <p className="text-sm font-medium">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Product List Table */}
                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">Product</th>
                                                <th className="px-4 py-3 text-right font-semibold">Rate</th>
                                                <th className="px-4 py-3 text-right font-semibold">Tax %</th>
                                                <th className="px-4 py-3 text-right font-semibold">Eff. Rate</th>
                                                <th className="px-4 py-3 text-right font-semibold">Pending Qty</th>
                                                <th className="px-4 py-3 text-right font-semibold w-32">Lift Qty</th>
                                                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                                <th className="px-4 py-3 text-center font-semibold w-16">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {fields.map((field, index) => {
                                                const rate = parseFloat(String(field.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
                                                const tax = Number(field.taxValue) || 0;
                                                const withTax = field.withTax || 'No';
                                                const effectiveRate = withTax === 'No' ? rate * (1 + tax / 100) : rate;
                                                const liftQty = Number(itemsWatcher?.[index]?.liftQty) || 0;
                                                const amount = effectiveRate * liftQty;
                                                return (
                                                    <tr key={field.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">{field.product}</div>
                                                            <div className="text-[10px] text-muted-foreground">PO: {field.poNumber} | Indent: {field.indentNo}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                                                            ₹ {rate.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                                            {tax}%
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-primary whitespace-nowrap font-medium">
                                                            ₹ {effectiveRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {field.pendingLiftQty}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <FormField
                                                                control={form.control}
                                                                name={`items.${index}.liftQty`}
                                                                render={({ field: inputField }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                {...inputField}
                                                                                className={`h-9 text-right ${form.formState.errors.items?.[index]?.liftQty ? 'border-destructive' : ''}`}
                                                                                max={field.pendingLiftQty}
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[10px] m-0" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-primary">
                                                            ₹ {amount.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => remove(index)}
                                                            >
                                                                <X size={16} />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold border-t">
                                            <tr>
                                                <td className="px-4 py-3 text-left" colSpan={5}>Totals</td>
                                                <td className="px-4 py-3 text-right border-x">
                                                    {itemsWatcher?.reduce((sum, item) => sum + (Number(item.liftQty) || 0), 0) || 0}
                                                </td>
                                                <td className="px-4 py-3 text-right text-primary" colSpan={2}>
                                                    ₹ {currentCalculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Cancel Section */}
                                {selectedIndent && !showCancelQty ? (
                                    <div className="flex justify-between items-center border rounded-xl p-4 bg-orange-50 border-orange-200 shadow-sm">
                                        <div>
                                            <h3 className="font-medium text-orange-800">
                                                Cancel Pending PO Quantity
                                            </h3>
                                            <p className="text-xs text-orange-600">
                                                Cancel quantity
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-orange-300 text-orange-700 hover:bg-orange-100"
                                            onClick={() => setShowCancelQty(true)}
                                        >
                                            Cancel Pending PO
                                        </Button>
                                    </div>
                                ) : selectedIndent ? (
                                    <div className="border rounded-xl p-4 bg-orange-50 border-orange-200 shadow-sm space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-medium text-orange-800">
                                                Cancel Pending PO Quantity
                                            </h3>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowCancelQty(false);
                                                    setCancelQtyValue("");
                                                }}
                                            >
                                                <X size={16} />
                                            </Button>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4 items-end">
                                            <div>
                                                <FormLabel className="text-orange-700 text-sm">
                                                    Quantity to Cancel (Max:{" "}
                                                    {selectedIndent.pendingPoQty || 0})
                                                </FormLabel>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter quantity"
                                                    min="0"
                                                    max={selectedIndent.pendingPoQty}
                                                    value={cancelQtyValue}
                                                    onChange={(e) =>
                                                        setCancelQtyValue(e.target.value)
                                                    }
                                                    className="border-orange-300 focus:border-orange-500"
                                                />
                                            </div>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-orange-300 text-orange-700 hover:bg-orange-100 h-10"
                                                onClick={handleCancelQtySubmit}
                                            >
                                                Submit Cancel Only
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}

                                {/* Hidden */}
                                <FormField
                                    control={form.control}
                                    name="cancelPendingQty"
                                    render={({ field }) => (
                                        <FormItem className="hidden">
                                            <FormControl>
                                                <Input type="hidden" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* Main Form - Sections */}
                                <div className="space-y-8">
                                    {/* Section 1: Basic Receipt Info */}
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="billStatus"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Status *</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="h-11">
                                                                 <SelectValue placeholder="Select status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Bill Received">Bill Received</SelectItem>
                                                            <SelectItem value="Bill Not Received">Bill Not Received</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />

                                        {billStatus === "Bill Received" && (
                                            <FormField
                                                control={form.control}
                                                name="billNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Bill Number *</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} className="h-11" placeholder="Enter bill #" />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )}



                                    </div>

                                    {billStatus && (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            {/* Section 2: Logistics */}
                                            {typeOfBill === 'independent' && (
                                                <div className="space-y-4 border-t pt-6">
                                                    <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                                                        <Truck size={18} />
                                                        <span>Logistics & Transportation</span>
                                                    </div>
                                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        <FormField
                                                            control={form.control}
                                                            name="transportationInclude"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Transportation Included?</FormLabel>
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="h-11">
                                                                                <SelectValue placeholder="Select" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="Yes">Yes</SelectItem>
                                                                            <SelectItem value="No">No</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )}
                                                        />

                                                        {form.watch("transportationInclude") === "Yes" && (
                                                            <>
                                                                <FormField
                                                                    control={form.control}
                                                                    name="transporterName"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Transporter Name</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="vehicleNo"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Vehicle No.</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="driverName"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Driver Name</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="driverMobileNo"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Driver Mobile</FormLabel>
                                                                            <FormControl>
                                                                                <Input {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="amount"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Freight Amount</FormLabel>
                                                                            <FormControl>
                                                                                <Input type="number" {...field} className="h-11" />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-4 border-t pt-6">
                                                <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                                                    <CreditCard size={18} />
                                                    <span>Financials & Billing</span>
                                                </div>
                                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">


                                                    {(typeOfBill === "independent" || typeOfBill === "common") && (
                                                        <FormField
                                                            control={form.control}
                                                            name="billAmount"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Bill Amount {typeOfBill === 'common' && '(Auto)'}</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            {...field}
                                                                            value={field.value || 0}
                                                                            className="h-11 bg-muted cursor-not-allowed font-semibold"
                                                                            readOnly
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    )}


                                                </div>

                                                <div className="grid md:grid-cols-2 gap-6 mt-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="billRemark"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Bill Remark</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} className="h-11" placeholder="Add any comments..." />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {typeOfBill === "independent" && (
                                                        <FormField
                                                            control={form.control}
                                                            name="photoOfBill"
                                                            render={({ field: { value, onChange, ...field } }) => (
                                                                <FormItem>
                                                                    <FormLabel>Attachment (Photo/PDF) *</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="file"
                                                                            accept="image/*,.pdf"
                                                                            onChange={(e) => onChange(e.target.files?.[0])}
                                                                            {...field}
                                                                            className="h-11 file:bg-primary/10 file:text-primary file:border-0 file:rounded-md cursor-pointer"
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="pt-2">
                                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>

                                    <Button
                                        type="submit"
                                        disabled={form.formState.isSubmitting}
                                        className="min-w-[120px]"
                                    >
                                        {form.formState.isSubmitting && (
                                            <Loader size={18} className="mr-2" />
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
}
