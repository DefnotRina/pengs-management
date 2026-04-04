import React, { useState } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Package, Eye, LockKeyhole, ChevronRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [pin, setPin] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(selectedRole, pin);
    if (success) {
      toast.success(`Logged in as ${selectedRole}`);
    } else {
      toast.error('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  const roles = [
    { id: 'admin' as const, label: 'Admin', desc: 'Owner', icon: ShieldCheck },
    { id: 'packer' as const, label: 'Packer', desc: 'Production', icon: Package },
    { id: 'viewer' as const, label: 'Viewer', icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">

      {/* Soft orange glow at the top */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-primary/10 blur-3xl rounded-full -translate-y-1/2" />

      <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="ring-4 ring-primary/20 rounded-full shadow-lg shadow-primary/10 overflow-hidden w-20 h-20 bg-white">
            <img src={logo} alt="Peng's Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Peng's</h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary mt-0.5">
              Production Manager
            </p>
          </div>
        </div>

        {/* Role selection */}
        {!selectedRole ? (
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground text-center">
                Select your role
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0">
              {roles.map((role) => (
                <button
                  key={role.id}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 group text-left"
                  onClick={() => {
                    if (role.id === 'viewer') {
                      login('viewer');
                    } else {
                      setSelectedRole(role.id);
                    }
                  }}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <role.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground">{role.label}</p>
                    <p className="text-xs text-muted-foreground">{role.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm border-border animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="pb-2">
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-3 w-fit"
                onClick={() => { setSelectedRole(null); setPin(''); }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <LockKeyhole className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <CardTitle className="text-base">Enter {selectedRole.toUpperCase()} PIN</CardTitle>
                  <CardDescription className="text-xs mt-0.5">4-digit access code</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-3 mt-2">
                <Input
                  type="password"
                  placeholder="••••"
                  className="text-center text-4xl h-20 font-mono tracking-[0.5em] bg-muted/40 focus-visible:ring-primary"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                />
                <Button type="submit" className="w-full font-bold h-11">
                  Unlock Access
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
