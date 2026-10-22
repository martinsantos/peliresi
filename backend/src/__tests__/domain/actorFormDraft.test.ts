import { expect, it } from 'vitest';
import { cleanDraftData, draftScope, draftVersion } from '../../domain/actorFormDraft';
it('never stores credentials, prototype keys, file objects or oversized data', () => {
  expect(cleanDraftData({form:{nombre:'QA',password:'private',confirmPassword:'private',token:'secret'},files:['receipt.pdf']})).toEqual({form:{nombre:'QA'},files:['receipt.pdf']});
  expect(() => cleanDraftData({note:'x'.repeat(260000)})).toThrow();
  expect(() => cleanDraftData([])).toThrow();
});
it.each(['GENERADOR','OPERADOR','TRANSPORTISTA'])('keeps %s drafts inside the current administrative sector', type => {
  expect(draftScope(`admin:${type}:new`,{rol:`ADMIN_${type}`})).toEqual({type,actorId:null});
  expect(()=>draftScope(`admin:${type}:new`,{rol:type})).toThrow();
  expect(()=>draftScope(`admin:${type}:new`,{rol:'ADMIN',restricted:true})).toThrow();
});
it('refuses traversal and stale/malformed revision tokens',()=>{
  expect(()=>draftScope('admin:OPERADOR:../../other',{rol:'ADMIN'})).toThrow();
  expect(()=>draftScope('admin:OPERADOR:new',{rol:'ADMIN_GENERADOR'})).toThrow();
  expect(draftVersion(0)).toBe(0);expect(draftVersion('2')).toBe(2);
  for(const value of [-1,2.2,'x',null,undefined])expect(()=>draftVersion(value)).toThrow();
});
