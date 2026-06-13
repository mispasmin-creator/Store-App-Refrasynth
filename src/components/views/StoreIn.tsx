import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import {
    Truck, Building, FileText, IndianRupee,
    Package, CheckCircle2, X, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime, parseCustomDate } from '@/lib/utils';
import { Pill } from '../ui/pill';
import {
    fetchStoreInRecords,
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

const formatPlannedDate = (dateString: string) => {
    if (!dateString || dateString.trim() === '') return '';
    try {
        if (dateString.includes('/')) return dateString;
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

    useEffect(() => { fetchAllData(); }, []);

    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        const latestRecords: any[] = [];
        const seen = new Set<string>();
        for (const item of filteredByFirm) {
            const key = `${item.indentNo}-${item.productName}`;
            if (!seen.has(key)) { seen.add(key); latestRecords.push(item); }
        }

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
                    originalItems: [],
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

    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        const latestRecords: any[] = [];
        const seen = new Set<string>();
        for (const item of filteredByFirm) {
            const key = `${item.indentNo}-${item.productName}`;
            if (!seen.has(key)) { seen.add(key); latestRecords.push(item); }
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
            ? [{
                header: 'Action',
                cell: ({ row }: { row: Row<RecieveItemsData> }) => (
                    <DialogTrigger asChild>
                        <Button variant="outline" onClick={() => setSelectedIndent(row.original)}>
                            Store In
                        </Button>
                    </DialogTrigger>
                ),
            }]
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
                return <Pill variant={status === 'Bill Received' ? 'default' : 'secondary'}>{status || 'Unknown'}</Pill>;
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
                return photo ? <a href={photo} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">View</a> : null;
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
                return <Pill variant={status === 'Bill Received' ? 'default' : 'secondary'}>{status || 'Unknown'}</Pill>;
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
                return photo ? <a href={photo} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">View</a> : null;
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
                return photo ? <a href={photo} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">View</a> : null;
            },
        },
        {
            accessorKey: 'damageOrder',
            header: 'Physical Check',
            cell: ({ row }) => {
                const isDamaged = row.original.damageOrder === 'No';
                return <Pill variant={isDamaged ? 'reject' : 'default'}>{isDamaged ? 'Not Good' : 'Good'}</Pill>;
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

    // ── Schema ──────────────────────────────────────────────
    const schema = z.object({
        status: z.enum(['Received', 'Not Received'], { required_error: 'Status is required' }),
        remark: z.string().optional(),
    });
    type FormValues = z.infer<typeof schema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { status: undefined, remark: '' },
    });

    useEffect(() => {
        if (!openDialog) { form.reset({ status: undefined, remark: '' }); fetchAllData(); }
    }, [openDialog]);

    useEffect(() => {
        if (selectedIndent) { form.reset({ status: undefined, remark: '' }); }
    }, [selectedIndent]);

    async function onSubmit(values: FormValues) {
        if (!selectedIndent) return;
        try {
            const currentDateTime = new Date().toISOString();
            for (const item of (selectedIndent.originalItems || [])) {
                const { error } = await supabase.from('store_in').update({
                    actual6: currentDateTime,
                    receiving_status: values.status,
                    remark: values.remark || '',
                    hod_planned: currentDateTime,
                    hod_status: 'Pending',
                }).eq('lift_number', item.liftNumber);
                if (error) throw error;
            }
            toast.success(`Store In completed for ${(selectedIndent.originalItems || []).length} item(s)!`);
            setOpenDialog(false);
            setSelectedIndent(null);
        } catch (error: any) {
            toast.error('Failed to store in: ' + (error?.message || ''));
        }
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={(open) => { setOpenDialog(open); if (!open) setSelectedIndent(null); }}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading={"HOD Check"}
                        subtext={"Receive items from purchase orders"}
                        tabs={true}
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
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, () => toast.error('Please select a status'))} className="space-y-4">
                                <DialogHeader className="border-b pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Truck className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-xl font-black">Store In Processing</DialogTitle>
                                            <p className="text-xs font-medium text-muted-foreground">Verify and confirm receipt of material for Lift #{selectedIndent.liftNumber}</p>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="space-y-5 py-2">
                                    {/* Record Info */}
                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3 border-b border-slate-200/50 pb-2">
                                            <Package className="w-4 h-4 text-slate-400" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Record Information</h4>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Vendor</p>
                                                <p className="text-xs font-bold text-slate-900 line-clamp-1" title={selectedIndent.vendorName}>{selectedIndent.vendorName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">PO Number</p>
                                                <p className="text-xs font-black text-primary">{selectedIndent.poNumber || '—'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Bill Number</p>
                                                <p className="text-xs font-bold text-slate-900">{selectedIndent.billNo || 'N/A'}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Bill Amount</p>
                                                <p className="text-sm font-black text-emerald-600">₹{selectedIndent.billAmount?.toLocaleString('en-IN') || '0'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Products (read-only) */}
                                    {(selectedIndent.originalItems?.length || 0) > 0 && (
                                        <div className="border rounded-xl overflow-hidden">
                                            <div className="bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b">
                                                Products in this shipment ({selectedIndent.originalItems!.length})
                                            </div>
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/30 border-b">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Lift No.</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Product</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Indent No.</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Qty</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedIndent.originalItems!.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-muted/20">
                                                            <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                                                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.liftNumber}</td>
                                                            <td className="px-3 py-2 text-xs font-medium">{item.productName}</td>
                                                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.indentNo}</td>
                                                            <td className="px-3 py-2 text-xs text-right font-semibold">{item.qty}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Store Verification Results */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <CheckCircle2 className="w-4 h-4 text-amber-500" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Store Verification Results (from Lift)</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {(() => {
                                                const first = selectedIndent.originalItems?.[0] as any;
                                                const damage = first?.damageOrder;
                                                const qtyMatch = first?.quantityAsPerBill;
                                                const priceMatch = first?.priceAsPerPoCheck;
                                                return (<>
                                                    <div className={`p-3 rounded-xl border flex flex-col gap-1 ${damage === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Physical Check</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs font-black ${damage === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                                {damage === 'No' ? 'Damaged' : damage === 'Yes' ? 'Good' : '—'}
                                                            </span>
                                                            {damage === 'No' ? <X className="w-3 h-3 text-red-500" /> : damage === 'Yes' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : null}
                                                        </div>
                                                    </div>
                                                    <div className={`p-3 rounded-xl border flex flex-col gap-1 ${qtyMatch === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Qty Matching</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs font-black ${qtyMatch === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                                {qtyMatch === 'No' ? 'Mismatch' : qtyMatch === 'Yes' ? 'Matches' : '—'}
                                                            </span>
                                                            {qtyMatch === 'No' ? <X className="w-3 h-3 text-red-500" /> : qtyMatch === 'Yes' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : null}
                                                        </div>
                                                    </div>
                                                    <div className={`p-3 rounded-xl border flex flex-col gap-1 ${priceMatch === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Price Matching</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs font-black ${priceMatch === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                                {priceMatch === 'No' ? 'Mismatch' : priceMatch === 'Yes' ? 'Matches' : '—'}
                                                            </span>
                                                            {priceMatch === 'No' ? <X className="w-3 h-3 text-red-500" /> : priceMatch === 'Yes' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : null}
                                                        </div>
                                                    </div>
                                                </>);
                                            })()}
                                        </div>
                                        {(selectedIndent.originalItems?.[0] as any)?.remark && (
                                            <div className="bg-amber-50/50 rounded-xl border border-amber-100/50 p-3">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Inspector Remarks</p>
                                                        <p className="text-xs text-amber-900 font-medium italic">"{(selectedIndent.originalItems![0] as any).remark}"</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Decision */}
                                    <div className="bg-white rounded-xl border p-4 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-primary" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Store In Decision</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="status" render={({ field }) => (
                                                <FormItem className="space-y-1">
                                                    <FormLabel className="text-[10px] font-bold uppercase text-slate-400 pl-1">Receiving Status <span className="text-destructive">*</span></FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-10 border-slate-200">
                                                                <SelectValue placeholder="Select status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Received" className="text-emerald-600 font-bold">Received</SelectItem>
                                                            <SelectItem value="Not Received" className="text-red-600 font-bold">Not Received</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="remark" render={({ field }) => (
                                                <FormItem className="space-y-1">
                                                    <FormLabel className="text-[10px] font-bold uppercase text-slate-400 pl-1">Remarks</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Add remarks..." {...field} className="h-10 border-slate-200" />
                                                    </FormControl>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="border-t pt-4">
                                    <Button type="button" variant="ghost" className="h-10 text-slate-500 font-semibold"
                                        onClick={() => { setOpenDialog(false); setSelectedIndent(null); }}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={form.formState.isSubmitting}
                                        className={`h-10 px-8 font-black transition-all shadow-md ${form.watch('status') === 'Not Received' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}>
                                        {form.formState.isSubmitting ? <Loader size={16} color="white" className="mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                        Confirm Store In
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
