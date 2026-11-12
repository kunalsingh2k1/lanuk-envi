// Exercise voice failure/retry paths without microphone access or sending model requests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('  const SR ='), app.indexOf('  /* ---------- chat ---------- */'));
function harness(supported = true) {
  const nodes = new Map(), sent = [], recognizers = [];
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: false, textContent: '', attrs: {}, events: {}, classList: {add(){},remove(){}}, setAttribute(k,v){this.attrs[k]=v;}, addEventListener(k,f){this.events[k]=f;} });
    return nodes.get(id);
  };
  class Recognition {
    constructor(){recognizers.push(this);}
    start(){this.onstart?.();}
    abort(){this.onerror?.({error:'aborted'});this.onend?.();}
    stop(){this.onend?.();}
  }
  const context = { window: {SpeechRecognition:supported?Recognition:undefined,Envi:{},Holo:{mode:'idle'}}, document:{hidden:false,addEventListener(){}}, $:get, store:{get(){return true;}}, synth:{speaking:false}, ctl:null, grow(){}, emit(){}, setMode(){}, send(text){sent.push(text);return Promise.resolve();}, setTimeout(){}, clearTimeout(){} };
  vm.runInNewContext(source,context);
  return {get, sent, recognizers, context, click(id){get(id).events.click();}};
}
{
  const h=harness();
  assert.equal(h.recognizers.length,0,'page load must not activate microphone');
  assert.equal(h.context.window.__enviWake('Hi Envi, summarize my work'), 'summarize my work');
  assert.equal(h.context.window.__enviWake('Hey envy'), '');
  assert.equal(h.context.window.__enviWake('ordinary conversation'), null);
  h.click('#wakeBtn');
  const w=h.recognizers[0];
  w.onerror({error:'not-allowed'});
  assert.equal(h.get('#wakeBtn').attrs['aria-pressed'],'false');
  assert.match(h.get('#voiceStatus').textContent,/Allow microphone/);
  h.click('#wakeBtn');
  assert.equal(h.recognizers.length,2,'permission failure must allow retry');
}
{
  const h=harness(); h.get('#input').value='Unsent draft'; h.click('#micBtn');
  h.recognizers[0].onerror({error:'no-speech'}); h.recognizers[0].onend();
  assert.deepEqual(h.sent,[],'silence must not submit an existing draft');
}
{
  const h=harness(); h.click('#wakeBtn');
  const w=h.recognizers[0], result=[{transcript:'Hi Envi summarize my work'}];
  result.isFinal=false; w.onresult({resultIndex:0,results:[result]});
  assert.equal(h.recognizers.length,1,'interim transcript must not restart recognition');
  assert.deepEqual(h.sent,[]);
  result.isFinal=true; w.onresult({resultIndex:0,results:[result]});
  assert.deepEqual(h.sent,['summarize my work'],'final wake command sent exactly once');
}
{
  const h=harness(false); assert.equal(h.get('#wakeBtn').disabled,true);
  assert.match(h.get('#voiceStatus').textContent,/unavailable/);
}
console.log('Voice checks passed: explicit activation, wake matching, retry, silence, interim/final handling, unsupported browser.');
