import { useState, useEffect } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/StatCard";
import { AlertTriangle, PackageOpen, Trash2, Edit2, RefreshCw, Puzzle, XCircle, Plus, History, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PACK_SIZES, PRODUCTS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function Inventory() {
    const [stock, setStock] = useState<any[]>([]);
    const [unpackedRegularSticks, setUnpackedRegularSticks] = useState(0);
    const [unpackedSmallSticks, setUnpackedSmallSticks] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showConverter, setShowConverter] = useState(false);
    const [activeTool, setActiveTool] = useState<"pack" | "repack">("pack");
    const [conversions, setConversions] = useState<any[]>([]);
    const { isEditMode, role } = useAuth();
    
    // Edit State
    const [editingEntry, setEditingEntry] = useState<any>(null);
    const [editingTxId, setEditingTxId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editPacks, setEditPacks] = useState("");
    const [editSize, setEditSize] = useState("");
    const [editLeftover, setEditLeftover] = useState("");
    const [editType, setEditType] = useState("Packed");

    // Specialized Edit States for Transactions
    const [editPackSize, setEditPackSize] = useState("");
    const [editPackCount, setEditPackCount] = useState("");
    const [editRepackSourceSize, setEditRepackSourceSize] = useState("");
    const [editRepackTargetQty, setEditRepackTargetQty] = useState("");
    const [editRepackTargetSize, setEditRepackTargetSize] = useState("");
    
    // Confirmation State
    const [confirmConfig, setConfirmConfig] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: "", message: "", onConfirm: () => {} });
    
    // Pack Sticks Form State
    const [packSize, setPackSize] = useState("");
    const [packs, setPacks] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    // Repack Form State
    const [repackSourceSize, setRepackSourceSize] = useState("");
    const [repackTargetSize, setRepackTargetSize] = useState("");
    const [repackTargetQty, setRepackTargetQty] = useState("");
    const [returnedAdjustments, setReturnedAdjustments] = useState<any[]>([]);
    const [processingReturn, setProcessingReturn] = useState<any>(null);
    const [repackQty, setRepackQty] = useState("");
    const [repackProduct, setRepackProduct] = useState("");

    const fetchInventory = async () => {
        setIsLoading(true);
        
        const { data: packingData } = await supabase.from('packing').select('*');
        const { data: convHistory } = await supabase
            .from('packing')
            .select('*')
            .in('cook_name', ['System/Packaging', 'System/Returns'])
            .order('created_at', { ascending: false });
            
        const { data: orderItemsData } = await supabase
            .from('order_items')
            .select('*, orders!inner(order_status)');

        const deductedItems = orderItemsData?.filter((item: any) => 
            item.status === 'Packed' || item.orders.order_status === 'Delivered'
        ) || [];
        
        // Use PRODUCTS to build the map
        const inventoryMap = PRODUCTS.reduce((acc: any, p) => {
            acc[p.name] = { 
                productName: p.name, 
                group: p.group, 
                packSize: p.size, 
                totalPacked: 0, 
                totalSold: 0, 
                remaining: 0,
                stickSize: p.stickSize
            };
            return acc;
        }, {});

        let totalUnpackedRegular = 0;
        let totalUnpackedSmall = 0;

        if (packingData) {
            packingData.forEach((entry: any) => {
                if (entry.production_type === 'Unpacked') {
                    const sticks = ((entry.packs_produced || 0) * 11) + (entry.leftover_sticks || 0);
                    const isSmall = entry.notes?.includes('[Style:Small]') || (entry.pack_size === 10); // Legacy check
                    if (isSmall) totalUnpackedSmall += sticks;
                    else totalUnpackedRegular += sticks;
                    return;
                }

                if (entry.production_type === 'Waste') return;
                
                // Match by product name in notes or legacy pack_size
                const prodName = entry.notes?.match(/\[Prod:(.*?)\]/)?.[1];
                if (prodName && inventoryMap[prodName]) {
                    inventoryMap[prodName].totalPacked += (entry.packs_produced || 0);
                } else {
                    // Legacy matching
                    const match = PRODUCTS.find(p => p.size === entry.pack_size && !entry.notes?.includes('Barquillon'));
                    if (match && inventoryMap[match.name]) {
                        inventoryMap[match.name].totalPacked += (entry.packs_produced || 0);
                    }
                }
            });
        }

        if (deductedItems) {
            deductedItems.forEach((item: any) => {
                // ... Orders would need updates too, but for now we match by size (legacy)
                const ps = item.pack_size || item.packSize;
                const match = PRODUCTS.find(p => p.size === ps);
                if (match && inventoryMap[match.name]) {
                    inventoryMap[match.name].totalSold += (item.qty || item.quantity || 0);
                }
            });
        }

        const { data: adjData } = await supabase
            .from('order_adjustments')
            .select('*')
            .eq('is_repacked', false)
            .order('date', { ascending: false });

        const computedStock = Object.values(inventoryMap).map((inv: any) => ({
            ...inv,
            remaining: inv.totalPacked - inv.totalSold
        }));

        setStock(computedStock);
        setUnpackedRegularSticks(totalUnpackedRegular);
        setUnpackedSmallSticks(totalUnpackedSmall);
        setConversions(convHistory || []);
        setReturnedAdjustments(adjData || []);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const handlePackaging = async (e: React.FormEvent) => {
        e.preventDefault();
        const product = PRODUCTS.find(p => p.name === packSize); 
        if (!product) return;

        const numPacks = Number(packs);
        const sticksNeeded = product.size * numPacks * product.multiplier;
        const currentUnpacked = product.stickSize === 'Small' ? unpackedSmallSticks : unpackedRegularSticks;

        if (currentUnpacked < sticksNeeded) {
            toast.error(`Not enough ${product.stickSize} sticks! Need ${sticksNeeded}, have ${currentUnpacked}.`);
            return;
        }

        setSaving(true);
        const txId = crypto.randomUUID().slice(0, 8);

        // 1. Create Packed Entry
        const packedEntry = {
            date,
            cook_name: "System/Packaging",
            pack_size: product.size,
            packs_produced: numPacks,
            production_type: "Packed",
            notes: `Converted from Unpacked Stock [Prod:${product.name}] [Style:${product.stickSize}] [TX:${txId}]`
        };

        // 2. Create Unpacked Deduction Entry
        const deductionEntry = {
            date,
            cook_name: "System/Packaging",
            pack_size: 11,
            packs_produced: -Math.floor(sticksNeeded / 11),
            leftover_sticks: -(sticksNeeded % 11),
            production_type: "Unpacked",
            notes: `Deduction for ${numPacks}x ${product.name} [Style:${product.stickSize}] [TX:${txId}]`
        };

        const { error: err1 } = await supabase.from('packing').insert(packedEntry);
        const { error: err2 } = await supabase.from('packing').insert(deductionEntry);

        setSaving(false);

        if (err1 || err2) {
            toast.error("Partial failure in packaging. Check records.");
        } else {
            toast.success(`Successfully packed ${numPacks} units!`);
            setPacks("");
            fetchInventory();
        }
    };

    const handleRepack = async (e: React.FormEvent) => {
        e.preventDefault();
        const srcProd = PRODUCTS.find(p => p.name === repackSourceSize);
        const tgtProd = PRODUCTS.find(p => p.name === repackTargetSize);
        if (!srcProd || !tgtProd) return;
        
        if (srcProd.stickSize !== tgtProd.stickSize) {
            toast.error(`Cannot repack ${srcProd.stickSize} sticks into ${tgtProd.stickSize} sticks!`);
            return;
        }

        const actualTargetPacks = Number(repackTargetQty);
        if (actualTargetPacks <= 0) return;

        const totalTargetSticks = actualTargetPacks * tgtProd.size;
        // Calculate how many source packs we NEED to open to get these sticks
        const srcQty = Math.ceil(totalTargetSticks / srcProd.size);
        const totalSourceSticks = srcQty * srcProd.size;
        const leftoverSticks = totalSourceSticks - totalTargetSticks;

        const sourceStock = stock.find(p => p.productName === srcProd.name)?.remaining || 0;
        if (srcQty > sourceStock) {
            toast.error(`Not enough ${srcProd.name} in stock! Need to open ${srcQty} packs, have ${sourceStock}.`);
            return;
        }

        setSaving(true);
        const txId = crypto.randomUUID().slice(0, 8);

        const entries: any[] = [
            {
                date,
                cook_name: "System/Packaging",
                pack_size: srcProd.size,
                packs_produced: -srcQty,
                production_type: "Packed",
                notes: `Repacked into ${actualTargetPacks}x ${tgtProd.name} [Prod:${srcProd.name}] [TX:${txId}]`
            },
            {
                date,
                cook_name: "System/Packaging",
                pack_size: tgtProd.size,
                packs_produced: actualTargetPacks,
                production_type: "Packed",
                notes: `Repacked from ${srcQty}x ${srcProd.name} [Prod:${tgtProd.name}] [TX:${txId}]`,
                leftover_sticks: leftoverSticks
            }
        ];

        const { error } = await supabase.from('packing').insert(entries);

        if (error) {
            toast.error("Failed to repack. Try again.");
        } else {
            toast.success("Stock repacked successfully!");
            setRepackTargetQty("");
            fetchInventory();
        }
        setSaving(false);
    };

    const handleProcessReturn = async (adj: any) => {
        const product = PRODUCTS.find(p => p.name === adj.product_name);
        const targetProduct = PRODUCTS.find(p => p.name === repackProduct);
        if (!product || !targetProduct) return;

        const originalQty = Number(adj.quantity);
        const safeQty = Number(repackQty || 0);

        if (safeQty > originalQty) {
            toast.error("Packs to save cannot exceed total returned!");
            return;
        }

        setSaving(true);
        const txId = `RET:${adj.id}:${crypto.randomUUID().slice(0, 4)}`;
        
        try {
            // 1. Add salvaged packs back to Packed stock
            if (safeQty > 0) {
                await supabase.from('packing').insert({
                    date: new Date().toISOString().split('T')[0],
                    cook_name: "System/Returns",
                    pack_size: targetProduct.size,
                    packs_produced: safeQty,
                    production_type: "Packed",
                    notes: `Salvaged as ${targetProduct.name} from Order ${adj.order_id} (${adj.type}) [TX:${txId}]`
                });
            }

            // Note: We no longer insert 'Waste' into packing history as per user request
            // to keep the history clean and strictly for inventory additions.

            // 2. Mark the adjustment as processed
            await supabase.from('order_adjustments')
                .update({ is_repacked: true })
                .eq('id', adj.id);

            toast.success(safeQty > 0 ? "Return processed successfully!" : "Marked as waste.");
            setProcessingReturn(null);
            fetchInventory();
        } catch (error) {
            console.error(error);
            toast.error("Error processing return.");
        } finally {
            setSaving(false);
        }
    };

    const handleMarkAsWaste = async (adj: any) => {
        setConfirmConfig({
            open: true,
            title: "Mark as Waste?",
            message: `This will permanently remove Order #${adj.order_id}'s return (${adj.product_name}) from the list without adding it to stock or history.`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, open: false }));
                setSaving(true);
                const { error } = await supabase.from('order_adjustments')
                    .update({ is_repacked: true })
                    .eq('id', adj.id);
                
                if (error) toast.error("Failed to mark as waste");
                else {
                    toast.success("Return completely removed");
                    fetchInventory();
                }
                setSaving(false);
            }
        });
    };

    const handleDelete = async (id: string) => {
        const itemToDelete = conversions.find(c => c.id === id);
        const txId = itemToDelete?.notes?.match(/\[TX:(.*?)\]/)?.[1];

        if (txId) {
            const isReturn = txId.startsWith('RET-') || txId.startsWith('RET:');
            let adjId = null;
            
            if (isReturn) {
                if (txId.includes(':')) {
                    adjId = txId.split(':')[1];
                } else {
                    // Legacy hyphen format: RET-UUID-SUFFIX (UUID has 4 hyphens total)
                    const parts = txId.split('-');
                    adjId = parts.slice(1, 6).join('-');
                }
            }

            setConfirmConfig({
                open: true,
                title: isReturn ? "Revert Processing?" : "Reverse Transaction?",
                message: isReturn 
                    ? `This record was part of a return process. Deleting it will put the return back into "Pending" so you can re-process it.`
                    : `This record is part of a linked transaction (ID: ${txId}). Deleting it will also remove all partner movements to keep your inventory balanced.`,
                onConfirm: async () => {
                    setConfirmConfig(prev => ({ ...prev, open: false }));
                    
                    // 1. Revert adjustment if it's a return
                    if (isReturn && adjId) {
                        const { error: adjErr } = await supabase
                            .from('order_adjustments')
                            .update({ is_repacked: false })
                            .eq('id', adjId);
                        if (adjErr) {
                            toast.error("Failed to revert pending status");
                            return;
                        }
                    }

                    // 2. Delete the packing records
                    const { error } = await supabase.from('packing').delete().ilike('notes', `%[TX:${txId}]%`);
                    
                    if (error) toast.error("Group delete failed");
                    else {
                        toast.success(isReturn ? "Return reverted to pending" : "Transaction reversed successfully");
                        fetchInventory();
                    }
                }
            });
        } else {
            setConfirmConfig({
                open: true,
                title: "Delete Record?",
                message: "Are you sure you want to delete this record? This will immediately affect your stock levels.",
                onConfirm: async () => {
                    setConfirmConfig(prev => ({ ...prev, open: false }));
                    const { error } = await supabase.from('packing').delete().eq('id', id);
                    if (error) toast.error("Delete failed");
                    else {
                        toast.success("Record deleted");
                        fetchInventory();
                    }
                }
            });
        }
    };

    const openEdit = async (e: any) => {
        const txId = e.notes?.match(/\[TX:(\w+)\]/)?.[1];
        if (txId) {
            setEditingTxId(txId);
            setEditDate(e.date);
            
            // Fetch ALL related rows to populate the form correctly
            const { data: txRows } = await supabase.from('packing').select('*').ilike('notes', `%[TX:${txId}]%`);
            if (txRows) {
                const isRepack = txRows.some(r => r.notes?.toLowerCase().includes('repack'));
                if (isRepack) {
                    setEditType("Repack");
                    const source = txRows.find(r => r.packs_produced < 0 && r.production_type === 'Packed');
                    const target = txRows.find(r => r.packs_produced > 0 && r.production_type === 'Packed');
                    if (source) {
                        const prodName = source.notes?.match(/\[Prod:(.*?)\]/)?.[1] || PRODUCTS.find(p => p.size === source.pack_size)?.name;
                        if (prodName) setEditRepackSourceSize(prodName);
                    }
                    if (target) {
                        const prodName = target.notes?.match(/\[Prod:(.*?)\]/)?.[1] || PRODUCTS.find(p => p.size === target.pack_size)?.name;
                        if (prodName) setEditRepackTargetSize(prodName);
                        setEditRepackTargetQty(target.packs_produced.toString());
                    }
                } else {
                    setEditType("PackSticks");
                    const target = txRows.find(r => r.packs_produced > 0 && r.production_type === 'Packed');
                    if (target) {
                        const prodName = target.notes?.match(/\[Prod:(.*?)\]/)?.[1];
                        setEditPackSize(prodName || target.pack_size.toString());
                        setEditPackCount(target.packs_produced.toString());
                    }
                }
            }
        } else {
            setEditingTxId(null);
            setEditingEntry(e);
            setEditDate(e.date);
            setEditPacks(e.packs_produced.toString());
            setEditSize((e.pack_size || 11).toString());
            setEditLeftover((e.leftover_sticks || 0).toString());
            setEditType(e.production_type || "Packed");
        }
    };

    const handleUpdate = async () => {
        if (!editingEntry && !editingTxId) return;
        setSaving(true);

        try {
            if (editingTxId) {
                // 1. Delete all old rows
                const { error: delErr } = await supabase.from('packing').delete().ilike('notes', `%[TX:${editingTxId}]%`);
                if (delErr) throw delErr;

                // 2. Insert new rows based on editType
                if (editType === 'PackSticks') {
                    const product = PRODUCTS.find(p => p.name === editPackSize);
                    if (!product) throw new Error("Product not found");

                    const numPacks = Number(editPackCount);
                    const sticksNeeded = numPacks * product.size * product.multiplier;
                    
                    const packedEntry = {
                        date: editDate,
                        cook_name: "System/Packaging",
                        pack_size: product.size,
                        packs_produced: numPacks,
                        production_type: "Packed",
                        notes: `Converted from Unpacked Stock [Prod:${product.name}] [Style:${product.stickSize}] [TX:${editingTxId}]`
                    };
                    const deductionEntry = {
                        date: editDate,
                        cook_name: "System/Packaging",
                        pack_size: 11,
                        packs_produced: -Math.floor(sticksNeeded / 11),
                        leftover_sticks: -(sticksNeeded % 11),
                        production_type: "Unpacked",
                        notes: `Deduction for ${numPacks}x ${product.name} [Style:${product.stickSize}] [TX:${editingTxId}]`
                    };
                    await supabase.from('packing').insert([packedEntry, deductionEntry]);
                } else if (editType === 'Repack') {
                    const srcProd = PRODUCTS.find(p => p.name === editRepackSourceSize);
                    const tgtProd = PRODUCTS.find(p => p.name === editRepackTargetSize);
                    if (!srcProd || !tgtProd) throw new Error("Invalid repacking products");

                    const tgtQty = Number(editRepackTargetQty);
                    
                    const totalSticksNeeded = tgtProd.size * tgtQty;
                    const srcPacksNeeded = Math.ceil(totalSticksNeeded / srcProd.size);
                    const leftoverSticks = (srcPacksNeeded * srcProd.size) - totalSticksNeeded;

                    const entries: any[] = [
                        {
                            date: editDate,
                            cook_name: "System/Packaging",
                            pack_size: srcProd.size,
                            packs_produced: -srcPacksNeeded,
                            production_type: "Packed",
                            notes: `Repacked into ${tgtQty}x ${tgtProd.name} [Prod:${srcProd.name}] [Style:${srcProd.stickSize}] [TX:${editingTxId}]`
                        },
                        {
                            date: editDate,
                            cook_name: "System/Packaging",
                            pack_size: tgtProd.size,
                            packs_produced: tgtQty,
                            production_type: "Packed",
                            notes: `Repacked from ${srcPacksNeeded}x ${srcProd.name} [Prod:${tgtProd.name}] [Style:${tgtProd.stickSize}] [TX:${editingTxId}]`
                        }
                    ];
                    if (leftoverSticks > 0) {
                        entries.push({
                            date: editDate,
                            cook_name: "System/Packaging",
                            pack_size: 11,
                            packs_produced: Math.floor(leftoverSticks / 11),
                            leftover_sticks: leftoverSticks % 11,
                            production_type: "Unpacked",
                            notes: `Leftover from repacking ${srcProd.name} to ${tgtProd.name} [Style:${srcProd.stickSize}] [TX:${editingTxId}]`
                        });
                    }
                    await supabase.from('packing').insert(entries);
                }
                setEditingTxId(null);
            } else {
                // Original single row update
                const { error } = await supabase.from('packing').update({
                    date: editDate,
                    packs_produced: Number(editPacks),
                    pack_size: Number(editSize),
                    leftover_sticks: Number(editLeftover),
                    production_type: editType
                }).eq('id', editingEntry.id);
                if (error) throw error;
                setEditingEntry(null);
            }

            toast.success("Record updated successfully");
            fetchInventory();
        } catch (error) {
            console.error(error);
            toast.error("Update failed. Inventory may be out of sync.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <PageHeader title="Inventory Overview" />
            
            <div className="bg-card rounded-xl border shadow-sm p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                        <Puzzle className="h-4 w-4 text-primary" />
                        Unpacked
                    </h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4 divide-x divide-border">
                    <div className="pr-4">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                            Regular Sticks
                        </h3>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-foreground tracking-tight">{unpackedRegularSticks.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">pcs</span>
                        </div>
                    </div>
                    
                    <div className="pl-4">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                            Small Sticks
                        </h3>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-foreground tracking-tight">{unpackedSmallSticks.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">pcs</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Centralized Action Toolbar */}
            {role !== 'viewer' && (
                <div className="flex justify-end mb-4 px-1">
                    <div className="flex items-center bg-muted/50 p-1 rounded-xl border shadow-sm w-fit">
                        <button 
                            className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-xs font-bold uppercase rounded-lg transition-all ${showConverter && activeTool === 'pack' ? 'bg-white text-blue-600 shadow border border-border/50' : 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground'}`}
                            onClick={() => {
                                if (showConverter && activeTool === 'pack') setShowConverter(false);
                                else { setShowConverter(true); setActiveTool('pack'); }
                            }}
                        >
                            <PackageOpen size={14} className="md:size-4" />
                            <span className="md:inline">Pack Sticks</span>
                        </button>
                        <button 
                            className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-xs font-bold uppercase rounded-lg transition-all ${showConverter && activeTool === 'repack' ? 'bg-white text-purple-600 shadow border border-border/50' : 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground'}`}
                            onClick={() => {
                                if (showConverter && activeTool === 'repack') setShowConverter(false);
                                else { setShowConverter(true); setActiveTool('repack'); }
                            }}
                        >
                            <RefreshCw size={12} className="md:size-4" />
                            <span className="md:inline">Repack Stock</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Packaging Interface */}
            {showConverter && (
                <div className="bg-card rounded-lg border shadow-sm p-4 space-y-4 border-l-4 overflow-hidden relative animate-in slide-in-from-top duration-300 transition-colors"
                     style={{ borderLeftColor: activeTool === 'pack' ? '#3b82f6' : '#a855f7' }}>
                    
                    <div className="absolute right-[-10px] top-[-10px] opacity-10 rotate-12"
                         style={{ color: activeTool === 'pack' ? '#3b82f6' : '#a855f7' }}>
                        <PackageOpen size={100} />
                    </div>
                    
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">
                                {activeTool === 'pack' ? 'Convert Sticks to Packed' : 'Repack Existing Stock'}
                            </h2>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                {activeTool === 'pack' ? 'Create packs using available raw sticks' : 'Convert between different pack sizes'}
                            </p>
                        </div>
                        <div className="text-[10px] font-black uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {activeTool} tool
                        </div>
                    </div>

                    {activeTool === 'pack' ? (
                        <form onSubmit={handlePackaging} className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                                <div>
                                    <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Date</label>
                                    <DatePicker 
                                        date={date} 
                                        onStringChange={setDate} 
                                        className="text-xs h-9 md:h-10" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Target Product</label>
                                    <Select value={packSize} onValueChange={setPackSize} required>
                                        <SelectTrigger className="text-[11px] md:text-xs h-9 md:h-10 font-medium transition-all group-hover:border-blue-400 bg-white/50"><SelectValue placeholder="Pick Product" /></SelectTrigger>
                                        <SelectContent>
                                            {PRODUCTS.map((p) => (
                                                <SelectItem key={p.name} value={p.name} triggerText={p.name} className="py-2">
                                                    <div className="text-[9px] text-muted-foreground font-medium mt-0.5">
                                                        {p.stickSize} Sticks • {p.multiplier === 0.5 ? 'Half Stick' : 'Whole Stick'}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Quantity</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={packs}
                                        onChange={(e) => setPacks(e.target.value)}
                                        min={1}
                                        required
                                        className="text-[11px] md:text-sm h-9 md:h-10"
                                    />
                                </div>
                                <div className="flex items-end col-span-2 md:col-span-1">
                                    <Button disabled={saving || !packSize || !packs} type="submit" className="w-full text-xs md:text-sm font-semibold h-9 md:h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                                        Pack
                                    </Button>
                                </div>
                            </div>
                            
                            {packSize && packs && (
                                <div className="p-2 bg-blue-50/10 rounded border border-blue-100 flex items-center justify-between relative z-10 mt-2">
                                    <p className="text-[10px] text-blue-700 font-bold uppercase">
                                        Needed: {PRODUCTS.find(p => p.name === packSize)?.size! * Number(packs) * PRODUCTS.find(p => p.name === packSize)?.multiplier!} {PRODUCTS.find(p => p.name === packSize)?.stickSize} Sticks
                                    </p>
                                    <p className={`text-[10px] font-bold uppercase transition-colors ${(PRODUCTS.find(p => p.name === packSize)?.stickSize === 'Small' ? unpackedSmallSticks : unpackedRegularSticks) < (PRODUCTS.find(p => p.name === packSize)?.size! * Number(packs) * PRODUCTS.find(p => p.name === packSize)?.multiplier!) ? 'text-red-600' : 'text-blue-700'}`}>
                                        Stock: {PRODUCTS.find(p => p.name === packSize)?.stickSize === 'Small' ? unpackedSmallSticks : unpackedRegularSticks}
                                    </p>
                                </div>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={handleRepack} className="space-y-4">
                             <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
                                <div className="col-span-1 lg:col-span-1">
                                    <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Source</label>
                                    <Select value={repackSourceSize} onValueChange={setRepackSourceSize} required>
                                        <SelectTrigger className="text-[11px] md:text-xs h-9 md:h-10"><SelectValue placeholder="From" /></SelectTrigger>
                                        <SelectContent>
                                            {PRODUCTS.filter(p => p.group !== "Barquillon Classic").map(p => (
                                                <SelectItem key={p.name} value={p.name} triggerText={p.name} />
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1 lg:col-span-1">
                                    <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Target</label>
                                    <Select value={repackTargetSize} onValueChange={setRepackTargetSize} required>
                                        <SelectTrigger className="text-[11px] md:text-xs h-9 md:h-10"><SelectValue placeholder="To" /></SelectTrigger>
                                        <SelectContent>
                                            {PRODUCTS.filter(p => !repackSourceSize || PRODUCTS.find(s => s.name === repackSourceSize)?.stickSize === p.stickSize).map(p => (
                                                <SelectItem key={p.name} value={p.name} triggerText={p.name} />
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Quantity</label>
                                    <Input type="number" value={repackTargetQty} onChange={(e) => setRepackTargetQty(e.target.value)} placeholder="0" className="h-9 md:h-10 text-xs" required />
                                </div>
                                <div className="flex items-end col-span-1 lg:col-span-1">
                                    <Button disabled={saving || !repackSourceSize || !repackTargetSize || !repackTargetQty} type="submit" className="w-full h-9 md:h-10 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md">
                                        Repack
                                    </Button>
                                </div>
                             </div>

                            {repackSourceSize && repackTargetSize && repackTargetQty && (
                                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 relative z-10 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] uppercase font-black text-purple-600/70">
                                                Calculation Breakdown
                                            </p>
                                            <p className="text-[11px] font-bold text-foreground">
                                                {repackTargetQty} Packs of {repackTargetSize} Needs {Number(repackTargetQty) * (PRODUCTS.find(p => p.name === repackTargetSize)?.size || 0)} sticks
                                            </p>
                                            <p className="text-[9px] text-muted-foreground italic">
                                                Requires opening **{Math.ceil((Number(repackTargetQty) * (PRODUCTS.find(p => p.name === repackTargetSize)?.size || 0)) / (PRODUCTS.find(p => p.name === repackSourceSize)?.size || 1))}** packs of {repackSourceSize}
                                            </p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="text-[9px] uppercase font-black text-purple-700/60">
                                                After Repack
                                            </p>
                                            <p className="text-[10px] font-bold text-success">
                                                +{repackTargetQty} packs in stock
                                            </p>
                                            {(Math.ceil((Number(repackTargetQty) * (PRODUCTS.find(p => p.name === repackTargetSize)?.size || 0)) / (PRODUCTS.find(p => p.name === repackSourceSize)?.size || 1)) * (PRODUCTS.find(p => p.name === repackSourceSize)?.size || 0)) % (PRODUCTS.find(p => p.name === repackTargetSize)?.size || 1) > 0 && (
                                                <p className="text-[9px] text-orange-600 font-medium">
                                                    + { (Math.ceil((Number(repackTargetQty) * (PRODUCTS.find(p => p.name === repackTargetSize)?.size || 0)) / (PRODUCTS.find(p => p.name === repackSourceSize)?.size || 1)) * (PRODUCTS.find(p => p.name === repackSourceSize)?.size || 0)) - (Number(repackTargetQty) * (PRODUCTS.find(p => p.name === repackTargetSize)?.size || 0)) } Extra Sticks
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                    )}
                </div>
            )}

            <div className="bg-card rounded-lg border shadow-sm">
                <div className="p-4 border-b border-border bg-muted/30">
                    <h2 className="text-sm font-semibold text-foreground">Product Stock</h2>
                </div>

                {isLoading ? (
                    <p className="text-center text-sm text-muted-foreground py-10">Calculating inventory...</p>
                ) : (
                    <>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-border">
                            {stock.map((p) => (
                                <div key={p.productName} className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-foreground">{p.productName}</p>
                                        {p.remaining === 0 ? (
                                            <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-medium">
                                                <XCircle className="h-3 w-3" /> No Stock
                                            </span>
                                        ) : p.remaining < 200 ? (
                                            <span className="flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full font-medium">
                                                <AlertTriangle className="h-3 w-3" /> Low
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">In Stock</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                                        <span className="font-bold uppercase tracking-wider text-[10px]">Current Stock</span>
                                        <strong className={`text-base font-black ${p.remaining === 0 ? "text-destructive" : p.remaining < 200 ? "text-warning" : "text-success"}`}>
                                            {p.remaining.toLocaleString()}
                                            <span className="text-[9px] font-bold ml-1 uppercase opacity-60">packs</span>
                                        </strong>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-muted-foreground bg-muted/5 uppercase tracking-[0.15em] text-[10px]">
                                        <th className="text-left px-6 py-4 font-black">Product Name</th>
                                        <th className="text-right px-6 py-4 font-black">Current Stock</th>
                                        <th className="text-center px-6 py-4 font-black">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {stock.map((p) => (
                                        <tr key={p.productName} className="hover:bg-muted/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-foreground">
                                                <div className="text-sm font-bold">{p.productName}</div>
                                                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{p.stickSize} Sticks</div>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black text-lg ${p.remaining === 0 ? "text-destructive" : p.remaining < 200 ? "text-warning" : "text-success"}`}>
                                                {p.remaining.toLocaleString()}
                                                <span className="text-[10px] font-bold ml-1.5 opacity-50 uppercase">packs</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {p.remaining === 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                                                        <XCircle className="h-3 w-3" /> No Stock
                                                    </span>
                                                ) : p.remaining < 200 ? (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
                                                        <AlertTriangle className="h-3 w-3" /> Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">In Stock</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Conversion History */}
            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-blue-50/30">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <PackageOpen className="h-4 w-4 text-blue-500" />
                        Conversion History
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    {conversions.length === 0 ? (
                        <div className="p-10 text-center text-muted-foreground text-xs uppercase font-bold">No conversions yet</div>
                    ) : (
                        <div className="divide-y divide-border">
                            {conversions.map((conv) => (
                                <div key={conv.id} className="relative overflow-hidden group border-l-2 border-l-transparent hover:border-l-blue-400">
                                    {/* Actions (Hidden behind) */}
                                    {isEditMode && (
                                        <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-4 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                                            {role !== 'viewer' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(conv)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {role === 'admin' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-red-50" onClick={() => handleDelete(conv.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {/* Content Row */}
                                    <div className={`p-3 grid grid-cols-4 gap-4 items-center bg-card transition-transform duration-300 ease-in-out ${isEditMode ? 'group-hover:-translate-x-24' : ''}`}>
                                        <div>
                                            <p className="text-[10px] font-bold text-foreground">{conv.date}</p>
                                            <p className="text-[8px] font-mono text-muted-foreground uppercase">{new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] px-1 rounded uppercase font-bold border ${
                                                    conv.production_type === 'Waste' ? 'text-destructive bg-destructive/5 border-destructive/20' :
                                                    conv.cook_name === 'System/Returns' && conv.production_type === 'Unpacked' ? 'text-success bg-success/5 border-success/20' :
                                                    conv.production_type === 'Unpacked' ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                                                    'text-blue-600 bg-blue-50 border-blue-100'
                                                }`}>
                                                    {conv.production_type === 'Waste' ? 'Waste' :
                                                     conv.cook_name === 'System/Returns' && conv.production_type === 'Unpacked' ? 'Recovered' : 
                                                     conv.production_type === 'Unpacked' ? 'Deducted' : 'Added'}
                                                </span>
                                                <p className="text-[10px] text-muted-foreground truncate italic">
                                                    "{conv.notes?.split(' [TX:')[0]}"
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xs ${
                                                conv.production_type === 'Waste' ? 'text-destructive' :
                                                conv.cook_name === 'System/Returns' && conv.production_type === 'Unpacked' ? 'text-success' :
                                                conv.production_type === 'Unpacked' ? 'text-orange-600' : 
                                                'text-blue-600'
                                            }`}>
                                                {conv.production_type === 'Unpacked' 
                                                    ? `${Math.abs((conv.packs_produced || 0) * 11 + (conv.leftover_sticks || 0))} sticks` 
                                                    : `${conv.packs_produced} packs`
                                                }
                                            </p>
                                            <p className="text-[9px] text-muted-foreground uppercase">
                                                {conv.production_type === 'Waste' ? 'Thrown Out' :
                                                 conv.cook_name === 'System/Returns' && conv.production_type === 'Unpacked' ? 'Salvaged Back' :
                                                 conv.production_type === 'Unpacked' ? 'Deducted' : (conv.notes?.match(/\[Prod:(.*?)\]/)?.[1] || `${conv.pack_size}rd`)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingEntry || !!editingTxId} onOpenChange={(open) => {
                if (!open) { setEditingEntry(null); setEditingTxId(null); }
            }}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit2 className="h-4 w-4 text-blue-500" />
                            {editingTxId ? `Edit ${editType === 'Repack' ? 'Repacking' : 'Pack Sticks'}` : 'Edit Entry'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-xs text-muted-foreground uppercase mb-1 block">Date</label>
                            <DatePicker 
                                date={editDate} 
                                onStringChange={setEditDate} 
                                className="h-10" 
                            />
                        </div>

                        {editType === 'PackSticks' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase mb-1 block">Target Product</label>
                                    <Select value={editPackSize} onValueChange={setEditPackSize}>
                                        <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PRODUCTS.map(p => <SelectItem key={p.name} value={p.name} className="text-xs uppercase">{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase mb-1 block">Packs</label>
                                    <Input type="number" value={editPackCount} onChange={e => setEditPackCount(e.target.value)} className="h-10" />
                                </div>
                            </div>
                        ) : editType === 'Repack' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Source Product</label>
                                        <Select value={editRepackSourceSize} onValueChange={setEditRepackSourceSize}>
                                            <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {PRODUCTS.map(p => <SelectItem key={p.name} value={p.name} className="text-xs uppercase">{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Target Product</label>
                                        <Select value={editRepackTargetSize} onValueChange={setEditRepackTargetSize}>
                                            <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {PRODUCTS.map(p => <SelectItem key={p.name} value={p.name} className="text-xs uppercase">{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Target Quantity</label>
                                    <Input type="number" value={editRepackTargetQty} onChange={e => setEditRepackTargetQty(e.target.value)} className="h-10" />
                                </div>
                            </div>
                        ) : (
                            // Standard Edit UI
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Entry Type</label>
                                        <Select value={editType} onValueChange={setEditType}>
                                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Packed">Packed</SelectItem>
                                                <SelectItem value="Unpacked">Unpacked</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Size</label>
                                        <Input type="number" value={editSize} onChange={e => setEditSize(e.target.value)} className="h-10" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Packs/Units</label>
                                        <Input type="number" value={editPacks} onChange={e => setEditPacks(e.target.value)} className="h-10" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Leftovers</label>
                                        <Input type="number" value={editLeftover} onChange={e => setEditLeftover(e.target.value)} className="h-10" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-start gap-3 mt-2">
                            <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                                <strong>Transaction Safety:</strong> This update will automatically recalculate and balance all linked inventory records for this {editingTxId ? 'transaction' : 'entry'}.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" className="h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest sm:flex-1" onClick={() => { setEditingEntry(null); setEditingTxId(null); }}>Cancel</Button>
                        <Button disabled={saving} onClick={handleUpdate} className="h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest sm:flex-1 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                            {saving ? 'Saving...' : 'Update Record'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Safety Confirmation Modal */}
            <Dialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                    <div className="bg-destructive/10 p-6 flex flex-col items-center text-center space-y-3">
                        <div className="bg-white p-3 rounded-full shadow-sm">
                            <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" />
                        </div>
                        <h3 className="text-lg font-black text-destructive uppercase tracking-tight">{confirmConfig.title}</h3>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            {confirmConfig.message}
                        </p>
                    </div>
                    <div className="p-4 bg-white flex gap-3">
                        <Button 
                            variant="outline" 
                            className="flex-1 h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-muted transition-colors"
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

            {/* Process Return Dialog */}
            <Dialog open={!!processingReturn} onOpenChange={(open) => !open && setProcessingReturn(null)}>
                <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                    <div className="bg-primary/10 p-6 flex flex-col items-center text-center space-y-2">
                        <div className="bg-white p-3 rounded-full shadow-sm text-primary">
                            <RefreshCw className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-black text-primary uppercase tracking-tight">Process Damage / Return</h3>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                            Order #{processingReturn?.order_id} • {processingReturn?.product_name}
                        </p>
                    </div>
                    <div className="p-6 space-y-6 bg-white">
                        <div className="p-3 bg-muted/30 rounded-xl flex justify-between items-center text-center">
                            <div className="flex-1">
                                <label className="text-[9px] uppercase font-black text-muted-foreground mb-1 block">Total Returned</label>
                                <p className="text-sm font-bold text-foreground">{processingReturn?.quantity} Packs</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] uppercase font-black text-muted-foreground mb-1 block">Packs to Save</label>
                                <Input 
                                    type="number" 
                                    value={repackQty} 
                                    onChange={(e) => setRepackQty(e.target.value)}
                                    placeholder="0"
                                    className="h-10 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-black text-muted-foreground mb-1 block">Target Product</label>
                                <Select value={repackProduct} onValueChange={setRepackProduct}>
                                    <SelectTrigger className="h-10 text-[11px] font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRODUCTS.map(p => (
                                            <SelectItem key={p.name} value={p.name} className="text-xs">{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="bg-destructive/5 p-4 rounded-xl border border-destructive/10 text-center">
                            <label className="text-[10px] uppercase font-black text-destructive/70 mb-1 block">Remaining Waste</label>
                            <p className="text-2xl font-black text-destructive">
                                {Math.max(0, Number(processingReturn?.quantity || 0) - Number(repackQty || 0))} 
                                <span className="text-xs font-bold text-destructive/60 ml-2 uppercase">Packs</span>
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button 
                                className="w-full h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                                onClick={() => handleProcessReturn(processingReturn)}
                                disabled={saving}
                            >
                                {saving ? "SAVING..." : "Confirm & Repack"}
                            </Button>
                            <Button variant="ghost" className="w-full h-9 rounded-xl font-bold uppercase text-[9px] text-muted-foreground tracking-widest" onClick={() => setProcessingReturn(null)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Floating Returns Button */}
            {returnedAdjustments.length > 0 && (
                <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
                    <Button 
                        onClick={() => {
                            const el = document.getElementById('returns-section');
                            el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="h-14 w-14 md:h-16 md:w-16 rounded-full shadow-2xl bg-destructive hover:bg-destructive/90 text-white relative group active:scale-95 transition-all"
                    >
                        <RefreshCw className="h-6 w-6 md:h-7 md:w-7 animate-spin-slow group-hover:rotate-180 transition-transform duration-500" />
                        <span className="absolute -top-1 -right-1 bg-white text-destructive text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center border-2 border-destructive shadow-md ring-4 ring-destructive/10">
                            {returnedAdjustments.length}
                        </span>
                    </Button>
                </div>
            )}

            <div id="returns-section" />
            {returnedAdjustments.length > 0 && (
                <div className="mt-12 bg-destructive/5 rounded-2xl border-2 border-dashed border-destructive/20 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h3 className="text-xs font-black text-destructive uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <History className="h-4 w-4" /> Returns Pending Process ({returnedAdjustments.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {returnedAdjustments.map((adj) => (
                            <div key={adj.id} className="bg-white p-4 rounded-xl border border-destructive/20 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Package className="h-12 w-12 text-destructive" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Order #{adj.order_id}</p>
                                            <h4 className="text-sm font-bold text-foreground">{adj.product_name}</h4>
                                        </div>
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-destructive/10 text-destructive">{adj.type}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-4">
                                        <p className="text-xs font-black text-destructive">{adj.quantity} Packs</p>
                                        <div className="flex gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 w-8 p-0 text-destructive border-destructive/30 hover:bg-destructive hover:text-white transition-all rounded-lg" 
                                                onClick={() => handleMarkAsWaste(adj)}
                                                title="Mark as Waste"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase text-destructive border-destructive/30 hover:bg-destructive hover:text-white transition-all rounded-lg" onClick={() => {
                                                setProcessingReturn(adj);
                                                setRepackQty(adj.quantity.toString());
                                                setRepackProduct(adj.product_name);
                                            }}>
                                                Process & Repack
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground mt-2 italic">Recorded on {adj.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
