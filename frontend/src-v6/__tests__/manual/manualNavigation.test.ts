import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';

const manual = path.resolve(process.cwd(), '../docs/manual');
const script = readFileSync(path.join(manual, 'manual.js'), 'utf8');
let targetTop = 600;
let scroll: ReturnType<typeof vi.fn>;
const listeners: Array<{target:Window|Document;type:string;listener:EventListenerOrEventListenerObject}>=[];
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); targetTop = 600;
  const html = readFileSync(path.join(manual, 'tutorial.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)![1];
  document.body.setAttribute('data-page', 'tutorial');
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa#paso-3-paso-3');
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  scroll = vi.fn(function(this: HTMLElement) { if(this.id === 'paso-3-paso-3') targetTop = 180; });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => window.setTimeout(() => fn(0), 16));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function() {
    const top = this.id === 'paso-3-paso-3' ? targetTop : 0;
    return {top,bottom:top+100,height:100,x:0,y:top,left:0,right:300,width:300,toJSON:()=>({})};
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {configurable:true,value:scroll});
  for(const target of [window,document]){
    const add=target.addEventListener.bind(target);
    vi.spyOn(target,'addEventListener').mockImplementation((type,listener,options)=>{
      if(listener)listeners.push({target,type,listener});
      add(type,listener,options);
    });
  }
});
afterEach(() => {
  for(const {target,type,listener} of listeners.splice(0))target.removeEventListener(type,listener);
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML='';
});

function mount(withImage = false) {
  const help = {profiles:[{id:'qa',label:'QA',icon:'help'}],guides:[{
    id:'qa',profile:'qa',title:'QA',summary:'QA',duration:'1 min',steps:[1,2,3].map(i=>({
      title:'Paso '+i,body:['QA'],expected:'QA',...(withImage&&i===1?{image:'screenshots/qa.png',alt:'QA'}:{}),
    })),
  }]};
  const isolatedWindow = Object.create(window);
  Object.defineProperty(isolatedWindow,'SITREP_HELP',{value:help});
  runInNewContext(script,{window:isolatedWindow,document,navigator,localStorage,URLSearchParams,URL},{timeout:1000});
}
const current=()=>document.querySelector('#tutorialIndex a[aria-current="step"]')?.textContent;

it('browser restoration scroll cannot overwrite the requested hash before settling',()=>{
  mount(); expect(current()).toContain('Paso 3');
  window.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(20);
  expect(current()).toContain('Paso 3');
  expect(window.location.hash).toBe('#paso-3-paso-3');
});
it('a late preceding capture realigns the requested step without changing its identity',()=>{
  mount(true); vi.advanceTimersByTime(100); expect(targetTop).toBe(180);
  const previous=scroll.mock.calls.length; targetTop=600;
  document.querySelector('img.guide-image')!.dispatchEvent(new Event('load'));
  vi.advanceTimersByTime(100);
  expect(scroll.mock.calls.length).toBeGreaterThan(previous);
  expect(targetTop).toBe(180); expect(current()).toContain('Paso 3');
});
it('user scroll takes priority and later image loads do not pull them back',()=>{
  mount(true); vi.advanceTimersByTime(100);
  window.dispatchEvent(new Event('wheel')); targetTop=600;
  window.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(20);
  expect(current()).toContain('Paso 2');
  const previous=scroll.mock.calls.length;
  document.querySelector('img.guide-image')!.dispatchEvent(new Event('load'));
  vi.advanceTimersByTime(100); expect(scroll).toHaveBeenCalledTimes(previous);
});
