require('./register-typescript.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const MeiliSearchService = require('../src/modules/meilisearch/service.ts').default;
const { rebuildPublicSearch, searchPublicProducts } = require('../src/lib/public-search.ts');
const subscriber = require('../src/subscribers/meilisearch-sync.ts').default;
const loader = require('../src/loaders/meilisearch-sync.ts').default;
const manual = require('../src/scripts/sync-meilisearch.ts').default;
const { GET } = require('../src/api/store/catalog-search/route.ts');
const host = 'http://127.0.0.1:57742';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sicaru-search-regression-'));
let processHandle, client, service, products = [];
const dbUrl = new URL(process.env.SEARCH_TEST_DATABASE_URL || 'http://missing');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.pathname, '/sicaru_fantasy_isolated_v2');
const database = require('knex')({ client: 'pg', connection: process.env.SEARCH_TEST_DATABASE_URL });
const query = { graph: async ({ filters = {}, pagination }) => {
  let data = products.filter(p => (!filters.id || (Array.isArray(filters.id) ? filters.id.includes(p.id) : p.id === filters.id)) && (!filters.status || p.status === filters.status));
  if (pagination) data = data.slice(pagination.skip, pagination.skip + pagination.take);
  return { data };
} };
const container = { resolve: key => ({ __pg_connection__: database, query, meilisearch: service })[key] };
const pub = id => ({ id, status: 'published', title: `Synthetic ${id}`, handle: id, categories: [
  { id: 'public', name: 'Public category', is_active: true, is_internal: false },
  { id: 'private', name: 'Private category', is_active: true, is_internal: true },
  { id: 'inactive', name: 'Inactive category', is_active: false, is_internal: false }], sales_channels: [{ id: 'web' }], variants: [] });
const event = (name, id) => subscriber({ event: { name, data: { id } }, container });
const raw = async () => (await client.index('products').search('', { limit: 1000 })).hits;
const seed = async docs => { const task = await client.index('products').addDocuments(docs); await client.tasks.waitForTask(task.taskUid); };
const response = () => ({ statusCode: 200, headers: {}, status(n) { this.statusCode = n; return this; }, setHeader(k,v) { this.headers[k]=v; }, json(body) { this.body=body; return this; } });
async function start() {
  processHandle = spawn(process.env.MEILI_TEST_BINARY, ['--http-addr', '127.0.0.1:57742', '--db-path', path.join(dir,'data'), '--no-analytics'], { stdio: ['ignore', fs.openSync(path.join(dir,'server.log'),'a'), 'ignore'] });
  for (let i=0;i<100;i++) { try { if ((await fetch(host+'/health')).ok) return; } catch {} await new Promise(r=>setTimeout(r,50)); }
  throw new Error('Isolated search server did not start');
}
async function stop() { if (!processHandle || processHandle.exitCode !== null) return; await new Promise(resolve => { processHandle.once('exit', resolve); processHandle.kill('SIGTERM'); }); }
before(async()=>{ assert(process.env.MEILI_TEST_BINARY, 'Set the path to the official local test binary'); delete process.env.DISABLE_MEILISEARCH_SYNC;
  await start(); const {MeiliSearch}=await import('meilisearch'); client=new MeiliSearch({host}); service=new MeiliSearchService({}, {host,apiKey:''}); await service.configureIndex(); });
after(async()=>{await stop();await database.destroy();});
test('draft protection with an isolated real Meilisearch', async t=>{
 await t.test('database lock serializes jobs across separate transactions', async()=>{ const {withSearchLock}=require('../src/lib/public-search.ts'); const order=[]; await Promise.all([withSearchLock(container,async()=>{order.push('first-start');await new Promise(r=>setTimeout(r,30));order.push('first-end');}),withSearchLock(container,async()=>{order.push('second');})]); assert.equal(order.indexOf('first-end'), order.indexOf('first-start') + 1, 'Index jobs must not overlap; PostgreSQL does not promise acquisition order'); });
 await t.test('created draft is removed, including a previously leaked document', async()=>{products=[{...pub('draft-created'),status:'draft'}];await seed([{id:'draft-created',title:'leaked'}]);await event('product.created','draft-created');assert.equal((await raw()).length,0);});
 await t.test('updated draft cannot be indexed',async()=>{await seed([{id:'draft-created',title:'leaked again'}]);await event('product.updated','draft-created');assert.equal((await raw()).length,0);});
 await t.test('published -> draft disappears from public response before the asynchronous event, and from index after it',async()=>{products=[pub('published')];await event('product.created','published');assert.equal((await raw()).length,1);products[0].status='draft';assert.deepEqual(await searchPublicProducts(container,'',['web']),[]);await event('product.updated','published');assert.equal((await raw()).length,0);});
 await t.test('late created event rereads current draft status',async()=>{await event('product.created','published');assert.equal((await raw()).length,0);});
 await t.test('rebuild purges legacy drafts/deleted records and excludes private categories',async()=>{products=[pub('live'),{...pub('draft'),status:'draft'}];await seed([{id:'legacy-draft',title:'old',status:'draft'},{id:'deleted',title:'old',status:'published'}]);assert.equal(await rebuildPublicSearch(container),1);const hits=await raw();assert.deepEqual(hits.map(h=>h.id),['live']);assert.deepEqual(hits[0].category_ids,['public']);assert(!JSON.stringify(hits).includes('Private category'));});
 await t.test('full rebuild and manual entry point handle pagination',async()=>{products=Array.from({length:103},(_,i)=>pub('page-'+String(i).padStart(3,'0')));products.push({...pub('hidden'),status:'draft'});await manual({container});assert.equal((await raw()).length,103);});
 await t.test('service refuses nonpublished documents even if caller bypasses mapper',async()=>{await service.addOrUpdateProducts([{...pub('attempt'),status:'draft'}]);assert(!(await raw()).some(h=>h.id==='attempt'));});
 await t.test('restarting search preserves clean data; backend startup purges stale entries',async()=>{await stop();await start();assert.equal((await raw()).length,103);await seed([{id:'leaked-after-restart',title:'legacy',status:'draft'}]);products=[pub('after-restart'),{...pub('still-draft'),status:'draft'}];await loader(container);assert.deepEqual((await raw()).map(h=>h.id),['after-restart']);});
 await t.test('empty index can be rebuilt from scratch',async()=>{await service.deleteAllProducts();await rebuildPublicSearch(container);assert.deepEqual((await raw()).map(h=>h.id),['after-restart']);});
 await t.test('deleted or missing records are removed',async()=>{products=[];await event('product.updated','after-restart');assert.equal((await raw()).length,0);await seed([{id:'missing',title:'missing',status:'published'}]);await event('product.deleted','missing');assert.equal((await raw()).length,0);});
 await t.test('public endpoint requires trusted storefront key context',async()=>{const res=response();await GET({scope:container,query:{}},res);assert.equal(res.statusCode,401);assert.equal(res.headers['Cache-Control'],'no-store');});
 await t.test('public endpoint ignores stale published hits and other channels without leaking totals/categories',async()=>{products=[{...pub('stale'),status:'draft'}, {...pub('other-channel'),sales_channels:[{id:'other'}]},pub('safe')];await seed([{id:'stale',title:'stale',status:'published'},{id:'other-channel',title:'other',status:'published'},{id:'safe',title:'safe',status:'published'}]);const res=response();await GET({scope:container,query:{q:''},publishable_key_context:{sales_channel_ids:['web']}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.body.products.map(p=>p.id),['safe']);assert.deepEqual(res.body.products[0].category_ids,['public']);assert.equal(res.body.count,1);});
 await t.test('failed asynchronous index task is not reported as success',async()=>{const count=(await raw()).length;await assert.rejects(service.addOrUpdateProducts([{id:[],status:'published',title:'invalid synthetic document'}]));assert.equal((await raw()).length,count);});
 await t.test('Medusa failure fails closed with no stale fallback',async()=>{const res=response();await GET({scope:{resolve:key=>key==='query'?{graph:async()=>{throw Error('synthetic unavailable')}}:container.resolve(key)},query:{q:''},publishable_key_context:{sales_channel_ids:['web']}},res);assert.equal(res.statusCode,503);assert(!res.body.products);});
});
