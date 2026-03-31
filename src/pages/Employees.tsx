import { useState, useEffect } from "react";
import { PageHeader } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, User, Banknote, Pencil, Check, X, History, Trash2, Archive, Activity, UserMinus, AlertCircle, Ban, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const formatCurrency = (v: number) => `₱${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PIECE_RATE_KEY = 'peng_piece_rate';
const DEFAULT_RATE = 3.5;

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global piece rate (for all pay-per-output cooks)
  const [pieceRate, setPieceRate] = useState<number>(() => Number(localStorage.getItem(PIECE_RATE_KEY) || DEFAULT_RATE));
  const [editingRate, setEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState("");

  // Inline salary editing per employee
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [editSalary, setEditSalary] = useState("");

  // Add Employee Modal
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [names, setNames] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [payType, setPayType] = useState("pay per output");
  const [baseSalary, setBaseSalary] = useState("");

  // Status Management
  const [statusTab, setStatusTab] = useState("Active");

  // CA Modal
  const [caModalOpen, setCaModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [caAmount, setCaAmount] = useState("");
  const [caDate, setCaDate] = useState(new Date().toISOString().split("T")[0]);
  const [caNote, setCaNote] = useState("");
  const [editingCaId, setEditingCaId] = useState<number | null>(null);

  // CA History
  const [showCaHistory, setShowCaHistory] = useState(false);
  const { isEditMode, role } = useAuth();

  // Confirmation State
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const fetchData = async () => {
    setIsLoading(true);
    const [{ data: empData, error: empErr }, { data: caData }] = await Promise.all([
      supabase.from('employees').select('*').order('id', { ascending: true }),
      supabase.from('cash_advances').select('*').order('date', { ascending: false })
    ]);
    if (empErr) toast.error("Failed to load employees");
    setEmployees(empData || []);
    setAdvances(caData || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Count PENDING and PARTIALLY DEDUCTED advances for the balance display
  const getCaBalance = (empName: string) =>
    advances
      .filter(a => a.employee_name === empName && a.status !== 'Deducted' && a.status !== 'Written-off' && Number(a.amount) > 0)
      .reduce((sum, a) => sum + Number(a.amount), 0);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!names.trim() || !empRole.trim()) { toast.error("Please fill all fields"); return; }
    setSaving(true);
    const { error } = await supabase.from('employees').insert({
      names: names.trim(),
      role: empRole.trim(),
      pay_type: payType,
      base_salary: payType !== 'pay per output' ? Number(baseSalary || 0) : null,
      status: 'Active'
    });
    setSaving(false);
    if (error) { toast.error("Failed to add employee"); console.error(error); }
    else {
      toast.success("Employee added!");
      setNames(""); setEmpRole(""); setBaseSalary("");
      setEmpModalOpen(false);
      fetchData();
    }
  };

  const handleSaveSalary = async (emp: any) => {
    const val = Number(editSalary);
    if (isNaN(val) || val < 0) { toast.error("Invalid amount"); return; }
    setSaving(true);
    const { error } = await supabase.from('employees').update({ base_salary: val }).eq('id', emp.id);
    setSaving(false);
    if (error) { toast.error("Failed to update salary"); }
    else { toast.success("Salary updated!"); setEditingEmpId(null); fetchData(); }
  };

  const handleSavePieceRate = () => {
    const val = Number(tempRate);
    if (isNaN(val) || val <= 0) { toast.error("Invalid rate"); return; }
    setPieceRate(val);
    localStorage.setItem(PIECE_RATE_KEY, String(val));
    setEditingRate(false);
    toast.success(`Cook piece rate updated to ₱${val}`);
  };

  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp || !caAmount || Number(caAmount) <= 0) { toast.error("Invalid advance amount"); return; }
    setSaving(true);
    
    if (editingCaId) {
      const { error } = await supabase.from('cash_advances').update({
        date: caDate, amount: Number(caAmount), note: caNote
      }).eq('id', editingCaId);
      setSaving(false);
      if (error) { toast.error("Failed to update advance"); }
      else { toast.success("Advance updated!"); setCaModalOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from('cash_advances').insert({
        employee_name: selectedEmp, date: caDate, amount: Number(caAmount), status: 'Pending', note: caNote
      });
      setSaving(false);
      if (error) { toast.error("Failed to issue advance"); console.error(error); }
      else { toast.success("Cash Advance recorded!"); setCaAmount(""); setCaNote(""); setCaModalOpen(false); fetchData(); }
    }
  };

  const openEditCa = (ca: any) => {
      setSelectedEmp(ca.employee_name);
      setCaAmount(String(ca.amount));
      setCaDate(ca.date);
      setCaNote(ca.note || "");
      setEditingCaId(ca.id);
      setCaModalOpen(true);
  };

  const handleDeleteAdvance = async (id: number) => {
      setConfirmConfig({
          open: true,
          title: "Delete Advance?",
          message: "Are you sure you want to delete this cash advance? This record will be permanently removed from the history.",
          onConfirm: async () => {
              setConfirmConfig(prev => ({ ...prev, open: false }));
              const { error } = await supabase.from('cash_advances').delete().eq('id', id);
              if (error) { toast.error("Failed to delete advance"); }
              else { toast.success("Advance deleted!"); fetchData(); }
          }
      });
  };

  const handleUpdateStatus = async (emp: any, newStatus: string) => {
    const bal = getCaBalance(emp.names);
    
    const proceedUpdate = async (extraActions: () => Promise<void> = async () => {}) => {
        setSaving(true);
        const { error } = await supabase.from('employees').update({ 
            status: newStatus,
            status_date: new Date().toISOString() 
        }).eq('id', emp.id);
        
        if (error) { toast.error(`Failed to update to ${newStatus}`); }
        else {
            await extraActions();
            toast.success(`Employee marked as ${newStatus}`);
            fetchData();
        }
        setSaving(false);
        setConfirmConfig(prev => ({ ...prev, open: false }));
    };

    if ((newStatus === 'On Leave' || newStatus === 'Inactive') && bal > 0) {
        setConfirmConfig({
            open: true,
            title: `Manage Unpaid Balance?`,
            message: `${emp.names} has an unpaid balance of ${formatCurrency(bal)}. What would you like to do?`,
            onConfirm: () => proceedUpdate() // Default proceed (keep history)
        });
        return;
    }

    proceedUpdate();
  };

  const handleWriteOff = async (empName: string) => {
    const bal = getCaBalance(empName);
    if (bal <= 0) return;

    setConfirmConfig({
        open: true,
        title: "Write-off Debt?",
        message: `This will clear the ${formatCurrency(bal)} active balance for ${empName} and record it as a write-off. The history will remain visible.`,
        onConfirm: async () => {
            setSaving(true);
            // 1. Mark existing pending advances as 'Written-off'
            const { error: caErr } = await supabase
                .from('cash_advances')
                .update({ status: 'Written-off' })
                .eq('employee_name', empName)
                .eq('status', 'Pending');

            if (caErr) {
                toast.error("Failed to write off advances");
            } else {
                toast.success("Debt written off successfully");
                fetchData();
            }
            setSaving(false);
            setConfirmConfig(prev => ({ ...prev, open: false }));
        }
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <PageHeader title="Employees Management" />
        {role === 'admin' && (
          <Button onClick={() => setEmpModalOpen(true)} className="touch-target shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Employee
          </Button>
        )}
      </div>

      {/* Global Cook Piece Rate Card */}
      <div className="bg-card rounded-lg border p-4 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Cook Piece Rate</p>
          <p className="text-[10px] md:text-xs text-muted-foreground leading-tight">Applied to all Pay-Per-Output cooks: (total pieces / 11) × rate</p>
        </div>
        {editingRate ? (
          <div className="flex items-center gap-2">
            <Input type="number" min="0.1" step="0.1" value={tempRate} onChange={e => setTempRate(e.target.value)} className="w-24 h-9 touch-target text-right font-bold" placeholder={String(pieceRate)} />
            <Button size="icon" className="h-9 w-9" onClick={handleSavePieceRate}><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditingRate(false)}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold text-primary">₱{pieceRate}</span>
            {isEditMode && role === 'admin' && (
              <Button variant="outline" size="sm" className="h-8 touch-target font-bold" onClick={() => { setTempRate(String(pieceRate)); setEditingRate(true); }}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Dialog open={empModalOpen} onOpenChange={setEmpModalOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription className="sr-only">Create a new staff profile</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEmployee} className="space-y-3 pt-2">
            <div>
              <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Full Name</label>
              <Input value={names} onChange={e => setNames(e.target.value)} placeholder="e.g. Maria" className="text-xs md:text-sm h-9 md:h-10 touch-target" required />
            </div>
            <div>
              <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Role</label>
              <Input value={empRole} onChange={e => setEmpRole(e.target.value)} placeholder="e.g. Cook, Packer" className="text-xs md:text-sm h-9 md:h-10 touch-target" required />
            </div>
            <div>
              <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Pay Structure</label>
              <Select value={payType} onValueChange={setPayType}>
                <SelectTrigger className="text-xs md:text-sm h-9 md:h-10 touch-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pay per output">Pay Per Output (Cooks)</SelectItem>
                  <SelectItem value="fixed (monthly)">Fixed - Per Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payType !== 'pay per output' && (
              <div>
                <label className="text-[10px] md:text-xs font-semibold md:font-medium text-muted-foreground mb-1 block uppercase tracking-tight md:normal-case">Base Salary (₱)</label>
                <Input type="number" min="0" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="e.g. 15000" className="text-xs md:text-sm h-9 md:h-10 touch-target" required />
              </div>
            )}
            <Button disabled={saving} type="submit" className="w-full text-xs md:text-sm font-semibold h-9 md:h-10 touch-target bg-orange-500 hover:bg-orange-600 text-white mt-2">
              {saving ? "Creating..." : "Create Employee Profile"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* CA Modal (Issue or Edit) */}
      <Dialog open={caModalOpen} onOpenChange={(o) => { if(!o) setEditingCaId(null); setCaModalOpen(o); }}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>{editingCaId ? "Edit Cash Advance" : "Issue Cash Advance"}</DialogTitle>
            <DialogDescription className="sr-only">Log or update a cash advance for employee</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleIssueAdvance} className="space-y-4">
            <div className="bg-muted/30 p-3 rounded-md border text-sm"><strong>Employee:</strong> {selectedEmp}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date Given</label>
                <DatePicker 
                    date={caDate} 
                    onStringChange={setCaDate} 
                    className="text-xs h-9 md:h-10" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount (₱)</label>
                <Input type="number" min="1" step="any" value={caAmount} onChange={e => setCaAmount(e.target.value)} placeholder="e.g. 500" required className="text-xs h-9 md:h-10 touch-target" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type / Note</label>
              <Input value={caNote} onChange={e => setCaNote(e.target.value)} placeholder="e.g. Rice, Medical" className="text-xs h-9 md:h-10 touch-target" required />
            </div>
            <Button disabled={saving} type="submit" className="w-full h-10 font-bold bg-orange-500 hover:bg-orange-600 text-white touch-target shadow-sm">
                {editingCaId ? "Update Advance" : "Record Advance"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Employee Roster */}
      <Tabs value={statusTab} onValueChange={setStatusTab} className="space-y-4">
        <div className="flex justify-between items-center bg-card rounded-lg border p-1 shadow-sm overflow-x-auto">
          <TabsList className="w-full justify-start bg-transparent h-9 md:h-11">
            <TabsTrigger value="Active" className="text-xs md:text-sm px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-bold transition-all">
                Active Staff ({employees.filter(e => (e.status || 'Active') === 'Active').length})
            </TabsTrigger>
            <TabsTrigger value="On Leave" className="text-xs md:text-sm px-4 data-[state=active]:bg-warning/10 data-[state=active]:text-warning font-bold transition-all">
                On Leave ({employees.filter(e => e.status === 'On Leave').length})
            </TabsTrigger>
            <TabsTrigger value="Inactive" className="text-xs md:text-sm px-4 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive font-bold transition-all">
                Archive ({employees.filter(e => e.status === 'Inactive' || e.status === 'Resigned').length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={statusTab} className="mt-0">
          <div className="bg-card rounded-lg border shadow-sm">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {statusTab === 'Active' ? "Active Team" : statusTab === 'On Leave' ? "Staff Away" : "Archived Records"}
              </h2>
              {statusTab === 'Inactive' && <p className="text-[10px] text-muted-foreground uppercase font-medium">History Preserved</p>}
            </div>
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground py-10">Loading...</p>
            ) : employees.filter(e => {
                const s = e.status || 'Active';
                if (statusTab === 'Active') return s === 'Active';
                if (statusTab === 'On Leave') return s === 'On Leave';
                return s === 'Inactive' || s === 'Resigned';
            }).length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No employees in this category.</p>
            ) : (
              <div className="divide-y divide-border">
                {employees.filter(e => {
                    const s = e.status || 'Active';
                    if (statusTab === 'Active') return s === 'Active';
                    if (statusTab === 'On Leave') return s === 'On Leave';
                    return s === 'Inactive' || s === 'Resigned';
                }).map((emp) => {
              const bal = getCaBalance(emp.names);
              const isEditingThis = editingEmpId === emp.id;
              const isFixed = !emp.pay_type?.toLowerCase().includes('output');
              return (
                <div key={emp.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 hover:bg-muted/5 transition-all">
                  {/* Employee Identity and Mobile Balance */}
                  <div className="flex items-start justify-between w-full md:w-auto md:flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 min-w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold text-foreground leading-tight">{emp.names}</p>
                          <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded capitalize text-muted-foreground">
                            {emp.pay_type}
                          </span>
                          {emp.status && emp.status !== 'Active' && (
                            <Badge variant={emp.status === 'On Leave' ? 'warning' : 'destructive'} className="text-[8px] h-4 py-0 leading-none">
                                {emp.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {emp.role}
                          {isFixed && emp.base_salary ? ` · ₱${emp.base_salary.toLocaleString()}` : ""}
                          {!isFixed ? ` · ₱${pieceRate}/unit` : ""}
                          {emp.status_date && emp.status !== 'Active' && (
                            <span className="text-primary font-medium">
                                {` · ${emp.status === 'On Leave' ? 'Away' : 'Archived'} since ${new Date(emp.status_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {/* Mobile Only: Balance (positioned top right of card header) */}
                    <div className="md:hidden text-right">
                      <p className="text-[10px] text-muted-foreground mb-0.5">C.A. Balance</p>
                      <p className={`text-sm font-bold ${bal > 0 ? "text-destructive" : "text-success"}`}>
                        {bal > 0 ? formatCurrency(bal) : "₱0"}
                      </p>
                    </div>
                  </div>

                  {/* Desktop Info & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t border-muted-foreground/10 md:border-0 pt-2.5 md:pt-0">
                    <div className="flex items-center gap-3">
                      {/* Inline Salary Editor (fixed employees only) */}
                      {isFixed && isEditMode && role === 'admin' && (
                        isEditingThis ? (
                          <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-md">
                            <Input type="number" min="0" value={editSalary} onChange={e => setEditSalary(e.target.value)} className="w-20 h-7 text-[10px] touch-target text-right font-bold px-1.5" />
                            <Button size="icon" className="h-7 w-7" onClick={() => handleSaveSalary(emp)} disabled={saving}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingEmpId(null)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-muted-foreground hover:text-primary" onClick={() => { setEditingEmpId(emp.id); setEditSalary(String(emp.base_salary || "")); }}>
                            <Pencil className="h-3 w-3 mr-1" /> Edit Salary
                          </Button>
                        )
                      )}

                      {/* Desktop Only CA Balance */}
                      <div className="hidden md:block text-right border-r border-border pr-3 mr-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">C.A. Balance</p>
                        <p className={`text-sm font-bold ${bal > 0 ? "text-destructive" : "text-success"}`}>
                          {bal > 0 ? formatCurrency(bal) : "₱0.00"}
                        </p>
                      </div>
                    </div>

                    {role === 'admin' && (
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="touch-target h-8 px-3 text-xs font-medium border-primary/20 hover:bg-primary/5 shadow-sm ml-1"
                            onClick={() => { setSelectedEmp(emp.names); setCaAmount(""); setCaNote(""); setCaDate(new Date().toISOString().split("T")[0]); setEditingCaId(null); setCaModalOpen(true); }}>
                            <Banknote className="h-3.5 w-3.5 mr-1.5 text-primary" /> Advance
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Staff Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {statusTab === 'Active' ? (
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(emp, 'On Leave')} className="text-warning focus:text-warning gap-2 cursor-pointer">
                                        <Archive className="h-4 w-4" /> On leave
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(emp, 'Active')} className="text-success focus:text-success gap-2 cursor-pointer">
                                        <Activity className="h-4 w-4" /> Reactivate Staff
                                    </DropdownMenuItem>
                                )}

                                {statusTab !== 'Inactive' && (
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(emp, 'Inactive')} className="text-destructive focus:text-destructive gap-2 cursor-pointer">
                                        <UserMinus className="h-4 w-4" /> Resign / Inactive
                                    </DropdownMenuItem>
                                )}

                                {statusTab === 'Inactive' && bal > 0 && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleWriteOff(emp.names)} className="text-destructive focus:bg-destructive/10 font-bold gap-2 cursor-pointer">
                                            <Ban className="h-4 w-4" /> Write-off Debt
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TabsContent>
  </Tabs>

      {/* Cash Advance History */}
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b border-border">
            <button
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:opacity-80 transition-opacity"
                onClick={() => setShowCaHistory(h => !h)}
            >
                <History className="h-4 w-4 text-primary" /> 
                Cash Advance History
                <span className="text-[10px] text-muted-foreground ml-1">{showCaHistory ? "▲ Hide" : "▼ Show"}</span>
            </button>
        </div>
        {showCaHistory && (
          <div className="divide-y divide-border border-t border-border">
            {advances.filter(a => Number(a.amount) > 0).length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No cash advances recorded.</p>
            ) : (
              advances.filter(a => Number(a.amount) > 0).map((ca: any) => (
                <div key={ca.id} className="relative overflow-hidden group">
                  {/* Actions (Hidden behind) */}
                  {isEditMode && role !== 'viewer' && ca.status !== 'Deducted' && (
                    <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-4 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50" onClick={() => openEditCa(ca)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        {role === 'admin' && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-red-50" onClick={() => handleDeleteAdvance(ca.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                  )}

                  {/* Main Content */}
                  <div className={`p-4 flex flex-wrap gap-2 justify-between items-center bg-card transition-transform duration-300 ease-in-out ${isEditMode && ca.status !== 'Deducted' ? 'group-hover:-translate-x-28' : ''}`}>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{ca.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{ca.date} · {ca.note || "C/A"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-destructive">{formatCurrency(ca.amount)}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded uppercase ${
                            ca.status === 'Deducted' ? 'bg-success/10 text-success' : 
                            ca.status === 'Partially Deducted' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                            ca.status === 'Written-off' ? 'bg-purple-100 text-purple-700' :
                            'bg-warning/10 text-warning'}`}>
                        {ca.status}
                        </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Custom Safety Confirmation Modal */}
      <Dialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
               <div className={`${confirmConfig.title.toLowerCase().includes('write') ? 'bg-purple-100' : 'bg-destructive/10'} p-6 flex flex-col items-center text-center space-y-3`}>
                  <div className="bg-white p-3 rounded-full shadow-sm">
                      {confirmConfig.title.toLowerCase().includes('balance') ? <AlertCircle className="h-6 w-6 text-warning" /> :
                       confirmConfig.title.toLowerCase().includes('write') ? <Ban className="h-6 w-6 text-purple-600" /> :
                       <Trash2 className="h-6 w-6 text-destructive" />}
                  </div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${
                      confirmConfig.title.toLowerCase().includes('balance') ? 'text-warning' : 
                      confirmConfig.title.toLowerCase().includes('write') ? 'text-purple-700' : 
                      'text-destructive'}`}>
                    {confirmConfig.title}
                  </h3>
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
