#!/usr/bin/env node
/* Il piano operativo da riga di comando — il gemello di diag.js per lo strato
   che sta sotto la prescrizione. diag.js risponde a «perché queste ore»;
   questo risponde a «in quali notti, con quale posa, quante pose».
   Non duplica niente: importa le stesse funzioni pure di index.html.

     node plan.js M31 14.5 3 rc8_red_cem70 1
     node plan.js "NGC 6888" 20 4 rc8_full_cem70 1 2026-09-20
*/
const fs=require('fs'), path=require('path');
const D=__dirname;
const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
const pure=html.split('<script>')[1].split('</script>')[0]
  .split('/* =====================================================================\n   UI')[0];
const DB=JSON.parse(fs.readFileSync(path.join(D,'data/setups.json'),'utf8'));
const TG=JSON.parse(fs.readFileSync(path.join(D,'data/targets.json'),'utf8'));
const CATJ=JSON.parse(fs.readFileSync(path.join(D,'data/catalog.json'),'utf8'));
const CITJ=JSON.parse(fs.readFileSync(path.join(D,'data/cities.json'),'utf8'));
/* Stessi input del browser: magnitudine e angolo di posizione innestati da
   OpenNGC sulle schede e sul catalogo curato. Vedi tools/lib/enrich.js. */
require(path.join(D,'tools/lib/enrich.js')).enrich(TG,CATJ.objects,D);
const OWNED=DB.default_filters.slice();
const ctx={DB,TG,CAT:CATJ.objects,CITIES:CITJ.cities,OWNED,console,Math,Date,Object,JSON,
           isFinite,parseFloat,Number,Array,String,window:{}};
const M=new Function(...Object.keys(ctx),pure+`return {derive,evaluate,prescribe,nightProfile,resolveNight,
  nightWindows,nightsBounds,planNights,bestStart,exposurePlan,subPlan,subExposure,
  ninaSequence,ninaCheck,mountRms,effFWHM,synthTarget,framing,mosaicPanels,fmt};`)(...Object.values(ctx));

const [,,qRaw,hRaw,nRaw,preset,binRaw,dateRaw,rotRaw]=process.argv;
if(!qRaw){ console.log('uso: node plan.js <oggetto> <ore> <notti> [preset] [bin] [AAAA-MM-GG] [rotazione]\n'+
  '     MODE=progetto per l\'ottimizzazione multi-notte (default: sessione completa)'); process.exit(1); }
const MODE=process.env.MODE==='progetto'?'progetto':'sessione';
const hours=parseFloat(hRaw||'12'), N=Math.round(parseFloat(nRaw||'3'));
const P=DB.presets.find(p=>p.id===(preset||'rc8_red_cem70'))||DB.presets[0];
const bin=Math.max(1,Math.round(parseFloat(binRaw||'1')));
const date=dateRaw?new Date(dateRaw+'T12:00:00'):new Date();
const rot=rotRaw!=null?+rotRaw:0;

const nrm=x=>String(x).toLowerCase().replace(/[\s_'’-]+/g,'');
let t=TG.targets.find(x=>x.names.some(n=>nrm(n)===nrm(qRaw)));
if(!t){ const c=CATJ.objects.find(o=>nrm(o.name)===nrm(qRaw)||(o.aliases||[]).some(a=>nrm(a)===nrm(qRaw)));
  if(c) t=M.synthTarget(c,c.archetype); }
if(!t){ console.log('oggetto non trovato:',qRaw); process.exit(1); }

const S=DB.sites.find(s=>s.id===P.site)||DB.sites[0];
const dv=M.derive({tel:P.telescope,red:P.reducer,cam:P.camera,mnt:P.mount,bin});
const site={lat:S.lat_deg,lon:S.lon_deg,sqm:S.sqm_zenith,seeing:S.seeing_typ_arcsec,
  horizonMin:Math.min(...Object.values(S.horizon).filter(v=>typeof v==='number')),
  clearFrac:S.clear_night_fraction};
site.rms=M.mountRms(P.mount,dv.scale); site.fwhm=M.effFWHM(site.seeing,site.rms);
/* La data e una RICHIESTA: si risolve nella prima notte in cui l'oggetto esiste
   davvero, e da li in giu vale quella. Calcolare le ore su una notte in cui
   l'oggetto non sale, e poi pianificare su altre, erano due catene separate. */
const RN=M.resolveNight(t,site,date,{});
const notte=RN.usable===false?date:RN.date;
const np=M.nightProfile(notte,site.lat,site.lon);
const e=M.evaluate(t,dv,site,np,{});
const pr=M.prescribe(e,hours,dv);
const mos=M.mosaicPanels(t,dv,undefined,rot), panels=Math.max(1,mos.cols*mos.rows);
const H=s=>console.log('\n\x1b[1m'+s+'\x1b[0m');
const f=(x,n=1)=>M.fmt(x,n);

console.log(`\n\x1b[1m${t.names[0]}\x1b[0m — ${P.label}, bin ${bin}, ${S.name}`);
if(RN.past>0)
  console.log(`\x1b[33m   la notte chiesta e passata da ${RN.past} giorn${RN.past===1?'o':'i'}: `
    +`i conti valgono come analisi, non come piano.\x1b[0m`);
if(RN.shift>0)
  console.log(`\x1b[33m   notte spostata: il ${RN.wanted.toLocaleDateString('it-IT')} l'oggetto da qui non e `
    +`utilizzabile (${RN.skipped[0].why}).\n   Prima notte vera: ${RN.date.toLocaleDateString('it-IT')}, `
    +`+${RN.shift} giorni, ${RN.skipped.length} notti scartate. Tutto quanto segue e di QUELLA notte.\x1b[0m`);
if(RN.usable===false)
  console.log(`\x1b[31m   da qui l'oggetto non supera mai i ${Math.round(RN.floor)}° per almeno `
    +`${M.fmt(RN.minNight,1)} h nelle prossime ${RN.scanned} notti: non c'e stagione.\x1b[0m`);
console.log(`${dv.F} mm f/${f(dv.fRatio)} · ${f(dv.scale,2)}"/px · FWHM ${f(site.fwhm,2)}" · SQM ${f(site.sqm)}`);
console.log(`notte ${notte.toLocaleDateString('it-IT')}${RN.shift>0?' (chiesta '+RN.wanted.toLocaleDateString('it-IT')+')':''} · ${hours} h richieste su ${N} notti`);

H('1 · PRESCRIZIONE (non la tocca il pianificatore)');
console.log(`   livello ${pr.level} · strada ${pr.road.id} · spese ${f(pr.spent,2)} h di ${hours}`);
pr.alloc.filter(g=>g.hours>0).forEach(g=>console.log(
  `   ${g.id.padEnd(8)} ${f(g.hours,2).padStart(6)} h${g.critical?'   ← canale critico':''}`));
if(panels>1) console.log(`   mosaico ${mos.cols}×${mos.rows}: il progetto intero costa ${f(pr.spent*panels,1)} h`);

H('2 · FINESTRE REALI, notte per notte');
const b=M.nightsBounds(pr,t,site,date,{panels});
b.windows.nights.slice(0,Math.max(N,6)).forEach(x=>console.log(
  `   ${x.date.toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'})}  `+
  `notte ${f(x.clockH)} h → utili ${f(x.availH)} h  alt.max ${f(x.maxAlt,0)}°  `+
  `Luna ${String(Math.round(x.moonK*100)).padStart(3)}% su ${Math.round(x.moonUpFrac*100)}% della finestra, +${f(x.dMagV,2)} mag`));
b.windows.skipped.slice(0,3).forEach(x=>console.log(`   [saltata] ${x.date.toLocaleDateString('it-IT')} — ${x.why}`));
console.log(`   overhead tolto: ${f(b.windows.overhead)} h a notte · soglia di altezza ${b.windows.floor}° (canale ${b.windows.critBand})`);

H('3 · GUARDIA');
console.log(`   notti ammesse: da ${b.min} a ${b.max}   (servono ${f(b.need,1)} h, le prime ${b.windows.nights.length} notti ne offrono ${f(b.capacity,0)})`);
const expo0=M.exposurePlan(pr,dv,site,{panels,archetype:t.archetype,tg:t});
const pl=M.planNights(pr,e,dv,N,{site,date:notte,panels,expo:expo0,mode:MODE});
if(!pl.ok){ console.log(`   \x1b[31mRIFIUTATO (${pl.reason.code})\x1b[0m ${pl.reason.msg}`); process.exit(0); }
console.log(`   ${N} notti: dentro l'intervallo`);
const bs=M.bestStart(t,dv,site,date,N,{});
if(bs) console.log(`   \x1b[33mpartendo dal ${bs.date.toLocaleDateString('it-IT')} le stesse ${N} notti renderebbero ${f(bs.gain,2)}× sul ${bs.critBand}\x1b[0m`);

H('4 · POSA (decisa una volta sul totale, prima del piano)');
const expo=expo0;
/* __modes e __hdr sono chiavi di servizio della mappa, non bande: la mappa le
   porta accanto alle pose e vanno saltate entrambe. Saltarne una sola faceva
   fallire questo strumento su ogni target con archetipo HDR. */
Object.keys(expo).filter(k=>k!=='__modes'&&k!=='__hdr').forEach(k=>{const x=expo[k],ex=x.ex;
  console.log(`   ${k.padEnd(5)} ${String(ex.sec).padStart(4)} s  gain ${String(ex.gm.gain).padEnd(4)} bin ${dv.bin}  `+
    `${String(Math.round(x.totalH*3600/ex.sec)).padStart(4)} pose  vincolo ${ex.binding.padEnd(22)} `+
    `resa ${String(Math.round(ex.eff*100)).padStart(3)}%  satura oltre V ${f(ex.magSafe)}`);});
Object.values(expo.__modes||{}).forEach(m=>console.log(`   modo ${m.mode.name} (gain ${m.mode.gain}) su ${m.bands.join('/')}: ${m.why}`));
/* La serie corta fa parte del piano, quindi si dichiara. Nessun calcolo qui:
   si stampa quello che exposurePlan() ha gia' messo in __hdr. */
if(expo.__hdr){ const h=expo.__hdr;
  console.log(`   serie corta ${h.sec} s x ${h.n} su ${h.bands.join('/')} = ${f(h.hours,2)} h,`+
    ` sottratta al canale ${h.group} della prima notte${h.why?' — '+h.why:''}`); }

H('5 · PIANO — modalita '+(MODE==='sessione'?'SESSIONE COMPLETA (ogni notte autonoma)':'OTTIMIZZAZIONE SUL PROGETTO'));
let tot=0;
pl.nights.forEach(x=>{
  const sp=M.subPlan(x.blocks,expo,{}); tot+=x.usedH;
  console.log(`   NOTTE ${x.n} · ${x.date.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})} · ${f(x.availH)} h disponibili · ${x.sky}`);
  const byG={}; sp.subs.forEach(u=>(byG[u.group]=byG[u.group]||[]).push(u));
  x.blocks.forEach(bl=>{
    const us=byG[bl.id]||[];
    console.log(`      ${bl.id.padEnd(8)} ${f(bl.h,2).padStart(5)} h   `+
      us.map(u=>`${u.band} ${u.sec} s × ${u.n}`).join('  ·  ')+
      `   = ${f(us.reduce((a,u)=>a+u.realH,0),2)} h`);
  });
  console.log(`      totale ${f(x.usedH,2)} h integrazione · ${f(sp.clockH,2)} h di orologio · ${f(x.idleH,1)} h non usate\n`);
});
console.log(`   somma del piano ${f(tot,2)} h  ·  prescrizione ${f(pr.spent*panels,2)} h  ·  ${Math.abs(tot-pr.spent*panels)<0.01?'\x1b[32mcoincidono\x1b[0m':'\x1b[31mDISALLINEATE\x1b[0m'}`);

H('6 · EXPORT');
const sp1=M.subPlan(pl.nights[0].blocks,expo,{});
const OFF={du:+(process.env.OFFU||0),dv:+(process.env.OFFV||0)};
const root=M.ninaSequence({n:1,subs:sp1.subs},pl,t,dv,site,{rot,off:OFF,hasRotator:rot!==0});
const chk=M.ninaCheck(root);
console.log(`   notte 1 → ${chk.ids} nodi, ${chk.refs} riferimenti, ${sp1.subs.length} Smart Exposure, `+
  `PA ${rot}° — ${chk.ok?'\x1b[32mintegro\x1b[0m':'\x1b[31mROTTO\x1b[0m'}`);
if(process.env.WRITE){ fs.writeFileSync(process.env.WRITE,JSON.stringify(root,null,2));
  console.log('   scritto in',process.env.WRITE); }
console.log();
