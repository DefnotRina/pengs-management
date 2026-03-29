import React, { useState } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Package, Eye, LockKeyhole } from 'lucide-react';
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
    { id: 'admin' as const, label: 'Admin', desc: 'Owner / QA Access', icon: ShieldCheck, color: 'text-primary' },
    { id: 'packer' as const, label: 'Packer', desc: 'Production Lead', icon: Package, color: 'text-orange-500' },
    { id: 'viewer' as const, label: 'Viewer', desc: 'Family / Auditor', icon: Eye, color: 'text-muted-foreground' },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-black">
      {/* Background Image */}
      <div 
        className="absolute inset-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: 'url(/Users/carlita/.gemini/antigravity/brain/4d03b623-8319-44b3-ac55-1733308fe2bb/bakery_login_bg_1774770021880.png)' }}
      />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 text-white flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <img src={logo} alt="Peng's Logo" className="h-20 w-20 mb-4 object-contain drop-shadow-2xl ring-4 ring-white/10 rounded-full" />
          <h1 className="text-4xl font-black tracking-tight mb-1">Peng's</h1>
          <p className="text-sm font-medium opacity-70 uppercase tracking-[0.2em]">Production Manager</p>
        </div>

        {!selectedRole ? (
          <div className="grid gap-4">
            {roles.map((role) => (
              <Card 
                key={role.id}
                className="cursor-pointer hover:scale-[1.02] transition-transform duration-300 border-white/10 bg-black/60 backdrop-blur-xl group"
                onClick={() => {
                  if (role.id === 'viewer') {
                    login('viewer');
                  } else {
                    setSelectedRole(role.id);
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center gap-4 p-6">
                  <div className={`p-3 rounded-xl bg-white/5 ${role.color} group-hover:bg-white/10 transition-colors`}>
                    <role.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-white group-hover:text-primary transition-colors">{role.label}</CardTitle>
                    <CardDescription className="text-white/60">{role.desc}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-white/10 bg-black/60 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-xl bg-white/10 text-white mb-4 w-fit">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <CardTitle className="text-white">Enter {selectedRole.toUpperCase()} PIN</CardTitle>
              <CardDescription className="text-white/60">Please provide your access code to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="password"
                  placeholder="••••"
                  className="bg-white/5 border-white/10 text-white text-center text-4xl h-20 font-mono tracking-[0.5em] focus:ring-primary"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="text-white/60 hover:text-white"
                    onClick={() => {
                      setSelectedRole(null);
                      setPin('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="font-bold">
                    Login
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
