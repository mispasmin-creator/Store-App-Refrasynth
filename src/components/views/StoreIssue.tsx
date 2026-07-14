import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { ClipLoader as Loader } from 'react-spinners';
import { ClipboardList, Trash, Search } from 'lucide-react';
import { uploadFile } from '@/lib/fetchers';
import type { IndentSheet } from '@/types';

import type { IssueSheet } from '@/types';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';

import { fetchIssueRecords, createIssueRecords, type IssueRecord } from '@/services/issueService';
import { fetchInventoryRecords, type InventoryRecord } from '@/services/inventoryService';
import { fetchMasterOptions, type MasterData } from '@/services/masterService';
import { fetchStoreInRecords } from '@/services/storeInService';
import { useAuth } from '@/context/AuthContext';

export default () => {
    const { user } = useAuth();
    const [issueData, setIssueData] = useState<IssueRecord[]>([]);
    const [inventoryData, setInventoryData] = useState<InventoryRecord[]>([]);
    const [options, setOptions] = useState<MasterData | null>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [availableQtyByProduct, setAvailableQtyByProduct] = useState<Map<string, number>>(new Map());

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const [issues, inventory, masterOptions, storeInRecords] = await Promise.all([
                fetchIssueRecords(),
                fetchInventoryRecords(),
                fetchMasterOptions(),
                fetchStoreInRecords(),
            ]);
            setIssueData(issues);
            setInventoryData(inventory);
            setOptions(masterOptions);

            // Available Qty per product: HOD Check history qty (Received only, same
            // logic as the Inventory page's Avil Qty) minus Issue Data history's Given Qty.
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

            for (const i of issues.filter(i => i.planned1 && i.actual1)) {
                const key = (i.product_name || '').trim().toLowerCase();
                qtyByProduct.set(key, (qtyByProduct.get(key) || 0) - (Number(i.given_qty) || 0));
            }

            setAvailableQtyByProduct(qtyByProduct);
        } catch (error) {
            console.error('Error fetching data for StoreIssue:', error);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState('');
    const [searchTermProductName, setSearchTermProductName] = useState('');
    const [searchTermUOM, setSearchTermUOM] = useState('');
    const [searchTermDepartment, setSearchTermDepartment] = useState('');

    const schema = z.object({
        products: z
            .array(
                z.object({
                    department: z.string().nonempty(),
                    groupHead: z.string().nonempty(),
                    productName: z.string().nonempty(),
                    quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
                    uom: z.string().nonempty(),
                    specifications: z.string().optional(),
                    givenQuantity: z.coerce.number().gt(0, 'Must be greater than 0').optional(),
                })
            )
            .min(1, 'At least one product is required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            products: [
                {
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: 1,
                    groupHead: '',
                    department: '',
                },
            ],
        },
    });

    const products = form.watch('products');
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'products',
    });

    async function onSubmit(data: z.infer<typeof schema>) {
        try {
            for (const product of data.products) {
                const key = product.productName.trim().toLowerCase();
                const availableQty = availableQtyByProduct.get(key) ?? 0;
                if (availableQty <= 0) {
                    toast.error(`No stock available for ${product.productName}`);
                    return;
                }
                if (product.quantity > availableQty) {
                    toast.error(`Only ${availableQty} in stock for ${product.productName}`);
                    return;
                }
            }

            const getNextIssueNumber = (existingIssues: IssueRecord[]) => {
                if (!Array.isArray(existingIssues) || existingIssues.length === 0) return 'IS-0001';

                const availableNumbers = existingIssues
                    .filter((issue) => issue.issue_no && typeof issue.issue_no === 'string')
                    .map((issue) => issue.issue_no!)
                    .filter((num) => /^IS-\d+$/.test(num))
                    .map((num) => parseInt(num.split('-')[1], 10));

                if (availableNumbers.length === 0) return 'IS-0001';

                const lastIssueNumber = Math.max(...availableNumbers);
                return `IS-${String(lastIssueNumber + 1).padStart(4, '0')}`;
            };

            const nextIssueNumber = getNextIssueNumber(issueData);

            const rows: Partial<IssueRecord>[] = [];
            for (const product of data.products) {
                const row: Partial<IssueRecord> = {
                    timestamp: new Date().toISOString(),
                    planned1: new Date().toISOString(),
                    issue_no: nextIssueNumber,
                    issue_to: product.specifications || '',
                    uom: product.uom,
                    group_head: product.groupHead,
                    product_name: product.productName,
                    quantity: product.quantity,
                    department: product.department,
                    status: 'Pending'
                };

                rows.push(row);
            }

            await createIssueRecords(rows);
            toast.success('Issue created successfully');
            fetchData(); // Refresh data

            form.reset({
                products: [
                    {
                        uom: '',
                        productName: '',
                        specifications: '',
                        quantity: 1,
                        groupHead: '',
                        department: '',
                    },
                ],
            });
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Error while creating issue! Please try again');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    console.log('Form values:', form.watch());

    return (
        <div>
            <Heading heading="Store Issue" subtext="Create new Issue">
                <ClipboardList size={50} className="text-primary" />
            </Heading>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 p-5">
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const department = products[index]?.department;
                            const groupHead = products[index]?.groupHead;
                            const groupHeadOptions = options?.allGroupHeads || [];
                            const productOptions = options?.products[groupHead] || [];
                            const selectedProductName = products[index]?.productName;
                            const availableQty = selectedProductName
                                ? availableQtyByProduct.get(selectedProductName.trim().toLowerCase()) ?? 0
                                : null;

                            return (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-4 border p-4 rounded-lg"
                                >
                                    <div className="flex justify-between">
                                        <h3 className="text-md font-semibold">Product</h3>
                                    </div>
                                    <div className="grid gap-4">
                                        {/* Increased grid columns to accommodate location */}
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                            {/* Department Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.department`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Category
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select Category" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search departments..."
                                                                        value={searchTerm}
                                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {(options?.departments || [])
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTerm.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Group Head Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.groupHead`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Department
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select Department" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search group heads..."
                                                                        value={searchTermGroupHead}
                                                                        onChange={(e) => setSearchTermGroupHead(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {groupHeadOptions
                                                                    .filter((gh) =>
                                                                        gh.toLowerCase().includes(searchTermGroupHead.toLowerCase())
                                                                    )
                                                                    .map((gh, i) => (
                                                                        <SelectItem key={i} value={gh}>
                                                                            {gh}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Product Name Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.productName`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Product Name
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            disabled={!groupHead}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select product" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search products..."
                                                                        value={searchTermProductName}
                                                                        onChange={(e) => setSearchTermProductName(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {productOptions
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTermProductName.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Quantity Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Quantity
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                {...field}
                                                                disabled={!groupHead}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* UOM Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.uom`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            UOM
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            disabled={!groupHead}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select UOM" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search UOM..."
                                                                        value={searchTermUOM}
                                                                        onChange={(e) => setSearchTermUOM(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {(options?.uoms || [])
                                                                    .filter((uom) =>
                                                                        uom.toLowerCase().includes(searchTermUOM.toLowerCase())
                                                                    )
                                                                    .map((uom, i) => (
                                                                        <SelectItem key={i} value={uom}>
                                                                            {uom}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>

                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {availableQty !== null && (
                                            <p className="text-xs text-muted-foreground -mt-2">
                                                Available Qty for <span className="font-medium text-foreground">{selectedProductName}</span>: <span className="font-semibold text-foreground">{availableQty}</span>
                                            </p>
                                        )}

                                        {/* Second row for Location and other fields if needed */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Specifications Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.specifications`}
                                                render={({ field }) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Remarks</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Enter specifications"
                                                                className="resize-y"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div>
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting && (
                                <Loader size={20} color="white" aria-label="Loading Spinner" />
                            )}
                            Store Issue
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};