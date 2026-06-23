import { useRef, useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Truck, ExternalLink } from 'lucide-react';
import Heading from '../element/Heading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { fetchFullkittingRecords, updateFullkittingRecord, uploadBiltyImage, createFreightPaymentEntry, type FullkittingRecord } from '@/services/fullkittingService';
import { useSheets } from '@/context/SheetsContext';
import { formatDateTime, parseCustomDate } from '@/lib/utils';

// Helper function to format date as "YYYY-MM-DD"
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function FullKiting() {
    const { user } = useAuth();
    const { storeInSheet, updateAll } = useSheets();
    const [pendingData, setPendingData] = useState<FullkittingRecord[]>([]);
    const [historyData, setHistoryData] = useState<FullkittingRecord[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<FullkittingRecord | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const data = await fetchFullkittingRecords();

            // Filter by firm name match
            const filteredData = data.filter(item =>
                user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
            );

            // Pending: has planned but no actual
            setPendingData(filteredData.filter(i => i.planned && !i.actual));

            // History: has both planned and actual
            setHistoryData(filteredData.filter(i => i.planned && i.actual));
        } catch (error) {
            console.error('Error fetching fullkitting data:', error);
            toast.error('Failed to fetch data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    const columns: ColumnDef<FullkittingRecord>[] = [
        {
            header: 'Action',
            cell: ({ row }: { row: Row<FullkittingRecord> }) => {
                const item = row.original;
                return (
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedIndent(item);
                                setOpenDialog(true);
                            }}
                        >
                            Update
                        </Button>
                    </DialogTrigger>
                );
            },
        },
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        { accessorKey: 'indentNumber', header: 'Indent Number' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        {
            accessorKey: 'planned',
            header: 'Planned Date',
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div className={`${!plannedDate ? 'text-muted-foreground italic' : ''}`}>
                        {plannedDate ? formatDateTime(parseCustomDate(plannedDate)) : 'Not Set'}
                    </div>
                );
            }
        },
        { accessorKey: 'transportingInclude', header: 'Transportation Include' },
        { accessorKey: 'transporterName', header: 'Transporter Name' },
        { accessorKey: 'amount', header: 'Amount' },
    ];

    const historyColumns: ColumnDef<FullkittingRecord>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        { accessorKey: 'indentNumber', header: 'Indent Number' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'actual', header: 'Actual Date', cell: ({ getValue }) => getValue() ? formatDateTime(parseCustomDate(getValue() as string)) : '-' },
        { accessorKey: 'vehicleNumber', header: 'Vehicle Number' },
        { accessorKey: 'biltyNumber', header: 'Bilty Number' },
        { accessorKey: 'amount1', header: 'Freight Amount' },
        {
            accessorKey: 'biltyImage',
            header: 'Bilty Image',
            cell: ({ getValue }) => {
                const url = getValue() as string;
                return url ? (
                    <Button variant="ghost" size="sm" onClick={() => window.open(url, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-1" /> View
                    </Button>
                ) : '-';
            }
        }
    ];

    const schema = z.object({
        vehicleNumber: z.string().min(1, 'Vehicle Number is required'),
        from: z.string().min(1, 'From is required'),
        to: z.string().min(1, 'To is required'),
        materialLoadDetails: z.string().optional(),
        biltyNumber: z.string().min(1, 'Bilty Number is required'),
        rateType: z.enum(['Fixed', 'Per MT'], { required_error: 'Rate Type is required' }),
        amount: z.string().min(1, 'Amount is required'),
        biltyImage: z.instanceof(File).optional(),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            vehicleNumber: '',
            from: '',
            to: '',
            materialLoadDetails: '',
            biltyNumber: '',
            rateType: undefined as unknown as "Fixed" | "Per MT",
            amount: '',
            biltyImage: undefined,
        },
    });

    useEffect(() => {
        if (openDialog && selectedIndent) {
            form.reset({
                vehicleNumber: '',
                from: '',
                to: '',
                materialLoadDetails: '',
                biltyNumber: '',
                rateType: undefined,
                amount: selectedIndent.amount?.toString() || '',
                biltyImage: undefined,
            });
        } else if (!openDialog) {
            form.reset({
                vehicleNumber: '',
                from: '',
                to: '',
                materialLoadDetails: '',
                biltyNumber: '',
                rateType: undefined,
                amount: '',
                biltyImage: undefined,
            });
        }
    }, [openDialog, selectedIndent, form]);
    // Actually form.reset is stable.

    async function onSubmit(values: z.infer<typeof schema>) {
        if (!selectedIndent) return;

        try {
            setIsSubmitting(true);
            const currentDateTime = new Date().toISOString();

            let biltyImageUrl = '';
            if (values.biltyImage) {
                biltyImageUrl = await uploadBiltyImage(values.biltyImage, selectedIndent.indentNumber);
            }

            await updateFullkittingRecord(selectedIndent.indentNumber, {
                actual: currentDateTime,
                status: 'Yes',
                vehicleNumber: values.vehicleNumber,
                from: values.from,
                to: values.to,
                materialLoadDetails: values.materialLoadDetails,
                biltyNumber: values.biltyNumber,
                rateType: values.rateType,
                amount1: Number(values.amount),
                biltyImage: biltyImageUrl,
            });

            // Create freight payment entry in payments table
            try {
                const linkedStoreIn = (storeInSheet || []).find(s => s.indentNo === selectedIndent.indentNumber);
                const poNumber = linkedStoreIn?.poNumber || '';
                
                await createFreightPaymentEntry({
                    indentNumber: selectedIndent.indentNumber,
                    transporterName: selectedIndent.transporterName || '',
                    poNumber: poNumber,
                    freightAmount: Number(values.amount),
                    biltyImage: biltyImageUrl,
                    productName: selectedIndent.productName || '',
                    firmNameMatch: selectedIndent.firmNameMatch || '',
                    biltyNumber: values.biltyNumber,
                    vehicleNumber: values.vehicleNumber,
                });
            } catch (payError) {
                console.error('Failed to create freight payment entry:', payError);
            }

            toast.success(`Updated fullkitting for ${selectedIndent.indentNumber}`);
            setOpenDialog(false);
            fetchData();
            updateAll();
        } catch (error) {
            console.error('Error updating fullkitting:', error);
            toast.error('Failed to update fullkitting');
        } finally {
            setIsSubmitting(false);
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
                        heading="Full Kitting" 
                        subtext="Manage full kitting details" 
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <Truck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <div className="p-5">
                            <DataTable
                                data={pendingData}
                                columns={columns}
                                searchFields={['indentNumber', 'productName', 'vendorName', 'firmNameMatch']}
                                dataLoading={dataLoading}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="p-5">
                            <DataTable
                                data={historyData}
                                columns={historyColumns}
                                searchFields={['indentNumber', 'productName', 'vendorName', 'firmNameMatch', 'vehicleNumber', 'biltyNumber']}
                                dataLoading={dataLoading}
                            />
                        </div>
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Update Full Kitting</DialogTitle>
                            <DialogDescription>
                                Update details for Indent Number: {selectedIndent.indentNumber}
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Vehicle Number */}
                                    <FormField
                                        control={form.control}
                                        name="vehicleNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Vehicle Number</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter vehicle number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Bilty Number */}
                                    <FormField
                                        control={form.control}
                                        name="biltyNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bilty Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="text"
                                                        placeholder="Enter bilty number"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* From */}
                                    <FormField
                                        control={form.control}
                                        name="from"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>From</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter source location" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* To */}
                                    <FormField
                                        control={form.control}
                                        name="to"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>To</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter destination location" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Rate Type Dropdown */}
                                    <FormField
                                        control={form.control}
                                        name="rateType"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rate Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Rate Type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Fixed">Fixed</SelectItem>
                                                        <SelectItem value="Per MT">Per MT</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Amount */}
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Freight Amount</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Enter freight amount"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Material Load Details - Full Width */}
                                <FormField
                                    control={form.control}
                                    name="materialLoadDetails"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Material Load Details</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Enter material load details"
                                                    {...field}
                                                    rows={3}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Bilty Image - Full Width */}
                                <FormField
                                    control={form.control}
                                    name="biltyImage"
                                    render={({ field: { value, onChange, ...fieldProps } }) => (
                                        <FormItem>
                                            <FormLabel>Bilty Image</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...fieldProps}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        onChange(file);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" disabled={isSubmitting}>
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <Loader size={20} className="mr-2" />
                                                Submitting...
                                            </>
                                        ) : (
                                            'Submit'
                                        )}
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