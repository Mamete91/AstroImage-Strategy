#!/usr/bin/env node
/* Modalità diagnostica del motore di prescrizione.
   Non è un test: è un tracciato. Prende un oggetto, una configurazione e un budget
   di ore e stampa OGNI passaggio che porta dalle soglie di scheda alle ore per
   canale, dicendo per ciascun numero DA DOVE VIENE.

   Serve a due cose: verificare che la logica sia coerente, e — quando arriveranno
   le integrazioni reali — poter dire quale passaggio ha sbagliato.

   uso:  node diag.js [oggetto] [ore] [preset] [bin]
   es.:  node diag.js M31 14.5 tec_red_am5 1
*/
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const pure=html.split('<script>')[1].split('</script>')[0]
  .split('/* =====================================================================\n   UI')[0];
const DB=JSON.parse(fs.readFileSync(__dirname+'/data/setups.json','utf8'));
const TG=JSON.parse(fs.readFileSync(__dirname+'/data/targets.json','utf8'));
const CAT=JSON.parse(fs.readFileSync(__dirname+'/data/catalog.json','utf8'));
const CIT=JSON.parse(fs.readFileSync(__dirname+'/data/cities.json','utf8'));
/* Anche il tracciato deve vedere tutto il catalogo, non solo i 169 curati: un oggetto
   che arriva da OpenNGC passa per lo stesso motore e va potuto tracciare uguale. */
const ONGCP=__dirname+'/data/openngc.json';
const ONGC=fs.existsSync(ONGCP)?JSON.parse(fs.readFileSync(ONGCP,'utf8')):null;
const nrm=x=>String(x).toLowerCase().replace(/[\s_'\u2019-]+/g,'');
if(ONGC){
  const seen=new Set();
  for(const o of CAT.objects){ seen.add(nrm(o.name)); (o.aliases||[]).forEach(a=>seen.add(nrm(a))); }
  for(const a of ONGC.objects){
    if(seen.has(nrm(a[0]))||(a[10]||[]).some(x=>seen.has(nrm(x)))) continue;
    CAT.objects.push({name:a[0],ra_deg:a[1],dec_deg:a[2],size_arcmin:[a[3],a[4]],
      constellation:a[5],type:a[6],archetype:a[7],archetype_confidence:a[8],
      mag:a[9],aliases:a[10]||[],why:a[11],tier:'openngc'});
  }
}
const OWNED=DB.default_filters.slice();
const ctx={DB,TG,CAT:CAT.objects,CITIES:CIT.cities,OWNED,console,Math,Date,Object,JSON,
  isFinite,parseFloat,parseInt,Number,window:{}};
const M=new Function(...Object.keys(ctx),pure+`return {derive,refCfg,timeFactor,qeAt,
  samplingVerdict,framing,nightProfile,effFWHM,evaluate,prescribe,synthTarget,
  rates,varRate,factorValidated,refCfg,
  roadChannels,roadSum,costGroups,accessibleH,moonPenalty,lpPenalty,filterFor,
  dualPass,BAND_LAMBDA,BB_NM,leakOf,kExt,mosaicPanels,binAdvice,expectFor};`)
  (...Object.values(ctx));

const arg=(i,d)=>process.argv[2+i]!==undefined?process.argv[2+i]:d;
const NAME=arg(0,'M31'), HOURS=parseFloat(arg(1,'14.5')),
      PRESET=arg(2,'tec_red_am5'), BIN=parseInt(arg(3,'1'),10);

let tg=TG.targets.find(t=>t.names.some(n=>nrm(n)===nrm(NAME)));
let source='scheda curata', catObj=null;
if(!tg){
  const o=CAT.objects.find(x=>nrm(x.name)===nrm(NAME)||(x.aliases||[]).some(a=>nrm(a)===nrm(NAME)));
  if(!o){ console.error('oggetto non trovato: '+NAME); process.exit(1); }
  if(!o.archetype){ console.error(`${o.name} è classificato «${o.type}»: non è un oggetto deep-sky esteso, il motore non ha niente da prescrivergli.`); process.exit(1); }
  catObj=o; tg=M.synthTarget(o);
  const conf=o.archetype_confidence||'curato';
  const why=(o.why&&ONGC&&ONGC.reasons[o.why[0]])
    ? (o.why[1]!=null?ONGC.reasons[o.why[0]].replace('%s',o.why[1]):ONGC.reasons[o.why[0]]) : '';
  source = o.tier==='openngc'
    ? `catalogo OpenNGC + archetipo — certezza ${conf}`
    : 'catalogo curato + archetipo';
  if(why) source+=`\n              ${why}`;
}
const p=DB.presets.find(x=>x.id===PRESET)||DB.presets[0];
const cfg={tel:p.telescope,red:p.reducer,cam:p.camera,mnt:p.mount,bin:BIN};
const dv=M.derive(cfg);
const s0=DB.sites[0];
const mnt=DB.mounts.find(x=>x.id===p.mount);
const rms=(dv.scale0<0.8?mnt.rms_long_fl_arcsec:mnt.rms_typ_arcsec)||0.8;
const site={lat:s0.lat_deg,lon:s0.lon_deg,sqm:s0.sqm_zenith,seeing:s0.seeing_typ_arcsec,rms,
  horizonMin:Math.min(...Object.values(s0.horizon).filter(v=>typeof v==='number')),
  clearFrac:s0.clear_night_fraction};
site.fwhm=M.effFWHM(site.seeing,site.rms);
const np=M.nightProfile(new Date(), site.lat, site.lon);
const e=M.evaluate(tg,dv,site,np,{});
const pr=M.prescribe(e,HOURS,dv);

const f=(x,n=2)=>(x==null||!isFinite(x))?'—':Number(x).toFixed(n);
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(t.length));
const row=(...c)=>console.log('  '+c.join(''));

console.log(`\n\x1b[1m═══ TRACCIATO DEL MOTORE ═══\x1b[0m`);
console.log(`  oggetto     ${tg.names[0]}  (${source})`);
console.log(`  archetipo   ${tg.archetype} — ${TG.archetypes[tg.archetype].label}`);
console.log(`  config      ${p.label}${BIN>1?'  bin '+BIN:''}`);
console.log(`  sito        ${s0.name}   budget richiesto ${f(HOURS,1)} h`);

/* ---------------------------------------------------------------- 1 */
H('1 · DA DOVE VENGONO I NUMERI');
row('Le soglie per canale sono scritte a mano nella scheda dell\'oggetto (o, per un');
row('oggetto senza scheda, ereditate dal budget tipico dell\'archetipo). Sono espresse');
row('in ore PER LA CONFIGURAZIONE DI RIFERIMENTO, mai per la tua.');
const rc=DB.reference_config;
const rt=DB.telescopes.find(x=>x.id===rc.telescope), rcam=DB.cameras.find(x=>x.id===rc.camera);
const rdv=M.derive({tel:rc.telescope,red:rc.reducer,cam:rc.camera});
console.log('');
row(`riferimento: ${rt.name} ${rc.reducer}x + ${rcam.name}`);
row(`             ${rdv.F} mm  f/${f(rdv.fRatio,1)}  pixel ${rcam.pixel_um} µm  scala ${f(rdv.scale)}"/px  bin 1`);
console.log('');
console.log('  canale   soglia   utile   satura   quota   critico   nota');
for(const [b,v] of Object.entries(tg.budget)){
  row(b.padEnd(8),String(v.floor).padStart(6),String(v.useful).padStart(8),
      String(v.saturates||0).padStart(9),String(v.share??'—').padStart(8),
      (v.critical?'   sì   ':'   —    '),'  '+(v.note||v.road?('road:'+v.road):'').slice(0,46));
}

/* ---------------------------------------------------------------- 2 */
H('2 · IL RAPPORTO FRA I CANALI — chi decide quanto');
row('Non c\'è una formula che calcola i rapporti: sono SCRITTI nella scheda, uno per');
row('uno, come soglia+utile. La "quota" (share) NON divide le ore — serve solo a');
row('stabilire l\'ordine di priorità quando le ore non bastano per tutti.');
row('Il rapporto effettivo fra i canali è quindi  utile(A) : utile(B).');
console.log('');
const withU=Object.entries(tg.budget).filter(([,v])=>v.useful>0);
const maxU=Math.max(...withU.map(([,v])=>v.useful));
for(const [b,v] of withU)
  row(b.padEnd(6),`utile ${String(v.useful).padStart(5)} h  →  `,
      '█'.repeat(Math.round(24*v.useful/maxU)).padEnd(25),
      `${f(v.useful/maxU*100,0)}% del canale più lungo`);
console.log('');
const crit=Object.entries(tg.budget).find(([,v])=>v.critical);
row(`canale critico dichiarato: \x1b[1m${crit?crit[0]:'—'}\x1b[0m — è quello che decide se l'immagine`);
row('riesce, ed è l\'unico che riceve un trattamento diverso: priorità nel finanziamento,');
row('taglio più leggero nella versione ridotta (60% invece di 40%), peso 1.35 nel');
row('riempimento verso l\'utile.');

/* ---------------------------------------------------------------- 3 */
H('3 · DALLA CONFIGURAZIONE DI RIFERIMENTO ALLA TUA');
row('METRICA DICHIARATA: SNR per unità di angolo solido di cielo (per arcsec²),');
row('al cielo di riferimento. La scala scelta si semplifica nel rapporto: nessun');
row('parametro libero. Cielo reale e Luna entrano altrove, come fattori a parte.');
console.log('');
row('  fattore = [ V̇ / (A·k)² ]_tuo  /  [ V̇ / (A·k)² ]_rif');
row('  A·k = A_eff · QE(λ) · T_filtro · f_CFA        fotoni da un arcsec² — NON dipende dalla focale');
row('  V̇   = s + cielo + buio/Ω_px + RN²/(Ω_px·t_posa)      varianza per arcsec² al secondo');
console.log('');
row('  Buio e lettura sono PER PIXEL: divisi per Ω_px crescono con il quadrato della');
row('  focale. È lì, e solo lì, che il rapporto focale entra su una sorgente estesa.');
row('  Il rumore di lettura si paga PER LETTURA e non si integra nel tempo: da qui il');
row('  tasso RN²/t_posa, e da qui il fatto che IL FATTORE DIPENDE DALLA POSA.');
row('  Forma pubblicata da ESO (Hainaut), STScI (WFC3 IHB 9.6) e Rubin (SMTN-002).');
console.log('');
row(`A_eff riferimento ${f(rdv.Aeff,0)} mm²   ·  tuo ${f(dv.Aeff,0)} mm²`);
row(`Ω_px  riferimento ${f(Math.pow(rdv.scale,2),4)} arcsec²/px  ·  tuo ${f(Math.pow(dv.scale,2),4)} arcsec²/px`);
row(`\x1b[2mil rapporto delle aree di pixel vale ×${f(Math.pow(rdv.scale,2)/Math.pow(dv.scale,2))}: fino al 2026-09 entrava nel`);
row(`tempo come se fossero fotoni persi. Non lo sono — è campionamento.\x1b[0m`);
console.log('');
console.log('  banda   λ nm   QE rif   QE tuo    CFA   posa   A·k tuo    V̇ tuo   fattore   stato');
for(const [b,v] of Object.entries(tg.budget)){
  if(!(v.useful>0)) continue;
  const ts=(e.tsub||{})[b]||600;
  const rr=M.rates(dv,b,M.refCfg().sqm);
  const qr=M.qeAt(rdv.c,rr.lam), qt=M.qeAt(dv.c,rr.lam);
  const ft=M.timeFactor(dv,b,ts);
  row(b.padEnd(8),f(rr.lam,1).padStart(5),f(qr,3).padStart(8),f(qt,3).padStart(8),
      (f(rr.cfa,2)+(rr.osc<1?'×'+f(rr.osc,2):'')).padStart(7),(ts+'s').padStart(7),
      f(rr.collect,1).padStart(8),f(M.varRate(rr,ts,0),5).padStart(9),
      ('×'+f(ft)).padStart(9),
      '   '+(rr.validated?'validato':'\x1b[33mNON VALIDATO (OSC banda larga)\x1b[0m'));
}
console.log('');
row('Le tre grandezze che non vanno confuse:');
row(`  illuminamento per pixel   segue 1/f²·τ    rif f/${f(rdv.fRatio,2)} τ${f(rdv.thru,2)}  ·  tuo f/${f(dv.fRatio,2)} τ${f(dv.thru,2)}`);
row(`  raccolta per arcsec²      segue A·QE·T·CFA  rif ${f(M.rates(rdv,e.critBand,M.refCfg().sqm).collect,1)}  ·  tuo ${f(M.rates(dv,e.critBand,M.refCfg().sqm).collect,1)}`);
row(`  campionamento             focale, pixel, bin  rif ${f(rdv.scale,3)}"/px  ·  tuo ${f(dv.scale,3)}"/px`);
row('Il binning non compare nel fattore: RN cresce come il lato, Ω_px come il quadrato.');

/* ---------------------------------------------------------------- 4 */
H('4 · SOGLIE RISCALATE + LIVELLO RIDOTTO');
row('accessibile = max( soglia , k × utile )     k = 0.60 sul critico, 0.40 sugli altri');
console.log('');
console.log('  canale   fattore    soglia      utile     satura    ridotto   ridotto=soglia?');
for(const [b,v] of Object.entries(e.budget)){
  if(!(v.useful>0)) continue;
  row(b.padEnd(8),('×'+f(v.factor)).padStart(7),f(v.floor).padStart(10),f(v.useful).padStart(11),
      f(v.saturates).padStart(10),f(v.accessible).padStart(10),
      (v.accessible<=v.floor*1.02?'      sì (non tagliabile)':'      no'));
}

/* ---------------------------------------------------------------- 5 */
H('5 · SCELTA DELLA STRADA');
row('I canali di una strada = quelli senza vincolo + quelli che dichiarano road:<id>.');
row('Si sceglie la strada più ambiziosa che sta dentro il budget richiesto.');
console.log('');
console.log('  strada                              canali            pieno   ridotto   minimo   distinta');
for(const r of pr.roads.concat(pr.alt)){
  const parts=M.roadChannels(e.budget,r.r.id);
  row(String(r.r.id+' · '+r.r.name).slice(0,34).padEnd(36),
      Object.keys(parts).join('+').padEnd(18),
      f(r.ideal,1).padStart(6),f(r.acc,1).padStart(9),f(r.floor,1).padStart(8),
      r.distinct?'     sì':'     no (stesso costo)');
}
console.log('');
row(`budget richiesto ${f(HOURS,1)} h  →  scelta: \x1b[1m${pr.road.id}\x1b[0m`);
row(`regola: primo dei tre confronti che passa — ore ≥ pieno, poi ≥ ridotto, poi ≥ minimo;`);
row(`se nessuno passa, si tiene la strada più economica e il livello lo decide il riempimento.`);

/* ---------------------------------------------------------------- 6 */
H('6 · RIEMPIMENTO — come le ore diventano ore per canale');
const groups=M.costGroups(M.roadChannels(e.budget,pr.road.id),e.dual);
const pri=groups.slice().sort((a,b)=>((b.critical?1:0)-(a.critical?1:0))||((b.share||0)-(a.share||0))||(a.floor-b.floor));
row('FASE 1 — tutti alla soglia, in ordine di priorità (critico, poi quota, poi costo).');
row('         Un gruppo che non ci arriva resta a ZERO: non si finanzia a rate.');
console.log('');
let left=HOURS; const got={};
console.log('  ordine  gruppo      soglia    residuo prima → dopo    esito');
pri.forEach((g,i)=>{
  const before=left;
  let ok=false;
  if(g.floor<=0){ got[g.id]=0; ok=null; }
  else if(left>=g.floor-1e-9){ got[g.id]=g.floor; left-=g.floor; ok=true; }
  else { got[g.id]=0; ok=false; }
  row(String(i+1).padStart(6),'  '+g.id.padEnd(11),f(g.floor).padStart(7),
      '   '+f(before,1).padStart(6)+' → '+f(left,1).padStart(6),
      ok===null?'    (canale vuoto)':ok?'      finanziato':'      \x1b[31mSCARTATO\x1b[0m');
});
console.log('');
row(`FASE 2 — le ${f(left,2)} h restanti vanno a passi piccoli al gruppo più indietro`);
row('         rispetto al proprio UTILE, con il critico pesato ×1.35. Quando tutti');
row('         hanno raggiunto l\'utile, l\'eventuale surplus va verso la saturazione');
row('         senza pesi — così a budget esatto nessuno sfonda il proprio utile.');
console.log('');
console.log('  gruppo      finale     soglia     utile    satura    posizione');
for(const g of pr.alloc){
  const pos=g.dropped?'\x1b[31mfuori\x1b[0m'
    :g.hours>=g.sat-0.01?'alla saturazione'
    :g.hours>=g.useful-0.01?'oltre l\'utile'
    :g.hours>=g.useful*0.99?'all\'utile'
    :g.hours>g.floor*1.02?`al ${f(100*(g.hours-g.floor)/Math.max(1e-6,g.useful-g.floor),0)}% fra soglia e utile`
    :'alla soglia';
  row(g.id.padEnd(11),f(g.hours,2).padStart(7),f(g.floor).padStart(10),f(g.useful).padStart(10),
      f(g.sat).padStart(9),'   '+pos);
}
console.log('');
row(`totale speso ${f(pr.spent,2)} h su ${f(HOURS,1)} h richieste`+
    (pr.unused>0.05?`  ·  \x1b[33m${f(pr.unused,2)} h non spese (saturazione raggiunta)\x1b[0m`:''));

/* ---------------------------------------------------------------- 7 */
H('7 · LIVELLO — cosa lo fa scattare');
row('Il livello NON è deciso prima: è l\'esito del riempimento.');
console.log('');
const dropped=pr.alloc.filter(g=>g.dropped).map(g=>g.id);
const critG=pr.critGroup;
const tests=[
  ['insufficiente', `il gruppo critico (${critG}) non raggiunge la soglia`, dropped.includes(critG)],
  ['parziale',      `almeno un gruppo resta fuori  [${dropped.join(', ')||'nessuno'}]`, !dropped.includes(critG)&&dropped.length>0],
  ['pieno',         `ore ≥ costo pieno della strada (${f(pr.roadTotals.ideal,1)} h)`, !dropped.length&&HOURS>=pr.roadTotals.ideal-1e-9],
  ['ridotto',       `ore ≥ costo ridotto (${f(pr.roadTotals.acc,1)} h)`, !dropped.length&&HOURS<pr.roadTotals.ideal-1e-9&&HOURS>=pr.roadTotals.acc-1e-9],
  ['minimo',        `ore ≥ somma delle soglie (${f(pr.roadTotals.floor,1)} h)`, !dropped.length&&HOURS<pr.roadTotals.acc-1e-9]
];
for(const [k,why,hit] of tests)
  row(hit?'\x1b[1m→ ':'  ',k.padEnd(15),hit?'\x1b[1m':'\x1b[2m',why,'\x1b[0m');
console.log('');
row(`esito: \x1b[1m${pr.level}\x1b[0m`);

/* ---------------------------------------------------------------- 8 */
H('8 · COSA NON ENTRA NELLE ORE PER CANALE');
row('Questa è la parte che si dà per scontata e non lo è.');
console.log('');
row(`\x1b[1mSEEING (${f(site.seeing)}") e GUIDA (${f(site.rms)}") → FWHM reale ${f(site.fwhm)}"\x1b[0m`);
row('  NON entrano nelle ore. E fisicamente è corretto: su un oggetto ESTESO la');
row('  brillanza superficiale per pixel non dipende dal seeing — la turbolenza');
row('  ridistribuisce i fotoni localmente, non ne toglie. Il seeing limita il');
row('  DETTAGLIO risolvibile, non l\'SNR per pixel.');
const samp=M.samplingVerdict(dv.scale,site.fwhm);
row(`  Entrano invece in: campionamento (${f(dv.scale)}"/px → ${samp.k}), consiglio di`);
row(`  binning, e punteggio di resa. Non nel budget.`);
console.log('');
row(`\x1b[1mBINNING (${dv.bin}×${dv.bin})\x1b[0m`);
row(`  Entra eccome, ma per una via sola: pixel effettivo ${dv.pixel} µm → sigRate ∝ pixel²`);
row(`  → tutte le soglie divise per ${dv.bin*dv.bin}. Non c'è nessun altro punto in cui tocchi le ore.`);
console.log('');
const mi=e.moonIllum;
row(`\x1b[1mLUNA (${Math.round(mi.k*100)}%, alta ${f(e.moonAlt,0)}°, a ${f(e.rho,0)}° dal target)\x1b[0m`);
row(`  NON entra nelle ore per canale. Scelta deliberata: il budget è STRATEGICO,`);
row(`  misurato su settimane, e il ciclo lunare si media da solo — il novilunio torna.`);
row(`  Entra in: finestra efficace di stanotte (×${f(e.moonF)} sul canale critico),`);
row(`  punteggio, e nota per canale nella prescrizione. Non nel budget.`);
console.log('');
row(`\x1b[1mINQUINAMENTO LUMINOSO (SQM ${f(site.sqm,1)})\x1b[0m`);
row(`  NON entra nelle ore per canale, ma SÌ nel calendario: perNight = critH × lpF`);
row(`  (×${f(e.lpF)} sul canale critico). L'IL non si media: c'è tutte le notti.`);

/* ---------------------------------------------------------------- 9 */
H('9 · DA ORE A CALENDARIO');
row(`finestra del canale critico (${e.critBand}) sopra ${e.critFloor}°:  ${f(e.critH,2)} h stanotte`);
row(`penalità IL sul critico: ×${f(e.lpF)}   →  ore utili per notte  ${f(e.perNight,2)} h`);
row(`   (limitate anche dal buio astronomico disponibile: ${f(np.darkH,2)} h)`);
row(`notti necessarie = ${f(pr.spent,2)} / ${f(e.perNight,2)} = ${f(pr.nights,1)}`);
row(`settimane = notti / (7 × ${f(site.clearFrac,2)} notti serene) = ${f(pr.weeks,1)}`);

/* ---------------------------------------------------------------- 10 */
H('10 · COSA ASPETTARTI — la riga scelta e perché');
const ftc=M.timeFactor(dv,e.critBand);
row(`le voci di expect sono scritte per il riferimento, quindi le ore spese`);
row(`vengono riportate lì: ${f(pr.spent,2)} h ÷ ×${f(ftc)} = ${f(pr.spent/ftc,2)} h equivalenti`);
console.log('');
for(const [k,v] of Object.entries(tg.expect)){
  const sel=pr.expect&&pr.expect.key===k;
  row(sel?'\x1b[1m→ ':'  ',k.padEnd(6),sel?'':'\x1b[2m',v.slice(0,92),'\x1b[0m');
}
console.log('');
