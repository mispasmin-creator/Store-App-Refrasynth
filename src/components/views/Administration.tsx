import { Building, ShieldCheck, User as UserIcon, Eye, EyeClosed, MoreHorizontal, Pencil, ShieldUser, Trash, UserPlus } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import { allPermissionKeys, type UserPermissions } from '@/types/sheets';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useAuth } from '@/context/AuthContext';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { Pill } from '../ui/pill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { fetchUsers, createUser, updateUser, deleteUser, type UserRecord } from '@/services/userService';
import { fetchMasterOptions } from '@/services/masterService';

interface UsersTableData {
    id: number;
    username: string;
    name: string;
    password: string;
    firmNameMatch: string;
    permissions: string[];
}

function camelToTitleCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2') // insert space before capitals
        .replace(/^./, (char) => char.toUpperCase()); // capitalize first letter
}

const PERMISSION_GROUPS = {
    'Core Access': ['administrate'],
    'Procurement & PO': ['createIndent', 'indentApprovalView', 'indentApprovalAction', 'pendingIndentsView', 'createPo', 'updateVendorView', 'updateVendorAction', 'threePartyApprovalView', 'threePartyApprovalAction', 'poHistory', 'pendingPo', 'lifting'],
    'Store & Inventory': ['receiveItemView', 'receiveItemAction', 'storeIn', 'storeOutApprovalView', 'storeOutApprovalAction', 'hodStoreApproval', 'storeIssue', 'issueData', 'inventory', 'fullKiting'],
    'Audit & Finance': ['againAuditing', 'takeEntryByTelly', 'reauditData', 'rectifyTheMistake', 'auditData', 'sendDebitNote', 'returnMaterialToParty', 'exchangeMaterials', 'insteadOfQualityCheckInReceivedItem', 'dbForPc', 'billNotReceived', 'makePayment']
};

export default () => {
    const { user: currentUser } = useAuth();

    const [tableData, setTableData] = useState<UsersTableData[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UsersTableData | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [firms, setFirms] = useState<string[]>([]);

    useEffect(() => {
        if (!openDialog) {
            setSelectedUser(null);
        }
    }, [openDialog]);

    async function fetchUser() {
        setDataLoading(true);
        try {
            const users = await fetchUsers();
            const sortedUsers = users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setTableData(
                sortedUsers.map((user) => {
                    const permissionKeys = allPermissionKeys.filter(
                        (key) => user[key as keyof UserPermissions] === true
                    );

                    return {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        password: user.password,
                        firmNameMatch: user.firmNameMatch,
                        permissions: permissionKeys,
                    };
                })
            );
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Failed to load users');
        } finally {
            setDataLoading(false);
        }
    }

    async function loadMasterData() {
        const options = await fetchMasterOptions();
        setFirms(options.firms);
    }

    useEffect(() => {
        fetchUser();
        loadMasterData();
    }, []);

    const columns: ColumnDef<UsersTableData>[] = [
        {
            accessorKey: 'name',
            header: 'User Profile',
            cell: ({ row }) => (
                <div className="flex items-center gap-3 justify-start pl-4">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <UserIcon size={16} />
                    </div>
                    <div className="flex flex-col min-w-0 text-left">
                        <span className="font-bold text-sm truncate">{row.original.name}</span>
                        <span className="text-xs text-muted-foreground truncate italic">@{row.original.username}</span>
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm / Scope',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-sm justify-start pl-4">
                    <Building size={14} className="text-muted-foreground shrink-0" />
                    <span className={row.original.firmNameMatch.toLowerCase() === 'all' ? "font-semibold text-primary" : ""}>
                        {row.original.firmNameMatch || "Not Assigned"}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'permissions',
            header: 'Access & Permissions',
            cell: ({ row }) => {
                const permissions = row.original.permissions;
                const isAdmin = permissions.includes('administrate');
                const otherPermissions = permissions.filter(p => p !== 'administrate');

                return (
                    <div className="grid place-items-start pl-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {isAdmin && (
                                <Pill variant="primary" className="bg-primary text-secondary border-none animate-pulse-subtle">
                                    <ShieldCheck size={10} className="mr-1 inline" /> Administrator
                                </Pill>
                            )}
                            {otherPermissions.slice(0, 3).map((perm, i) => {
                                const variant = perm.toLowerCase().includes('approval') || perm.toLowerCase().includes('action') || perm.toLowerCase().includes('make') ? 'secondary' : 'default';
                                return <Pill key={i} variant={variant}>{camelToTitleCase(perm)}</Pill>;
                            })}
                            {otherPermissions.length > 3 && (
                                <HoverCard>
                                    <HoverCardTrigger>
                                        <Pill className="cursor-pointer">+{otherPermissions.length - 3} more</Pill>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="min-w-40 max-w-100 flex flex-wrap gap-1.5 bg-background border p-3 shadow-lg">
                                        {otherPermissions.map((perm, i) => {
                                            const variant = perm.toLowerCase().includes('approval') || perm.toLowerCase().includes('action') || perm.toLowerCase().includes('make') ? 'secondary' : 'default';
                                            return <Pill key={i} variant={variant}>{camelToTitleCase(perm)}</Pill>;
                                        })}
                                    </HoverCardContent>
                                </HoverCard>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            asChild
                            disabled={
                                user.username === 'admin' || user.username === currentUser.username
                            }
                        >
                            <Button variant="ghost" className="h-8 w-8 p-0 mr-4">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-6 w-6" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => {
                                    setSelectedUser(user);
                                    setOpenDialog(true);
                                }}
                            >
                                <Pencil className="h-4 w-4 mr-2" /> Edit Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={async () => {
                                    if (confirm(`Are you sure you want to delete ${user.name}?`)) {
                                        try {
                                            if (user.username === 'admin') {
                                                throw new Error();
                                            }
                                            await deleteUser(user.id);
                                            toast.success(`Deleted ${user.name} successfully`);
                                            fetchUser();
                                        } catch {
                                            toast.error('Failed to delete user');
                                        }
                                    }
                                }}
                            >
                                <Trash className="h-4 w-4 mr-2 text-destructive" /> Delete User
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        username: z.string().min(1, 'Username is required'),
        password: z.string().min(1, 'Password is required'),
        firmNameMatch: z.string().optional(),
        permissions: z.array(z.string()),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            username: '',
            password: '',
            firmNameMatch: '',
            permissions: [],
        },
    });

    useEffect(() => {
        if (selectedUser) {
            form.reset({
                username: selectedUser.username,
                name: selectedUser.name,
                password: selectedUser.password,
                firmNameMatch: selectedUser.firmNameMatch,
                permissions: selectedUser.permissions,
            });
            return;
        }
        form.reset({
            name: '',
            username: '',
            password: '',
            firmNameMatch: '',
            permissions: [],
        });
    }, [selectedUser]);

    async function onSubmit(value: z.infer<typeof schema>) {
        if (
            tableData.map((d) => d.username).includes(value.username) &&
            (!selectedUser || value.username !== selectedUser.username)
        ) {
            toast.error('Username already exists');
            return;
        }

        const userData: any = {
            username: value.username,
            name: value.name,
            password: value.password,
            firmNameMatch: value.firmNameMatch || '',
        };

        allPermissionKeys.forEach((perm) => {
            userData[perm] = value.permissions.includes(perm);
        });

        try {
            if (selectedUser) {
                await updateUser(selectedUser.id, userData);
                toast.success('Updated user settings');
            } else {
                await createUser(userData);
                toast.success('Created user successfully');
            }
            setOpenDialog(false);
            fetchUser();
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error('Failed to save user settings');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }
    return (
        <div className="h-full">
            <Dialog open={openDialog} onOpenChange={(open) => setOpenDialog(open)}>
                <div>
                    <Heading
                        heading="Administration"
                        subtext="Manage permissions and user for the app"
                    >
                        <ShieldUser size={50} className="text-primary" />
                    </Heading>

                    <DataTable
                        data={tableData}
                        columns={columns}
                        searchFields={['name', 'username', 'permissions', 'firmNameMatch']}
                        dataLoading={dataLoading}
                        className="h-[calc(100dvh-180px)] overflow-hidden"
                        extraActions={
                            <Button
                                className="h-full px-4"
                                onClick={() => {
                                    setOpenDialog(true);
                                    setSelectedUser(null);
                                }}
                            >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add New User
                            </Button>
                        }
                    />
                </div>

                <DialogContent className="sm:max-w-3xl">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-7">
                            <DialogHeader className="space-y-1">
                                <DialogTitle className="text-lg">
                                    {selectedUser ? 'Edit' : 'Create'} User
                                </DialogTitle>
                            </DialogHeader>
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter username" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Enter name of user"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type={showPassword ? 'text' : 'password'}
                                                        placeholder="Enter password"
                                                        {...field}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        type="button"
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-transparent active:bg-transparent"
                                                        tabIndex={-1}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setShowPassword(!showPassword);
                                                        }}
                                                    >
                                                        {showPassword ? <EyeClosed /> : <Eye />}
                                                        <span className="sr-only">
                                                            Toggle password visibility
                                                        </span>
                                                    </Button>
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="firmNameMatch"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Firm Name Match</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Firm or 'all'" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="all">All Firms (Universal Access)</SelectItem>
                                                    {firms.map((firm) => (
                                                        <SelectItem key={firm} value={firm}>
                                                            {firm}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="permissions"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-md font-bold">User Permissions & Access Control</FormLabel>
                                        <div className="space-y-6 mt-4">
                                            {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]) => (
                                                <div key={groupName} className="space-y-3">
                                                    <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                                                        {groupName}
                                                    </h3>
                                                    <div className="grid md:grid-cols-3 gap-4 p-2">
                                                        {perms.map((perm) => (
                                                            <FormField
                                                                key={perm}
                                                                control={form.control}
                                                                name="permissions"
                                                                render={() => (
                                                                    <FormItem className="flex gap-2 items-center space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                id={perm}
                                                                                checked={field.value?.includes(perm)}
                                                                                onCheckedChange={(checked) => {
                                                                                    const values = field.value || [];
                                                                                    checked
                                                                                        ? field.onChange([...values, perm])
                                                                                        : field.onChange(values.filter((p) => p !== perm));
                                                                                }}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="font-medium text-sm cursor-pointer" htmlFor={perm}>
                                                                            {camelToTitleCase(perm)}
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </FormItem>
                                )}
                            />
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
                                    {selectedUser ? 'Save' : 'Create'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
