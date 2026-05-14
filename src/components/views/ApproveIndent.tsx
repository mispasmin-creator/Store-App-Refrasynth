import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo } from 'react';
import { DownloadOutlined } from "@ant-design/icons";

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
import { ClipboardCheck, PenSquare, CheckSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    fetchIndentRecords,
    updateIndentApproval,
    updateIndentHistoryFields,
    type IndentRecord
} from '@/services/indentService';

export default function ApproveIndent() {
    const { user } = useAuth();
    const [allData, setAllData] = useState<IndentRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedIndent, setSelectedIndent] = useState<IndentRecord | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<IndentRecord>>({});
    const [downloading, setDownloading] = useState(false);
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
    const [editedStatuses, setEditedStatuses] = useState<Record<number, string>>({});
    const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({});
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchIndentRecords();
            // Filter by firm name
            const filteredByFirm = records.filter(item => {
                return user.firmNameMatch.toLowerCase() === "all" || item.firm_name_match === user.firmNameMatch;
            });
            setAllData(filteredByFirm);
        } catch (error) {
            console.error('Failed to fetch indent records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    const pendingData = useMemo(() => {
        return allData.filter(i => i.planned1 && !i.actual1);
    }, [allData]);

    const historyData = useMemo(() => {
        return allData.filter(i => i.planned1 && i.actual1);
    }, [allData]);

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(","),
            ...data.map(row =>
                headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
            )
        ];
        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `approve-indent-data-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEditClick = (row: IndentRecord) => {
        setEditingRow(row.id);
        setEditValues({
            approved_quantity: row.approved_quantity,
            uom: row.uom,
            vendor_type: row.vendor_type,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (id: number) => {
        try {
            await updateIndentHistoryFields(id, {
                approved_quantity: Number(editValues.approved_quantity),
                uom: editValues.uom,
                vendor_type: editValues.vendor_type,
            });

            toast.success(`Updated record ID ${id}`);
            fetchData();
            setEditingRow(null);
            setEditValues({});
        } catch (err) {
            console.error('Error updating indent:', err);
            toast.error('Failed to update indent');
        }
    };

    const handleInputChange = (field: keyof IndentRecord, value: any) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };



    const columns = useMemo<ColumnDef<IndentRecord>[]>(() => [
        ...(user?.indentApprovalAction
            ? [
                {
                    id: 'select',
                    header: ({ table }: { table: any }) => (
                        <Checkbox
                            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                            aria-label="Select all"
                        />
                    ),
                    cell: ({ row }: { row: any }) => (
                        <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) => row.toggleSelected(!!value)}
                            aria-label="Select row"
                        />
                    ),
                    enableSorting: false,
                    enableHiding: false,
                },
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                        const id = row.original.id;
                        const status = table.options.meta?.editedStatuses[id] ?? 'Regular';
                        
                        return (
                            <div className="flex items-center gap-2">
                                <Select
                                    value={status}
                                    onValueChange={(val) => table.options.meta?.updateStatus(id, val)}
                                >
                                    <SelectTrigger className="w-[110px] h-8 text-xs">
                                        <SelectValue placeholder="Action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Regular">Accept</SelectItem>
                                        <SelectItem value="Reject">Reject</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'indent_number', header: 'Indent No.' },
        {
            accessorKey: 'product_name',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        { accessorKey: 'area_of_use', header: 'Area of Use' },
        {
            accessorKey: 'quantity',
            header: 'Req Qty',
        },
        ...(user?.indentApprovalAction
            ? [
                {
                    header: 'Approve Qty',
                    id: 'approve_qty',
                    cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                        const id = row.original.id;
                        const qty = table.options.meta?.editedQuantities[id] ?? row.original.quantity;
                        return (
                            <div className="flex items-center gap-1">
                                <Input
                                    type="number"
                                    className="w-20 h-8"
                                    value={qty}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        table.options.meta?.updateQuantity(id, val === '' ? 0 : Number(val));
                                    }}
                                />
                                <span className="text-[10px] text-muted-foreground">{row.original.uom}</span>
                            </div>
                        );
                    },
                }
            ]
            : [
                { accessorKey: 'uom', header: 'UOM' }
            ]),
        { accessorKey: 'firm_name_match', header: 'Firm Name' },
        { accessorKey: 'indenter_name', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'vendor_type',
            header: 'Vendor Type',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.vendor_type;
                return (
                    <Pill
                        variant={
                            status === 'Reject'
                                ? 'reject'
                                : status === 'Regular'
                                    ? 'primary'
                                    : 'secondary'
                        }
                    >
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'indent_status',
            header: 'Priority',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.indent_status;
                return (
                    <Pill variant={status === 'Critical' ? 'reject' : 'secondary'}>
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'no_day',
            header: 'Days',
            cell: ({ getValue }) => (
                <div className="text-center">
                    {getValue() as number}
                </div>
            ),
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a href={attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Attachment
                    </a>
                ) : null;
            },
        },
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ row }) => row.original.timestamp ? formatDate(new Date(row.original.timestamp)) : '-',
        },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        }
    ], [user?.indentApprovalAction]);

    const historyColumns = useMemo<ColumnDef<IndentRecord>[]>(() => [
        { accessorKey: 'indent_number', header: 'Indent No.' },
        { accessorKey: 'firm_name_match', header: 'Firm Name' },
        { accessorKey: 'indenter_name', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'product_name',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        { accessorKey: 'area_of_use', header: 'Area of Use' },
        {
            accessorKey: 'approved_quantity',
            header: 'Quantity',
            cell: ({ row, table }: { row: any, table: any }) => {
                const id = row.original.id;
                const isEditing = table.options.meta?.editingRow === id;
                const val = table.options.meta?.editValues?.approved_quantity ?? row.original.approved_quantity;
                return isEditing ? (
                    <Input
                        type="number"
                        value={val}
                        onChange={(e) => table.options.meta?.onInputChange('approved_quantity', Number(e.target.value))}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.approved_quantity}
                        {user.indentApprovalAction && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row, table }: { row: any, table: any }) => {
                const id = row.original.id;
                const isEditing = table.options.meta?.editingRow === id;
                const val = table.options.meta?.editValues?.uom ?? row.original.uom;
                return isEditing ? (
                    <Input
                        value={val}
                        onChange={(e) => table.options.meta?.onInputChange('uom', e.target.value)}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.uom}
                        {user.indentApprovalAction && !isEditing && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'indent_status',
            header: 'Priority',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.indent_status;
                return (
                    <Pill variant={status === 'Critical' ? 'reject' : 'secondary'}>
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'no_day',
            header: 'Days',
            cell: ({ getValue }) => (
                <div className="text-center">
                    {getValue() as number}
                </div>
            ),
        },
        {
            accessorKey: 'timestamp',
            header: 'Request Date',
            cell: ({ row }) => row.original.timestamp ? formatDate(new Date(row.original.timestamp)) : '-',
        },
        {
            accessorKey: 'actual1',
            header: 'Approval Date',
            cell: ({ row }) => row.original.actual1 ? formatDate(new Date(row.original.actual1)) : '-',
        },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
        ...(user.indentApprovalAction
            ? [
                {
                    id: 'editActions',
                    cell: ({ row, table }: { row: Row<IndentRecord>, table: any }) => {
                        const id = row.original.id;
                        const isEditing = table.options.meta?.editingRow === id;
                        return isEditing ? (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(id)}
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : null;
                    },
                },
            ]
            : []),
    ], [user?.indentApprovalAction, handleEditClick, handleSaveEdit, handleCancelEdit]);

    const schema = z.object({
        approval: z.enum(['Reject', 'Three Party', 'Regular'], {
            required_error: "Please select an approval status",
        }),
        approvedQuantity: z.coerce.number().optional(),
    }).superRefine((data, ctx) => {
        if (data.approval !== 'Reject') {
            if (!data.approvedQuantity || data.approvedQuantity <= 0) {
                ctx.addIssue({
                    path: ['approvedQuantity'],
                    code: z.ZodIssueCode.custom,
                    message: "Approved quantity must be greater than 0",
                });
            }
        }
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { approvedQuantity: undefined, approval: 'Regular' },
    });

    useEffect(() => {
        if (selectedIndent) {
            form.setValue("approvedQuantity", selectedIndent.quantity);
            form.setValue("approval", 'Regular');
        }
    }, [selectedIndent, form]);

    const handleReject = async () => {
        if (!selectedIndent) return;
        try {
            const currentDateTime = new Date().toISOString();
            await updateIndentApproval(selectedIndent.id, {
                actual1: currentDateTime,
                vendor_type: 'Reject',
                approved_quantity: 0,
            });
            toast.success(`Rejected indent item from ${selectedIndent.indent_number}`);
            setOpenDialog(false);
            setSelectedIndent(null);
            fetchData();
        } catch (err) {
            console.error('Error rejecting indent:', err);
            toast.error('Failed to reject indent');
        }
    };

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedIndent) return;

            const currentDateTime = new Date().toISOString();

            await updateIndentApproval(selectedIndent.id, {
                actual1: currentDateTime,
                vendor_type: values.approval,
                approved_quantity: values.approvedQuantity ?? selectedIndent.quantity,
                // Set planned2 for approved indents (not rejected)
                ...(values.approval !== 'Reject' && { planned2: currentDateTime }),
            });

            toast.success(`Updated approval status of ${selectedIndent.indent_number}`);
            setOpenDialog(false);
            form.reset();
            setSelectedIndent(null);
            fetchData();
        } catch (err) {
            console.error('Error approving indent:', err);
            toast.error('Failed to approve indent');
        }
    }

    const handleBulkSubmit = async () => {
        const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id]);
        if (selectedIds.length === 0) {
            toast.error("Please select items first");
            return;
        }

        setBulkSubmitting(true);
        try {
            const currentDateTime = new Date().toISOString();
            const selectedIndents = pendingData.filter(i => selectedIds.includes(String(i.id)));

            for (const indent of selectedIndents) {
                const qtyToApprove = editedQuantities[indent.id] ?? indent.quantity;
                const status = editedStatuses[indent.id] ?? 'Regular';
                await updateIndentApproval(indent.id, {
                    actual1: currentDateTime,
                    vendor_type: status,
                    approved_quantity: status === 'Reject' ? 0 : qtyToApprove,
                    ...(status !== 'Reject' && { planned2: currentDateTime }),
                });
            }

            toast.success(`Succesfully processed ${selectedIds.length} items`);
            setRowSelection({});
            setEditedStatuses({});
            setEditedQuantities({});
            fetchData();
        } catch (err) {
            console.error('Error in bulk approval:', err);
            toast.error('Failed to process some items');
        } finally {
            setBulkSubmitting(false);
        }
    };

    function onError(e: FieldErrors<z.infer<typeof schema>>) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Department Indent Approval"
                        subtext="Update Indent status to Approve or Reject them"
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <CheckSquare size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={columns}
                            searchFields={['product_name', 'department', 'indenter_name', 'vendor_type', 'firm_name_match', 'area_of_use']}
                            dataLoading={dataLoading}
                            rowSelection={rowSelection}
                            onRowSelectionChange={setRowSelection}
                            getRowId={(row) => String(row.id)}
                            meta={{
                                editedStatuses,
                                editedQuantities,
                                updateStatus: (id: number, val: string) => setEditedStatuses(prev => ({ ...prev, [id]: val })),
                                updateQuantity: (id: number, val: number) => setEditedQuantities(prev => ({ ...prev, [id]: val })),
                            }}
                            extraActions={
                                <div className="flex items-center gap-3">
                                    {user?.indentApprovalAction && Object.keys(rowSelection).length > 0 && (
                                        <div className="flex items-center gap-2 border-r pr-4 mr-2 bg-muted p-1 rounded-md">
                                            <span className="text-sm font-medium whitespace-nowrap">Selected: {Object.keys(rowSelection).length}</span>
                                            <Button
                                                onClick={handleBulkSubmit}
                                                disabled={bulkSubmitting}
                                                size="sm"
                                                className="h-9"
                                            >
                                                {bulkSubmitting ? "Processing..." : "Submit All Selected"}
                                            </Button>
                                        </div>
                                    )}
                                    <Button
                                        variant="default"
                                        onClick={() => handleDownload(pendingData)}
                                        style={{
                                            background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                            border: "none",
                                            borderRadius: "8px",
                                            padding: "0 16px",
                                            fontWeight: "bold",
                                            boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                        }}
                                    >
                                        <DownloadOutlined />
                                        {downloading ? "Downloading..." : "Download"}
                                    </Button>
                                </div>
                            }
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product_name', 'department', 'indenter_name', 'vendor_type', 'firm_name_match', 'area_of_use']}
                            dataLoading={dataLoading}
                            meta={{
                                editingRow,
                                editValues,
                                onInputChange: handleInputChange,
                            }}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
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
                                        <span className="font-medium">
                                            {selectedIndent.indent_number}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-3">
                                    <FormField
                                        control={form.control}
                                        name="approvedQuantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Approved Quantity</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="number" placeholder="Enter quantity to approve" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <DialogFooter className="flex justify-between items-center w-full">
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={handleReject}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            Reject Indent
                                        </Button>
                                    </div>

                                    <div className="flex gap-2">
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
                                    </div>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}