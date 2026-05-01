import { LucideIcon } from "lucide-react";
import { Activity } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  testId?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-white",
  iconBg = "bg-gradient-to-br from-cyan-500 to-blue-600",
  badge,
  actions,
  testId,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-up">
      <div className="flex items-center gap-4">
        <div className={`icon-container h-12 w-12 rounded-xl ${iconBg} flex items-center justify-center shadow-lg`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight gradient-text-health"
              data-testid={testId}
            >
              {title}
            </h1>
            {badge}
          </div>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
            <Activity className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            {subtitle}
          </p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
