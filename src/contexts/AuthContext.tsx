import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'packer' | 'viewer' | null;

interface AuthContextType {
  role: UserRole;
  isAuthenticated: boolean;
  isEditMode: boolean; // Retain functionality for Admin/Packer
  setIsEditMode: (val: boolean) => void;
  login: (role: UserRole, pin?: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In a real app, these would be in a DB or .env
const ADMIN_PIN = '8888';
const PACKER_PIN = '1234';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('user_role');
    return (saved as UserRole) || null;
  });
  
  const [isEditMode, setIsEditMode] = useState(() => {
    return localStorage.getItem('is_edit_mode') === 'true';
  });

  const isAuthenticated = role !== null;

  // Persist Edit Mode
  useEffect(() => {
    localStorage.setItem('is_edit_mode', String(isEditMode));
  }, [isEditMode]);

  const login = (selectedRole: UserRole, pin?: string) => {
    if (selectedRole === 'viewer') {
      setRole('viewer');
      setIsEditMode(false);
      localStorage.setItem('user_role', 'viewer');
      return true;
    }

    if (selectedRole === 'admin' && pin === ADMIN_PIN) {
      setRole('admin');
      localStorage.setItem('user_role', 'admin');
      return true;
    }

    if (selectedRole === 'packer' && pin === PACKER_PIN) {
      setRole('packer');
      setIsEditMode(true); // Packers usually need edit mode ON by default
      localStorage.setItem('user_role', 'packer');
      return true;
    }

    return false;
  };

  const logout = () => {
    setRole(null);
    setIsEditMode(false);
    localStorage.removeItem('user_role');
    localStorage.removeItem('is_edit_mode');
    window.location.href = '/'; // Simple redirect to reset state
  };

  return (
    <AuthContext.Provider value={{ 
      role, 
      isAuthenticated, 
      isEditMode, 
      setIsEditMode, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
