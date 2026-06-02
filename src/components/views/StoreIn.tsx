import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '../ui/dialog';
import { Truck, Building, FileText, IndianRupee } from 'lucide-react';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime, parseCustomDate } from '@/lib/utils';
import { Pill } from '../ui/pill';
import {
    fetchStoreInRecords,
    updateStoreInReceiving,
    uploadProductPhoto,
    uploadBillCopy,
    createPaymentEntry,
    type StoreInRecord,
} from '@/services/storeInService';

interface StoreInPendingData {
    liftNumber: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    poDate: string;
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    uom: string;
    qty: number;
    priceAsPerPo: number;
    remark: string;
    poCopy: string;
    billStatus: string;
    leadTimeToLiftMaterial: number;
    discountAmount: number;
    firmNameMatch: string;
    planned6Date: string;
    timestamp: string;
    products?: string[];
    indentNumbers?: string[];
    originalItems?: any[];
}

interface StoreInHistoryData {
    liftNumber: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    billStatus: string;
    photoOfProduct: string;
    unitOfMeasurement: string;
    damageOrder: string;
    quantityAsPerBill: string;
    priceAsPerPoCheck: string;
    priceAsPerPo: number;
    remark: string;
    poDate: string;
    poNumber: string;
    receiveStatus: string;
    vendor: string;
    product: string;
    orderQuantity: number;
    receivedDate: string;
    billNumber: string;
    anyTransport: string;
    transportingAmount: number;
    timestamp: string;
    leadTimeToLiftMaterial: number;
    discountAmount: number;
    billReceived: string;
    billImage: string;
    firmNameMatch: string;
    planned6Date: string;
}

type RecieveItemsData = StoreInPendingData;
type HistoryData = StoreInHistoryData;

interface StoreInSheetItem {
    liftNumber?: string;
    indentNo?: string;
    billNo?: string;
    vendorName?: string;
    productName?: string;
    qty?: number;
    typeOfBill?: string;
    billAmount?: number;
    paymentType?: string;
    advanceAmountIfAny?: number | string;
    photoOfBill?: string;
    transportationInclude?: string;
    transporterName?: string;
    amount?: number;
    planned6?: string;
    actual6?: string;
    status?: string;
    billCopyAttached?: string;
    debitNote?: string;
    reason?: string;
    damageOrder?: string;
    quantityAsPerBill?: string;
    priceAsPerPoCheck?: string;
    priceAsPerPo?: number;
    remark?: string;
    firmNameMatch?: string;
    rowIndex?: number;
    poDate?: string;
    poNumber?: string;
    vendor?: string;
    indentNumber?: string;
    product?: string;
    uom?: string;
    poCopy?: string;
    billStatus?: string;
    leadTimeToLiftMaterial?: number;
    discountAmount?: number;
    receivedQuantity?: number;
    photoOfProduct?: string;
    unitOfMeasurement?: string;
    timestamp?: string;
    billNumber?: string;
    anyTransport?: string;
    transportingAmount?: number;
    receivingStatus?: string;
}

// Safe date formatter for Planned Date
const formatPlannedDate = (dateString: string) => {
    if (!dateString || dateString.trim() === '') return '';
    try {
        // If it's already in dd/mm/yyyy format, return as is
        if (dateString.includes('/')) {
            return dateString;
        }

        // If it's a date string that can be parsed
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) return dateString;

        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = String(dateObj.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    } catch {
        return dateString;
    }
};

export default () => {
    const { user } = useAuth();

    const [tableData, setTableData] = useState<StoreInPendingData[]>([]);
    const [historyData, setHistoryData] = useState<StoreInHistoryData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<StoreInPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [indentLoading, setIndentLoading] = useState(false);
    const [receivedLoading, setReceivedLoading] = useState(false);
    const [storeInRecords, setStoreInRecords] = useState<StoreInRecord[]>([]);
    const [activeItemIndex, setActiveItemIndex] = useState(0);
    const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());

    const fetchAllData = async () => {
        setIndentLoading(true);
        setReceivedLoading(true);
        try {
            const storeIns = await fetchStoreInRecords();
            setStoreInRecords(storeIns);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load data');
        } finally {
            setIndentLoading(false);
            setReceivedLoading(false);
        }
    };

    // Fetch all data from Supabase
    useEffect(() => {
        fetchAllData();
    }, []);

    // Process pending table data
    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        // Filter to keep only the latest record per Indent and Product
        const latestRecords: any[] = [];
        const seen = new Set<string>();

        for (const item of filteredByFirm) {
            const key = `${item.indentNo}-${item.productName}`;
            if (!seen.has(key)) {
                seen.add(key);
                latestRecords.push(item);
            }
        }

        // Group by Vendor + Bill No
        const groupedMap = new Map<string, any>();

        const pendingItems = latestRecords.filter((i) => i.planned6 !== '' && i.actual6 === '');

        pendingItems.forEach((i) => {
            const billNo = String(i.billNo || '');
            const key = `${i.vendorName}-${billNo}`;

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    billNo: billNo,
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: 0,
                    typeOfBill: i.typeOfBill || '',
                    billAmount: i.billAmount || 0,
                    amount: i.amount || 0,
                    paymentType: i.paymentType || '',
                    advanceAmountIfAny: Number(i.advanceAmountIfAny) || 0,
                    photoOfBill: i.photoOfBill || '',
                    transportationInclude: i.transportationInclude || '',
                    transporterName: i.transporterName || '',
                    poDate: i.poDate || '',
                    poNumber: i.poNumber || '',
                    vendor: i.vendor || '',
                    indentNumber: i.indentNumber || '',
                    product: i.product || '',
                    uom: i.uom || '',
                    poCopy: i.poCopy || '',
                    billStatus: i.billStatus || '',
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial || 0,
                    discountAmount: i.discountAmount || 0,
                    firmNameMatch: i.firmNameMatch || '',
                    planned6Date: i.planned6 || '',
                    timestamp: i.timestamp || '',
                    priceAsPerPo: i.priceAsPerPo || 0,
                    remark: i.remark || '',
                    products: [],
                    indentNumbers: [],
                    originalItems: []
                });
            }

            const group = groupedMap.get(key);
            group.qty += Number(i.qty) || 0;
            group.products.push(i.productName);
            group.indentNumbers.push(i.indentNo);
            group.originalItems.push(i);
        });

        setTableData(Array.from(groupedMap.values()));
    }, [storeInRecords, user.firmNameMatch]);

    // Process history data
    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        // Filter to keep only the latest record per Indent and Product
        const latestRecords: any[] = [];
        const seen = new Set<string>();

        for (const item of filteredByFirm) {
            const key = `${item.indentNo}-${item.productName}`;
            if (!seen.has(key)) {
                seen.add(key);
                latestRecords.push(item);
            }
        }

        setHistoryData(
            latestRecords
                .filter((i) => i.actual6 !== '')
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    billNo: String(i.billNo) || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: i.qty || 0,
                    typeOfBill: i.typeOfBill || '',
                    billAmount: i.billAmount || 0,
                    paymentType: i.paymentType || '',
                    advanceAmountIfAny: Number(i.advanceAmountIfAny) || 0,
                    photoOfBill: i.photoOfBill || '',
                    transportationInclude: i.transportationInclude || '',
                    transporterName: i.transporterName || '',
                    amount: i.amount || 0,
                    billStatus: i.billStatus || '',
                    receivedQuantity: i.receivedQuantity || 0,
                    photoOfProduct: i.photoOfProduct || '',
                    unitOfMeasurement: i.unitOfMeasurement || '',
                    damageOrder: i.damageOrder || '',
                    quantityAsPerBill: i.quantityAsPerBill || '',
                    priceAsPerPoCheck: i.priceAsPerPoCheck || '',
                    priceAsPerPo: i.priceAsPerPo || 0,
                    remark: i.remark || '',
                    poDate: i.poDate || '',
                    poNumber: i.poNumber || '',
                    receiveStatus: i.receivingStatus || '',
                    vendor: i.vendorName || '',
                    product: i.productName || '',
                    orderQuantity: i.qty || 0,
                    receivedDate: i.timestamp ? formatDateTime(parseCustomDate(i.timestamp)) : '',
                    billNumber: i.billNumber || String(i.billNo) || '',
                    anyTransport: i.transportationInclude || '',
                    transportingAmount: i.amount || 0,
                    timestamp: i.timestamp ? formatDateTime(parseCustomDate(i.timestamp)) : '',
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial || 0,
                    discountAmount: i.discountAmount || 0,
                    billReceived: i.billStatus || '',
                    billImage: i.photoOfBill || '',
                    firmNameMatch: i.firmNameMatch || '',
                    planned6Date: i.planned6 || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch]);

    const textWrapCell = ({ getValue }: { getValue: () => any }) => {
        const value = getValue();
        return <div className="min-w-[150px] whitespace-normal break-words">{value?.toString() || '-'}</div>;
    };

    const columns: ColumnDef<RecieveItemsData>[] = [
        ...(user.receiveItemView
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<RecieveItemsData> }) => {
                        const indent = row.original;
                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIndent(indent);
                                    }}
                                >
                                    Store In
                                </Button>
                            </DialogTrigger>
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
        { accessorKey: 'poNumber', header: 'PO Number', cell: textWrapCell },
        { accessorKey: 'vendorName', header: 'Vendor Name', cell: textWrapCell },
        { accessorKey: 'billNo', header: 'Bill No.', cell: textWrapCell },
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
        { accessorKey: 'firmNameMatch', header: 'Firm Name', cell: textWrapCell },
        {
            accessorKey: 'billStatus',
            header: 'Bill Status',
            cell: ({ getValue }) => {
                const status = getValue() as string;
                return (
                    <Pill variant={status === 'Bill Received' ? 'default' : 'secondary'}>
                        {status || 'Unknown'}
                    </Pill>
                );
            }
        },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'discountAmount', header: 'Discount Amount' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'leadTimeToLiftMaterial', header: 'Lead Time To Lift' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill', cell: textWrapCell },
        { accessorKey: 'paymentType', header: 'Payment Type', cell: textWrapCell },
        { accessorKey: 'advanceAmountIfAny', header: 'Advance' },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'transportationInclude', header: 'Trans. Include', cell: textWrapCell },
        { accessorKey: 'transporterName', header: 'Transporter', cell: textWrapCell },
        { accessorKey: 'amount', header: 'Freight Amount' },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'timestamp', header: 'Timestamp' },
        { accessorKey: 'liftNumber', header: 'Lift Number', cell: textWrapCell },
        { accessorKey: 'indentNo', header: 'Indent No.', cell: textWrapCell },
        { accessorKey: 'poNumber', header: 'PO Number', cell: textWrapCell },
        { accessorKey: 'firmNameMatch', header: 'Firm Name', cell: textWrapCell },
        { accessorKey: 'vendorName', header: 'Vendor Name', cell: textWrapCell },
        { accessorKey: 'productName', header: 'Product Name', cell: textWrapCell },
        {
            accessorKey: 'billStatus',
            header: 'Bill Status',
            cell: ({ getValue }) => {
                const status = getValue() as string;
                return (
                    <Pill variant={status === 'Bill Received' ? 'default' : 'secondary'}>
                        {status || 'Unknown'}
                    </Pill>
                );
            }
        },
        { accessorKey: 'billNo', header: 'Bill No.', cell: textWrapCell },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'leadTimeToLiftMaterial', header: 'Lead Time To Lift', cell: textWrapCell },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill', cell: textWrapCell },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'discountAmount', header: 'Discount' },
        { accessorKey: 'paymentType', header: 'Payment Type', cell: textWrapCell },
        { accessorKey: 'advanceAmountIfAny', header: 'Advance' },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'transportationInclude', header: 'Trans. Include', cell: textWrapCell },
        { accessorKey: 'transporterName', header: 'Transporter', cell: textWrapCell },
        { accessorKey: 'amount', header: 'Freight Amount' },
        { accessorKey: 'receiveStatus', header: 'Rec. Status', cell: textWrapCell },
        { accessorKey: 'receivedQuantity', header: 'Rec. Qty' },
        {
            accessorKey: 'photoOfProduct',
            header: 'Product Photo',
            cell: ({ row }) => {
                const photo = row.original.photoOfProduct;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">
                        View
                    </a>
                ) : null;
            },
        },
        {
            accessorKey: 'damageOrder',
            header: 'Physical Check',
            cell: ({ row }) => {
                const isDamaged = row.original.damageOrder === 'No';
                return (
                    <Pill variant={isDamaged ? 'reject' : 'default'}>
                        {isDamaged ? 'Not Good' : 'Good'}
                    </Pill>
                );
            }
        },
        {
            accessorKey: 'quantityAsPerBill',
            header: 'Qty Match?',
            cell: ({ row }) => (
                <Pill variant={row.original.quantityAsPerBill === 'Yes' ? 'default' : 'reject'}>
                    {row.original.quantityAsPerBill === 'Yes' ? 'Match' : 'Mismatch'}
                </Pill>
            )
        },
        {
            accessorKey: 'priceAsPerPo',
            header: 'Price Match?',
            cell: ({ row }) => (
                <Pill variant={row.original.priceAsPerPoCheck === 'Yes' ? 'default' : 'reject'}>
                    {row.original.priceAsPerPoCheck === 'Yes' ? 'Match' : 'Mismatch'}
                </Pill>
            )
        },
        { accessorKey: 'remark', header: 'Remark', cell: textWrapCell },
        {
            accessorKey: 'planned6Date',
            header: 'Planned Date',
            cell: ({ row }) => formatPlannedDate(row.original.planned6Date)
        },
    ];

    const schema = z.object({
        status: z.enum(['Received', 'Not Received']),
        billNo: z.string().optional(),
        billRemark: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        billCopy: z.instanceof(File).optional(),
        photoOfProduct: z.instanceof(File, {
            message: "Photo of product is required"
        }),
        damageOrder: z.enum(['Yes', 'No']),
        quantityAsPerBill: z.enum(['Yes', 'No']),
        priceAsPerPoCheck: z.enum(['Yes', 'No']),
        remark: z.string().optional(),
        location: z.string().optional(),
        items: z.array(z.object({
            liftNumber: z.string(),
            indentNo: z.string(),
            productName: z.string(),
            qty: z.number(),
            receivedQty: z.coerce.number().min(1, 'Received quantity is required'),
        })),
    });

    type FormValues = z.infer<typeof schema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: 'Received',
            billNo: '',
            billRemark: '',
            billAmount: 0,
            billCopy: undefined,
            photoOfProduct: undefined,
            damageOrder: undefined,
            quantityAsPerBill: undefined,
            priceAsPerPoCheck: undefined,
            remark: '',
            location: '',
            items: [],
        },
    });

    const { fields: itemFields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    const statusSelector = form.watch('status');
    const itemsWatcher = form.watch('items');

    // Reset form when dialog closes
    useEffect(() => {
        if (!openDialog) {
            form.reset();
            fetchAllData(); // Refresh data on close
        }
    }, [openDialog, form]);

    useEffect(() => {
        if (selectedIndent?.originalItems) {
            form.reset({
                status: 'Received',
                billNo: '',
                billRemark: '',
                billAmount: 0,
                billCopy: undefined,
                photoOfProduct: undefined,
                damageOrder: undefined,
                quantityAsPerBill: undefined,
                priceAsPerPoCheck: undefined,
                remark: '',
                location: '',
                items: selectedIndent.originalItems.map(item => ({
                    liftNumber: item.liftNumber || '',
                    indentNo: item.indentNo || '',
                    productName: item.productName || '',
                    qty: Number(item.qty) || 0,
                    receivedQty: Number(item.qty) || 0,
                })),
            });
        }
    }, [selectedIndent, form]);

    async function onSubmit(values: FormValues) {
        if (!selectedIndent) return;
        try {
            let photoUrl = '';
            let billCopyUrl = '';

            // 1. Upload product photo once for all items
            if (values.photoOfProduct) {
                photoUrl = await uploadProductPhoto(
                    values.photoOfProduct,
                    selectedIndent.indentNo || ''
                );
            }

            // 2. Upload bill copy if provided
            if (values.billCopy instanceof File) {
                billCopyUrl = await uploadBillCopy(
                    values.billCopy,
                    selectedIndent.liftNumber || selectedIndent.indentNo || ''
                );
            }

            const currentDateTime = new Date().toISOString();

            // 3. Update all items in parallel
            const updatePromises = values.items.map(item =>
                updateStoreInReceiving(item.liftNumber, {
                    actual6: currentDateTime,
                    receivingStatus: values.status,
                    receivedQuantity: item.receivedQty,
                    photoOfProduct: photoUrl,
                    damageOrder: values.damageOrder || '',
                    quantityAsPerBill: values.quantityAsPerBill || '',
                    priceAsPerPoCheck: values.priceAsPerPoCheck || '',
                    remark: values.remark || '',
                    location: values.location || '',
                    billNo: values.billNo || '',
                    billRemark: values.billRemark || '',
                    billAmount: Number(values.billAmount) || 0,
                    photoOfBill: billCopyUrl,
                })
            );

            await Promise.all(updatePromises);


            toast.success(`All ${values.items.length} items stored in successfully!`);
            setOpenDialog(false);
            await fetchAllData();
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Failed to store in');
        }
    }

    function onError(e: any) {
        console.log(e);
        if (e.qty) {
            toast.error(e.qty.message || 'Received quantity cannot exceed lifting quantity');
            return;
        }
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Material Receipt / Store In"
                        subtext="Receive items from purchase orders"
                        tabs
                        pendingCount={tableData.length}
                        historyCount={historyData.length}
                    >
                        <Truck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['vendorName', 'productName', 'billNo', 'indentNo', 'poNumber']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['productName', 'billNo', 'indentNo', 'vendorName', 'poNumber']}
                            dataLoading={receivedLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-4 pb-4 border-b">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-primary/10 rounded-xl">
                                                <Truck className="h-6 w-6 text-primary" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-2xl font-bold tracking-tight">Store In Processing</DialogTitle>
                                                <DialogDescription className="text-muted-foreground">
                                                    Process reception and verify quality of delivered items
                                                </DialogDescription>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                                            <div className="p-2 bg-background rounded-md shadow-sm">
                                                <Building className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Vendor</span>
                                                <span className="text-sm font-semibold truncate max-w-[150px]" title={selectedIndent.vendorName}>
                                                    {selectedIndent.vendorName}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                                            <div className="p-2 bg-background rounded-md shadow-sm">
                                                <FileText className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Bill Number</span>
                                                <span className="text-sm font-semibold">{selectedIndent.billNo || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                                            <div className="p-2 bg-primary/10 rounded-md shadow-sm">
                                                <IndianRupee className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-primary/70 tracking-wider">Bill Amount</span>
                                                <span className="text-sm font-bold text-primary">₹{selectedIndent.billAmount?.toLocaleString('en-IN') || '0'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </DialogHeader>

                                {/* Product list - always show details table even for single products */}
                                {(selectedIndent.originalItems?.length || 0) > 0 && (
                                    <div className="border rounded-md overflow-hidden">
                                        <div className="bg-muted px-3 py-2 text-sm font-semibold">Products in this shipment ({selectedIndent.originalItems?.length})</div>
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 border-b">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">S.No.</th>
                                                    <th className="px-3 py-2 text-left">Lift No.</th>
                                                    <th className="px-3 py-2 text-left">Product</th>
                                                    <th className="px-3 py-2 text-left">Indent No.</th>
                                                    <th className="px-3 py-2 text-right">Lift Qty</th>
                                                    <th className="px-3 py-2 text-right w-32">Received Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {itemFields.map((field, idx) => (
                                                    <tr key={field.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-3 py-2">{idx + 1}</td>
                                                        <td className="px-3 py-2 text-muted-foreground">{field.liftNumber}</td>
                                                        <td className="px-3 py-2 font-medium">{field.productName}</td>
                                                        <td className="px-3 py-2 text-muted-foreground">{field.indentNo}</td>
                                                        <td className="px-3 py-2 text-right">{field.qty}</td>
                                                        <td className="px-3 py-2">
                                                            <FormField
                                                                control={form.control}
                                                                name={`items.${idx}.receivedQty`}
                                                                render={({ field: inputField }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                {...inputField}
                                                                                max={field.qty}
                                                                                className="h-8 text-right"
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}


                                {/* Bill Info */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="billNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Number</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter bill number" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="billAmount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Amount</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} placeholder="Enter bill amount" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="billRemark"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Remark</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter bill remark" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="billCopy"
                                        render={({ field: { onChange, value, ...field } }) => (
                                            <FormItem>
                                                <FormLabel>Bill Copy (Image/PDF)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => onChange(e.target.files?.[0])}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Standard form fields */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Receiving Status</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Received">Received</SelectItem>
                                                            <SelectItem value="Not Received">Not Received</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="location"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Location (optional)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter storage location" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="photoOfProduct"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Photo of Product</FormLabel>
                                            <span className="text-destructive">*</span>
                                            <FormControl>
                                                <Input
                                                    type="file"
                                                    onChange={(e) =>
                                                        field.onChange(e.target.files?.[0])
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="damageOrder"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Physical Check</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Yes">OK</SelectItem>
                                                            <SelectItem value="No">Not OK</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="quantityAsPerBill"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quantity As Per Bill</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Yes">Yes</SelectItem>
                                                            <SelectItem value="No">No</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="priceAsPerPoCheck"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-semibold">Price as per PO?</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full border-green-200 focus:ring-green-500">
                                                            <SelectValue placeholder="Select" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Yes">Yes</SelectItem>
                                                            <SelectItem value="No">No</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />


                                    <FormField
                                        control={form.control}
                                        name="remark"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Remark</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        className="w-full"
                                                        rows={3}
                                                        placeholder="Enter remark"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button type="submit" disabled={form.formState.isSubmitting || form.watch('status') === 'Not Received'}>
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        {(selectedIndent.originalItems?.length || 0) > 1
                                            ? `Store In`
                                            : 'Store In'
                                        }
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