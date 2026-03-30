import { useState, useEffect } from "react";
import { PageHeader } from "@/components/StatCard";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_CATEGORIES } from "@/lib/mock-data";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const RAW_INGREDIENTS = [
    { name: "Flour", unit: "Sack" },
    { name: "Sugar", unit: "Sack" },
    { name: "Skim Milk", unit: "kg" },
    { name: "Butter Milk", unit: "kg" },
    { name: "Eggs", unit: "Tray" },
    { name: "Margarine", unit: "Select" },
];

const formatCurrency = (v: number) => `₱${v.toLocaleString()}`;

export default function Expenses() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { isEditMode, role } = useAuth();
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState([{ 
        date: new Date().toISOString().split("T")[0], 
        category: "Operational", 
        item: "", 
        qty: "1", 
        unit: "", 
        amount: "" 
    }]);
    const [editOpen, setEditOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [editData, setEditData] = useState<any>({});

    // Confirmation State
    const [confirmConfig, setConfirmConfig] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: "", message: "", onConfirm: () => {} });

    const fetchExpenses = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });
        
        if (error) {
            toast.error("Failed to load expenses");
            console.error(error);
        } else {
            setExpenses(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const validEntries = entries.filter(e => e.category && e.item && e.amount);
        if (validEntries.length === 0) {
            toast.error("Please fill at least one item completely");
            return;
        }

        const toInsert = validEntries.map(e => ({
            date: e.date,
            category: e.category,
            item: e.item,
            amount: Number(e.amount),
            qty: Number(e.qty || 1),
            unit: e.unit
        }));
        
        const { error } = await supabase.from('expenses').insert(toInsert);
        
        if (error) {
            toast.error("Failed to record expenses");
            console.error(error);
        } else {
            toast.success("Expenses recorded!");
            setEntries([{ 
                date: new Date().toISOString().split("T")[0], 
                category: "Operational", 
                item: "", 
                qty: "1", 
                unit: "", 
                amount: "" 
            }]);
            setOpen(false);
            fetchExpenses();
        }
    };

    const addEntryRow = () => {
        const lastDate = entries[entries.length - 1]?.date || new Date().toISOString().split("T")[0];
        setEntries([...entries, { date: lastDate, category: "Operational", item: "", qty: "1", unit: "", amount: "" }]);
    };

    const removeEntryRow = (idx: number) => {
        if (entries.length > 1) {
            setEntries(entries.filter((_, i) => i !== idx));
        }
    };

    const updateEntry = (idx: number, field: string, value: string) => {
        const updated = [...entries];
        updated[idx] = { ...updated[idx], [field]: value };
        
        // Smart unit/item handling
        if (field === "item" && updated[idx].category === "Raw Ingredients") {
            const ingredient = RAW_INGREDIENTS.find(ri => ri.name === value);
            if (ingredient && ingredient.unit !== "Select") {
                updated[idx].unit = ingredient.unit;
            } else if (ingredient?.name === "Margarine") {
                updated[idx].unit = "Small Tub";
            }
        }
        
        if (field === "category" && value !== "Raw Ingredients") {
            updated[idx].unit = "";
        }
        
        setEntries(updated);
    };

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const [saving, setSaving] = useState(false);

    const handleUpdateExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpense) return;
        setSaving(true);
        const { error } = await supabase.from('expenses').update({
            date: editData.date,
            category: editData.category,
            item: editData.item,
            qty: Number(editData.qty),
            unit: editData.unit,
            amount: Number(editData.amount)
        }).eq('id', editingExpense.id);
        
        setSaving(false);
        if (error) {
            toast.error("Failed to update expense");
        } else {
            toast.success("Expense updated!");
            setEditOpen(false);
            fetchExpenses();
        }
    };

    const handleDeleteExpense = async (id: string) => {
        setConfirmConfig({
            open: true,
            title: "Delete Expense?",
            message: "Are you sure you want to delete this expense? This will permanently remove the record from your accounts.",
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, open: false }));
                const { error } = await supabase.from('expenses').delete().eq('id', id);
                if (error) toast.error("Failed to delete expense");
                else {
                    toast.success("Expense deleted");
                    fetchExpenses();
                }
            }
        });
    };

    const openEdit = (exp: any) => {
        setEditingExpense(exp);
        setEditData({ ...exp });
        setEditOpen(true);
    };

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <PageHeader title="Expenses">
                {role !== 'viewer' && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="touch-target">
                                <Plus className="h-4 w-4 mr-2" />Expense
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl w-[95vw] md:w-full">
                            <DialogHeader>
                                <DialogTitle>Record Expenses</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAdd} className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-2">
                                {entries.map((entry, idx) => (
                                    <div key={idx} className="p-3 border rounded-lg bg-muted/20 relative space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Date</label>
                                            <DatePicker 
                                                date={entry.date} 
                                                onStringChange={(val) => updateEntry(idx, "date", val)} 
                                                className="h-8 text-xs" 
                                            />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Category</label>
                                                <Select value={entry.category} onValueChange={(v) => updateEntry(idx, "category", v)} required>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs pl-3">{c}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-1 lg:col-span-2">
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Item</label>
                                                {entry.category === "Raw Ingredients" ? (
                                                    <Select value={entry.item} onValueChange={(v) => updateEntry(idx, "item", v)} required>
                                                        <SelectTrigger className="h-8 text-xs font-medium"><SelectValue placeholder="Select Ingredient" /></SelectTrigger>
                                                        <SelectContent>
                                                            {RAW_INGREDIENTS.map((ri) => <SelectItem key={ri.name} value={ri.name} className="text-xs pl-3">{ri.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input value={entry.item} onChange={(e) => updateEntry(idx, "item", e.target.value)} placeholder="e.g. Rent" className="h-8 text-xs" required />
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Qty</label>
                                                <Input type="number" value={entry.qty} onChange={(e) => updateEntry(idx, "qty", e.target.value)} className="h-8 text-xs" min={0.1} step={0.1} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Unit</label>
                                                {entry.item === "Margarine" ? (
                                                    <Select value={entry.unit} onValueChange={(v) => updateEntry(idx, "unit", v)}>
                                                        <SelectTrigger className="h-8 text-xs font-medium"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Small Tub" className="text-xs pl-3">Small Tub</SelectItem>
                                                            <SelectItem value="Big Tub" className="text-xs pl-3">Big Tub</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input value={entry.unit} onChange={(e) => updateEntry(idx, "unit", e.target.value)} placeholder="pcs/kg/etc" className="h-8 text-xs bg-muted/30" readOnly={entry.category === "Raw Ingredients"} />
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Amount</label>
                                                <Input type="number" value={entry.amount} onChange={(e) => updateEntry(idx, "amount", e.target.value)} placeholder="₱" className="h-8 text-xs font-bold" required />
                                            </div>
                                        </div>

                                        {entries.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeEntryRow(idx)}
                                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm hover:scale-110 transition-transform"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={addEntryRow} className="flex-1 h-8 text-xs">
                                        <Plus className="h-3 w-3 mr-1" /> Add Another Item
                                    </Button>
                                    <Button type="submit" className="flex-1 h-8 text-xs">
                                        Save All Expenses
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            <div className="bg-card rounded-lg border shadow-sm">
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                    <h2 className="text-sm font-semibold text-foreground">Expense History</h2>
                    <span className="text-sm font-bold text-destructive">Total: {formatCurrency(totalExpenses)}</span>
                </div>
                {isLoading ? (
                     <p className="text-center text-sm text-muted-foreground py-10">Loading expenses...</p>
                ) : expenses.length === 0 ? (
                     <p className="text-center text-sm text-muted-foreground py-10">No expenses recorded.</p>
                ) : (
                    <>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-border">
                            {expenses.map((e, i) => (
                                <div key={e.id} className="relative overflow-hidden group">
                                    {/* Actions (Hidden behind) */}
                                    {isEditMode && (
                                        <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-4 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                                            {role !== 'viewer' && (
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(e)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {role === 'admin' && (
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-red-50" onClick={() => handleDeleteExpense(e.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {/* Main Content */}
                                    <div className={`p-4 flex items-center justify-between gap-3 bg-card transition-transform duration-300 ease-in-out ${isEditMode ? 'group-hover:-translate-x-28' : ''}`}>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">{e.item}</p>
                                            <p className="text-xs text-muted-foreground">{e.date} · {e.category}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-destructive">{formatCurrency(Number(e.amount))}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop grid list */}
                        <div className="hidden md:block">
                            {/* Header */}
                            <div className="grid grid-cols-6 gap-4 px-4 py-3 text-muted-foreground bg-muted/10 border-b border-border text-[10px] uppercase font-bold tracking-wider">
                                <div>Date</div>
                                <div>Category</div>
                                <div className="col-span-2">Item</div>
                                <div className="text-center">Qty/Unit</div>
                                <div className="text-right">Amount</div>
                            </div>
                            
                            {/* Rows */}
                            <div className="divide-y divide-border">
                                {expenses.map((e, i) => (
                                    <div key={e.id || i} className="relative overflow-hidden group">
                                        {/* Actions (Hidden behind) */}
                                        {isEditMode && (
                                            <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-4 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                                                {role !== 'viewer' && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(e)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {role === 'admin' && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => handleDeleteExpense(e.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {/* Row Content */}
                                        <div className={`grid grid-cols-6 gap-4 px-4 py-3 items-center bg-card transition-all duration-300 ease-in-out ${isEditMode ? 'group-hover:-translate-x-24' : ''}`}>
                                            <div className="text-[10px] text-foreground uppercase font-mono">{e.date}</div>
                                            <div>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                    e.category === "Raw Ingredients" ? "bg-orange-100 text-orange-700" :
                                                    e.category === "Operational" ? "bg-blue-100 text-blue-700" :
                                                    "bg-green-100 text-green-700"
                                                }`}>
                                                    {e.category}
                                                </span>
                                            </div>
                                            <div className="col-span-2 text-xs font-bold text-foreground">{e.item}</div>
                                            <div className="text-center text-[10px] text-muted-foreground uppercase font-medium">
                                                {e.qty} {e.unit}
                                            </div>
                                            <div className="text-right text-sm font-black text-destructive">
                                                {formatCurrency(Number(e.amount))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Edit Modal */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-md w-[95vw]">
                    <DialogHeader>
                        <DialogTitle>Edit Expense</DialogTitle>
                    </DialogHeader>
                    {editingExpense && (
                        <form onSubmit={handleUpdateExpense} className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                                    <DatePicker 
                                        date={editData.date} 
                                        onStringChange={(val) => setEditData({...editData, date: val})} 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                                    <Select value={editData.category} onValueChange={(v) => setEditData({...editData, category: v})}>
                                        <SelectTrigger className="h-10 text-xs shadow-sm font-medium"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs pl-3">{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Item</label>
                                <Input value={editData.item} onChange={e => setEditData({...editData, item: e.target.value})} className="h-10 text-xs" required />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Qty</label>
                                    <Input type="number" step="any" value={editData.qty} onChange={e => setEditData({...editData, qty: e.target.value})} className="h-10 text-xs" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit</label>
                                    <Input value={editData.unit} onChange={e => setEditData({...editData, unit: e.target.value})} className="h-10 text-xs" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount</label>
                                    <Input type="number" step="any" value={editData.amount} onChange={e => setEditData({...editData, amount: e.target.value})} className="h-10 text-xs" required />
                                </div>
                            </div>
                            <Button disabled={saving} type="submit" className="w-full h-10">
                                {saving ? "Saving..." : "Update Expense"}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Custom Safety Confirmation Modal */}
            <Dialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-destructive/10 p-6 flex flex-col items-center text-center space-y-3">
                        <div className="bg-white p-3 rounded-full shadow-sm">
                            <Trash2 className="h-6 w-6 text-destructive" />
                        </div>
                        <h3 className="text-lg font-black text-destructive uppercase tracking-tight">{confirmConfig.title}</h3>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            {confirmConfig.message}
                        </p>
                    </div>
                    <div className="p-4 bg-white flex gap-3">
                        <Button 
                            variant="outline" 
                            className="flex-1 h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-muted transition-colors border-muted-foreground/20"
                            onClick={() => setConfirmConfig(prev => ({ ...prev, open: false }))}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            onClick={confirmConfig.onConfirm}
                        >
                            Confirm
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
