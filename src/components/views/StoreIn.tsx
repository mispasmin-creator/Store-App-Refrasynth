import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { storeInDecisionSchema, submitStoreInSelection, type StoreInDecisions } from '@/lib/storeInDecision';
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
    Package, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { departmentMatches } from '@/lib/access';
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
    department: string;
    planned6Date: string;
    timestamp: string;
    products?: string[];
    indentNumbers?: string[];
    originalItems?: StoreInRecord[];
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
    department: string;
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
            (user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch) &&
            departmentMatches(user, item.department)
        );

        const latestRecords: any[] = [];
        const seen = new Set<string>();
        for (const item of filteredByFirm) {
            const key = String(item.id);
            if (!seen.has(key)) { seen.add(key); latestRecords.push(item); }
        }

        const groupedMap = new Map<string, any>();
        const pendingItems = latestRecords.filter((i) => i.planned6 !== '' && i.actual6 === '');

        pendingItems.forEach((i) => {
            const billNo = String(i.billNo || '');
            const key = JSON.stringify([i.firmNameMatch, i.poNumber, i.vendorName, billNo || i.liftNumber]);
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
                    department: '',
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
            // One bill can carry items from several departments; list each once.
            if (i.department && !group.department.split(', ').includes(i.department)) {
                group.department = group.department ? `${group.department}, ${i.department}` : i.department;
            }
            group.products.push(i.productName);
            group.indentNumbers.push(i.indentNo);
            group.originalItems.push(i);
        });

        setTableData(Array.from(groupedMap.values()));
    }, [storeInRecords, user.firmNameMatch, user.department]);

    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            (user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch) &&
            departmentMatches(user, item.department)
        );

        const latestRecords: any[] = [];
        const seen = new Set<string>();
        for (const item of filteredByFirm) {
            const key = String(item.id);
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
                    department: i.department || '',
                    planned6Date: i.planned6 || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch, user.department]);

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
        { accessorKey: 'department', header: 'Department', cell: textWrapCell },
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
        { accessorKey: 'transportationInclude', header: 'Transporter', cell: textWrapCell },
        { accessorKey: 'amount', header: 'Freight Amount' },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'timestamp', header: 'Timestamp' },
        { accessorKey: 'liftNumber', header: 'Lift Number', cell: textWrapCell },
        { accessorKey: 'indentNo', header: 'Indent No.', cell: textWrapCell },
        { accessorKey: 'poNumber', header: 'PO Number', cell: textWrapCell },
        { accessorKey: 'firmNameMatch', header: 'Firm Name', cell: textWrapCell },
        { accessorKey: 'department', header: 'Department', cell: textWrapCell },
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
        {
            accessorKey: 'receiveStatus',
            header: 'Rec. Status',
            cell: ({ getValue }) => {
                const val = getValue() as string;
                if (val === 'Not Received') return <span className="text-red-600 font-bold">Rejected</span>;
                if (val === 'Received') return <span className="text-emerald-600 font-bold">Received</span>;
                return val || '-';
            }
        },
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
    const form = useForm<StoreInDecisions>({
        resolver: zodResolver(storeInDecisionSchema),
        defaultValues: { items: [] },
    });

    useEffect(() => {
        if (!openDialog) { form.reset({ items: [] }); fetchAllData(); }
    }, [openDialog]);

    useEffect(() => {
        form.reset({ status: undefined, items: [] });
    }, [selectedIndent, form]);

    const selectedItems = form.watch('items') || [];
    const decisionStatus = form.watch('status');
    const selectedIds = new Set(selectedItems.map(item => item.id));
    const availableItems = (selectedIndent?.originalItems || []).filter(item => !selectedIds.has(item.id));

    function toggleItem(id: number, checked: boolean) {
        const current = form.getValues('items');
        form.setValue('items', checked
            ? [...current, { id, remark: '' }]
            : current.filter(item => item.id !== id), { shouldValidate: false });
        form.clearErrors();
    }

    async function onSubmit(values: StoreInDecisions) {
        if (!selectedIndent) return;
        const items = selectedIndent.originalItems || [];
        const savedIds: number[] = [];
        try {
            await submitStoreInSelection(values, items.map(item => item.id), new Date().toISOString(), async (id, update) => {
                const item = items.find(item => item.id === id)!;
                const { error } = await supabase.from('store_in').update(update)
                    .eq('id', item.id).eq('firm_name_match', item.firmNameMatch).select('id').single();
                if (error) throw error;
                savedIds.push(id);
            });
            toast.success(`${savedIds.length} item(s) ${values.status === 'Received' ? 'received' : 'rejected'}.`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Please try again.';
            toast.error(`Saved ${savedIds.length} of ${values.items.length} selected items. ${message}`);
        }
        if (!savedIds.length) return;
        // Keep the dialog open for a separate decision on the remaining items.
        const remaining = items.filter(item => !savedIds.includes(item.id));
        setStoreInRecords(records => records.filter(item => !savedIds.includes(item.id)));
        if (remaining.length) {
            setSelectedIndent({ ...selectedIndent, liftNumber: remaining[0].liftNumber,
                originalItems: remaining, products: remaining.map(item => item.productName),
                qty: remaining.reduce((sum, item) => sum + Number(item.qty || 0), 0) });
        } else {
            setOpenDialog(false);
            setSelectedIndent(null);
        }
        await fetchAllData();
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={(open) => { if (form.formState.isSubmitting) return; setOpenDialog(open); if (!open) setSelectedIndent(null); }}>
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
                            <form onSubmit={form.handleSubmit(onSubmit, () => toast.error('Select items, choose a decision and add remarks for rejected items'))} className="space-y-4">
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

                                    <div className="rounded-xl border overflow-hidden">
                                        <div className="bg-muted/50 px-4 py-2 text-xs font-bold text-slate-600">Pending items ({availableItems.length})</div>
                                        <p className="px-4 py-2 text-xs text-muted-foreground">Tick the items to receive or reject. Review your selection below before submitting.</p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/30 border-y"><tr>
                                                    <th className="p-3 text-left">Select</th><th className="p-3 text-left">Lift No.</th>
                                                    <th className="p-3 text-left">Product</th><th className="p-3 text-left">Indent No.</th><th className="p-3 text-right">Qty</th>
                                                </tr></thead>
                                                <tbody className="divide-y">
                                                    {availableItems.map(item => <tr key={item.id}>
                                                        <td className="p-3"><input type="checkbox" aria-label={`Select ${item.productName}, lift ${item.liftNumber}, indent ${item.indentNo}`} checked={false} disabled={form.formState.isSubmitting} onChange={event => toggleItem(item.id, event.target.checked)} className="h-4 w-4 accent-green-600" /></td>
                                                        <td className="p-3 text-xs">{item.liftNumber}</td><td className="p-3 text-xs font-semibold">{item.productName}</td>
                                                        <td className="p-3 text-xs">{item.indentNo}</td><td className="p-3 text-right">{item.qty}</td>
                                                    </tr>)}
                                                    {!availableItems.length && <tr><td colSpan={5} className="p-3 text-xs text-muted-foreground">All remaining items are selected below.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    {selectedItems.length > 0 && <div className="rounded-xl border border-primary/30 p-4 space-y-4">
                                        <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /><h4 className="text-sm font-bold">Review selected items ({selectedItems.length})</h4></div>
                                        <FormField control={form.control} name="status" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Decision for selected items *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ''} disabled={form.formState.isSubmitting}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select Received or Rejected" /></SelectTrigger></FormControl>
                                                    <SelectContent><SelectItem value="Received">Received</SelectItem><SelectItem value="Not Received">Rejected</SelectItem></SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        {selectedItems.map((selection, index) => {
                                            const item = selectedIndent.originalItems?.find(item => item.id === selection.id);
                                            if (!item) return null;
                                            return <div key={item.id} className="rounded-lg border p-3 space-y-3">
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input type="checkbox" checked disabled={form.formState.isSubmitting} onChange={() => toggleItem(item.id, false)} className="mt-1 h-4 w-4 accent-green-600" />
                                                    <span><span className="block text-sm font-bold">{item.productName}</span><span className="text-xs text-muted-foreground">Lift: {item.liftNumber} | Indent: {item.indentNo} | Qty: {item.qty}</span></span>
                                                </label>
                                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                    <span>Physical: {item.damageOrder === 'No' ? 'Damaged' : item.damageOrder === 'Yes' ? 'Good' : 'Pending'}</span>
                                                    <span>Quantity: {item.quantityAsPerBill === 'Yes' ? 'Matches' : item.quantityAsPerBill === 'No' ? 'Mismatch' : 'Pending'}</span>
                                                    <span>Price: {item.priceAsPerPoCheck === 'Yes' ? 'Matches' : item.priceAsPerPoCheck === 'No' ? 'Mismatch' : 'Pending'}</span>
                                                </div>
                                                {item.remark && <p className="text-xs text-amber-800">Inspector remarks: {item.remark}</p>}
                                                <FormField control={form.control} name={`items.${index}.remark`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{decisionStatus === 'Not Received' ? 'Remarks *' : 'Remarks'}</FormLabel>
                                                        <FormControl><Input placeholder="Remarks for this item" {...field} disabled={form.formState.isSubmitting} maxLength={1000} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>;
                                        })}
                                        <p className="text-xs font-medium" role="status">{decisionStatus ? `Only these ${selectedItems.length} selected item(s) will be ${decisionStatus === 'Received' ? 'received' : 'rejected'}.` : 'Choose a decision for the selected items.'} {availableItems.length} unselected item(s) will remain pending.</p>
                                    </div>}

                                </div>

                                <DialogFooter className="border-t pt-4">
                                    <Button type="button" variant="ghost" disabled={form.formState.isSubmitting} className="h-10 text-slate-500 font-semibold"
                                        onClick={() => { setOpenDialog(false); setSelectedIndent(null); }}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={form.formState.isSubmitting || !selectedItems.length || !decisionStatus}
                                        className="h-10 px-8 font-black transition-all shadow-md bg-primary hover:bg-primary/90">
                                        {form.formState.isSubmitting ? <Loader size={16} color="white" className="mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                        {decisionStatus === 'Received' ? `Confirm Receive (${selectedItems.length})` : decisionStatus === 'Not Received' ? `Confirm Reject (${selectedItems.length})` : 'Confirm Selected Items'}
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
