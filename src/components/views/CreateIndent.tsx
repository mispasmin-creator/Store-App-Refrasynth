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
import { useState, useEffect } from 'react';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import DataTable from '../element/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import { ClipboardList, Trash, Search, PlusCircle, History } from 'lucide-react';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';

export default () => {
    const { masterSheet: options } = useSheets();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState('');
    const [searchTermProductName, setSearchTermProductName] = useState('');
    const [searchTermUOM, setSearchTermUOM] = useState('');
    const [searchTermFirmName, setSearchTermFirmName] = useState('');

    const [indenterOptions, setIndenterOptions] = useState<string[]>([]);
    const [indenterLoading, setIndenterLoading] = useState(false);
    const [searchTermIndenter, setSearchTermIndenter] = useState('');
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const schema = z.object({
        indenterName: z.string().nonempty(),
        firmName: z.string().nonempty({ message: 'Select Firm Name' }),
        indentStatus: z.enum(['Critical', 'Non-Critical'], {
            required_error: 'Select indent status',
        }),
        products: z
            .array(
                z.object({
                    department: z.string().nonempty(),
                    groupHead: z.string().nonempty(),
                    productName: z.string().nonempty(),
                    quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
                    minStockQty: z.coerce.number().optional(),
                    uom: z.string().nonempty(),
                    areaOfUse: z.string().nonempty(),
                    expectedRequirementDate: z.string().nonempty('Date is required'),
                    attachment: z.instanceof(File).optional(),
                    specifications: z.string().optional(),
                })
            )
            .min(1, 'At least one product is required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            indenterName: '',
            firmName: '',
            indentStatus: undefined,
            products: [
                {
                    attachment: undefined,
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: '' as any,
                    minStockQty: 0,
                    areaOfUse: '',
                    expectedRequirementDate: '',
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

    // Helper: Generate next indent number from Supabase
    const getNextIndentNumber = async (): Promise<string> => {
        try {
            const { data, error } = await supabase
                .from('indent')
                .select('indent_number')
                .order('indent_number', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) return 'SI-0001';

            const lastIndent = data[0].indent_number;
            if (!lastIndent || !/^SI-\d+$/.test(lastIndent)) return 'SI-0001';

            const lastNumber = parseInt(lastIndent.split('-')[1], 10);
            return `SI-${String(lastNumber + 1).padStart(4, '0')}`;
        } catch (error) {
            console.error('Error generating indent number:', error);
            return 'SI-0001';
        }
    };

    // Helper: Upload file to Supabase Storage
    const uploadFileToSupabase = async (file: File, indentNumber: string): Promise<string> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${indentNumber}_${Date.now()}.${fileExt}`;
            const filePath = `indent-attachments/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    };

    async function onSubmit(data: z.infer<typeof schema>) {
        try {
            if (!supabaseEnabled) {
                toast.error('Supabase is not enabled. Please configure Supabase.');
                return;
            }

            // Generate next indent number
            const nextIndentNumber = await getNextIndentNumber();

            // Prepare rows for insertion (with snake_case for database)
            const rows = [];
            for (const product of data.products) {
                let attachmentUrl = '';

                // Upload attachment if exists
                if (product.attachment && product.attachment instanceof File) {
                    try {
                        attachmentUrl = await uploadFileToSupabase(
                            product.attachment,
                            nextIndentNumber
                        );
                    } catch (uploadError) {
                        console.error('File upload failed:', uploadError);
                        toast.warning('Attachment upload failed, continuing without it');
                    }
                }

                // Map to database schema (snake_case)
                const row = {
                    timestamp: new Date().toISOString(),
                    planned1: new Date().toISOString(),
                    indent_number: nextIndentNumber,
                    indenter_name: data.indenterName,
                    department: product.department,
                    area_of_use: product.areaOfUse,
                    group_head: product.groupHead,
                    product_name: product.productName,
                    quantity: product.quantity,
                    min_stock_qty: product.minStockQty || 0,
                    uom: product.uom,
                    firm_name: data.firmName,
                    specifications: product.specifications || '',
                    indent_status: data.indentStatus,
                    expected_req_date: product.expectedRequirementDate,
                    attachment: attachmentUrl,
                    firm_name_match: user?.firmNameMatch || '',
                    status: 'Pending',
                };

                rows.push(row);
            }

            // Insert into Supabase
            const { error } = await supabase.from('indent').insert(rows);

            if (error) throw error;

            toast.success(`Indent ${nextIndentNumber} created successfully!`);

            // Reset form
            form.reset({
                indenterName: '',
                firmName: '',
                indentStatus: '' as any,
                products: [
                    {
                        attachment: undefined,
                        uom: '',
                        productName: '',
                        specifications: '',
                        quantity: '' as any,
                        minStockQty: 0,
                        areaOfUse: '',
                        expectedRequirementDate: '',
                        groupHead: '',
                        department: '',
                    },
                ],
            });
            setIndenterOptions([]);
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Error while creating indent! Please try again');
        }
    }

    const fetchHistory = async () => {
        if (!supabaseEnabled) return;
        setHistoryLoading(true);
        try {
            let query = supabase
                .from('indent')
                .select('*')
                .order('timestamp', { ascending: false });

            if (user?.firmNameMatch && user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name_match', user.firmNameMatch);
            }

            const { data, error } = await query;

            if (error) throw error;
            setHistoryData(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error('Failed to fetch indent history');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user?.firmNameMatch]);

    const historyColumns: ColumnDef<any>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ getValue }) => formatDate(new Date(getValue() as string)),
        },
        {
            accessorKey: 'indent_number',
            header: 'Indent No',
        },
        {
            accessorKey: 'indenter_name',
            header: 'Indenter',
        },
        {
            accessorKey: 'firm_name',
            header: 'Firm Name',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'product_name',
            header: 'Product',
        },
        {
            accessorKey: 'quantity',
            header: 'Qty',
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
        },
        {
            accessorKey: 'indent_status',
            header: 'Status',
        },
        {
            accessorKey: 'status',
            header: 'Process Status',
        },
    ];

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Tabs defaultValue="pending" onValueChange={(val) => val === 'history' && fetchHistory()}>
                <Heading heading="Create Indent" subtext="Create new Indent" tabs pendingCount={0} historyCount={historyData.length} pendingTabName="Create">
                    <PlusCircle size={50} className="text-primary" />
                </Heading>

                <TabsContent value="pending">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 p-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <FormField
                                    control={form.control}
                                    name="firmName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Firm Name
                                                <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <Select
                                                onValueChange={async (val) => {
                                                    field.onChange(val);
                                                    form.setValue('indenterName', '');
                                                    setIndenterOptions([]);
                                                    setIndenterLoading(true);
                                                    try {
                                                        const { data, error } = await supabase
                                                            .from('master')
                                                            .select('indenter_name')
                                                            .eq('firm_name', val);

                                                        if (!error && data) {
                                                            // Deduplicate indenter names
                                                            const unique = Array.from(
                                                                new Set(
                                                                    data
                                                                        .map((r: any) => r.indenter_name)
                                                                        .filter(Boolean)
                                                                )
                                                            ) as string[];
                                                            setIndenterOptions(unique);
                                                            if (unique.length === 1) {
                                                                form.setValue('indenterName', unique[0]);
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error('Error fetching indenter names:', err);
                                                    } finally {
                                                        setIndenterLoading(false);
                                                    }
                                                }}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select Firm Name" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <div className="flex items-center border-b px-3 pb-3">
                                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                        <input
                                                            placeholder="Search Firm Name..."
                                                            value={searchTermFirmName}
                                                            onChange={(e) => setSearchTermFirmName(e.target.value)}
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                            className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                        />
                                                    </div>
                                                    {(options?.firms || [])
                                                        .filter((firm) =>
                                                            firm
                                                                .toLowerCase()
                                                                .includes(searchTermFirmName.toLowerCase())
                                                        )
                                                        .map((firm, i) => (
                                                            <SelectItem key={i} value={firm}>
                                                                {firm}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="indenterName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Indenter Name
                                                <span className="text-destructive">*</span>
                                            </FormLabel>
                                            {indenterLoading ? (
                                                <div className="flex items-center h-10 px-3 border rounded-md text-sm text-muted-foreground gap-2">
                                                    <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                    </svg>
                                                    Fetching indenters...
                                                </div>
                                            ) : indenterOptions.length > 1 ? (
                                                // Multiple indenters → show dropdown
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select Indenter Name" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <div className="flex items-center border-b px-3 pb-3">
                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                            <input
                                                                placeholder="Search indenter..."
                                                                value={searchTermIndenter}
                                                                onChange={(e) => setSearchTermIndenter(e.target.value)}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                            />
                                                        </div>
                                                        {indenterOptions
                                                            .filter((name) =>
                                                                name.toLowerCase().includes(searchTermIndenter.toLowerCase())
                                                            )
                                                            .map((name, i) => (
                                                                <SelectItem key={i} value={name}>
                                                                    {name}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                // Single or no indenter → auto-filled read-only input
                                                <FormControl>
                                                    <Input
                                                        placeholder={indenterOptions.length === 0 ? 'Select a Firm Name first' : 'Indenter name (auto-filled)'}
                                                        readOnly={indenterOptions.length === 1}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="indentStatus"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Indent Status
                                                <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                <FormControl>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Critical">Critical</SelectItem>
                                                    <SelectItem value="Non-Critical">
                                                        Non-Critical
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-semibold">Products</h2>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            append({
                                                department: '',
                                                groupHead: '',
                                                productName: '',
                                                quantity: '' as any,
                                                minStockQty: 0,
                                                uom: '',
                                                areaOfUse: '',
                                                expectedRequirementDate: '',
                                                attachment: undefined,
                                                specifications: '',
                                            })
                                        }
                                    >
                                        Add Product
                                    </Button>
                                </div>

                                {fields.map((field, index) => {
                                    const currentDept = products[index]?.department;
                                    const currentGroupHead = products[index]?.groupHead;
                                    const groupHeadOptions = options?.allGroupHeads || [];
                                    const productOptions = options?.products[currentGroupHead] || [];

                                    return (
                                        <div
                                            key={field.id}
                                            className="flex flex-col gap-4 border p-4 rounded-lg"
                                        >
                                            <div className="flex justify-between">
                                                <h3 className="text-md font-semibold">
                                                    Product {index + 1}
                                                </h3>
                                                <Button
                                                    variant="destructive"
                                                    type="button"
                                                    onClick={() => fields.length > 1 && remove(index)}
                                                    disabled={fields.length === 1}
                                                >
                                                    <Trash />
                                                </Button>
                                            </div>
                                            <div className="grid gap-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.department`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Category
                                                                    <span className="text-destructive">
                                                                        *
                                                                    </span>
                                                                </FormLabel>
                                                                <Select
                                                                    onValueChange={(val) => {
                                                                        field.onChange(val);
                                                                    }}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue placeholder="Select department" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <div className="flex items-center border-b px-3 pb-3">
                                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                            <input
                                                                                placeholder="Search locations..."
                                                                                value={searchTerm}
                                                                                onChange={(e) =>
                                                                                    setSearchTerm(
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                onKeyDown={(e) =>
                                                                                    e.stopPropagation()
                                                                                }
                                                                                className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                            />
                                                                        </div>
                                                                        {(options?.departments || [])
                                                                            .filter((dep) =>
                                                                                dep
                                                                                    .toLowerCase()
                                                                                    .includes(
                                                                                        searchTerm.toLowerCase()
                                                                                    )
                                                                            )
                                                                            .map((dep, i) => (
                                                                                <SelectItem
                                                                                    key={i}
                                                                                    value={dep}
                                                                                >
                                                                                    {dep}
                                                                                </SelectItem>
                                                                            ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.groupHead`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Department
                                                                    <span className="text-destructive">
                                                                        *
                                                                    </span>
                                                                </FormLabel>
                                                                <Select
                                                                    onValueChange={(val) => {
                                                                        field.onChange(val);
                                                                    }}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue placeholder="Select group head" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <div className="flex items-center border-b px-3 pb-3">
                                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                            <input
                                                                                placeholder="Search group heads..."
                                                                                value={searchTermGroupHead}
                                                                                onChange={(e) =>
                                                                                    setSearchTermGroupHead(
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                onKeyDown={(e) =>
                                                                                    e.stopPropagation()
                                                                                }
                                                                                className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                            />
                                                                        </div>
                                                                        {groupHeadOptions
                                                                            .filter((gh) =>
                                                                                gh
                                                                                    .toLowerCase()
                                                                                    .includes(
                                                                                        searchTermGroupHead.toLowerCase()
                                                                                    )
                                                                            )
                                                                            .map((gh, i) => (
                                                                                <SelectItem
                                                                                    key={i}
                                                                                    value={gh}
                                                                                >
                                                                                    {gh}
                                                                                </SelectItem>
                                                                            ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.areaOfUse`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Area Of Use
                                                                    <span className="text-destructive">
                                                                        *
                                                                    </span>
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="Enter area of use"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.productName`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Product Name
                                                                    <span className="text-destructive">
                                                                        *
                                                                    </span>
                                                                </FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value}
                                                                    disabled={!currentGroupHead}
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
                                                                                value={
                                                                                    searchTermProductName
                                                                                }
                                                                                onChange={(e) =>
                                                                                    setSearchTermProductName(
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                onKeyDown={(e) =>
                                                                                    e.stopPropagation()
                                                                                }
                                                                                className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                            />
                                                                        </div>
                                                                        {productOptions
                                                                            .filter((prod: string) =>
                                                                                prod
                                                                                    .toLowerCase()
                                                                                    .includes(
                                                                                        searchTermProductName.toLowerCase()
                                                                                    )
                                                                            )
                                                                            .map((prod: string, i: number) => (
                                                                                <SelectItem
                                                                                    key={i}
                                                                                    value={prod}
                                                                                >
                                                                                    {prod}
                                                                                </SelectItem>
                                                                            ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Quantity
                                                                    <span className="text-destructive">
                                                                        *
                                                                    </span>
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        disabled={!currentGroupHead}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.minStockQty`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Current Stock Qty
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        placeholder="Enter min stock qty"
                                                                        disabled={!currentGroupHead}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.uom`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    UOM
                                                                    <span className="text-destructive">
                                                                        *
                                                                    </span>
                                                                </FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value}
                                                                    disabled={!currentGroupHead}
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
                                                                                uom
                                                                                    .toLowerCase()
                                                                                    .includes(searchTermUOM.toLowerCase())
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
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.expectedRequirementDate`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>
                                                                    Expected Requirement Date
                                                                    <span className="text-destructive">
                                                                        *
                                                                    </span>
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="date"
                                                                        {...field}
                                                                        disabled={!currentGroupHead}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.attachment`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Attachment</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="file"
                                                                    onChange={(e) =>
                                                                        field.onChange(e.target.files?.[0])
                                                                    }
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.specifications`}
                                                    render={({ field }) => (
                                                        <FormItem className="w-full">
                                                            <FormLabel>Specifications</FormLabel>
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
                                    Create Indent
                                </Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>

                <TabsContent value="history">
                    <DataTable
                        data={historyData}
                        columns={historyColumns}
                        dataLoading={historyLoading}
                        searchFields={['indent_number', 'product_name', 'indenter_name', 'firm_name']}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};