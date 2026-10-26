import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';

const manual = path.resolve(process.cwd(), '../docs/manual');
const script = readFileSync(path.join(manual, 'manual.js'), 'utf8');
let targetTop = 600;
let layoutChanged: () => void;
let scroll: ReturnType<typeof vi.fn>;
const listeners: Array<{target:Window|Document;type:string;listener:EventListenerOrEventListenerObject}>=[];
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); targetTop = 600; layoutChanged = () => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { layoutChanged = callback; }
    observe() {}
    disconnect() {}
  });
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

it('an explicit index destination survives intermediate smooth-scroll events until user input',()=>{
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa');
  mount();
  (document.querySelectorAll('#tutorialIndex a')[2] as HTMLElement).click();
  window.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(20);
  expect(current()).toContain('Paso 3');
  expect(window.location.hash).toBe('#paso-3-paso-3');
  window.dispatchEvent(new Event('wheel')); targetTop=600;
  window.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(20);
  expect(current()).toContain('Paso 2');
});

it.each(['index', 'next'])('late images preserve a newly selected %s step without an initial hash', control => {
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa');
  mount(true);
  if (control === 'index') (document.querySelectorAll('#tutorialIndex a')[2] as HTMLElement).click();
  else {
    (document.getElementById('nextStep') as HTMLElement).click();
    (document.getElementById('nextStep') as HTMLElement).click();
  }
  vi.advanceTimersByTime(100);
  targetTop = 600;
  const previous = scroll.mock.calls.length;
  document.querySelector('img.guide-image')!.dispatchEvent(new Event('load'));
  vi.advanceTimersByTime(100);
  expect(scroll.mock.calls.length).toBeGreaterThan(previous);
  expect(targetTop).toBe(180);
  expect(current()).toContain('Paso 3');
});

it.each(['ctrlKey', 'metaKey'])('index retains native open-in-new-tab behavior with %s', modifier => {
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa');
  mount();
  const event = new MouseEvent('click', { cancelable: true, bubbles: true, [modifier]: true });
  expect(document.querySelectorAll('#tutorialIndex a')[2].dispatchEvent(event)).toBe(true);
  expect(event.defaultPrevented).toBe(false);
  expect(current()).toContain('Paso 1');
});

it('late layout changes keep the selected heading in view after images have loaded', () => {
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa');
  mount();
  (document.querySelectorAll('#tutorialIndex a')[2] as HTMLElement).click();
  vi.advanceTimersByTime(100);
  targetTop = -600;
  layoutChanged();
  vi.advanceTimersByTime(100);
  expect(targetTop).toBe(180);
  expect(current()).toContain('Paso 3');
});
it('a later layout change cannot override the reader scrolling away', () => {
  mount(); vi.advanceTimersByTime(100);
  window.dispatchEvent(new Event('wheel')); targetTop = 600;
  const previous = scroll.mock.calls.length;
  layoutChanged(); vi.advanceTimersByTime(100);
  expect(scroll).toHaveBeenCalledTimes(previous);
  expect(targetTop).toBe(600);
});


it.each(['null', '[]', '{"qa":null}', '{"qa":{"step":"wrong","updatedAt":1}}'])('invalid saved progress %s cannot prevent reading the guide', value => {
  localStorage.setItem('sitrep_help_progress_v1', value);
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa');
  expect(() => mount()).not.toThrow();
  expect(current()).toContain('Paso 1');
  (document.getElementById('nextStep') as HTMLElement).click();
  expect(current()).toContain('Paso 2');
});

it.each(['getItem', 'setItem'] as const)('unavailable storage (%s) keeps previous/next usable and explains the limit', method => {
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa');
  vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Storage unavailable'); });
  expect(() => mount()).not.toThrow();
  (document.getElementById('nextStep') as HTMLElement).click();
  expect(current()).toContain('Paso 2');
  expect(window.location.hash).toBe('#paso-2-paso-2');
  expect(document.getElementById('progressStorageStatus')).toHaveTextContent('no puede guardar');
  expect(document.getElementById('progressStorageStatus')).not.toHaveAttribute('hidden');
  (document.getElementById('previousStep') as HTMLElement).click();
  expect(current()).toContain('Paso 1');
});

it('reopening a guide scrolls to the recovered step instead of showing another step at the top', () => {
  window.history.replaceState(null, '', '/manual/tutorial.html?guide=qa');
  localStorage.setItem('sitrep_help_progress_v1', JSON.stringify({qa:{step:2,updatedAt:1}}));
  mount(); vi.advanceTimersByTime(100);
  expect(current()).toContain('Paso 3');
  expect(targetTop).toBe(180);
  expect(scroll.mock.contexts.some(target => (target as HTMLElement).id === 'paso-3-paso-3')).toBe(true);
});

it('an explicit link wins over a different saved step', () => {
  localStorage.setItem('sitrep_help_progress_v1', JSON.stringify({qa:{step:1,updatedAt:1}}));
  mount(); vi.advanceTimersByTime(100);
  expect(current()).toContain('Paso 3');
  expect(targetTop).toBe(180);
});
