import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  classifyActorRoleLink,
  differingFields,
  duplicateNormalizedKeys,
  normalizeCertificate,
  normalizeCuit,
  treatmentKey,
  type ActorRole,
  type ActorRoleRecord,
  type RoleLinkStatus,
} from '../../utils/officialRosterValidation';

type JsonRecord = Record<string, any>;

interface RosterPayload {
  reportingDate: string;
  generadores: JsonRecord[];
  transportistas: JsonRecord[];
  operadores: JsonRecord[];
}

interface E2eState {
  payload: RosterPayload;
  generators: JsonRecord[];
  transporters: JsonRecord[];
  operators: JsonRecord[];
  users: JsonRecord[];
  manifests: JsonRecord[];
}

const enabled = process.env.MIGRATION_E2E === '1';
const suite = enabled ? describe : describe.skip;

suite('official roster migration E2E — read only', () => {
  let state: E2eState;

  const baseUrl = (process.env.MIGRATION_E2E_BASE_URL || '').replace(/\/$/, '');
  const payloadPath = process.env.MIGRATION_PAYLOAD_PATH || '';
  const keptActiveTransporters = (process.env.MIGRATION_E2E_KEEP_ACTIVE_TRANSPORTISTAS || '')
    .split(',')
    .map(normalizeCertificate)
    .filter(Boolean);

  async function authenticate(): Promise<string> {
    if (process.env.MIGRATION_E2E_ADMIN_TOKEN) return process.env.MIGRATION_E2E_ADMIN_TOKEN;
    const email = process.env.MIGRATION_E2E_ADMIN_EMAIL;
    const password = process.env.MIGRATION_E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error('Configure MIGRATION_E2E_ADMIN_TOKEN o las credenciales E2E de administrador');
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json() as JsonRecord;
    if (!response.ok) throw new Error(`Login E2E rechazado con HTTP ${response.status}`);
    return body?.data?.tokens?.accessToken;
  }

  async function getJson(path: string, token: string): Promise<JsonRecord> {
    const response = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
    const body = await response.json() as JsonRecord;
    if (!response.ok) throw new Error(`${path} respondió HTTP ${response.status}: ${body?.message || 'sin detalle'}`);
    return body;
  }

  beforeAll(async () => {
    if (!baseUrl) throw new Error('MIGRATION_E2E_BASE_URL es obligatorio');
    if (!payloadPath || !fs.existsSync(payloadPath)) throw new Error('MIGRATION_PAYLOAD_PATH debe apuntar al payload normalizado');
    const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8')) as RosterPayload;
    const token = await authenticate();
    const [generators, transporters, operators, users, manifests] = await Promise.all([
      getJson('/catalogos/generadores', token),
      getJson('/catalogos/transportistas', token),
      getJson('/catalogos/operadores', token),
      getJson('/admin/usuarios?limit=5000&sortBy=nombre&sortOrder=asc', token),
      getJson('/manifiestos?limit=500', token),
    ]);
    state = {
      payload,
      generators: generators.data.generadores,
      transporters: transporters.data.transportistas,
      operators: operators.data.operadores,
      users: users.data.usuarios,
      manifests: manifests.data.manifiestos,
    };
  }, 60_000);

  it('reconciles the complete official actor keysets and active flags', () => {
    const officialGenerators = state.generators.filter((row) => normalizeCertificate(row.numeroInscripcion).startsWith('G-'));
    const officialTransporters = state.transporters.filter((row) => normalizeCertificate(row.numeroHabilitacion).startsWith('T-'));
    const officialOperators = state.operators.filter((row) => String(row.numeroHabilitacion || '').startsWith('O-'));

    expect(duplicateNormalizedKeys(officialGenerators, (row) => normalizeCuit(row.cuit))).toEqual([]);
    expect(duplicateNormalizedKeys(officialTransporters, (row) => normalizeCertificate(row.numeroHabilitacion))).toEqual([]);
    expect(duplicateNormalizedKeys(officialOperators, (row) => normalizeCuit(row.cuit))).toEqual([]);

    const actualGeneratorKeys = officialGenerators.filter((row) => row.activo).map((row) => normalizeCuit(row.cuit)).sort();
    const expectedGeneratorKeys = state.payload.generadores.filter((row) => row.activo).map((row) => normalizeCuit(row.cuit)).sort();
    const actualTransporterKeys = officialTransporters.filter((row) => row.activo).map((row) => normalizeCertificate(row.numeroHabilitacion)).sort();
    const expectedTransporterKeys = [...new Set([
      ...state.payload.transportistas.filter((row) => row.activo).map((row) => normalizeCertificate(row.numeroHabilitacion)),
      ...keptActiveTransporters,
    ])].sort();
    const actualOperatorKeys = officialOperators.filter((row) => row.activo).map((row) => normalizeCuit(row.cuit)).sort();
    const expectedOperatorKeys = state.payload.operadores.filter((row) => row.activo).map((row) => normalizeCuit(row.cuit)).sort();

    expect(actualGeneratorKeys).toEqual(expectedGeneratorKeys);
    expect(actualTransporterKeys).toEqual(expectedTransporterKeys);
    expect(actualOperatorKeys).toEqual(expectedOperatorKeys);
    expect(actualGeneratorKeys).toHaveLength(1315);
    expect(actualTransporterKeys).toHaveLength(28 + keptActiveTransporters.filter((key) => (
      !state.payload.transportistas.some((row) => normalizeCertificate(row.numeroHabilitacion) === key && row.activo)
    )).length);
    expect(actualOperatorKeys).toHaveLength(41);
  });

  it('matches every migrated actor field supplied by the normalized payload', () => {
    const generatorByCuit = new Map(state.generators.map((row) => [normalizeCuit(row.cuit), row]));
    const transporterByNumber = new Map(state.transporters.map((row) => [normalizeCertificate(row.numeroHabilitacion), row]));
    const operatorByCuit = new Map(state.operators.map((row) => [normalizeCuit(row.cuit), row]));

    const generatorFields = [
      'razonSocial', 'numeroInscripcion', 'domicilio', 'telefono', 'email', 'actividad', 'rubro', 'categoria',
      'corrientesControl', 'expedienteInscripcion', 'domicilioLegalCalle', 'domicilioLegalLocalidad',
      'domicilioLegalDepto', 'domicilioRealCalle', 'domicilioRealLocalidad', 'domicilioRealDepto',
      'certificacionISO', 'resolucionInscripcion', 'factorR', 'montoMxR', 'categoriaIndividual', 'libroOperatoria', 'activo',
    ];
    const transporterFields = [
      'numeroHabilitacion', 'razonSocial', 'domicilio', 'localidad', 'corrientesAutorizadas', 'expedienteDPA',
      'vencimientoHabilitacion', 'latitud', 'longitud', 'activo',
    ];
    const operatorFields = [
      'razonSocial', 'numeroHabilitacion', 'certificadoNumero', 'domicilio', 'telefono', 'email', 'categoria',
      'tipoOperador', 'tecnologia', 'corrientesY', 'modalidades', 'expedienteInscripcion', 'domicilioLegalCalle',
      'domicilioLegalLocalidad', 'domicilioLegalDepto', 'domicilioRealCalle', 'domicilioRealLocalidad',
      'domicilioRealDepto', 'representanteLegalNombre', 'representanteTecnicoNombre', 'resolucionDPA', 'activo',
    ];

    for (const expected of state.payload.generadores) {
      const actual = generatorByCuit.get(normalizeCuit(expected.cuit));
      expect(actual, `Generador ausente: ${expected.cuit}`).toBeTruthy();
      expect(differingFields(actual!, expected, generatorFields), `Generador ${expected.cuit}`).toEqual([]);
    }
    for (const expected of state.payload.transportistas) {
      const key = normalizeCertificate(expected.numeroHabilitacion);
      const actual = transporterByNumber.get(key);
      expect(actual, `Transportista ausente: ${key}`).toBeTruthy();
      expect(differingFields(actual!, expected, transporterFields), `Transportista ${key}`).toEqual([]);
    }
    for (const expected of state.payload.operadores) {
      const actual = operatorByCuit.get(normalizeCuit(expected.cuit));
      expect(actual, `Operador ausente: ${expected.cuit}`).toBeTruthy();
      expect(differingFields(actual!, expected, operatorFields), `Operador ${expected.cuit}`).toEqual([]);
    }
  });

  it('reconciles all active treatment authorizations at operator + waste code + method grain', () => {
    const operatorByCuit = new Map(state.operators.map((row) => [normalizeCuit(row.cuit), row]));
    let expectedTotal = 0;
    let actualTotal = 0;

    for (const expectedOperator of state.payload.operadores) {
      const actualOperator = operatorByCuit.get(normalizeCuit(expectedOperator.cuit));
      expect(actualOperator, `Operador ausente: ${expectedOperator.cuit}`).toBeTruthy();
      const expectedKeys = expectedOperator.treatments
        .map((row: JsonRecord) => treatmentKey(expectedOperator.cuit, row.codigo, row.metodo))
        .sort();
      const actualKeys = actualOperator!.tratamientos
        .filter((row: JsonRecord) => row.activo)
        .map((row: JsonRecord) => treatmentKey(actualOperator!.cuit, row.tipoResiduo.codigo, row.metodo))
        .sort();
      expect(duplicateNormalizedKeys(expectedKeys, (key) => key)).toEqual([]);
      expect(duplicateNormalizedKeys(actualKeys, (key) => key)).toEqual([]);
      expect(actualKeys, `Tratamientos de ${expectedOperator.cuit}`).toEqual(expectedKeys);
      expectedTotal += expectedKeys.length;
      actualTotal += actualKeys.length;
    }

    expect(expectedTotal).toBe(245);
    expect(actualTotal).toBe(expectedTotal);
  });

  it('recognizes multi-role entities without treating a different primary role as a duplicate', () => {
    const usersById = new Map(state.users.map((user) => [user.id, user]));
    const records: Array<ActorRoleRecord & { id: string; name: string }> = [
      ...state.generators.filter((row) => normalizeCertificate(row.numeroInscripcion).startsWith('G-')).map((actor) => ({
        id: actor.id, name: actor.razonSocial, role: 'GENERADOR' as ActorRole, cuit: actor.cuit, active: actor.activo, userId: actor.usuarioId,
      })),
      ...state.transporters.filter((row) => normalizeCertificate(row.numeroHabilitacion).startsWith('T-')).map((actor) => ({
        id: actor.id, name: actor.razonSocial, role: 'TRANSPORTISTA' as ActorRole, cuit: actor.cuit, active: actor.activo, userId: actor.usuarioId,
      })),
      ...state.operators.filter((row) => String(row.numeroHabilitacion || '').startsWith('O-')).map((actor) => ({
        id: actor.id, name: actor.razonSocial, role: 'OPERADOR' as ActorRole, cuit: actor.cuit, active: actor.activo, userId: actor.usuarioId,
      })),
    ];
    const groups = new Map<string, typeof records>();
    for (const record of records) {
      const key = normalizeCuit(record.cuit);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    const multiRoleGroups = [...groups.values()].filter((group) => new Set(group.map((record) => record.role)).size > 1);
    const statuses: RoleLinkStatus[] = [];
    for (const record of records.filter((item) => item.active)) {
      const user = usersById.get(record.userId);
      expect(user, `Usuario ausente para ${record.role} ${record.name}`).toBeTruthy();
      expect(user!.activo, `Usuario inactivo para ${record.role} ${record.name}`).toBe(true);
      statuses.push(classifyActorRoleLink({
        actorRole: record.role,
        actorCuit: record.cuit,
        userRole: user!.rol,
        userId: record.userId,
        counterparts: records,
      }));
    }

    expect(multiRoleGroups).toHaveLength(20);
    expect(statuses.filter((status) => status === 'MULTIROLE_ACTIVE')).toHaveLength(18);
    expect(statuses.filter((status) => status === 'MULTIROLE_INACTIVE')).toHaveLength(2);
    expect(statuses.filter((status) => status === 'UNBACKED')).toHaveLength(0);
  });

  it('certification gate: no nonterminal manifest references an inactive actor', () => {
    const terminal = new Set(['TRATADO', 'CANCELADO', 'RECHAZADO']);
    const generatorActive = new Map(state.generators.map((row) => [row.id, row.activo]));
    const transporterActive = new Map(state.transporters.map((row) => [row.id, row.activo]));
    const operatorActive = new Map(state.operators.map((row) => [row.id, row.activo]));
    const violations = state.manifests.filter((manifest) => (
      !terminal.has(manifest.estado)
      && (
        generatorActive.get(manifest.generadorId) === false
        || transporterActive.get(manifest.transportistaId) === false
        || operatorActive.get(manifest.operadorId) === false
      )
    ));
    const sample = violations.slice(0, 5).map((row) => `${row.numero} (${row.estado})`).join(', ');
    expect(violations.length, `Manifiestos no terminales con actor inactivo. Muestra: ${sample}`).toBe(0);
  });
});
