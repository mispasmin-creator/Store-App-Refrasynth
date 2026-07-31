'use client';

import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
    type SortingState,
} from '@tanstack/react-table';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useState, type ReactNode } from 'react';
import { Input } from '../ui/input';
import { ArrowDown, ArrowUp, ArrowUpDown, Package } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { ClipLoader } from 'react-spinners';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    searchFields?: string[];
    dataLoading?: boolean;
    children?: ReactNode;
    className?: string;
    extraActions?: ReactNode;
    rowSelection?: Record<string, boolean>;
    onRowSelectionChange?: (updater: any) => void;
    getRowId?: (row: TData) => string;
    meta?: any;
}

function globalFilterFn<TData>(row: TData, columnIds: string[], filterValue: string) {
    return columnIds.some((columnId) => {
        const value = (row as any)[columnId];
        return String(value ?? '')
            .toLowerCase()
            .includes(filterValue.toLowerCase());
    });
}

export default function DataTable<TData, TValue>({
    columns,
    data,
    searchFields = [],
    dataLoading,
    children: _children, // <-- underscore avoids TS unused variable error
    className,
    extraActions,
    rowSelection = {},
    onRowSelectionChange,
    getRowId,
    meta,
}: DataTableProps<TData, TValue>) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<SortingState>([]);
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        globalFilterFn: (row, _, filterValue) =>
            row?.original ? globalFilterFn(row.original, searchFields || [], filterValue) : false,
        getRowId,
        meta,
        onSortingChange: setSorting,
        state: {
            globalFilter,
            rowSelection: rowSelection || {},
            sorting,
        },
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: onRowSelectionChange,
    });

    return (
        <div className="p-5 grid gap-4">
            <div className="flex items-center w-full gap-3">
                {searchFields.length !== 0 && (
                    <Input
                        placeholder={`Search...`}
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="max-w-xs w-full"
                    />
                )}
                {(extraActions || _children) && (
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                        {extraActions}
                        {_children}
                    </div>
                )}
            </div>

            <div className="relative max-w-full overflow-x-auto">
                <ScrollArea className={cn('rounded-sm border h-[74dvh] w-full', className)}>
                    <Table className="min-w-max">
                        <TableHeader className="sticky top-0 z-10 bg-muted">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead
                                                key={header.id}
                                                className={cn(
                                                    "sticky top-0 z-10 bg-muted h-10 px-2 align-middle font-medium text-gray-900 border-b",
                                                    header.column.getCanSort() ? "cursor-pointer select-none group" : ""
                                                )}
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                <div className="flex items-center w-full h-full">
                                                    <div className="flex-1 flex justify-center min-w-0">
                                                        <span className="truncate text-center font-bold px-1">
                                                            {header.isPlaceholder
                                                                ? null
                                                                : flexRender(
                                                                    header.column.columnDef.header,
                                                                    header.getContext()
                                                                )}
                                                        </span>
                                                    </div>
                                                    {header.column.getCanSort() && (
                                                        <div className="w-6 shrink-0 flex items-center justify-end">
                                                            {{
                                                                asc: <ArrowUp className="h-4 w-4 text-primary" />,
                                                                desc: <ArrowDown className="h-4 w-4 text-primary" />,
                                                            }[header.column.getIsSorted() as string] ?? (
                                                                    <ArrowUpDown className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                                                                )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>

                        <TableBody>
                            {dataLoading ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={columns?.length || 0}
                                        className="h-50 text-center"
                                    >
                                        <div className="flex justify-center items-center w-full py-20">
                                            <ClipLoader color="#9333ea" size={40} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    row && (
                                        <TableRow
                                            key={row.id}
                                            data-state={row.getIsSelected?.() && 'selected'}
                                            className="p-1"
                                        >
                                            {row.getVisibleCells?.().map((cell) => (
                                                cell && (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </TableCell>
                                                )
                                            ))}
                                        </TableRow>
                                    )
                                ))
                            ) : (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={columns?.length || 0}
                                        className="h-50 text-center text-xl"
                                    >
                                        <div className="flex flex-col justify-center items-center w-full gap-1">
                                            <Package className="text-gray-400" size={50} />
                                            <p className="text-muted-foreground font-semibold">
                                                No Data Found.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
}
