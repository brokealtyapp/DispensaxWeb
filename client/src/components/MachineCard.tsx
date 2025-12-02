import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MachineStatus = "operando" | "servicio" | "vacia" | "offline";

interface MachineCardProps {
  id: string;
  name: string;
  location: string;
  status: MachineStatus;
  inventoryLevel: number;
  lastVisit: string;
  assignedTeam?: { name: string; initials: string }[];
  colorVariant?: "blue" | "dark" | "purple" | "green";
  onViewDetails?: () => void;
  onStartService?: () => void;
}

const statusLabels: Record<MachineStatus, string> = {
  operando: "Operando",
  servicio: "Necesita Servicio",
  vacia: "Vacía",
  offline: "Fuera de Línea",
};

const statusColors: Record<MachineStatus, string> = {
  operando: "bg-emerald-500",
  servicio: "bg-amber-500",
  vacia: "bg-destructive",
  offline: "bg-muted-foreground",
};

const cardColors = {
  blue: "bg-[#2F6FED]",
  dark: "bg-[#1D1D1D]",
  purple: "bg-[#8E59FF]",
  green: "bg-[#4ECB71]",
};

export function MachineCard({
  id,
  name,
  location,
  status,
  inventoryLevel,
  lastVisit,
  assignedTeam = [],
  colorVariant = "blue",
  onViewDetails,
  onStartService,
}: MachineCardProps) {
  return (
    <Card
      className={`overflow-hidden ${cardColors[colorVariant]} text-white border-0`}
      data-testid={`card-machine-${id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg leading-tight">{name}</h3>
          <div className="flex items-center gap-1 text-white/80 text-sm">
            <MapPin className="h-3 w-3" />
            <span>{location}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
              data-testid={`button-machine-menu-${id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewDetails}>Ver Detalles</DropdownMenuItem>
            <DropdownMenuItem onClick={onStartService}>Iniciar Servicio</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
          <span className="text-sm text-white/80">{statusLabels[status]}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">Inventario</span>
            <span className="font-medium">{inventoryLevel}%</span>
          </div>
          <Progress value={inventoryLevel} className="h-2 bg-white/20" />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex -space-x-2">
            {assignedTeam.slice(0, 4).map((member, index) => (
              <Avatar key={index} className="h-8 w-8 border-2 border-white/20">
                <AvatarFallback className="text-xs bg-white/20 text-white">
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {assignedTeam.length > 4 && (
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs border-2 border-white/20">
                +{assignedTeam.length - 4}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-white/70 text-sm">
            <Calendar className="h-3 w-3" />
            <span>{lastVisit}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
