import { db } from "./db";
import { 
  users, 
  employeeAttendance, 
  payrollRecords, 
  vacationRequests, 
  performanceReviews, 
  employeeDocuments,
  employeeProfiles 
} from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedHRData() {
  console.log("Seeding HR data...");

  const allEmployees = await db.select().from(users).where(eq(users.isActive, true));
  
  if (allEmployees.length === 0) {
    console.log("No employees found. Please create employees first.");
    return;
  }

  console.log(`Found ${allEmployees.length} employees`);

  const hrUser = allEmployees.find(e => e.role === "rh");
  const hrUserId = hrUser?.id || allEmployees[0].id;

  const today = new Date();
  const dominicanaTimezone = -4;
  
  for (const employee of allEmployees) {
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(8, 0, 0, 0);
      
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (isWeekend) continue;
      
      const existing = await db.select().from(employeeAttendance)
        .where(eq(employeeAttendance.userId, employee.id));
      
      const hasDateRecord = existing.some(r => {
        const rDate = new Date(r.date);
        return rDate.toDateString() === date.toDateString();
      });
      
      if (hasDateRecord) continue;

      const statuses = ["presente", "presente", "presente", "presente", "tarde", "permiso"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const checkIn = new Date(date);
      checkIn.setHours(status === "tarde" ? 8 + Math.floor(Math.random() * 2) : 8, 
                       Math.floor(Math.random() * 30), 0, 0);
      
      const checkOut = new Date(date);
      checkOut.setHours(17 + Math.floor(Math.random() * 2), 
                        Math.floor(Math.random() * 60), 0, 0);
      
      const hoursWorked = ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2);
      const overtime = Math.max(0, parseFloat(hoursWorked) - 8).toFixed(2);

      await db.insert(employeeAttendance).values({
        userId: employee.id,
        date: date,
        checkIn: status !== "permiso" ? checkIn : null,
        checkOut: status !== "permiso" ? checkOut : null,
        status: status,
        hoursWorked: status !== "permiso" ? hoursWorked : "0",
        overtimeHours: overtime,
        notes: status === "tarde" ? "Tráfico" : status === "permiso" ? "Cita médica" : null,
        approvedBy: status === "permiso" ? hrUserId : null,
      });
    }
  }
  console.log("Attendance records created");

  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
  const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

  for (const employee of allEmployees) {
    const existing = await db.select().from(payrollRecords)
      .where(eq(payrollRecords.userId, employee.id));
    
    if (existing.length > 0) continue;

    const baseSalaries: Record<string, number> = {
      admin: 85000,
      supervisor: 55000,
      abastecedor: 28000,
      almacen: 25000,
      contabilidad: 45000,
      rh: 42000,
    };

    const baseSalary = baseSalaries[employee.role as string] || 25000;
    const overtimePay = Math.floor(Math.random() * 5000);
    const bonuses = Math.floor(Math.random() * 3000);
    const deductions = Math.floor(Math.random() * 2000);
    const taxRate = 0.15;
    const ssRate = 0.0287;
    const taxWithholding = Math.floor(baseSalary * taxRate);
    const socialSecurity = Math.floor(baseSalary * ssRate);
    const netPay = baseSalary + overtimePay + bonuses - deductions - taxWithholding - socialSecurity;

    await db.insert(payrollRecords).values({
      userId: employee.id,
      periodStart: periodStart,
      periodEnd: periodEnd,
      baseSalary: baseSalary.toString(),
      overtimePay: overtimePay.toString(),
      bonuses: bonuses.toString(),
      deductions: deductions.toString(),
      taxWithholding: taxWithholding.toString(),
      socialSecurity: socialSecurity.toString(),
      netPay: netPay.toString(),
      status: "pagado",
      paymentDate: new Date(periodEnd.getTime() + 5 * 24 * 60 * 60 * 1000),
      paymentMethod: "transferencia",
      processedBy: hrUserId,
    });
  }
  console.log("Payroll records created");

  const vacationEmployees = allEmployees.slice(0, 3);
  for (const employee of vacationEmployees) {
    const existing = await db.select().from(vacationRequests)
      .where(eq(vacationRequests.userId, employee.id));
    
    if (existing.length > 0) continue;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 14 + Math.floor(Math.random() * 30));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5 + Math.floor(Math.random() * 5));
    
    const statuses = ["pendiente", "aprobado", "pendiente"];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    await db.insert(vacationRequests).values({
      userId: employee.id,
      startDate: startDate,
      endDate: endDate,
      daysRequested: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      reason: "Vacaciones familiares",
      status: status,
      approvedBy: status === "aprobado" ? hrUserId : null,
      approvedAt: status === "aprobado" ? new Date() : null,
    });
  }
  console.log("Vacation requests created");

  const reviewEmployees = allEmployees.slice(0, 5);
  for (const employee of reviewEmployees) {
    const existing = await db.select().from(performanceReviews)
      .where(eq(performanceReviews.userId, employee.id));
    
    if (existing.length > 0) continue;

    const reviewDate = new Date(today);
    reviewDate.setMonth(reviewDate.getMonth() - 3);

    const ratings = [3.5, 4.0, 4.5, 5.0, 3.8, 4.2];
    const overallRating = ratings[Math.floor(Math.random() * ratings.length)];

    await db.insert(performanceReviews).values({
      userId: employee.id,
      reviewerId: hrUserId,
      reviewPeriod: `Semestre 1 ${reviewDate.getFullYear()}`,
      reviewDate: reviewDate,
      overallScore: overallRating.toString(),
      punctualityScore: (overallRating - 0.2 + Math.random() * 0.4).toFixed(1),
      productivityScore: (overallRating - 0.3 + Math.random() * 0.6).toFixed(1),
      teamworkScore: (overallRating - 0.1 + Math.random() * 0.3).toFixed(1),
      initiativeScore: (overallRating - 0.2 + Math.random() * 0.5).toFixed(1),
      strengths: "Puntualidad, trabajo en equipo, iniciativa",
      areasToImprove: "Comunicación con clientes, documentación de procesos",
      goals: "Completar certificación técnica, mejorar KPIs en 15%",
      comments: "Empleado comprometido con buen desempeño general.",
      status: "completado",
    });
  }
  console.log("Performance reviews created");

  for (const employee of allEmployees.slice(0, 4)) {
    const existing = await db.select().from(employeeDocuments)
      .where(eq(employeeDocuments.userId, employee.id));
    
    if (existing.length > 0) continue;

    const docTypes = [
      { type: "contrato", name: "Contrato de trabajo" },
      { type: "identificacion", name: "Cédula de identidad" },
      { type: "curriculum", name: "Curriculum Vitae" },
    ];

    for (const doc of docTypes) {
      await db.insert(employeeDocuments).values({
        userId: employee.id,
        documentType: doc.type,
        name: `${doc.name} - ${employee.fullName || employee.username}`,
        fileUrl: `/documents/${employee.id}/${doc.type}.pdf`,
        fileSize: Math.floor(Math.random() * 500000) + 50000,
        mimeType: "application/pdf",
        expirationDate: doc.type === "identificacion" 
          ? new Date(today.getFullYear() + 5, today.getMonth(), today.getDate())
          : null,
        uploadedBy: hrUserId,
      });
    }
  }
  console.log("Employee documents created");

  for (const employee of allEmployees) {
    const existing = await db.select().from(employeeProfiles)
      .where(eq(employeeProfiles.userId, employee.id));
    
    if (existing.length > 0) continue;

    const departments: Record<string, string> = {
      admin: "Dirección",
      supervisor: "Operaciones",
      abastecedor: "Logística",
      almacen: "Almacén",
      contabilidad: "Finanzas",
      rh: "Recursos Humanos",
    };

    const positions: Record<string, string> = {
      admin: "Director General",
      supervisor: "Supervisor de Zona",
      abastecedor: "Técnico de Abastecimiento",
      almacen: "Encargado de Almacén",
      contabilidad: "Contador",
      rh: "Especialista en RRHH",
    };

    const hireDate = new Date(today);
    hireDate.setFullYear(hireDate.getFullYear() - Math.floor(Math.random() * 5) - 1);
    
    const birthDate = new Date(today);
    birthDate.setFullYear(birthDate.getFullYear() - Math.floor(Math.random() * 20) - 25);

    await db.insert(employeeProfiles).values({
      userId: employee.id,
      employeeCode: `EMP-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      department: departments[employee.role as string] || "General",
      position: positions[employee.role as string] || "Empleado",
      hireDate: hireDate,
      birthDate: birthDate,
      address: "Santo Domingo, República Dominicana",
      emergencyContact: "Familiar cercano",
      emergencyPhone: "809-555-" + String(Math.floor(Math.random() * 9000) + 1000),
      bankAccount: "****" + String(Math.floor(Math.random() * 9000) + 1000),
      bankName: ["Banco Popular", "BanReservas", "Banco BHD"][Math.floor(Math.random() * 3)],
      vacationDaysAvailable: 14 + Math.floor(Math.random() * 7),
      vacationDaysUsed: Math.floor(Math.random() * 10),
    });
  }
  console.log("Employee profiles created");

  console.log("HR data seeding completed!");
}

seedHRData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding HR data:", error);
    process.exit(1);
  });
