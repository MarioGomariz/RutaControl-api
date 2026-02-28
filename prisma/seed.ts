import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

async function main() {
  console.log("Iniciando seeder...");

  // 1. Roles
  const roles = [
    { id: 1, rol: "Admin" },
    { id: 2, rol: "Chofer" },
  ];

  for (const rol of roles) {
    await prisma.rol.upsert({
      where: { id: rol.id },
      update: { rol: rol.rol },
      create: rol,
    });
  }
  console.log("✅ Roles configurados");

  // 2. Servicios
  const servicios = [
    { id: 1, nombre: "Gas Licuado" },
    { id: 2, nombre: "Combustible Líquido" },
  ];

  for (const servicio of servicios) {
    await prisma.servicio.upsert({
      where: { id: servicio.id },
      update: { nombre: servicio.nombre },
      create: servicio,
    });
  }
  console.log("✅ Servicios configurados");

  // 3. Admin Usuario
  // "contrasena" is 'admin' hashed with bcrypt
  const hash = await bcrypt.hash("admin", 10);
  
  await prisma.usuario.upsert({
    where: { usuario: "admin" },
    update: { 
      // Si el entorno lo requiere, actualizamos el hash o solo lo creamos si no existe
      // no actualizamos para no pisar pass cambiados
    },
    create: {
      usuario: "admin",
      contrasena: hash,
      rol_id: 1,
      activo: true,
    },
  });
  console.log("✅ Admin usuario configurado");

  console.log("🎉 Seeding finalizado con éxito.");
}

main()
  .catch((e) => {
    console.error("❌ Error en el seeder:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
