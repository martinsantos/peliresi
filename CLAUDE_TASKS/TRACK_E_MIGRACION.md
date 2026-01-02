# 🟣 Track E: Migración de Datos

## Contexto
Sistema de Trazabilidad de Residuos Peligrosos (SITREP) para DGFA Mendoza.
- **Objetivo**: Migrar datos reales de generadores, transportistas y operadores
- **Fuente**: Sistema actual de DGFA (formato a confirmar)
- **Destino**: PostgreSQL `trazabilidad_prod`

---

## Tareas a Ejecutar

### E1: Definir Estrategia de Migración
Crear `backend/scripts/migration/ESTRATEGIA.md`:
```markdown
# Estrategia de Migración

## Fases
1. **Catálogo de Residuos** (Ley 24.051) - Ya incluido en seed
2. **Generadores** - Empresas registradas
3. **Transportistas** - Con vehículos y choferes
4. **Operadores** - Plantas de tratamiento
5. **Usuarios** - Crear usuarios para cada actor

## Mapeo de Campos
| Campo Origen | Campo Destino | Transformación |
|--------------|---------------|----------------|
| RazonSocial | razonSocial | trim, uppercase |
| CUIT | cuit | validar formato XX-XXXXXXXX-X |
| Email | email | lowercase, validar formato |

## Validaciones
- CUIT único por tabla
- Email único global
- Habilitación vigente (fecha > hoy)

## Rollback
- Backup antes de cada fase
- Script de rollback por fase
```

### E2: Script de Importación de Generadores
Crear `backend/scripts/migration/import-generadores.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const prisma = new PrismaClient();

interface GeneradorCSV {
  razon_social: string;
  cuit: string;
  email: string;
  telefono: string;
  direccion: string;
  localidad: string;
  numero_inscripcion: string;
  fecha_habilitacion: string;
  categoria: string;
}

async function importGeneradores(filePath: string) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records: GeneradorCSV[] = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });
  
  const results = {
    success: 0,
    errors: [] as { row: number; error: string }[]
  };
  
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    try {
      // Validar CUIT
      if (!validarCUIT(row.cuit)) {
        throw new Error(`CUIT inválido: ${row.cuit}`);
      }
      
      // Verificar duplicados
      const existing = await prisma.generador.findUnique({
        where: { cuit: normalizeCUIT(row.cuit) }
      });
      
      if (existing) {
        throw new Error(`CUIT duplicado: ${row.cuit}`);
      }
      
      // Crear generador
      await prisma.generador.create({
        data: {
          razonSocial: row.razon_social.trim().toUpperCase(),
          cuit: normalizeCUIT(row.cuit),
          email: row.email.toLowerCase(),
          telefono: row.telefono,
          direccion: row.direccion,
          localidad: row.localidad,
          numeroInscripcion: row.numero_inscripcion,
          fechaHabilitacion: new Date(row.fecha_habilitacion),
          categoria: row.categoria,
          activo: true
        }
      });
      
      results.success++;
    } catch (error) {
      results.errors.push({
        row: i + 2, // +2 por header y 0-index
        error: (error as Error).message
      });
    }
  }
  
  return results;
}

function validarCUIT(cuit: string): boolean {
  const clean = cuit.replace(/\D/g, '');
  return clean.length === 11;
}

function normalizeCUIT(cuit: string): string {
  const clean = cuit.replace(/\D/g, '');
  return `${clean.slice(0,2)}-${clean.slice(2,10)}-${clean.slice(10)}`;
}

// Ejecutar
const filePath = process.argv[2] || 'data/generadores.csv';
importGeneradores(filePath).then(console.log);
```

### E3: Script de Importación de Transportistas
Crear `backend/scripts/migration/import-transportistas.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const prisma = new PrismaClient();

async function importTransportistas(
  empresasPath: string, 
  vehiculosPath: string, 
  choferesPath: string
) {
  // 1. Importar empresas transportistas
  const empresas = csv.parse(fs.readFileSync(empresasPath), { columns: true });
  
  for (const empresa of empresas) {
    const transportista = await prisma.transportista.create({
      data: {
        razonSocial: empresa.razon_social.trim().toUpperCase(),
        cuit: normalizeCUIT(empresa.cuit),
        email: empresa.email.toLowerCase(),
        telefono: empresa.telefono,
        direccion: empresa.direccion,
        numeroHabilitacion: empresa.numero_habilitacion,
        fechaHabilitacion: new Date(empresa.fecha_habilitacion),
        activo: true
      }
    });
    
    // 2. Importar vehículos de esta empresa
    const vehiculos = csv.parse(fs.readFileSync(vehiculosPath), { columns: true });
    const vehiculosEmpresa = vehiculos.filter(
      (v: any) => v.cuit_empresa === empresa.cuit
    );
    
    for (const vehiculo of vehiculosEmpresa) {
      await prisma.vehiculo.create({
        data: {
          transportistaId: transportista.id,
          patente: vehiculo.patente.toUpperCase(),
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          capacidadKg: parseInt(vehiculo.capacidad_kg),
          habilitacion: vehiculo.numero_habilitacion,
          vencimientoHabilitacion: new Date(vehiculo.vencimiento)
        }
      });
    }
    
    // 3. Importar choferes de esta empresa
    const choferes = csv.parse(fs.readFileSync(choferesPath), { columns: true });
    const choferesEmpresa = choferes.filter(
      (c: any) => c.cuit_empresa === empresa.cuit
    );
    
    for (const chofer of choferesEmpresa) {
      await prisma.chofer.create({
        data: {
          transportistaId: transportista.id,
          nombre: chofer.nombre,
          dni: chofer.dni,
          licencia: chofer.licencia,
          vencimientoLicencia: new Date(chofer.vencimiento_licencia)
        }
      });
    }
  }
}
```

### E4: Script de Importación de Operadores
Crear `backend/scripts/migration/import-operadores.ts`:
```typescript
// Similar estructura a generadores
// Incluir tipos de residuos que acepta
// Incluir métodos de tratamiento autorizados
```

### E5: Migración de Catálogo de Residuos
Verificar que `backend/prisma/seed.ts` incluye todos los tipos según Ley 24.051:
```typescript
const tiposResiduos = [
  { codigo: 'Y1', nombre: 'Desechos clínicos', categoria: 'Corrientes de desechos' },
  { codigo: 'Y2', nombre: 'Desechos farmacéuticos', categoria: 'Corrientes de desechos' },
  { codigo: 'Y3', nombre: 'Desechos de medicamentos', categoria: 'Corrientes de desechos' },
  // ... todos los tipos Y1-Y45, H1-H13
];
```

### E6: Validación de Datos Migrados
Crear `backend/scripts/migration/validate-migration.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function validateMigration() {
  const report = {
    generadores: { total: 0, conEmail: 0, sinEmail: 0, duplicados: [] as string[] },
    transportistas: { total: 0, sinVehiculos: 0, sinChoferes: 0 },
    operadores: { total: 0, sinTiposResiduo: 0 },
    inconsistencias: [] as string[]
  };
  
  // Validar generadores
  const generadores = await prisma.generador.findMany();
  report.generadores.total = generadores.length;
  report.generadores.conEmail = generadores.filter(g => g.email).length;
  report.generadores.sinEmail = generadores.filter(g => !g.email).length;
  
  // Detectar CUIT duplicados
  const cuits = generadores.map(g => g.cuit);
  const duplicados = cuits.filter((cuit, i) => cuits.indexOf(cuit) !== i);
  report.generadores.duplicados = [...new Set(duplicados)];
  
  // Validar transportistas
  const transportistas = await prisma.transportista.findMany({
    include: { vehiculos: true, choferes: true }
  });
  report.transportistas.total = transportistas.length;
  report.transportistas.sinVehiculos = transportistas.filter(
    t => t.vehiculos.length === 0
  ).length;
  report.transportistas.sinChoferes = transportistas.filter(
    t => t.choferes.length === 0
  ).length;
  
  // Validar operadores
  const operadores = await prisma.operador.findMany({
    include: { tiposResiduoAceptados: true }
  });
  report.operadores.total = operadores.length;
  report.operadores.sinTiposResiduo = operadores.filter(
    o => o.tiposResiduoAceptados.length === 0
  ).length;
  
  console.log('=== REPORTE DE VALIDACIÓN ===');
  console.log(JSON.stringify(report, null, 2));
  
  return report;
}

validateMigration();
```

---

## Plantillas CSV

### generadores.csv
```csv
razon_social,cuit,email,telefono,direccion,localidad,numero_inscripcion,fecha_habilitacion,categoria
"EMPRESA EJEMPLO SA","30-71234567-9","contacto@empresa.com","261-4234567","Av. San Martin 1234","Mendoza","GEN-2024-001","2024-01-15","Grande"
```

### transportistas.csv
```csv
razon_social,cuit,email,telefono,direccion,numero_habilitacion,fecha_habilitacion
"TRANSPORTE SEGURO SRL","30-70987654-3","info@transporte.com","261-4567890","Ruta 40 Km 5","TRA-2024-001","2024-02-20"
```

### vehiculos.csv
```csv
cuit_empresa,patente,marca,modelo,capacidad_kg,numero_habilitacion,vencimiento
"30-70987654-3","AB123CD","Mercedes-Benz","Atego 1726","8000","VEH-2024-001","2025-12-31"
```

---

## Verificación
```bash
# Ejecutar migración en ambiente de test
cd backend
npm run migrate:generadores -- data/generadores.csv
npm run migrate:transportistas -- data/

# Validar
npm run validate:migration

# Verificar conteos
docker exec directus-admin-database-1 psql -U directus -d trazabilidad_prod -c "
SELECT 
  (SELECT COUNT(*) FROM generadores) as generadores,
  (SELECT COUNT(*) FROM transportistas) as transportistas,
  (SELECT COUNT(*) FROM operadores) as operadores;
"
```

---

## Archivos a Crear
- [ ] `backend/scripts/migration/ESTRATEGIA.md`
- [ ] `backend/scripts/migration/import-generadores.ts`
- [ ] `backend/scripts/migration/import-transportistas.ts`
- [ ] `backend/scripts/migration/import-operadores.ts`
- [ ] `backend/scripts/migration/validate-migration.ts`
- [ ] `backend/scripts/migration/data/` (plantillas CSV)
