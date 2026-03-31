import { memo } from "react";
import { Plus, Trash2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

const formatCurrency = (v: number) => `₱${v.toLocaleString()}`;

export interface OrderDetailsViewProps {
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

export const OrderDetailsView = memo(({
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
});
