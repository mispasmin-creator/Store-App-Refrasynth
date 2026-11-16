import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    fetchStoreInRecords,
    updateStoreInQuantityCheck,
    uploadBillCopy,
    type StoreInRecord,
} from '@/services/storeInService';

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
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Truck } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDateTime, parseCustomDate } from '@/lib/utils';
import { Pill } from '../ui/pill';

interface StoreInPendingData {
    liftNumber: string;
    indentNumber: string;
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
    firmNameMatch: string;
    damageOrder?: string;
    quantityAsPerBill?: string;
    priceAsPerPo?: number;
    priceAsPerPoCheck?: string;
    remark?: string;
    planned7Date: string;
    timestamp: string;
    hodStatus?: string;
    hodRemark?: string;
}

interface StoreInHistoryData {
    liftNumber: string;
    indentNumber: string;
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
    status: string;
    billCopyAttached: string;
    debitNote: string;
    reason: string;
    firmNameMatch: string;
    damageOrder?: string;
    quantityAsPerBill?: string;
    priceAsPerPo?: number;
    priceAsPerPoCheck?: string;
    remark?: string;
    planned7Date: string;
    timestamp: string;
    hodStatus?: string;
    hodRemark?: string;
}

// ✅ Safe date formatter
const formatPlannedDate = (dateString: string) => {
    if (!dateString || dateString.trim() === '') return '';
    try {
        if (dateString.includes('/')) {
            return dateString;
        }
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

const schema = z.object({
    status: z.enum(['Accept', 'Reject']),
    billCopyAttached: z.instanceof(File).optional(),
    debitNote: z.enum(['Yes', 'No']),
    reason: z.string().min(1, 'Reason is required'),
});

type FormValues = z.infer<typeof schema>;

export default () => {
    const { user } = useAuth();

    const [storeInRecords, setStoreInRecords] = useState<StoreInRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [pendingData, setPendingData] = useState<StoreInPendingData[]>([]);
    const [historyData, setHistoryData] = useState<StoreInHistoryData[]>([]);
    const [selectedItem, setSelectedItem] = useState<StoreInPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: undefined,
            billCopyAttached: undefined,
            debitNote: undefined,
            reason: '',
        },
    });

    const fetchAllData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchStoreInRecords();
            setStoreInRecords(records);
        } catch (error) {
            console.error('Failed to fetch store-in records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch?.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        setPendingData(
            filteredByFirm
                .filter((i) => i.planned7 !== '' && i.actual7 === '')
                .sort((a, b) => (b.liftNumber || '').localeCompare(a.liftNumber || '', undefined, { numeric: true, sensitivity: 'base' }))
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNumber: i.indentNo || '',
                    billNo: i.billNo || '',
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
                    damageOrder: i.damageOrder || '',
                    quantityAsPerBill: i.quantityAsPerBill || '',
                    priceAsPerPo: i.priceAsPerPo || 0,
                    priceAsPerPoCheck: i.priceAsPerPoCheck || '',
                    remark: i.remark || '',
                    firmNameMatch: i.firmNameMatch || '',
                    planned7Date: i.planned7 || '',
                    timestamp: i.timestamp || '',
                    hodStatus: i.hodStatus || '',
                    hodRemark: i.hodRemark || '',
                }))
        );

        setHistoryData(
            filteredByFirm
                .filter((i) => i.planned7 !== '' && i.actual7 !== '')
                .sort((a, b) => (b.liftNumber || '').localeCompare(a.liftNumber || '', undefined, { numeric: true, sensitivity: 'base' }))
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNumber: i.indentNo || '',
                    billNo: i.billNo || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: i.qty || 0,
                    typeOfBill: i.typeOfBill || '',
                    billAmount: i.billAmount || 0,
                    paymentType: i.paymentType || '',
                    advanceAmountIfAny: Number(i.advanceAmountIfAny) || 0,
                    photoOfBill: i.photoOfBill || '',
                    transportationInclude: i.transportationInclude || '',
                    status: i.status || '',
                    billCopyAttached: i.billCopyAttached || '',
                    debitNote: i.sendDebitNote || '',
                    reason: i.reason || '',
                    damageOrder: i.damageOrder || '',
                    quantityAsPerBill: i.quantityAsPerBill || '',
                    priceAsPerPo: i.priceAsPerPo || 0,
                    priceAsPerPoCheck: i.priceAsPerPoCheck || '',
                    remark: i.remark || '',
                    firmNameMatch: i.firmNameMatch || '',
                    planned7Date: i.planned7 || '',
                    timestamp: i.timestamp || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch]);

    useEffect(() => {
        if (!openDialog) {
            form.reset({
                status: undefined,
                billCopyAttached: undefined,
                debitNote: undefined,
                reason: '',
            });
        }
    }, [openDialog, form]);

    async function onSubmit(values: FormValues) {
        try {
            console.log('📝 Form values:', values);

            let billCopyAttachedUrl = '';

            if (values.billCopyAttached) {
                try {
                    console.log('📤 Uploading bill copy...');
                    billCopyAttachedUrl = await uploadBillCopy(
                        values.billCopyAttached,
                        selectedItem?.liftNumber || 'unknown'
                    );
                    console.log('✅ Bill copy uploaded:', billCopyAttachedUrl);
                } catch (uploadError) {
                    console.error('❌ Upload error:', uploadError);
                    toast.error('Failed to upload bill copy');
                    return;
                }
            }

            const currentDateTime = new Date().toISOString();

            if (!selectedItem?.liftNumber) {
                toast.error('No record selected');
                return;
            }

            console.log('📤 Updating record in Supabase...');

            await updateStoreInQuantityCheck(selectedItem.liftNumber, {
                actual7: currentDateTime,
                status: values.status,
                billCopyAttached: billCopyAttachedUrl,
                sendDebitNote: values.debitNote || 'No',
                reason: values.reason,
            });

            console.log('✅ Update successful');
            toast.success(`Updated status for ${selectedItem.liftNumber}`);
            setOpenDialog(false);

            // Refresh data
            setTimeout(() => fetchAllData(), 1000);
        } catch (error) {
            console.error('❌ Error in onSubmit:', error);
            if (error instanceof Error) {
                toast.error(`Failed to update: ${error.message}`);
            } else {
                toast.error('Failed to update status');
            }
        }
    }

    const pendingColumns: ColumnDef<StoreInPendingData>[] = [
        ...(user.receiveItemView
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<StoreInPendingData> }) => {
                        const item = row.original;

                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedItem(item);
                                    }}
                                >
                                    Process
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
        { accessorKey: 'liftNumber', header: 'Lift Number' },
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'paymentType', header: 'Payment Type' },
        { accessorKey: 'advanceAmountIfAny', header: 'Advance Amount If Any' },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        Bill
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'transportationInclude', header: 'Transportation Include' },
        { accessorKey: 'transporterName', header: 'Transporter Name' },
        { accessorKey: 'amount', header: 'Amount' },
        {
            accessorKey: 'damageOrder',
            header: 'Physical Good ?',
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
            accessorKey: 'priceAsPerPoCheck',
            header: 'Price Match?',
            cell: ({ row }) => (
                <Pill variant={row.original.priceAsPerPoCheck === 'Yes' ? 'default' : 'reject'}>
                    {row.original.priceAsPerPoCheck === 'Yes' ? 'Match' : 'Mismatch'}
                </Pill>
            )
        },
        { accessorKey: 'remark', header: 'Remark' },
        {
            accessorKey: 'planned7Date',
            header: 'Planned Date',
            cell: ({ row }) => formatPlannedDate(row.original.planned7Date)
        },
    ];

    const historyColumns: ColumnDef<StoreInHistoryData>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        { accessorKey: 'liftNumber', header: 'Lift Number' },
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'paymentType', header: 'Payment Type' },
        { accessorKey: 'advanceAmountIfAny', header: 'Advance Amount If Any' },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        Bill
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'transportationInclude', header: 'Transportation Include' },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                const variant = status === 'Accept' ? 'default' : 'reject';
                return <Pill variant={variant as any}>{status}</Pill>;
            },
        },
        {
            accessorKey: 'billCopyAttached',
            header: 'Bill Copy Attached',
            cell: ({ row }) => {
                const billCopy = row.original.billCopyAttached;
                return billCopy ? (
                    <a href={billCopy} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'debitNote', header: 'Debit Note' },
        { accessorKey: 'reason', header: 'Reason' },
        {
            accessorKey: 'damageOrder',
            header: 'Physical Good ?',
            cell: ({ row }) => {
                const isDamaged = row.original.damageOrder === 'No';
                return (
                    <Pill variant={isDamaged ? 'reject' : 'default'}>
                        {isDamaged ? 'Damaged' : 'Good'}
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
            accessorKey: 'priceAsPerPoCheck',
            header: 'Price Match?',
            cell: ({ row }) => (
                <Pill variant={row.original.priceAsPerPoCheck === 'Yes' ? 'default' : 'reject'}>
                    {row.original.priceAsPerPoCheck === 'Yes' ? 'Match' : 'Mismatch'}
                </Pill>
            )
        },
        { accessorKey: 'remark', header: 'Remark' },
        {
            accessorKey: 'planned7Date',
            header: 'Planned Date',
            cell: ({ row }) => formatPlannedDate(row.original.planned7Date)
        },
    ];

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Reject For GRN"
                        subtext="Process store items and manage returns"
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <Truck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={pendingColumns}
                            searchFields={[
                                'liftNumber',
                                'indentNumber',
                                'productName',
                                'vendorName',
                            ]}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={[
                                'liftNumber',
                                'indentNumber',
                                'productName',
                                'vendorName',
                                'status',
                            ]}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedItem && (
                    <DialogContent className="sm:max-w-2xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Process Store Item</DialogTitle>
                                    <DialogDescription>
                                        Process item from lift number{' '}
                                        <span className="font-medium">
                                            {selectedItem.liftNumber}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="bg-muted p-4 rounded-md grid gap-3">
                                    <h3 className="text-lg font-bold">Item Details</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Indent Number</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.indentNumber}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Lift Number</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.liftNumber}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Product Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.productName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Vendor Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.vendorName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Quantity</p>
                                            <p className="text-sm font-light">{selectedItem.qty}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Bill Amount</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.billAmount}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Payment Type</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.paymentType}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-muted-foreground/10">
                                        <h4 className="text-sm font-bold mb-2 text-primary">Store-In Validation Results</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">Physical Good?</p>
                                                <Pill variant={selectedItem.damageOrder === 'Yes' ? 'default' : 'reject'}>
                                                    {selectedItem.damageOrder === 'Yes' ? 'Good' : 'Damaged'}
                                                </Pill>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">Qty Match?</p>
                                                <Pill variant={selectedItem.quantityAsPerBill === 'Yes' ? 'default' : 'reject'}>
                                                    {selectedItem.quantityAsPerBill === 'Yes' ? 'Match' : 'Mismatch'}
                                                </Pill>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">Price Match?</p>
                                                <Pill variant={selectedItem.priceAsPerPoCheck === 'Yes' ? 'default' : 'reject'}>
                                                    {selectedItem.priceAsPerPoCheck === 'Yes' ? 'Match' : 'Mismatch'}
                                                </Pill>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ✅ Added HOD Decision Section */}
                                    <div className="mt-4 pt-4 border-t border-muted-foreground/10">
                                        <h4 className="text-sm font-bold mb-2 text-emerald-600 flex items-center gap-2">
                                            HOD Decision
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">Decision Status</p>
                                                <Pill variant={selectedItem.hodStatus === 'Approved' ? 'default' : 'reject'}>
                                                    {selectedItem.hodStatus || 'N/A'}
                                                </Pill>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">HOD Remarks</p>
                                                <p className="text-sm font-semibold italic text-slate-700">
                                                    "{selectedItem.hodRemark || 'No remarks provided.'}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Accept">Accept</SelectItem>
                                                            <SelectItem value="Reject">Reject</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {form.watch('status') === 'Accept' && (
                                        <FormField
                                            control={form.control}
                                            name="billCopyAttached"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Copy Attached</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="file"
                                                            accept="image/*,.pdf"
                                                            onChange={(e) => field.onChange(e.target.files?.[0])}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    {(form.watch('status') === 'Accept' || form.watch('status') === 'Reject') && (
                                        <FormField
                                            control={form.control}
                                            name="reason"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Reason</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Enter reason" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    {(form.watch('status') === 'Accept' || form.watch('status') === 'Reject') && (
                                        <FormField
                                            control={form.control}
                                            name="debitNote"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Send Debit Note</FormLabel>
                                                    <FormControl>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Select option" />
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
                                    )}
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Update Status
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