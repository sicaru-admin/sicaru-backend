require('./register-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {Module}=require('node:module');const {transformSync}=require('@swc/core');const {execFileSync}=require('node:child_process');
test('recovery patch applies and fails closed without touching catalogue or index',async()=>{
 execFileSync('git',['apply','--check','docs/store-api-only/RECUPERACION_SEGURA.patch'],{stdio:'pipe'});
 const patch=fs.readFileSync('docs/store-api-only/RECUPERACION_SEGURA.patch','utf8');
 const source=patch.split('\n').filter(line=>(line.startsWith('+')&&!line.startsWith('+++'))||line.startsWith(' ')).map(line=>line.slice(1)).join('\n');
 const code=transformSync(source,{jsc:{parser:{syntax:'typescript'},target:'es2021'},module:{type:'commonjs'}}).code;
 const compiled=new Module('recovery');compiled._compile(code,'recovery.js');
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
 await compiled.exports.GET({scope:{resolve(){throw Error('must not access data')}}},res);
 assert.equal(res.statusCode,503);assert.equal(res.headers['Cache-Control'],'no-store');assert(!('product_count'in res.body));
 assert.throws(()=>new(require('../src/modules/meilisearch/service.ts').default)({},{}),/disabled/);
});
