import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Receipt, Warehouse, Users, UserRound, Banknote, Contact, ShieldAlert, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import logo from "@/assets/logo.png";

const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "packer", "viewer"] },
    { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ["admin", "packer", "viewer"] },
    { to: "/inventory", label: "Inventory", icon: Warehouse, roles: ["admin", "packer", "viewer"] },
    { to: "/packing", label: "Packing", icon: Package, roles: ["admin", "packer", "viewer"] },
    { to: "/expenses", label: "Expenses", icon: Receipt, roles: ["admin", "viewer"] },
    { to: "/payroll", label: "Payroll", icon: Banknote, roles: ["admin", "viewer"] },
    { to: "/employees", label: "Employees", icon: Users, roles: ["admin", "viewer"] },
    { to: "/clients", label: "Clients", icon: Contact, roles: ["admin", "viewer"] },
];

export function MobileNav() {
    const { isEditMode, setIsEditMode, role } = useAuth();
    const filteredItems = navItems.filter(item => item.roles.includes(role || 'viewer'));
    const mainItems = filteredItems.slice(0, 4);
    const moreItems = filteredItems.slice(4);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
            <div className="flex items-center justify-between h-16 px-2">
                <div className="flex flex-1 justify-around items-center">
                    {mainItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/"}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-0.5 py-2 px-1 touch-target text-[10px] transition-colors ${isActive ? "text-primary font-semibold" : "text-muted-foreground"
                                }`
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                    
                    {moreItems.length > 0 && (
                        <Drawer>
                            <DrawerTrigger asChild>
                                <button className="flex flex-col items-center gap-0.5 py-2 px-1 touch-target text-[10px] text-muted-foreground hover:text-primary transition-colors">
                                    <Menu className="h-5 w-5" />
                                    <span>More</span>
                                </button>
                            </DrawerTrigger>
                            <DrawerContent className="pb-8">
                                <DrawerHeader className="border-b mb-4 pt-2">
                                    <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground text-center">More Pages</DrawerTitle>
                                </DrawerHeader>
                                <div className="grid grid-cols-3 gap-4 px-6">
                                    {moreItems.map((item) => (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-muted transition-colors border bg-muted/20"
                                        >
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                <item.icon className="h-6 w-6" />
                                            </div>
                                            <span className="text-[10px] font-bold text-center">{item.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            </DrawerContent>
                        </Drawer>
                    )}
                </div>
                
                <div className="w-px h-8 bg-border mx-2"></div>
                
                {role !== 'viewer' && (
                    <div className="px-2 flex flex-col items-center gap-1 shrink-0">
                        <Switch 
                            checked={isEditMode} 
                            onCheckedChange={setIsEditMode}
                            className="scale-75 data-[state=checked]:bg-danger"
                        />
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${isEditMode ? 'text-danger' : 'text-muted-foreground opacity-50'}`}>
                            {isEditMode ? 'Edit ON' : 'Edit'}
                        </span>
                    </div>
                )}
            </div>
        </nav>
    );
}

export function DesktopSidebar() {
    const { isEditMode, setIsEditMode, role, logout } = useAuth();
    const filteredItems = navItems.filter(item => item.roles.includes(role || 'viewer'));

    return (
        <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-border bg-card h-screen sticky top-0">
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3 mb-1">
                    <img src={logo} alt="Peng's Logo" className="h-8 w-8 object-contain" />
                    <h1 className="text-lg font-bold text-primary">Peng's</h1>
                    <ShieldAlert className={`h-4 w-4 transition-colors ml-auto ${isEditMode ? 'text-danger animate-pulse' : 'text-muted-foreground/20'}`} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Production Manager</p>
                  <button 
                    onClick={logout}
                    className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground hover:text-danger transition-colors"
                  >
                    Logout
                  </button>
                </div>
            </div>

            <nav className="flex-1 p-2 space-y-1">
                {filteredItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium touch-target transition-colors ${isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-muted"
                            }`
                        }
                    >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {role !== 'viewer' && (
                <div className={`mt-auto m-3 p-3 rounded-xl border transition-all duration-300 ${isEditMode ? 'bg-danger/5 border-danger/20' : 'bg-muted/30 border-border'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${isEditMode ? 'text-danger' : 'text-muted-foreground'}`}>
                                Management Mode
                            </p>
                            <p className="text-[9px] text-muted-foreground">Enable editing features</p>
                        </div>
                        <Switch 
                            checked={isEditMode} 
                            onCheckedChange={setIsEditMode} 
                            className="data-[state=checked]:bg-danger"
                        />
                    </div>
                </div>
            )}
        </aside>
    );
}
