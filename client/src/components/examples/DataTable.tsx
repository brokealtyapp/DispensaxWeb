import { DataTable, Column } from "../DataTable";
import { Badge } from "@/components/ui/badge";

interface Employee {
  id: string;
  name: string;
  role: string;
  status: "activo" | "inactivo";
  machines: number;
}

export default function DataTableExample() {
  // todo: remove mock functionality
  const mockData: Employee[] = [
    { id: "1", name: "Carlos Rodríguez", role: "Abastecedor", status: "activo", machines: 12 },
    { id: "2", name: "María García", role: "Supervisor", status: "activo", machines: 8 },
    { id: "3", name: "Juan Pérez", role: "Abastecedor", status: "inactivo", machines: 0 },
    { id: "4", name: "Ana López", role: "Almacén", status: "activo", machines: 0 },
    { id: "5", name: "Pedro Sánchez", role: "Abastecedor", status: "activo", machines: 15 },
  ];

  const columns: Column<Employee>[] = [
    { key: "name", header: "Nombre" },
    { key: "role", header: "Rol" },
    {
      key: "status",
      header: "Estado",
      render: (item) => (
        <Badge variant={item.status === "activo" ? "default" : "secondary"}>
          {item.status === "activo" ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    { key: "machines", header: "Máquinas", className: "text-right" },
  ];

  return (
    <DataTable
      data={mockData}
      columns={columns}
      searchPlaceholder="Buscar empleado..."
      searchKeys={["name", "role"]}
      pageSize={5}
      onRowClick={(item) => console.log("Row clicked:", item)}
    />
  );
}
