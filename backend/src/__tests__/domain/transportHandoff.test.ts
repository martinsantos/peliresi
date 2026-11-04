import {describe,it,expect} from 'vitest';
import {handoffSchema,isOriginalCarrier,declaredTransportLabel} from '../../domain/transportHandoff';
const command={id:'af1388bc-43f7-4c73-8e9c-c14c46695881',anteriorId:null,motivo:'Rotura del camión',tipo:'EXTERNO',datos:{}};
describe('transport handoff declaration',()=>{
  it('accepts missing external identity without inventing registration',()=>{
    expect(handoffSchema.parse(command).datos).toEqual({});
    expect(declaredTransportLabel({})).toContain('sin nombre declarado');
    expect(handoffSchema.parse({...command,datos:{empresa:'Auxilio de prueba',telefono:'Sin confirmar'}}).datos.empresa).toBe('Auxilio de prueba');
  });
  it('keeps textual declarations usable for names, plates and alphanumeric documents',()=>{
    const datos={empresa:'Grúa Sur',patente:'AB 123 CD',documento:'Pasaporte XX123',chofer:'Chofer de prueba'};
    expect(handoffSchema.parse({...command,datos}).datos).toEqual(datos);
  });
  it.each([
    {...command,tipo:'REGISTRADO'}, {...command,transportistaId:'registered'}, {...command,vehiculoId:'car'},
    {...command,latitud:-32}, {...command,motivo:''}, {...command,datos:{latitud:15}}, {...command,anteriorId:undefined},
  ])('rejects ambiguous or stale-prone declaration shape: %j',input=>expect(handoffSchema.safeParse(input).success).toBe(false));
  it('only the original linked carrier defines custody, including for same-company replacement',()=>{
    const manifest={transportistaId:'original'};
    expect(isOriginalCarrier({rol:'TRANSPORTISTA',transportista:{id:'original'}},manifest)).toBe(true);
    for(const user of [{rol:'ADMIN'},{rol:'OPERADOR',transportista:{id:'original'}},{rol:'TRANSPORTISTA',transportista:{id:'other'}},{rol:'TRANSPORTISTA',transportista:{id:'original'},restricted:true}]) expect(isOriginalCarrier(user,manifest)).toBe(false);
  });
});
