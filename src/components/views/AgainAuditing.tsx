import { Package2 } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { formatDateTime, parseCustomDate, formatDate } from '@/lib/utils';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import {
  fetchTallyEntryRecords,
  updateTallyEntryRecord,
  type TallyEntryRecord
} from '@/services/tallyEntryService';

// Stage configurations

export default function AgainAuditingTable() {
  const [data, setData] = useState<TallyEntryRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<TallyEntryRecord | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const { user } = useAuth();

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const records = await fetchTallyEntryRecords();

      // Filter by firm name and status (planned5 exists, actual5 is empty)
      const filtered = records.filter(item => {
        const firmMatch = user.firmNameMatch.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch;
        const stageMatch = item.planned5 && !item.actual5;
        return firmMatch && stageMatch;
      });

      setData(filtered);
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

  // Validation schema
  const schema = z.object({
    status: z.enum(['okay', 'not okay']),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'okay',
    },
  });

  useEffect(() => {
    if (!openDialog) {
      form.reset({ status: 'okay' });
    }
  }, [openDialog, form]);

  // Handle form submission
  async function onSubmit(values: z.infer<typeof schema>) {
    if (!selectedRow) {
      toast.error('No row selected!');
      return;
    }

    try {
      const currentDateTime = new Date().toISOString();

      await updateTallyEntryRecord(selectedRow.id, {
        actual5: currentDateTime,
        status5: values.status,
        remarks5: '', // No remarks field in this UI
      });

      toast.success(`Status updated for Indent ${selectedRow.indentNumber}`);
      setOpenDialog(false);
      fetchData();
    } catch (err) {
      console.error('Error in onSubmit:', err);
      toast.error('Failed to update status. Please try again.');
    }
  }

  function onError(e: any) {
    console.log(e);
    toast.error('Please fill all required fields');
  }

  // Columns for TallyEntryRecord
  const columns: ColumnDef<TallyEntryRecord>[] = [
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }: { row: Row<TallyEntryRecord> }) => {
        const rowData = row.original;
        return (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRow(rowData);
              }}
            >
              Action
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
    {
      accessorKey: 'materialInDate',
      header: 'Material In Date',
      cell: ({ row }) => formatDate(row.original.materialInDate)
    },
    {
      accessorKey: 'planned5',
      header: 'Planned Date',
      cell: ({ row }) => formatDate(row.original.planned5)
    },
    { accessorKey: 'productName', header: 'Product Name' },
    { accessorKey: 'firmNameMatch', header: 'Firm Name' },
    { accessorKey: 'billNo', header: 'Bill No' },
    { accessorKey: 'qty', header: 'Quantity' },
    { accessorKey: 'partyName', header: 'Party Name' },
    { accessorKey: 'billAmt', header: 'Bill Amount' },
    {
      accessorKey: 'billImage',
      header: 'Bill Image',
      cell: ({ row }) => {
        const image = row.original.billImage;
        return image ? (
          <a
            href={image}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:underline"
          >
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
          <a
            href={image}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:underline"
          >
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
  ];

  return (
    <div>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Heading heading="Again Auditing" subtext="Process and update tally entries">
          <Package2 size={50} className="text-primary" />
        </Heading>

        <DataTable
          data={data}
          columns={columns}
          searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
          dataLoading={dataLoading}
          className='h-[80dvh]'
        />

        {selectedRow && (
          <DialogContent className="sm:max-w-2xl">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, onError)}
                className="space-y-5"
              >
                <DialogHeader>
                  <DialogTitle>
                    Update Status for Indent {selectedRow.indentNumber}
                  </DialogTitle>
                </DialogHeader>

                <div className="bg-muted p-4 rounded-md grid gap-3">
                  <h3 className="text-lg font-bold">Entry Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Indent No.</p>
                      <p className="text-sm font-light">{selectedRow.indentNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Firm Name</p>
                      <p className="text-sm font-light">{selectedRow.firmNameMatch}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Product Name</p>
                      <p className="text-sm font-light">{selectedRow.productName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Party Name</p>
                      <p className="text-sm font-light">{selectedRow.partyName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Bill No.</p>
                      <p className="text-sm font-light">{selectedRow.billNo}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Quantity</p>
                      <p className="text-sm font-light">{selectedRow.qty}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Bill Amount</p>
                      <p className="text-sm font-light">{selectedRow.billAmt}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 py-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="okay">Okay</SelectItem>
                              <SelectItem value="not okay">Not Okay</SelectItem>
                            </SelectContent>
                          </Select>
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
