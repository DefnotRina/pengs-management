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
    <div className={`bg-card rounded-lg border p-3 md:p-4 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-1.5 md:mb-2 text-wrap-none whitespace-nowrap overflow-hidden">
        <span className="text-[11px] md:text-sm font-bold md:font-medium text-muted-foreground tracking-tight md:tracking-normal">{label}</span>
        <div className={`h-7 w-7 md:h-8 md:w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconStyles[variant]}`}>
          <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </div>
      </div>
      <p className="stat-number text-foreground truncate">{value}</p>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {children}
      </div>
    </div>
  );
}
