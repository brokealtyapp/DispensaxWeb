import { StatsCard } from "../StatsCard";
import { Box, DollarSign, Users, AlertTriangle } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <StatsCard
        title="Total Máquinas"
        value={48}
        subtitle="12 activas hoy"
        trend={{ value: 12, isPositive: true }}
        icon={Box}
        iconColor="primary"
      />
      <StatsCard
        title="Ingresos del Mes"
        value="$125,430"
        subtitle="Meta: $150,000"
        trend={{ value: 8.5, isPositive: true }}
        icon={DollarSign}
        iconColor="success"
      />
      <StatsCard
        title="Abastecedores"
        value={8}
        subtitle="5 en ruta"
        icon={Users}
        iconColor="purple"
      />
      <StatsCard
        title="Alertas Activas"
        value={5}
        subtitle="2 críticas"
        trend={{ value: 15, isPositive: false }}
        icon={AlertTriangle}
        iconColor="warning"
      />
    </div>
  );
}
