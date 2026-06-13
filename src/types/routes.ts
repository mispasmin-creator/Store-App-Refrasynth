import type { JSX } from "react";
import type { IndentSheet, StoreInSheet, UserPermissions } from "./sheets";
export type IssueSheet = any; // Replace with actual type
export type FullKittingSheet = any; // Replace with actual type
export type PCReportSheet = any; // Replace with actual type
export type POMasterSheet = any; // Replace with actual type
export type TallyEntrySheet = any; // Replace with actual type
export type ReceivedSheet = any; // Replace with actual type
export type PaymentHistorySheet = any; // Replace with actual type

export type AllSheets = 
    | IndentSheet[]
    | StoreInSheet[]
    | IssueSheet[]
    | FullKittingSheet[]
    | PCReportSheet[]
    | POMasterSheet[]
    | TallyEntrySheet[]
    | ReceivedSheet[]
    | PaymentHistorySheet[];

export interface RouteAttributes {
    name: string;
    element: JSX.Element;
    path: string;
    icon: JSX.Element;
    gateKey?: keyof UserPermissions;
    hidden?: boolean;
    notifications: (sheet: AllSheets, user?: any) => number;
}
