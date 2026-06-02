import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState, useMemo } from 'react';
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
import { Textarea } from '../ui/textarea';
import { Calculator } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import {
    fetchTallyEntryRecords,
    updateTallyEntryRecord,
    type TallyEntryRecord
} from '@/services/tallyEntryService';

import { formatDate, formatDateTime } from '@/lib/utils';

export default function ReauditData() {
    const { user } = useAuth();
    const [allData, setAllData] = useState<TallyEntryRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<TallyEntryRecord | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchTallyEntryRecords();
            // Filter by firm name
            const filteredByFirm = records.filter(item => {
                return user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch;
            });
            setAllData(filteredByFirm);
        } catch (error) {
            console.error('Failed to fetch tally entry records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    const pendingData = useMemo(() => {
        return allData.filter(i => i.planned3 && !i.actual3);
    }, [allData]);

    const historyData = useMemo(() => {
        return allData.filter(i => i.planned3 && i.actual3);
    }, [allData]);

    const pendingColumns: ColumnDef<TallyEntryRecord>[] = [
        ...(user.receiveItemView
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<TallyEntryRecord> }) => {
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
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        {
            accessorKey: 'materialInDate',
            header: 'Material In Date',
            cell: ({ row }) => formatDate(row.original.materialInDate)
        },
        {
            accessorKey: 'planned3',
            header: 'Planned Date',
            cell: ({ row }) => formatDate(row.original.planned3)
        },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'partyName', header: 'Party Name' },
        { accessorKey: 'billAmt', header: 'Bill Amt' },
        {
            accessorKey: 'billImage',
            header: 'Bill Image',
            cell: ({ row }) => {
                const image = row.original.billImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },
        { accessorKey: 'location', header: 'Location' },
        { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
        {
            accessorKey: 'productImage',
            header: 'Product Image',
            cell: ({ row }) => {
                const image = row.original.productImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'area', header: 'Area' },
        { accessorKey: 'indentedFor', header: 'Indented For' },
        { accessorKey: 'approvedPartyName', header: 'Approved Party Name' },
        { accessorKey: 'rate', header: 'Rate' },
        { accessorKey: 'indentQty', header: 'Indent Qty' },
        { accessorKey: 'totalRate', header: 'Total Rate' },
        { accessorKey: 'status1', header: 'Status 1' },
        { accessorKey: 'remarks1', header: 'Remarks 1' },
        { accessorKey: 'status2', header: 'Status 2' },
        { accessorKey: 'remarks2', header: 'Remarks 2' },
    ];

    const historyColumns: ColumnDef<TallyEntryRecord>[] = [
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        {
            accessorKey: 'materialInDate',
            header: 'Material In Date',
            cell: ({ row }) => formatDate(row.original.materialInDate)
        },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'partyName', header: 'Party Name' },
        { accessorKey: 'billAmt', header: 'Bill Amt' },
        {
            accessorKey: 'billImage',
            header: 'Bill Image',
            cell: ({ row }) => {
                const image = row.original.billImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },
        { accessorKey: 'location', header: 'Location' },
        { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
        {
            accessorKey: 'productImage',
            header: 'Product Image',
            cell: ({ row }) => {
                const image = row.original.productImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'area', header: 'Area' },
        { accessorKey: 'indentedFor', header: 'Indented For' },
        { accessorKey: 'approvedPartyName', header: 'Approved Party Name' },
        { accessorKey: 'rate', header: 'Rate' },
        { accessorKey: 'indentQty', header: 'Indent Qty' },
        { accessorKey: 'totalRate', header: 'Total Rate' },
        {
            accessorKey: 'status1',
            header: 'Status 1',
            cell: ({ row }) => {
                const status = row.original.status1;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks1', header: 'Remarks 1' },
        {
            accessorKey: 'status2',
            header: 'Status 2',
            cell: ({ row }) => {
                const status = row.original.status2;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks2', header: 'Remarks 2' },
        {
            accessorKey: 'status3',
            header: 'Status 3',
            cell: ({ row }) => {
                const status = row.original.status3;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks3', header: 'Remarks 3' },
    ];

    const schema = z.object({
        status3: z.enum(['Done', 'Not Done'], {
            required_error: 'Please select a status',
        }),
        remarks3: z.string().min(1, 'Remarks are required'),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            status3: 'Done',
            remarks3: '',
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset({
                status3: 'Done',
                remarks3: '',
            });
        }
    }, [openDialog, form]);

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedItem) {
                toast.error('No item selected');
                return;
            }

            const currentDateTime = new Date().toISOString();

            await updateTallyEntryRecord(selectedItem.id, {
                actual3: currentDateTime,
                status3: values.status3,
                remarks3: values.remarks3
            });

            toast.success(`Successfully updated reaudit status for ${selectedItem.indentNumber}`);
            setOpenDialog(false);
            fetchData();
        } catch (error) {
            console.error('❌ Update error:', error);
            toast.error('Failed to update status. Please try again.');
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
                        heading="Reauditing Data"
                        subtext="Process tally entries and manage status"
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <Calculator size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={pendingColumns}
                            searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'status1', 'firmNameMatch']}
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
                                    <DialogTitle>Process Tally Entry</DialogTitle>
                                    <DialogDescription>
                                        Process entry for indent number{' '}
                                        <span className="font-medium">{selectedItem.indentNumber}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="bg-muted p-4 rounded-md grid gap-3">
                                    <h3 className="text-lg font-bold">Entry Details</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Indent No.</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.indentNumber}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Firm Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.firmNameMatch}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Product Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.productName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Party Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.partyName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Bill No.</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.billNo}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Quantity</p>
                                            <p className="text-sm font-light">{selectedItem.qty}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Bill Amount</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.billAmt}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Location</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.location}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Area</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.area}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Rate</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.rate}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status3"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Done">Done</SelectItem>
                                                        <SelectItem value="Not Done">
                                                            Not Done
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="remarks3"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Remarks *</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Enter remarks..."
                                                        {...field}
                                                        rows={4}
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
}
