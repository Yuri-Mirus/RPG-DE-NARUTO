const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nations={'Terra do Fogo':'Konoha · Vila Oculta da Folha','Terra do Vento':'Sunagakure · Vila Oculta da Areia','Terra da Água':'Kirigakure · Vila Oculta da Névoa','Terra da Terra':'Iwagakure · Vila Oculta da Pedra','Terra do Relâmpago':'Kumogakure · Vila Oculta da Nuvem'};
const wiki=[['As cinco nações','Fogo, Vento, Água, Terra e Relâmpago.'],['Kage','Líderes de suas respectivas vilas ocultas.'],['Chakra','Energia moldada para executar técnicas.'],['Clãs','Famílias com tradições e habilidades próprias.']]; const beasts=[['Bijuu','Criaturas de chakra muito poderosas.'],['Invocações','Animais aliados ligados por contrato.'],['Ninken','Cães ninjas de rastreamento.'],['Serpentes gigantes','Habitantes perigosos de cavernas.']];
let sb, profile, session;
function message(t,ok=false){$('#message').textContent=t;$('#message').style.color=ok?'#237443':'#b62626'}
function configured(){return window.SUPABASE_URL?.startsWith('https://')&&window.SUPABASE_ANON_KEY&&!window.SUPABASE_ANON_KEY.startsWith('COLE_')}
function page(id){$$('.page').forEach(p=>p.classList.toggle('active',p.id===id));$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===id));$('#title').textContent=$(`nav button[data-page="${id}"]`)?.textContent||id}$$('nav button[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button').forEach(x=>x.classList.toggle('active',x===b));$('#login').hidden=b.dataset.form!=='login';$('#register').hidden=b.dataset.form!=='register'});
$('#login').onsubmit = async e => {
  e.preventDefault();

  if (!configured()) {
    return message('Configure o Supabase primeiro.');
  }

  const f = Object.fromEntries(new FormData(e.target));

  const { data, error } = await sb.auth.signInWithPassword({
    email: f.email,
    password: f.password
  });

  console.log("LOGIN DATA:", data);
  console.log("LOGIN ERROR:", error);

  const { data: sessionData } = await sb.auth.getSession();
  console.log("SESSION:", sessionData);

  if (error) {
    return message(error.message);
  }

  await boot();
};
$('#register').onsubmit=async e=>{e.preventDefault();if(!configured())return message('Configure o Supabase primeiro.');const f=Object.fromEntries(new FormData(e.target));const {data,error}=await sb.auth.signUp({email:f.email,password:f.password});if(error)return message(error.message);if(!data.user)return message('Confira seu e-mail para confirmar a conta.',true);const {error:profileError}=await sb.rpc('create_profile',{name:f.name});if(profileError)return message(profileError.message);if(f.role!=='player'){const {error:roleError}=await sb.rpc('claim_role',{requested:f.role,supplied_code:f.code});if(roleError)return message('Conta criada como player. Faça login e confira o código para elevar o perfil.')}message('Conta criada. Você já pode entrar.',true);e.target.reset()};
async function fetchState(){const [{data:sheets},{data:rolls},{data:timeline},{data:notes}]=await Promise.all([sb.from('character_sheets').select('*').order('updated_at',{ascending:false}),sb.from('dice_rolls').select('*,profiles(display_name)').order('created_at',{ascending:false}).limit(30),sb.from('campaign_events').select('*,profiles(display_name)').order('created_at',{ascending:false}).limit(100),sb.from('master_notes').select('*,profiles(display_name)').order('created_at',{ascending:false})]);return {sheets:sheets||[],rolls:rolls||[],timeline:timeline||[],notes:notes||[]}}
async function render(){const state=await fetchState();document.body.className=profile.role;$('#who').textContent=`${profile.display_name} · ${profile.role}`;$('#timeline').innerHTML=state.timeline.map(x=>`<div><b>${x.profiles?.display_name||'Mestre'}</b> ${x.action}<br><span>${x.detail}</span></div>`).join('')||'<p>Nenhuma crônica ainda.</p>';$('#rolls').innerHTML=state.rolls.map(r=>`<div><b>${r.profiles?.display_name||'Shinobi'}</b> rolou d${r.sides}: <strong>${r.value}</strong></div>`).join('');$('#sheets-list').innerHTML=state.sheets.map(s=>`<div class="card sheet"><h3>${s.title}</h3><p>${s.content}</p></div>`).join('');const mine=state.sheets.find(s=>s.owner_id===session.user.id);$('#sheet-form').title.value=mine?.title||'';$('#sheet-form').content.value=mine?.content||'';$('#notes').innerHTML=state.notes.map(n=>`<div><b>Nota de ${n.profiles?.display_name||'Mestre'}</b><br>${n.text}</div>`).join('')||'<p>Sem notas secretas.</p>'}
async function boot() {
  const { data: { session: s } } = await sb.auth.getSession();

  console.log("SESSION:", s);

  if (!s) {
    alert("Não existe sessão!");
    return;
  }

  session = s;

  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', s.user.id)
    .single();

  console.log("PROFILE:", data);
  console.log("PROFILE ERROR:", error);

  if (error) {
    alert("Erro ao buscar perfil: " + error.message);
    return;
  }

  profile = data;

console.log("ANTES DE MOSTRAR APP");

$('#auth').hidden = true;
$('#app').hidden = false;

console.log("ANTES DO RENDER");

try {
  await render();
  console.log("RENDER OK");
} catch (e) {
  console.error("ERRO NO RENDER:", e);
  alert("Erro no render: " + e.message);
}
}
$$('.map button').forEach(b=>b.onclick=()=>$('#nation').innerHTML=`<h3>${b.dataset.nation}</h3><p>${nations[b.dataset.nation]}</p>`);$('#nation').innerHTML='<h3>Mapa-múndi</h3><p>Escolha uma nação.</p>';
$$('.dice-buttons button').forEach(b=>b.onclick=async()=>{const {data,error}=await sb.rpc('roll_die',{requested_sides:Number(b.dataset.die)});if(error)return alert(error.message);$('#die').classList.add('rolling');setTimeout(()=>{$('#die').textContent=data.value;$('#die').classList.remove('rolling')},300);await render()});
$('#sheet-form').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const {error}=await sb.from('character_sheets').upsert({owner_id:session.user.id,title:f.title||'Ficha sem nome',content:f.content||'',updated_at:new Date().toISOString()},{onConflict:'owner_id'});if(error)alert(error.message);else render()};
$('#event-form').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const {error}=await sb.from('campaign_events').insert({author_id:session.user.id,action:f.action,detail:f.detail});if(error)alert(error.message);else{e.target.reset();render()}};
$('#note-form').onsubmit=async e=>{e.preventDefault();const text=new FormData(e.target).get('text');const {error}=await sb.from('master_notes').insert({author_id:session.user.id,text});if(error)alert(error.message);else{e.target.reset();render()}};
$('#ai-form').onsubmit=async e=>{e.preventDefault();$('#ai-answer').textContent='Consultando o Sensei...';const prompt=new FormData(e.target).get('prompt');const {data,error}=await sb.functions.invoke('ask-sensei',{body:{prompt}});$('#ai-answer').textContent=error?.message||data?.text||'Sem resposta.'};
function cards(items,target){$(target).innerHTML=items.map(x=>`<div class="card"><h3>${x[0]}</h3><p>${x[1]}</p></div>`).join('')}cards(wiki,'#wiki-list');cards(beasts,'#beasts');$('#wiki-search').oninput=e=>cards(wiki.filter(x=>x.join(' ').toLowerCase().includes(e.target.value.toLowerCase())),'#wiki-list');$('#logout').onclick=async()=>{await sb.auth.signOut();location.reload()};
if(configured()){sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);sb.auth.onAuthStateChange(()=>boot());boot()}else message('Configure public/supabase-config.js antes de usar o site.');
