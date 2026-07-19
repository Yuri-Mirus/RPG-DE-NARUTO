import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scryptAsync = promisify(scrypt);
const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(root, 'data', 'store.json');
const env = await loadEnv();
const sessions = new Map();

async function loadEnv() { try { return Object.fromEntries((await readFile(path.join(root,'.env.local'),'utf8')).split(/\r?\n/).filter(x=>x && !x.startsWith('#')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]})); } catch { return {}; } }
async function db() { try { return JSON.parse(await readFile(dataFile,'utf8')); } catch { await mkdir(path.dirname(dataFile),{recursive:true}); const seed={users:[], sheets:[], rolls:[], timeline:[], notes:[]}; await writeFile(dataFile,JSON.stringify(seed,null,2)); return seed; } }
async function save(data) { await writeFile(dataFile, JSON.stringify(data,null,2)); }
const json = (res,status,payload) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload)); };
const body = req => new Promise((ok,bad)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>1e6)req.destroy()});req.on('end',()=>{try{ok(raw?JSON.parse(raw):{})}catch{bad(new Error('JSON inválido'))}})});
const clean = value => String(value ?? '').trim().slice(0,500);
const hash = async password => { const salt=randomBytes(16).toString('hex'); const key=await scryptAsync(password,salt,64); return `${salt}:${key.toString('hex')}`; };
const matches = async (password, stored) => { const [salt,key]=stored.split(':'); const derived=await scryptAsync(password,salt,64); return timingSafeEqual(Buffer.from(key,'hex'),derived); };
const userOf = req => { const token=(req.headers.authorization||'').replace('Bearer ',''); return sessions.get(token); };
const guard = (req,res,roles=[]) => { const user=userOf(req); if(!user || (roles.length&&!roles.includes(user.role))){json(res,403,{error:'Sem permissão'});return null} return user; };
const log = (data,actor,action,detail) => { data.timeline.unshift({id:randomBytes(6).toString('hex'),at:new Date().toISOString(),actor:actor.name,action,detail:clean(detail)}); data.timeline=data.timeline.slice(0,200); };
const publicUser = u => ({id:u.id,name:u.name,role:u.role});

async function api(req,res,url) {
  if(req.method==='POST' && url.pathname==='/api/register') { const {name,email,password,role,code}=await body(req); const data=await db(); const wanted=['player','master','admin'].includes(role)?role:'player'; if(!clean(name)||!/^\S+@\S+\.\S+$/.test(email)||String(password).length<8)return json(res,400,{error:'Preencha nome, e-mail válido e senha de ao menos 8 caracteres.'}); if(data.users.some(u=>u.email===email.toLowerCase()))return json(res,409,{error:'E-mail já cadastrado'}); if(wanted==='master' && (!env.MASTER_CODE || code!==env.MASTER_CODE))return json(res,403,{error:'Código de mestre inválido'}); if(wanted==='admin' && (!env.ADMIN_CODE || code!==env.ADMIN_CODE))return json(res,403,{error:'Código de administrador inválido'}); const u={id:randomBytes(8).toString('hex'),name:clean(name),email:email.toLowerCase(),role:wanted,password:await hash(password)}; data.users.push(u);log(data,u,'criou a conta',wanted);await save(data);return json(res,201,{ok:true}); }
  if(req.method==='POST' && url.pathname==='/api/login') { const {email,password}=await body(req); const data=await db();const u=data.users.find(x=>x.email===clean(email).toLowerCase());if(!u||!(await matches(password||'',u.password)))return json(res,401,{error:'Credenciais inválidas'});const token=randomBytes(32).toString('base64url');sessions.set(token,publicUser(u));return json(res,200,{token,user:publicUser(u)}); }
  if(req.method==='GET' && url.pathname==='/api/state') { const user=guard(req,res);if(!user)return;const data=await db();return json(res,200,{user,rolls:data.rolls.slice(0,30),timeline:data.timeline,sheets:user.role==='player'?data.sheets.filter(s=>s.ownerId===user.id):data.sheets,notes:user.role==='player'?[]:data.notes}); }
  if(req.method==='POST' && url.pathname==='/api/roll') { const user=guard(req,res);if(!user)return;const {sides}=await body(req);const n=Number(sides);if(![5,10,15,20,30].includes(n))return json(res,400,{error:'Dado inválido'});const data=await db();const roll={id:randomBytes(6).toString('hex'),name:user.name,sides:n,value:Math.floor(Math.random()*n)+1,at:new Date().toISOString()};data.rolls.unshift(roll);data.rolls=data.rolls.slice(0,100);log(data,user,'rolou',`d${n}: ${roll.value}`);await save(data);return json(res,200,roll); }
  if(req.method==='POST' && url.pathname==='/api/sheets') { const user=guard(req,res);if(!user)return;const {title,content}=await body(req);const data=await db();const existing=data.sheets.find(s=>s.ownerId===user.id);const sheet={id:existing?.id||randomBytes(6).toString('hex'),ownerId:user.id,owner:user.name,title:clean(title)||'Ficha sem nome',content:clean(content),updatedAt:new Date().toISOString()};if(existing)Object.assign(existing,sheet);else data.sheets.push(sheet);log(data,user,'atualizou a ficha',sheet.title);await save(data);return json(res,200,sheet); }
  if(req.method==='POST' && url.pathname==='/api/timeline') { const user=guard(req,res,['master','admin']);if(!user)return;const {action,detail}=await body(req);const data=await db();log(data,user,clean(action)||'registrou um evento',detail);await save(data);return json(res,200,{ok:true}); }
  if(req.method==='POST' && url.pathname==='/api/notes') { const user=guard(req,res,['master','admin']);if(!user)return;const {text}=await body(req);const data=await db();data.notes.unshift({id:randomBytes(6).toString('hex'),author:user.name,text:clean(text),at:new Date().toISOString()});await save(data);return json(res,200,{ok:true}); }
  if(req.method==='POST' && url.pathname==='/api/demo') { const user=guard(req,res,['admin']);if(!user)return;const {role}=await body(req);if(!['player','master'].includes(role))return json(res,400,{error:'Perfil demo inválido'});const token=randomBytes(32).toString('base64url');const demo={id:`demo-${role}`,name:`Demo ${role==='master'?'Mestre':'Player'}`,role};sessions.set(token,demo);return json(res,200,{token,user:demo}); }
  if(req.method==='POST' && url.pathname==='/api/ai') { const user=guard(req,res);if(!user)return;const {prompt}=await body(req);if(!env.OPENAI_API_KEY)return json(res,503,{error:'IA ainda não está configurada no servidor.'});const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',input:`Você é um assistente de RPG Naruto. Responda em português, sem reproduzir textos protegidos da obra. Pedido: ${clean(prompt)}`})});const result=await response.json();if(!response.ok)return json(res,502,{error:'A IA não respondeu agora.'});return json(res,200,{text:result.output_text||'Sem resposta.'}); }
  return json(res,404,{error:'Rota não encontrada'});
}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url);const file=url.pathname==='/'?'index.html':url.pathname.slice(1);const full=path.join(root,'public',file);if(!full.startsWith(path.join(root,'public')))return json(res,400,{error:'Caminho inválido'});const content = await readFile(full);

res.writeHead(200, {
  'Content-Type': types[path.extname(full)] || 'application/octet-stream'
});

res.end(content);}catch (error) {
  console.error(error);

  if (!res.headersSent) {
    json(res, 500, {
      error: error.message || 'Erro interno'
    });
  } else {
    res.end();
  }
}}).listen(process.env.PORT||3000,()=>console.log('Shinobi RPG em http://localhost:3000'));
