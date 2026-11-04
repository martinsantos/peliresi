import { ActorDocuments } from './ActorDocuments';

export function OperadorDocuments(props: { actorId: string; cuit: string }) {
  return <ActorDocuments {...props} actorType="OPERADOR" />;
}
