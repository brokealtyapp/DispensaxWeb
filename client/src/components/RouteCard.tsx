import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RouteStatus = "pendiente" | "en_progreso" | "completada";

interface RouteCardProps {
  id: string;
  orderNumber: number;
  machineName: string;
  location: string;
  estimatedTime: string;
  status: RouteStatus;
  distance?: string;
  onStartService?: () => void;
  onViewDetails?: () => void;
}

const statusLabels: Record<RouteStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En Progreso",
  completada: "Completada",
};

const statusColors: Record<RouteStatus, string> = {
  pendiente: "bg-muted text-muted-foreground",
  en_progreso: "bg-primary text-primary-foreground",
  completada: "bg-emerald-500 text-white",
};

export function RouteCard({
  id,
  orderNumber,
  machineName,
  location,
  estimatedTime,
  status,
  distance,
  onStartService,
  onViewDetails,
}: RouteCardProps) {
  return (
    <Card data-testid={`card-route-${id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
            {orderNumber}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-medium">{machineName}</h4>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{location}</span>
                </div>
              </div>
              <Badge className={statusColors[status]} variant="secondary">
                {statusLabels[status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{estimatedTime}</span>
              </div>
              {distance && (
                <div className="flex items-center gap-1">
                  <Navigation className="h-4 w-4" />
                  <span>{distance}</span>
                </div>
              )}
            </div>
            {status !== "completada" && (
              <div className="flex items-center gap-2 pt-2">
                {status === "pendiente" && (
                  <Button
                    size="sm"
                    onClick={onStartService}
                    data-testid={`button-start-route-${id}`}
                  >
                    Iniciar Servicio
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onViewDetails}
                  data-testid={`button-details-route-${id}`}
                >
                  Ver Detalles
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
