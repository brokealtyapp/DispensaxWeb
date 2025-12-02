import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Wrench, Coins, Clock } from "lucide-react";
import { LucideIcon } from "lucide-react";

export type AlertType = "producto" | "falla" | "dinero" | "mantenimiento";
export type AlertPriority = "alta" | "media" | "baja";

interface AlertCardProps {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  machineName: string;
  priority: AlertPriority;
  timestamp: string;
  onClick?: () => void;
}

const alertIcons: Record<AlertType, LucideIcon> = {
  producto: Package,
  falla: Wrench,
  dinero: Coins,
  mantenimiento: AlertTriangle,
};

const alertColors: Record<AlertType, string> = {
  producto: "text-amber-500 bg-amber-500/10",
  falla: "text-destructive bg-destructive/10",
  dinero: "text-emerald-500 bg-emerald-500/10",
  mantenimiento: "text-purple-500 bg-purple-500/10",
};

const priorityColors: Record<AlertPriority, string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-amber-500 text-white",
  baja: "bg-muted text-muted-foreground",
};

export function AlertCard({
  id,
  type,
  title,
  description,
  machineName,
  priority,
  timestamp,
  onClick,
}: AlertCardProps) {
  const Icon = alertIcons[type];

  return (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`card-alert-${id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${alertColors[type]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{title}</h4>
              <Badge className={`${priorityColors[priority]} text-xs shrink-0`} variant="secondary">
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium text-foreground">{machineName}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{timestamp}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
