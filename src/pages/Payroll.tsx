import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { DatePicker } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/StatCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, Receipt, Plus, Trash2, FileText } from "lucide-react";

import { 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  subDays, 
  format,
  parseISO
} from "date-fns";

const formatCurrency = (v: number) => `₱${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (date: Date) => format(date, "MMM d, yyyy");

export default function Payroll() {
  const { role } = useAuth();
  const [payroll, setPayroll] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Date Range State: Default to current week (Mon-Sun)
  const [baseDate, setBaseDate] = useState(new Date());
  
  const weekStart = format(startOfWeek(baseDate, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(baseDate, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const handlePrevWeek = () => setBaseDate(prev => subDays(prev, 7));
  const handleNextWeek = () => setBaseDate(prev => addDays(prev, 7));
  const handleThisWeek = () => setBaseDate(new Date());

  // Payslip Modal State
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  
  // Dynamic Deductions Array: { label: string, amount: number }
  const [customDeductions, setCustomDeductions] = useState<{label: string, amount: number}[]>([]);
  const [newDedLabel, setNewDedLabel] = useState("");
  const [newDedAmount, setNewDedAmount] = useState("");
  // Bonuses / Additional Income
  const [bonuses, setBonuses] = useState<{label: string, amount: number}[]>([]);
  const [newBonusLabel, setNewBonusLabel] = useState("");
  const [newBonusAmount, setNewBonusAmount] = useState("");
  const [settling, setSettling] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  const [allCaData, setAllCaData] = useState<any[]>([]);
  const [selectedCaIds, setSelectedCaIds] = useState<string[]>([]);
  const [receiptScale, setReceiptScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Confirmation State
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  // Read piece rate from localStorage (set in Employees page)
  const pieceRate = Number(localStorage.getItem('peng_piece_rate') || '3.5');;

  const downloadReceipt = async () => {
       const element = document.getElementById("receipt-master");
       if (!element) return;
      try {
          const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          const link = document.createElement("a");
          link.download = `Payslip-${viewingReceipt.names}-${viewingReceipt.receipt.week_end}.jpg`;
          link.href = dataUrl;
          link.click();
          toast.success("Receipt downloaded!");
      } catch (e) {
          toast.error("Failed to generate JPG");
          console.error(e);
      }
  };

  const fetchPayroll = async () => {
    setIsLoading(true);
    
    // We only care about packing entries in this specific date range
    const { data: packingData, error } = await supabase.from('packing')
        .select('date, cook_name, pack_size, packs_produced')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true });
        
    const { data: employeesData, error: empErr } = await supabase.from('employees').select('*');
    if (empErr) console.error("Employee fetch error:", empErr);
    // Only load POSITIVE, PENDING advances
    const { data: caData } = await supabase.from('cash_advances').select('*').gt('amount', 0);
    setAllCaData(caData || []);
    
    // Fetch receipts for this exact week to see who is already settled
    const { data: receipts } = await supabase.from('payroll_receipts')
        .select('*')
        .eq('week_start', weekStart)
        .eq('week_end', weekEnd);
    
    if (error) {
      console.error("Failed to load payroll data", error);
      toast.error("Failed to load computation data");
    } else if (packingData && employeesData) {
      
      const empMap = employeesData.reduce((acc: any, emp: any) => {
        // Count PENDING advances in the balance (Deducted, Partially Deducted and Written-off are excluded)
        const caBalance = (caData || [])
            .filter((a: any) => a.employee_name === emp.names && a.status === 'Pending')
            .reduce((sum: number, a: any) => sum + Number(a.amount), 0);

        // Check if they have a finalized receipt for this week
        const receipt = (receipts || []).find(r => r.employee_name === emp.names);

        acc[emp.names] = {
           names: emp.names,
           pay_type: emp.pay_type,
           base_salary: emp.base_salary,
           totalPieces: 0,
           detailedEntries: [] as {date:string, pack_size:number, packs_produced:number, pieces:number}[],
           dailyProduction: {} as Record<string, number>, // kept for totalPieces summary
           caBalance,
           receipt
        };
        return acc;
      }, {});

      packingData.forEach((entry: any) => {
        const computedPieces = (entry.pack_size || 0) * (entry.packs_produced || 0);
        if (empMap[entry.cook_name]) {
           empMap[entry.cook_name].totalPieces += computedPieces;
           empMap[entry.cook_name].detailedEntries.push({
               date: entry.date,
               pack_size: entry.pack_size,
               packs_produced: entry.packs_produced,
               pieces: computedPieces
           });
        }
      });

      const computed = Object.values(empMap).map((c: any) => {
        let pay = 0;
        if (c.pay_type?.toLowerCase().includes('output')) {
           const totalUnits = c.detailedEntries.reduce((sum: number, e: any) => sum + Math.floor(e.pieces / 11), 0);
           pay = totalUnits * pieceRate;
        }
        return {
           ...c,
           computedPay: pay
        };
      });

      // SMART FILTER: Only show someone if:
      // 1. They are currently 'Active'
      // 2. OR they did some work this week (totalPieces > 0)
      // 3. OR they were already paid this week (receipt exists)
      const filteredPayroll = computed.filter((c: any) => {
          const emp = employeesData.find(e => e.names === c.names);
          const status = emp?.status || 'Active';
          return (
              status === 'Active' || 
              c.totalPieces > 0 || 
              !!c.receipt
          );
      });

      setPayroll(filteredPayroll.sort((a, b) => b.computedPay - a.computedPay));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPayroll();
  }, [weekStart, weekEnd]);

  // UNIVERSAL AUTO-SCALING LOGIC
  useEffect(() => {
    if (!viewingReceipt) return;
    
    const updateScale = () => {
        const width = window.innerWidth;
        if (width < 800) {
            // Target 92% of screen width, but never larger than 1 (100%)
            const newScale = Math.min(1, (width * 0.92) / 800);
            setReceiptScale(newScale);
        } else {
            setReceiptScale(1);
        }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [viewingReceipt]);

  const openPayslip = (emp: any) => {
      setSelectedEmp(emp);
      setCustomDeductions([]);
      setSelectedCaIds([]);
      setNewDedLabel("");
      setNewDedAmount("");
      setBonuses([]);
      setNewBonusLabel("");
      setNewBonusAmount("");
      setPayslipModalOpen(true);
  };

  const toggleCa = (ca: any) => {
      const isSelected = selectedCaIds.includes(String(ca.id));
      if (isSelected) {
          setSelectedCaIds(prev => prev.filter(id => id !== String(ca.id)));
      } else {
          setSelectedCaIds(prev => [...prev, String(ca.id)]);
      }
  };

  const addCustomDeduction = () => {
      if (!newDedLabel.trim()) {
          toast.error("Please fill in a label for the deduction.");
          return;
      }
      if (!newDedAmount || Number(newDedAmount) <= 0) {
          toast.error("Please enter a valid amount for the deduction.");
          return;
      }
      setCustomDeductions([...customDeductions, { label: newDedLabel.trim(), amount: Number(newDedAmount) }]);
      setNewDedLabel("");
      setNewDedAmount("");
  };

  const removeDeduction = (idx: number) => {
      setCustomDeductions(customDeductions.filter((_, i) => i !== idx));
  };

  const addBonus = () => {
      if (!newBonusLabel.trim()) {
          toast.error("Please fill in a label for the bonus.");
          return;
      }
      if (!newBonusAmount || Number(newBonusAmount) <= 0) {
          toast.error("Please enter a valid amount for the bonus.");
          return;
      }
      setBonuses([...bonuses, { label: newBonusLabel.trim(), amount: Number(newBonusAmount) }]);
      setNewBonusLabel("");
      setNewBonusAmount("");
  };

  const removeBonus = (idx: number) => {
      setBonuses(bonuses.filter((_, i) => i !== idx));
  };

  const handleSettle = async () => {
      if (!selectedEmp) return;
      setSettling(true);

      // Combine C/A and Custom Deductions for the persistent record
      // Use explicit type to ensure ca_id is always preserved
      type BreakdownItem = { label: string; amount: number; ca_id?: string };
      const selectedCaItems = allCaData.filter(ca => selectedCaIds.includes(ca.id));
      const combinedBreakdown: BreakdownItem[] = [
          ...selectedCaItems.map(ca => ({ 
              label: (ca.note || "C/A").replace(/^C\/A\s-\s/i, ''), 
              amount: Number(ca.amount),
              ca_id: String(ca.id) // UUID stays as string — DO NOT cast to Number
          })),
          ...customDeductions.map(d => ({
              label: d.label.replace(/^C\/A\s-\s/i, ''),
              amount: Number(d.amount),
              ca_id: undefined
          }))
      ];

      const totalDed = combinedBreakdown.reduce((s, d) => s + Number(d.amount), 0);
      const totalBonus = bonuses.reduce((s, b) => s + Number(b.amount), 0);
      const grossIncome = selectedEmp.pay_type?.toLowerCase().includes('output') 
          ? selectedEmp.computedPay 
          : Number(selectedEmp.base_salary || 0);

      const actualDeduction = Math.min(grossIncome + totalBonus, totalDed);
      const finalNetPay = Math.max(0, grossIncome + totalBonus - totalDed);

      // Generate Payslip Receipt with Breakdown JSON
      const { error: receiptErr } = await supabase.from('payroll_receipts').insert({
          employee_name: selectedEmp.names,
          week_start: weekStart,
          week_end: weekEnd,
          gross_income: grossIncome,
          ca_deduction: actualDeduction,
          net_total: finalNetPay,
          deductions_breakdown: combinedBreakdown,
          bonuses_breakdown: bonuses // JSON column
      });

      if (receiptErr) {
          toast.error("Failed to generate payslip!");
          setSettling(false);
          return;
      }

      // SMART CARRY-OVER: walk through each deduction item in order of income availability
      // and determine the exact status for each CA:
      //   Deducted         = income fully covered this item
      //   Partially Deducted = income only covered part of this item (remainder is carried over)
      //   Pending (no-op)  = income was already exhausted (₱0 taken for this item)
      let runningIncome = grossIncome;
      const invisibleMarker = "\u200B";

      for (const item of combinedBreakdown) {
          const itemAmount = Number(item.amount);
          const amountCovered = Math.min(itemAmount, runningIncome);
          const remainingForItem = itemAmount - amountCovered;

          // Only update status for real CA entries (not custom deductions)
          if (item.ca_id != null) {
              if (amountCovered <= 0) {
                  // ₱0 income — nothing taken, leave as Pending (no update)
              } else if (remainingForItem > 0) {
                  // Partially covered — mark original as Partially Deducted
                  const { error: partialErr } = await supabase
                      .from('cash_advances')
                      .update({ status: 'Partially Deducted' })
                      .eq('id', item.ca_id);
                  if (partialErr) console.error('Failed to update Partially Deducted:', partialErr);
              } else {
                  // Fully covered — mark as Deducted
                  const { error: fullErr } = await supabase
                      .from('cash_advances')
                      .update({ status: 'Deducted' })
                      .eq('id', item.ca_id);
                  if (fullErr) console.error('Failed to update Deducted:', fullErr);
              }
          }

          // Insert carry-over entry for whatever couldn't be covered
          if (remainingForItem > 0) {
              const originalDate = item.ca_id != null
                ? (allCaData.find(ca => ca.id === item.ca_id)?.date || format(new Date(), 'yyyy-MM-dd'))
                : format(new Date(), 'yyyy-MM-dd');

              await supabase.from('cash_advances').insert({
                  employee_name: selectedEmp.names,
                  amount: remainingForItem,
                  note: item.label + invisibleMarker,
                  status: 'Pending',
                  date: originalDate // PRESERVE ORIGINAL DATE
              });
          }
          runningIncome = Math.max(0, runningIncome - amountCovered);
      }

      if (totalDed > grossIncome + totalBonus) {
          toast.warning(`Net pay was negative. Remaining balances were automatically carried over with original dates.`);
      } else {
          toast.success(`Payslip generated for ${selectedEmp.names}`);
      }

      setSettling(false);
      setPayslipModalOpen(false);
      setSelectedCaIds([]);
      setBonuses([]);
      fetchPayroll();
  };


  const selectedCaAmountTotal = allCaData
      .filter(ca => selectedCaIds.includes(ca.id))
      .reduce((s, ca) => s + Number(ca.amount), 0);

  const currentTotalDeductions = selectedCaAmountTotal + customDeductions.reduce((s, d) => s + Number(d.amount), 0);
  const currentTotalBonuses = bonuses.reduce((s, b) => s + Number(b.amount), 0);
  const currentGross = selectedEmp 
      ? (selectedEmp.pay_type?.toLowerCase().includes('output') 
          ? selectedEmp.computedPay 
          : Number(selectedEmp.base_salary || 0))
      : 0;
  const currentNetPay = currentGross + currentTotalBonuses - currentTotalDeductions;

  // REUSABLE RECEIPT TEMPLATE FOR CLEAN RENDERING
  const ReceiptTemplate = ({ id, empData, receiptData, entries }: any) => (
      <div id={id} className="w-[800px] p-8 bg-white text-black min-h-[300px] font-mono text-sm leading-tight text-left">
          <div className="text-center mb-6 border-b-2 border-dashed border-gray-300 pb-4">
              <h2 className="text-2xl font-bold tracking-widest uppercase mb-1">PAYSLIP</h2>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest">{empData.names}</p>
              <p className="text-xs text-gray-400">{receiptData.week_start} to {receiptData.week_end}</p>
          </div>
          
          <div className={`flex flex-row gap-8 ${!empData?.pay_type?.toLowerCase().includes('output') ? 'justify-center' : ''}`}>
              {/* Left Column: Daily Output */}
              {empData?.pay_type?.toLowerCase().includes('output') && (
                  <div className="flex-1 border-r-2 border-dashed border-gray-200 pr-8">
                      <h3 
                          className="font-bold mb-3 inline-block pb-1 uppercase tracking-widest"
                          style={{ color: '#98a1ac', fontSize: '12px', letterSpacing: '1.7px' }}
                      >
                          PRODUCTION TIMELINE
                      </h3>
                      <div className="space-y-1 mb-4 text-xs font-mono">
                          {/* Evenly Spread Header */}
                          <div 
                              className="grid grid-cols-4 gap-2 uppercase pb-1 border-b border-gray-200 font-mono"
                              style={{ color: '#d4d5db', fontSize: '10px' }}
                          >
                              <span className="text-left font-bold">Date</span>
                              <span className="text-center font-bold">Type</span>
                              <span className="text-center font-bold">Packs</span>
                              <span className="text-right font-bold">÷11</span>
                          </div>
                          {(entries || []).map((e: any, i: number) => {
                              const rateUnits = Math.floor(e.pieces / 11);
                              return (
                                  <div key={i} className="grid grid-cols-4 gap-2 items-center border-b border-gray-50 py-0.5 font-mono">
                                      <span 
                                          className="text-left font-bold"
                                          style={{ color: '#4f515d', fontSize: '10px' }}
                                      >
                                          {e.date}
                                      </span>
                                      <span 
                                          className="text-center font-bold"
                                          style={{ color: '#98a1ac', fontSize: '10px' }}
                                      >
                                          {e.pack_size}'s
                                      </span>
                                        <span 
                                            className="text-center font-bold"
                                            style={{ color: '#4f515d', fontSize: '10px' }}
                                        >
                                            {e.packs_produced}
                                        </span>
                                      <span className="text-right font-bold text-blue-700">{rateUnits}</span>
                                  </div>
                              );
                          })}
                          {(entries || []).length === 0 && (
                              <p className="text-xs text-gray-400 italic">No packing entries for this week.</p>
                          )}
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold pt-2 border-t-2 border-gray-300">
                          <span style={{ fontSize: '14px' }}>Total Output</span>
                          <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded">
                              {(entries || []).reduce((sum: number, e: any) => sum + Math.floor(e.pieces / 11), 0)}
                          </span>
                      </div>
                  </div>
              )}
              
              {/* Right Column: Financials */}
              <div className="flex-1 min-w-[300px]">
                  <h3 
                      className="font-bold mb-3 inline-block pb-1 uppercase tracking-widest"
                      style={{ color: '#98a1ac', fontSize: '12px', letterSpacing: '1.7px' }}
                  >
                      FINANCIAL SUMMARY
                  </h3>
                  <div className="space-y-4 text-sm font-mono">
                        <div className="flex justify-between items-center p-2 border-b border-gray-100">
                            <span className="font-bold text-gray-600" style={{ fontSize: '12px' }}>GROSS INCOME</span>
                            <span className="font-bold text-black" style={{ fontSize: '12px' }}>{formatCurrency(receiptData.gross_income)}</span>
                        </div>

                      {/* Bonuses on Receipt */}
                      {receiptData.bonuses_breakdown?.length > 0 && (
                          <div className="pt-1">
                              <span className="font-bold text-gray-600 pb-1 mb-2 inline-block w-full text-xs">BONUSES</span>
                              {receiptData.bonuses_breakdown.map((bonus: any, i: number) => (
                                  <div key={i} className="flex justify-between text-xs mb-1.5 px-1 bg-green-50/40 rounded py-0.5">
                                      <span className="text-gray-600 font-medium">{bonus.label}</span>
                                      <span className="text-green-600 font-bold">+₱{Number(bonus.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </div>
                              ))}
                              <div className="flex justify-between text-xs font-bold mt-1 pt-1 border-t border-gray-200 px-1">
                                  <span>TOTAL BONUSES</span>
                                  <span className="text-green-600">+{formatCurrency(receiptData.bonuses_breakdown.reduce((s: number, b: any) => s + Number(b.amount), 0))}</span>
                              </div>
                          </div>
                      )}
                      
                      <div className="pt-2">
                          <span className="font-bold text-gray-600 pb-1 mb-2 inline-block w-full text-xs">DEDUCTIONS</span>
                          {receiptData.deductions_breakdown?.length > 0 ? (
                              receiptData.deductions_breakdown.map((ded: any, i: number) => (
                                  <div key={i} className="flex justify-between text-xs mb-1.5 px-1 bg-red-50/10 rounded py-0.5">
                                      <span className="text-gray-600 font-medium">{ded.label}</span>
                                      <span className="text-red-600 font-bold">₱{Number(ded.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </div>
                              ))
                          ) : (
                              <p className="text-xs text-gray-400 px-1 italic">No deductions filed.</p>
                          )}
                          <div className="flex justify-between text-xs font-bold mt-2 pt-2 border-t border-gray-200 px-1">
                              <span>TOTAL DEDUCTED</span>
                              <span className="text-destructive">-{formatCurrency(receiptData.ca_deduction)}</span>
                          </div>

                          {/* Show Carry Over if pay was capped */}
                          {receiptData.gross_income + (receiptData.bonuses_breakdown?.reduce((s: number, b: any) => s + Number(b.amount), 0) || 0) < receiptData.deductions_breakdown?.reduce((s: number, d: any) => s + Number(d.amount), 0) && (
                              <div className="flex justify-between text-[11px] font-bold text-orange-600 bg-orange-50 mt-1 px-1 py-1 rounded">
                                  <span className="italic">CARRY OVER DEBT:</span>
                                  <span>{formatCurrency(receiptData.deductions_breakdown?.reduce((s: number, d: any) => s + Number(d.amount), 0) - receiptData.gross_income)}</span>
                              </div>
                          )}
                      </div>

                        <div className="flex justify-between items-center pt-4 border-t-2 border-black mt-2">
                            <span className="font-extrabold tracking-widest text-sm">NET PAY</span>
                            <span className="font-extrabold text-lg text-green-700">{formatCurrency(receiptData.net_total)}</span>
                        </div>
                  </div>
              </div>
          </div>
      </div>
  );

  const handleEditPayslip = async (receipt: any) => {
      setConfirmConfig({
          open: true,
          title: "Un-settle Payslip?",
          message: "Editing will temporarily 'un-settle' this payslip so you can adjust it. This will revert deductions to 'Pending' status. Proceed?",
          onConfirm: async () => {
              setConfirmConfig(prev => ({ ...prev, open: false }));
              
              // 1. Identify which CAs were used
              const caIdsFromBreakdown: string[] = receipt.deductions_breakdown
                  ?.filter((d: any) => d.ca_id)
                  .map((d: any) => String(d.ca_id)) || [];
                  
              // 2. Revert those CAs to 'Pending' (covers both 'Deducted' and 'Partially Deducted')
              if (caIdsFromBreakdown.length > 0) {
                  await supabase.from('cash_advances')
                      .update({ status: 'Pending' })
                      .in('id', caIdsFromBreakdown)
                      .in('status', ['Deducted', 'Partially Deducted']);
              }
              
              // 3. Delete the old receipt
              const { error } = await supabase.from('payroll_receipts').delete().eq('id', receipt.id);

              if (error) {
                  toast.error("Failed to unlock payslip for editing");
                  return;
              }

              // 4. Undo any carry-over debt that was automatically created (identifying by the invisible \u200B marker)
              // Each carry-over entry was inserted as: label + invisibleMarker, so delete them one by one
              const invisibleMarker = "\u200B";
              const labelsInBreakdown = receipt.deductions_breakdown?.map((d: any) => d.label) || [];
              for (const label of labelsInBreakdown) {
                  await supabase.from('cash_advances')
                      .delete()
                      .eq('employee_name', receipt.employee_name)
                      .eq('note', label + invisibleMarker)
                      .eq('status', 'Pending');
              }
              
              // 5. Pre-fill the creation modal
              const emp = payroll.find(p => p.names === receipt.employee_name);
              if (emp) {
                  setSelectedEmp(emp);
                  setSelectedCaIds(caIdsFromBreakdown);
                  // Sanitize old labels when re-issuing
                  const sanitizedCustom = (receipt.deductions_breakdown?.filter((d: any) => !d.ca_id) || [])
                      .map((d: any) => ({ ...d, label: d.label.replace(/^C\/A\s-\s/i, '') }));
                  setCustomDeductions(sanitizedCustom);
                  setPayslipModalOpen(true);
              }
              
              setViewingReceipt(null);
              fetchPayroll();
          }
      });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Weekly Payroll & Payslips" />

      {/* Simplified Week Navigation Filter */}
      <div className="bg-card rounded-2xl border p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center md:items-start">
                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Payroll Period</span>
                <h2 className="text-sm md:text-lg font-bold text-foreground flex items-center gap-2">
                    {formatDate(startOfWeek(baseDate, { weekStartsOn: 0 }))}
                    <span className="text-muted-foreground font-medium">—</span>
                    {formatDate(endOfWeek(baseDate, { weekStartsOn: 0 }))}
                </h2>
            </div>
            
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-full border shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide">
                <Button variant="ghost" size="sm" onClick={handlePrevWeek} className="h-8 md:h-9 px-2 md:px-4 rounded-full text-[9px] md:text-xs font-semibold hover:bg-background flex-1 md:flex-none whitespace-nowrap">
                    Previous Week
                </Button>
                <div className="w-px h-3 md:h-4 bg-border shrink-0"></div>
                <Button variant="ghost" size="sm" onClick={handleThisWeek} className={`h-8 md:h-9 px-2 md:px-4 rounded-full text-[9px] md:text-xs font-bold uppercase tracking-tight flex-1 md:flex-none whitespace-nowrap ${format(baseDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? 'bg-white text-primary shadow-sm border border-border/50' : ''}`}>
                    This Week
                </Button>
                <div className="w-px h-3 md:h-4 bg-border shrink-0"></div>
                <Button variant="ghost" size="sm" onClick={handleNextWeek} className="h-8 md:h-9 px-2 md:px-4 rounded-full text-[9px] md:text-xs font-semibold hover:bg-background flex-1 md:flex-none whitespace-nowrap">
                    Next Week
                </Button>
            </div>

            <div className="hidden lg:block">
                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1 block text-right">Specific Date</label>
                <DatePicker 
                    date={baseDate} 
                    onChange={(date) => date && setBaseDate(date)} 
                    className="h-9 text-xs font-semibold w-40 rounded-lg shadow-sm" 
                />
            </div>
        </div>
      </div>

      {/* Payslip Generation Modal */}
      <Dialog open={payslipModalOpen} onOpenChange={setPayslipModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="sr-only">
                <DialogTitle>Payslip Preview</DialogTitle>
                <DialogDescription>Review payslip details</DialogDescription>
            </DialogHeader>
            {selectedEmp && (
                <div className="bg-card">
                    <div className="p-4 md:p-6 border-b border-border bg-slate-50 dark:bg-slate-900">
                        <h2 className="text-base md:text-xl font-semibold flex items-center gap-2 pr-8">
                            <Receipt className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                            Payslip Preview
                        </h2>
                        <p className="text-[11px] md:text-sm text-muted-foreground mt-0.5 md:mt-1">
                            {selectedEmp.names} • {weekStart} to {weekEnd}
                        </p>
                    </div>

                    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                        {/* Daily Breakdown */}
                        {selectedEmp.pay_type?.toLowerCase().includes('output') && (
                            <div>
                                <h3 className="text-[11px] md:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 md:mb-3 flex justify-between">
                                    <span>Production Output</span>
                                    <span>{selectedEmp.totalPieces.toLocaleString()} pcs</span>
                                </h3>
                                <div className="space-y-1.5 md:space-y-2 bg-muted/20 p-3 md:p-4 rounded-lg border border-border">
                                    {(selectedEmp?.detailedEntries || []).map((e: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center text-xs md:text-sm border-b border-border/40 pb-1.5 md:pb-2 last:border-0 last:pb-0">
                                            <span className="font-medium text-muted-foreground">{e.date} • {e.pack_size}'s</span>
                                            <span className="font-bold text-foreground">{(e.packs_produced || 0).toLocaleString()} packs</span>
                                        </div>
                                    ))}
                                    {(!selectedEmp?.detailedEntries || selectedEmp.detailedEntries.length === 0) && (
                                        <p className="text-[10px] md:text-xs text-center text-muted-foreground">No production mapped for this week.</p>
                                    )}
                                </div>
                                <div className="flex justify-between items-center mt-2.5 md:mt-3 pt-2.5 md:pt-3 border-t border-border px-1">
                                    <span className="text-xs md:text-sm font-bold text-foreground">Gross Income calculation:</span>
                                    <span className="text-xs md:text-sm font-bold text-success">{formatCurrency(selectedEmp.computedPay)}</span>
                                </div>
                            </div>
                        )}

                        {/* Bonuses Builder */}
                        <div>
                            <h3 className="text-[11px] md:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 md:mb-3 flex justify-between">
                                <span>Bonuses / Additional</span>
                                {currentTotalBonuses > 0 && <span className="text-green-600">+{formatCurrency(currentTotalBonuses)}</span>}
                            </h3>
                            <div className="space-y-1.5 md:space-y-2 mb-3">
                                {bonuses.map((bonus, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <Input
                                            value={bonus.label}
                                            onChange={e => {
                                                const updated = [...bonuses];
                                                updated[idx].label = e.target.value;
                                                setBonuses(updated);
                                            }}
                                            className="h-8 md:h-9 text-xs md:text-sm touch-target"
                                            placeholder="e.g. Performance Bonus"
                                        />
                                        <Input
                                            type="number"
                                            min="0"
                                            value={bonus.amount || ""}
                                            onChange={e => {
                                                const updated = [...bonuses];
                                                updated[idx].amount = Number(e.target.value);
                                                setBonuses(updated);
                                            }}
                                            className="h-8 md:h-9 text-xs md:text-sm touch-target w-20 md:w-28 text-right"
                                            placeholder="₱0.00"
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => removeBonus(idx)} className="h-8 w-8 md:h-9 md:w-9 text-destructive touch-target shrink-0">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-1.5 md:gap-2">
                                <Input value={newBonusLabel} onChange={e => setNewBonusLabel(e.target.value)} placeholder="e.g. Performance Bonus" className="h-8 md:h-9 text-xs md:text-sm grow" />
                                <Input type="number" min="0" value={newBonusAmount} onChange={e => setNewBonusAmount(e.target.value)} placeholder="0.00" className="h-8 md:h-9 text-xs md:text-sm w-20 md:w-24 text-right" />
                                <Button onClick={addBonus} variant="secondary" className="h-8 md:h-9 px-2.5 md:px-3 shrink-0"><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>

                        {/* Deductions Builder */}
                        <div>
                            <h3 className="text-[11px] md:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 md:mb-3 flex justify-between">
                                <span>Deductions</span>
                                <span className="text-destructive">-{formatCurrency(currentTotalDeductions)}</span>
                            </h3>
                            
                            {selectedEmp.caBalance > 0 && (
                                <p className="text-[10px] md:text-xs font-medium text-warning bg-warning/10 px-2 md:px-3 py-1.5 md:py-2 rounded-md mb-3">
                                    Outstanding C/A Balance: {formatCurrency(selectedEmp.caBalance)}
                                </p>
                            )}

                            {/* CA Quick-Pick from ledger: Only show Pending (active / carry-over). Deducted & Partially Deducted are archived. */}
                            {allCaData.filter(ca => ca.employee_name === selectedEmp.names && ca.status === 'Pending').length > 0 && (
                                <div className="mb-4">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pick C/A to Deduct</p>
                                    <div className="space-y-1.5 md:space-y-2">
                                        {allCaData.filter(ca => ca.employee_name === selectedEmp.names && ca.status === 'Pending').map((ca: any) => (
                                            <label key={ca.id} className={`flex items-center gap-2 md:gap-3 p-2 md:p-2.5 rounded-md border cursor-pointer transition-colors ${selectedCaIds.includes(ca.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/20'}`}>
                                                <input type="checkbox" checked={selectedCaIds.includes(ca.id)} onChange={() => toggleCa(ca)} className="accent-primary h-3.5 w-3.5 md:h-4 md:w-4" />
                                                <span className="flex-1 text-xs md:text-sm">
                                                    <span className="font-medium">{(ca.note || "Cash Advance").replace(/\u200B/g, '')}</span>
                                                    <span className="text-[10px] md:text-xs text-muted-foreground ml-2">{ca.date}</span>
                                                </span>
                                                <span className="text-xs md:text-sm font-bold text-destructive">{formatCurrency(ca.amount)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Other Deductions</p>
                            <div className="space-y-1.5 md:space-y-2 mb-3">
                                {customDeductions.map((ded, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <Input 
                                            value={ded.label.replace(/^C\/A\s-\s/i, '')} 
                                            onChange={e => {
                                                const newDeds = [...customDeductions];
                                                newDeds[idx].label = e.target.value;
                                                setCustomDeductions(newDeds);
                                            }} 
                                            className="h-8 md:h-9 text-xs md:text-sm touch-target" 
                                            placeholder="e.g. Rice" 
                                        />
                                        <Input 
                                            type="number" 
                                            min="0"
                                            value={ded.amount === 0 && ded.label === "Balance C/A" ? "" : ded.amount} 
                                            onChange={e => {
                                                const newDeds = [...customDeductions];
                                                newDeds[idx].amount = Number(e.target.value);
                                                setCustomDeductions(newDeds);
                                            }} 
                                            className="h-8 md:h-9 text-xs md:text-sm touch-target w-20 md:w-28 text-right" 
                                            placeholder="₱0.00" 
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => removeDeduction(idx)} className="h-8 w-8 md:h-9 md:w-9 text-destructive touch-target shrink-0">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex gap-1.5 md:gap-2">
                                <Input value={newDedLabel} onChange={e => setNewDedLabel(e.target.value)} placeholder="Add specific" className="h-8 md:h-9 text-xs md:text-sm grow" />
                                <Input type="number" min="0" value={newDedAmount} onChange={e => setNewDedAmount(e.target.value)} placeholder="0.00" className="h-8 md:h-9 text-xs md:text-sm w-20 md:w-24 text-right" />
                                <Button onClick={addCustomDeduction} variant="secondary" className="h-8 md:h-9 px-2.5 md:px-3 shrink-0"><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Sticky Footer with Solid Background to hide scrolling text */}
                    <div className="p-4 md:p-6 border-t border-border bg-white dark:bg-slate-910 sticky bottom-0 z-20 shadow-[0_-8px_25px_rgba(0,0,0,0.05)]">
                        <div className="flex flex-row items-center justify-between gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-widest leading-tight">Final Net Pay</span>
                                <span className={`text-xl md:text-2xl font-extrabold leading-tight ${currentNetPay < 0 ? 'text-destructive' : 'text-success'}`}>
                                    {formatCurrency(currentNetPay)}
                                </span>
                            </div>
                            <Button disabled={settling} onClick={handleSettle} className="flex-1 md:flex-none md:min-w-[200px] text-sm md:text-base h-11 md:h-12 shadow-sm rounded-full">
                                <Check className="h-4 w-4 mr-2" />
                                Finalize & Issue
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* View Printable Receipt Modal */}
      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 bg-white dark:bg-slate-950 border-border overflow-hidden">
            <DialogHeader className="sr-only">
                <DialogTitle>View Receipt</DialogTitle>
                <DialogDescription>Printable payslip receipt</DialogDescription>
            </DialogHeader>
            {viewingReceipt && (
                <>
                    {/* HIDDEN MASTER FOR CLEAN DOWNLOADS - NO SCALING */}
                    <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none opacity-0 z-[-50]">
                        <ReceiptTemplate 
                            id="receipt-master"
                            empData={viewingReceipt}
                            receiptData={viewingReceipt.receipt}
                            entries={viewingReceipt.detailedEntries}
                        />
                    </div>

                    <div className="p-0 font-mono text-sm max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col items-center bg-muted/5 relative">
                        {/* 
                            UNIVERSAL AUTO-SCALING CONTAINER
                            Dynamically calculates height to remove "ghost space" on any device.
                        */}
                        <div 
                            className="w-full flex justify-center overflow-visible py-6 md:py-12 px-4 transition-all duration-300"
                            style={{ minHeight: `${700 * receiptScale}px` }}
                        >
                            <div 
                                className="transform-gpu shadow-2xl rounded-sm ring-1 ring-black/5"
                                style={{ 
                                    transform: `scale(${receiptScale})`, 
                                    transformOrigin: 'top center',
                                    width: '800px',
                                    height: 'fit-content'
                                }}
                            >
                                <ReceiptTemplate 
                                    id="receipt-content"
                                    empData={viewingReceipt}
                                    receiptData={viewingReceipt.receipt}
                                    entries={viewingReceipt.detailedEntries}
                                />
                            </div>
                        </div>
                        
                        {/* Perfect Sticky Action Bar */}
                        <div className="w-full p-4 bg-white/80 backdrop-blur-md border-t border-border flex flex-col sm:flex-row justify-end gap-3 print:hidden sticky bottom-0 z-10 shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
                            <Button variant="outline" onClick={() => setViewingReceipt(null)} className="h-10 md:h-11">Close</Button>
                            {role === 'admin' && (
                                <Button variant="secondary" onClick={() => handleEditPayslip({ ...viewingReceipt.receipt, employee_name: viewingReceipt.names })} className="text-blue-600 h-10 md:h-11">
                                    Edit / Re-issue
                                </Button>
                            )}
                            <Button onClick={downloadReceipt} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 md:h-11 shadow-lg shadow-blue-500/20">
                                Download JPG Receipt
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </DialogContent>
      </Dialog>

      {/* Payroll Ledger Log */}
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-foreground">Employee Accounts</h2>
        </div>
        
        {isLoading ? (
             <p className="text-center text-sm text-muted-foreground py-10">Calculating payroll...</p>
        ) : payroll.length === 0 ? (
             <p className="text-center text-sm text-muted-foreground py-10">No production data found for this period.</p>
        ) : (
            <div className="divide-y divide-border">
              {payroll.map((c, i) => {
                const isPaid = !!c.receipt;

                return (
                  <div key={c.names} className="p-4 flex flex-col lg:flex-row gap-4 lg:items-center justify-between hover:bg-muted/10 transition-colors">
                    
                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground">{c.names}</p>
                            {isPaid && (
                                <span className="flex items-center gap-1 text-[10px] font-medium bg-success/10 text-success px-2 py-0.5 rounded uppercase">
                                    <Check className="h-3 w-3" /> Settled
                                </span>
                            )}
                        </div>
                        {c.pay_type?.toLowerCase().includes('output') ? (
                            <p className="text-xs text-muted-foreground">{c.totalPieces.toLocaleString()} pieces produced · gross: {formatCurrency(c.computedPay)}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">Fixed Rate Employee (Manual Entry)</p>
                        )}
                        <p className={`text-xs mt-1 font-medium ${c.caBalance > 0 ? "text-destructive" : "text-success"}`}>
                            C.A. Deductions Pending: {formatCurrency(c.caBalance)}
                        </p>
                    </div>

                    {/* Math & Actions */}
                    {isPaid ? (
                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-3 rounded-md border border-border/50 w-full lg:w-auto">
                            <div className="flex items-center justify-around w-full gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Gross</p>
                                    <p className="text-sm font-medium">{formatCurrency(c.receipt.gross_income)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Deducted</p>
                                    <p className="text-sm font-medium text-destructive">-{formatCurrency(c.receipt.ca_deduction)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Net Paid</p>
                                    <p className="text-sm font-bold text-success">{formatCurrency(c.receipt.net_total)}</p>
                                </div>
                            </div>
                            {/* Receipt Print Button */}
                            <Button variant="outline" className="w-full sm:w-auto touch-target shrink-0 gap-2 border-primary/30 text-primary hover:bg-primary/5" onClick={() => setViewingReceipt(c)}>
                                <FileText className="h-4 w-4" /> View Payslip
                            </Button>
                        </div>
                    ) : (
                        <div className="flex w-full lg:w-auto justify-end">
                                {role === 'admin' ? (
                                    <Button 
                                        onClick={() => openPayslip(c)} 
                                        disabled={!c.pay_type?.toLowerCase().includes('output') && !c.base_salary}
                                        className="h-10 touch-target font-medium w-full sm:w-auto shadow-sm gap-2"
                                        variant={!c.pay_type?.toLowerCase().includes('output') ? 'secondary' : 'default'}
                                    >
                                        <Receipt className="h-4 w-4" />
                                        Create Payslip
                                    </Button>
                                ) : (
                                    <div className="h-10 flex items-center px-4 text-xs font-medium text-muted-foreground bg-muted/20 rounded-md italic">
                                        Pending Settlement
                                    </div>
                                )}
                        </div>                    )}
                  </div>
                );
              })}
            </div>
        )}
      </div>

      {/* Custom Safety Confirmation Modal */}
      <Dialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-destructive/10 p-6 flex flex-col items-center text-center space-y-3">
                  <div className="bg-white p-3 rounded-full shadow-sm">
                      <Plus className="h-6 w-6 text-destructive rotate-45" /> { /* Use plus rotate as alert fallback */ }
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

