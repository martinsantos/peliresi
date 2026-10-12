import { PrismaClient, TipoActorInspeccion } from '@prisma/client';
import { buildInspectionExchangeDigests, ExchangeDigestInput } from '../services/inspectionExchange.service';

/** Additive fictional examples, never reset an exercise a participant has used. */
export async function seedTrainingParticipation(db: PrismaClient) {
  const location = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
  if (location[0]?.schema !== 'sitrep_training') throw new Error('Refusing participation seed outside the training schema');
  return db.$transaction(async tx => {
    let added = 0;
    for (let index = 1; index <= 5; index++) {
      for (const tipoActor of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as TipoActorInspeccion[]) {
        const actorUser = `cap-20261012-${tipoActor.toLowerCase()}-${index}`;
        const user = await tx.usuario.findUniqueOrThrow({ where: { id: actorUser }, include: { generador: true, transportista: true, operador: true } });
        if (user.email !== actorUser + '@capacitacion.invalid' || user.rol !== tipoActor) throw new Error('Unexpected training actor');
        const field = tipoActor === 'GENERADOR' ? 'generadorId' : tipoActor === 'OPERADOR' ? 'operadorId' : 'transportistaId';
        const actor = tipoActor === 'GENERADOR' ? user.generador : tipoActor === 'OPERADOR' ? user.operador : user.transportista;
        if (!actor) throw new Error('Training actor missing');
        for (const closed of [false, true]) {
          const id = `cap-20261012-participacion-${index}-${tipoActor}-${closed ? 'cerrada' : 'abierta'}`;
          if (await tx.inspeccion.findUnique({ where: { id }, select: { id: true } })) continue;
          const authority = `cap-20261012-admin-${index}`;
          const deadline = closed ? null : new Date(Date.now() + 7 * 86400_000);
          await tx.inspeccion.create({ data: {
            id, numero: `CAP-P-${index}-${tipoActor}-${closed ? 'C' : 'A'}`, numeroActa: `DEMO-${id}`,
            tipoActor, [field]: actor.id, inspectorId: `cap-20261012-inspector-${index}`,
            estado: closed ? 'CERRADA_CONFORME' : 'REQUIERE_SUBSANACION', version: 4,
            ubicacion: 'LUGAR FICTICIO · CAPACITACIÓN', observaciones: 'Ejercicio sintético. Sin validez oficial.',
            plazoRespuestaAt: deadline,
          } });
          let previousHash: string | null = null;
          for (let sequence = 1; sequence <= 3; sequence++) {
            const response = sequence === 2;
            const input: ExchangeDigestInput = {
              inspeccionId: id, secuencia: sequence,
              respondeAId: sequence === 2 ? `${id}-1` : sequence === 3 && closed ? `${id}-2` : null,
              tipo: sequence === 1 ? 'REQUERIMIENTO' : response ? 'DESCARGO' : closed ? 'CIERRE_CONFORME' : 'REQUERIMIENTO',
              parte: response ? 'INSPECCIONADO' : 'AUTORIDAD', destinatario: response ? 'AUTORIDAD' : 'INSPECCIONADO',
              asunto: sequence === 1 ? 'CAP · Documentación de la visita' : response ? 'CAP · Respuesta del actor' : closed ? 'CAP · Cierre del ejercicio' : 'CAP · Completar documentación',
              cuerpo: sequence === 1 ? 'Ejercicio: presente la documentación del equipo revisado en la visita ficticia.' : response ? 'Ejercicio: presentamos los antecedentes solicitados para su revisión. No corresponde a una actuación real.' : closed ? 'Ejercicio: revisada la respuesta, se cierra conforme esta actuación ficticia, sin validez oficial.' : 'Ejercicio: falta identificar la fecha del control. Responda esta actuación para practicar la subsanación.',
              plazoRespuestaAt: sequence === 3 && !closed ? deadline : null,
              canal: 'PORTAL_SITREP', versionExpediente: sequence + 1,
              autorId: response ? actorUser : authority,
              createdAt: new Date(Date.now() - (4 - sequence) * 3600_000), adjuntos: [],
            };
            const { adjuntos, ...data } = input;
            const digest = buildInspectionExchangeDigests(input, previousHash);
            await tx.intercambioInspeccion.create({ data: { ...data, destinatario: input.destinatario!, id: `${id}-${sequence}`, ...digest, hashAnterior: previousHash } });
            previousHash = digest.hashCadena;
          }
          await tx.eventoInspeccion.create({ data: { inspeccionId: id, usuarioId: authority,
            tipo: 'CAPACITACION_EJEMPLO', titulo: 'Ejemplo sintético de intercambio',
            detalle: 'Datos preparados exclusivamente para practicar. No es una notificación oficial.', visibleActor: true,
            metadata: { capacitacion: true, correoEnviado: false } } });
          added++;
        }
      }
    }
    return { added, expectedExamples: 30, sentMail: 0, schema: 'sitrep_training' };
  }, { timeout: 30000 });
}
