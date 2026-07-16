import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { Button } from '../ui/button';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { PackageCheck } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Pill } from '../ui/pill';
import { fetchIndentRecords, updateIndentStoreOutApproval, type IndentRecord } from '@/services/indentService';

interface StoreOutTableData {
    id: number;
    indentNo: string;
    department: string;
    product: string;
    date: string;
    indenter: string;
    areaOfUse: string;
    quantity: number;
    uom: string;
    specifications: string;
    attachment: string;
}
interface HistoryData {
    id: number;
    approvalDate: string;
    indentNo: string;
    department: string;
    product: string;
    date: string;
    indenter: string;
    areaOfUse: string;
    quantity: number;
    uom: string;
    issuedStatus: string;
    requestedQuantity: number;
}

export default () => {
    const { user } = useAuth();
    const [openDialog, setOpenDialog] = useState(false);
    const [tableData, setTableData] = useState<StoreOutTableData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<StoreOutTableData | null>(null);
    const [rejecting, setRejecting] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const data = await fetchIndentRecords();

            // Filter by firm name match
            const filteredByFirm = data.filter(item =>
                user.firmNameMatch.toLowerCase() === "all" || item.firm_name_match === user.firmNameMatch
            );

            // Filter where indentType is 'Store Out'
            // Pending: Not approved yet (no approved_date) and not rejected
            const pending = filteredByFirm
                .filter(sheet =>
                    sheet.indent_type === 'Store Out' &&
                    !sheet.approved_date &&
                    sheet.indent_status !== 'Rejected'
                )
                .map(sheet => ({
                    id: sheet.id,
                    indentNo: sheet.indent_number,
                    indenter: sheet.indenter_name,
                    department: sheet.department,
                    product: sheet.product_name,
                    date: formatDate(new Date(sheet.timestamp)),
                    areaOfUse: sheet.area_of_use || '',
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    specifications: sheet.specifications || 'Not specified',
                    attachment: sheet.attachment || ''
                }));

            setTableData(pending);

            // History: Approved or Rejected
            const history = filteredByFirm
                .filter(sheet =>
                    sheet.indent_type === 'Store Out' &&
                    (sheet.approved_date || sheet.indent_status === 'Rejected')
                )
                .map(sheet => ({
                    id: sheet.id,
                    approvalDate: sheet.approved_date ? formatDate(new Date(sheet.approved_date)) : '',
                    indentNo: sheet.indent_number,
                    indenter: sheet.indenter_name,
                    department: sheet.department,
                    product: sheet.product_name,
                    date: formatDate(new Date(sheet.timestamp)),
                    areaOfUse: sheet.area_of_use || '',
                    quantity: sheet.approved_quantity || 0,
                    requestedQuantity: sheet.quantity,
                    uom: sheet.uom,
                    issuedStatus: sheet.indent_status || 'Pending',
                }));

            setHistoryData(history);

        } catch (error) {
            console.error("Error fetching store out data:", error);
            toast.error("Failed to fetch data");
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    // Creating table columns
    const columns: ColumnDef<StoreOutTableData>[] = [
        ...(user.storeOutApprovalAction
            ? [
                {
                    header: 'Actions',
                    id: 'actions',
                    cell: ({ row }: { row: Row<StoreOutTableData> }) => {
                        const indent = row.original;

                        return (
                            <div className="flex gap-3 justify-center">
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                        }}
                                    >
                                        Approve
                                    </Button>
                                </DialogTrigger>
                                <Button
                                    variant="destructive"
                                    disabled={rejecting}
                                    onClick={async () => {
                                        setRejecting(true);
                                        try {
                                            await updateIndentStoreOutApproval(indent.indentNo, {
                                                approved_by: user.name || 'System',
                                                approved_date: new Date().toISOString(),
                                                approved_quantity: 0, // 0 for rejected?
                                                status: 'Rejected',
                                            });

                                            toast.success(
                                                `Updated store out approval status of ${indent.indentNo}`
                                            );
                                            fetchData();
                                        } catch {
                                            toast.error('Failed to update status');
                                        } finally {
                                            setRejecting(false);
                                        }
                                    }}
                                >
                                    {rejecting && (
                                        <Loader
                                            size={20}
                                            color="white"
                                            aria-label="Loading Spinner"
                                        />
                                    )}
                                    Reject
                                </Button>
                            </div>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Category' },
        { accessorKey: 'product', header: 'Item' },
        { accessorKey: 'date', header: 'Date' },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a href={attachment} target="_blank">
                        Attachment
                    </a>
                ) : (
                    <></>
                );
            },
        },


    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Category' },
        { accessorKey: 'product', header: 'Item' },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'quantity', header: 'Issued Quantity' },
        { accessorKey: 'requestedQuantity', header: 'Requested Quantity' },
        { accessorKey: 'date', header: 'Requuest Date' },
        { accessorKey: 'approvalDate', header: 'Approval Date' },
        {
            accessorKey: 'issuedStatus',
            header: 'Issued Status',
            cell: ({ row }) => {
                const status = row.original.issuedStatus;
                const variant = status === 'Rejected' ? 'reject' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
    ];

    // Create approval form
    const schema = z.object({
        approvedBy: z.string().nonempty("Approved By is required"),
        approvalDate: z.date({
            required_error: "Approval Date is required",
            invalid_type_error: "Approval Date must be a valid date",
        }),
        issuedQuantity: z.number().min(0, "Quantity cannot be negative"),
        notes: z.string().optional(),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            approvalDate: undefined,
            approvedBy: '',
            notes: '',
            issuedQuantity: undefined,
        },
    });

    useEffect(() => {
        if (selectedIndent) {
            form.reset({
                issuedQuantity: selectedIndent.quantity,
                approvedBy: user.name || '',
                approvalDate: new Date(),
            });
        } else {
            form.reset();
        }
    }, [selectedIndent, user.name]);

    async function onSubmit(values: z.infer<typeof schema>) {
        if (!selectedIndent) return;

        try {
            await updateIndentStoreOutApproval(selectedIndent.indentNo, {
                approved_by: values.approvedBy,
                approved_date: values.approvalDate.toISOString(),
                approved_quantity: values.issuedQuantity,
                status: 'Approved',
            });

            toast.success(`Updated store out approval status of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            form.reset();
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
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <Tabs defaultValue="pending">
                <Heading 
                    heading="Store Out Approval" 
                    subtext="Approve store out requests" 
                    tabs
                    pendingCount={tableData.length}
                    historyCount={historyData.length}
                >
                    <PackageCheck size={50} className="text-primary" />
                </Heading>
                <TabsContent value="pending">
                    <DataTable
                        data={tableData}
                        columns={columns}
                        searchFields={['product', 'department', 'indenter']}
                        dataLoading={dataLoading}
                    />
                </TabsContent>
                <TabsContent value="history">
                    <DataTable
                        data={historyData}
                        columns={historyColumns}
                        searchFields={['product', 'department', 'indenter']}
                        dataLoading={dataLoading}
                    />
                </TabsContent>
            </Tabs>
            {selectedIndent && (
                <DialogContent className="sm:max-w-3xl">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-5">
                            <DialogHeader className="space-y-1">
                                <DialogTitle>Approve Store Out Request</DialogTitle>
                                <DialogDescription>
                                    Approve Store Out Request{' '}
                                    <span className="font-medium">{selectedIndent.indentNo}</span>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="bg-muted p-4 rounded-md grid gap-3">
                                <h3 className="text-lg font-bold">Request Details</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 bg-muted rounded-md gap-3 ">
                                    <div className="space-y-1">
                                        <p className="font-medium">Indenter</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.indenter}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Department</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.department}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Area of Use</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.areaOfUse}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Date</p>
                                        <p className="text-sm font-light">{selectedIndent.date}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-muted p-4 rounded-md grid gap-3">
                                <h3 className="text-lg font-bold">Item Details</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 bg-muted rounded-md gap-3 ">
                                    <div className="space-y-1">
                                        <p className="font-medium">Item Name</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.product}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Quantity</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.quantity}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">UOM</p>
                                        <p className="text-sm font-light">{selectedIndent.uom}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Specifications</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.specifications}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="approvedBy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Approved By</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter approved by" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="issuedQuantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Issue Quantity</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter quantity to be issued"
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="approvalDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Approval Date</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    value={
                                                        field.value
                                                            ? field.value
                                                                .toISOString()
                                                                .split('T')[0]
                                                            : ''
                                                    }
                                                    onChange={(e) =>
                                                        field.onChange(
                                                            e.target.value
                                                                ? new Date(e.target.value)
                                                                : undefined
                                                        )
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Enter notes"
                                                className="resize-y"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

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
                                    Approve
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            )}
        </Dialog>
    );
};
