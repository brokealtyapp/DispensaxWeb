import { AlertCard } from "../AlertCard";

export default function AlertCardExample() {
  return (
    <div className="space-y-3">
      <AlertCard
        id="1"
        type="producto"
        title="Producto Agotado"
        description="Coca-Cola 600ml se ha agotado en esta máquina"
        machineName="Plaza Central"
        priority="alta"
        timestamp="Hace 2h"
        onClick={() => console.log("Alert clicked")}
      />
      <AlertCard
        id="2"
        type="falla"
        title="Falla en Dispensador"
        description="El dispensador de la fila 3 no responde correctamente"
        machineName="Edificio Corporativo"
        priority="alta"
        timestamp="Hace 4h"
      />
      <AlertCard
        id="3"
        type="dinero"
        title="Coin Box Llena"
        description="El contenedor de monedas está al 95% de capacidad"
        machineName="Universidad Tech"
        priority="media"
        timestamp="Hace 6h"
      />
      <AlertCard
        id="4"
        type="mantenimiento"
        title="Mantenimiento Programado"
        description="Limpieza mensual pendiente desde hace 3 días"
        machineName="Hospital Central"
        priority="baja"
        timestamp="Hace 1d"
      />
    </div>
  );
}
