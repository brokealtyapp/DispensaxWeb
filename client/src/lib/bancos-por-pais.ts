export interface BancoItem {
  nombre: string;
  pais: "DO" | "US" | "OTRO";
}

export const BANCOS_DOMINICANOS: BancoItem[] = [
  { nombre: "BHD León", pais: "DO" },
  { nombre: "Banco de Reservas (Banreservas)", pais: "DO" },
  { nombre: "Banco Popular Dominicano", pais: "DO" },
  { nombre: "Scotiabank RD", pais: "DO" },
  { nombre: "Banco López de Haro", pais: "DO" },
  { nombre: "Asociación Popular de Ahorros y Préstamos", pais: "DO" },
  { nombre: "Asociación Cibao de Ahorros y Préstamos", pais: "DO" },
  { nombre: "Promerica", pais: "DO" },
  { nombre: "Bellbank", pais: "DO" },
  { nombre: "JMMB Bank RD", pais: "DO" },
  { nombre: "Lafise Bancentro RD", pais: "DO" },
  { nombre: "Motor Crédito", pais: "DO" },
  { nombre: "Caribe Express", pais: "DO" },
  { nombre: "Banesco RD", pais: "DO" },
  { nombre: "Activo Modern Bank", pais: "DO" },
  { nombre: "Otro banco dominicano", pais: "DO" },
];

export const BANCOS_INTERNACIONALES: BancoItem[] = [
  { nombre: "Bank of America", pais: "US" },
  { nombre: "Chase Bank", pais: "US" },
  { nombre: "Wells Fargo", pais: "US" },
  { nombre: "Citibank", pais: "US" },
  { nombre: "Otro banco internacional", pais: "OTRO" },
];

export const TODOS_LOS_BANCOS: BancoItem[] = [
  ...BANCOS_DOMINICANOS,
  ...BANCOS_INTERNACIONALES,
];

export const NOMBRES_BANCOS = TODOS_LOS_BANCOS.map((b) => b.nombre);
