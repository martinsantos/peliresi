import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({create:vi.fn(),access:vi.fn(),invalidate:vi.fn(),state:{tramos:[],puedeRegistrar:true} as any}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:mocks.invalidate})}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({currentUser:{id:'original-carrier',training:true}})}));
vi.mock('../../hooks/useCatalogos',()=>({useCatalogoTransportistas:()=>({data:[],refetch:vi.fn()})}));
vi.mock('../../services/transport-handoff.service',()=>({useTransportLegs:()=>({data:mocks.state}),transportLegKey:()=>['legs'],
  transportHandoffService:{create:mocks.create,access:mocks.access},handoffLink:(id:string,token:string)=>`https://qa.invalid/relevo/${id}#${token}`}));
vi.mock('../../services/gpsTransition',()=>({withStoredGpsBeforeTransition:(_owner:unknown,_id:string,action:()=>Promise<unknown>)=>action()}));
vi.mock('qrcode.react',()=>({QRCodeSVG:()=>null}));
import {TransportLegs} from '../../pages/manifiestos/components/TransportLegs';
import {GpsPendingError} from '../../services/gpsQueue';
beforeEach(()=>{vi.clearAllMocks();mocks.state={tramos:[],puedeRegistrar:true};mocks.create.mockResolvedValue({tramo:{id:'new-leg'},acceso:'limited-capability'});mocks.invalidate.mockResolvedValue(undefined);});
describe('transport handoff form',()=>{
  it('allows an incomplete external with text fields and an explicit custody reason',async()=>{
    const before=vi.fn().mockResolvedValue(undefined);render(<TransportLegs id="manifest" beforeHandoff={before}/>);
    fireEvent.click(screen.getByRole('button',{name:'Registrar traspaso'}));
    fireEvent.change(screen.getByLabelText('Reemplazo'),{target:{value:'EXTERNO'}});
    expect(screen.getByLabelText('Chofer')).toHaveAttribute('type','text');expect(screen.getByLabelText('Patente')).toHaveAttribute('type','text');
    fireEvent.change(screen.getByLabelText('Motivo del traspaso'),{target:{value:'Rotura de prueba'}});
    fireEvent.submit(screen.getByRole('form',{name:'Registrar traspaso de carga'}));
    await waitFor(()=>expect(mocks.create).toHaveBeenCalledOnce());
    expect(before).toHaveBeenCalledOnce();expect(mocks.create.mock.calls[0][1]).toMatchObject({anteriorId:null,tipo:'EXTERNO',datos:{},motivo:'Rotura de prueba'});
    expect(mocks.create.mock.calls[0][1]).not.toHaveProperty('transportistaId');
    expect(await screen.findByRole('region',{name:'Acceso GPS del reemplazo'})).toBeVisible();
  });
  it('preserves form data and resumes source GPS on a failed handoff',async()=>{
    mocks.create.mockRejectedValue({response:{data:{message:'El transporte cambió'}}});const resume=vi.fn();render(<TransportLegs id="manifest" onHandoffError={resume}/>);
    fireEvent.click(screen.getByRole('button',{name:'Registrar traspaso'}));fireEvent.change(screen.getByLabelText('Reemplazo'),{target:{value:'EXTERNO'}});
    fireEvent.change(screen.getByLabelText('Empresa'),{target:{value:'Auxilio sintético'}});fireEvent.change(screen.getByLabelText('Motivo del traspaso'),{target:{value:'Rotura de prueba'}});
    fireEvent.submit(screen.getByRole('form',{name:'Registrar traspaso de carga'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('El transporte cambió');expect(resume).toHaveBeenCalledOnce();expect(screen.getByLabelText('Empresa')).toHaveValue('Auxilio sintético');
  });
  it('does not create a handoff when old-trip GPS could not be sent',async()=>{
    const before=vi.fn().mockRejectedValue(new GpsPendingError()),resume=vi.fn();
    render(<TransportLegs id="manifest" beforeHandoff={before} onHandoffError={resume}/>);
    fireEvent.click(screen.getByRole('button',{name:'Registrar traspaso'}));
    fireEvent.change(screen.getByLabelText('Reemplazo'),{target:{value:'EXTERNO'}});
    fireEvent.change(screen.getByLabelText('Motivo del traspaso'),{target:{value:'Rotura de prueba'}});
    fireEvent.submit(screen.getByRole('form',{name:'Registrar traspaso de carga'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron enviar las ubicaciones pendientes');
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveFocus());
    expect(mocks.create).not.toHaveBeenCalled();expect(resume).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Motivo del traspaso')).toHaveValue('Rotura de prueba');
  });
  it('presents history without custody controls to another party',()=>{
    mocks.state={tramos:[{id:'one',orden:1,tipo:'EXTERNO',datos:{},inicio:'2026-10-19T15:00:00Z',fin:null,motivo:'Rotura'}],puedeRegistrar:false};render(<TransportLegs id="manifest"/>);
    expect(screen.getByText('Eventual · datos declarados')).toBeVisible();expect(screen.getByText('Patente sin declarar · Chofer sin declarar')).toBeVisible();expect(screen.queryByRole('button',{name:'Registrar traspaso'})).not.toBeInTheDocument();
  });
  it('retries the same declaration after a lost response even if polling already sees the new leg',async()=>{
    mocks.create.mockRejectedValueOnce(new Error('Lost response'));
    const view=render(<TransportLegs id="manifest"/>);fireEvent.click(screen.getByRole('button',{name:'Registrar traspaso'}));
    fireEvent.change(screen.getByLabelText('Reemplazo'),{target:{value:'EXTERNO'}});fireEvent.change(screen.getByLabelText('Motivo del traspaso'),{target:{value:'Rotura de prueba'}});
    fireEvent.submit(screen.getByRole('form',{name:'Registrar traspaso de carga'}));await screen.findByRole('alert');
    const sent=mocks.create.mock.calls[0][1];
    mocks.state={tramos:[{id:sent.id,tipo:'EXTERNO',datos:{},inicio:'2026-10-19T15:00:00Z',fin:null,motivo:sent.motivo}],puedeRegistrar:true};view.rerender(<TransportLegs id="manifest"/>);
    fireEvent.submit(screen.getByRole('form',{name:'Registrar traspaso de carga'}));await waitFor(()=>expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][1]).toEqual(sent);
  });
});
