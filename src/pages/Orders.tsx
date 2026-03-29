import { useState, useEffect } from "react";
import { PageHeader } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PACK_SIZES, PRODUCTS } from "@/lib/mock-data";
import { Plus, Search, Pencil, Trash2, Calendar as CalendarIcon, MoreVertical, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const formatCurrency = (v: number) => `₱${v.toLocaleString()}`;

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
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [newPayAmount, setNewPayAmount] = useState("");
  const [newPayDate, setNewPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const { isEditMode, role } = useAuth();

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
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data: fetchedOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('order_no', { ascending: false });
    
    const { data: fetchedPayments } = await supabase
      .from('order_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    // CRM Fetch
    const { data: fetchedClients } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

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
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
  const handleClientSelect = async (c: { id: string, name: string }) => {
     setClient(c.name);
     setSelectedClientId(c.id);
     setShowSuggestions(false);
     setSuggestionIndex(-1);

     const { data, error } = await supabase
        .from('client_pricing')
        .select('*')
        .eq('client_id', c.id);
     
     if (!error && data) {
        const priceMap: Record<string, number> = {};
        data.forEach(p => priceMap[p.product_name] = p.custom_price);
        setClientSpecificPrices(priceMap);

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

  const openEdit = (order: any) => {
    setEditingOrder(order);
    setOrderNumber(order.order_no);
    setClient(order.client);
    setDeadline(order.delivery_deadline);
    setSelectedClientId(order.client_id);
    
    // Fetch prices for this order's client if they have one
    if (order.client_id) {
       handleClientSelect({ id: order.client_id, name: order.client });
    } else {
       setClientSpecificPrices({});
    }

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

    const { error } = await supabase.from('order_payments').insert({
      order_id: orderNo, // Link using order_no
      amount: Number(newPayAmount),
      payment_date: newPayDate
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
      amount_paid: totalPaid // Keep for legacy/compat
    }).eq('order_no', orderNo);

    setNewPayAmount("");
    toast.success("Payment recorded!");
    fetchOrders();
  };

  const toggleItemPacked = async (itemId: string, currentStatus: string, orderNo: string) => {
    const newStatus = currentStatus === 'Packed' ? 'Pending' : 'Packed';
    const { error } = await supabase.from('order_items').update({ status: newStatus }).eq('id', itemId);
    if (error) {
      toast.error("Failed to update item. Did you add the status column?");
    } else {
      // Sync with parent order status
      const order = orders.find(o => o.order_no === orderNo);
      if (order) {
        const updatedItems = order.order_items.map((i: any) => i.id === itemId ? { ...i, status: newStatus } : i);
        const allPacked = updatedItems.length > 0 && updatedItems.every((i: any) => i.status === 'Packed');
        const newOrderStatus = allPacked ? 'Packed' : 'Pending';
        
        // Only auto-update if not already Delivered
        if (order.order_status !== 'Delivered' && order.order_status !== newOrderStatus) {
          await supabase.from('orders').update({ order_status: newOrderStatus }).eq('order_no', orderNo);
        }
      }
      fetchOrders();
    }
  };

  const updateStatus = async (id: string, field: string, value: any, orderNo: string) => {
      const { error } = await supabase.from('orders').update({ [field]: value }).eq('id', id);
      if (error) {
          toast.error("Failed to update status");
      } else {
          // If user manually sets order to Packed, mark all items as Packed
          if (field === 'order_status' && value === 'Packed') {
            await supabase.from('order_items').update({ status: 'Packed' }).eq('order_id', orderNo);
          }
          toast.success("Status updated");
          fetchOrders();
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="touch-target"><Plus className="h-4 w-4 mr-2" />New Order</Button>
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
                    <Input type="date" value={newPayDate} onChange={(e) => setNewPayDate(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Delivery Deadline</label>
                    <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-9 text-xs" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Order Items</label>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-end bg-muted/20 p-2 rounded-md">
                        <div className="flex-1">
                          <Select value={item.productName} onValueChange={(v) => updateItem(idx, "productName", v as any)}>
                            <SelectTrigger className="h-8 text-xs font-medium uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRODUCTS.map((p) => <SelectItem key={p.name} value={p.name} className="text-xs">{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-20">
                          <Input type="number" placeholder="Qty" value={item.quantity || ""} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} className="h-8 text-xs" min={1} />
                        </div>
                        <div className="w-24">
                          <Input type="number" placeholder="Price" value={item.pricePerPack || ""} onChange={(e) => updateItem(idx, "pricePerPack", Number(e.target.value))} className="h-8 text-xs" min={0} />
                        </div>
                        {items.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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

                <Button onClick={editingOrder ? handleUpdate : handleCreate} className="w-full h-10 font-bold uppercase tracking-wider">
                  {editingOrder ? "Save Changes" : "Create Order"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-10">Loading orders...</p>
        ) : orders.map((o, i) => {
          const isExpanded = expandedOrder === o.order_no;
          const orderPayHistory = payments[o.order_no] || [];
          const totalPaid = orderPayHistory.reduce((s, p) => s + Number(p.amount), 0);

          return (
            <div key={o.order_no} className={`bg-card rounded-xl border shadow-sm overflow-hidden transition-all duration-300 ${isExpanded ? "ring-2 ring-primary/20" : ""}`}>
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
                  onClick={() => setExpandedOrder(isExpanded ? null : o.order_no)}
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

                  <div className="flex items-center gap-4">
                    <p className="text-lg font-black text-foreground leading-tight">{formatCurrency(o.total_price)}</p>
                    <p className="text-[10px] text-muted-foreground">Paid: {formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase text-center ${
                      o.order_status === "Delivered" ? "bg-success/10 text-success" :
                      o.order_status === "Packed" ? "bg-blue-100 text-blue-700" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {o.order_status}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase text-center ${
                      o.payment_status === "Paid" ? "bg-success/10 text-success" :
                      o.payment_status === "Partial" ? "bg-orange-100 text-orange-700" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {o.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 border-t bg-muted/5 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Item Packing */}
                    <div>
                      <h4 className="text-[10px] uppercase font-black text-muted-foreground mb-3 flex items-center gap-2">
                        Items & Packing Status
                      </h4>
                      <div className="space-y-2">
                        {o.order_items?.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-card border rounded-lg group">
                            <div className="flex items-center gap-3">
                              <div 
                                onClick={() => role !== 'viewer' && toggleItemPacked(item.id, item.status, o.order_no)}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  item.status === 'Packed' 
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
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.status === 'Packed' ? "bg-success/10 text-success" : "text-muted-foreground"
                            }`}>
                              {item.status || 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t space-y-3">
                         <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Global Order Status</label>
                            <Select 
                              disabled={role === 'viewer'}
                              value={o.order_status} 
                              onValueChange={(v) => updateStatus(o.id, "order_status", v, o.order_no)}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Packed">Packed</SelectItem>
                                <SelectItem value="Delivered">Delivered</SelectItem>
                              </SelectContent>
                            </Select>
                         </div>
                         {o.order_status === 'Delivered' && (
                           <div className="animate-in fade-in">
                             <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Delivered On</label>
                             <Input 
                               disabled={role === 'viewer'}
                               type="date" 
                               value={o.delivered_on || ""} 
                               onChange={(e) => updateStatus(o.id, "delivered_on", e.target.value, o.order_no)} 
                               className="h-8 text-xs" 
                             />
                           </div>
                         )}
                      </div>
                    </div>

                    {/* Payment History */}
                    <div className="bg-muted/10 p-4 rounded-xl border border-dashed border-muted-foreground/20">
                      <h4 className="text-[10px] uppercase font-black text-muted-foreground mb-3 leading-none">Payment History</h4>
                      <div className="space-y-2 mb-4">
                        {orderPayHistory.length > 0 ? orderPayHistory.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                            <span className="text-muted-foreground font-mono">{p.payment_date}</span>
                            <span className="font-bold text-success">+{formatCurrency(Number(p.amount))}</span>
                          </div>
                        )) : (
                          <p className="text-[10px] text-muted-foreground py-2 italic text-center">No payments recorded yet.</p>
                        )}
                      </div>

                        {role !== 'viewer' && (
                          <div className="space-y-3 pt-3 border-t">
                            <div className="grid grid-cols-2 gap-2">
                               <div className="col-span-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Date</label>
                                <Input 
                                   type="date" 
                                   value={newPayDate} 
                                   onChange={(e) => setNewPayDate(e.target.value)} 
                                   className="h-8 text-[10px] px-2" 
                                />
                               </div>
                               <div className="col-span-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Amount</label>
                                <Input 
                                   type="number" 
                                   value={newPayAmount} 
                                   onChange={(e) => setNewPayAmount(e.target.value)} 
                                   placeholder="₱ 0.00" 
                                   className="h-8 text-[10px] px-2" 
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
              )}
            </div>
          );
        })}
        {orders.length === 0 && !isLoading && (
            <p className="text-center text-sm text-muted-foreground py-10">No orders found.</p>
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
    </div>
  );
}
