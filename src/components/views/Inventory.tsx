import Heading from '../element/Heading';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Store } from 'lucide-react';
import DataTable from '../element/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import {
    Dialog,
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
import { toast } from 'sonner';

import { fetchStoreInRecords } from '@/services/storeInService';
import { fetchIssueRecords } from '@/services/issueService';
import { supabase } from '@/lib/supabase';

interface InventoryRecord {
    itemName: string;
    department: string;
    groupMaster: string;
    uom: string;
    loc: string;
    rate: number;
    current: number;
    minStock: number;
    totalPrice: number;
    firmName: string;
}

const minQtyReqSchema = z.object({
    itemName: z.string().nonempty('Select a product'),
    uom: z.string().optional(),
    minQtyReq: z.coerce.number().gt(0, 'Must be greater than 0'),
});

export default () => {
    const [tableData, setTableData] = useState<InventoryRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedFirm, setSelectedFirm] = useState<string>('');
    const [openDialog, setOpenDialog] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const minQtyForm = useForm<z.infer<typeof minQtyReqSchema>>({
        resolver: zodResolver(minQtyReqSchema),
        defaultValues: { itemName: '', uom: '', minQtyReq: '' as any },
    });

    // Same rows as the HOD Check page's history tab: latest record per
    // indent+product, kept only once it has been through HOD check (actual6 set).
    // Avil Qty is the sum of the Qty column across those history rows per item,
    // skipping rows whose Rec. Status is Rejected (Not Received) — only Received counts.
    // Then the Issue Data page's history (Given Qty, matched by product name) is
    // subtracted, since that quantity has already gone out of stock.
    const fetchData = async () => {
        try {
            setDataLoading(true);
            const [records, issueRecords, { data: masterRows }, { data: indentRows }, { data: invRows }] = await Promise.all([
                fetchStoreInRecords(),
                fetchIssueRecords(),
                supabase.from('master').select('item_name, group_head, group_master'),
                supabase.from('indent').select('product_name, uom'),
                supabase.from('inventory').select('item_name, min_qty_req'),
            ]);

            // Item-level metadata isn't stored on store_in rows — look it up by product/item name.
            // Department is shown from the master table's group_head column,
            // Group Master is shown from the master table's group_master column,
            // UOM is shown from the indent table's uom column,
            // Min Qty Req is shown from the inventory table's min_qty_req column.
            const departmentByName = new Map<string, string>();
            const groupMasterByName = new Map<string, string>();
            for (const m of masterRows || []) {
                const key = (m.item_name || '').trim().toLowerCase();
                if (key && !departmentByName.has(key)) {
                    departmentByName.set(key, m.group_head || '');
                    groupMasterByName.set(key, m.group_master || '');
                }
            }

            const uomByName = new Map<string, string>();
            for (const i of indentRows || []) {
                const key = (i.product_name || '').trim().toLowerCase();
                if (key && !uomByName.has(key)) {
                    uomByName.set(key, i.uom || '');
                }
            }

            const minQtyByName = new Map<string, number>();
            for (const inv of invRows || []) {
                const key = (inv.item_name || '').trim().toLowerCase();
                if (key && !minQtyByName.has(key)) {
                    minQtyByName.set(key, Number(inv.min_qty_req) || 0);
                }
            }

            const latestRecords: typeof records = [];
            const seen = new Set<string>();
            for (const item of records) {
                const key = `${item.indentNo}-${item.productName}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    latestRecords.push(item);
                }
            }

            const historyRecords = latestRecords.filter(
                r => r.actual6 !== '' && r.receivingStatus !== 'Not Received'
            );

            const grouped = new Map<string, InventoryRecord>();
            for (const r of historyRecords) {
                const key = `${r.firmNameMatch || ''}||${r.productName || ''}`;
                if (!grouped.has(key)) {
                    const nameKey = (r.productName || '').trim().toLowerCase();
                    grouped.set(key, {
                        itemName: r.productName || '',
                        department: departmentByName.get(nameKey) || '',
                        groupMaster: groupMasterByName.get(nameKey) || '',
                        uom: uomByName.get(nameKey) || r.uom || '',
                        loc: r.location || '',
                        rate: Number(r.priceAsPerPo) || 0,
                        current: 0,
                        minStock: minQtyByName.get(nameKey) || 0,
                        totalPrice: 0,
                        firmName: r.firmNameMatch || '',
                    });
                }

                const row = grouped.get(key)!;
                row.current += Number(r.qty) || 0;
                row.totalPrice = row.current * row.rate;
            }

            // Issue Data history: records that have been actioned (planned1 && actual1)
            const issuedQtyByProduct = new Map<string, number>();
            for (const i of issueRecords.filter(i => i.planned1 && i.actual1)) {
                const key = `${i.firm_name_match || ''}||${i.product_name || ''}`;
                issuedQtyByProduct.set(key, (issuedQtyByProduct.get(key) || 0) + (Number(i.given_qty) || 0));
            }

            for (const [key, row] of grouped) {
                const issuedQty = issuedQtyByProduct.get(key) || 0;
                row.current -= issuedQty;
                row.totalPrice = row.current * row.rate;
            }

            setTableData(Array.from(grouped.values()));
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Distinct firm names from fetched data
    const firmNames = useMemo(
        () => Array.from(new Set(tableData.map(r => r.firmName).filter(Boolean))).sort(),
        [tableData]
    );

    // Filtered data based on selected firm
    const filteredData = useMemo(() => {
        if (!selectedFirm || selectedFirm === '__all__') return tableData;
        return tableData.filter(r => r.firmName === selectedFirm);
    }, [tableData, selectedFirm]);

    // Distinct item names currently shown in Inventory — used as options for the
    // "Add Min Qty Req" dialog so the value gets matched by the right product name
    const itemOptions = useMemo(
        () => Array.from(new Set(tableData.map(r => r.itemName).filter(Boolean))).sort(),
        [tableData]
    );

    async function onSubmitMinQtyReq(values: z.infer<typeof minQtyReqSchema>) {
        setIsSubmitting(true);
        try {
            const { data: existing, error: fetchError } = await supabase
                .from('inventory')
                .select('id')
                .eq('item_name', values.itemName)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existing) {
                const { error } = await supabase
                    .from('inventory')
                    .update({ uom: values.uom || '', min_qty_req: String(values.minQtyReq) })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('inventory')
                    .insert({
                        item_name: values.itemName,
                        uom: values.uom || '',
                        min_qty_req: String(values.minQtyReq),
                    });
                if (error) throw error;
            }

            toast.success(`Min Qty Req updated for ${values.itemName}`);
            setOpenDialog(false);
            minQtyForm.reset({ itemName: '', uom: '', minQtyReq: '' as any });
            fetchData();
        } catch (error) {
            console.error('Error saving min qty req:', error);
            toast.error('Failed to save Min Qty Req');
        } finally {
            setIsSubmitting(false);
        }
    }

    const columns: ColumnDef<InventoryRecord>[] = [
        {
            id: 'srNo',
            header: 'SR no.',
            cell: ({ row }) => <>{row.index + 1}</>,
        },
        {
            accessorKey: 'itemName',
            header: 'Item Name',
            cell: ({ row }) => {
                return (
                    <div className="text-wrap max-w-40 text-center">{row.original.itemName}</div>
                );
            },
        },
        {
            id: 'description',
            header: 'Description',
            cell: () => <></>,
        },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'loc', header: 'LOC' },
        { accessorKey: 'groupMaster', header: 'Group Master' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'current',
            header: 'Avil Qty',
            cell: ({ row }) => {
                const isLow = row.original.current <= row.original.minStock;
                return (
                    <div
                        className={`-m-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] flex items-center justify-center font-extrabold tracking-wide ${
                            isLow
                                ? 'bg-red-500/40 text-red-900'
                                : 'bg-green-500/40 text-green-900'
                        }`}
                    >
                        {row.original.current}
                    </div>
                );
            },
        },
        { accessorKey: 'minStock', header: 'Min Qty Req' },
        {
            accessorKey: 'rate',
            header: 'Basic Price',
            cell: ({ row }) => {
                return <>&#8377;{row.original.rate}</>;
            },
        },
        {
            id: 'minStkValue',
            header: 'Min Stk Value',
            cell: ({ row }) => {
                return <>&#8377;{row.original.minStock * row.original.rate}</>;
            },
        },
        {
            accessorKey: 'totalPrice',
            header: 'Avail Stk Value',
            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPrice}</>;
            },
        },
    ];

    // Firm filter + Add Min Qty Req button — passed as extraActions so they sit top-right
    const extraActions = (
        <>
            {firmNames.length > 0 && (
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                    <SelectTrigger className="w-48 shrink-0">
                        <SelectValue placeholder="Firm Name" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {firmNames.map(firm => (
                            <SelectItem key={firm} value={firm}>
                                {firm}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <Button
                type="button"
                onClick={() => setOpenDialog(true)}
            >
                <Plus className="h-4 w-4 mr-1" />
                Add Min Qty Req
            </Button>
        </>
    );

    return (
        <div>
            <Heading heading="Inventory" subtext="View inventory">
                <Store size={50} className="text-primary" />
            </Heading>

            <DataTable
                data={filteredData}
                columns={columns}
                dataLoading={dataLoading}
                searchFields={['itemName', 'department', 'uom', 'status']}
                className="h-[80dvh]"
                extraActions={extraActions}
            />

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent>
                    <Form {...minQtyForm}>
                        <form onSubmit={minQtyForm.handleSubmit(onSubmitMinQtyReq)} className="grid gap-4">
                            <DialogHeader>
                                <DialogTitle>Add Min Qty Req</DialogTitle>
                            </DialogHeader>

                            <FormField
                                control={minQtyForm.control}
                                name="itemName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Product Name
                                            <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                const matched = tableData.find(r => r.itemName === val);
                                                minQtyForm.setValue('uom', matched?.uom || '');
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select product" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {itemOptions.map((name, i) => (
                                                    <SelectItem key={i} value={name}>
                                                        {name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={minQtyForm.control}
                                name="uom"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>UOM</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Auto-filled from product" {...field} readOnly />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={minQtyForm.control}
                                name="minQtyReq"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Min Qty Req
                                            <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
