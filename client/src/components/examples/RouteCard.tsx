import { RouteCard } from "../RouteCard";

export default function RouteCardExample() {
  return (
    <div className="space-y-3 max-w-lg">
      <RouteCard
        id="1"
        orderNumber={1}
        machineName="Plaza Central"
        location="Centro Comercial Norte"
        estimatedTime="09:00 - 10:30"
        status="completada"
        distance="2.5 km"
      />
      <RouteCard
        id="2"
        orderNumber={2}
        machineName="Edificio Corporativo"
        location="Zona Industrial"
        estimatedTime="11:00 - 12:00"
        status="en_progreso"
        distance="5.2 km"
        onStartService={() => console.log("Start service")}
        onViewDetails={() => console.log("View details")}
      />
      <RouteCard
        id="3"
        orderNumber={3}
        machineName="Universidad Tech"
        location="Campus Sur"
        estimatedTime="14:00 - 15:30"
        status="pendiente"
        distance="8.1 km"
        onStartService={() => console.log("Start service")}
        onViewDetails={() => console.log("View details")}
      />
    </div>
  );
}
