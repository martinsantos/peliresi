import { useState } from 'react';
import { Input } from './ui/Input';
import { NativeSelect } from './ui/NativeSelect';
import { Button } from './ui/ButtonV2';

export type CompanySummary={id:string;cuit:string;razonSocial:string};
export type CompanyPagination={page:number;limit:number;total:number;totalPages:number};
export function CompanyPicker({companies,selected,pagination,busy,onChoose,onSearch,onPage}:{
 companies:CompanySummary[];selected?:CompanySummary;pagination:CompanyPagination;busy:boolean;
 onChoose:(id:string)=>void;onSearch:(search:string)=>void;onPage:(page:number)=>void;
}) {
 const [search,setSearch]=useState('');
 // Keep the selected record visible even when it is outside the current search/page.
 const options=selected&&!companies.some(c=>c.id===selected.id)?[selected,...companies]:companies;
 const {page,limit,total,totalPages}=pagination;
 const start=companies.length?(page-1)*limit+1:0,end=companies.length?start+companies.length-1:0;
 return <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4" aria-label="Buscar y seleccionar empresa" aria-busy={busy}>
  <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();onSearch(search.trim());}}>
   <Input containerClassName="min-w-0 flex-1 basis-48" label="Buscar empresa" placeholder="Razón social, nombre o CUIT" type="search" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/>
   <Button type="submit" disabled={busy}>Buscar</Button>
   {search&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{setSearch('');onSearch('');}}>Limpiar búsqueda</Button>}
  </form>
  {options.length>0&&<NativeSelect label="Empresa" value={selected?.id||''} onChange={onChoose}>{options.map(c=><option key={c.id} value={c.id}>{c.razonSocial} · {c.cuit}</option>)}</NativeSelect>}
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-sm text-neutral-600" role="status" aria-live="polite">{busy?'Consultando empresas…':total===0?'Sin coincidencias':`${start}–${end} de ${total} empresas`}</p>
   <nav className="flex items-center gap-2" aria-label="Páginas de empresas">
    <Button type="button" variant="outline" disabled={busy||page<=1} onClick={()=>onPage(page-1)}>Anterior</Button>
    <span className="whitespace-nowrap text-sm">{page} / {totalPages}</span>
    <Button type="button" variant="outline" disabled={busy||page>=totalPages} onClick={()=>onPage(page+1)}>Siguiente</Button>
   </nav>
  </div>
 </section>;
}
