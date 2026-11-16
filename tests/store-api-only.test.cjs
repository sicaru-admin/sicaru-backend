require('./register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const subscriber=require('../src/subscribers/meilisearch-sync.ts').default;
const loader=require('../src/loaders/meilisearch-sync.ts').default;
const manual=require('../src/scripts/sync-meilisearch.ts').default;
const Service=require('../src/modules/meilisearch/service.ts').default;
const {GET}=require('../src/api/storefront-config/route.ts');
const invalidate=require('../src/lib/invalidate-storefront.ts').invalidateStorefront;
const cacheHandler=require('../src/subscribers/catalog-cache.ts').default;
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}});
function fixture({token='pk_test',revoked=null,permitted=['web'],requested,products=[],links=[]}={}){
 const calls=[];const key={token,revoked_at:revoked,sales_channels_link:permitted.map(sales_channel_id=>({sales_channel_id}))};
 const query={graph:async(args,options)=>{calls.push(args);assert.equal(options.cache.enable,false);
  if(args.entity==='api_key')return {data:args.filters.token==='pk_test'?[key]:[]};
  if(args.entity==='product_sales_channel'){const rows=links.filter(x=>args.filters.sales_channel_id.includes(x.sales_channel_id));return {data:rows.slice(args.pagination.skip,args.pagination.skip+args.pagination.take)}}
  assert.equal(args.entity,'product');assert.equal(args.filters.status,'published');return {data:products.filter(p=>args.filters.id.includes(p.id)&&p.status==='published')};
 }};
 return {calls,req:{get:()=>token,query:requested===undefined?{}:{sales_channel_id:requested},scope:{resolve:()=>query}}};
}
test('Store API-only guardrails',async t=>{
 await t.test('legacy flags and entrypoints cannot reactivate Meili',async()=>{
  for(const value of [undefined,'false','true']){if(value===undefined)delete process.env.DISABLE_MEILISEARCH_SYNC;else process.env.DISABLE_MEILISEARCH_SYNC=value;
   const container={resolve(){throw Error('must not resolve')}};await subscriber({container,event:{name:'product.created',data:{id:'draft'}}});await loader(container);await assert.rejects(manual({container}),/disabled/);assert.throws(()=>new Service({}, {host:'http://127.0.0.1:1',apiKey:''}),/disabled/);
  }
  delete process.env.DISABLE_MEILISEARCH_SYNC;
  const scripts=require('../package.json').scripts;assert(!scripts.start.includes('db:migrate'));assert(!scripts['start:production'].includes('db:migrate'));
  const config=require('node:fs').readFileSync('medusa-config.ts','utf8');assert(!config.includes('resolve: "./src/modules/meilisearch"'));
 });
 await t.test('compose has no automatic public engine or dependency',async()=>{
  const yaml=require('js-yaml'),fs=require('node:fs');for(const file of ['docker-compose.yml','docker-compose.production.yml']){const config=yaml.load(fs.readFileSync(file,'utf8'));assert.deepEqual(config.services.meilisearch.profiles,['legacy-search-manual-only']);assert.deepEqual(config.services.meilisearch.ports,['127.0.0.1:7700:7700']);assert(!config.services.medusa?.depends_on?.meilisearch);assert(config.volumes.meilisearch_data===null);}
 });
 await t.test('counter excludes draft, wrong channel, unlinked product and duplicate links',async()=>{
  const f=fixture({products:[{id:'safe',status:'published'},{id:'draft',status:'draft'},{id:'other',status:'published'},{id:'unlinked',status:'published'}],links:[{product_id:'safe',sales_channel_id:'web'},{product_id:'safe',sales_channel_id:'web'},{product_id:'draft',sales_channel_id:'web'},{product_id:'other',sales_channel_id:'retail'}]});const res=response();await GET(f.req,res);assert.equal(res.body.product_count,1);assert.equal(res.body.publishable_key,'pk_test');assert.equal(res.headers['Cache-Control'],'no-store');
 });
 await t.test('counter traverses multiple link batches',async()=>{
  const products=Array.from({length:403},(_,i)=>({id:'p'+i,status:i===401?'draft':'published'}));const f=fixture({products,links:products.map(p=>({product_id:p.id,sales_channel_id:'web'}))});const r=response();await GET(f.req,r);assert.equal(r.body.product_count,402);assert.equal(f.calls.filter(c=>c.entity==='product_sales_channel').length,3);
 });
 for(const [name,input,status]of [['missing key',{token:''},401],['invalid key',{token:'bad'},401],['revoked',{revoked:'2000-01-01'},401],['no channels',{permitted:[]},403],['channel override',{requested:'retail'},403],['array injection',{requested:['web']},403]])await t.test(name,async()=>{const f=fixture(input),r=response();await GET(f.req,r);assert.equal(r.statusCode,status);assert(!('product_count'in r.body));});
 await t.test('channel selection narrows scope',async()=>{const f=fixture({permitted:['web','retail'],requested:'retail',products:[{id:'r',status:'published'},{id:'w',status:'published'}],links:[{product_id:'r',sales_channel_id:'retail'},{product_id:'w',sales_channel_id:'web'}]});const r=response();await GET(f.req,r);assert.equal(r.body.product_count,1);});
 await t.test('counter backend failure has no stale or global-count fallback',async()=>{const f=fixture();f.req.scope.resolve=()=>({graph:async()=>{throw Error('synthetic offline')}});await assert.rejects(GET(f.req,response()),/offline/)});
 await t.test('cache subscriber is inert until configured; configured requests signed and bounded',async()=>{
  const oldFetch=global.fetch;const oldSecret=process.env.CATALOG_REVALIDATION_SECRET,oldUrl=process.env.CATALOG_REVALIDATION_URL;let calls=0;
  try{delete process.env.CATALOG_REVALIDATION_SECRET;global.fetch=async()=>{throw Error('unexpected call')};await cacheHandler({});
   process.env.CATALOG_REVALIDATION_SECRET='synthetic-test-key-never-production-12345';process.env.CATALOG_REVALIDATION_URL='https://www.sicarubeauty.com/api/revalidate';
   global.fetch=async(url,init)=>{calls++;assert.equal(url.origin,'https://www.sicarubeauty.com');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert(init.signal);assert.equal(init.headers['x-sicaru-signature'],createHmac('sha256',process.env.CATALOG_REVALIDATION_SECRET).update(init.headers['x-sicaru-timestamp']+'.'+init.body).digest('hex'));return {ok:true}};
   await invalidate();assert.equal(calls,1);
   process.env.CATALOG_REVALIDATION_URL='https://attacker.invalid/api/revalidate';await assert.rejects(invalidate(),/not permitted/);assert.equal(calls,1);
   process.env.CATALOG_REVALIDATION_URL='https://www.sicarubeauty.com/api/revalidate';global.fetch=async()=>({ok:false});await assert.rejects(invalidate(),/retry is safe/);
  }finally{global.fetch=oldFetch;for(const [k,v]of [['CATALOG_REVALIDATION_SECRET',oldSecret],['CATALOG_REVALIDATION_URL',oldUrl]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
 });
});
