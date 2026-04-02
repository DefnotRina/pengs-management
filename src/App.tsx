import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Packing from "./pages/Packing";
import Orders from "./pages/Orders";
import Expenses from "./pages/Expenses";
import Inventory from "./pages/Inventory";
import Payroll from "./pages/Payroll";
import Employees from "./pages/Employees";
import Clients from "./pages/Clients";
import NotFound from "./pages/NotFound";

import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <AuthProvider>
                <Sonner position="top-center" richColors closeButton />
                <BrowserRouter>
                    <Routes>
                        {/* We'll handle the Login guard inside AppLayout or here */}
                        <Route path="/*" element={
                            <AppLayout>
                                <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/packing" element={<Packing />} />
                                    <Route path="/orders" element={<Orders />} />
                                    <Route path="/expenses" element={<Expenses />} />
                                    <Route path="/inventory" element={<Inventory />} />
                                    <Route path="/payroll" element={<Payroll />} />
                                    <Route path="/employees" element={<Employees />} />
                                    <Route path="/clients" element={<Clients />} />
                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </AppLayout>
                        } />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);

export default App;
