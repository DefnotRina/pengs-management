import { useState, useEffect } from "react";
import { Package, Puzzle, DollarSign, TrendingDown, TrendingUp, Clock } from "lucide-react";
import { StatCard, PageHeader } from "@/components/StatCard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
    startOfToday, endOfToday, startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, subMonths, startOfYear, 
    isWithinInterval, parseISO, format 
} from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const formatCurrency = (v: number) => `₱${Math.abs(v).toLocaleString()}`;

export default function Dashboard() {
    const { role } = useAuth();
    const [summary, setSummary] = useState({
        totalPacks: 0, totalPieces: 0, totalIncome: 0, totalExpenses: 0, profit: 0, pendingOrders: 0
    });
    const [packsBySize, setPacksBySize] = useState<any[]>([]);
    const [productionByCook, setProductionByCook] = useState<any[]>([]);
    const [recentPacks, setRecentPacks] = useState<any[]>([]);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterType, setFilterType] = useState("This Month");
    const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));

    const getInterval = () => {
        const now = new Date();
        switch (filterType) {
            case "Today": return { start: startOfToday(), end: endOfToday() };
            case "This Week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
            case "This Month": return { start: startOfMonth(now), end: endOfMonth(now) };
            case "Last Month": {
                const last = subMonths(now, 1);
                return { start: startOfMonth(last), end: endOfMonth(last) };
            }
            case "This Year": return { start: startOfYear(now), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
            case "Custom": return { start: parseISO(customStart), end: parseISO(customEnd) };
            default: return { start: startOfMonth(now), end: endOfMonth(now) };
        }
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            
            // Fetch data
            const [
                { data: packingData },
                { data: orders },
                { data: expenses },
                { data: payments }
            ] = await Promise.all([
                supabase.from('packing').select('*'), 
                supabase.from('orders').select('*'),
                supabase.from('expenses').select('*'),
                supabase.from('order_payments').select('*')
            ]);
            
            const interval = getInterval();
            const isInRange = (dateStr: string) => {
                try {
                    if (!dateStr) return false;
                    return isWithinInterval(parseISO(dateStr), interval);
                } catch (e) { return false; }
            };

            // Filter data based on range
            const filteredPacking = packingData?.filter(p => isInRange(p.date)) || [];
            const filteredOrders = orders?.filter(o => isInRange(o.date)) || [];
            const filteredExpenses = expenses?.filter(e => isInRange(e.date)) || [];
            const filteredPayments = payments?.filter(p => isInRange(p.payment_date)) || [];
            
            // Compute Summary
            let pendingOrders = 0;
            filteredOrders.forEach(o => {
                if (o.order_status === "Pending") pendingOrders++;
            });

            // Income is now derived from actual payment records
            const totalIncome = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
            const totalExp = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

            let totalPacks = 0;
            let totalPieces = 0;
            const sizeMap: any = {};
            const cookMap: any = {};
            
            filteredPacking.forEach(pe => {
                const packsProduced = pe.packs_produced || 0;
                const packSize = pe.pack_size || 0;
                const pieces = packsProduced * packSize;

                totalPacks += packsProduced;
                totalPieces += pieces;
                
                if (!sizeMap[packSize]) sizeMap[packSize] = 0;
                sizeMap[packSize] += packsProduced;
                
                const cookKey = pe.cook_name || "Unknown";
                if (!cookMap[cookKey]) cookMap[cookKey] = 0;
                cookMap[cookKey] += pieces;
            });

            setSummary({
                totalPacks,
                totalPieces,
                totalIncome,
                totalExpenses: totalExp,
                profit: totalIncome - totalExp,
                pendingOrders
            });

            // Format chart data
            const colors = ["hsl(25, 95%, 53%)", "hsl(25, 95%, 63%)", "hsl(25, 95%, 73%)", "hsl(25, 95%, 43%)"];
            const formattedSizes = Object.entries(sizeMap).map(([size, packs], idx) => ({
                name: `${size} pcs`,
                packs,
                fill: colors[idx % colors.length]
            }));
            setPacksBySize(formattedSizes);

            const formattedCooks = Object.entries(cookMap).map(([cook, pieces]) => ({ cook, pieces }));
            setProductionByCook(formattedCooks);

            // Recent lists (still showing up to 5, but from the filtered set)
            setRecentPacks(filteredPacking.slice(0, 5));
            setRecentOrders(filteredOrders.filter(o => o.order_status === "Pending").slice(0, 5));
            
            setIsLoading(false);
        };

        fetchDashboardData();
    }, [filterType, customStart, customEnd]);

    if (isLoading) {
        return <div className="p-4 md:p-6 max-w-6xl mx-auto flex justify-center items-center h-[50vh]"><p className="text-muted-foreground">Loading Analytics...</p></div>;
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <PageHeader title="Dashboard Analytics" />
                    
                    {/* Premium Segmented Filter */}
                    <div className="inline-flex items-center gap-1 bg-muted/40 p-1.5 rounded-full border shadow-inner self-start">
                        {["Today", "This Week", "This Month", "Last Month", "This Year", "Custom"].map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-tight transition-all duration-300 ${
                                    filterType === type 
                                    ? "bg-background text-primary shadow-md ring-1 ring-black/5" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {filterType === "Custom" && (
                    <div className="flex items-center gap-3 p-4 bg-card rounded-2xl border shadow-sm animate-in slide-in-from-top-2 duration-300 max-w-fit">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">From</span>
                            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-9 text-xs font-semibold w-40 rounded-lg" />
                        </div>
                        <div className="w-4 h-px bg-border"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">To</span>
                            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-9 text-xs font-semibold w-40 rounded-lg" />
                        </div>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <StatCard label="Total Income" value={formatCurrency(summary.totalIncome)} icon={TrendingUp} variant="success" />
                <StatCard label="Total Expenses" value={formatCurrency(summary.totalExpenses)} icon={TrendingDown} variant="danger" />
                <StatCard
                    label="Profit Margin"
                    value={`${summary.profit < 0 ? "-" : ""}${formatCurrency(summary.profit)}`}
                    icon={DollarSign}
                    variant={summary.profit >= 0 ? "success" : "danger"}
                />
                <StatCard label="Total Packs" value={summary.totalPacks.toLocaleString()} icon={Package} />
                <StatCard label="Total Pieces" value={summary.totalPieces.toLocaleString()} icon={Puzzle} />
                <StatCard label="Pending Orders" value={summary.pendingOrders} icon={Clock} variant="warning" />
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-card rounded-lg border p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-foreground mb-4">Packs by Size Breakdown</h2>
                    {packsBySize.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={packsBySize}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                <Bar dataKey="packs" radius={[6, 6, 0, 0]}>
                                    {packsBySize.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                    )}
                </div>

                <div className="bg-card rounded-lg border p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-foreground mb-4">Production Quota per Cook</h2>
                    {productionByCook.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={productionByCook} layout="vertical">
                                <XAxis type="number" tick={{ fontSize: 12 }} />
                                <YAxis type="category" dataKey="cook" tick={{ fontSize: 12 }} width={60} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                <Bar dataKey="pieces" fill="hsl(25, 95%, 53%)" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                    )}
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-card rounded-lg border p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-foreground mb-3">Recent Packing</h2>
                    <div className="space-y-2">
                        {recentPacks.length > 0 ? recentPacks.map((e) => (
                            <div key={e.id || Math.random()} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-foreground">{e.cook_name}</p>
                                    <p className="text-xs text-muted-foreground">{e.date} · {e.pack_size} pcs/pack</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-foreground">{e.packs_produced} packs</p>
                                    <p className="text-xs text-muted-foreground">{(e.pack_size || 0) * (e.packs_produced || 0)} pieces</p>
                                </div>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">No recent packing entries.</p>}
                    </div>
                </div>

                <div className="bg-card rounded-lg border p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-foreground mb-3">Pending Action Orders</h2>
                    <div className="space-y-2">
                        {recentOrders.length > 0 ? recentOrders.map((o) => (
                            <div key={o.id || o.order_no} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-foreground">{o.client}</p>
                                    <p className="text-xs text-muted-foreground">{o.order_no} · Due {o.delivery_deadline}</p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <p className="text-sm font-bold text-foreground">{formatCurrency(Number(o.total_price))}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${o.payment_status === "Paid" ? "bg-success/10 text-success" :
                                            o.payment_status === "Partial" ? "bg-warning/10 text-warning" :
                                                "bg-destructive/10 text-destructive"
                                        }`}>
                                        {o.payment_status}
                                    </span>
                                </div>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">No pending orders.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
