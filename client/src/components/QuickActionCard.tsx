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
  success: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  warning: "bg-muted text-muted-foreground group-hover:bg-secondary group-hover:text-secondary-foreground",
  purple: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  orange: "bg-muted text-muted-foreground group-hover:bg-secondary group-hover:text-secondary-foreground",
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
