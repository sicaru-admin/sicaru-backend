const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../medusa-config.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText;
const staging = {
  RAILWAY_PROJECT_ID:'7b251006-cebd-48b3-a7a5-97b6c65d6baf',
  RAILWAY_ENVIRONMENT_ID:'da5e95b1-c2fc-456b-bb75-5b71b95c8f4b',
  RAILWAY_ENVIRONMENT_NAME:'staging-voglia',
  RAILWAY_SERVICE_ID:'50beb418-f34d-467d-b1f2-111c725c807d',
  MEDUSA_BACKEND_URL:'https://qa-backend.example',
};
function load(env = {}, cwd='/app/.medusa/server') {
  const box={module:{exports:{}},exports:{},URL,
    process:{env:{...env},cwd:()=>cwd},
    require:name=>{
      if(name==='@medusajs/framework/utils')return {loadEnv:()=>{},defineConfig:x=>x};
      if(name==='node:path')return path;
      throw new Error('Unexpected dependency');
    }};
  vm.runInNewContext(code,box);
  return JSON.parse(JSON.stringify(box.module.exports));
}
const fileModules = config => config.modules.filter(x=>x.resolve==='@medusajs/medusa/file');
test('exact staging target gets one native local provider with a public origin',()=>{
  const files=fileModules(load(staging));assert.equal(files.length,1);
  assert.deepEqual(files[0].options.providers,[{resolve:'@medusajs/medusa/file-local',id:'local',options:{upload_dir:'/app/.medusa/server/static',backend_url:'https://qa-backend.example/static'}}]);
});
test('uses the effective application cwd, not the SSH landing directory',()=>{
  const p=fileModules(load(staging,'/different/runtime'))[0].options.providers[0];
  assert.equal(p.options.upload_dir,'/different/runtime/static');
});
test('a trailing origin slash never produces a double slash in the public path',()=>{
  assert.equal(fileModules(load({...staging,MEDUSA_BACKEND_URL:'https://qa-backend.example/'}))[0].options.providers[0].options.backend_url,'https://qa-backend.example/static');
});
test('production, preview-payments, local and other projects retain the existing default',()=>{
  for(const env of [{},{NODE_ENV:'production'}, {...staging,RAILWAY_ENVIRONMENT_NAME:'production'}, {...staging,RAILWAY_ENVIRONMENT_NAME:'preview-payments'}, {...staging,RAILWAY_ENVIRONMENT_ID:'other'}, {...staging,RAILWAY_PROJECT_ID:'other'}, {...staging,RAILWAY_SERVICE_ID:'other'}])assert.equal(fileModules(load(env)).length,0);
});
test('a malformed or non-public-origin configuration fails closed in QA',()=>{
  for(const url of ['', 'http://localhost:9000', 'http://qa-backend.example', 'https://qa-backend.example/path', 'https://qa-backend.example/?x=y', 'https://qa-backend.example/#x', 'https://user:password@qa-backend.example'])assert.throws(()=>load({...staging,MEDUSA_BACKEND_URL:url}));
});
test('only the File Module is added; existing module configs remain identical',()=>{
  const baseline=load({});const qa=load(staging);
  assert.deepEqual(qa.modules.filter(x=>x.resolve!=='@medusajs/medusa/file'),baseline.modules);
  assert.deepEqual(qa.projectConfig,baseline.projectConfig);
  assert.equal(qa.admin.disable,baseline.admin.disable);
});
test('Railway start override is only staging and skips migration commands',()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../railway.json'),'utf8'));
  assert.deepEqual(Object.keys(cfg.environments),['staging-voglia']);
  assert.equal(cfg.deploy.startCommand,'npm run start:production');
  const command=cfg.environments['staging-voglia'].deploy.startCommand;
  assert.match(command,/^cd \.medusa\/server && exec \.\.\/\.\.\/node_modules\/\.bin\/medusa start /);
  assert.ok(!/migrate|seed|npm run start/.test(command));
});
