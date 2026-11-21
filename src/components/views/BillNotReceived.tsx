import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
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
import { Input } from '../ui/input';
import {
    fetchStoreInRecords,
    updateStoreInBillStatus,
    uploadBillCopy,
    type StoreInRecord,
} from '@/services/storeInService';
import { Truck } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';

interface StoreInPendingData {
    liftNumber: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: string;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    // Add missing properties that are used in columns
    poDate: string;
    plannedDate: string; // ✅ FIXED: Changed from 'planneDate' to 'plannedDate'
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    uom: string;
    quantity: number;
    poCopy: string;

    billStatus: string;
    leadTimeToLiftMaterial: number;
    discountAmount: number;
    rowIndex?: number; // Added to fix the error
    firmNameMatch: string;
}


// Fix type names to match usage
type RecieveItemsData = StoreInPendingData;

export default () => {
    const { user } = useAuth();

    const [allData, setAllData] = useState<StoreInRecord[]>([]);
    const [tableData, setTableData] = useState<RecieveItemsData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<RecieveItemsData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);

    const fetchAllData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchStoreInRecords();
            setAllData(records);
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
        const filteredByFirm = allData.filter(item =>
            user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        setTableData(
            filteredByFirm
                .filter((i) => i.planned11 !== '' && i.actual11 === '')
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
                    advanceAmountIfAny: String(i.advanceAmountIfAny) || '',
                    photoOfBill: i.photoOfBill || '',
                    transportationInclude: i.transportationInclude || '',
                    transporterName: i.transporterName || '',
                    amount: i.amount || 0,
                    poDate: i.poDate || '',
                    plannedDate: i.planned11 || '',
                    poNumber: i.poNumber || '',
                    vendor: i.vendor || '',
                    indentNumber: i.indentNumber || '',
                    product: i.product || '',
                    uom: i.uom || '',
                    quantity: i.qty || 0, // Using qty from mapping
                    poCopy: i.poCopy || '',
                    billStatus: i.billStatus || '',
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial || 0,
                    discountAmount: i.discountAmount || 0,
                    firmNameMatch: i.firmNameMatch || '',
                }))
        );
    }, [allData, user.firmNameMatch]);


    useEffect(() => {
        if (!openDialog) {
            form.reset({ status: undefined });
        }
    }, [openDialog]);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const schema = z.object({
        status: z.enum(['ok']),
        billImageStatus: z.instanceof(File).optional()
            .refine((file) => {
                if (!file) return true; // Optional field
                const allowedTypes = [
                    'image/jpeg',
                    'image/jpg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'application/pdf'
                ];
                return allowedTypes.includes(file.type);
            }, 'File must be an image (JPEG, PNG, GIF, WebP) or PDF')
            .refine((file) => {
                if (!file) return true;
                return file.size <= 5 * 1024 * 1024; // 5MB max
            }, 'File size should be less than 5MB'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            status: undefined,
            billImageStatus: undefined,
        },
    });


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
                                    Action
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
        {
            accessorKey: 'plannedDate', // ✅ FIXED: Using correct field name
            header: 'Planned Date',
            cell: ({ row }) => formatDate(row.original.plannedDate) // ✅ FIXED: Using correct field name
        },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'leadTimeToLiftMaterial', header: 'Lead Time To Lift Material' },
        { accessorKey: 'typeOfBill', header: 'Type Of Bill' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'discountAmount', header: 'Discount Amount' },
        { accessorKey: 'paymentType', header: 'Payment Type' },
        {
            accessorKey: 'advanceAmountIfAny',
            header: 'Advance Amount If Any',
            cell: ({ row }) => formatDate(row.original.advanceAmountIfAny)
        },

        {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'transportationInclude', header: 'Transportation Include' },
        { accessorKey: 'transporterName', header: 'Transporter Name' },
        { accessorKey: 'amount', header: 'Amount' },
    ];





    // async function onSubmit(values: z.infer<typeof schema>) {
    //     try {
    //         const mappedData = [
    //             {
    //                 indentNo: selectedIndent!.indentNo,
    //                 actual11: new Date().toISOString(),
    //                 billStatusNew: values.status,
    //                 rowIndex: selectedIndent!.rowIndex, // ✅ Add this line
    //             }
    //         ];

    //         console.log('Mapped data to post:', mappedData);

    //         await postToSheet(mappedData, 'update', 'STORE IN');

    //         toast.success(`Bill status updated for ${selectedIndent?.indentNo}`);
    //         setOpenDialog(false);
    //         setTimeout(() => updateAll(), 1000);
    //     } catch (err) {
    //         console.error("Error:", err);
    //         toast.error('Failed to update');
    //     }
    // }


    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            console.log('🔄 Starting form submission...');
            console.log('📝 Selected indent:', selectedIndent);
            console.log('📋 Form values:', values);

            let billImageUrl = '';

            // Upload file if provided
            if (values.billImageStatus) {
                console.log('📤 Uploading file...');
                try {
                    billImageUrl = await uploadBillCopy(
                        values.billImageStatus,
                        selectedIndent?.liftNumber || 'unknown'
                    );
                    console.log('✅ File uploaded:', billImageUrl);
                    toast.success('Document uploaded successfully');
                } catch (uploadError) {
                    console.error('❌ File upload error:', uploadError);
                    toast.error('Failed to upload file. Please try again.');
                    return;
                }
            }

            const currentDateTime = new Date().toISOString();

            if (!selectedIndent?.liftNumber) {
                toast.error('No record selected');
                return;
            }

            console.log('📤 Updating record');

            await updateStoreInBillStatus(selectedIndent.liftNumber, {
                actual11: currentDateTime,
                billStatusNew: values.status,
                billImageStatus: billImageUrl || '',
            });

            console.log('✅ Update successful');
            toast.success(`Bill status updated for ${selectedIndent?.indentNo}`);
            setOpenDialog(false);

            // Refresh data
            setTimeout(() => {
                fetchAllData();
                console.log('🔄 Data refreshed after update');
            }, 1000);

        } catch (err) {
            console.error('❌ Error in onSubmit:', err);
            toast.error('Failed to update. Please try again.');
        }
    }




    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    // console.log("selectedIndent", selectedIndent);

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Bill Status"
                        subtext="Receive items from purchase orders"
                        pendingCount={tableData.length}
                    // tabs
                    >
                        <Truck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={[
                                'liftNumber',
                                'indentNo',
                                'poNumber',
                                'vendorName',
                                'productName',
                                'billStatus',
                                'billNo',
                                'qty',
                                'leadTimeToLiftMaterial',
                                'typeOfBill',
                                'billAmount',
                                'discountAmount',
                                'paymentType',
                                'advanceAmountIfAny',
                                'transportationInclude',
                                'transporterName',
                                'amount'
                            ]}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>

                </Tabs>

                {selectedIndent && (
                    <DialogContent className="sm:max-w-3xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Store In</DialogTitle>
                                    <DialogDescription>
                                        Store In from indent{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="bg-muted p-4 rounded-md grid gap-3">
                                    <h3 className="text-lg font-bold">Item Details</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 bg-muted rounded-md gap-3 ">
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Indent Number</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.indentNo}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Item Name</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.productName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">
                                                Ordered Quantity
                                            </p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.quantity}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">UOM</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.uom}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormLabel>Status</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Set status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="ok">ok</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {form.watch('status') === 'ok' && (
                                        <FormField
                                            control={form.control}
                                            name="billImageStatus"
                                            render={({ field: { onChange, value, ...field } }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Image/Document</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="file"
                                                            accept="image/*,.pdf,application/pdf" // ✅ Accept both images and PDFs
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) onChange(file);
                                                            }}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    {/* ✅ Add error message display */}
                                                    {form.formState.errors.billImageStatus && (
                                                        <p className="text-sm text-red-500">
                                                            {form.formState.errors.billImageStatus.message}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        Upload image (JPEG, PNG, GIF, WebP) or PDF document (Max: 5MB)
                                                    </p>
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
                                        Store In
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
