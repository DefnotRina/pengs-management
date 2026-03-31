import { useState, useEffect } from "react";
import { PageHeader } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PACK_SIZES, PRODUCTS } from "@/lib/mock-data";
import { Plus, Search, Pencil, Trash2, Calendar as CalendarIcon, MoreVertical, Check, ChevronsUpDown, LayoutGrid, List } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";

const formatCurrency = (v: number) => `₱${v.toLocaleString()}`;

interface OrderDetailsViewProps {
  order: any;
  role: string;
  payments: Record<string, any[]>;
  adjustments: Record<string, any[]>;
  expandedAdjusts: Record<string, boolean>;
  setExpandedAdjusts: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  paymentState: {
    newPayDate: string;
    setNewPayDate: (v: string) => void;
    newPayMethod: string;
    setNewPayMethod: (v: string) => void;
    newPayAmount: string;
    setNewPayAmount: (v: string) => void;
  };
  adjustmentState: {
    newAdjustType: "B.O." | "Pull Out";
    setNewAdjustType: (v: "B.O." | "Pull Out") => void;
    adjustItems: { product: string; qty: string }[];
    setAdjustItems: (v: { product: string; qty: string }[]) => void;
    newAdjustNote: string;
    setNewAdjustNote: (v: string) => void;
    saving: boolean;
  };
  actions: {
    toggleItemPacked: (itemId: string, currentStatus: string, orderNo: string) => Promise<void>;
    updateStatus: (id: string, field: string, value: any, orderNo: string) => Promise<void>;
    handleAddPayment: (orderNo: string, totalPrice: number) => Promise<void>;
    handleAddAdjustment: (orderNo: string, currentAdjustments: any[], currentPayments: any[], originalTotal: number, orderItems: any[]) => Promise<void>;
    handleDeleteAdjustment: (adjId: string, orderNo: string, originalTotal: number, currentAdjustments: any[], currentPayments: any[]) => Promise<void>;
  };
}

const OrderDetailsView = ({
  order: o,
  role,
  payments,
  adjustments,
  expandedAdjusts,
  setExpandedAdjusts,
  paymentState,
  adjustmentState,
  actions
}: OrderDetailsViewProps) => {
  const orderPayHistory = payments[o.order_no] || [];
  const totalPaid = orderPayHistory.reduce((s, p) => s + Number(p.amount), 0);
  const { newPayDate, setNewPayDate, newPayMethod, setNewPayMethod, newPayAmount, setNewPayAmount } = paymentState;
  const { newAdjustType, setNewAdjustType, adjustItems, setAdjustItems, newAdjustNote, setNewAdjustNote, saving } = adjustmentState;
  const { toggleItemPacked, updateStatus, handleAddPayment, handleAddAdjustment, handleDeleteAdjustment } = actions;

  return (
    <div className="p-4 border-t bg-muted/5">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Item Packing */}
        <div>
          <h4 className="text-[10px] uppercase font-black text-muted-foreground mb-3 flex items-center gap-2">
            Items & Packing Status
          </h4>
          <div className="space-y-2">
            {(o.order_items || []).sort((a: any, b: any) => {
              const dateA = new Date(a.created_at).getTime();
              const dateB = new Date(b.created_at).getTime();
              if (dateA !== dateB) return dateA - dateB;
              return a.id > b.id ? 1 : -1;
            }).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-card border rounded-lg group">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => role !== 'viewer' && toggleItemPacked(item.id, item.status, o.order_no)}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${item.status === 'Packed'
                      ? "bg-success border-success text-white"
                      : "border-muted-foreground/30"
                      } ${role !== 'viewer' ? "cursor-pointer hover:border-primary" : "cursor-default"}`}
                  >
                    {item.status === 'Packed' && <Plus className="h-3 w-3 rotate-45" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.qty} × {item.product || `${item.pack_size}pcs`}</p>
                    <p className="text-[10px] text-muted-foreground">₱{item.price} per pack</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'Packed' ? "bg-success/10 text-success" : "text-muted-foreground"
                  }`}>
                  {item.status || 'Pending'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Order Status</label>
              <Select
                disabled={role === 'viewer'}
                value={o.order_status}
                onValueChange={(v) => updateStatus(o.id, "order_status", v, o.order_no)}
              >
                <SelectTrigger className="h-8 text-xs font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending" className="text-xs">Pending</SelectItem>
                  <SelectItem value="Packed" className="text-xs">Packed</SelectItem>
                  <SelectItem value="Delivered" className="text-xs">Delivered</SelectItem>
                </SelectContent>
              </Select>
              {o.order_status === 'Delivered' && (
                <div className="animate-in slide-in-from-top-1 fade-in duration-300 bg-success/5 p-3 rounded-xl border border-success/20 mt-3">
                  <label className="text-[10px] uppercase font-black text-success/80 mb-2 block tracking-widest">Delivered On Status</label>
                  <DatePicker
                    disabled={role === 'viewer'}
                    date={o.delivered_on || ""}
                    onStringChange={(val) => updateStatus(o.id, "delivered_on", val, o.order_no)}
                    className="h-10 bg-white border-success/30 font-bold text-success"
                    placeholder="Select Delivery Date"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Adjustments (B.O. / Pull Outs) */}
          <div className="mt-6 pt-4 border-t-2 border-dashed">
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-muted/10 p-1 rounded transition-colors"
              onClick={() => setExpandedAdjusts(prev => ({ ...prev, [o.order_no]: !prev[o.order_no] }))}
            >
              <h4 className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-2">
                <ChevronsUpDown className={`h-3 w-3 transition-transform ${expandedAdjusts[o.order_no] ? 'rotate-180' : ''}`} />
                <span>Adjustments (B.O. / Pull Out)</span>
              </h4>
              <span className="text-destructive text-[10px] font-black">-{formatCurrency(adjustments[o.order_no]?.reduce((s, a) => s + Number(a.amount), 0) || 0)}</span>
            </div>

            {expandedAdjusts[o.order_no] && (
              <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2 mb-4">
                  {adjustments[o.order_no]?.length > 0 ? adjustments[o.order_no].map((adj, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg border border-destructive/10 relative group/adj">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${adj.type === 'B.O.' ? 'bg-destructive/20 text-destructive' : 'bg-orange-500/20 text-orange-600'}`}>{adj.type}</span>
                          <span className="text-xs font-bold">{adj.quantity}x {adj.product_name}</span>
                          <span className="text-[10px] text-muted-foreground">{adj.date}</span>
                        </div>
                        {adj.note && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{adj.note}"</p>}
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">Total Deduction: {formatCurrency(adj.amount)}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover/adj:opacity-100" onClick={() => handleDeleteAdjustment(adj.id, o.order_no, o.total_price, adjustments[o.order_no], orderPayHistory)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )) : (
                    <p className="text-[10px] text-muted-foreground py-2 italic text-center">No adjustments recorded.</p>
                  )}
                </div>

                {role !== 'viewer' && (
                  <div className="space-y-4 bg-muted/20 p-4 rounded-xl border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="text-[9px] uppercase font-black text-muted-foreground mb-1 block">Adjustment Type</label>
                        <Select value={newAdjustType} onValueChange={(v: any) => setNewAdjustType(v)}>
                          <SelectTrigger className="h-8 w-32 text-xs font-regular"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="B.O." className="text-xs">Bad Order (B.O.)</SelectItem>
                            <SelectItem value="Pull Out" className="text-xs">Pull Out</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-primary gap-1" onClick={() => setAdjustItems([...adjustItems, { product: "", qty: "" }])}>
                        <Plus className="h-3 w-3" /> Add Item
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {adjustItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end animate-in fade-in slide-in-from-right-2 duration-200">
                          <div className="col-span-7">
                            <label className="text-[8px] uppercase font-bold text-muted-foreground mb-0.5 block">Product</label>
                            <Select value={item.product} onValueChange={(v) => {
                              const newArr = [...adjustItems];
                              newArr[idx].product = v;
                              setAdjustItems(newArr);
                            }}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {o.order_items?.map((oi: any) => (
                                  <SelectItem key={oi.product} value={oi.product} className="text-xs">
                                    {oi.product} ({formatCurrency(oi.price)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <label className="text-[8px] uppercase font-bold text-muted-foreground mb-0.5 block">Qty</label>
                            <Input type="number" value={item.qty} onChange={(e) => {
                              const newArr = [...adjustItems];
                              newArr[idx].qty = e.target.value;
                              setAdjustItems(newArr);
                            }} placeholder="0" className="h-9 text-xs" />
                          </div>
                          <div className="col-span-2 flex justify-center pb-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setAdjustItems(adjustItems.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block tracking-widest">Note / Reason</label>
                        <Input value={newAdjustNote} onChange={(e) => setNewAdjustNote(e.target.value)} placeholder="e.g. Returned due to damage" className="h-9 text-xs" />
                      </div>
                      <div className="bg-destructive/5 p-2 rounded border border-destructive/20 flex flex-col justify-center text-center">
                        <label className="text-[8px] uppercase font-black text-destructive/60 mb-0.5 block">Total Adjustment</label>
                        <p className="text-sm font-black text-destructive">
                          -{formatCurrency(adjustItems.reduce((acc, item) => {
                            const found = o.order_items?.find((oi: any) => oi.product === item.product);
                            return acc + (Number(found?.price || 0) * Number(item.qty || 0));
                          }, 0))}
                        </p>
                      </div>
                    </div>

                    <Button disabled={saving} className="w-full h-11 font-black uppercase text-[11px] tracking-widest bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 active:scale-95 transition-all" onClick={() => handleAddAdjustment(o.order_no, adjustments[o.order_no], payments[o.order_no], o.total_price, o.order_items)}>
                      {saving ? "SAVING..." : `SUBMIT ALL ADJUSTMENTS`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-muted/10 p-4 rounded-xl border border-dashed border-muted-foreground/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] uppercase font-black text-muted-foreground leading-none tracking-widest">Balance Tracking</h4>
            <div className="text-right">
              <p className="text-[10px] font-bold text-foreground">Due: {formatCurrency(o.total_price - (adjustments[o.order_no]?.reduce((s, a) => s + Number(a.amount), 0) || 0))}</p>
              <p className="text-[8px] text-muted-foreground uppercase font-black">Balance: {formatCurrency(Math.max(0, (o.total_price - (adjustments[o.order_no]?.reduce((s, a) => s + Number(a.amount), 0) || 0)) - totalPaid))}</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {orderPayHistory.length > 0 ? orderPayHistory.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0 relative">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono">{p.payment_date}</span>
                  <span className="text-[8px] font-black uppercase text-muted-foreground bg-muted px-1 rounded">{p.method || 'Cash'}</span>
                </div>
                <span className="font-bold text-success">+{formatCurrency(Number(p.amount))}</span>
              </div>
            )) : (
              <p className="text-[10px] text-muted-foreground py-2 italic text-center">No payments recorded yet.</p>
            )}
          </div>

          {role !== 'viewer' && (
            <div className="space-y-3 pt-3 border-t">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block">Date</label>
                  <DatePicker
                    date={newPayDate}
                    onStringChange={setNewPayDate}
                    className="h-8 text-[10px] px-2"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block">Payment Method</label>
                  <Select value={newPayMethod} onValueChange={setNewPayMethod}>
                    <SelectTrigger className="h-8 text-[10px] font-regular"><SelectValue placeholder="Select Method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash" className="text-xs">Cash </SelectItem>
                      <SelectItem value="GCash" className="text-xs">Gcash </SelectItem>
                      <SelectItem value="Bank" className="text-xs">Bank </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block">Amount</label>
                  <Input
                    type="number"
                    value={newPayAmount}
                    onChange={(e) => setNewPayAmount(e.target.value)}
                    placeholder="₱ 0"
                    className="h-8 text-[10px] px-2 font-black"
                  />
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full h-8 text-[10px] font-black uppercase tracking-widest"
                onClick={() => handleAddPayment(o.order_no, o.total_price)}
              >
                Add Payment
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [client, setClient] = useState("");
  const [deadline, setDeadline] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [amountPaid, setAmountPaid] = useState("");
  const [items, setItems] = useState<any[]>([{ productName: PRODUCTS[0].name, quantity: 1, pricePerPack: 0 }]);
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<Record<string, any[]>>({});
  const [adjustments, setAdjustments] = useState<Record<string, any[]>>({});
  const [newPayAmount, setNewPayAmount] = useState("");
  const [newAdjustAmount, setNewAdjustAmount] = useState("");
  const [newAdjustType, setNewAdjustType] = useState<"B.O." | "Pull Out">("B.O.");
  const [adjustItems, setAdjustItems] = useState<{ product: string, qty: string }[]>([{ product: "", qty: "" }]);
  const [newAdjustNote, setNewAdjustNote] = useState("");
  const [newPayDate, setNewPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPayMethod, setNewPayMethod] = useState("");
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [expandedAdjusts, setExpandedAdjusts] = useState<Record<string, boolean>>({});
  const { isEditMode, role } = useAuth();

  // View state & Filters
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);

  // CRM & Pricing State
  const [allClients, setAllClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSpecificPrices, setClientSpecificPrices] = useState<Record<string, number>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [openClientCombo, setOpenClientCombo] = useState(false);

  // Confirmation State
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => { } });

  const generateNextOrderNo = (baseDate: Date = new Date()) => {
    const prefix = `ORD-${format(baseDate, "yyMM")}-`;

    const currentMonthOrders = orders
      .filter(o => o.order_no && typeof o.order_no === 'string' && o.order_no.startsWith(prefix))
      .map(o => {
        const parts = o.order_no.split("-");
        if (parts.length < 3) return 0;
        const seq = parseInt(parts[2]);
        return isNaN(seq) ? 0 : seq;
      });

    const nextSeq = currentMonthOrders.length > 0 ? Math.max(...currentMonthOrders) + 1 : 1;
    return `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  };

  // Sync Order Number with selected Order Date
  useEffect(() => {
    if (open && !editingOrder && newPayDate) {
      const selectedDate = new Date(newPayDate);
      if (!isNaN(selectedDate.getTime())) {
        setOrderNumber(generateNextOrderNo(selectedDate));
      }
    }
  }, [newPayDate, open, editingOrder, orders]);

  const fetchOrders = async (silent = false) => {
    if (!silent) setIsLoading(true);

    try {
      const [
        { data: fetchedOrders, error: ordersError },
        { data: fetchedPayments },
        { data: fetchedAdjustments },
        { data: fetchedClients }
      ] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').order('order_no', { ascending: false }).order('created_at', { foreignTable: 'order_items', ascending: true }),
        supabase.from('order_payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('order_adjustments').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('name', { ascending: true })
      ]);

      if (ordersError) {
        toast.error("Failed to load orders");
      } else {
        setOrders(fetchedOrders || []);
        setAllClients(fetchedClients || []);

        const payMap: Record<string, any[]> = {};
        fetchedPayments?.forEach(p => {
          if (!payMap[p.order_id]) payMap[p.order_id] = [];
          payMap[p.order_id].push(p);
        });
        setPayments(payMap);

        const adjMap: Record<string, any[]> = {};
        fetchedAdjustments?.forEach(a => {
          if (!adjMap[a.order_id]) adjMap[a.order_id] = [];
          adjMap[a.order_id].push(a);
        });
        setAdjustments(adjMap);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filtered orders logic
  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.order_no.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "All" || o.order_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sync selectedOrderDetails with updated data
  useEffect(() => {
    if (selectedOrderDetails) {
      const updated = orders.find(o => o.order_no === selectedOrderDetails.order_no);
      if (updated) setSelectedOrderDetails(updated);
    }
  }, [orders]);

  const total = items.reduce((s, i) => s + i.quantity * i.pricePerPack, 0);

  const addItem = () => {
    const defaultProd = PRODUCTS[0];
    const price = clientSpecificPrices[defaultProd.name] || defaultProd.basePrice;
    setItems([...items, { productName: defaultProd.name, quantity: 1, pricePerPack: price }]);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    let finalValue = value;

    if (field === "productName") {
      const prod = PRODUCTS.find(p => p.name === value);
      if (prod) {
        // Auto-update price when product changes
        updated[idx].pricePerPack = clientSpecificPrices[prod.name] || prod.basePrice;
      }
    }

    updated[idx] = { ...updated[idx], [field]: finalValue };
    setItems(updated);
  };

  // Pricing Lookup Logic
  const fetchClientPrices = async (client_id: string): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from('client_pricing')
      .select('*')
      .eq('client_id', client_id);

    const priceMap: Record<string, number> = {};
    if (!error && data) {
      data.forEach(p => priceMap[p.product_name] = p.custom_price);
    }
    return priceMap;
  };

  const handleClientSelect = async (c: { id: string, name: string }, skipItemUpdate = false) => {
    setClient(c.name);
    setSelectedClientId(c.id);
    setShowSuggestions(false);
    setSuggestionIndex(-1);

    const priceMap = await fetchClientPrices(c.id);
    setClientSpecificPrices(priceMap);

    if (!skipItemUpdate) {
      // Update existing items in the form
      const updatedItems = items.map(item => {
        const prod = PRODUCTS.find(p => p.name === item.productName);
        return {
          ...item,
          pricePerPack: priceMap[item.productName] || prod?.basePrice || 0
        };
      });
      setItems(updatedItems);
    }
    return priceMap;
  };

  const handleManualClientChange = (val: string) => {
    setClient(val);

    // Auto-select CRM client if typed name matches exactly (case-insensitive)
    const match = allClients.find(c => c.name.toLowerCase() === val.toLowerCase());
    if (match) {
      handleClientSelect(match);
      return;
    }

    // If no exact match yet, we un-link from CRM
    setSelectedClientId(null);
    setClientSpecificPrices({});
    setShowSuggestions(true);
    setSuggestionIndex(-1);

    // Reset existing items in the form to base prices
    const updatedItems = items.map(item => {
      const prod = PRODUCTS.find(p => p.name === item.productName);
      return {
        ...item,
        pricePerPack: prod?.basePrice || 0
      };
    });
    setItems(updatedItems);
  };

  const filteredClients = allClients.filter(c =>
    client.length > 0 && c.name.toLowerCase().includes(client.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredClients.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionIndex(prev => (prev < filteredClients.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && suggestionIndex >= 0) {
      e.preventDefault();
      handleClientSelect(filteredClients[suggestionIndex]);
    }
  };

  const handleCreate = async () => {
    if (!orderNumber || !client || !deadline) {
      toast.error("Please fill all required fields");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item to the order");
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_no: orderNumber,
        client: client,
        client_id: selectedClientId,
        delivery_deadline: deadline,
        payment_status: paymentStatus,
        order_status: "Pending",
        total_price: total,
        amount_paid: paymentStatus === "Paid" ? total : Number(amountPaid || 0)
      })
      .select()
      .single();

    if (orderError || !orderData) {
      toast.error("Failed to create order");
      console.error(orderError);
      return;
    }

    const itemsToInsert = items.map(i => {
      const prod = PRODUCTS.find(p => p.name === i.productName);
      return {
        order_id: orderData.order_no,
        product: prod?.name || "Unknown",
        pack_size: prod?.size || 11,
        qty: i.quantity,
        price: i.pricePerPack
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      toast.error("Failed to create order items");
      console.error(itemsError);
    } else {
      toast.success("Order created!");
      setOpen(false);
      setOrderNumber(""); setClient(""); setDeadline(""); setAmountPaid("");
      const defaultProd = PRODUCTS[0];
      setItems([{ productName: defaultProd.name, quantity: 1, pricePerPack: defaultProd.basePrice }]);
      fetchOrders();
    }
  };

  const handleUpdate = async () => {
    if (!orderNumber || !client || !deadline) {
      toast.error("Please fill all required fields");
      return;
    }

    // Update main order
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        client: client,
        client_id: selectedClientId,
        delivery_deadline: deadline,
        total_price: total,
      })
      .eq('order_no', editingOrder.order_no);

    if (orderError) {
      toast.error("Failed to update order");
      return;
    }

    // Update items: Simple approach - delete and re-insert
    await supabase.from('order_items').delete().eq('order_id', editingOrder.order_no);

    const itemsToInsert = items.map(i => {
      const prod = PRODUCTS.find(p => p.name === i.productName);
      return {
        order_id: editingOrder.order_no,
        product: prod?.name || "Unknown",
        pack_size: prod?.size || 11,
        qty: i.quantity,
        price: i.pricePerPack,
        status: i.status || 'Pending'
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      toast.error("Failed to update order items");
    } else {
      toast.success("Order updated!");
      setOpen(false);
      setEditingOrder(null);
      fetchOrders();
    }
  };

  const openEdit = async (order: any) => {
    setEditingOrder(order);
    setOrderNumber(order.order_no);
    setClient(order.client);
    setDeadline(order.delivery_deadline);
    setSelectedClientId(order.client_id);

    // Fetch prices for this order's client if they have one
    let currentPrices: Record<string, number> = {};
    if (order.client_id) {
      currentPrices = await handleClientSelect({ id: order.client_id, name: order.client }, true);
    } else {
      setClientSpecificPrices({});
    }

    // Set the items from the order data
    setItems(order.order_items.map((i: any) => ({
      productName: i.product || PRODUCTS.find(p => p.size === i.pack_size)?.name || PRODUCTS[0].name,
      quantity: i.qty,
      pricePerPack: i.price,
      status: i.status
    })));
    setOpen(true);
  };

  const handleAddPayment = async (orderNo: string, totalPrice: number) => {
    if (!newPayAmount || Number(newPayAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (!newPayMethod) {
      toast.error("Please select a payment method (Cash, GCash, or Bank)");
      return;
    }

    const { error } = await supabase.from('order_payments').insert({
      order_id: orderNo,
      amount: Number(newPayAmount),
      payment_date: newPayDate,
      method: newPayMethod
    });

    if (error) {
      toast.error("Failed to record payment. Did you create the order_payments table?");
      return;
    }

    // Recalculate status
    const currentPayments = payments[orderNo] || [];
    const totalPaid = currentPayments.reduce((s, p) => s + Number(p.amount), 0) + Number(newPayAmount);

    let status = "Partial";
    if (totalPaid >= totalPrice) status = "Paid";
    else if (totalPaid === 0) status = "Unpaid";

    await supabase.from('orders').update({
      payment_status: status,
      amount_paid: totalPaid
    }).eq('order_no', orderNo);

    setNewPayAmount("");
    setNewPayMethod("");
    toast.success("Payment recorded!");
    fetchOrders();
  };

  const handleAddAdjustment = async (orderNo: string, currentAdjustments: any[] = [], currentPayments: any[] = [], originalTotal: number, orderItems: any[]) => {
    const validItems = adjustItems.filter(i => i.product && Number(i.qty) > 0);

    if (validItems.length === 0) {
      toast.error("Add at least one item with a valid quantity");
      return;
    }

    setSaving(true);
    let totalDeduction = 0;
    const recordsToInsert = validItems.map(i => {
      const selectedItemObj = orderItems.find(oi => oi.product === i.product);
      const amount = Number(selectedItemObj?.price || 0) * Number(i.qty);
      totalDeduction += amount;

      return {
        order_id: orderNo,
        type: newAdjustType,
        amount: amount,
        product_name: i.product,
        quantity: Number(i.qty),
        note: newAdjustNote,
        date: new Date().toISOString().split('T')[0]
      };
    });

    const { error } = await supabase.from('order_adjustments').insert(recordsToInsert);

    if (error) {
      toast.error(`Database Error: ${error.message}`);
      console.error(error);
      setSaving(false);
      return;
    }

    // Recalculate status based on NEW effective total
    const totalAdjustedBefore = (currentAdjustments || []).reduce((s, a) => s + Number(a.amount), 0);
    const totalAdjustedAfter = totalAdjustedBefore + totalDeduction;
    const totalPaid = (currentPayments || []).reduce((s, p) => s + Number(p.amount), 0);
    const effectiveTotal = Math.max(0, originalTotal - totalAdjustedAfter);

    let status = "Partial";
    if (totalPaid >= effectiveTotal) status = "Paid";
    else if (totalPaid === 0) status = "Unpaid";

    await supabase.from('orders').update({ payment_status: status }).eq('order_no', orderNo);

    setAdjustItems([{ product: "", qty: "" }]);
    setNewAdjustNote("");
    setSaving(false);
    toast.success(`${newAdjustType} recorded!`);
    fetchOrders();
  };

  const calculateAndSetStatus = async (orderNo: string, originalTotal: number, currentAdjustments: any[], currentPayments: any[]) => {
    const totalAdjusted = (currentAdjustments || []).reduce((s, a) => s + Number(a.amount || 0), 0);
    const totalPaid = (currentPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const effectiveTotal = Math.max(0, originalTotal - totalAdjusted);

    let status = "Partial";
    if (totalPaid >= effectiveTotal && effectiveTotal > 0) status = "Paid";
    else if (totalPaid === 0) status = "Unpaid";
    else if (totalPaid >= effectiveTotal && effectiveTotal === 0) status = "Paid";

    await supabase.from('orders').update({ payment_status: status }).eq('order_no', orderNo);
  };

  const handleDeleteAdjustment = async (adjId: string, orderNo: string, originalTotal: number, currentAdjustments: any[], currentPayments: any[]) => {
    const { error } = await supabase.from('order_adjustments').delete().eq('id', adjId);
    if (error) {
      toast.error("Failed to delete adjustment");
    } else {
      // Calculate status based on REMAINING adjustments
      const remainingAdjusts = currentAdjustments.filter(a => a.id !== adjId);
      await calculateAndSetStatus(orderNo, originalTotal, remainingAdjusts, currentPayments);
      toast.success("Adjustment removed");
      fetchOrders();
    }
  };

  const toggleItemPacked = async (itemId: string, currentStatus: string, orderNo: string) => {
    const newStatus = currentStatus === 'Packed' ? 'Pending' : 'Packed';

    // 1. Optimistic Update Local State
    setOrders(prev => prev.map(o => {
      if (o.order_no !== orderNo) return o;
      return {
        ...o,
        order_items: o.order_items.map((i: any) => i.id === itemId ? { ...i, status: newStatus } : i)
      };
    }));

    // 2. Background Sync with Supabase
    const { error } = await supabase.from('order_items').update({ status: newStatus }).eq('id', itemId);

    if (error) {
      toast.error("Failed to update item packing status");
      fetchOrders(true); // Re-sync on error
    } else {
      // 3. Handle Parent Order Status Update
      const order = orders.find(o => o.order_no === orderNo);
      if (order) {
        const updatedItems = order.order_items.map((i: any) => i.id === itemId ? { ...i, status: newStatus } : i);
        const allPacked = updatedItems.length > 0 && updatedItems.every((i: any) => i.status === 'Packed');
        const newOrderStatus = allPacked ? 'Packed' : 'Pending';

        if (order.order_status !== 'Delivered' && order.order_status !== newOrderStatus) {
          await supabase.from('orders').update({ order_status: newOrderStatus }).eq('order_no', orderNo);
        }
      }
      fetchOrders(true);
    }
  };

  const updateStatus = async (id: string, field: string, value: any, orderNo: string) => {
    const updateData: any = { [field]: value };
    if (field === 'order_status' && value !== 'Delivered') {
      updateData.delivered_on = null;
    }

    // 1. Optimistic Update Local State
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updateData } : o));

    // 2. Background Sync
    const { error } = await supabase.from('orders').update(updateData).eq('id', id);
    if (error) {
      toast.error("Failed to update status");
      fetchOrders(true);
    } else {
      if (field === 'order_status' && value === 'Packed') {
        await supabase.from('order_items').update({ status: 'Packed' }).eq('order_id', orderNo);
      }
      toast.success("Status updated");
      fetchOrders(true);
    }
  };

  const handleDeleteOrder = async (orderNo: string) => {
    setConfirmConfig({
      open: true,
      title: "Delete Order?",
      message: `Are you sure you want to delete order ${orderNo}? This will permanently remove all items and payment history associated with it.`,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, open: false }));
        const { error } = await supabase.from('orders').delete().eq('order_no', orderNo);
        if (error) toast.error("Failed to delete order");
        else {
          toast.success("Order deleted");
          fetchOrders();
        }
      }
    });
  };


  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Orders">
        {role !== 'viewer' && (
          <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (val && !editingOrder) {
              setOrderNumber(generateNextOrderNo());
            }
          }}>
            <DialogTrigger asChild>
              <Button className="touch-target" onClick={() => {
                setEditingOrder(null);
                setOrderNumber(generateNextOrderNo());
                setClient("");
                setSelectedClientId(null);
                setDeadline("");
                setAmountPaid("");
                setPaymentStatus("Unpaid");
                setItems([{ productName: PRODUCTS[0].name, quantity: 1, pricePerPack: 0 }]);
              }}>
                <Plus className="h-4 w-4 mr-2" />New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingOrder ? `Edit Order ${editingOrder.order_no}` : "Create Order"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Order Number</label>
                    <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="ORD-001" className="h-9 text-xs" disabled={!!editingOrder} />
                  </div>
                  <div className="relative">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Client</label>
                    <Input
                      value={client}
                      onChange={(e) => handleManualClientChange(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onKeyDown={handleKeyDown}
                      placeholder="Start typing name..."
                      className="h-9 text-xs"
                    />

                    {showSuggestions && filteredClients.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredClients.map((c, idx) => (
                          <button
                            key={c.id}
                            onClick={() => handleClientSelect(c)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs border-b last:border-0 flex justify-between items-center transition-colors",
                              idx === suggestionIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                            )}
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-[9px] text-primary uppercase font-bold">CRM Client</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Order Date</label>
                    <DatePicker
                      date={newPayDate}
                      onStringChange={setNewPayDate}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Delivery Deadline</label>
                    <DatePicker
                      date={deadline}
                      onStringChange={setDeadline}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Order Items</label>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="relative bg-muted/20 p-2 rounded-lg border border-transparent hover:border-muted-foreground/20 transition-all">
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-12 md:col-span-6">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block md:hidden">Product</label>
                            <Select value={item.productName} onValueChange={(v) => updateItem(idx, "productName", v as any)}>
                              <SelectTrigger className="h-9 text-xs font-medium bg-white/50"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PRODUCTS.map((p) => <SelectItem key={p.name} value={p.name} textValue={p.name}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-5 md:col-span-2">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block md:hidden">Qty</label>
                            <div className="relative">
                              <Input type="number" placeholder="0" value={item.quantity || ""} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} className="h-9 text-xs pl-2 bg-white/50" min={1} />
                            </div>
                          </div>
                          <div className="col-span-5 md:col-span-3">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block md:hidden">Price</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₱</span>
                              <Input type="number" placeholder="0" value={item.pricePerPack || ""} onChange={(e) => updateItem(idx, "pricePerPack", Number(e.target.value))} className="h-9 text-xs pl-5 bg-white/50" min={0} />
                            </div>
                          </div>
                          <div className="col-span-2 md:col-span-1 flex items-end justify-center">
                            {items.length > 1 && (
                              <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-9 w-9 text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addItem} className="mt-2 h-8 text-[10px] uppercase font-bold">
                    <Plus className="h-3 w-3 mr-1" />Add Item
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground">Total Price</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                </div>

                <Button onClick={editingOrder ? handleUpdate : handleCreate} className="w-full h-10 md:h-12 font-bold uppercase tracking-wider text-sm mt-2">
                  {editingOrder ? "Save Changes" : "Create Order"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search client or order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-xs shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs w-[140px] shadow-sm"><SelectValue placeholder="Status Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="Pending" className="text-xs">Pending</SelectItem>
              <SelectItem value="Packed" className="text-xs">Packed</SelectItem>
              <SelectItem value="Delivered" className="text-xs">Delivered</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center p-1 bg-muted rounded-lg border shadow-sm">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn("h-8 px-3 text-[10px] uppercase font-bold", viewMode === 'list' && "bg-white shadow-sm")}
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1.5" /> List
            </Button>
            <Button
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn("h-8 px-3 text-[10px] uppercase font-bold", viewMode === 'board' && "bg-white shadow-sm")}
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Board
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-10">Loading orders...</p>
        ) : viewMode === 'list' ? (
          filteredOrders.length === 0 ? (
            <div className="text-center py-10 bg-muted/20 rounded-xl border-2 border-dashed">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No orders found matching your search.</p>
            </div>
          ) : filteredOrders.map((o, i) => {
            const orderPayHistory = payments[o.order_no] || [];
            const totalPaid = orderPayHistory.reduce((s, p) => s + Number(p.amount), 0);

            return (
              <div key={o.order_no} className="bg-card rounded-xl border shadow-sm overflow-hidden transition-all duration-300">
                <div className="relative overflow-hidden group">
                  {/* Actions (Hidden behind) */}
                  {isEditMode && (
                    <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-4 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                      {role !== 'viewer' && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openEdit(o); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {role === 'admin' && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.order_no); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Header Content */}
                  <div
                    className={`p-4 cursor-pointer bg-card transition-all duration-300 ease-in-out flex flex-col md:flex-row md:items-center justify-between gap-4 ${isEditMode ? 'group-hover:-translate-x-28' : ''}`}
                    onClick={() => setSelectedOrderDetails(o)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-foreground">{o.client}</h3>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-mono text-muted-foreground">{o.order_no}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          Due: <span className="text-foreground font-medium">{o.delivery_deadline}</span>
                        </p>
                        {o.delivered_on && (
                          <p className="text-xs text-success flex items-center gap-1">
                            Delivered: <span className="font-medium">{o.delivered_on}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div className="flex flex-col items-end">
                        {adjustments[o.order_no]?.length > 0 ? (
                          <>
                            <p className="text-lg font-black text-foreground leading-none">{formatCurrency(o.total_price - adjustments[o.order_no].reduce((s, a) => s + Number(a.amount), 0))}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[9px] text-muted-foreground line-through decoration-destructive/30">{formatCurrency(o.total_price)}</span>
                              <span className="text-[9px] text-destructive font-bold flex items-center gap-0.5">
                                <Trash2 className="h-2 w-2" /> -{formatCurrency(adjustments[o.order_no].reduce((s, a) => s + Number(a.amount), 0))}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="text-lg font-black text-foreground leading-none">{formatCurrency(o.total_price)}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">Paid: {formatCurrency(totalPaid)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase text-center ${o.order_status === "Delivered" ? "bg-success/10 text-success" :
                        o.order_status === "Packed" ? "bg-blue-100 text-blue-700" :
                          "bg-warning/10 text-warning"
                        }`}>
                        {o.order_status}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase text-center ${o.payment_status === "Paid" ? "bg-success/10 text-success" :
                        o.payment_status === "Partial" ? "bg-orange-100 text-orange-700" :
                          "bg-destructive/10 text-destructive"
                        }`}>
                        {o.payment_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-start overflow-x-auto pb-6 -mx-2 px-2 scrollbar-hide">
            {["Pending", "Packed", "Delivered"].map(status => (
              <div key={status} className="flex-1 min-w-[300px] w-full bg-muted/30 rounded-2xl border p-4 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em]",
                    status === "Pending" ? "text-warning" :
                      status === "Packed" ? "text-blue-500" : "text-success"
                  )}>{status} • {filteredOrders.filter(o => o.order_status === status).length}</h3>
                </div>
                <div className="space-y-3">
                  {filteredOrders.filter(o => o.order_status === status).length === 0 ? (
                    <div className="bg-card/50 rounded-xl border border-dashed border-muted-foreground/10 py-12 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40 italic">No {status.toLowerCase()} orders</p>
                    </div>
                  ) : filteredOrders.filter(o => o.order_status === status).map(o => {
                    const orderPayHistory = payments[o.order_no] || [];
                    const totalPaid = orderPayHistory.reduce((s, p) => s + Number(p.amount), 0);
                    const currentAdjustments = adjustments[o.order_no] || [];
                    const totalAdjusted = currentAdjustments.reduce((s, a) => s + Number(a.amount), 0);
                    const effectiveTotal = Math.max(0, o.total_price - totalAdjusted);

                    return (
                      <div key={o.order_no}
                        className="bg-card p-4 rounded-xl shadow-sm border border-border/50 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group relative overflow-hidden"
                        onClick={() => setSelectedOrderDetails(o)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="font-black text-sm text-foreground truncate group-hover:text-primary transition-colors">{o.client}</h4>
                            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{o.order_no}</p>
                          </div>
                          <span className={cn(
                            "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border",
                            o.payment_status === 'Paid' ? "bg-success/5 text-success border-success/20" :
                              o.payment_status === 'Partial' ? "bg-orange-50 text-orange-600 border-orange-200" :
                                "bg-destructive/5 text-destructive border-destructive/20"
                          )}>{o.payment_status}</span>
                        </div>

                        <div className="space-y-2 mt-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest mb-1">Due Date</p>
                              <p className="text-[10px] font-bold text-foreground">{o.delivery_deadline}</p>
                            </div>
                            <div className="text-right">
                              {totalAdjusted > 0 && (
                                <p className="text-[8px] text-destructive font-black line-through mb-0.5 opacity-60">{formatCurrency(o.total_price)}</p>
                              )}
                              <p className="text-sm font-black text-foreground">{formatCurrency(effectiveTotal)}</p>
                            </div>
                          </div>
                        </div>

                        {isEditMode && (
                          <div className="absolute left-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            {role !== 'viewer' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-500 hover:bg-background/80 shadow-sm backdrop-blur-sm rounded-full"
                                onClick={(e) => { e.stopPropagation(); openEdit(o); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-background/80 shadow-sm backdrop-blur-sm rounded-full"
                                onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.order_no); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

      {/* Order Details Modal (Unified for List & Board View) */}
      <Dialog open={!!selectedOrderDetails} onOpenChange={(open) => !open && setSelectedOrderDetails(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden rounded-2xl border-none shadow-2xl animate-in zoom-in-95 duration-200">
          <DialogHeader className="p-6 bg-card border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-black">{selectedOrderDetails?.client}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{selectedOrderDetails?.order_no}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto">
            {selectedOrderDetails && (
              <OrderDetailsView
                order={selectedOrderDetails}
                role={role}
                payments={payments}
                adjustments={adjustments}
                expandedAdjusts={expandedAdjusts}
                setExpandedAdjusts={setExpandedAdjusts}
                paymentState={{
                  newPayDate, setNewPayDate,
                  newPayMethod, setNewPayMethod,
                  newPayAmount, setNewPayAmount
                }}
                adjustmentState={{
                  newAdjustType, setNewAdjustType,
                  adjustItems, setAdjustItems,
                  newAdjustNote, setNewAdjustNote,
                  saving
                }}
                actions={{
                  toggleItemPacked,
                  updateStatus,
                  handleAddPayment,
                  handleAddAdjustment,
                  handleDeleteAdjustment
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
