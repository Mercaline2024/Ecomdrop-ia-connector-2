import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetSessions() {
  try {
    console.log('🧹 Limpiando sesiones de la base de datos...');
    
    const result = await prisma.session.deleteMany({});
    
    console.log(`✅ Eliminadas ${result.count} sesiones`);
    console.log('✅ Base de datos lista para nueva instalación');
  } catch (error) {
    console.error('❌ Error al limpiar sesiones:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetSessions();

