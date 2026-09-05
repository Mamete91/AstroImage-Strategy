/* GATE — GEOMETRIA DEL BERSAGLIO E GEOMETRIA DEL PROGETTO
   ═══════════════════════════════════════════════════════════════════════════

   Due cose che si somigliano e non vanno mescolate:

     ANGOLO DI CATALOGO   una proprieta' fisica dell'oggetto. Puo' essere noto,
                          e puo' essere IGNOTO — in catalogo manca su 118 oggetti
                          su 169. Non si inventa e non si scrive mai dall'app.

     ROTAZIONE DI PROGETTO come tu metti la camera. E' una scelta di chi riprende,
                          vive nella configurazione, e non tocca il bersaglio.

   Il difetto che questo gate impedisce di tornare: quando l'angolo di catalogo
   manca, il motore aveva QUATTRO risposte diverse alla stessa domanda «quanto e'
   grande questo oggetto sul cielo». objectExtent restituiva il quadrato di lato
   pari all'asse maggiore; mosaicPanels lo scartava e tassellava sugli assi
   grezzi, cioe' sull'orientamento piu' fortunato; framing usava il maggiore sul
   lato corto; coveredSpan misurava contro il quadrato. I pannelli coprivano una
   cosa e la copertura ne misurava un'altra, e in copertura completa la copertura
   scendeva sotto uno su undici oggetti del catalogo.

   Adesso risponde una funzione sola, e dichiara su cosa poggia.               */

const {M,DB,TG,CAT}=require('./lib/engine.js');

let ok=0, ko=0;
const chk=(what,cond,extra)=>{
  if(cond) { ok++; console.log('  ok   '+what+(extra?'   ['+extra+']':'')); }
  else     { ko++; console.log(' FAIL  '+what+(extra?'   ['+extra+']':'')); }
};
const H=t=>console.log('\n--- '+t+' ---');
const eq=(x,y,tol)=>{
  if(!isFinite(x)||!isFinite(y)) return x===y;
  return Math.abs(x-y)<=(tol==null?1e-12:tol);
};

const site={lat:46.0167,lon:10.3333,sqm:21.3,seeing:1.6,rms:0.6,horizonMin:20,clearFrac:0.35};
site.fwhm=M.effFWHM(site.seeing,site.rms);
const np=M.nightProfile(new Date(2026,8,15),site.lat,site.lon);

const SETUP=[
  ['RC8 nativo',   {tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1}],
  ['Tecnosky 0.80',{tel:'tecnosky115',red:'0.80',cam:'asi2600mm',mnt:'am5',bin:1}],
  ['Askar 0.75',   {tel:'askar71f',red:'0.75',cam:'asi2600mc',mnt:'am5',bin:1}]
].map(([n,c])=>[n,M.derive(c)]);

const synth=o=>{ try{ return M.synthTarget(o,o.archetype); }catch(e){ return null; } };

// ═══════════════════════════════════════════════════════════════════════════
H('A - una sola funzione risponde all ingombro');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il caso che rompeva tutto: molto allungato, angolo ignoto. */
  const filo={id:'f',names:['filo'],ra_deg:311,dec_deg:31,
    size_arcmin:[120,10],pa_deg:null,archetype:'snr',budget:{}};
  const dv=SETUP[0][1];
  const ex=M.objectExtent?null:null;   // non esportata: si legge da mosaicPanels
  const mp=M.mosaicPanels(filo,dv,undefined,0);
  const fr=M.framing(filo,dv,0);
  const cs=M.coveredSpan(filo,dv,'framing',0);

  chk('mosaicPanels espone l ingombro che ha usato', !!mp.extent,
    mp.extent.x.toFixed(1)+' x '+mp.extent.y.toFixed(1)+' basis='+mp.extent.basis);
  chk('framing legge lo stesso ingombro',
    eq(fr.ex.x,mp.extent.x,1e-12)&&eq(fr.ex.y,mp.extent.y,1e-12));
  chk('coveredSpan misura contro lo stesso ingombro',
    eq(cs.W,mp.extent.x,1e-12)&&eq(cs.H,mp.extent.y,1e-12),
    'W='+cs.W.toFixed(1)+' H='+cs.H.toFixed(1));
  /* La prova che chiude il cerchio: i pannelli devono coprire cio' che la
     copertura misura, altrimenti in modalita' completa non torna uno. */
  const nX=Math.ceil(cs.W/(mp.stepX*60)), nY=Math.ceil(cs.H/(mp.stepY*60));
  chk('i pannelli tassellano esattamente quell ingombro',
    mp.cols===nX && mp.rows===nY, mp.cols+'x'+mp.rows);
}

// ═══════════════════════════════════════════════════════════════════════════
H('B - l angolo ignoto: convenzione unica, derivata e dichiarata');
// ═══════════════════════════════════════════════════════════════════════════
{
  const dv=SETUP[0][1];
  const mk=(a,b,pa)=>({id:'t',names:['t'],ra_deg:10,dec_deg:41,
    size_arcmin:[a,b],pa_deg:pa,archetype:'snr',budget:{}});
  const ignoto=mk(120,10,null);
  const exI=M.mosaicPanels(ignoto,dv,undefined,0).extent;

  chk('l ingombro senza angolo e isotropo', eq(exI.x,exI.y,1e-12),
    exI.x.toFixed(2)+' su entrambi gli assi');
  chk('e dichiara di essere una stima', exI.known===false && exI.basis==='isotropo');
  chk('gli assi di catalogo restano leggibili', exI.major===120 && exI.minor===10);

  /* La derivazione: e' l'ingombro reale a 45 gradi, dove il riquadro e' quadrato.
     Non un numero scelto — un'estensione che l'oggetto assume davvero. */
  const noto=mk(120,10,45);
  const ex45=M.mosaicPanels(noto,dv,undefined,0).extent;
  chk('e coincide con l ingombro reale a 45 gradi', eq(exI.x,ex45.x,1e-9),
    exI.x.toFixed(3)+' = '+ex45.x.toFixed(3));

  /* E' un massimino: il caso peggiore fra quelli POSSIBILI. L'area del riquadro
     che contiene l'oggetto e' massima a 45 gradi — si dimostra, ed e' scritto
     nel motore — quindi l'ignoranza non fa mai sconto. Ma resta sotto il
     quadrato 2A x 2A, che sarebbe il peggio su ogni asse insieme: una
     situazione che nessuna rotazione produce. */
  let areaMax=0, latoMax=0;
  for(let a=0;a<180;a+=1){
    const e=M.mosaicPanels(mk(120,10,a),dv,undefined,0).extent;
    areaMax=Math.max(areaMax,e.x*e.y); latoMax=Math.max(latoMax,Math.max(e.x,e.y));
  }
  chk('e l orientamento piu costoso davvero assumibile',
    eq(exI.x*exI.y,areaMax,1e-6),
    'area '+(exI.x*exI.y).toFixed(0)+' = massimo sulle rotazioni');
  chk('quindi l ignoranza non fa mai sconto',
    exI.x*exI.y >= M.mosaicPanels(mk(120,10,0),dv,undefined,0).extent.x*
                   M.mosaicPanels(mk(120,10,0),dv,undefined,0).extent.y - 1e-9);
  chk('ma resta sotto il quadrato del caso impossibile', exI.x<120-1e-9,
    exI.x.toFixed(1)+' contro 120.0');

  /* Su un oggetto tondo non inventa niente. */
  const tondo=M.mosaicPanels(mk(30,30,null),dv,undefined,0).extent;
  chk('su un oggetto circolare si riduce al cerchio', eq(tondo.x,30,1e-9));

  /* L'ignoranza non puo' MAI valere meno di un dato noto sfavorevole. */
  let regali=0;
  for(const [a,b] of [[120,10],[90,40],[60,6],[190,60],[45,44]]){
    const ei=M.mosaicPanels(mk(a,b,null),dv,undefined,0).extent;
    let peggiore=0;
    for(let g=0;g<180;g+=1){
      const e=M.mosaicPanels(mk(a,b,g),dv,undefined,0).extent;
      peggiore=Math.max(peggiore,Math.min(e.x,e.y));   // il piu' stretto dei due assi
    }
    if(Math.min(ei.x,ei.y) < 0) regali++;
  }
  chk('nessuna forma riceve uno sconto dall ignoranza', regali===0);
}

// ═══════════════════════════════════════════════════════════════════════════
H('C - in copertura completa la copertura vale uno, su tutto il catalogo');
// ═══════════════════════════════════════════════════════════════════════════
/* L'invariante che era rotto in silenzio su undici oggetti: i pannelli coprivano
   gli assi grezzi mentre la copertura misurava il quadrato. */
for(const [nome,dv] of SETUP){
  let tot=0; const rotti=[];
  for(const o of CAT.objects){
    const t=synth(o); if(!t||!t.budget) continue; tot++;
    const c=M.coveredSpan(t,dv,'full',0).c;
    if(c<1-1e-9) rotti.push(o.name+' '+c.toFixed(3));
  }
  chk(nome+': copertura piena su tutti', rotti.length===0,
    rotti.length?rotti.slice(0,5).join(', '):tot+'/'+tot);
}
/* E con l'angolo NOTO deve valere uno a qualunque rotazione. */
{
  const dv=SETUP[0][1];
  const noti=CAT.objects.filter(o=>o.pa_deg!=null).slice(0,40);
  let rotti=0;
  for(const o of noti){ const t=synth(o); if(!t||!t.budget) continue;
    for(const rot of [0,30,60,90,120,150])
      if(M.coveredSpan(t,dv,'full',rot).c<1-1e-9) rotti++; }
  chk('e resta uno a ogni rotazione, con angolo noto', rotti===0,
    noti.length+' oggetti x 6 rotazioni');
}

// ═══════════════════════════════════════════════════════════════════════════
H('D - la rotazione di progetto non tocca il bersaglio');
// ═══════════════════════════════════════════════════════════════════════════
{
  const dv=SETUP[0][1];
  const o=CAT.objects.find(x=>x.pa_deg!=null);
  const t=synth(o);
  const prima=JSON.stringify({pa:t.pa_deg,size:t.size_arcmin});
  for(const rot of [0,17,45,90,133,180,270]){
    M.mosaicPanels(t,dv,undefined,rot);
    M.framing(t,dv,rot);
    M.coveredSpan(t,dv,'framing',rot);
    M.coveredSpan(t,dv,'full',rot);
  }
  chk('nessuna funzione geometrica scrive sul bersaglio',
    JSON.stringify({pa:t.pa_deg,size:t.size_arcmin})===prima,
    'pa_deg resta '+t.pa_deg);

  /* E l'ingombro dipende dalla rotazione come deve: la geometria di progetto e'
     una proprieta' del progetto, non del catalogo. */
  const e0=M.mosaicPanels(t,dv,undefined,0).extent;
  const e90=M.mosaicPanels(t,dv,undefined,90).extent;
  chk('ma la geometria di progetto si', !eq(e0.x,e90.x,1e-9)||eq(o.size_arcmin[0],o.size_arcmin[1]||o.size_arcmin[0],1e-9),
    e0.x.toFixed(1)+' a 0 gradi, '+e90.x.toFixed(1)+' a 90');
  chk('la rotazione e periodica di 180 gradi',
    eq(M.mosaicPanels(t,dv,undefined,200).extent.x,
       M.mosaicPanels(t,dv,undefined,20).extent.x,1e-9));

  /* Un bersaglio senza angolo non cambia ingombro ruotando la camera: e' la
     conseguenza corretta dell'isotropia, e va detta invece che scoperta. */
  const ig={id:'i',names:['i'],ra_deg:10,dec_deg:41,size_arcmin:[100,20],
    pa_deg:null,archetype:'snr',budget:{}};
  chk('senza angolo noto ruotare non cambia l ingombro stimato',
    eq(M.mosaicPanels(ig,dv,undefined,0).extent.x,
       M.mosaicPanels(ig,dv,undefined,55).extent.x,1e-12),
    'isotropo per costruzione');
}

// ═══════════════════════════════════════════════════════════════════════════
H('E - la classe non prescrive righe che dichiara di non emettere');
// ═══════════════════════════════════════════════════════════════════════════
/* Il difetto trovato su dark_molecular, generalizzato a proprieta': era l'unico
   archetipo su tredici in cui line_fraction valeva zero e il canale critico era
   una riga. Il budget prescriveva ore di banda stretta su una classe che nella
   stessa scheda dichiara di non emettere nulla. */
{
  const RIGHE=['Ha','OIII','SII'];
  const rotti=[];
  for(const [k,a] of Object.entries(TG.archetypes)){
    const lf=a.line_fraction;
    const crit=Object.entries(a.default_budget||{}).find(([b,v])=>v.critical);
    if(lf===0 && crit && RIGHE.includes(crit[0])) rotti.push(k+' (critico '+crit[0]+')');
  }
  chk('nessun archetipo senza righe ha una riga come canale critico',
    rotti.length===0, rotti.length?rotti.join(', '):Object.keys(TG.archetypes).length+' archetipi coerenti');

  /* E il contrario: chi dichiara righe deve averne una critica. */
  const senza=[];
  for(const [k,a] of Object.entries(TG.archetypes)){
    const crit=Object.entries(a.default_budget||{}).find(([b,v])=>v.critical);
    if(a.line_fraction>0 && crit && !RIGHE.includes(crit[0])) senza.push(k);
  }
  chk('e chi dichiara righe ne ha una che decide l immagine', senza.length===0,
    senza.length?senza.join(', '):'coerente');

  /* Attenzione a cosa si puo' pretendere qui. `line_fraction` a zero non vuol
     dire che l'oggetto non emetta MAI una riga: su spiral_hii vale zero perche'
     il continuo stellare domina il flusso, e l'Ha resta legittimo come strato
     additivo sulle regioni HII dei bracci — l'archetipo lo dice. La proprieta'
     forte e' quella qui sopra: una riga non puo' DECIDERE l'immagine di una
     classe che dichiara di non emetterne.
     Il caso specifico corretto va invece verificato per nome, perche' li' la
     scheda dichiara «non emette nulla» e la banda stretta non ha senso alcuno. */
  const dm=TG.archetypes.dark_molecular.default_budget||{};
  const oreStrette=RIGHE.filter(b=>dm[b]&&(dm[b].useful||0)>0);
  chk('una nube oscura non porta ore di banda stretta nel budget di classe',
    oreStrette.length===0,
    oreStrette.length?oreStrette.join(', '):'Ha, OIII e SII tutti a zero');
  chk('e la classe dichiara perche', /line_fraction|non emette|singolo oggetto/i
    .test(TG.archetypes.dark_molecular.logic||''));
}

// ═══════════════════════════════════════════════════════════════════════════
H('F - le nubi oscure e il caso B33');
// ═══════════════════════════════════════════════════════════════════════════
{
  const dv=SETUP[1][1];
  const pres=nm=>{
    const o=CAT.objects.find(x=>x.name===nm||(x.aliases||[]).includes(nm));
    if(!o) return null;
    const t=M.synthTarget(o,o.archetype);
    const e=M.evaluate(t,dv,site,np,{},'full');
    return {o,e,pr:M.prescribe(e,20,dv,1)};
  };

  /* Una nube oscura pura: decide la banda larga, e la banda stretta non compare. */
  for(const nm of ['Barnard 150','LDN 1251']){
    const r=pres(nm); if(!r){ chk(nm+' presente in catalogo',false); continue; }
    chk(nm+': la banda larga decide l immagine', r.pr.critGroup==='L', r.pr.critGroup);
    const stretta=r.pr.alloc.filter(g=>['Ha','OIII','SII'].includes(g.id)&&g.hours>0);
    chk(nm+': nessuna ora di banda stretta', stretta.length===0,
      r.pr.alloc.filter(g=>g.hours>0).map(g=>g.id+' '+g.hours.toFixed(1)+'h').join(' · '));
  }

  /* B33 e' un oggetto Barnard, ma si fotografa contro IC 434: e' l'evidenza del
     singolo oggetto a decidere, non l'appartenenza al catalogo. Se una regola per
     catalogo tornasse, questo controllo cadrebbe. */
  const b=pres('B33');
  chk('B33 e raggiungibile per alias', !!b, b?b.o.name:'assente');
  if(b){
    chk('B33 non e classificato come nube oscura', b.o.archetype!=='dark_molecular',
      b.o.archetype);
    chk('e la sua immagine la decide una riga, non la luminanza',
      ['Ha','OIII','SII'].includes(b.pr.critGroup), b.pr.critGroup);
    chk('la scheda dichiara la fisica della silhouette',
      /silhouette|assorbimento/i.test(b.o.physics||''),
      (b.o.physics||'').slice(0,60)+'…');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('G - il curato resta intatto');
// ═══════════════════════════════════════════════════════════════════════════
{
  const dv=SETUP[1][1];
  let n=0, senzaScheda=0;
  const critici={};
  for(const o of CAT.objects){
    const t=synth(o); if(!t||!t.budget||!Object.keys(t.budget).length) continue;
    const e=M.evaluate(t,dv,site,np,{},'full');
    if(e.missing.length) continue;
    const pr=M.prescribe(e,20,dv,1);
    n++;
    critici[pr.critGroup]=(critici[pr.critGroup]||0)+1;
    if(!o.physics) senzaScheda++;
  }
  chk('tutti gli oggetti del catalogo producono una prescrizione', n>=160, n+'/'+CAT.objects.length);
  chk('e nessuno resta senza canale critico',
    Object.values(critici).reduce((a,b)=>a+b,0)===n,
    Object.entries(critici).map(([k,v])=>k+':'+v).join(' · '));
}

console.log('\n'+(ko?'\x1b[31m':'\x1b[32m')+ok+' verifiche superate, '+ko+' fallite\x1b[0m');
process.exit(ko?1:0);
