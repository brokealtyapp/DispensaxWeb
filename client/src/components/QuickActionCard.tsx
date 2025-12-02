import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "purple" | "orange";
  onClick?: () => void;
}

const colorClasses = {
  primary: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  success: "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white",
  warning: "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white",
  purple: "bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white",
  orange: "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white",
};

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  color = "primary",
  onClick,
}: QuickActionCardProps) {
  return (
    <Card
      className="group cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-action-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg transition-colors ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
