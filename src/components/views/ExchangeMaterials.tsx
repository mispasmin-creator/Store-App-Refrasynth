import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { RefreshCw } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { fetchStoreInRecords, updateStoreInExchange, type StoreInRecord } from '@/services/storeInService';
import { formatDate } from '@/lib/utils';

interface ExchangePendingData {
    liftNumber: string;
    indentNo: string;
    poNumber: string;
    vendorName: string;
    productName: string;
    billStatus: string;
    billNo: string;
    qty: number;
    leadTimeToLiftMaterial: number;
    typeOfBill: string;
    billAmount: number;
    discountAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    receivingStatus: string;
    receivedQuantity: number;
    photoOfProduct: string;
    damageOrder: string;
    quantityAsPerBill: string; // Changed to string as per StoreInRecord
    priceAsPerPo: number;
    remark: string;
    status: string;
    reason: string;
    firmNameMatch: string;
    billNumber: string;
}

interface ExchangeHistoryData {
    liftNumber: string;
    indentNo: string;
    poNumber: string;
    vendorName: string;
    productName: string;
    billStatus: string;
    billNo: string;
    qty: number;
    leadTimeToLiftMaterial: number;
    typeOfBill: string;
    billAmount: number;
    discountAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    receivingStatus: string;
    receivedQuantity: number;
    photoOfProduct: string;
    damageOrder: string;
    quantityAsPerBill: string;
    priceAsPerPo: number;
    remark: string;
    status: string;
    reason: string;
    firmNameMatch: string;
    billNumber: string;
}


const ExchangeMaterials = () => {
    const { user } = useAuth();
    const [pendingData, setPendingData] = useState<ExchangePendingData[]>([]);
    const [historyData, setHistoryData] = useState<ExchangeHistoryData[]>([]);
    const [selectedItem, setSelectedItem] = useState<ExchangePendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const data = await fetchStoreInRecords();
            console.log("Fetched store-in records:", data.length);

            // Filter by firm name
            const filteredByFirm = data.filter(item =>
                user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
            );

            const pending = filteredByFirm
                .filter((i) =>
                    i.planned10 && i.planned10 !== '' &&
                    (!i.actual10 || i.actual10 === '')
                )
                .map((i) => ({
                    liftNumber: i.liftNumber,
                    indentNo: i.indentNo,
                    poNumber: i.poNumber,
                    vendorName: i.vendorName,
                    productName: i.productName,
                    billStatus: i.billStatus,
                    billNo: i.billNo,
                    qty: i.qty,
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial,
                    typeOfBill: i.typeOfBill,
                    billAmount: i.billAmount,
                    discountAmount: i.discountAmount,
                    paymentType: i.paymentType,
                    advanceAmountIfAny: i.advanceAmountIfAny,
                    photoOfBill: i.photoOfBill,
                    transportationInclude: i.transportationInclude,
                    transporterName: i.transporterName,
                    amount: i.amount,
                    receivingStatus: i.receivingStatus,
                    receivedQuantity: i.receivedQuantity,
                    photoOfProduct: i.photoOfProduct,
                    damageOrder: i.damageOrder,
                    quantityAsPerBill: i.quantityAsPerBill,
                    priceAsPerPo: i.priceAsPerPo,
                    remark: i.remark,
                    status: i.status,
                    reason: i.reason,
                    firmNameMatch: i.firmNameMatch,
                    billNumber: i.billNumber,
                }));

            setPendingData(pending);

            const history = filteredByFirm
                .filter((i) =>
                    i.planned10 && i.planned10 !== '' &&
                    i.actual10 && i.actual10 !== ''
                )
                .map((i) => ({
                    liftNumber: i.liftNumber,
                    indentNo: i.indentNo,
                    poNumber: i.poNumber,
                    vendorName: i.vendorName,
                    productName: i.productName,
                    billStatus: i.billStatus,
                    billNo: i.billNo,
                    qty: i.qty,
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial,
                    typeOfBill: i.typeOfBill,
                    billAmount: i.billAmount,
                    discountAmount: i.discountAmount,
                    paymentType: i.paymentType,
                    advanceAmountIfAny: i.advanceAmountIfAny,
                    photoOfBill: i.photoOfBill,
                    transportationInclude: i.transportationInclude,
                    transporterName: i.transporterName,
                    amount: i.amount,
                    receivingStatus: i.receivingStatus,
                    receivedQuantity: i.receivedQuantity,
                    photoOfProduct: i.photoOfProduct,
                    damageOrder: i.damageOrder,
                    quantityAsPerBill: i.quantityAsPerBill,
                    priceAsPerPo: i.priceAsPerPo,
                    remark: i.remark,
                    status: i.status, // Using status field for history status
                    reason: i.reason,
                    firmNameMatch: i.firmNameMatch,
                    billNumber: i.billNumber,
                }));

            setHistoryData(history);
        } catch (error) {
            console.error("Error fetching Exchange data:", error);
            toast.error("Failed to fetch data");
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    const pendingColumns: ColumnDef<ExchangePendingData>[] = [
        ...(user.receiveItemView
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<ExchangePendingData> }) => {
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
        { accessorKey: 'liftNumber', header: 'Lift Number' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'billStatus', header: 'Bill Status' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'leadTimeToLiftMaterial', header: 'Lead Time To Lift Material' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'discountAmount', header: 'Discount Amount' },
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
        { accessorKey: 'receivingStatus', header: 'Receiving Status' },
        { accessorKey: 'receivedQuantity', header: 'Received Quantity' },
        {
            accessorKey: 'photoOfProduct',
            header: 'Photo Of Product',
            cell: ({ row }) => {
                const photo = row.original.photoOfProduct;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        Product
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'billNumber', header: 'Bill Number' },
        { accessorKey: 'damageOrder', header: 'Damage Order' },
        { accessorKey: 'quantityAsPerBill', header: 'Quantity As Per Bill' },
        { accessorKey: 'priceAsPerPo', header: 'Price As Per Po' },
        { accessorKey: 'remark', header: 'Remark' },
        { accessorKey: 'status', header: 'Status' },
        { accessorKey: 'reason', header: 'Reason' },
    ];

    const historyColumns: ColumnDef<ExchangeHistoryData>[] = [
        { accessorKey: 'liftNumber', header: 'Lift Number' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'billStatus', header: 'Bill Status' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'leadTimeToLiftMaterial', header: 'Lead Time To Lift Material' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'discountAmount', header: 'Discount Amount' },
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
        { accessorKey: 'receivingStatus', header: 'Receiving Status' },
        { accessorKey: 'receivedQuantity', header: 'Received Quantity' },
        {
            accessorKey: 'photoOfProduct',
            header: 'Photo Of Product',
            cell: ({ row }) => {
                const photo = row.original.photoOfProduct;
                return photo ? (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                        Product
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'billNumber', header: 'Bill Number' },
        { accessorKey: 'damageOrder', header: 'Damage Order' },
        { accessorKey: 'quantityAsPerBill', header: 'Quantity As Per Bill' },
        { accessorKey: 'priceAsPerPo', header: 'Price As Per Po' },
        { accessorKey: 'remark', header: 'Remark' },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                const variant = status === 'Yes' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'reason', header: 'Reason' },
    ];

    const schema = z.object({
        status: z.enum(['Yes', 'No']),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: undefined,
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset({
                status: undefined,
            });
        }
    }, [openDialog, form]);

    async function onSubmit(values: z.infer<typeof schema>) {
        if (!selectedItem) return;

        try {
            await updateStoreInExchange(selectedItem.liftNumber, {
                actual10: new Date().toISOString(),
                status: values.status,
            });

            toast.success(`Updated status for ${selectedItem.liftNumber}`);
            setOpenDialog(false);
            fetchData();
        } catch {
            toast.error('Failed to update status');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Exchange Materials"
                        subtext="Process exchange materials and manage returns"
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <RefreshCw size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={pendingColumns}
                            searchFields={[
                                'liftNumber',
                                'indentNo',
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
                                'indentNo',
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
                                    <DialogTitle>Process Exchange Material</DialogTitle>
                                    <DialogDescription>
                                        Process exchange material from lift number{' '}
                                        <span className="font-medium">
                                            {selectedItem.liftNumber}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="bg-muted p-4 rounded-md grid gap-3">
                                    <h3 className="text-lg font-bold">Material Details</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Indent Number</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.indentNo}
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
                                            <p className="textsm font-light">
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
                                                            <SelectItem value="Yes">
                                                                Yes
                                                            </SelectItem>
                                                            <SelectItem value="No">
                                                                No
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
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

export default ExchangeMaterials;
