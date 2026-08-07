import Heading from '../element/Heading';

import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Database, MoreHorizontal, Pencil, Plus, Trash } from 'lucide-react';
import DataTable from '../element/DataTable';
import { supabase } from '@/lib/supabase';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';

interface MasterRecord {
    id: number;
    itemName: string;
    uom: string;
    department: string;
    groupHead: string;
    category: string;
    areaOfUse: string;
    location: string;
    vendorName: string;
    firmName: string;
    companyName: string;
}

const schema = z.object({
    itemName: z.string().min(1, 'Item name is required'),
    uom: z.string().optional(),
    department: z.string().optional(),
    groupHead: z.string().optional(),
    category: z.string().optional(),
    areaOfUse: z.string().optional(),
    location: z.string().optional(),
    vendorName: z.string().optional(),
    firmName: z.string().optional(),
    companyName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
    itemName: '',
    uom: '',
    department: '',
    groupHead: '',
    category: '',
    areaOfUse: '',
    location: '',
    vendorName: '',
    firmName: '',
    companyName: '',
};

export default () => {
    const [tableData, setTableData] = useState<MasterRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<MasterRecord | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
    });

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const { data, error } = await supabase
                .from('master')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            setTableData(
                (data || []).map((r: any) => ({
                    id: r.id,
                    itemName: r.item_name || '',
                    uom: r.uom || '',
                    department: r.department || '',
                    groupHead: r.group_name || '',
                    category: r.category || '',
                    areaOfUse: r.area_of_use || '',
                    location: r.where || '',
                    vendorName: r.vendor_name || '',
                    firmName: r.firm_name || '',
                    companyName: r.company_name || '',
                }))
            );
        } catch (error) {
            console.error('Error fetching master data:', error);
            toast.error('Failed to load master data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!openDialog) {
            setSelectedRecord(null);
            return;
        }
        if (selectedRecord) {
            form.reset({
                itemName: selectedRecord.itemName,
                uom: selectedRecord.uom,
                department: selectedRecord.department,
                groupHead: selectedRecord.groupHead,
                category: selectedRecord.category,
                areaOfUse: selectedRecord.areaOfUse,
                location: selectedRecord.location,
                vendorName: selectedRecord.vendorName,
                firmName: selectedRecord.firmName,
                companyName: selectedRecord.companyName,
            });
        } else {
            form.reset(emptyValues);
        }
    }, [openDialog, selectedRecord]);

    async function onSubmit(values: FormValues) {
        const duplicate = tableData.some(
            (r) =>
                r.itemName.trim().toLowerCase() === values.itemName.trim().toLowerCase() &&
                r.id !== selectedRecord?.id
        );
        if (duplicate) {
            toast.error('An item with this name already exists');
            return;
        }

        const dbRow = {
            item_name: values.itemName,
            uom: values.uom || '',
            department: values.department || '',
            group_name: values.groupHead || '',
            category: values.category || '',
            area_of_use: values.areaOfUse || '',
            where: values.location || '',
            vendor_name: values.vendorName || '',
            firm_name: values.firmName || '',
            company_name: values.companyName || '',
        };

        try {
            if (selectedRecord) {
                const { error } = await supabase
                    .from('master')
                    .update(dbRow)
                    .eq('id', selectedRecord.id);
                if (error) throw error;
                toast.success('Updated master item');
            } else {
                const { error } = await supabase.from('master').insert([dbRow]);
                if (error) throw error;
                toast.success('Added master item');
            }
            setOpenDialog(false);
            fetchData();
        } catch (error) {
            console.error('Error saving master item:', error);
            toast.error('Failed to save master item');
        }
    }

    async function handleDelete(record: MasterRecord) {
        if (!confirm(`Are you sure you want to delete "${record.itemName}"?`)) return;
        try {
            const { error } = await supabase.from('master').delete().eq('id', record.id);
            if (error) throw error;
            toast.success('Deleted master item');
            fetchData();
        } catch (error) {
            console.error('Error deleting master item:', error);
            toast.error('Failed to delete master item');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    const columns: ColumnDef<MasterRecord>[] = [
        {
            id: 'srNo',
            header: 'SR no.',
            cell: ({ row }) => <>{row.index + 1}</>,
        },
        {
            accessorKey: 'itemName',
            header: 'Item Name',
            cell: ({ row }) => (
                <div className="text-wrap max-w-52 text-center">{row.original.itemName}</div>
            ),
        },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'groupHead', header: 'Group' },
        { accessorKey: 'category', header: 'Category' },
        { accessorKey: 'areaOfUse', header: 'Area of Use' },
        { accessorKey: 'location', header: 'Location' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'firmName', header: 'Firm Name' },
        { accessorKey: 'companyName', header: 'Company Name' },
        {
            id: 'actions',
            cell: ({ row }) => {
                const record = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => {
                                    setSelectedRecord(record);
                                    setOpenDialog(true);
                                }}
                            >
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(record)}>
                                <Trash className="h-4 w-4 mr-2 text-destructive" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <div className="h-full">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Heading heading="Master" subtext="View and manage master data">
                    <Database size={50} className="text-primary" />
                </Heading>

                <DataTable
                    data={tableData}
                    columns={columns}
                    dataLoading={dataLoading}
                    searchFields={['itemName', 'department', 'groupHead', 'category', 'vendorName', 'firmName']}
                    className="h-[calc(100dvh-180px)] overflow-hidden"
                    extraActions={
                        <Button
                            onClick={() => {
                                setSelectedRecord(null);
                                setOpenDialog(true);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add New Item
                        </Button>
                    }
                />

                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="grid gap-5">
                            <DialogHeader>
                                <DialogTitle>{selectedRecord ? 'Edit' : 'Add'} Master Item</DialogTitle>
                            </DialogHeader>

                            <div className="grid md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="itemName"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>
                                                Item Name<span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter item name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="uom"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>UOM</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. PCS" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="department"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Department</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. MECHANICAL" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="groupHead"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Group</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. BEARING" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Category</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Others" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="areaOfUse"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Area of Use</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. RT-29" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="location"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Location</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Storage location" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vendorName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Vendor Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Vendor name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="firmName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Firm Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Firm name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Company name" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline" type="button">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting && (
                                        <Loader size={16} color="white" className="mr-2" />
                                    )}
                                    {selectedRecord ? 'Save' : 'Add'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
