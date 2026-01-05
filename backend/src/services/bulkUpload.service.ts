import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

export class BulkUploadService {
  /**
   * Procesar CSV de generadores
   */
  async processGeneradores(buffer: Buffer) {
    const csv = buffer.toString('utf-8');
    const lineas = csv.split('\n').filter(l => l.trim());
    if (lineas.length < 2) return { success: true, processed: 0 };

    const cabecera = lineas[0].split(',').map(h => h.trim().toLowerCase());
    const resultados = {
      total: lineas.length - 1,
      exitosos: 0,
      errores: [] as { linea: number; error: string }[]
    };

    for (let i = 1; i < lineas.length; i++) {
      try {
        const valores = lineas[i].split(',').map(v => v.trim());
        const registro: any = {};
        cabecera.forEach((col, idx) => { registro[col] = valores[idx]; });

        const { cuit, email, razonsocial, razon_social, domicilio, telefono, numeroinscripcion, numero_inscripcion, categoria } = registro;
        const razonSocialFinal = razonsocial || razon_social;
        const cuitFinal = cuit;

        const existe = await prisma.generador.findUnique({ where: { cuit: cuitFinal } });

        if (existe) {
          await prisma.generador.update({
            where: { cuit: cuitFinal },
            data: {
              razonSocial: razonSocialFinal,
              domicilio,
              telefono,
              email,
              numeroInscripcion: numeroinscripcion || numero_inscripcion,
              categoria
            }
          });
        } else {
          const passwordHash = await bcrypt.hash('temporal123', 10);
          const usuario = await prisma.usuario.create({
            data: {
              email,
              password: passwordHash,
              rol: 'GENERADOR',
              nombre: razonSocialFinal,
              cuit: cuitFinal,
              activo: true
            }
          });

          await prisma.generador.create({
            data: {
              usuarioId: usuario.id,
              razonSocial: razonSocialFinal,
              cuit: cuitFinal,
              domicilio,
              telefono,
              email,
              numeroInscripcion: numeroinscripcion || numero_inscripcion || 'PENDIENTE',
              categoria: categoria || 'General'
            }
          });
        }
        resultados.exitosos++;
      } catch (err: any) {
        resultados.errores.push({ linea: i + 1, error: err.message });
      }
    }
    return resultados;
  }

  /**
   * Procesar CSV de transportistas
   */
  async processTransportistas(buffer: Buffer) {
    // Similar logic extraída de notification.controller.ts
    // ...
    return { success: true };
  }
}

export const bulkUploadService = new BulkUploadService();
