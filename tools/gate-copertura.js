#!/usr/bin/env node
/* GATE COPERTURA — la catena che lega il soggetto alla fattibilita' del progetto.
   Non modifica nulla.   node tools/gate-copertura.js

   IL DIFETTO CHE QUESTO GATE PRESIDIA
   La profondita' fotometrica e' una proprieta' del SINGOLO CAMPO: le ore per
   canale dicono quanto posare su un pezzo di cielo grande quanto il sensore.
   Il progetto pero' e' il SOGGETTO INTERO. Finche' prescribe() confrontava le
   ore disponibili con il budget di un campo, un soggetto piu' largo del sensore
   riceveva un verdetto che valeva per un ventiquattresimo di se stesso: sul Velo
   un RC8 leggeva «progetto pieno» con sedici ore mentre l'oggetto intero ne
   chiedeva duecentoquarantasette.

   LA REGOLA, che vale per ogni bersaglio e ogni ottica senza eccezioni:
     ore per pannello = ore disponibili / pannelli
   Il budget non si moltiplica — resta la grandezza fotometrica che era — sono le
   ore disponibili che si dividono. Quando il soggetto sta in un campo `panels`
   vale 1 e non cambia niente: e' la geometria a decidere, non una regola scritta
   su misura per un oggetto.

   LE QUATTRO GRANDEZZE RESTANO DISTINTE, ed e' quello che il gate verifica:
     fotometria   il budget riscalato da timeFactor, per campo
     campionamento  la scala del pixel, che il binning muove e la copertura no
     geometria    i pannelli, da mosaicPanels() sull'ingombro reale
     operativita' le ore realmente disponibili nelle notti                     */

const path=require('path');
const {M,DB,TG,CAT}=require(path.join(__dirname,'lib','engine.js'));

let pass=0, fail=0;
const G=(s,n)=>String(s).padEnd(n);
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(Math.min(t.length,78)));
function chk(name,ok,note){
  console.log('  '+(ok?'\x1b[32mOK  \x1b[0m':'\x1b[31mFAIL\x1b[0m')+' '+G(name,58)+(note!==undefined?'  '+note:''));
  ok?pass++:fail++;
}

const site={lat:46.0167,lon:10.3333,sqm:20.8,seeing:1.6,rms:0.6,horizonMin:20,clearFrac:0.35};
site.fwhm=M.effFWHM(site.seeing,site.rms);
const np=M.nightProfile(new Date(2026,8,15,12,0,0),site.lat,site.lon);

const dv=c=>M.derive(c);
const cfg=(tel,red,cam,bin)=>({tel,red,cam,mnt:'cem70g',bin:bin||1});
const tgt=nm=>{
  const t=TG.targets.find(x=>x.names.includes(nm));
  if(t) return t;
  const c=CAT.objects.find(o=>o.name===nm||(o.aliases||[]).includes(nm));
  return c&&c.archetype?M.synthTarget(c,c.archetype):null;
};
const pan=(t,d)=>{const m=M.mosaicPanels(t,d); return m.cols*m.rows;};
const run=(t,d,h)=>{const e=M.evaluate(t,d,site,np,{}); return {e,pr:M.prescribe(e,h,d)};};

/* ═══ A · un soggetto che sta in un campo non deve cambiare di una virgola ═══
   E' la garanzia di non-regressione: la stragrande maggioranza dei bersagli sta
   in un campo, e per loro la nuova regola deve essere invisibile. */
H('A · nessuna regressione dove il mosaico non serve');
const REF=dv(cfg('tecnosky115',0.80,'asi2600mm'));
for(const nm of ['NGC 6888','M56','M27','NGC 7635']){
  const t=tgt(nm); if(!t){ chk(`${nm} presente`,false); continue; }
  const p=pan(t,REF);
  const e=M.evaluate(t,REF,site,np,{});
  const conCop=M.prescribe(e,12,REF);          // copertura automatica
  const unCampo=M.prescribe(e,12,REF,1);       // forzata a un campo
  chk(`${nm}: un solo campo`, p===1, `${p} pannello/i · ${JSON.stringify(t.size_arcmin)}`);
  chk(`${nm}: verdetto identico al calcolo per campo`,
      conCop.level===unCampo.level && Math.abs(conCop.spent-unCampo.spent)<1e-9,
      `${conCop.level} · ${conCop.spent.toFixed(2)} h`);
}

/* ═══ B · il soggetto esteso: pochi pannelli e molti pannelli ═══ */
H('B · la copertura cresce con la geometria, non con un moltiplicatore fisso');
{
  const casi=[['NGC 2237',2],['M31',6],['Velo',6]];
  for(const [nm,atteso] of casi){
    const t=tgt(nm); if(!t){ chk(`${nm} presente`,false); continue; }
    const p=pan(t,REF);
    chk(`${nm}: ${p} pannelli sulla configurazione di riferimento`, p===atteso,
        `${JSON.stringify(t.size_arcmin)}' contro ${REF.fovX.toFixed(0)}'x${REF.fovY.toFixed(0)}'`);
  }
  /* Il conto e' geometrico, non un fattore applicato a occhio: un soggetto due
     volte piu' largo non costa due volte, costa quanti campi servono a coprirlo. */
  const velo=tgt('Velo'), m56=tgt('M56');
  const rapArea=(velo.size_arcmin[0]*velo.size_arcmin[1])/(m56.size_arcmin[0]*m56.size_arcmin[1]);
  chk('il rapporto di area non e il rapporto di pannelli',
      Math.abs(rapArea-(pan(velo,REF)/pan(m56,REF)))>10,
      `aree ${rapArea.toFixed(0)}x contro pannelli ${(pan(velo,REF)/pan(m56,REF)).toFixed(0)}x`);
}

/* ═══ C · il caso che ha fatto emergere il difetto ═══
   Non e' la regola: e' il suo primo banco di prova. */
H('C · Velo: il verdetto guarda il soggetto intero');
{
  const velo=tgt('Velo');
  const sistemi=[
    ['Askar 71F 0.75x + MC ', dv({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1})],
    ['Tecnosky 115 0.80x MM', dv(cfg('tecnosky115',0.80,'asi2600mm'))],
    ['RC8 0.80x + MM       ', dv(cfg('rc8',0.80,'asi2600mm'))],
  ];
  console.log('     sistema                pannelli  ideale/campo  progetto  verdetto a 16 h');
  const out=[];
  for(const [lab,d] of sistemi){
    const {pr}=run(velo,d,16);
    const p=pr.panels;
    console.log(`     ${lab}  ${G(p,8)}  ${G(pr.roadTotals.ideal.toFixed(1)+' h',12)}  `+
                `${G(pr.roadTotalsProject.ideal.toFixed(0)+' h',8)}  ${pr.level}`);
    out.push({lab,p,pr});
  }
  const rc8=out.find(x=>/RC8/.test(x.lab)), ask=out.find(x=>/Askar/.test(x.lab));
  chk('l RC8 non e piu «progetto pieno» con sedici ore',
      rc8.pr.level!=='pieno', `dichiara: ${rc8.pr.level}`);
  chk('il progetto intero con l RC8 costa piu che con il 71F',
      rc8.pr.roadTotalsProject.ideal > ask.pr.roadTotalsProject.ideal,
      `${rc8.pr.roadTotalsProject.ideal.toFixed(0)} h contro ${ask.pr.roadTotalsProject.ideal.toFixed(0)} h`);
  chk('e l RC8 serve piu pannelli del 71F', rc8.p > ask.p, `${rc8.p} contro ${ask.p}`);
}

/* ═══ D · le quattro grandezze non si contaminano ═══ */
H('D · fotometria, campionamento, geometria e operativita restano distinte');
{
  const velo=tgt('Velo');
  /* Il binning muove il campionamento e NON la copertura: il campo inquadrato
     e' lo stesso pezzo di cielo, con meno pixel dentro. */
  const b1=dv(cfg('tecnosky115',0.80,'asi2600mm',1)), b2=dv(cfg('tecnosky115',0.80,'asi2600mm',2));
  chk('il binning raddoppia la scala del pixel', Math.abs(b2.scale/b1.scale-2)<1e-6,
      `${b1.scale.toFixed(2)}" -> ${b2.scale.toFixed(2)}"`);
  chk('ma non tocca il campo inquadrato', Math.abs(b2.fovX-b1.fovX)<1e-6,
      `${b1.fovX.toFixed(1)}' entrambi`);
  chk('quindi non tocca la copertura', pan(velo,b1)===pan(velo,b2),
      `${pan(velo,b1)} pannelli con e senza binning`);
  chk('ne le ore per canale', Math.abs(M.prescribe(M.evaluate(velo,b1,site,np,{}),16,b1,1).spent
                                     -M.prescribe(M.evaluate(velo,b2,site,np,{}),16,b2,1).spent)<1e-9);
  /* La focale muove il campo e quindi la copertura; l'apertura muove la
     fotometria e quindi le ore per campo. Sono due assi diversi. */
  const corto=dv({tel:'askar71f',red:1,cam:'asi2600mm',mnt:'am5',bin:1});
  const lungo=dv(cfg('rc8',1,'asi2600mm'));
  chk('focale corta -> meno pannelli', pan(velo,corto) < pan(velo,lungo),
      `${pan(velo,corto)} contro ${pan(velo,lungo)}`);
  const tfCorto=M.timeFactor(corto,'OIII',600), tfLungo=M.timeFactor(lungo,'OIII',600);
  chk('apertura grande -> meno ore per campo', tfLungo < tfCorto,
      `x${tfLungo.toFixed(2)} contro x${tfCorto.toFixed(2)}`);
  chk('i due assi si compensano invece di sommarsi',
      (pan(velo,corto)*tfCorto)/(pan(velo,lungo)*tfLungo) < 1,
      'il tubo corto vince sul progetto intero pur perdendo per campo');
}

/* ═══ E · nessun doppio conteggio ═══
   E' il rischio principale di una correzione come questa: la copertura deve
   entrare UNA volta sola, e timeFactor restare applicato UNA volta sola. */
H('E · la copertura entra una volta sola');
{
  const velo=tgt('Velo');
  const d=dv(cfg('rc8',0.80,'asi2600mm'));
  const e=M.evaluate(velo,d,site,np,{});
  const pr=M.prescribe(e,48,d);
  chk('spentTotal e esattamente spent x pannelli',
      Math.abs(pr.spentTotal-pr.spent*pr.panels)<1e-9,
      `${pr.spent.toFixed(2)} x ${pr.panels} = ${pr.spentTotal.toFixed(2)} h`);
  chk('e non supera mai le ore disponibili',
      pr.spentTotal<=pr.hoursTotal+1e-9, `${pr.spentTotal.toFixed(2)} <= ${pr.hoursTotal} h`);
  const b=M.nightsBounds(pr,velo,site,new Date(2026,8,15,12,0,0),{panels:pr.panels});
  chk('il pianificatore chiede lo stesso totale, non il doppio',
      Math.abs(b.need-pr.spentTotal)<1e-6, `need ${b.need.toFixed(2)} h`);
  /* Che cosa questa verifica difende: i fattori restano applicati UNA volta sola
     e la copertura non ci entra. I fattori sono due — l'ottica e il cielo — e il
     secondo e' arrivato dopo: la soglia di scheda vale al cielo di riferimento,
     e da SQM 20.8 un OIII costa `1/lpPenalty` volte tanto. I pannelli restano
     fuori da entrambi, ed e' quello il punto del gate. */
  const f=M.timeFactor(d,'OIII',(e.tsub||{}).OIII);
  const fl=M.filterFor('OIII',d.c);
  const sf=1/M.lpPenalty(site.sqm,fl?fl.fwhm_nm:250);
  const base=velo.budget.OIII.floor;
  chk('la soglia riscalata e soglia di scheda x ottica x cielo, senza pannelli',
      Math.abs(e.budget.OIII.floor-base*f*sf)<1e-6,
      `${base} x ${f.toFixed(3)} x ${sf.toFixed(3)} = ${e.budget.OIII.floor.toFixed(3)} h`);
}

/* ═══ F · le alternative si confrontano come sistemi completi ═══ */
H('F · fitAlternatives ragiona sul progetto, non sul campo');
{
  const velo=tgt('Velo');
  const cur={tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1};
  const alt=M.fitAlternatives?M.fitAlternatives(velo,cur,site,np,{},60,DB.presets,6,0):null;
  if(!alt){ chk('fitAlternatives esportata da lib/engine.js',false,'non esportata'); }
  else {
    console.log('     alternative proposte, in ordine:');
    alt.forEach((a,i)=>console.log(`       ${i+1}. ${G(a.preset.id,20)} bin ${a.bin} · `+
      `${G(a.panels+' pannelli',13)} intero ${a.projectH.toFixed(0)} h · ${a.pr.level}`));
    chk('ogni alternativa dichiara la propria copertura',
        alt.every(a=>a.panels>=1), `${alt.length} candidati`);
    chk('l ordine non peggiora sul costo del progetto',
        alt.every((a,i)=>i===0||alt[i-1].ok!==a.ok||alt[i-1].pr.level!==a.pr.level||alt[i-1].total<=a.total+1e-9),
        'a parita di campionamento e livello vince il progetto piu economico');
  }
}

/* ═══ G · mono contro OSC, a parita di tutto il resto ═══ */
H('G · la matrice di Bayer pesa sulla fotometria, non sulla copertura');
{
  const velo=tgt('Velo');
  const mono=dv({tel:'askar71f',red:0.75,cam:'asi2600mm',mnt:'am5',bin:1});
  const osc =dv({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
  chk('stesso sensore, stesso campo', Math.abs(mono.fovX-osc.fovX)<1e-6,
      `${mono.fovX.toFixed(0)}' entrambi`);
  chk('quindi stessa copertura', pan(velo,mono)===pan(velo,osc),
      `${pan(velo,mono)} pannelli`);
  chk('ma il colore costa piu ore per campo in banda stretta',
      M.timeFactor(osc,'Ha',600) > M.timeFactor(mono,'Ha',600),
      `Ha x${M.timeFactor(osc,'Ha',600).toFixed(1)} contro x${M.timeFactor(mono,'Ha',600).toFixed(1)}`);
}

console.log(`\n${pass} verifiche superate, ${fail} fallite\n`);
process.exit(fail?1:0);
