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
import { fetchMasterRecords } from '@/services/masterService';
import { issuedStockByProduct, stockProductKey } from '@/lib/issueStock';

interface InventoryRecord {
    itemName: string;
    department: string;
    groupMaster: string;
    uom: string;
    loc: string;
    rate: number;
    current: number;
    indentedQty: number;
    issuedQty: number;
    minStock: number;
    totalPrice: number;
    firmName: string;
}

const minQtyReqSchema = z.object({
    itemName: z.string().nonempty('Select a product'),
    uom: z.string().optional(),
    minQtyReq: z.coerce.number().gt(0, 'Must be greater than 0'),
});

async function fetchInventoryIndents() {
    const rows: { product_name: string; uom: string; quantity: string | number | null }[] = [];
    for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('indent')
            .select('product_name, uom, quantity').order('id').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) return rows;
    }
}

export default function Inventory() {
    const [tableData, setTableData] = useState<InventoryRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedFirm, setSelectedFirm] = useState<string>('');
    const [openDialog, setOpenDialog] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const minQtyForm = useForm<z.infer<typeof minQtyReqSchema>>({
        resolver: zodResolver(minQtyReqSchema),
        defaultValues: { itemName: '', uom: '', minQtyReq: 0 },
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
            const [records, issueRecords, masterRows, indentRows, inventoryResult] = await Promise.all([
                fetchStoreInRecords(),
                fetchIssueRecords(),
                fetchMasterRecords(),
                fetchInventoryIndents(),
                supabase.from('inventory').select('item_name, min_qty_req'),
            ]);
            if (inventoryResult.error) throw inventoryResult.error;
            const invRows = inventoryResult.data;

            // Item-level metadata isn't stored on store_in rows — look it up by product/item name.
            // Department is shown from the master table's group_name column,
            // Group Master is shown from the master table's department column,
            // UOM is shown from the indent table's uom column,
            // Min Qty Req is shown from the inventory table's min_qty_req column.
            const departmentByName = new Map<string, string>();
            const groupMasterByName = new Map<string, string>();
            const masterUomByName = new Map<string, string>();
            for (const m of masterRows || []) {
                const key = (m.item_name || '').trim().toLowerCase();
                if (key && !departmentByName.has(key)) {
                    departmentByName.set(key, m.group_name || '');
                    groupMasterByName.set(key, m.department || '');
                    masterUomByName.set(key, m.uom || '');
                }
            }

            const uomByName = new Map<string, string>();
            const indentedQtyByProduct = new Map<string, number>();
            for (const i of indentRows || []) {
                const productKey = stockProductKey(i.product_name || '');
                const quantity = Number(i.quantity);
                if (productKey && Number.isFinite(quantity) && quantity > 0) {
                    indentedQtyByProduct.set(productKey, (indentedQtyByProduct.get(productKey) || 0) + quantity);
                }
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
            // Only actual receipt history creates stock rows. Master supplies metadata.
            for (const r of historyRecords) {
                const key = `stock||${stockProductKey(r.productName || '')}`;
                if (!grouped.has(key)) {
                    const nameKey = (r.productName || '').trim().toLowerCase();
                    grouped.set(key, {
                        itemName: r.productName || '',
                        department: departmentByName.get(nameKey) || '',
                        groupMaster: groupMasterByName.get(nameKey) || '',
                        uom: masterUomByName.get(nameKey) || uomByName.get(nameKey) || r.uom || '',
                        loc: r.location || '',
                        rate: Number(r.priceAsPerPo) || 0,
                        current: 0,
                        indentedQty: indentedQtyByProduct.get(stockProductKey(r.productName || '')) || 0,
                        issuedQty: 0,
                        minStock: minQtyByName.get(nameKey) || 0,
                        totalPrice: 0,
                        firmName: r.firmNameMatch || '',
                    });
                }

                const row = grouped.get(key)!;
                if (row.firmName !== (r.firmNameMatch || '')) row.firmName = 'Shared stock';
                row.current += Number(r.qty) || 0;
                row.totalPrice = row.current * row.rate;
            }

            const issuedQtyByProduct = issuedStockByProduct(issueRecords);

            for (const row of grouped.values()) {
                const issuedQty = issuedQtyByProduct.get(stockProductKey(row.itemName)) || 0;
                row.issuedQty = issuedQty;
                row.current -= issuedQty;
                row.totalPrice = row.current * row.rate;
            }

            setTableData(Array.from(grouped.values()));
        } catch (error) {
            console.error('Error fetching inventory:', error);
            toast.error('Inventory could not load. Please refresh and try again.');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const refresh = () => { void fetchData(); };
        window.addEventListener('focus', refresh);
        const timer = window.setInterval(refresh, 30000);
        return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
    }, []);

    // Distinct firm names from fetched data
    const firmNames = useMemo(
        () => Array.from(new Set(tableData.map(r => r.firmName).filter(Boolean))).sort(),
        [tableData]
    );

    // Filtered data based on selected firm
    const filteredData = useMemo(() => {
        const allFirms = !selectedFirm || selectedFirm === '__all__';
        return tableData.filter(row => allFirms || row.firmName === selectedFirm)
            .sort((a, b) => a.itemName.localeCompare(b.itemName));
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
            minQtyForm.reset({ itemName: '', uom: '', minQtyReq: 0 });
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
        { accessorKey: 'groupMaster', header: 'Department' },
        { accessorKey: 'indentedQty', header: 'Total Indented Qty' },
        { accessorKey: 'issuedQty', header: 'Total Issued Qty' },
        { accessorKey: 'department', header: 'Group' },
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
                searchFields={['itemName', 'department', 'groupMaster', 'uom', 'loc']}
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
