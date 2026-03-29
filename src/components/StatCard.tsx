import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "danger" | "warning";
}

const variantStyles = {
  default: "border-border",
  success: "border-success/30",
  danger: "border-destructive/30",
  warning: "border-warning/30",
};

const iconStyles = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  danger: "text-destructive bg-destructive/10",
  warning: "text-warning bg-warning/10",
};

export function StatCard({ label, value, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <div className={`bg-card rounded-lg border p-4 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconStyles[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="stat-number text-foreground">{value}</p>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
      {children}
    </div>
  );
}
