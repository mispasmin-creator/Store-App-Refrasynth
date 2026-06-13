import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarHeader,
    SidebarFooter,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import type { RouteAttributes } from '@/types';
import { LogOut, RotateCw, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from './Logo';

interface SidebarProps {
    items: RouteAttributes[];
}

export default ({ items }: SidebarProps) => {
    const navigate = useNavigate();
    // ✅ GET ALL SHEETS FROM CONTEXT
    const {
        indentSheet,
        storeInSheet,
        issueSheet,
        fullkittingSheet,
        pcReportSheet,
        poMasterSheet,
        tallyEntrySheet,
        receivedSheet,
        paymentHistorySheet,
        paymentsSheet,
        updateAll,
        allLoading
    } = useSheets();
    const { user, logout } = useAuth();

    const allItems = [...items];

    return (
        <Sidebar side="left" variant="inset" collapsible="icon">
            <SidebarHeader className="p-4 border-b-1">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <Logo />
                        <div className="group-data-[collapsible=icon]:hidden">
                            <h2 className="text-xl font-bold">Store App</h2>
                            <p className="text-sm">Refrasynth</p>
                        </div>
                    </div>
                    <Button variant="ghost" className="size-7 group-data-[collapsible=icon]:hidden" onClick={() => updateAll()} disabled={allLoading}>
                        <RotateCw />
                    </Button>
                </div>
                <SidebarSeparator />
                <div className="flex justify-between items-center px-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    <div>
                        <p>
                            Name: <span className="font-semibold">{user.name}</span>
                        </p>
                        <p>
                            Username: <span className="font-semibold">{user.username}</span>
                        </p>
                    </div>
                    <Button variant="outline" className="size-8" onClick={() => logout()}>
                        <LogOut />
                    </Button>
                </div>
            </SidebarHeader>
            <SidebarContent className="py-1 border-b-1">
                <SidebarGroup className="p-4 transition-all duration-300">
                    <SidebarMenu>
                        {allItems
                            .filter((item) => {
                                if (item.hidden) return false;
                                // Show item only if user has explicit permission for this gateKey
                                if (item.gateKey) {
                                    return user[item.gateKey] === true || (user as any)[item.gateKey] === "true";
                                }
                                return true; // no gateKey = always visible (Dashboard, Training, License)
                            })
                            .map((item, i) => {
                                // ✅ DETERMINE WHICH SHEET TO USE BASED ON ROUTE PATH
                                let sheetData: any[] = [];
                                let notificationCount = 0;

                                // Only calculate if notification function exists
                                // In your Sidebar component, replace the notification calculation part:
                                if (item.notifications) {
                                    switch (item.path) {
                                        case 'Issue-data':
                                        case 'store-issue':
                                            sheetData = issueSheet || [];
                                            break;
                                        case 'hod-store-check':
                                            sheetData = storeInSheet || [];
                                            break;
                                        case 'store-in':
                                            sheetData = storeInSheet || [];
                                            break;
                                        case 'Make-Payment':
                                            // Pass paymentsSheet and storeInSheet for filtering
                                            sheetData = [paymentsSheet || [], storeInSheet || []];
                                            break;
                                        case 'Full-Kiting':
                                            sheetData = fullkittingSheet || [];
                                            break;
                                        case 'rectify-the-mistake':
                                        case 'reaudit-data':
                                        case 'take-entry-by-tally':
                                        case 'AgainAuditing':
                                        case 'audit-data': // ✅ ADD THIS for Audit Data
                                            sheetData = tallyEntrySheet || [];
                                            break;
                                        case 'po-history':
                                        case 'create-po':
                                            sheetData = poMasterSheet || [];
                                            break;
                                        case 'pending-poss':
                                            sheetData = indentSheet || [];
                                            break;
                                        case 'Bill-Not-Received':
                                        case 'Quality-Check-In-Received-Item':
                                        case 'Send-Debit-Note':
                                        case 'Exchange-Materials':
                                        case 'Return-Material-To-Party':
                                            sheetData = storeInSheet || [];
                                            break;
                                        case 'Payment-Status':
                                            sheetData = [poMasterSheet || [], paymentsSheet || [], user, storeInSheet || []];
                                            break;
                                        case 'DBforPc':
                                            sheetData = pcReportSheet || [];
                                            break;
                                        default:
                                            sheetData = indentSheet || [];
                                    }

                                    // ✅ SMART NOTIFICATION HANDLER: Works for both old and new functions
                                    try {
                                        // First try with raw data (for old functions)
                                        notificationCount = item.notifications(sheetData, user);

                                        // If it returns 0 but we have data, try with array-wrapped data (for new functions)
                                        if (notificationCount === 0 && sheetData.length > 0) {
                                            const wrappedCount = item.notifications([sheetData], user);
                                            if (wrappedCount > 0) {
                                                notificationCount = wrappedCount;
                                            }
                                        }
                                    } catch (error) {
                                        console.error(`Error in notification function for ${item.name}:`, error);
                                        notificationCount = 0;
                                    }
                                }

                                return (
                                    <SidebarMenuItem key={i}>
                                        <SidebarMenuButton
                                            className="transition-all duration-200 rounded-md py-6 flex justify-between font-medium text-secondary-foreground items-center"
                                            onClick={() => navigate(item.path)}
                                            isActive={window.location.pathname.slice(1) === item.path}
                                            tooltip={item.name}
                                        >
                                            <div className="flex gap-4 items-center min-w-0">
                                                <div className="shrink-0 flex items-center justify-center w-6">{item.icon}</div>
                                                <span className="group-data-[collapsible=icon]:hidden truncate">{item.name}</span>
                                            </div>
                                            {/* ✅ SHOW BADGE WITH CORRECT COUNT */}
                                            {notificationCount !== 0 && (
                                                <span className="bg-destructive text-secondary w-5 h-5 rounded-full text-[10px] grid place-items-center text-center shrink-0 group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:-right-1 shadow-sm">
                                                    {notificationCount > 99 ? '99+' : notificationCount}
                                                </span>
                                            )}
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}

                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-2 text-center text-sm">
                    Powered by &#8208;{' '}
                    <a className="text-primary" href="https://botivate.in" target="_blank">
                        Botivate
                    </a>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
};
