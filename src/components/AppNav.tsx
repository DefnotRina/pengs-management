import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Receipt, Warehouse, Users, UserRound, Banknote, Contact, ShieldAlert, Menu, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo-text.png";

const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "packer", "viewer"] },
    { to: "/orders", label: "Orders", icon: ShoppingCart, roles: ["admin", "packer", "viewer"] },
    { to: "/inventory", label: "Inventory", icon: Warehouse, roles: ["admin", "packer", "viewer"] },
    { to: "/packing", label: "Packing", icon: Package, roles: ["admin", "packer", "viewer"] },
    { to: "/expenses", label: "Expenses", icon: Receipt, roles: ["admin", "viewer"] },
    { to: "/payroll", label: "Payroll", icon: Banknote, roles: ["admin", "viewer"] },
    { to: "/employees", label: "Employees", icon: Users, roles: ["admin", "packer", "viewer"] },
    { to: "/clients", label: "Clients", icon: Contact, roles: ["admin", "viewer"] },
];

export function MobileHeader() {
    const { isEditMode, setIsEditMode, role, logout } = useAuth();
    return (
        <header className="fixed top-0 left-0 right-0 h-16 border-b border-muted/20 bg-background/80 backdrop-blur-md flex items-center justify-between px-5 z-50 md:hidden">
            <div className="flex items-center gap-3 py-1">
                <img src={logo} alt="Peng's Logo" className="h-7 w-auto object-contain" />
            </div>
            
            <div className="flex items-center gap-4">
                {role !== 'viewer' && (
                    <div className="flex items-center gap-2">
                        <Switch 
                            checked={isEditMode} 
                            onCheckedChange={setIsEditMode}
                            className="scale-75 data-[state=checked]:bg-danger shadow-sm border-transparent"
                        />
                        <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${isEditMode ? 'text-danger' : 'text-muted-foreground opacity-50'}`}>
                            {isEditMode ? 'EDIT ON' : 'EDIT OFF'}
                        </span>
                    </div>
                )}
                <button 
                    onClick={logout}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-muted/20 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all border border-muted/10 active:scale-90"
                >
                    <LogOut className="h-3.5 w-3.5" />
                </button>
            </div>
        </header>
    );
}

export function MobileNav() {
    const { isEditMode, setIsEditMode, role } = useAuth();
    const location = useLocation();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const filteredItems = navItems.filter(item => item.roles.includes(role || 'viewer'));

    useEffect(() => {
        if (scrollContainerRef.current) {
            const activeLink = scrollContainerRef.current.querySelector('.text-primary');
            if (activeLink) {
                activeLink.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [location.pathname]);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center h-16">
                <div 
                    ref={scrollContainerRef}
                    className="w-full flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide gap-1 snap-x scroll-smooth px-2"
                >
                    {filteredItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/"}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 py-2 px-1 flex-[0_0_25%] touch-target text-[10px] transition-all duration-300 snap-center ${isActive ? "text-primary font-bold scale-105" : "text-muted-foreground opacity-60"
                                }`
                            }
                        >
                            <item.icon className={`h-5 w-5 transition-all duration-300 ${location.pathname === item.to ? 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]' : ''}`} />
                            <span className="whitespace-nowrap font-medium tracking-tighter">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </div>
        </nav>
    );
}

export function DesktopSidebar() {
    const { isEditMode, setIsEditMode, role, logout } = useAuth();
    const filteredItems = navItems.filter(item => item.roles.includes(role || 'viewer'));

    return (
        <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-border bg-card h-screen fixed left-0 top-0 z-40">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <img src={logo} alt="Peng's Logo" className="h-10 w-auto object-contain" />
                </div>
                <button 
                  onClick={logout}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-muted/20 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all border border-muted/10 active:scale-90"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
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
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <ShieldAlert className={`h-3 w-3 transition-colors ${isEditMode ? 'text-danger animate-pulse' : 'text-muted-foreground/40'}`} />
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isEditMode ? 'text-danger' : 'text-muted-foreground'}`}>
                                    Management Mode
                                </p>
                            </div>
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
