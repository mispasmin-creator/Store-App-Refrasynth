import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    fetchStoreInRecords,
    updateStoreInDebitNote,
    uploadDebitNoteCopy,
    type StoreInRecord,
} from '@/services/storeInService';
import { createTallyEntryRecord } from '@/services/tallyEntryService';
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

function formatDateDisplay(dateString: string): string {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        return `${day}/${month}/${year}`;
    } catch (error) {
        console.error('Date formatting error:', error);
        return dateString;
    }
}

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
    reason: string;
    plannedDate: string;
    timestamp: string;
    poNumber: string;
    indentQty: number;
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
    reason: string;
    billNumber: string;
    statusPurchaser: string;
    debitNoteCopy: string;
    billCopy: string;
    returnCopy: string;
    firmNameMatch: string;
    timestamp: string;
}

const schema = z.object({
    debitNoteCopy: z.instanceof(File).optional(),
    debitNoteNumber: z.string().optional(),
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
            debitNoteCopy: undefined,
            debitNoteNumber: '',
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
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        setPendingData(
            filteredByFirm
                .filter((i) => i.planned9 !== '' && i.actual9 === '')
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
                    firmNameMatch: i.firmNameMatch || '',
                    reason: i.reason || '',
                    plannedDate: i.planned9 || '',
                    timestamp: i.timestamp || '',
                    poNumber: i.poNumber || '',
                    indentQty: i.indentQty || 0,
                }))
        );

        setHistoryData(
            filteredByFirm
                .filter((i) => i.planned9 !== '' && i.actual9 !== '')
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
                    reason: i.reason || '',
                    billNumber: i.billNo || '',
                    statusPurchaser: i.statusPurchaser || '',
                    debitNoteCopy: i.debitNoteCopy || '',
                    billCopy: i.billCopy || '',
                    returnCopy: i.returnCopy || '',
                    firmNameMatch: i.firmNameMatch || '',
                    timestamp: i.timestamp || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch]);

    useEffect(() => {
        if (!openDialog) {
            form.reset({
                debitNoteCopy: undefined,
                debitNoteNumber: '',
            });
        }
    }, [openDialog, form]);

    async function onSubmit(values: FormValues) {
        try {
            console.log('📝 Form values:', values);

            let debitNoteCopyUrl = '';

            if (values.debitNoteCopy) {
                try {
                    console.log('📤 Uploading debit note copy...');
                    debitNoteCopyUrl = await uploadDebitNoteCopy(
                        values.debitNoteCopy,
                        selectedItem?.liftNumber || 'unknown'
                    );
                    console.log('✅ File uploaded:', debitNoteCopyUrl);
                } catch (uploadError) {
                    console.error('❌ Upload error:', uploadError);
                    toast.error('Failed to upload file');
                    return;
                }
            }

            const currentDateTime = new Date().toISOString();

            if (!selectedItem?.liftNumber) {
                toast.error('No record selected');
                return;
            }

            console.log('📤 Updating record in Supabase...');

            await updateStoreInDebitNote(selectedItem.liftNumber, {
                actual9: currentDateTime,
                debitNoteCopy: debitNoteCopyUrl,
                debitNoteNumber: values.debitNoteNumber || '',
            });

            // ✅ Forward to Account Audit by creating a Tally Entry
            try {
                console.log('📝 Creating Audit Data entry from Debit Note...');
                const formattedDateOnly = currentDateTime.split('T')[0];
                await createTallyEntryRecord({
                    timestamp: currentDateTime,
                    lift_number: selectedItem.liftNumber || '',
                    indent_number: selectedItem.indentNumber || '',
                    po_number: selectedItem.poNumber || '',
                    material_in_date: formattedDateOnly,
                    product_name: selectedItem.productName || '',
                    bill_status: 'Bill Received',
                    qty: Number(selectedItem.qty || 0),
                    party_name: selectedItem.vendorName || '',
                    bill_amt: Number(selectedItem.billAmount || 0),
                    bill_image: selectedItem.photoOfBill || '',
                    bill_no: selectedItem.billNo || '',
                    indent_qty: Number(selectedItem.indentQty || 0),
                    location: '',
                    type_of_bills: selectedItem.typeOfBill || '',
                    product_image: '',
                    area: '',
                    indented_for: '',
                    approved_party_name: selectedItem.vendorName || '',
                    rate: Number(selectedItem.amount || 0),
                    total_rate: Number(selectedItem.amount || 0),
                    bill_recieved_later: 'No',
                    firm_name_match: selectedItem.firmNameMatch || '',
                    planned1: formattedDateOnly,
                } as any);
                console.log('✅ Account Audit entry created successfully');
            } catch (auditError) {
                console.error('❌ Failed to create Account Audit entry:', auditError);
                toast.error('Processed Debit Note, but failed to forward to Account Audit');
            }

            console.log('✅ Update successful');
            toast.success(`Updated status for ${selectedItem.indentNumber}`);
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
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
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
        { accessorKey: 'reason', header: 'Reason' },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date',
            cell: ({ row }) => formatDateDisplay(row.original.plannedDate)
        },
    ];

    const historyColumns: ColumnDef<StoreInHistoryData>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        { accessorKey: 'liftNumber', header: 'Lift Number' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
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
                const variant = status === 'Return' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'reason', header: 'Reason' },
        { accessorKey: 'billNumber', header: 'Bill Number' },
        {
            accessorKey: 'statusPurchaser',
            header: 'Status Purchaser',
            cell: ({ row }) => {
                const status = row.original.statusPurchaser;
                const variant = status === 'Return to Party' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        {
            accessorKey: 'debitNoteCopy',
            header: 'Debit Note Copy',
            cell: ({ row }) => {
                const file = row.original.debitNoteCopy;
                return file ? (
                    <a href={file} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : (
                    <></>
                );
            },
        },
        {
            accessorKey: 'billCopy',
            header: 'Bill Copy',
            cell: ({ row }) => {
                const file = row.original.billCopy;
                return file ? (
                    <a href={file} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : (
                    <></>
                );
            },
        },
        {
            accessorKey: 'returnCopy',
            header: 'Return Copy',
            cell: ({ row }) => {
                const file = row.original.returnCopy;
                return file ? (
                    <a href={file} target="_blank" rel="noopener noreferrer">
                        View
                    </a>
                ) : (
                    <></>
                );
            },
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
                        heading="Send Debit Note"
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
                                </div>

                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="debitNoteCopy"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Debit Note Copy</FormLabel>
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
                                    <FormField
                                        control={form.control}
                                        name="debitNoteNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Debit Note Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="text"
                                                        placeholder="Enter debit note number"
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
