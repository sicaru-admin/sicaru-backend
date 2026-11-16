require('./register-typescript.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const register=require('../src/modules/meilisearch/loaders/startup.ts').default;
const definition=require('../src/modules/meilisearch/index.ts').default;
const Service=require('../src/modules/meilisearch/service.ts').default;
const {GET}=require('../src/api/store/catalog-search/route.ts');
test('startup registration and opt-in guards',async t=>{
 assert.deepEqual(definition.loaders,[register]);
 const oldArgv=process.argv,oldDisabled=process.env.DISABLE_MEILISEARCH_SYNC,oldOpt=process.env.MEILISEARCH_RECONCILE_ON_START;
 try{
  for(const command of ['db:migrate','db:migrate:scripts','exec','unknown'])await t.test(command+' never reconciles',async()=>{
   process.argv=['node','medusa',command];process.env.DISABLE_MEILISEARCH_SYNC='false';process.env.MEILISEARCH_RECONCILE_ON_START='true';
   let registration;await register({container:{register:(key,value)=>{assert.equal(key,'meilisearchStartupReconcile');registration=value;}}});
   // The uninitialized global container would throw if reconciliation were attempted.
   let errors=0;const original=console.error;console.error=()=>errors++;
   try { await registration.resolve()(); } finally { console.error=original; }
   assert.equal(errors,0);
  });
  await t.test('service application hook invokes registered callback once',async()=>{
   let calls=0;const s=new Service({meilisearchStartupReconcile:async()=>calls++},{host:'http://127.0.0.1:1',apiKey:''});
   await s.__hooks.onApplicationStart();await s.__hooks.onApplicationStart();assert.equal(calls,1);
  });
  await t.test('disabled endpoint returns no-store 503 without resolving any service',async()=>{
   process.env.DISABLE_MEILISEARCH_SYNC='true';let body;const headers={};const res={setHeader:(k,v)=>headers[k]=v,status(n){this.code=n;return this},json(b){body=b;return this}};
   await GET({publishable_key_context:{sales_channel_ids:['isolated']},scope:{resolve(){throw Error('must not resolve')}},query:{}},res);
   assert.equal(res.code,503);assert.equal(headers['Cache-Control'],'no-store');assert(!body.products);
  });
 }finally{process.argv=oldArgv;for(const [key,value]of [['DISABLE_MEILISEARCH_SYNC',oldDisabled],['MEILISEARCH_RECONCILE_ON_START',oldOpt]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
