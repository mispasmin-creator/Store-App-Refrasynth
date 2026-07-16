import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo } from 'react';
import { DownloadOutlined } from '@ant-design/icons';

import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Dialog,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { z } from 'zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ClipboardCheck } from 'lucide-react';
import Heading from '../element/Heading';
import { Input } from '../ui/input';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
    fetchIssueRecords,
    updateIssueApproval,
    type IssueRecord
} from '@/services/issueService';
import { fetchStoreInRecords } from '@/services/storeInService';

export default function IssueData() {
    const { user } = useAuth();
    const [allData, setAllData] = useState<IssueRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [availableQtyByProduct, setAvailableQtyByProduct] = useState<Map<string, number>>(new Map());

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchIssueRecords();
            // Filter by firm name
            const filteredByFirm = records.filter(item => {
                return user.firmNameMatch.toLowerCase() === "all" || item.firm_name_match === user.firmNameMatch;
            });
            setAllData(filteredByFirm);
        } catch (error) {
            console.error('Failed to fetch issue records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    // Available Qty per product: HOD Check history qty (Received only) minus
    // Issue Data history's Given Qty — same logic as the Inventory/Store Issue pages.
    useEffect(() => {
        const fetchAvailableQty = async () => {
            try {
                const [storeInRecords, issueRecords] = await Promise.all([
                    fetchStoreInRecords(),
                    fetchIssueRecords(),
                ]);

                const latestRecords: typeof storeInRecords = [];
                const seen = new Set<string>();
                for (const item of storeInRecords) {
                    const key = `${item.indentNo}-${item.productName}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        latestRecords.push(item);
                    }
                }
                const historyRecords = latestRecords.filter(
                    r => r.actual6 !== '' && r.receivingStatus !== 'Not Received'
                );

                const qtyByProduct = new Map<string, number>();
                for (const r of historyRecords) {
                    const key = (r.productName || '').trim().toLowerCase();
                    qtyByProduct.set(key, (qtyByProduct.get(key) || 0) + (Number(r.qty) || 0));
                }

                for (const i of issueRecords.filter(i => i.planned1 && i.actual1)) {
                    const key = (i.product_name || '').trim().toLowerCase();
                    qtyByProduct.set(key, (qtyByProduct.get(key) || 0) - (Number(i.given_qty) || 0));
                }

                setAvailableQtyByProduct(qtyByProduct);
            } catch (error) {
                console.error('Error fetching available qty:', error);
            }
        };

        fetchAvailableQty();
    }, []);

    const pendingData = useMemo(() => {
        return allData.filter(i => i.planned1 && !i.actual1);
    }, [allData]);

    const historyData = useMemo(() => {
        return allData.filter(i => i.planned1 && i.actual1);
    }, [allData]);

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error('No data to download');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map((row) =>
                headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
            ),
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `issue-data-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns: ColumnDef<IssueRecord>[] = [
        ...(user.issueData
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<IssueRecord> }) => {
                        const indent = row.original;
                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIssue(indent);
                                        setOpenDialog(true);
                                    }}
                                >
                                    Approve
                                </Button>
                            </DialogTrigger>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'issue_no', header: 'Issue No' },
        { accessorKey: 'issue_to', header: 'Issue to' },
        { accessorKey: 'group_head', header: 'Group' },
        { accessorKey: 'uom', header: 'Uom' },
        { accessorKey: 'product_name', header: 'Product Name' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'department', header: 'Category' },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
    ];

    const historyColumns: ColumnDef<IssueRecord>[] = [
        { accessorKey: 'issue_no', header: 'Issue No' },
        { accessorKey: 'issue_to', header: 'Issue to' },
        { accessorKey: 'group_head', header: 'Group' },
        { accessorKey: 'uom', header: 'Uom' },
        { accessorKey: 'product_name', header: 'Product Name' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'department', header: 'Category' },
        { accessorKey: 'status', header: 'Status' },
        { accessorKey: 'given_qty', header: 'Given Qty' },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
        {
            accessorKey: 'actual1',
            header: 'Actual Date',
            cell: ({ row }) => (row.original.actual1 ? formatDate(new Date(row.original.actual1)) : '-'),
        },
    ];

    const schema = z.object({
        status: z.enum(['Yes', 'No'], {
            required_error: 'Please select a status',
        }),
        givenQty: z.number().optional(),
    }).superRefine((data, ctx) => {
        if (data.status === 'Yes' && (!data.givenQty || data.givenQty <= 0)) {
            ctx.addIssue({
                path: ['givenQty'],
                code: z.ZodIssueCode.custom,
                message: 'Given quantity is required when status is Yes',
            });
        }
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { givenQty: undefined, status: undefined },
    });

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedIssue) return;

            if (values.status === 'Yes') {
                const key = (selectedIssue.product_name || '').trim().toLowerCase();
                const availableQty = availableQtyByProduct.get(key) ?? 0;
                if (availableQty <= 0) {
                    toast.error(`No stock available for ${selectedIssue.product_name}`);
                    return;
                }
            }

            const currentDateTime = new Date().toISOString();

            await updateIssueApproval(selectedIssue.issue_no, {
                actual1: currentDateTime,
                status: values.status,
                given_qty: values.status === 'Yes' ? values.givenQty : null,
            });

            toast.success(`Updated approval status of ${selectedIssue.issue_no}`);
            setOpenDialog(false);
            form.reset();
            setSelectedIssue(null);
            fetchData();
        } catch (err) {
            console.error('Error updating approval', err);
            toast.error('Failed to update issue');
        }
    }

    function onError(e: FieldErrors<z.infer<typeof schema>>) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading 
                        heading="Issue Data" 
                        subtext="Update Issue Data" 
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <ClipboardCheck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={columns}
                            searchFields={['product_name', 'department', 'issue_no', 'issue_to', 'firm_name_match']}
                            dataLoading={dataLoading}
                            extraActions={
                                <Button
                                    variant="default"
                                    onClick={() => handleDownload(pendingData)}
                                    style={{
                                        background: 'linear-gradient(90deg, #4CAF50, #2E7D32)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0 16px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <DownloadOutlined />
                                    {downloading ? 'Downloading...' : 'Download'}
                                </Button>
                            }
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product_name', 'department', 'issue_no', 'issue_to', 'firm_name_match']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIssue && (
                    <DialogContent>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Approve Indent</DialogTitle>
                                    <DialogDescription>
                                        Approve indent{' '}
                                        <span className="font-medium">{selectedIssue.issue_no}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-3">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select approval status" />
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

                                    {form.watch('status') === 'Yes' && (
                                        <FormField
                                            control={form.control}
                                            name="givenQty"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Given Quantity</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            type="number"
                                                            onChange={(e) =>
                                                                field.onChange(Number(e.target.value))
                                                            }
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        disabled={form.formState.isSubmitting}
                                    >
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
        </div>
    );
}
