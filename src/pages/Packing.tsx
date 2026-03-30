import { useState, useEffect, useRef } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PACK_SIZES, PRODUCTS, STICK_SIZES } from "@/lib/mock-data";
import { Plus, Trash2, Edit2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

export default function Packing() {
  const [entries, setEntries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [cook, setCook] = useState("");
  const [packSize, setPackSize] = useState("");
  const [packs, setPacks] = useState("");
  const [leftoverSticks, setLeftoverSticks] = useState("");
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isEditMode, role } = useAuth();
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPacks, setEditPacks] = useState("");
  const [editCook, setEditCook] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editDate, setEditDate] = useState("");
  const [productionType, setProductionType] = useState("Packed");
  const [editType, setEditType] = useState("Packed");
  const [editLeftover, setEditLeftover] = useState("");
  const [stickSize, setStickSize] = useState<string>("Regular");
  const [editStickSize, setEditStickSize] = useState<string>("Regular");

  // Confirmation State
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const packsInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = async () => {
    setIsLoading(true);
    const { data: fetchedEntries, error } = await supabase
      .from('packing')
      .select('*')
      .neq('cook_name', 'System/Packaging')
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error("Failed to load packing records");
      console.error(error);
    } else {
      setEntries(fetchedEntries || []);
    }
    setIsLoading(false);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase.from('employees').select('*');
    if (!error && data) {
        setEmployees(data);
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchEmployees();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cook || !packSize || !packs) {
      toast.error("Please fill all fields");
      return;
    }
    const ps = productionType === "Packed" ? (PRODUCTS.find(p => p.name === packSize)?.size || Number(packSize)) : Number(packSize);
    const pk = Number(packs);
    
    // Tagging logic
    let notes = "";
    if (productionType === "Packed") {
        const prod = PRODUCTS.find(p => p.name === packSize);
        if (prod) notes = `[Prod:${prod.name}] [Style:${stickSize}]`;
    } else {
        notes = `[Style:${stickSize}]`;
    }

    const newEntry = {
      date,
      cook_name: cook,     
      pack_size: ps,       
      packs_produced: pk,   
      production_type: productionType,
      leftover_sticks: productionType === "Unpacked" ? Number(leftoverSticks || 0) : 0,
      notes
    };
    
    setSaving(true);
    
    const { error } = await supabase
        .from('packing')
        .insert(newEntry)
        .select()
        .single();
        
    setSaving(false);

    if (error) {
        toast.error(`Error: ${error.message} - Please run the SQL commands.`);
        console.error(error);
    } else {
        toast.success("Production logged seamlessly!");
        setPacks("");
        setLeftoverSticks("");
        fetchEntries();
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      open: true,
      title: "Delete Production?",
      message: "This entry will be permanently removed from the daily logs and cook payroll. This action cannot be undone.",
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, open: false }));
        const { error } = await supabase.from('packing').delete().eq('id', id);
        if (error) {
          toast.error("Failed to delete record");
          console.error(error);
        } else {
          toast.success("Record deleted");
          fetchEntries();
        }
      }
    });
  };

  const openEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditCook(entry.cook_name);
    setEditSize(entry.pack_size.toString());
    setEditPacks(entry.packs_produced.toString());
    setEditDate(entry.date);
    setEditType(entry.production_type || "Packed");
    setEditLeftover((entry.leftover_sticks || 0).toString());
    setEditStickSize(entry.notes?.match(/\[Style:(.*?)\]/)?.[1] || "Regular");
    setEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editCook || !editSize || !editPacks) {
        toast.error("Please fill all fields");
        return;
    }
    
    let notes = "";
    if (editType === "Packed") {
        const prod = PRODUCTS.find(p => p.name === editSize);
        if (prod) notes = `[Prod:${prod.name}] [Style:${editStickSize}]`;
    } else {
        notes = `[Style:${editStickSize}]`;
    }

    const { error } = await supabase
        .from('packing')
        .update({
            date: editDate,
            cook_name: editCook,
            pack_size: editType === "Packed" ? (PRODUCTS.find(p => p.name === editSize)?.size || Number(editSize)) : Number(editSize),
            packs_produced: Number(editPacks),
            production_type: editType,
            leftover_sticks: editType === "Unpacked" ? Number(editLeftover || 0) : 0,
            notes
        })
        .eq('id', editingEntry.id);
        
    if (error) {
        toast.error(`Error: ${error.message} - Please run the SQL commands.`);
        console.error(error);
    } else {
        toast.success("Record updated");
        setEditModalOpen(false);
        fetchEntries();
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Daily Packing" />

      {/* Quick Entry Form */}
      {role !== 'viewer' && (
        <form onSubmit={handleAdd} className="bg-card rounded-lg border p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">New Batch</h2>
            <Select value={productionType} onValueChange={(v) => {
                setProductionType(v);
                if (v === "Unpacked") {
                    setPackSize("11");
                }
            }}>
                <SelectTrigger className="w-[180px] h-9 md:h-10 text-xs shadow-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Packed" className="text-xs pl-3">Packed</SelectItem>
                  <SelectItem value="Unpacked" className="text-xs pl-3">Unpacked (By 11)</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Date</label>
              <DatePicker 
                  date={date} 
                  onStringChange={setDate} 
                  className="text-xs h-9 md:h-10" 
              />
            </div>
            <div>
              <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Cook</label>
              <Select value={cook} onValueChange={setCook} required>
                <SelectTrigger className="text-xs h-9 md:h-10 touch-target"><SelectValue placeholder="Select cook" /></SelectTrigger>
                <SelectContent>
                  {employees.filter(c => c.role?.toLowerCase().includes("cook")).length > 0 ? employees.filter(c => c.role?.toLowerCase().includes("cook")).map((c) => (
                      <SelectItem key={c.id} value={c.names} className="text-xs pl-3">
                          {c.names}
                      </SelectItem>
                  )) : (
                      <SelectItem value="none" className="text-xs" disabled>No cooks found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {productionType === "Packed" && (
              <div>
                <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Product</label>
                <Select value={packSize} onValueChange={setPackSize} required>
                  <SelectTrigger className="text-xs h-9 md:h-10 touch-target transition-all"><SelectValue placeholder="Pick Product" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.filter(p => p.group !== "Barquillon Classic").map((p) => (
                      <SelectItem key={p.name} value={p.name} className="text-xs pl-3">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {productionType === "Unpacked" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Size</label>
                <Select value={stickSize} onValueChange={setStickSize} required>
                  <SelectTrigger className="touch-target text-xs transition-all"><SelectValue placeholder="Size" /></SelectTrigger>
                  <SelectContent>
                    {STICK_SIZES.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs pl-3">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">
                {productionType === "Unpacked" ? "Qty (By 11)" : "Packs Produced"}
              </label>
              <Input
                type="number"
                placeholder="0"
                value={packs}
                onChange={(e) => setPacks(e.target.value)}
                className="text-xs h-9 md:h-10 touch-target"
                min={1}
                ref={packsInputRef}
                required
              />
            </div>
            {productionType === "Unpacked" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Leftover Sticks</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={leftoverSticks}
                  onChange={(e) => setLeftoverSticks(e.target.value)}
                  className="text-xs h-9 md:h-10 touch-target"
                  min={0}
                  max={10}
                />
              </div>
            )}
          </div>
          <Button disabled={saving} type="submit" className="w-full md:w-auto touch-target text-sm font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Add Production
          </Button>
        </form>
      )}

      {/* Entries list - card style on mobile, table on desktop */}
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Productions</h2>
        </div>

        {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-10">Loading entries...</p>
        ) : entries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">No entries recorded.</p>
        ) : (
            <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                {entries.map((e, i) => (
                    <div key={e.id || i} className="relative overflow-hidden group">
                        {/* Actions (Hidden behind) */}
                        {isEditMode && (
                            <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-4 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                                {role !== 'viewer' && (
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(e)}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                )}
                                {role === 'admin' && (
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-danger hover:bg-red-50" onClick={() => handleDelete(e.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Main Content */}
                        <div className={`p-4 flex items-center justify-between hover:bg-muted/10 bg-card transition-transform duration-300 ease-in-out ${isEditMode ? 'group-hover:-translate-x-28' : ''}`}>
                            <div className="flex items-center gap-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">{e.cook_name}</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">{e.date}</p>
                                        <span className={`text-[9px] px-1 rounded uppercase font-bold border ${
                                            e.cook_name === 'System/Packaging' 
                                            ? 'text-purple-600 bg-purple-50 border-purple-100'
                                            : e.production_type === 'Unpacked' 
                                                ? 'text-orange-600 bg-orange-50 border-orange-100' 
                                                : 'text-blue-600 bg-blue-50 border-blue-100'
                                        }`}>
                                            {e.cook_name === 'System/Packaging' ? 'System' : (e.production_type || 'Packed')}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {e.notes?.match(/\[Prod:(.*?)\]/)?.[1] || (e.production_type === 'Unpacked' ? `${e.notes?.match(/\[Style:(.*?)\]/)?.[1] || 'Regular'} Size` : `${e.pack_size}rd size`)}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-normal md:font-bold text-foreground">
                                    {e.production_type === 'Unpacked' 
                                        ? `${e.packs_produced} units ${e.leftover_sticks > 0 ? `+ ${e.leftover_sticks}` : ''}`
                                        : `${e.packs_produced} packs`
                                    }
                                </p>
                                <p className="text-[10px] text-muted-foreground uppercase font-normal md:font-bold tracking-tight">
                                    {e.production_type === 'Unpacked'
                                        ? `${(e.packs_produced || 0) * 11 + (e.leftover_sticks || 0)} total sticks`
                                        : `${(e.pack_size || 0) * (e.packs_produced || 0)} total pieces`
                                    }
                                </p>
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
                        <div>Cook</div>
                        <div className="text-center">Pack Size</div>
                        <div className="text-right">Unit/Qty</div>
                        <div className="text-right">Leftover Sticks</div>
                        <div className="text-right">Total Pieces</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-border">
                        {entries.map((e, i) => (
                            <div key={e.id || i} className="relative overflow-hidden group">
                                {/* Actions (Hidden behind) */}
                                {isEditMode && (
                                    <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-4 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                                        {role !== 'viewer' && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={() => openEdit(e)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {role === 'admin' && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-red-50" onClick={() => handleDelete(e.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Row Content */}
                                <div className={`grid grid-cols-6 gap-4 px-4 py-3 items-center bg-card transition-all duration-300 ease-in-out ${isEditMode ? 'group-hover:-translate-x-24' : ''}`}>
                                    <div className="text-[10px] text-foreground uppercase font-mono">{e.date}</div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs font-bold text-foreground capitalize truncate">{e.cook_name === 'System/Packaging' ? 'Conversion' : e.cook_name}</div>
                                        <span className={`text-[8px] px-1 rounded uppercase font-bold border shrink-0 ${
                                             e.cook_name === 'System/Packaging' 
                                             ? 'text-purple-600 bg-purple-50 border-purple-100'
                                             : e.production_type === 'Unpacked' 
                                                 ? 'text-orange-600 bg-orange-50 border-orange-100' 
                                                 : 'text-blue-600 bg-blue-50 border-blue-100'
                                        }`}>
                                            {e.cook_name === 'System/Packaging' ? 'System' : (e.production_type || 'Packed')}
                                        </span>
                                    </div>
                                    <div className="text-center text-[10px] text-muted-foreground uppercase font-bold">
                                        {e.notes?.match(/\[Prod:(.*?)\]/)?.[1] || (e.production_type === 'Unpacked' ? `${e.notes?.match(/\[Style:(.*?)\]/)?.[1] || 'Regular'} Style` : `${e.pack_size}rd size`)}
                                    </div>
                                    <div className="text-right text-xs font-black text-foreground">
                                        {e.packs_produced}
                                    </div>
                                    <div className="text-right text-xs font-medium text-orange-600">
                                        {e.production_type === 'Unpacked' ? (e.leftover_sticks || 0) : '-'}
                                    </div>
                                    <div className="text-right text-xs font-medium text-muted-foreground text-[10px] uppercase">
                                        {e.production_type === 'Unpacked' 
                                            ? `${(e.packs_produced || 0) * 11} pcs`
                                            : `${(e.pack_size || 0) * (e.packs_produced || 0)} pcs`
                                        }
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
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md w-[95vw]">
            <DialogHeader>
                <DialogTitle>Edit Production Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                    <Select value={editType} onValueChange={(v) => {
                        setEditType(v);
                        if (v === "Unpacked") setEditSize("11");
                    }}>
                        <SelectTrigger className="w-[180px] h-9 text-xs shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Packed" className="text-xs pl-3">Packed</SelectItem>
                            <SelectItem value="Unpacked" className="text-xs pl-3">Unpacked (By 11)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                        <DatePicker 
                            date={editDate} 
                            onStringChange={setEditDate} 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Cook</label>
                        <Select value={editCook} onValueChange={setEditCook}>
                            <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {employees.filter(c => c.role?.toLowerCase().includes("cook")).map((c) => (
                                    <SelectItem key={c.id} value={c.names} className="text-xs pl-3">{c.names}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {editType === "Packed" && (
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Product</label>
                            <Select value={editSize} onValueChange={setEditSize}>
                                <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PRODUCTS.filter(p => p.group !== "Barquillon Classic").map((p) => <SelectItem key={p.name} value={p.name} className="text-xs pl-3">{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {editType === "Unpacked" && (
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Stick Size</label>
                            <Select value={editStickSize} onValueChange={setEditStickSize}>
                                <SelectTrigger className="h-10 text-xs shadow-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STICK_SIZES.map((s) => <SelectItem key={s} value={s} className="text-xs pl-3">{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            {editType === "Unpacked" ? "Qty (By 11)" : "Packs Produced"}
                        </label>
                        <Input type="number" value={editPacks} onChange={(e) => setEditPacks(e.target.value)} className="h-10 text-xs" min={1} />
                    </div>
                    {editType === "Unpacked" && (
                         <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Leftover Sticks</label>
                            <Input type="number" value={editLeftover} onChange={(e) => setEditLeftover(e.target.value)} className="h-10 text-xs" min={0} max={10} />
                        </div>
                    )}
                </div>
                <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleUpdate}>Update Record</Button>
                </div>
            </div>
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
    </div>
  );
}
