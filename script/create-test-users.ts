import bcrypt from "bcryptjs";
import { db } from "../server/db";
import { users } from "../shared/schema";

async function createTestUsers() {
  const password = await bcrypt.hash("test123", 10);
  
  const testUsers = [
    { username: "admin", password, fullName: "Administrador", email: "admin@dispensax.com", role: "admin", isActive: true },
    { username: "supervisor", password, fullName: "Supervisor General", email: "supervisor@dispensax.com", role: "supervisor", isActive: true },
    { username: "abastecedor", password, fullName: "Juan Pérez", email: "abastecedor@dispensax.com", role: "abastecedor", isActive: true },
    { username: "almacen", password, fullName: "María García", email: "almacen@dispensax.com", role: "almacen", isActive: true },
    { username: "contabilidad", password, fullName: "Carlos López", email: "contabilidad@dispensax.com", role: "contabilidad", isActive: true },
    { username: "rh", password, fullName: "Ana Martínez", email: "rh@dispensax.com", role: "rh", isActive: true },
  ];

  console.log("Creando usuarios de prueba...\n");
  
  for (const user of testUsers) {
    try {
      await db.insert(users).values(user).onConflictDoNothing();
      console.log(`✓ Usuario creado: ${user.username} (${user.role})`);
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        console.log(`- Usuario ya existe: ${user.username}`);
      } else {
        console.error(`✗ Error con ${user.username}:`, error.message);
      }
    }
  }
  
  console.log("\n========================================");
  console.log("USUARIOS DE PRUEBA CREADOS");
  console.log("========================================");
  console.log("Contraseña para todos: test123");
  console.log("----------------------------------------");
  console.log("admin       → Dashboard principal");
  console.log("supervisor  → Panel Supervisor");
  console.log("abastecedor → Panel Abastecedor");
  console.log("almacen     → Panel Almacén");
  console.log("contabilidad→ Panel Contabilidad");
  console.log("rh          → Panel RH");
  console.log("========================================\n");
  
  process.exit(0);
}

createTestUsers().catch(console.error);
