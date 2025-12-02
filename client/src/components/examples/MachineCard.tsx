import { MachineCard } from "../MachineCard";

export default function MachineCardExample() {
  // todo: remove mock functionality
  const mockTeam = [
    { name: "Carlos R", initials: "CR" },
    { name: "María G", initials: "MG" },
    { name: "Juan P", initials: "JP" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <MachineCard
        id="1"
        name="Plaza Central"
        location="Centro Comercial Norte"
        status="operando"
        inventoryLevel={75}
        lastVisit="Dic 25"
        assignedTeam={mockTeam}
        colorVariant="blue"
        onViewDetails={() => console.log("View details")}
        onStartService={() => console.log("Start service")}
      />
      <MachineCard
        id="2"
        name="Edificio Corporativo"
        location="Zona Industrial"
        status="servicio"
        inventoryLevel={35}
        lastVisit="Dic 24"
        assignedTeam={mockTeam.slice(0, 2)}
        colorVariant="dark"
      />
      <MachineCard
        id="3"
        name="Universidad Tech"
        location="Campus Sur"
        status="vacia"
        inventoryLevel={8}
        lastVisit="Dic 23"
        assignedTeam={mockTeam}
        colorVariant="purple"
      />
    </div>
  );
}
