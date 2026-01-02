import { BaseImporter } from './BaseImporter';
import bcrypt from 'bcryptjs';

export class GeneradorImporter extends BaseImporter {
  async importData(rows: any[]) {
    console.log(`Procesando ${rows.length} generadores...`);
    let created = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        // Validar campos requeridos
        if (!row.cuit || !row.razonSocial || !row.email) {
          console.error(`Fila inválida: falta cuit, razonSocial o email`, row);
          errors++;
          continue;
        }

        const cuit = row.cuit.replace(/[^0-9]/g, '');
        const email = row.email.trim();

        // Verificar si ya existe
        const existing = await this.prisma.generador.findUnique({
          where: { cuit }
        });

        if (existing) {
          console.log(`Generador ${cuit} ya existe, saltando.`);
          continue;
        }

        // Crear usuario base
        const hashedPassword = await bcrypt.hash(cuit, 10); // Password inicial = CUIT
        
        const user = await this.prisma.usuario.create({
          data: {
            email: email,
            password: hashedPassword,
            nombre: row.razonSocial,
            rol: 'GENERADOR',
            cuit: cuit,
            activo: true,
            generador: {
              create: {
                razonSocial: row.razonSocial,
                cuit: cuit,
                domicilio: row.domicilio || 'Sin domicilio',
                telefono: row.telefono || '',
                email: email,
                numeroInscripcion: row.inscripcion || 'EN-TRAMITE',
                categoria: row.categoria || 'Pequeño'
              }
            }
          }
        });

        console.log(`Generador creado: ${user.email} (${cuit})`);
        created++;
      } catch (error) {
        console.error(`Error importando ${row.cuit}:`, error);
        errors++;
      }
    }

    console.log(`Resumen Generadores: Creados=${created}, Errores=${errors}`);
  }
}

// Ejecución directa si se llama al script
if (require.main === module) {
  const importer = new GeneradorImporter();
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: ts-node import-generadores.ts <archivo.csv>');
    process.exit(1);
  }
  
  importer.processFile(file)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
