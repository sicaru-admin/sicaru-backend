// Real Medusa CLI + existing isolated schema. Never invokes migrations or product workflows.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { transformSync } = require('@swc/core');
const dbUrl = new URL(process.env.SEARCH_TEST_DATABASE_URL || 'http://missing');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.port, '55439');
assert.equal(dbUrl.pathname, '/sicaru_fantasy_isolated_v2');
const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sicaru-real-start-'));
fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'));
fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({name:'isolated-real-start',version:'0.0.0',dependencies:{'@medusajs/medusa':'2.13.1'}}));
for (const relative of ['src/modules/meilisearch/index.ts','src/modules/meilisearch/service.ts','src/modules/meilisearch/loaders/startup.ts','src/loaders/meilisearch-sync.ts','src/lib/public-search.ts','src/api/store/catalog-search/route.ts','src/subscribers/meilisearch-sync.ts']) {
 const out = path.join(fixture, relative.replace(/\.ts$/, '.js'));
 fs.mkdirSync(path.dirname(out), { recursive: true });
 fs.writeFileSync(out, transformSync(fs.readFileSync(path.join(root,relative),'utf8'), { filename:relative,jsc:{parser:{syntax:'typescript'},target:'es2021'},module:{type:'commonjs',ignoreDynamic:true}}).code);
}
fs.writeFileSync(path.join(fixture,'medusa-config.js'), `const {defineConfig}=require('@medusajs/framework/utils');
const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='127.0.0.1'||u.port!=='55439'||u.pathname!=='/sicaru_fantasy_isolated_v2')throw Error('Isolation guard');
module.exports=defineConfig({admin:{disable:true},projectConfig:{databaseUrl:process.env.DATABASE_URL,http:{storeCors:'http://127.0.0.1:55441',adminCors:'http://127.0.0.1:55441',authCors:'http://127.0.0.1:55441',jwtSecret:'isolated',cookieSecret:'isolated'}},modules:[{resolve:'./src/modules/meilisearch',options:{host:'http://127.0.0.1:57743',apiKey:''}}]});`);
const fetch = (url, init = {}) => globalThis.fetch(url, {...init, signal: AbortSignal.timeout(5000)});
const wait = ms => new Promise(r=>setTimeout(r,ms));
async function until(fn, ms=60000) { const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await wait(200);}throw Error('Timeout'); }
async function stop(child) {if(child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),wait(10000)]);if(child.exitCode===null)child.kill('SIGKILL');}
let meili, child;
const logs=[];
let existing;
async function readExisting() {
 const db=new (require('pg').Client)({connectionString:dbUrl.href, connectionTimeoutMillis:5000, statement_timeout:5000});await db.connect();await db.query('BEGIN READ ONLY');
 const products=(await db.query("select id,handle,status from product where deleted_at is null")).rows;
 const counts={};for(const table of ['product','product_category','product_variant','price','inventory_item','inventory_level','reservation_item','product_sales_channel'])counts[table]=(await db.query('select count(*)::int as n from '+table)).rows[0].n;
 const variants=(await db.query("select id,sku from product_variant where deleted_at is null")).rows;
 const categories=(await db.query("select id,handle,is_active,is_internal from product_category where deleted_at is null")).rows;
 const key=(await db.query("select token from api_key where type='publishable' and deleted_at is null limit 1")).rows[0]?.token;
 await db.query('ROLLBACK');await db.end();assert(key);assert(products.length);assert(products.every(p=>p.status==='draft'));return {products,categories,variants,key,counts};
}
async function boot(disabled,optin) {
 // Deliberately construct environment from a whitelist, no inherited production credentials.
 let log='';
 child=spawn(process.execPath,[path.join(root,'node_modules/@medusajs/cli/cli.js'),'start','--host','127.0.0.1','--port','55441'],{cwd:fixture,env:{PATH:process.env.PATH,HOME:fixture,NODE_ENV:'test',DATABASE_URL:dbUrl.href,DISABLE_ADMIN:'true',DISABLE_MEILISEARCH_SYNC:String(disabled),MEILISEARCH_RECONCILE_ON_START:String(optin),MEDUSA_TELEMETRY_DISABLED:'true'}});
 child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 await until(async()=>{if(child.exitCode!==null)throw Error(log);return fetch('http://127.0.0.1:55441/health').then(r=>r.ok).catch(()=>false)});
 logs.push(()=>log);
 return ()=>log;
}
test('actual Medusa start/restart with optional search and existing isolated schema', async t=>{
 try {
  existing=await readExisting();
  await t.test('disabled: real boot serves health and Store API boundary with no engine',async t=>{
   const log=await boot(true,true);
   assert.equal((await fetch('http://127.0.0.1:55441/store/products')).status,400); // key required, no index failure
   assert(!log().includes('Reconciled '));assert(!log().includes('Reconciliation failed'));
   await t.test('existing drafts excluded by list, query, handle, ID, category and override',async()=>{
    const headers={'x-publishable-api-key':existing.key};
    for(const suffix of ['', '?q=Fantasy', '?status=draft', ...existing.products.map(p=>'?handle='+encodeURIComponent(p.handle)), ...existing.products.map(p=>'?id='+p.id), ...existing.categories.map(c=>'?category_id[]='+c.id)]) {
     const r=await fetch('http://127.0.0.1:55441/store/products'+suffix,{headers});const data=await r.json();
     assert(!JSON.stringify(data).includes(existing.products[0].id));
     if(r.ok)assert.deepEqual(data.products,[]);else assert([400,404].includes(r.status));
    }
    for(const p of existing.products)assert.equal((await fetch('http://127.0.0.1:55441/store/products/'+p.id,{headers})).status,404);
    for(const v of existing.variants){
     assert.equal((await fetch('http://127.0.0.1:55441/store/product-variants/'+v.id,{headers})).status,404);
     const r=await fetch('http://127.0.0.1:55441/store/product-variants?sku='+encodeURIComponent(v.sku||''),{headers});
     const b=await r.json();if(r.ok)assert.deepEqual(b.variants,[]);else assert([400,404].includes(r.status));
    }
    const r=await fetch('http://127.0.0.1:55441/store/product-categories',{headers});assert.equal(r.status,200);assert.deepEqual((await r.json()).product_categories,[]);
    const search=await fetch('http://127.0.0.1:55441/store/catalog-search?q=Fantasy',{headers});assert([401,503].includes(search.status));assert.equal(search.headers.get('cache-control'),'no-store');
   });
   await stop(child);
  });
  meili=spawn(process.env.MEILI_TEST_BINARY,['--http-addr','127.0.0.1:57743','--db-path',path.join(fixture,'index'),'--no-analytics'],{env:{PATH:process.env.PATH,HOME:fixture},stdio:'ignore'});
  await until(()=>fetch('http://127.0.0.1:57743/health').then(r=>r.ok).catch(()=>false));
  for(const label of ['enabled opt-in boot','enabled opt-in restart'])await t.test(label,async()=>{
   const log=await boot(false,true);
   await until(()=>log().includes('Reconciled '));
   assert.equal((log().match(/Reconciled /g)||[]).length,1);
   const data=await fetch('http://127.0.0.1:57743/indexes/products/documents?limit=1000').then(r=>r.json());
   assert(Array.isArray(data.results));assert(data.results.every(d=>d.status==='published'));
   await stop(child);
  });
  await t.test('no opt-in: real boot leaves index untouched',async()=>{
   const before=await fetch('http://127.0.0.1:57743/tasks').then(r=>r.json());
   const log=await boot(false,false);await wait(500);
   const after=await fetch('http://127.0.0.1:57743/tasks').then(r=>r.json());
   assert.equal(after.total,before.total);assert(!log().includes('Reconciled '));await stop(child);
  });
  await t.test('no products, prices, levels, reservations or channel links created',async()=>{assert.deepEqual((await readExisting()).counts,existing.counts);});
 } finally {if(child)await stop(child);if(meili)await stop(meili);fs.writeFileSync(path.join(fixture,'boot-logs.txt'),logs.map(f=>f()).join('\n---\n'));console.log('LOCAL_ONLY_EVIDENCE',fixture);}
});
