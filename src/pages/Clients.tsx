import { useState, useEffect } from "react";
import { PageHeader } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, User, Search, Pencil, Trash2, Tag, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PRODUCTS } from "@/lib/mock-data";

const formatCurrency = (v: number) => `₱${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { isEditMode, role } = useAuth();

  // Add/Edit Client State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    contact_number: "",
    address: ""
  });

  // Pricing State
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [currentPricing, setCurrentPricing] = useState<any[]>([]);
  const [newPrices, setNewPrices] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      toast.error(`Failed to load clients: ${error.message}`);
      console.error(error);
    }
    else setClients(data || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', editingClient.id);
      
      if (error) toast.error(`Failed to update client: ${error.message}`);
      else {
        toast.success("Client updated");
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .insert([formData]);
      
      if (error) {
        toast.error(`Failed to add client: ${error.message}`);
        console.error(error);
      }
      else {
        toast.success("Client added");
        setModalOpen(false);
        fetchData();
      }
    }
  };

  const openPricing = async (client: any) => {
    setEditingClient(client);
    setIsLoading(true);
    const { data, error } = await supabase
      .from('client_pricing')
      .select('*')
      .eq('client_id', client.id);
    
    if (error) toast.error(`Failed to load pricing: ${error.message}`);
    else {
      setCurrentPricing(data || []);
      const priceMap: Record<string, string> = {};
      data?.forEach(p => {
         priceMap[p.product_name] = String(p.custom_price);
      });
      setNewPrices(priceMap);
      setPricingModalOpen(true);
    }
    setIsLoading(false);
  };

  const handleSavePrices = async () => {
    if (!editingClient) return;

    // We'll upsert: deleting old and inserting new for this client is simplest for a small list
    const toInsert = Object.entries(newPrices)
      .filter(([_, price]) => price && !isNaN(Number(price)))
      .map(([name, price]) => ({
        client_id: editingClient.id,
        product_name: name,
        custom_price: Number(price)
      }));

    // Start with a delete for this client
    const { error: delErr } = await supabase
        .from('client_pricing')
        .delete()
        .eq('client_id', editingClient.id);

    if (delErr) {
        toast.error("Failed to clear old pricing");
        return;
    }

    if (toInsert.length > 0) {
        const { error: insErr } = await supabase
            .from('client_pricing')
            .insert(toInsert);
        
        if (insErr) {
            toast.error("Failed to save new pricing");
            return;
        }
    }

    toast.success(`Pricing updated for ${editingClient.name}`);
    setPricingModalOpen(false);
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("Are you sure? This will also remove their custom pricing history.")) return;
    
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) toast.error(`Failed to delete client: ${error.message}`);
    else {
      toast.success("Client deleted");
      fetchData();
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <PageHeader title="Client Management" />
        {role !== 'viewer' && (
          <Button onClick={() => { 
            setEditingClient(null); 
            setFormData({ name: "", contact_person: "", contact_number: "", address: "" }); 
            setModalOpen(true); 
          }} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Client
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by client name or contact person..." 
          className="pl-10 h-10 shadow-sm bg-card" 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && clients.length === 0 ? (
          <p className="col-span-full text-center py-10 text-muted-foreground">Loading clients...</p>
        ) : filteredClients.map(client => (
          <div key={client.id} className="bg-card border rounded-xl p-4 shadow-sm hover:ring-2 ring-primary/10 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="flex gap-1">
                {isEditMode && role !== 'viewer' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                    setEditingClient(client);
                    setFormData({
                      name: client.name,
                      contact_person: client.contact_person || "",
                      contact_number: client.contact_number || "",
                      address: client.address || ""
                    });
                    setModalOpen(true);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {isEditMode && role === 'admin' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClient(client.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <h3 className="font-bold text-lg leading-tight mb-1">{client.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">{client.address || "No address provided"}</p>
            
            <div className="space-y-2 text-sm border-t pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Contact</span>
                <span className="font-medium text-foreground">{client.contact_person || "None"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium text-foreground">{client.contact_number || "None"}</span>
              </div>
            </div>

            {isEditMode && (
              <Button variant="secondary" className="w-full mt-4 h-9 font-bold text-xs gap-2" onClick={() => openPricing(client)}>
                <Tag className="h-3.5 w-3.5" /> Manage Pricing
              </Button>
            )}
          </div>
        ))}
        {filteredClients.length === 0 && !isLoading && (
            <p className="col-span-full text-center py-10 text-muted-foreground italic">No clients found. Add your first regular client to set custom prices!</p>
        )}
      </div>

      {/* Add/Edit Client Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveClient} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Client/Store Name</label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Sari-Sari Store" required />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Contact Person</label>
              <Input value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} placeholder="e.g. Aling Nena" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Contact Number</label>
              <Input value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} placeholder="09XX XXX XXXX" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Address</label>
              <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full delivery address" />
            </div>
            <Button type="submit" className="w-full h-11 font-bold">
              {editingClient ? "Update Profile" : "Create Profile"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pricing Manager Dialog */}
      <Dialog open={pricingModalOpen} onOpenChange={setPricingModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center pr-6">
                <span>Custom Pricing: {editingClient?.name}</span>
                <span className="text-[10px] font-normal text-muted-foreground">Standard Base Price is applied if left blank</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
             <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                <div className="col-span-8">Product Name</div>
                <div className="col-span-4 text-right">Custom Price (₱)</div>
             </div>
             
             {PRODUCTS.map(product => {
                const isCustom = newPrices[product.name] !== undefined && newPrices[product.name] !== "";
                return (
                  <div key={product.name} className={`grid grid-cols-12 gap-3 items-center p-2 rounded-lg border transition-colors ${isCustom ? 'bg-primary/5 border-primary/20' : 'bg-muted/10 border-transparent opacity-80'}`}>
                    <div className="col-span-8">
                       <p className="text-sm font-bold text-foreground">{product.name}</p>
                       <p className="text-[10px] text-muted-foreground italic">Base Price: {formatCurrency(product.basePrice)}</p>
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                       <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₱</span>
                          <Input 
                            type="number"
                            step="any"
                            placeholder={String(product.basePrice)}
                            value={newPrices[product.name] || ""}
                            onChange={e => setNewPrices({...newPrices, [product.name]: e.target.value})}
                            className="h-9 pl-5 text-right font-bold text-xs"
                          />
                       </div>
                       {isCustom && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                             const updated = {...newPrices};
                             delete updated[product.name];
                             setNewPrices(updated);
                          }}>
                             <X className="h-4 w-4" />
                          </Button>
                       )}
                    </div>
                  </div>
                );
             })}
          </div>

          <div className="sticky bottom-0 bg-background pt-6 pb-2 border-t mt-6 flex gap-3">
             <Button variant="outline" className="flex-1" onClick={() => setPricingModalOpen(false)}>Cancel</Button>
             <Button className="flex-1 gap-2 font-bold" onClick={handleSavePrices}>
                <Save className="h-4 w-4" /> Save Prices
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
