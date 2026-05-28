import React, { useEffect, type ReactNode } from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { TabsList, TabsTrigger } from '../ui/tabs';

interface HeaderProps {
    children: ReactNode;
    heading: string;
    subtext: string;
    tabs?: boolean;
    pendingCount?: number;
    historyCount?: number;
    pendingTabName?: string;
    historyTabName?: string;
}

const getIconTheme = (heading: string) => {
    const normalized = heading.toLowerCase().trim();

    if (normalized.includes('dashboard')) {
        return {
            bg: "bg-blue-50/90",
            border: "border-blue-200/60",
            text: "text-blue-600",
            borderL: "border-l-blue-500"
        };
    }
    if (normalized.includes('store issue')) {
        return {
            bg: "bg-rose-50/90",
            border: "border-rose-200/60",
            text: "text-rose-600",
            borderL: "border-l-rose-500"
        };
    }
    if (normalized.includes('issue data')) {
        return {
            bg: "bg-emerald-50/90",
            border: "border-emerald-200/60",
            text: "text-emerald-600",
            borderL: "border-l-emerald-500"
        };
    }
    if (normalized.includes('inventory')) {
        return {
            bg: "bg-amber-50/90",
            border: "border-amber-200/60",
            text: "text-amber-600",
            borderL: "border-l-amber-500"
        };
    }
    if (normalized.includes('create indent')) {
        return {
            bg: "bg-violet-50/90",
            border: "border-violet-200/60",
            text: "text-violet-600",
            borderL: "border-l-violet-500"
        };
    }
    if (normalized.includes('indent approval') || normalized.includes('approve indent')) {
        return {
            bg: "bg-purple-50/90",
            border: "border-purple-200/60",
            text: "text-purple-600",
            borderL: "border-l-purple-500"
        };
    }
    if (normalized.includes('vendor rate update') || normalized.includes('vendor update')) {
        return {
            bg: "bg-cyan-50/90",
            border: "border-cyan-200/60",
            text: "text-cyan-600",
            borderL: "border-l-cyan-500"
        };
    }
    if (normalized.includes('department approval') || normalized.includes('technical approval')) {
        return {
            bg: "bg-teal-50/90",
            border: "border-teal-200/60",
            text: "text-teal-600",
            borderL: "border-l-teal-500"
        };
    }
    if (normalized.includes('management approval') || normalized.includes('rate approval')) {
        return {
            bg: "bg-slate-100/90",
            border: "border-slate-350/60",
            text: "text-slate-600",
            borderL: "border-l-slate-500"
        };
    }
    if (normalized.includes('pending po') || normalized.includes('po to be created')) {
        return {
            bg: "bg-orange-50/90",
            border: "border-orange-200/60",
            text: "text-orange-600",
            borderL: "border-l-orange-500"
        };
    }
    if (normalized.includes('create po')) {
        return {
            bg: "bg-pink-50/90",
            border: "border-pink-200/60",
            text: "text-pink-600",
            borderL: "border-l-pink-500"
        };
    }
    if (normalized.includes('po history') || normalized.includes('order')) {
        return {
            bg: "bg-indigo-50/90",
            border: "border-indigo-200/60",
            text: "text-indigo-600",
            borderL: "border-l-indigo-500"
        };
    }
    if (normalized.includes('lifting') || normalized.includes('get purchase') || normalized.includes('get lift')) {
        return {
            bg: "bg-lime-50/90",
            border: "border-lime-200/60",
            text: "text-lime-600",
            borderL: "border-l-lime-500"
        };
    }
    if (normalized.includes('store check') || normalized.includes('store in') || normalized.includes('quantity check') || normalized.includes('grn')) {
        return {
            bg: "bg-emerald-50/90",
            border: "border-emerald-200/60",
            text: "text-emerald-600",
            borderL: "border-l-emerald-500"
        };
    }
    if (normalized.includes('hod check') || normalized.includes('hod store')) {
        return {
            bg: "bg-blue-50/90",
            border: "border-blue-200/60",
            text: "text-blue-600",
            borderL: "border-l-blue-500"
        };
    }
    if (normalized.includes('freight payment') || normalized.includes('full kiting')) {
        return {
            bg: "bg-fuchsia-50/90",
            border: "border-fuchsia-200/60",
            text: "text-fuchsia-600",
            borderL: "border-l-fuchsia-500"
        };
    }
    if (normalized.includes('payment status') || normalized.includes('process for payment')) {
        return {
            bg: "bg-sky-50/90",
            border: "border-sky-200/60",
            text: "text-sky-600",
            borderL: "border-l-sky-500"
        };
    }
    if (normalized.includes('make payment')) {
        return {
            bg: "bg-sky-50/90",
            border: "border-sky-200/60",
            text: "text-sky-650",
            borderL: "border-l-sky-600"
        };
    }
    if (normalized.includes('reject for grn') || normalized.includes('quality check')) {
        return {
            bg: "bg-red-50/90",
            border: "border-red-200/60",
            text: "text-red-600",
            borderL: "border-l-red-500"
        };
    }
    if (normalized.includes('send debit note') || normalized.includes('debit note') || normalized.includes('rectify')) {
        return {
            bg: "bg-rose-50/90",
            border: "border-rose-200/60",
            text: "text-rose-600",
            borderL: "border-l-rose-500"
        };
    }
    if (normalized.includes('audit data') || normalized.includes('auditing') || normalized.includes('reaudit')) {
        return {
            bg: "bg-zinc-100/90",
            border: "border-zinc-200/60",
            text: "text-zinc-600",
            borderL: "border-l-zinc-500"
        };
    }
    if (normalized.includes('bill status') || normalized.includes('bill not received')) {
        return {
            bg: "bg-orange-50/90",
            border: "border-orange-200/60",
            text: "text-orange-600",
            borderL: "border-l-orange-500"
        };
    }
    if (normalized.includes('pc report') || normalized.includes('db for pc')) {
        return {
            bg: "bg-slate-100/90",
            border: "border-slate-200/60",
            text: "text-slate-650",
            borderL: "border-l-slate-500"
        };
    }
    if (normalized.includes('administration') || normalized.includes('admin')) {
        return {
            bg: "bg-zinc-100/90",
            border: "border-zinc-200/60",
            text: "text-zinc-700",
            borderL: "border-l-zinc-600"
        };
    }
    if (normalized.includes('training')) {
        return {
            bg: "bg-amber-50/90",
            border: "border-amber-200/60",
            text: "text-amber-600",
            borderL: "border-l-amber-500"
        };
    }
    if (normalized.includes('license')) {
        return {
            bg: "bg-yellow-50/90",
            border: "border-yellow-200/60",
            text: "text-yellow-600",
            borderL: "border-l-yellow-500"
        };
    }

    return {
        bg: "bg-orange-50/90",
        border: "border-orange-200/60",
        text: "text-orange-600",
        borderL: "border-l-orange-500"
    };
};

export default ({ children, heading, subtext, tabs = false, pendingCount, historyCount, pendingTabName = "Pending", historyTabName = "History" }: HeaderProps) => {
    // The base orange color theme from Pending POs to be Created for all pages
    const baseGradient = "from-orange-100/80 via-amber-50/50 to-yellow-100/40";
    const baseBorder = "border-orange-200";
    const baseText = "text-orange-950";
    const baseSubtext = "text-orange-700/80";
    const basePageBg = "rgba(255, 247, 237, 0.45)"; // Soft warm orange/amber tint for page background

    const iconTheme = getIconTheme(heading);

    useEffect(() => {
        const mainEl = document.querySelector('main');
        if (mainEl) {
            const originalBg = mainEl.style.backgroundColor;
            const originalTransition = mainEl.style.transition;
            
            mainEl.style.transition = 'background-color 0.4s ease';
            mainEl.style.backgroundColor = basePageBg;

            return () => {
                mainEl.style.backgroundColor = originalBg;
                mainEl.style.transition = originalTransition;
            };
        }
    }, []);

    // Clone icon child to apply dynamic icon text color
    const themedIcon = React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            className: `${(children.props as any).className || ''} ${iconTheme.text}`.replace(/\btext-primary\b/g, '')
          })
        : children;

    return (
        <div className={`bg-gradient-to-br ${baseGradient} border-b ${baseBorder} border-l-4 ${iconTheme.borderL} rounded-md shadow-sm transition-all duration-300`}>
            <div className="flex justify-between p-5">
                <div className="flex gap-3 items-center">
                    <div className={`p-2 ${iconTheme.bg} rounded-lg shadow-sm border ${iconTheme.border} backdrop-blur-sm`}>
                        {themedIcon}
                    </div>
                    <div>
                        <h1 className={`text-2xl font-bold ${baseText} tracking-tight`}>{heading}</h1>
                        <p className={`text-sm ${baseSubtext} mt-0.5`}>{subtext}</p>
                    </div>
                </div>
                <SidebarTrigger />
            </div>
            {tabs && (
                <TabsList className="w-full rounded-none bg-transparent rounded-b-md px-5 border-t border-black/5">
                    <TabsTrigger value="pending" className="flex gap-2">
                        {pendingTabName} {pendingCount !== undefined && <span>({pendingCount})</span>}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex gap-2">
                        {historyTabName} {historyCount !== undefined && <span>({historyCount})</span>}
                    </TabsTrigger>
                </TabsList>
            )}
        </div>
    );
};
