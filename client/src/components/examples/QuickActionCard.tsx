import { QuickActionCard } from "../QuickActionCard";
import { Plus, Truck, FileText, Settings } from "lucide-react";

export default function QuickActionCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
      <QuickActionCard
        title="Nueva Máquina"
        description="Agregar una nueva máquina al sistema"
        icon={Plus}
        color="primary"
        onClick={() => console.log("New machine")}
      />
      <QuickActionCard
        title="Crear Ruta"
        description="Planificar ruta de abastecimiento"
        icon={Truck}
        color="success"
        onClick={() => console.log("New route")}
      />
      <QuickActionCard
        title="Generar Reporte"
        description="Crear reporte de ventas mensual"
        icon={FileText}
        color="purple"
        onClick={() => console.log("Generate report")}
      />
      <QuickActionCard
        title="Configuración"
        description="Ajustar preferencias del sistema"
        icon={Settings}
        color="orange"
        onClick={() => console.log("Settings")}
      />
    </div>
  );
}
