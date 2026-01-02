import { BaseImporter } from './BaseImporter';
import bcrypt from 'bcryptjs';

export class TransportistaImporter extends BaseImporter {
  async importData(rows: any[]) {
    console.log(`Procesando ${rows.length} transportistas...`);
    let created = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        if (!row.cuit || !row.razonSocial || !row.email) {
          console.error(`Fila inválida`, row);
          errors++;
          continue;
        }

        const cuit = row.cuit.replace(/[^0-9]/g, '');
        const email = row.email.trim();

        const existing = await this.prisma.transportista.findUnique({ where: { cuit } });
        if (existing) continue;

        const hashedPassword = await bcrypt.hash(cuit, 10);
        
        await this.prisma.usuario.create({
          data: {
            email: email,
            password: hashedPassword,
            nombre: row.razonSocial,
            rol: 'TRANSPORTISTA',
            cuit: cuit,
            activo: true,
            transportista: {
              create: {
                razonSocial: row.razonSocial,
                cuit: cuit,
                domicilio: row.domicilio || '',
                telefono: row.telefono || '',
                email: email,
                numeroHabilitacion: row.habilitacion || 'T-PENDIENTE'
              }
            }
          }
        });
        created++;
      } catch (error) {
        console.error(`Error en ${row.cuit}:`, error);
        errors++;
      }
    }
    console.log(`Resumen Transportistas: Creados=${created}, Errores=${errors}`);
  }
}

if (require.main === module) {
  const importer = new TransportistaImporter();
  const file = process.argv[2];
  if (!file) process.exit(1);
  importer.processFile(file).then(() => process.exit(0));
}
