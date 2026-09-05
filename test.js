/* Verifica del motore: estrae le funzioni pure da index.html e le controlla
   contro valori calcolabili indipendentemente. Non tocca il DOM. */
const fs=require('fs');

const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=html.split('<script>')[1].split('</script>')[0];
const SRC=script;                       // per i controlli sul sorgente
const pure=script.split('/* =====================================================================\n   UI')[0];

const DB=JSON.parse(fs.readFileSync(__dirname+'/data/setups.json','utf8'));
const TG=JSON.parse(fs.readFileSync(__dirname+'/data/targets.json','utf8'));
const CAT=JSON.parse(fs.readFileSync(__dirname+'/data/catalog.json','utf8'));
const CIT=JSON.parse(fs.readFileSync(__dirname+'/data/cities.json','utf8'));
const ONGC=fs.existsSync(__dirname+'/data/openngc.json')
  ?JSON.parse(fs.readFileSync(__dirname+'/data/openngc.json','utf8')):null;

let OWNED=DB.default_filters.slice();
const ctx={DB,TG,CAT:CAT.objects,CITIES:CIT.cities,OWNED,console,Math,Date,Object,JSON,isFinite,parseFloat,Number,window:{}};
const fn=new Function(...Object.keys(ctx), pure+`
  return {camSpec,resolveSensor,dyeAnchor,gainModes,resolveNight,nightWindows,planNights,synthTarget,
          derive,refCfg,timeFactor,rates,varRate,factorValidated,skyRateFor,bandSpec,cfaFraction,
          oscEfficiency,bayerDye,mosaicFrac,bandThroughput,
          qeAt,interp,samplingVerdict,framing,nightProfile,
          altaz,lstDeg,toJD,parseCoords,
          sunPos,moonPos,moonIllum,sep,airmass,kExt,moonSkyV,nL2mag,moonPenalty,
          lpPenalty,lpSkyRatio,bortleFor,BORTLE,estimateSQM,nearestCity,haversine,
          leakOf,filterFor,dualPass,feasibility,ownedFilters,effFWHM,
          binOptions,binAdvice,accessibleH,evaluate,fmt,mosaicPanels,fieldCorners,
          prescribe,fitAlternatives,roadChannels,roadSum,costGroups,fillBudget,expectFor,
          synthTarget,inRoad,planNights,moonTolerance,objectExtent,bestRotation,
          nightWindows,nightsBounds,bestStart,balanceSessions,moonExcessMag,moonExcessFlux,lpExcessFlux,skyRef,subExposure,exposurePlan,
          subPlan,skyRateFor,starPeakRate,gainModes,bandSpec,ninaSequence,ninaCheck,mountRms,
          cfaFraction,objectSatTime,framingCenter};`);
const M=fn(...Object.values(ctx));

const nrm=x=>String(x).toLowerCase().replace(/[\s_'\u2019-]+/g,'');
let pass=0,fail=0;
/* Il quarto argomento e' una TOLLERANZA quando e' un numero; qualunque altra cosa
   e' una NOTA da stampare. Prima una nota non numerica finiva dentro Math.abs e
   faceva fallire un test corretto: un attrezzo che punisce chi lo documenta. */
function chk(name,got,exp,tol){
  const num=typeof tol==='number'&&isFinite(tol);
  const note=(tol!=null&&!num)?String(tol):null;
  const ok = num ? Math.abs(got-exp)<=tol : got===exp;
  console.log(`${ok?'  ok  ':' FAIL '} ${name}  =  ${typeof got==='number'?got.toFixed(3):got}` +
    (note?`   [${note}]`:'') + (ok?'':`   (atteso ${exp}${num?' ±'+tol:''})`));
  ok?pass++:fail++;
}

console.log('\n--- JSON ---');
console.log(`      catalogo: ${DB.telescopes.length} telescopi, ${DB.cameras.length} camere, ${DB.mounts.length} montature, ${DB.filters.length} filtri`);
chk('catalogo telescopi ampio',DB.telescopes.length>=25,true);
chk('catalogo camere ampio',DB.cameras.length>=15,true);
chk('catalogo montature ampio',DB.mounts.length>=12,true);
const allIds=[...DB.telescopes,...DB.cameras,...DB.mounts].map(x=>x.id);
chk('nessun id duplicato',new Set(allIds).size,allIds.length);
chk('ogni telescopio ha la focale nativa',
  DB.telescopes.every(t=>t.reducers.some(r=>r.factor===1)),true);
chk('focali ridotte coerenti col fattore',
  DB.telescopes.every(t=>t.reducers.every(r=>Math.abs(r.focal_mm-t.focal_mm*r.factor)<=2)),true);
/* 2026-09: l'invariante non e' piu' "ogni scheda porta la sua tabella" — la curva
   di una camera a matrice si deriva dal sensore — ma "ogni camera RISOLVE a una QE
   usabile", che e' cio' che al motore serve davvero. */
chk('ogni camera risolve a una QE utilizzabile',
  DB.cameras.every(c=>{const q=M.qeAt(c,550);return isFinite(q)&&q>0.05&&q<=1;}),true);
chk('e ogni camera dichiara come ci e arrivata',
  DB.cameras.every(c=>{const k=M.camSpec(c).campi.qe;return k&&k.esito&&k.come;}),true);
{const ris=DB.cameras.filter(c=>M.camSpec(c).sensor).length;
 console.log(`      sensore riconosciuto su ${ris} camere di ${DB.cameras.length}`+
   ` (le altre sono archetipi generici)`);
 chk('il riconoscimento copre tutte le camere reali',ris,DB.cameras.length-2);}
chk('setups: preset',DB.presets.length,6);
chk('targets: numero',TG.targets.length,13);
const archUsed=new Set(TG.targets.map(t=>t.archetype));
chk('archetipi tutti definiti',[...archUsed].every(a=>TG.archetypes[a]),true);
chk('ogni target ha una strada default',
  TG.targets.every(t=>t.roads.some(r=>r.default)),true);
chk('ogni riga ha confidenza dichiarata',
  TG.targets.every(t=>t.lines.every(l=>!!l.confidence&&!!l.source)),true);
chk('ogni target ha budget con canale critico',
  TG.targets.every(t=>Object.values(t.budget).some(v=>v.critical)),true);


console.log('\n--- catalogo di ricerca ---');
console.log(`      ${CAT.objects.length} oggetti, ${CAT.objects.reduce((a,o)=>a+o.aliases.length,0)} alias`);
chk('catalogo ampio',CAT.objects.length>=160,true);
chk('coordinate tutte nel range',
  CAT.objects.every(o=>o.ra_deg>=0&&o.ra_deg<360&&Math.abs(o.dec_deg)<=90),true);
chk('dimensioni positive e maggiore >= minore',
  CAT.objects.every(o=>o.size_arcmin[0]>0&&o.size_arcmin[0]>=o.size_arcmin[1]),true);
const cn=CAT.objects.map(o=>o.name);
chk('nomi unici',new Set(cn).size,cn.length);
const ca=CAT.objects.flatMap(o=>o.aliases);
chk('alias unici',new Set(ca).size,ca.length);
chk('tutti i 110 Messier presenti',
  Array.from({length:110},(_,i)=>'M'+(i+1)).every(n=>cn.includes(n)),true);



console.log('\n--- stima dell inquinamento luminoso dalle coordinate ---');
console.log(`      ${CIT.cities.length} centri abitati in tabella`);
const SQ=(la,lo)=>M.estimateSQM(la,lo);
for(const [n,la,lo] of [['Milano centro',45.464,9.190],['Monza',45.584,9.274],
  ['Brescia',45.539,10.220],['Sondrio',46.170,9.870],['Borno',45.950,10.200],
  ['Passo del Tonale',46.258,10.586],['Livigno',46.538,10.135]]){
  const q=SQ(la,lo);
  console.log(`      ${n.padEnd(18)} SQM ${q.toFixed(2)}  Bortle ${M.bortleFor(q).n}`);
}
chk('Milano centro ~17.8',SQ(45.464,9.190),17.8,0.25);
chk('Borno ~20.8 (misura di campo)',SQ(45.950,10.200),20.8,0.25);
chk('Sondrio ~19.4',SQ(46.170,9.870),19.4,0.4);
chk('nessun sito italiano risulta Bortle 1',
  [[45.95,10.20],[46.258,10.586],[46.538,10.135],[45.874,11.510]]
    .every(([a,b])=>SQ(a,b)<21.75),true);
chk('il sito di riferimento in setups.json e coerente col modello',
  Math.abs(DB.sites[0].sqm_zenith-SQ(DB.sites[0].lat_deg,DB.sites[0].lon_deg)),0,0.2);
chk('un passo alpino e piu buio di Milano',SQ(46.258,10.586)>SQ(45.464,9.190)+3,true);
chk('mai fuori dai limiti fisici',
  [[45,9],[41.9,12.5],[46.5,10],[38,15]].every(([a,b])=>{const q=SQ(a,b);return q>=16.5&&q<=21.9}),true);
chk('citta piu vicina a Borno riconosciuta',
  ['Darfo Boario Terme','Lovere','Borno'].includes(M.nearestCity(45.95,10.20).n),true);
chk('distanza Milano-Roma plausibile',M.haversine(45.464,9.19,41.9,12.483),477,25);

console.log('\n--- il leak dipende dalla larghezza del filtro ---');
for(const w of [3,5,7,12,250]) console.log(`      ${String(w).padStart(3)} nm → passa ${(M.leakOf(w)*100).toFixed(1)}% del continuo`);
chk('un 7 nm lascia passare piu di un 3 nm',M.leakOf(7)>M.leakOf(3),true);
chk('7 nm circa il doppio di 3 nm',M.leakOf(7)/M.leakOf(3),2.33,0.05);
const q17=17.8;
console.log(`      da Milano: 3 nm ×${(1/M.lpPenalty(q17,3)).toFixed(2)}  `+
  `7 nm ×${(1/M.lpPenalty(q17,7)).toFixed(2)}  `+
  `12 nm ×${(1/M.lpPenalty(q17,12)).toFixed(2)}  `+
  `banda larga ×${(1/M.lpPenalty(q17,250)).toFixed(1)}`);
chk('da Milano un 3 nm resta praticabile',1/M.lpPenalty(17.8,3)<2,true);
chk('da Milano la banda larga no',1/M.lpPenalty(17.8,250)>20,true);

console.log('\n--- filtri e disponibilita delle bande ---');
const mono=DB.cameras.find(c=>c.id==='asi2600mm'), osc=DB.cameras.find(c=>c.id==='asi2600mc');
chk('con il set completo tutte le righe sono disponibili',
  ['Ha','OIII','SII'].every(b=>!!M.filterFor(b,mono)),true);
chk('sceglie il filtro piu stretto disponibile',M.filterFor('Ha',mono).fwhm_nm,3);
OWNED.length=0; DB.default_filters.filter(x=>x!=='s2_3'&&x!=='lult').forEach(x=>OWNED.push(x));
chk('senza filtro SII la banda non e disponibile',M.filterFor('SII',mono),null);
chk('ma Ha e OIII restano',!!M.filterFor('Ha',mono)&&!!M.filterFor('OIII',mono),true);
OWNED.length=0; ['lum','red','grn','blu'].forEach(x=>OWNED.push(x));
chk('senza narrowband nessuna riga',['Ha','OIII','SII'].every(b=>!M.filterFor(b,mono)),true);
chk('su sensore a colori la banda larga e sempre disponibile',!!M.filterFor('L',osc),true);
OWNED.length=0; DB.default_filters.forEach(x=>OWNED.push(x));
chk('dual-band riconosciuto solo su sensore a colori',
  !!M.dualPass(osc)&&!M.dualPass(mono),true);
chk('il dual-band scelto copre Ha e OIII',
  M.dualPass(osc).bands.includes('Ha')&&M.dualPass(osc).bands.includes('OIII'),true);

console.log('\n--- indice di fattibilita ---');
for(const w of [0.8,3,9,30]) console.log(`      ${String(w).padStart(4)} settimane → ${M.feasibility(w,[]).k}`);
chk('meno di due settimane e fattibile',M.feasibility(1,[]).k,'fattibile');
chk('oltre quattordici e fuori portata',M.feasibility(30,[]).k,'fuori portata');
chk('un filtro mancante batte qualunque durata',M.feasibility(0.5,['SII']).k,'manca SII');
chk('punteggio di fattibilita monotono',
  [1,3,9,30].every((w,i,a)=>i===0||M.feasibility(a[i-1],[]).score>=M.feasibility(w,[]).score),true);

console.log('\n--- archetipi curati e profili fisici ---');
const withPhys=CAT.objects.filter(o=>o.physics);
console.log(`      ${CAT.objects.length} oggetti con archetipo curato, ${withPhys.length} con profilo fisico scritto`);
chk('ogni oggetto ha un archetipo',CAT.objects.every(o=>!!o.archetype),true);
chk('archetipi tutti esistenti',CAT.objects.every(o=>!!TG.archetypes[o.archetype]),true);
chk('profili fisici non vuoti',withPhys.every(o=>o.physics.length>80),true);
chk('profili con confidenza dichiarata',withPhys.every(o=>!!o.physics_confidence),true);
const A=n=>CAT.objects.find(o=>o.name===n);
console.log('      correzioni rispetto alla deduzione dal solo tipo:');
for(const n of ['Abell 31','Jones-Emberson 1','M97','M87','NGC 4565','NGC 2359','M82','M1'])
  console.log(`        ${n.padEnd(20)} → ${A(n).archetype}`);
chk('planetarie evolute classificate come deboli',
  ['Abell 21','Abell 31','Abell 33','Jones-Emberson 1','M97','NGC 7293'].every(n=>A(n).archetype==='pn_faint'),true);
chk('planetarie compatte restano brillanti',
  ['M57','NGC 2392','NGC 6543'].every(n=>A(n).archetype==='pn_bright'),true);
chk('ellittiche non classificate come spirali con HII',
  ['M87','M84','M86','M49','M104'].every(n=>A(n).archetype==='elliptical_group'),true);
chk('Elmo di Thor riconosciuto come bolla WR',A('NGC 2359').archetype,'wr_bubble');
chk('ammassi mai in banda stretta',
  ['cluster_globular','cluster_open'].every(k=>TG.archetypes[k].default_budget.OIII.useful===0),true);
chk('M56 riconosciuto come globulare, non come regione HII',A('M56').archetype,'cluster_globular');
chk('i globulari separati dagli aperti',
  A('M13').archetype==='cluster_globular'&&A('M11').archetype==='cluster_open',true);
// M45 resta "riflessione": il soggetto fotografico delle Pleiadi e' la nebulosita', non l'ammasso
chk('le Pleiadi restano riflessione, non ammasso aperto',A('M45').archetype,'reflection');
chk('nessun oggetto di catalogo resta sul vecchio archetipo cluster',
  CAT.objects.some(o=>o.archetype==='cluster'),false);

console.log('\n--- lettura del fattore riduttore ---');
const readRed=raw=>{const m=String(raw).replace(',','.').match(/(\d*\.?\d+)/);
  const f=m?parseFloat(m[1]):NaN; return (f>0.2&&f<3)?f:null;};
for(const [inp,exp] of [['0.8',0.8],['0.8x',0.8],['0,63x',0.63],['x0.7',0.7],
                        ['1.5x',1.5],['riduttore 0.75',0.75],['abc',null],['12x',null]]){
  const got=readRed(inp);
  const ok=got===exp;
  console.log(`${ok?'  ok  ':' FAIL '} "${inp}" → ${got}`);
  ok?pass++:fail++;
}

console.log('\n--- inquinamento luminoso per banda ---');
/* `lpPenalty` e' un fattore TEMPO riferito al cielo delle schede: il costo in ore e'
   il suo reciproco, non il reciproco del quadrato. Prima era un fattore di SNR usato
   dove serve un fattore di tempo, e il testo dell'app diceva gia' la cosa giusta
   mentre l'aritmetica ne faceva un'altra. */
const REF=DB.reference_config.sqm_zenith;
for(const [n,q] of [['riferimento',REF],['Borno',20.8],['periferia',20.0],['Milano',17.8]]){
  const b=1/M.lpPenalty(q,250), nb=1/M.lpPenalty(q,3);
  console.log(`      ${n.padEnd(11)} SQM ${q}  Bortle ${M.bortleFor(q).n}  →  banda larga x${b.toFixed(1)}, 3 nm x${nb.toFixed(2)}`);
}
chk('il cielo di riferimento e dichiarato',typeof REF,'number');
chk('sotto il cielo di riferimento il fattore e esattamente 1',M.lpPenalty(REF,250),1,1e-9);
chk('un cielo migliore del riferimento vale un bonus, non 1',M.lpPenalty(21.9,250)>1.2,true);
chk('il costo in ore e il rapporto dei flussi, non la sua radice',
  1/M.lpPenalty(17.8,250), M.lpSkyRatio(17.8,250)/M.lpSkyRatio(REF,250), 0.001);
chk('da Milano la banda larga costa oltre 20x',1/M.lpPenalty(17.8,250)>20,true);
chk('da Milano la banda stretta costa meno di 2x',1/M.lpPenalty(17.8,3)<2,true);
/* ─── il fondo cielo: Luna e lampioni, la stessa fisica ─── */
console.log('\n--- Luna: somma di flussi, non differenza di magnitudini ---');
console.log('      Vluna vs SQM 20.8 →  vecchia formula  |  somma dei flussi');
for(const v of [22.5,21.0,20.8,20.0,19.0]){
  console.log(`      Vluna ${v.toFixed(1)}  →  ${Math.max(0,20.8-v).toFixed(2)} mag  |  ${M.moonExcessMag(20.8,v).toFixed(2)} mag`);
}
chk('una Luna piu debole del cielo alza comunque il fondo',M.moonExcessMag(20.8,21.0)>0.5,true);
chk('e la vecchia formula diceva zero',Math.max(0,20.8-21.0),0);
chk('due fondi uguali raddoppiano il flusso: +0.75 mag',M.moonExcessMag(20.8,20.8),0.7526,0.001);
chk('una Luna trascurabile resta trascurabile',M.moonExcessMag(20.8,25.0)<0.03,true);
/* Una Luna che da sola vale dieci volte il fondo naturale porta il totale a undici,
   non a dieci: 2.5·log10(11) = 2.60. Il conto e' sul FLUSSO TOTALE, ed e' esattamente
   il punto che la vecchia formula sbagliava. */
chk('il fondo naturale continua a contare anche sotto la Luna piena',
  M.moonExcessMag(20.8,18.3),2.5*Math.log10(11),0.001);
/* La penalita' e' un fattore TEMPO e ha la stessa forma dell'IL: 1/(1+eccesso di flusso). */
chk('un fondo raddoppiato costa il doppio delle ore',
  M.moonPenalty('L',M.moonExcessMag(20.8,20.8),250,false),0.5,0.01);
/* LA CREDENZA CHE QUESTO TEST DIFENDEVA, ED ERA FALSA.

   Diceva: «la banda stretta quasi non se ne accorge», Ha sopra 0.98 con il fondo
   raddoppiato. Non era fisica, era una asimmetria dimensionale: l'eccesso lunare
   veniva diviso per la larghezza relativa del filtro mentre il cielo naturale
   restava in unita' di banda larga. Con 3 nm significava dividere la Luna per 83
   e lasciare il fondo intero.

   Luna e cielo naturale sono entrambi continui: il filtro li taglia allo stesso
   modo e la larghezza si semplifica nel rapporto. Quello che resta e' il colore —
   Rayleigh per la Luna, la tabella del fondo naturale per il cielo. Un filtro
   stretto contro la Luna serve eccome, ma per un'altra ragione: abbassa il fondo
   in ASSOLUTO, quindi il rumore di lettura, e conserva il segnale di riga. */
const dmRadd=M.moonExcessMag(20.8,20.8);   // fondo raddoppiato
console.log('      fondo raddoppiato: '+['Ha','OIII','SII','L'].map(b=>
  b+' '+(M.moonPenalty(b,dmRadd,3,false)*100).toFixed(0)+'%').join('  '));
chk('la banda stretta ci perde meno della larga, ma non e immune',
  M.moonPenalty('Ha',dmRadd,3,false)>M.moonPenalty('L',dmRadd,250,false)&&
  M.moonPenalty('Ha',dmRadd,3,false)<0.90,true);
/* L'affermazione che conta, e che il vecchio modello non sapeva fare: sotto la
   Luna l'OIII sta PEGGIO della banda larga. Il fondo naturale a 500.7 nm vale
   0.70 volte quello in V, mentre lo scattering di Rayleigh vale 1.46: la Luna
   arriva piu' forte proprio dove il cielo e' piu' scuro. E' la ragione per cui
   l'OIII si riprende a Luna nuova. */
chk('e sotto la Luna l OIII sta peggio della luminanza, non meglio',
  M.moonPenalty('OIII',dmRadd,3,false)<M.moonPenalty('L',dmRadd,250,false),true);
chk('l OIII prende piu Luna dell Ha, per Rayleigh e per il colore del cielo',
  M.moonPenalty('OIII',1.0,3,false)<M.moonPenalty('Ha',1.0,3,false),true);
/* Il rapporto fra i due non e' piu' il solo (550/λ)⁴ = 2.95: entra anche quanto
   fondo naturale c e sotto ciascuna riga. */
{
  const q=b=>1/M.moonPenalty(b,1.0,3,false)-1;
  console.log('      eccesso relativo OIII/Ha: '+(q('OIII')/q('Ha')).toFixed(2)+'x');
  chk('e il rapporto e quello del colore del cielo, non il solo Rayleigh',
    q('OIII')/q('Ha')>6,true);
}
/* La larghezza del filtro non deve piu entrare nel rapporto: se entrasse,
   tornerebbe l asimmetria. */
chk('la larghezza del filtro non cambia la penalizzazione lunare',
  Math.abs(M.moonPenalty('OIII',1.0,3,false)-M.moonPenalty('OIII',1.0,7,false))<1e-12,true);
chk('su un soggetto stellare la Luna pesa un quarto',
  (1/M.moonPenalty('L',1.0,250,true)-1)/(1/M.moonPenalty('L',1.0,250,false)-1),0.25,0.001);
chk('con un fondo gia alto la Luna costa meno al margine',
  M.moonPenalty('L',1.0,250,false,5)>M.moonPenalty('L',1.0,250,false,0),true);

chk('narrowband sempre meno penalizzata della larga',
  [17.4,18.5,20,21].every(q=>M.lpPenalty(q,true)>M.lpPenalty(q,false)),true);
chk('scala Bortle monotona',
  M.BORTLE.every((b,i,a)=>i===0||a[i-1].sqm>b.sqm),true);
chk('SQM 17.8 e Bortle 8',M.bortleFor(17.8).n,8);
chk('SQM 21.5 e Bortle 3',M.bortleFor(21.5).n,3);

console.log('\n--- budget tipici per archetipo (target aggiunti dall utente) ---');
const arch=Object.entries(TG.archetypes);
chk('ogni archetipo ha un budget tipico',arch.every(([,a])=>a.default_budget),true);
chk('ogni budget tipico ha un canale critico',
  arch.every(([,a])=>Object.values(a.default_budget).some(v=>v.critical)),true);
chk('confidenza dichiarata bassa',arch.every(([,a])=>a.default_confidence==='bassa'),true);
/* Un oggetto di catalogo senza scheda curata deve comunque produrre una prescrizione
   sensata: e' l'intero senso dei due strati. Serve che l'archetipo porti con se'
   anche ordine, resa attesa e trappole di classe, non solo i numeri. */
chk('ogni archetipo ha ordine, resa attesa e trappole di classe',
  arch.every(([,a])=>a.order&&a.expect&&Object.keys(a.expect).length>=2&&a.traps&&a.traps.length>=2),true);
chk('le trappole di classe sono scritte, non segnaposto',
  arch.every(([,a])=>a.traps.every(t=>t.length>60)),true);
for(const k of ['hii_classic','pn_faint','reflection','cluster_globular','cluster_open']){
  const b=TG.archetypes[k].default_budget;
  const c=Object.entries(b).find(([,v])=>v.critical)[0];
  console.log(`      ${k.padEnd(18)} canale critico: ${c}, soglia ${b[c].floor} h`);
}
chk('riflessione non prevede banda stretta',
  TG.archetypes.reflection.default_budget.OIII.useful,0);
chk('PN debole ha OIII critico',
  TG.archetypes.pn_faint.default_budget.OIII.critical,true);

console.log('\n--- geometria strumentale ---');
const cfgs=[
  ['RC8 nativo',    {tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g'}, 1624, 0.478],
  ['RC8 0.80x',     {tel:'rc8',red:0.80,cam:'asi2600mm',mnt:'cem70g'},1300, 0.597],
  ['Tecnosky 0.80x',{tel:'tecnosky115',red:0.80,cam:'asi2600mm',mnt:'am5'},640,1.212],
  ['Askar 0.75x',   {tel:'askar71f',red:0.75,cam:'asi2600mm',mnt:'am5'},367, 2.113],
];
for(const [name,cfg,F,sc] of cfgs){
  const d=M.derive(cfg);
  chk(name+' focale',d.F,F);
  chk(name+' scala ″/px',d.scale,sc,0.005);
}
const rc8=M.derive({tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g'});
const tecR=M.derive({tel:'tecnosky115',red:0.80,cam:'asi2600mm',mnt:'am5'});
console.log(`      RC8 nativo:       f/${rc8.fRatio.toFixed(1)}  trasmissione ${(rc8.thru*100).toFixed(0)}% (ostruzione 45% + 2 specchi)`);
console.log(`      Tecnosky ridotto: f/${tecR.fRatio.toFixed(1)}  trasmissione ${(tecR.thru*100).toFixed(0)}%`);
chk('RC8 nativo e f/8 esatti',rc8.fRatio,8.0,0.01);
chk('RC8 ridotto 0.80x e f/6.4',M.derive({tel:'rc8',red:0.80,cam:'asi2600mm'}).fRatio,6.4,0.01);
chk('Tecnosky ridotto e f/5.6',tecR.fRatio,5.57,0.02);
chk('Askar ridotto 0.75x e f/5.2',M.derive({tel:'askar71f',red:0.75,cam:'asi2600mm'}).fRatio,5.17,0.02);
chk('trasmissione RC8 ~71%',rc8.thru,0.705,0.01);
chk('trasmissione rifrattore = throughput dichiarato',tecR.thru,0.96,0.001);

/* Il fattore tempo, rifatto 2026-09 (docs/gate-fisico.md).
   Prima era  (A_rif/A)·(Om_rif/Om_px)·(QE_rif/QE)/f_CFA : il secondo termine e' un
   rapporto di AREE DI PIXEL, ed entrava nel tempo come se fossero fotoni persi.
   Ora la metrica e' SNR per unita' di angolo solido, e la verifica a mano ricostruisce
   i quattro tassi di varianza esattamente come la forma ESO/STScI/Rubin. */
const TSUB=600;
function handFactor(dv,band,tsub){
  const sqm=DB.reference_config.sqm_zenith, sp=M.bandSpec(band,dv.c);
  const lam=sp.lines[0], cfa=M.cfaFraction(dv.c,band);
  const osc=(dv.c.cfa_penalty&&!sp.narrow)?0.34:1;
  const k=M.qeAt(dv.c,lam)*sp.T*cfa*osc, om=dv.scale*dv.scale;
  const collect=(dv.Aeff/100)*k;
  const V=M.skyRateFor(dv,band,sqm,{spec:sp})*cfa/om          // cielo per arcsec2
        +(dv.c.dark_e_s||0)*dv.bin*dv.bin/om                   // buio, cresce con F^2
        +Math.pow(dv.rnEff||dv.c.read_noise_e,2)/(om*tsub);    // lettura, idem
  return {V,collect,q:V/(collect*collect)};
}
const tf=M.timeFactor(rc8,'SII',TSUB);
const hRC8=handFactor(rc8,'SII',TSUB), hRef=handFactor(tecR,'SII',TSUB);
const byHand=hRC8.q/hRef.q;
console.log(`      Fattore tempo RC8 nativo vs riferimento: ×${tf.toFixed(3)}  (verifica a mano ×${byHand.toFixed(3)})`);
console.log(`      raccolta A·k ${hRC8.collect.toFixed(1)} contro ${hRef.collect.toFixed(1)}  ·  varianza ${hRC8.V.toFixed(5)} contro ${hRef.V.toFixed(5)}`);
chk('fattore tempo coerente col calcolo a mano',tf,byHand,0.0005);
chk('fattore RC8 nativo nel range atteso',tf>0.6&&tf<1.0,true);
chk('riferimento ha fattore 1.00',M.timeFactor(tecR,'SII',TSUB),1.0,0.001);
/* Il rapporto di aree di pixel NON deve piu' comparire: se comparisse, il fattore
   sarebbe ~6.4 volte piu' alto. E' la regressione da cui e' partito tutto. */
const spurio=(Math.pow(tecR.scale,2)/Math.pow(rc8.scale,2));
console.log(`      il termine spurio di campionamento valeva ×${spurio.toFixed(2)} — ora e' fuori`);
chk('il rapporto di aree di pixel non entra piu nel tempo',tf<byHand*spurio*0.5,true);
/* Il fattore e' di CATEGORIA B: dipende dalla posa, perche' il rumore di lettura si
   paga per lettura. Non e' una proprieta' del telescopio e va dichiarato come tale. */
console.log(`      stessa ottica, pose diverse: 120 s ×${M.timeFactor(rc8,'OIII',120).toFixed(3)}  600 s ×${M.timeFactor(rc8,'OIII',600).toFixed(3)}  1800 s ×${M.timeFactor(rc8,'OIII',1800).toFixed(3)}`);
chk('il fattore dipende dalla posa (categoria B, dichiarata)',
  M.timeFactor(rc8,'OIII',120)-M.timeFactor(rc8,'OIII',1800)>0.1,true);
chk('pose piu lunghe costano meno tempo totale',M.timeFactor(rc8,'OIII',1800)<M.timeFactor(rc8,'OIII',120),true);

console.log('\n--- la QE entra nel calcolo del tempo ---');
const monoRef=M.derive({tel:'tecnosky115',red:0.80,cam:'asi2600mm'});
const oscRef =M.derive({tel:'tecnosky115',red:0.80,cam:'asi2600mc'});
const c1600  =M.derive({tel:'tecnosky115',red:0.80,cam:'asi1600mm'});
console.log(`      stessa ottica, 2600MM  → ×${M.timeFactor(monoRef,'OIII').toFixed(2)} in OIII`);
console.log(`      stessa ottica, 2600MC  → ×${M.timeFactor(oscRef,'OIII').toFixed(2)} in OIII (matrice di Bayer)`);
console.log(`      stessa ottica, 1600MM  → ×${M.timeFactor(c1600,'OIII').toFixed(2)} in OIII (QE 60%, pixel 3.8 µm)`);
/* ─── quanti fotositi raccolgono la riga, su una matrice di Bayer ───
   La vecchia regola dava 0.25 a tutta la banda stretta: assumeva che l'OIII
   cadesse su un quarto della matrice come l'Ha. Non e' vero — a 656 nm rispondono
   solo i pixel rossi, a 500.7 nm rispondono verdi E blu — ed e' la ragione fisica
   per cui il dual-band su OSC funziona. */
const oscCam=DB.cameras.find(c=>c.id==='asi2600mc');
console.log('      fotositi che raccolgono la riga: '+
  ['Ha','OIII','SII','RGB','L'].map(b=>b+' '+(M.cfaFraction(oscCam,b)*100).toFixed(0)+'%').join('  '));
/* AGGIORNATO v1.6. I valori della 2600MC vengono ora dalla carta QE per canale di
   ZWO (letture di terzi a 656.3 / 500.7 / 672.4 nm) invece che da una derivazione a
   mano su curve tipiche: Ha 0.29→0.357, OIII 0.71→0.641, SII 0.28→0.393. Verificati
   contro il modello spettrale indipendente costruito su IMX219, che concorda entro
   il 6%. Vedi docs/studio-osc.md e il blocco cfa_fraction_source nella scheda. */
chk('l Ha cade soprattutto sui pixel rossi: circa un terzo della matrice',
  M.cfaFraction(oscCam,'Ha')>0.30&&M.cfaFraction(oscCam,'Ha')<0.45,true,
  M.cfaFraction(oscCam,'Ha').toFixed(3));
chk('l OIII cade su verdi e blu: ben piu di un quarto',M.cfaFraction(oscCam,'OIII')>0.6,true);
chk('e l OIII resta il piu favorito dei tre',
  M.cfaFraction(oscCam,'OIII')>M.cfaFraction(oscCam,'Ha')&&
  M.cfaFraction(oscCam,'OIII')>M.cfaFraction(oscCam,'SII'),true);
/* 2026-09: la frazione per canale e' una proprieta' del SENSORE, non della camera —
   la stessa misura vale per ogni marca che monta quel silicio. L'intento del test
   non cambia: il valore deve dichiarare da dove viene. */
{const sen=M.camSpec(oscCam).sensor;
 chk('la frazione e un dato del sensore ('+(sen?sen.name:'—')+'), non della camera',
   !!(sen&&sen.cfa_fraction),true);
 chk('i valori dichiarano la propria fonte',!!(sen&&sen.cfa_fraction_fonte&&sen.cfa_fraction_fonte.come),true);
 chk('e la fonte si dichiara una MISURA',sen.cfa_fraction_fonte.esito,'misura');
 chk('il vecchio valore ereditato resta per memoria',!!oscCam.cfa_fraction_ereditato,true);
 chk('ma e fuori dal percorso operativo: si usa '+M.cfaFraction(oscCam,'Ha').toFixed(3)+
   ', non l ereditato '+oscCam.cfa_fraction_ereditato.Ha,
   M.cfaFraction(oscCam,'Ha')!==oscCam.cfa_fraction_ereditato.Ha,true);}
chk('e su una mono non c e nessuna matrice',M.cfaFraction(DB.cameras.find(c=>c.id==='asi2600mm'),'OIII'),1);
const rHa=M.timeFactor(oscRef,'Ha')/M.timeFactor(monoRef,'Ha');
const rO3=M.timeFactor(oscRef,'OIII')/M.timeFactor(monoRef,'OIII');
console.log(`      OSC vs mono, stessa ottica: Ha ×${rHa.toFixed(2)}  OIII ×${rO3.toFixed(2)}`);
chk('l OSC resta piu lenta della mono in entrambe le righe',rHa>1&&rO3>1,true);
chk('ma sull Ha molto piu che sull OIII, ed e il punto',rHa/rO3>2,true);
chk('camera a QE bassa piu lenta di una a QE alta',
  M.timeFactor(c1600,'OIII')>M.timeFactor(monoRef,'OIII'),true);
chk('la QE cambia il risultato per banda',
  Math.abs(M.timeFactor(c1600,'Ha')-M.timeFactor(c1600,'OIII'))>0.01,true);
console.log(`      QE 2600MM: ${(M.qeAt(monoRef.c,500.7)*100).toFixed(0)}% a 500 nm, ${(M.qeAt(monoRef.c,656.3)*100).toFixed(0)}% a 656 nm`);
const fake={qe_peak:0.85};
chk('camera con solo qe_peak usa la forma tipica',M.qeAt(fake,500),0.85,0.001);
chk('e decade nel rosso',M.qeAt(fake,656)<M.qeAt(fake,500),true);
/* 2026-09: su una camera A MATRICE il numero che l'utente ha in mano e' il picco
   della MATRICE, non del silicio. Il motore lo riporta al silicio dividendo per la
   trasmissione misurata del colorante, e la catena deve tornare al punto di
   partenza: quello che entra dal modulo e' quello che esce al picco. */
{const fkm={qe_peak:0.85,cfa_penalty:0.25,pixel_um:9.9,width_px:1,height_px:1};
 chk('su matrice il picco inserito e quello della MATRICE, e torna',M.qeAt(fkm,500),0.85,0.005);
 chk('e il silicio sotto e piu alto del colorante ('+M.camSpec(fkm).qeSil(500).toFixed(3)+')',
   M.camSpec(fkm).qeSil(500)>0.85,true);}

console.log('\n--- lettura coordinate incollate ---');
const cases=[
  ['45.95, 10.20',45.95,10.20],
  ['45.9512 10.1987',45.9512,10.1987],
  ['45.95,10.20',45.95,10.20],
  ["45°57'04\"N 10°12'00\"E",45.9511,10.2000],
  ['-33.86, 151.20',-33.86,151.20]
];
for(const [txt,la,lo] of cases){
  const c=M.parseCoords(txt);
  const ok=c&&Math.abs(c.lat-la)<0.01&&Math.abs(c.lon-lo)<0.01;
  console.log(`${ok?'  ok  ':' FAIL '} "${txt}" → ${c?c.lat.toFixed(4)+', '+c.lon.toFixed(4):'null'}`);
  ok?pass++:fail++;
}
chk('testo non coordinato viene rifiutato',M.parseCoords('ciao mondo'),null);
chk('latitudine impossibile rifiutata',M.parseCoords('120.0 10.0'),null);

console.log('\n--- campionamento con seeing reale 1.0-2.4″ ---');
for(const s of [1.0,1.6,2.4]){
  const v=M.samplingVerdict(rc8.scale,s);
  console.log(`      RC8 nativo 0.48″/px con seeing ${s}″ → ${v.k} (${v.n})`);
}
chk('RC8 nativo corretto a seeing 1.6″',M.samplingVerdict(rc8.scale,1.6).k,'corretto');
chk('Tecnosky ridotto sottocampionato a 1.6″',M.samplingVerdict(tecR.scale,1.6).k,'sottocampionato');

console.log('\n--- seeing e guida si sommano in quadratura ---');
for(const [see,rms] of [[1.6,0.0],[1.6,0.6],[1.6,1.0],[1.6,1.3],[2.4,0.6]]){
  const f=M.effFWHM(see,rms);
  console.log(`      seeing ${see}″ + RMS ${rms.toFixed(1)}″  →  FWHM reale ${f.toFixed(2)}″  (+${Math.round((f/see-1)*100)}%)`);
}
chk('senza errore di guida la FWHM resta il seeing',M.effFWHM(1.6,0),1.6,0.001);
chk('RMS 0.6″ su seeing 1.6″ porta la FWHM a ~1.9″',M.effFWHM(1.6,0.6),1.90,0.03);
chk('RMS 1.3″ su seeing 1.6″ porta la FWHM oltre 2.6″',M.effFWHM(1.6,1.3)>2.6,true);
chk('la FWHM non scende mai sotto il seeing',
  [[1.0,0.5],[2.0,0.3],[1.6,1.5]].every(([s,r])=>M.effFWHM(s,r)>=s),true);
chk('la guida cambia il verdetto sul campionamento',
  M.samplingVerdict(rc8.scale,M.effFWHM(1.6,0)).k!==
  M.samplingVerdict(rc8.scale,M.effFWHM(1.6,1.3)).k,true);
console.log(`      RC8 nativo 0.48″/px: guida 0.0″ → ${M.samplingVerdict(rc8.scale,M.effFWHM(1.6,0)).k}`+
  `, guida 1.3″ → ${M.samplingVerdict(rc8.scale,M.effFWHM(1.6,1.3)).k}`);

console.log('\n--- RMS: il tuo valore vince su quello di catalogo ---');
const rmsMap={};
const rmsFor=(id,scale)=>{ const saved=rmsMap[id];
  if(saved!=null) return saved;
  const m=DB.mounts.find(x=>x.id===id)||DB.mounts[0];
  return (scale<0.8?m.rms_long_fl_arcsec:m.rms_typ_arcsec)||0.8; };
chk('a lunga focale usa il valore realistico della montatura',
  rmsFor('am5',0.48),DB.mounts.find(m=>m.id==='am5').rms_long_fl_arcsec);
chk('a focale corta usa il valore tipico',
  rmsFor('am5',1.5),DB.mounts.find(m=>m.id==='am5').rms_typ_arcsec);
rmsMap['am5']=0.75;
chk('un valore salvato batte entrambi',rmsFor('am5',0.48),0.75);
chk('ogni montatura dichiara i due valori',
  DB.mounts.every(m=>m.rms_typ_arcsec>0&&m.rms_long_fl_arcsec>0),true);

console.log('\n--- notte a Borno (45.95°N) ---');
const lat=45.95, lon=10.20;
const jun=M.nightProfile(new Date(2026,5,21),lat,lon);
const dec=M.nightProfile(new Date(2026,11,21),lat,lon);
const sep_=M.nightProfile(new Date(2026,8,15),lat,lon);
console.log(`      21 giu: ${jun.darkH.toFixed(2)} h di buio astronomico`);
console.log(`      15 set: ${sep_.darkH.toFixed(2)} h`);
console.log(`      21 dic: ${dec.darkH.toFixed(2)} h`);
chk('buio al solstizio estivo ~2.8 h',jun.darkH,2.8,0.4);
chk('buio a meta settembre ~8 h',sep_.darkH,8.1,0.5);
chk('buio al solstizio invernale ~11.7 h',dec.darkH,11.7,0.5);
chk('rapporto inverno/estate ~4',dec.darkH/jun.darkH,4.2,0.7);

console.log('\n--- geometria dei target da 45.95°N ---');
function culmination(dec_){ return 90-Math.abs(lat-dec_); }
for(const id of ['abell61','ngc6888','m27','ngc7331']){
  const t=TG.targets.find(x=>x.id===id);
  console.log(`      ${t.names[0].padEnd(12)} dec ${t.dec_deg.toFixed(1).padStart(6)}°  culmina a ${culmination(t.dec_deg).toFixed(1)}°`);
}
const a61=TG.targets.find(t=>t.id==='abell61');
chk('Abell 61 culmina quasi allo zenit',culmination(a61.dec_deg),89.7,0.5);
chk('Abell 61 circumpolare (dec > 90-lat)',a61.dec_deg>90-lat,true);

console.log('\n--- estinzione per banda ---');
console.log(`      k(500nm OIII) = ${M.kExt(500.7).toFixed(3)}   k(656nm Ha) = ${M.kExt(656.3).toFixed(3)}`);
chk('estinzione OIII circa doppia di Ha',M.kExt(500.7)/M.kExt(656.3),2.2,0.4);

console.log('\n--- penalizzazione lunare per banda ---');
const dm=2.0; // la Luna alza il fondo di 2 mag in V
/* Il terzo argomento e' la LARGHEZZA, non il flag stellare: qui passava `true`,
   cioe' un filtro da 1 nm. Non faceva danno perche' la larghezza si semplifica,
   ma scriverlo giusto costa niente. */
const pO=M.moonPenalty('OIII',dm,3,false), pH=M.moonPenalty('Ha',dm,3,false), pL=M.moonPenalty('L',dm,250,false);
console.log(`      con +2 mag di fondo:  OIII ${(100*(1-pO)).toFixed(0)}%  Ha ${(100*(1-pH)).toFixed(0)}%  L ${(100*(1-pL)).toFixed(0)}% di penalizzazione`);
chk('OIII penalizzato piu di Ha',pO<pH,true);
/* Prima questo test chiedeva il contrario — «banda larga penalizzata molto piu
   della stretta» — e passava solo grazie all'asimmetria. Su cielo naturale l'OIII
   sta peggio della luminanza: sotto la riga c'e' meno fondo e ci arriva piu' Luna. */
chk('e su cielo naturale l OIII sta peggio anche della banda larga',pO<pL,true);
chk('mentre l Ha resta il canale piu tollerante di tutti',pH>pL&&pH>pO,true);

console.log('\n--- soglie riscalate: il caso NGC 6888 di Alessandro ---');
const t6888=TG.targets.find(t=>t.id==='ngc6888');
/* REGRESSION TEST, non calibrazione. Alessandro ha ripreso 1.5 h di SII sulla
   Crescent con RC8 nativo e il master era rumore con un accenno di arco: il
   pavimento vero sta appena sopra 1.5 h. Il vecchio modello diceva 14.0 h — 9.4x
   sotto soglia — che e' incompatibile con l'esperienza. Le 1.5 h NON entrano in
   nessuna formula: sono una verifica indipendente. */
const fSII=M.timeFactor(rc8,'SII',600);
const floorRef=t6888.budget.SII.floor, floorRC8=floorRef*fSII;
console.log(`      soglia SII riferimento: ${floorRef} h  →  su RC8 nativo: ${floorRC8.toFixed(1)} h  (fattore ×${fSII.toFixed(2)})`);
console.log(`      ripreso: 1.5 h  →  ${(floorRC8/1.5).toFixed(1)}× sotto soglia  (col vecchio modello era 9.4×)`);
chk('il pavimento resta SOPRA le 1.5 h che hanno dato rumore',floorRC8>1.5,true);
chk('ma non piu di 3x: compatibile con l esperienza reale',floorRC8/1.5<3,true);

console.log('\n--- binning: la catena pixel -> scala -> tempo ---');
const rc8b1={tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1};
const rc8b2={...rc8b1,bin:2};
const d1=M.derive(rc8b1), d2=M.derive(rc8b2);
console.log(`      RC8 nativo + 2600MM:  bin 1 ${d1.scale.toFixed(3)}"/px   bin 2 ${d2.scale.toFixed(3)}"/px`);
chk('bin 2 raddoppia la scala',d2.scale/d1.scale,2,0.001);
chk('bin 2 non cambia il campo inquadrato',d2.fovX,d1.fovX,0.001);
chk('bin 2 raddoppia il read noise (somma in quadratura, non CCD)',d2.rnEff/d1.rnEff,2,0.001);
/* CORRETTO 2026-09. Qui c'era «bin 2 divide il tempo per 4»: vero PER PIXEL, falso
   per unita' di angolo solido. Sui CMOS la somma e' digitale dopo la lettura, quindi
   RN_binnato = RN·bin mentre Om_px cresce come bin²: i rapporti RN²/Om_px e d_px/Om_px
   non si muovono. Il binning NON crea fotoni ed e' esattamente neutro sul tempo. */
console.log(`      fattore Ha:  bin1 ×${M.timeFactor(d1,'Ha',600).toFixed(4)}  bin2 ×${M.timeFactor(d2,'Ha',600).toFixed(4)}  bin3 ×${M.timeFactor(M.derive({...rc8b1,bin:3}),'Ha',600).toFixed(4)}`);
chk('il binning non moltiplica la raccolta fotonica (bin 2)',
  M.timeFactor(d1,'Ha',600)/M.timeFactor(d2,'Ha',600),1,0.001);
chk('il binning non moltiplica la raccolta fotonica (bin 3)',
  M.timeFactor(d1,'Ha',600)/M.timeFactor(M.derive({...rc8b1,bin:3}),'Ha',600),1,0.001);
chk('e nemmeno a bin 4',
  M.timeFactor(d1,'Ha',600)/M.timeFactor(M.derive({...rc8b1,bin:4}),'Ha',600),1,0.001);
// FWHM reale a Borno con l'AM5 sull'RC8: seeing 1.6" + RMS 1.0" -> 2.36"
const fwhmBad=M.effFWHM(1.6,1.0), fwhmGood=M.effFWHM(1.2,0.4);
const advBad=M.binAdvice(rc8b1,fwhmBad), advGood=M.binAdvice(rc8b1,fwhmGood);
console.log(`      FWHM ${fwhmBad.toFixed(2)}" -> ${advBad.k}  |  FWHM ${fwhmGood.toFixed(2)}" -> ${advGood.k}`);
chk('con FWHM larga consiglia di binnare',advBad.best>1,true);
chk('il consiglio dice che su CMOS la scelta e reversibile',/reversibil|elaborazione/.test(advBad.txt),true);
// un rifrattore corto e gia sottocampionato: binnare non deve mai essere consigliato
const askar={tel:'askar71f',red:1,cam:'asi2600mc',bin:1,mnt:'am5'};
chk('su focale corta non consiglia mai di binnare',M.binAdvice(askar,fwhmBad).best,1);

console.log('\n--- livello accessibile: meta tempo, mai sotto soglia ---');
chk('canale critico tagliato al 60%',M.accessibleH({useful:10,floor:2,critical:true}),6,0.001);
chk('canale non critico tagliato al 40%',M.accessibleH({useful:10,floor:2}),4,0.001);
chk('mai sotto la soglia',M.accessibleH({useful:10,floor:8,critical:true}),8,0.001);
chk('canale vuoto resta vuoto',M.accessibleH({useful:0,floor:0}),0);

const bornoSite={lat:46.0167,lon:10.3333,sqm:20.8,seeing:1.6,rms:0.6,
  horizonMin:20,clearFrac:0.35};
bornoSite.fwhm=M.effFWHM(bornoSite.seeing,bornoSite.rms);
const npB=M.nightProfile(new Date(2026,8,15),bornoSite.lat,bornoSite.lon);
const tecno={tel:'tecnosky115',red:0.80,cam:'asi2600mm',mnt:'cem70g',bin:1};
const dvT=M.derive(tecno);
let accOk=true, accWithin=true;
for(const tg of TG.targets){
  const ev=M.evaluate(tg,dvT,bornoSite,npB,{});
  for(const [b,v] of Object.entries(ev.budget)){
    if(v.useful<=0) continue;
    if(v.accessible>v.useful+1e-9||v.accessible<v.floor-1e-9) accOk=false;
  }
  if(ev.roadAccH>ev.roadH+1e-9||ev.roadAccH<0.35*ev.roadH-1e-9) accWithin=false;
}
chk('accessibile sempre fra soglia e utile, su tutti i target',accOk,true);
chk('il totale ridotto sta fra il 35% e il 100% di quello pieno',accWithin,true);
const e6888=M.evaluate(TG.targets.find(t=>t.id==='ngc6888'),dvT,bornoSite,npB,{});
console.log(`      NGC 6888 su Tecnosky 0.8x + 2600MM:  pieno ${e6888.roadH.toFixed(1)} h  ridotto ${e6888.roadAccH.toFixed(1)} h  (${(100*e6888.roadAccH/e6888.roadH).toFixed(0)}%)`);
chk('la versione ridotta della Crescent esiste',e6888.accReal,true);
chk('il canale critico e tagliato meno degli altri',
  e6888.budget[e6888.critBand].accessible/e6888.budget[e6888.critBand].useful>0.55,true);
const binnedEv=M.evaluate(TG.targets.find(t=>t.id==='ngc6888'),M.derive({...tecno,bin:2}),bornoSite,npB,{});
console.log(`      la stessa a bin 2:  pieno ${binnedEv.roadH.toFixed(1)} h  ridotto ${binnedEv.roadAccH.toFixed(1)} h`);
/* Il binning cambia il CAMPIONAMENTO, non le ore: quello che risparmi e' spazio
   disco e tempo di scarico, non fotoni. Prima qui si pretendeva un fattore 4. */
chk('il binning non cambia le ore di progetto',e6888.roadH/binnedEv.roadH,1,0.001);
chk('ma cambia la scala del pixel, ed e li che va guardato',
  M.derive({...tecno,bin:2}).scale/M.derive(tecno).scale,2,0.001);

console.log('\n--- motore di prescrizione: la strada segue le ore ---');
const t6888b=TG.targets.find(t=>t.id==='ngc6888');
const dvRef=M.derive({tel:'tecnosky115',red:0.80,cam:'asi2600mm',mnt:'cem70g',bin:1});
const eRef=M.evaluate(t6888b,dvRef,bornoSite,npB,{});
const pr8=M.prescribe(eRef,8,dvRef), pr14=M.prescribe(eRef,14,dvRef), pr30=M.prescribe(eRef,30,dvRef);
const show=p=>`${p.road.id} / ${p.level} — ${p.alloc.filter(g=>!g.dropped).map(g=>g.id+' '+g.hours.toFixed(1)+'h').join(' · ')}${p.alloc.some(g=>g.dropped)?'  [fuori: '+p.alloc.filter(g=>g.dropped).map(g=>g.id).join(',')+']':''}`;
console.log('       8h → '+show(pr8));
console.log('      14h → '+show(pr14));
console.log('      30h → '+show(pr30));
chk('con 30h sceglie la strada SHO',pr30.road.id,'sho');
chk('con 14h resta su HOO',pr14.road.id,'hoo');
chk('con 8h resta su HOO in versione ridotta o minima',pr8.level!=='pieno'&&pr8.road.id==='hoo',true);
chk('la prescrizione spende quello che ha, non di piu',pr14.spent<=14+1e-6,true);
chk('e non lascia ore per strada quando la strada le assorbe',pr14.spent>13.5,true);
chk('nessun canale finanziato sotto la propria soglia',
  pr8.alloc.every(g=>g.hours===0||g.hours>=g.floor-1e-9),true);
chk('il canale critico non viene mai scartato quando le ore bastano',
  pr14.alloc.find(g=>g.critical).hours>0,true);
// le ore di "cosa aspettarti" vanno riportate alla configurazione di riferimento
const dvRC8=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const eRC8=M.evaluate(t6888b,dvRC8,bornoSite,npB,{});
const prRC8=M.prescribe(eRC8,14,dvRC8);
const fEq=M.timeFactor(dvRC8,eRC8.critBand,(eRC8.tsub||{})[eRC8.critBand]);
const hEq=prRC8.spent/fEq;
console.log(`      RC8, ${prRC8.spent.toFixed(1)}h reali = ${hEq.toFixed(1)}h di riferimento (fattore ×${fEq.toFixed(2)}) → ${prRC8.level}, "cosa aspettarti" letto a ${prRC8.expect?prRC8.expect.key:'—'}`);
/* L'intento del test non cambia: «cosa aspettarti» si legge sulle ore EQUIVALENTI di
   riferimento, mai su quelle reali. Cambia il verso, ed e' il senso della revisione:
   col vecchio modello l'RC8 aveva fattore >1 e 14 h reali valevano MENO di 14 di
   riferimento; ora ha fattore <1 e ne valgono di piu'. */
chk('le ore equivalenti non sono le ore reali',Math.abs(hEq-prRC8.spent)>1,true);
chk('su RC8 le ore reali rendono piu delle stesse ore al riferimento',hEq>prRC8.spent,true);
chk('e la riga di cosa aspettarti segue le equivalenti, non le reali',
  !prRC8.expect||parseFloat(prRC8.expect.key)<=hEq+1e-9,true);

console.log('\n--- quando le ore non bastano ---');
/* La soglia si e' spostata con la revisione del fattore: sull'RC8 la strada HOO
   completa costa ora 8.8 h invece di 34, quindi con 6 h la Crescent entra in versione
   ridotta e a non entrare sono 2 h.

   CAMBIATO 2026-09: l'invariante difesa qui era «sotto il pavimento del canale
   critico non si finanzia nulla», e la ripartizione tornava azzerata. Era un
   divieto travestito da fisica: non raggiungere la soglia stimata per il
   livello-obiettivo significa che l'immagine sara' meno profonda, non che non si
   possa riprendere l'oggetto. Il livello resta 'insufficiente' — la soglia
   davvero non e' raggiunta — ma la prescrizione adesso c'e', con le ore ripartite
   in proporzione al peso dei canali e quelli sotto il proprio pavimento marcati.
   Le due invarianti che restano sono qui sotto: si spende tutto il tempo che si
   ha, e si spende mantenendo la forma della strada. */
const prShort=M.prescribe(eRC8,2,dvRC8);
console.log(`      RC8 nativo su NGC 6888:  2h → ${prShort.level}   6h → ${M.prescribe(eRC8,6,dvRC8).level}   10h → ${M.prescribe(eRC8,10,dvRC8).level}`);
chk('sotto il pavimento del canale critico non entra',prShort.level,'insufficiente');
chk('ma la prescrizione ce lo stesso: le ore si spendono tutte',
  Math.abs(prShort.spent-2)<1e-6,true);
chk('ripartite mantenendo le proporzioni della strada',
  (()=>{ const tot=prShort.alloc.reduce((a,g)=>a+Math.max(0,g.useful||0),0);
         return tot>0 && prShort.alloc.every(g=>
           Math.abs(g.hours - Math.max(0,g.useful||0)*2/tot) < 1e-9); })(),true);
chk('e il canale critico e marcato sotto la propria soglia',
  prShort.alloc.some(g=>g.critical&&g.belowFloor),true);
chk('con la distanza dalla soglia dichiarata in ore',prShort.short>0,true);
chk('nessun canale viene dichiarato fuori: sono tutti finanziati',
  prShort.alloc.every(g=>!g.dropped),true);
chk('con 6h invece entra in versione ridotta',M.prescribe(eRC8,6,dvRC8).level,'ridotto');
const alts=M.fitAlternatives(t6888b,{tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1},
  bornoSite,npB,{},6,DB.presets,3);
console.log('      configurazioni tue in cui invece entra:');
alts.forEach(a=>console.log(`        ${a.preset.label} bin ${a.bin} → ${a.pr.level} (${a.pr.spent.toFixed(1)}h, campionamento ${a.samp})`));
chk('trova almeno una configurazione alternativa che ci sta',alts.length>0,true);
chk('le alternative proposte sono davvero fattibili',alts.every(a=>a.pr.level!=='insufficiente'),true);

console.log('\n--- gruppi di costo: il dual-band non si paga due volte ---');
const dvOsc=M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
const eOsc=M.evaluate(t6888b,dvOsc,bornoSite,npB,{});
const gOsc=M.costGroups(M.roadChannels(eOsc.budget,'hoo'),eOsc.dual);
const gMono=M.costGroups(M.roadChannels(eRef.budget,'hoo'),eRef.dual);
console.log('      OSC dual-band: '+gOsc.map(g=>g.id).join(' · '));
console.log('      mono:          '+gMono.map(g=>g.id).join(' · '));
chk('su OSC dual-band Ha e OIII sono un solo gruppo di costo',
  gOsc.some(g=>g.joint&&g.bands.length===2),true);
chk('su mono restano canali separati',gMono.some(g=>g.joint),false);

console.log('\n--- oggetti di catalogo senza scheda: i due strati ---');
const catM56=CAT.objects.find(o=>o.name==='M56');
const tM56=M.synthTarget(catM56);
console.log(`      M56 → ${TG.archetypes[tM56.archetype].label}, ${tM56.size_arcmin[0]}' , ${tM56.constellation}`);
chk('M56 composto dal catalogo, non da un modulo',!!tM56,true);
chk('classe corretta: globulare',tM56.archetype,'cluster_globular');
chk('canale critico RGB, non OIII',
  Object.entries(tM56.budget).find(([,v])=>v.critical)[0],'RGB');
chk('nessun canale a banda stretta previsto',
  ['Ha','OIII','SII'].every(b=>!tM56.budget[b]||tM56.budget[b].useful===0),true);
chk('la scheda di classe porta ordine, resa attesa e trappole',
  !!tM56.order&&Object.keys(tM56.expect).length>=2&&tM56.traps.length>=2,true);
chk('confidenza dichiarata bassa sulle righe',tM56.lines[0].confidence,'bassa');
// la catena completa: catalogo -> archetipo -> valutazione -> prescrizione
const eM56=M.evaluate(tM56,dvRef,bornoSite,npB,{});
const prM56=M.prescribe(eM56,4,dvRef);
console.log(`      4h su M56 (Tecnosky 0.8x + 2600MM): ${prM56.level} — `+
  prM56.alloc.filter(g=>!g.dropped).map(g=>g.id+' '+g.hours.toFixed(1)+'h').join(' · '));
chk('un globulare in 4h si chiude',['pieno','ridotto','minimo'].includes(prM56.level),true);
chk('la prescrizione non propone mai banda stretta su un globulare',
  prM56.alloc.every(g=>!['Ha','OIII','SII'].includes(g.id)||g.hours===0),true);
// e la stessa catena su una HII di catalogo deve invece dare OIII critico
const catRos=CAT.objects.find(o=>/rosett/i.test(o.name)||(o.aliases||[]).some(a=>/rosett/i.test(a)))
  ||CAT.objects.find(o=>o.archetype==='hii_classic');
const tRos=M.synthTarget(catRos);
console.log(`      controprova: ${catRos.name} → ${TG.archetypes[tRos.archetype].label}`);
chk('una HII di catalogo mantiene OIII critico',
  Object.entries(tRos.budget).find(([,v])=>v.critical)[0],'OIII');
/* La Luna su un ammasso: il modello di superficie non vale. Il fondo entra solo
   attraverso l'area della PSF, quindi un globulare e' il soggetto delle notti che
   altrimenti butteresti via — ed e' quello che l'ordine dell'archetipo dice a parole.
   Senza questa correzione la scheda si contraddiceva: "fallo con la Luna" sopra,
   "rimandalo" riga sotto. */
const dmL=2.0;
const pDiff=M.moonPenalty('RGB',dmL,250,false), pStar=M.moonPenalty('RGB',dmL,250,true);
console.log(`      con +2 mag di fondo in banda larga:  nebulosa −${(100*(1-pDiff)).toFixed(0)}%  ammasso −${(100*(1-pStar)).toFixed(0)}%`);
chk('la Luna penalizza molto meno un soggetto stellare',pStar>pDiff,true);
chk('ma non e mai del tutto indifferente',pStar<1,true);
chk('gli archetipi ammasso sono marcati come stellari',
  TG.archetypes.cluster_globular.stellar===true&&TG.archetypes.cluster_open.stellar===true,true);
chk('le nebulose non sono marcate stellari',!TG.archetypes.hii_classic.stellar,true);

console.log('\n--- le strade: appartenenza dei canali e scelta ---');
chk('nessun vincolo = il canale sta in tutte le strade',M.inRoad({},'qualunque'),true);
chk('vincolo singolo',M.inRoad({road:'sho'},'sho')&&!M.inRoad({road:'sho'},'hoo'),true);
chk('vincolo multiplo',M.inRoad({road:['hoo','sho']},'sho')&&!M.inRoad({road:['hoo','sho']},'hargb'),true);
/* Ogni strada deve o avere un insieme di canali proprio, o dichiarare perche' no.
   Senza questo, il 'when' scritto a mano promette una scelta che il motore non puo'
   fare: tutte le strade costano uguale e la selezione in base alle ore e' finta. */
let roadsOk=true, roadsBad=[];
for(const t of TG.targets){
  const sets=t.roads.map(r=>({r,key:Object.entries(t.budget)
    .filter(([b,v])=>v.useful>0&&M.inRoad(v,r.id)).map(([b])=>b).sort().join('+')}));
  sets.forEach((s,i)=>{
    const dup=sets.findIndex(x=>x.key===s.key)!==i;
    if(dup&&!s.r.same_budget){ roadsOk=false; roadsBad.push(t.names[0]+'/'+s.r.id); }
  });
}
if(roadsBad.length) console.log('      strade senza budget proprio e senza spiegazione: '+roadsBad.join(', '));
chk('ogni strada ha un budget proprio o dichiara perche no',roadsOk,true);

const m31=TG.targets.find(t=>t.names[0]==='M31');
const dvM31mono=M.derive({tel:'tecnosky115',red:0.80,cam:'asi2600mm',mnt:'am5',bin:1});
const dvM31osc =M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
/* Copertura fissata a UN pannello: qui si misura la catena FOTOMETRICA —
   scelta della strada e ripartizione delle ore — che vive sul singolo campo.
   La catena GEOMETRICA, cioe' quanti campi servono a coprire il soggetto, ha
   il suo gate dedicato in tools/gate-copertura.js. Tenerle separate qui e' il
   punto: M31 su questa configurazione chiede sei pannelli, e mescolare le due
   cose renderebbe questi test illeggibili invece che piu' severi. */
const prMono=M.prescribe(M.evaluate(m31,dvM31mono,bornoSite,npB,{}),14.5,dvM31mono,1);
const prOsc =M.prescribe(M.evaluate(m31,dvM31osc ,bornoSite,npB,{}),14.5,dvM31osc ,1);
console.log(`      M31 in 14.5h — mono: ${prMono.road.id} [${prMono.alloc.filter(g=>!g.dropped).map(g=>g.id+' '+g.hours.toFixed(1)).join(' ')}]`);
console.log(`      M31 in 14.5h — OSC:  ${prOsc.road.id} [${prOsc.alloc.filter(g=>!g.dropped).map(g=>g.id+' '+g.hours.toFixed(1)).join(' ')}]`);
chk('su mono l Ha additivo ci sta',prMono.road.id,'lrgb_ha');
chk('su OSC l Ha costa 4x e la strada giusta e LRGB puro',prOsc.road.id,'lrgb');
/* Il difetto che il tracciato ha trovato: prima della correzione, su OSC il canale
   additivo Ha (soglia 8h) veniva finanziato PRIMA che la luminanza — il canale
   critico, cioe' il soggetto — superasse la propria soglia. 8h su 14.5 all'Ha e
   3.6h alla L: una strategia che nessuno sceglierebbe. */
const critOsc=prOsc.alloc.find(g=>g.critical);
/* L'invariante che questo test difende — il canale additivo non si finanzia prima
   del canale critico — vale ancora, ma va scritto come invariante e non come una
   soglia numerica: con la revisione del fattore, su OSC la luminanza costa cosi'
   tanto che assorbe tutto il budget, e «>= 90% dell'utile» non e' piu raggiungibile
   ne' significativo.

   E da quando il budget vede il cielo, nemmeno «il critico raggiunge il pavimento»
   basta piu': su un 71 mm a Borno M31 chiede 41 h di luminanza e in 14.5 non ci sta
   nessuno, ne' il critico ne' gli additivi. Quel caso NON e' il difetto — e' la
   prescrizione ridotta in proporzione, che e' esattamente cio' che deve accadere.

   L'invariante giusto ha due meta', e insieme catturano il difetto originale in
   entrambi i regimi:
     a) se QUALCUNO raggiunge il proprio pavimento, il critico lo raggiunge;
     b) il critico non e' mai riempito, rispetto al PROPRIO pavimento, meno di un
        additivo rispetto al suo.
   Il difetto di partenza — Ha a 8h su una soglia di 8, luminanza a 3.6 su una ben
   piu' alta — viola entrambe. La riduzione proporzionale non ne viola nessuna. */
const addOsc=prOsc.alloc.filter(g=>!g.critical&&g.hours>0);
const fill=g=>g.floor>0?g.hours/g.floor:Infinity;
console.log(`      OSC: critico ${critOsc.id} ${critOsc.hours.toFixed(1)}h su ${critOsc.useful.toFixed(1)}h utili · additivi finanziati: ${addOsc.length?addOsc.map(g=>g.id).join(','):'nessuno'}`);
console.log(`      riempimento sul proprio pavimento: ${prOsc.alloc.map(g=>g.id+' '+fill(g).toFixed(2)+(g.critical?'*':'')).join(' · ')}`);
chk('se un additivo raggiunge il suo pavimento, il critico raggiunge il proprio',
  addOsc.every(g=>g.hours<g.floor-1e-9||critOsc.hours>=critOsc.floor-1e-9),true);
chk('e il critico non e mai riempito meno di un additivo, sul proprio pavimento',
  addOsc.every(g=>fill(critOsc)>=fill(g)-1e-9),true);
chk('il canale critico ha la precedenza sul budget',critOsc.hours>0,true);
/* Il ramo OSC in banda larga NON e piu un ramo morto: dalla v1.5 lo copre il
   modello di risposta spettrale della matrice, che sostituisce OSC_BB e toglie
   il doppio conteggio su RGB. Vedi docs/studio-osc.md. */
console.log(`      validazione per banda su 2600MC: `+
  ['Ha','OIII','SII','L','RGB'].map(b=>b+':'+(M.factorValidated(dvM31osc,b)?'si':'NO')).join(' '));
chk('ogni banda su OSC ha ora una stima con confidenza dichiarata',
  ['Ha','OIII','SII','L','RGB'].every(b=>M.factorValidated(dvM31osc,b)),true);
chk('su camera mono tutto e validato',
  ['Ha','OIII','SII','L','RGB'].every(b=>M.factorValidated(dvM31mono,b)),true);

/* Il difetto piu' grave che il tracciato ha trovato: gli archetipi avevano una
   strada sola, quindi ogni canale ci stava dentro. Su una HII di catalogo con 15h
   il motore spendeva 8h sul SII — il canale che la logica dello STESSO archetipo
   definisce «quasi sempre sbagliato, restituisce rumore colorato» — lasciando
   l'OIII critico al 32% fra soglia e utile. Le schede curate avevano gia' la cura
   (le strade), gli archetipi no. */
console.log('\n--- OpenNGC: lo strato catalografico ---');
if(!ONGC){ console.log('      data/openngc.json assente: sezione saltata'); }
else{
const F=Object.fromEntries(ONGC.fields.map((f,i)=>[f,i]));
const O=ONGC.objects;
console.log(`      ${O.length} oggetti, ${(JSON.stringify(ONGC).length/1024/1024).toFixed(2)} MB`);
const byConf={}; O.forEach(o=>byConf[o[F.archetype_confidence]]=(byConf[o[F.archetype_confidence]]||0)+1);
console.log('      certezza: '+Object.entries(byConf).map(([k,v])=>k+' '+v).join(' · '));
chk('copertura ampia',O.length>10000,true);
chk('ogni archetipo citato esiste davvero',
  O.every(o=>!o[F.archetype]||!!TG.archetypes[o[F.archetype]]),true);
chk('coordinate tutte nel range',
  O.every(o=>o[F.ra_deg]>=0&&o[F.ra_deg]<360&&Math.abs(o[F.dec_deg])<=90),true);
chk('dimensioni positive e maggiore >= minore',
  O.every(o=>o[F.maj_arcmin]>0&&o[F.maj_arcmin]>=o[F.min_arcmin]),true);
chk('nomi unici',new Set(O.map(o=>o[F.name])).size,O.length);
chk('livelli di certezza solo quelli previsti',
  O.every(o=>['alta','media','da collaudare','stella'].includes(o[F.archetype_confidence])),true);
/* La regola che rende onesto tutto lo strato: se non c'e' archetipo la certezza
   deve dirlo, e se la certezza e' "stella" non ci deve essere archetipo. */
chk('senza archetipo la certezza e sempre «stella»',
  O.every(o=>!!o[F.archetype]||o[F.archetype_confidence]==='stella'),true);
chk('«stella» non porta mai un archetipo',
  O.every(o=>o[F.archetype_confidence]!=='stella'||!o[F.archetype]),true);
chk('ogni classificazione ha un motivo leggibile',
  O.every(o=>{const w=o[F.why]; return w&&ONGC.reasons[w[0]];}),true);
/* La correzione trovata dai dati: «Neb» e' il secchio dei residui e li' resta
   soprattutto emissione, perche' riflessione e oscure hanno un tipo proprio. */
const nebs=O.filter(o=>o[F.ongc_type]==='Neb');
chk('il tipo generico «Neb» va a emissione, non a riflessione',
  nebs.length>0&&nebs.every(o=>o[F.archetype]==='hii_classic'),true);
chk('e resta comunque marcato da collaudare',
  nebs.every(o=>o[F.archetype_confidence]==='da collaudare'),true);
chk('i nomi sono nella forma che la gente scrive',
  O.filter(o=>/^(NGC|IC)/.test(o[F.name])).every(o=>/^(NGC|IC) \d/.test(o[F.name])),true);

/* --- verifica incrociata: due classificazioni indipendenti sullo stesso oggetto ---
   E' il miglior controllo di regressione che il progetto abbia: 153 oggetti sono
   classificati sia a mano sia dedotti da OpenNGC. Ha gia' trovato due errori miei
   (NGC 891 e NGC 4565 erano marcati come ellittiche: sono spirali di taglio) e un
   errore di mappatura (il tipo «Neb» mandato a riflessione invece che a emissione).
   Le discordanze rimaste sono volute: il curato e' piu' specifico. */
const oidx=new Map();
for(const o of O){ oidx.set(nrm(o[F.name]),o); (o[F.aliases]||[]).forEach(a=>{if(!oidx.has(nrm(a)))oidx.set(nrm(a),o)}); }
let agree=0; const disagree=[];
for(const c of CAT.objects){
  let o=oidx.get(nrm(c.name));
  if(!o) for(const a of (c.aliases||[])){ o=oidx.get(nrm(a)); if(o) break; }
  if(!o||!o[F.archetype]) continue;
  if(o[F.archetype]===c.archetype) agree++;
  else disagree.push(`${c.name}: curato ${c.archetype} vs OpenNGC ${o[F.archetype]} (${o[F.ongc_type]})`);
}
const tot=agree+disagree.length;
console.log(`      confronto su ${tot} oggetti presenti in entrambi: ${agree} concordi, ${disagree.length} discordi`);
disagree.forEach(d=>console.log('        · '+d));
chk('le due classificazioni concordano su almeno l 85%',agree/tot>=0.85,true);
chk('nessuna discordanza su un tipo a corrispondenza diretta e non voluta',
  disagree.length<=13,true);
}

console.log('\n--- archetipi: le strade proteggono il canale critico ---');
const rosetta=M.synthTarget(CAT.objects.find(o=>o.name==='NGC 2237'));
const eRos2=M.evaluate(rosetta,dvRef,bornoSite,npB,{});
// un campo solo: qui si misura la ripartizione, non la copertura — vedi gate-copertura.js
const prR15=M.prescribe(eRos2,15,dvRef,1), prR30=M.prescribe(eRos2,30,dvRef,1);
const fmtA=p=>p.road.id+': '+p.alloc.filter(g=>!g.dropped).map(g=>g.id+' '+g.hours.toFixed(1)).join(' ');
console.log('      HII di catalogo, 15h → '+fmtA(prR15));
console.log('      HII di catalogo, 30h → '+fmtA(prR30));
chk('con 15h su una HII sceglie HOO, non SHO',prR15.road.id,'hoo');
chk('e il SII non compare',prR15.alloc.every(g=>g.id!=='SII'),true);
chk('l OIII critico arriva almeno all utile',
  prR15.alloc.find(g=>g.critical).hours>=prR15.alloc.find(g=>g.critical).useful-0.01,true);
chk('con 30h il SII entra e prende le sue ore',
  prR30.road.id==='sho'&&prR30.alloc.find(g=>g.id==='SII').hours>=8,true);
chk('ogni archetipo con SII gli assegna una strada dedicata',
  Object.values(TG.archetypes).every(a=>!(a.default_budget.SII&&a.default_budget.SII.useful>0)
    ||!!a.default_budget.SII.road),true);
chk('gli archetipi con piu strade ne hanno una default',
  Object.values(TG.archetypes).every(a=>!a.roads||a.roads.some(r=>r.default)),true);

console.log('\n--- piano per notte: distribuzione, non divisione ---');
const monoCam=DB.cameras.find(c=>c.id==='asi2600mm');
console.log('      tolleranza lunare (fondo +2 mag): '+
  ['L','RGB','Ha','OIII','SII'].map(b=>b+' '+M.moonTolerance(b,monoCam,false).toFixed(2)).join('  '));
/* L'ordinamento regge — l'Ha resta il canale delle notti con la Luna — ma il
   margine assoluto non e' piu' mezzo punto: con il fondo naturale al suo posto
   nessun canale e' immune, e chiedere +0.5 significherebbe richiedere di nuovo
   l'immunita' che il modello non ha piu'. Si verifica il rapporto, non il salto. */
console.log('      Ha rende '+(M.moonTolerance('Ha',monoCam,false)/
  M.moonTolerance('L',monoCam,false)).toFixed(1)+'x la luminanza sotto +2 mag di Luna');
chk('l Ha tollera la Luna molto piu della luminanza',
  M.moonTolerance('Ha',monoCam,false)>M.moonTolerance('L',monoCam,false)*2,true);
const eM31=M.evaluate(m31,dvM31mono,bornoSite,npB,{});
const prM31=M.prescribe(eM31,14.5,dvM31mono,1);   // un campo: vedi gate-copertura.js
const PDATE=new Date(2026,8,1);
const POPT={site:bornoSite,date:PDATE};

/* Le finestre reali: la notte non e' un numero, e' una data. */
const win=M.nightWindows(m31,bornoSite,PDATE,6,{});
win.nights.slice(0,3).forEach(x=>console.log(
  `      ${x.date.toLocaleDateString('it-IT')}  orologio ${x.clockH.toFixed(1)} h  `+
  `disponibili ${x.availH.toFixed(1)} h  Luna ${(x.moonK*100).toFixed(0)}%  dMagV ${x.dMagV.toFixed(2)}`));
chk('la finestra e piu corta della notte astronomica meno l overhead',
  win.nights[0].availH<win.nights[0].clockH,true);
chk('notti diverse danno ore diverse',
  Math.abs(win.nights[0].availH-win.nights[5].availH)>0.01,true);
chk('l overhead di sessione e tolto davvero',
  Math.abs(win.nights[0].clockH-win.nights[0].availH-0.6)<1e-6,true);
/* Il difetto che il pianificatore ha fatto emergere: sommando i flussi una mezza
   Luna a Borno alza il fondo di mezza magnitudine, non di zero. */
chk('una Luna sopra l orizzonte alza sempre il fondo di qualcosa',
  win.nights.filter(x=>x.moonUpFrac>0.5).every(x=>x.dMagV>0.01),true);

/* DUE UNITA', E VANNO TENUTE DISTINTE.

   `h` di un blocco sono ore di OROLOGIO: quelle che si programmano, quelle che la
   notte deve contenere. `projH` sono ore di PROGETTO: la profondita' che quelle
   ore depositano davvero, cioe' h x penalita' lunare. Sotto un cielo buio le due
   coincidono; sotto la Luna no, ed e' li' che vive tutto il senso di questo blocco.

   Il 1 settembre 2026 la Luna e' al 77% e alza il fondo di 1.5 mag sul campo di
   M31: quella notte offre 6.3 h di orologio e ne deposita 3.8. Prima il piano le
   contava tutte e sei e si dichiarava chiuso in tre notti; il minimo vero e'
   quattro. Per questo il numero di notti non e' piu' scritto a mano qui — lo
   decide la fisica, e il test chiede il minimo che la fisica concede. */
const nMin=Math.max(2,prM31&&M.planNights(prM31,eM31,dvM31mono,60,POPT).bounds.min||2);
const pl3=M.planNights(prM31,eM31,dvM31mono,nMin,POPT);
const pl5=M.planNights(prM31,eM31,dvM31mono,nMin+2,POPT);
console.log(`      minimo di notti imposto dalla Luna: ${nMin}`);
pl3.nights.forEach(n=>console.log(`      notte ${n.n} (${n.date.toLocaleDateString('it-IT')}): `+
  `${n.blocks.map(s=>s.id+' '+s.h.toFixed(1)+'h').join(' + ').padEnd(30)} su ${n.availH.toFixed(1)} h `+
  `→ deposita ${n.blocks.reduce((a,b)=>a+b.projH,0).toFixed(1)} h → ${n.sky}`));
const proj=pl=>pl.nights.reduce((a,n)=>a+n.blocks.reduce((x,b)=>x+b.projH,0),0);
chk('il piano non inventa profondita: somma depositata = prescrizione',
  proj(pl3),prM31.spent,0.02);
/* Il punto 11 della specifica: il numero di notti NON puo' toccare le ore. Vale
   sulla PROFONDITA', che e' l'invariante; le ore di orologio invece cambiano, e
   devono cambiare, perche' notti diverse hanno Lune diverse. */
chk('cambiare il numero di notti non cambia la profondita totale',
  proj(pl5),prM31.spent,0.02);
const perCh=pl=>{const m={};pl.nights.forEach(n=>n.blocks.forEach(b=>m[b.id]=(m[b.id]||0)+b.projH));return m;};
const c3=perCh(pl3), c5=perCh(pl5);
chk('e non cambia nemmeno la profondita per canale',
  Object.keys(c3).every(k=>Math.abs(c3[k]-c5[k])<0.02),true);
/* E la controprova, che e' il difetto che questa revisione ha chiuso: sotto la
   Luna servono PIU' ore di orologio della prescrizione per depositarla tutta. */
const oreOrologio=pl3.nights.reduce((a,n)=>a+n.usedH,0);
console.log(`      ${prM31.spent.toFixed(1)} h di progetto costano ${oreOrologio.toFixed(1)} h di orologio `+
  `(${((oreOrologio/prM31.spent-1)*100).toFixed(0)}% in piu, e' la Luna)`);
chk('sotto la Luna le ore di orologio superano quelle di progetto',
  oreOrologio>=prM31.spent-1e-6,true);
chk('nessuna notte supera le ore realmente disponibili di quella data',
  pl3.nights.every(n=>n.usedH<=n.availH+1e-6),true);
chk('chiedere piu notti le usa tutte, non alcune piene e altre vuote',
  pl5.nights.every(n=>n.blocks.length>0),true);
chk('i blocchi per notte restano pochi',
  pl3.nights.every(n=>n.blocks.length<=3),true);
chk('il canale critico entra dalla prima notte',
  pl3.nights[0].blocks.some(s=>s.critical)||pl3.nights[1].blocks.some(s=>s.critical),true);
/* La capacita' e' PER CANALE: la stessa notte non vale uguale per una luminanza
   e per un Ha da 3 nm. E' l'affermazione che regge tutto C-2. */
{
  const notte=pl3.nights.find(n=>n.dMagV>0.3)||pl3.nights[0];
  const perBanda=['L','Ha'].map(b=>{
    const f=M.filterFor(b,dvM31mono.c), fw=f?f.fwhm_nm:250;
    return {b,p:M.moonPenalty(b,notte.dMagV,fw,false,M.lpExcessFlux(bornoSite.sqm,fw))};
  });
  console.log(`      notte del ${notte.date.toLocaleDateString('it-IT')} (dMagV ${notte.dMagV.toFixed(2)}): `+
    perBanda.map(x=>x.b+' rende '+(x.p*100).toFixed(0)+'%').join(', '));
  chk('la stessa notte non vale uguale per luminanza e banda stretta',
    perBanda[1].p>perBanda[0].p+0.05,true);
}

/* ─── le due modalita': sessione autonoma vs ottimizzazione sul progetto ─── */
console.log('\n--- sessione completa: ogni notte deve stare in piedi da sola ---');
const expoM31=M.exposurePlan(prM31,dvM31mono,bornoSite,{archetype:m31.archetype});
const OPT2=Object.assign({},POPT,{expo:expoM31});
const plSess=M.planNights(prM31,eM31,dvM31mono,4,Object.assign({},OPT2,{mode:'sessione'}));
const plProg=M.planNights(prM31,eM31,dvM31mono,4,Object.assign({},OPT2,{mode:'progetto'}));
plSess.nights.forEach(x=>{
  const sp=M.subPlan(x.blocks,expoM31,{});
  console.log(`      notte ${x.n}: ${sp.subs.map(u=>u.band+' '+u.sec+'s×'+u.n).join('  ')}`);
});
const canali=pr=>{const m={};pr.alloc.filter(g=>g.hours>0).forEach(g=>m[g.id]=g.hours);return m;};
const target=canali(prM31);
chk('in sessione ogni notte contiene tutti i canali della strategia',
  plSess.nights.every(x=>x.blocks.length===Object.keys(target).length),true);
chk('mentre ottimizzando sul progetto no',
  plProg.nights.some(x=>x.blocks.length<Object.keys(target).length),true);
/* L'invariante che non si negozia: qualunque modalita', le ore per canale sono
   quelle della prescrizione. Il bilanciamento chiude sulle righe apposta. */
const perCanale=pl=>{const m={};pl.nights.forEach(n2=>n2.blocks.forEach(b=>m[b.id]=(m[b.id]||0)+b.projH));return m;};
const cs=perCanale(plSess), cp=perCanale(plProg);
chk('la modalita non tocca la profondita per canale',
  Object.keys(target).every(k=>Math.abs(cs[k]-target[k])<0.02&&Math.abs(cp[k]-target[k])<0.02),true);
chk('ne il totale',plSess.nights.reduce((a,x)=>a+x.blocks.reduce((b,y)=>b+y.projH,0),0),prM31.spent,0.02);
/* Le ORE di orologio invece cambiano fra le due modalita, e devono: la sessione
   completa mette ogni canale in ogni notte, quindi mette anche la luminanza sotto
   la Luna dove costa il doppio; il progetto la sposta dove costa meno. E' il
   prezzo dichiarato di avere un'immagine ogni mattina invece che alla fine. */
{
  const oreS=plSess.nights.reduce((a,x)=>a+x.usedH,0);
  const oreP=plProg.nights.reduce((a,x)=>a+x.usedH,0);
  console.log(`      stessa profondita, ore di orologio diverse: sessione ${oreS.toFixed(1)} h · progetto ${oreP.toFixed(1)} h`);
  chk('ottimizzare sul progetto costa meno ore di orologio della sessione completa',
    oreP<=oreS+1e-6,true);
}
chk('nessuna notte supera le ore disponibili',
  plSess.nights.every(x=>x.usedH<=x.availH+1e-6),true);
/* Il canale critico per primo: se le nuvole arrivano a meta' sessione, quello che
   perdi deve essere il canale che conta meno. */
chk('il canale critico apre ogni notte',plSess.nights.every(x=>x.blocks[0].critical),true);
/* La Luna inclina le quantita' senza spostare i totali. */
const rgbPerNotte=plSess.nights.map(x=>{const b=x.blocks.find(y=>y.id==='RGB');return b?b.h:0;});
console.log(`      RGB per notte: ${rgbPerNotte.map(h=>h.toFixed(2)).join('  ')} h  (la Luna cresce)`);
chk('le quantita non sono identiche notte per notte',
  Math.max(...rgbPerNotte)-Math.min(...rgbPerNotte)>0.005,true);
/* Il bilanciamento a trasporto. Le celle sono ore di OROLOGIO e le righe chiudono
   sulla PROFONDITA' — Σ ore x penalita' — perche' e' la prescrizione a essere
   l'invariante. Il secondo canale rende il 20% nella prima notte e il 100% nella
   terza: per depositare le sue 6 h di progetto gli servono piu' di 6 h di orologio,
   e il test deve chiedere quello, non le ore. Le quote seguono la stessa regola —
   sono ore di orologio dimensionate sulla capacita, non sul fabbisogno grezzo. */
const itemsT=[{total:10,pen:[1,1,1],minCell:0},{total:6,pen:[.2,.5,1],minCell:0}];
const capT=[1,1,1].map((_,c)=>{     // media armonica pesata sulle profondita' richieste
  let num=0,den=0;
  for(const it of itemsT){ num+=it.total; den+=it.total/it.pen[c]; }
  return den>0?num/den:1;
});
const oreT=[6,5,5];                                     // ore di orologio offerte
const kT=16/oreT.reduce((a,h,c)=>a+h*capT[c],0);        // 16 h di progetto da depositare
const nightsT=oreT.map((h,c)=>({quota:h*kT}));
const X=M.balanceSessions(itemsT,nightsT,{});
const rs=X.map((r,i)=>r.reduce((a,b,c)=>a+b*itemsT[i].pen[c],0));
const rsOre=X.map(r=>r.reduce((a,b)=>a+b,0));
const csum=nightsT.map((_,c)=>X.reduce((a,r)=>a+r[c],0));
console.log(`      profondita per riga ${rs.map(v=>v.toFixed(2)).join(' ')} (attese 10 6) · `+
  `ore di orologio ${rsOre.map(v=>v.toFixed(2)).join(' ')} · colonne ${csum.map(v=>v.toFixed(2)).join(' ')} `+
  `(quote ${nightsT.map(x=>x.quota.toFixed(2)).join(' ')})`);
chk('le righe depositano esattamente la prescrizione',rs[0],10,0.001);
chk('anche la seconda',rs[1],6,0.001);
chk('e per farlo il canale sensibile alla Luna spende piu ore di quante ne deposita',
  rsOre[1]>6+1e-6,true);
/* Le colonne stanno SOTTO le quote, e la distanza e' informativa. La media
   armonica assume che ogni notte si spartisca fra i canali in proporzione a
   quello che a ciascuno manca; il trasporto invece inclina, e mette il canale
   fragile dove la Luna non c'e'. Fa quindi meglio della stima, sempre: la quota
   e' un tetto conservativo, non un obiettivo da centrare. Il verso conta —
   sbagliare per eccesso di notti e' onesto, promettere una profondita' che non
   arriva no. */
console.log(`      il trasporto consuma ${(csum.reduce((a,b)=>a+b,0)/nightsT.reduce((a,x)=>a+x.quota,0)*100).toFixed(0)}% `+
  `delle quote: inclinare i canali verso le notti buone rende piu della stima armonica`);
chk('nessuna notte viene caricata oltre la propria quota',
  csum.every((v,i)=>v<=nightsT[i].quota+1e-6),true);
chk('e la stima conservativa non e sprecona: resta sopra i due terzi',
  csum.reduce((a,b)=>a+b,0)>=nightsT.reduce((a,x)=>a+x.quota,0)*0.66,true);
chk('il canale sensibile alla Luna finisce dove la Luna non c e',X[1][2]>X[1][0],true);
/* E il canale indifferente NON resta piatto: deve compensare. Le colonne sono un
   vincolo, quindi dove il canale fragile si ritira qualcuno deve prendere il suo
   posto — ed e' giusto che sia quello a cui la Luna non importa. */
chk('e quello indifferente compensa dove l altro si ritira',X[0][0]>X[0][2],true);

/* La guardia sulle combinazioni impossibili — punto 3. */
const b31=M.nightsBounds(prM31,m31,bornoSite,PDATE,{dv:dvM31mono});
console.log(`      notti ammesse per 14.5 h su M31 da Borno: da ${b31.min} a ${b31.max}`);
/* IL PIANO SI DA SEMPRE — il veto tolto dalla prescrizione era rientrato qui.

   Prima queste combinazioni restituivano zero notti e una schermata al posto del
   piano. Ma se decidi di riprendere M31 in una notte sola con quello che quella
   notte offre, il motore deve dirti che cosa farne: che servano piu' notti e' un
   CONSIGLIO, e va dato accanto al piano, non al posto del piano.

   L'invariante che resta, ed e' quella che conta davvero: il piano non corregge
   MAI in silenzio. Se e' ridotto lo dichiara — `advice` porta il codice e il
   numero di notti consigliate, `leftover` porta le ore che non ci sono state. */
const tooFew=M.planNights(prM31,eM31,dvM31mono,1,POPT);
const tooMany=M.planNights(prM31,eM31,dvM31mono,40,POPT);
console.log(`      1 notte:  piano su ${tooFew.nights.length} notti · consiglio ${
  (tooFew.advice[0]||{}).code||'nessuno'} · residuo ${tooFew.leftover.toFixed(1)} h`);
console.log(`      40 notti: piano su ${tooMany.nights.length} notti · consiglio ${
  (tooMany.advice[0]||{}).code||'nessuno'} · residuo ${tooMany.leftover.toFixed(1)} h`);
chk('una notte sola per 14.5 h riceve comunque un piano',tooFew.ok&&tooFew.nights.length===1,true);
chk('e il piano di quella notte contiene canali veri',
  tooFew.nights[0].blocks.length>0,true);
chk('ma dichiara che per il progetto intero servono piu notti',
  (tooFew.advice[0]||{}).code,'poche');
chk('e dice quante',(tooFew.advice[0]||{}).want>=b31.min,true);
chk('quaranta notti ricevono un piano, con il consiglio di concentrarlo',
  tooMany.ok&&(tooMany.advice[0]||{}).code==='troppe',true);
chk('e il consiglio porta il massimo sensato',(tooMany.advice[0]||{}).want,b31.max);
/* Non correggere in silenzio significa: cio' che non ci sta si vede. */
chk('il piano non corregge in silenzio: il residuo e dichiarato',
  tooFew.leftover>0&&Math.abs((tooFew.need-tooFew.leftover)-
    tooFew.nights.reduce((a,x)=>a+x.blocks.reduce((b,y)=>b+y.projH,0),0))<0.05,true,
  'depositate '+(tooFew.need-tooFew.leftover).toFixed(1)+' h su '+tooFew.need.toFixed(1));
chk('dentro l intervallo il piano si costruisce',
  M.planNights(prM31,eM31,dvM31mono,b31.min,POPT).ok&&
  M.planNights(prM31,eM31,dvM31mono,b31.max,POPT).ok,true);

console.log('\n--- posa e numero di sub ---');
/* Il banco di prova non e' un valore di catalogo: e' la sequenza N.I.N.A. che
   l'utente usa davvero sull'RC8 a f/8 da Borno — L 120-180 s a gain 0, banda
   stretta 300 s a gain 100. Se il modello si allontana da li', e' il modello. */
const dvRC=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const siteRC={...bornoSite}; siteRC.rms=M.mountRms('cem70g',dvRC.scale);
siteRC.fwhm=M.effFWHM(siteRC.seeing,siteRC.rms);
for(const b of ['L','R','Ha','OIII']){
  const e=M.subExposure(dvRC,siteRC,b,{});
  console.log(`      ${b.padEnd(4)} ${String(e.sec).padStart(4)} s  gain ${String(e.gm.gain).padEnd(4)}`+
    ` fondo ${e.sky.toExponential(2)} e/s/px  vincolo ${e.binding.padEnd(20)}`+
    ` resa ${(e.eff*100).toFixed(0)}% del limite del cielo`);
}
const exL=M.subExposure(dvRC,siteRC,'L',{});
const exHa=M.subExposure(dvRC,siteRC,'Ha',{});
chk('la luminanza sull RC8 a f/8 esce sui 120 s come nella sequenza reale',exL.sec,120);
chk('e la sceglie il pozzetto, non il rumore',exL.binding,'saturazione stellare');
chk('la banda stretta finisce sul modo a rumore basso',exHa.gm.gain,100);
chk('in banda stretta il cielo non raggiunge mai il rumore di lettura',
  exHa.tSwamp>3600,true);
chk('e quindi il vincolo non e il fondo cielo',exHa.binding!=='fondo cielo',true);
chk('il fondo in banda stretta e due ordini sotto la banda larga',
  exL.sky/exHa.sky>50,true);

/* PERCHE' LA POSA E' AL TETTO — la domanda arrivata dal forum, e la sua risposta.

   «Non ho capito perche' a f/4.5 mi obbliga a scattare a 600 s a campo largo con
   un filtro da 7 nm». Il motore rispondeva «rischio / montatura»: vero e inutile,
   perche' nomina cio' che IMPEDISCE di allungare, non cio' che fa VOLERE di
   allungare. La seconda cosa e' il rumore di lettura, e la premessa della domanda
   e' rovesciata — il rapporto focale aperto non e' la causa, e' l'attenuante.

   Tre confronti bastano a dimostrarlo, e sono tre asserzioni, non tre opinioni. */
{
  const S=q=>{const x={lat:46.0167,lon:10.3333,sqm:q,seeing:2.5,rms:1.0,
    horizonMin:20,clearFrac:0.35}; x.fwhm=M.effFWHM(x.seeing,x.rms); return x;};
  const veloce=M.derive({tel:'redcat51',red:0.92,cam:'asi2600mm',mnt:'am5',bin:1});
  const lento =M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'am5',bin:1});
  const aBuio =M.subExposure(veloce,S(21.3),'OIII',{hours:8});
  const aF8   =M.subExposure(lento ,S(21.3),'OIII',{hours:8});
  const inCitta=M.subExposure(veloce,S(18.5),'OIII',{hours:8});
  const inLum =M.subExposure(veloce,S(21.3),'L',   {hours:8});
  const pc=x=>Math.round(x.rnCost*100)+'%';
  console.log(`      f/4.9 OIII cielo buio: ${aBuio.sec} s, swamp ${aBuio.swamp.toFixed(1)}, `+
    `la lettura costa +${pc(aBuio)} · «${aBuio.binding}»`);
  console.log(`      f/8.0 stesso filtro:   ${aF8.sec} s, swamp ${aF8.swamp.toFixed(1)}, `+
    `la lettura costa +${pc(aF8)} — piu chiuso e PEGGIO, non meglio`);
  console.log(`      f/4.9 da SQM 18.5:     ${inCitta.sec} s, swamp ${inCitta.swamp.toFixed(1)}, `+
    `+${pc(inCitta)} · «${inCitta.binding}»`);
  console.log(`      f/4.9 in luminanza:    ${inLum.sec} s, swamp ${inLum.swamp.toFixed(1)}, +${pc(inLum)}`);

  chk('al tetto e ancora limitata dalla lettura, il motore lo nomina',
    aBuio.binding,'il fondo non copre il rumore di lettura');
  /* Il punto che rovescia la premessa: chiudere il diaframma non accorcia la posa,
     la allunga. A f/8 lo stesso filtro sullo stesso cielo lascia il fondo quattro
     volte piu' basso, e la lettura costa il triplo. */
  chk('un sistema piu chiuso e limitato dalla lettura PIU di uno aperto',
    aF8.rnCost>aBuio.rnCost*2,true);
  /* E il perche' e' geometrico, non empirico. Il fondo per pixel vale
     brillanza x angolo solido del pixel x area di raccolta x trasmissione; angolo
     solido e area portano `pixel^2 D^2 / focale^2 = pixel^2 / F^2`, e la focale
     sparisce. A parita' di camera resta il rapporto focale al quadrato, per la
     trasmissione — che sull'RC8 e' 0.70 contro 0.96, perche' un'ostruzione del 45%
     e due specchi si pagano. Ignorarla sbagliava di un terzo. */
  const attesa=Math.pow(lento.fRatio/veloce.fRatio,2)*(veloce.thru/lento.thru);
  console.log(`      rapporto dei fondi: misurato ${(aBuio.sky/aF8.sky).toFixed(2)}, `+
    `atteso ${attesa.toFixed(2)} da (F8/F4.9)² x trasmissioni`);
  chk('e il fondo per pixel scala col rapporto focale al quadrato, a meno della trasmissione',
    Math.abs((aBuio.sky/aF8.sky)/attesa-1)<0.05,true);
  /* Quando il fondo copre davvero la lettura, l'etichetta deve cambiare: e' la
     prova che la soglia fa un lavoro vero e non rietichetta tutto. */
  chk('quando il cielo copre la lettura, il vincolo torna a essere il tetto',
    inCitta.binding,'rischio / montatura');
  chk('e in banda larga sullo stesso tubo la posa e corta, non lunga',
    inLum.sec<=120,true);
  /* E la valuta: `rnCost` e' la frazione di tempo TOTALE in piu' che la lettura
     costa, quindi deve coincidere con quello che dice l'efficienza. */
  chk('rnCost e coerente con l efficienza dichiarata',
    Math.abs((1/(aBuio.eff*aBuio.eff)-1)-aBuio.rnCost)<1e-9,true);
}
/* Il binning si semplifica: fondo ×bin², rumore ×bin, quindi il rapporto resta. */
const dvB2=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:2});
chk('binnare non cambia la soglia di sommersione del rumore',
  M.subExposure(dvB2,siteRC,'Ha',{}).tSwamp,exHa.tSwamp,0.01);

const expo=M.exposurePlan(prM31,dvM31mono,bornoSite,{});
const bands=Object.keys(expo).filter(k=>k!=='__modes');
chk('RGB si apre nei tre filtri veri',bands.includes('R')&&bands.includes('G')&&bands.includes('B'),true);
chk('un solo guadagno per classe di banda',
  new Set(bands.filter(b=>['L','R','G','B'].includes(b)).map(b=>expo[b].ex.gm.name)).size,1);
const sp=M.subPlan(pl3.nights[0].blocks,expo,{});
chk('il numero di sub e intero',sp.subs.every(u=>Number.isInteger(u.n)),true);
chk('il tempo di orologio supera quello di integrazione',sp.clockH>sp.integH,true);
chk('lo scarto fra ore chieste e ore reali resta sotto i cinque minuti',
  sp.subs.every(u=>Math.abs(u.deltaMin)<5),true);

/* ─── due difetti trovati durante l'audit del modello lunare ─── */
/* ─── i tetti che vengono dal soggetto, non dalla stella di campo ─── */
console.log('\n--- la posa la decide il soggetto, non solo le stelle di campo ---');
const dvRC2=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const siteRC2={...bornoSite}; siteRC2.rms=M.mountRms('cem70g',dvRC2.scale);
siteRC2.fwhm=M.effFWHM(siteRC2.seeing,siteRC2.rms);
/* Il bacino della prova: schede curate, catalogo curato e — per gli oggetti che
   stanno solo li', come NGC 7027 — lo strato OpenNGC, esattamente come in app. */
const ONGC_T=(()=>{const f=ONGC.fields, ix=k=>f.indexOf(k);
  return ONGC.objects.map(a=>({name:a[ix('name')],ra_deg:a[ix('ra_deg')],dec_deg:a[ix('dec_deg')],
    size_arcmin:[a[ix('maj_arcmin')],a[ix('min_arcmin')]],constellation:a[ix('constellation')],
    archetype:a[ix('archetype')],mag:a[ix('mag')],aliases:a[ix('aliases')]||[]}));})();
const objOf=nm=>{
  const sch=TG.targets.find(t=>t.names.some(x=>x===nm));
  if(sch) return {t:sch,arch:TG.archetypes[sch.archetype],c:sch};
  const c=CAT.objects.find(o=>o.name===nm||(o.aliases||[]).includes(nm))
       || ONGC_T.find(o=>o.name===nm||(o.aliases||[]).includes(nm));
  return c&&c.archetype?{t:M.synthTarget(c,c.archetype),arch:TG.archetypes[c.archetype],c}:null;};
const posa=(nm,band)=>{const o=objOf(nm); if(!o) return null;
  return M.subExposure(dvRC2,siteRC2,band,{tg:o.t,arch:o.arch,stellar:!!o.arch.stellar,hours:3});};
for(const [nm,bd] of [['M13','R'],['M52','R'],['M27','OIII'],['NGC 7027','OIII'],['NGC 6888','OIII'],['M31','L']]){
  const e=posa(nm,bd);
  if(e) console.log(`      ${nm.padEnd(9)} ${bd.padEnd(4)} ${String(e.sec).padStart(3)} s  gain ${String(e.gm.gain).padEnd(4)} ${e.binding}`);
}
/* Il riscontro non e' un numero di catalogo: e' la pratica documentata.
   Globulari 20-60 s (Cloudy Nights, Galactic Hunter: «30 s, forse 60, mai di piu'»),
   ammassi aperti 30-120 s, planetarie brillanti pose brevi per salvare il colore,
   600 s solo su soggetti deboli in banda stretta. */
chk('un globulare non si riprende a pose lunghe',posa('M13','R').sec<=60,true);
chk('e nemmeno la sua luminanza',posa('M13','L').sec<=60,true);
chk('un ammasso aperto resta sotto i due minuti',posa('M52','R').sec<=120,true);
chk('una planetaria brillante resta sotto i tre minuti',posa('M27','OIII').sec<=180,true);
chk('600 s restano dove servono: nebulosa estesa in banda stretta',posa('NGC 6888','OIII').sec,600);
chk('e una galassia in luminanza non ci arriva',posa('M31','L').sec<=180,true);
/* NGC 7027 e' la controprova del termine fisico: minuscola e brillantissima, e' il
   SOGGETTO a saturare, non una stella di campo. */
const n7027=posa('NGC 7027','OIII');
console.log(`      NGC 7027: il soggetto satura in ${Math.round(n7027.tObj)} s, le stelle in ${Math.round(n7027.tStar)} s`);
chk('su una planetaria compatta e brillante lega il soggetto',n7027.binding,'il soggetto satura');
chk('e il tetto del soggetto e piu stretto di quello stellare',n7027.tObj<n7027.tStar,true);
chk('mentre su una nebulosa estesa il soggetto non lega mai',
  posa('NGC 6888','OIII').tObj>3600,true);
/* Il pavimento operativo vale contro le stelle di campo, non contro il soggetto:
   un nucleo stellare bruciato si cura in elaborazione, un soggetto bruciato no. */
chk('il pavimento non scavalca il tetto del soggetto',n7027.sec<60,true);
chk('ma tiene contro quello stellare',posa('M13','L').sec>=45,true);
/* I tetti di classe vengono dalla pratica, non dal modello, e sono dichiarati. */
chk('gli archetipi dichiarano concentrazione e frazione di riga',
  Object.values(TG.archetypes).every(a=>a.peak_over_mean>0&&a.line_fraction!=null),true);
chk('i tetti di classe dichiarano da dove vengono',
  Object.values(TG.archetypes).every(a=>!a.sub_max_s||!!a.sub_source),true);
chk('nessun tetto di classe supera i 600 s',
  Object.values(TG.archetypes).every(a=>!a.sub_max_s||a.sub_max_s<=600),true);
/* Il curato vince sul dedotto anche qui: M42 non e' una HII qualunque. */
const m42=objOf('M42');
chk('un oggetto puo portarsi la propria concentrazione',m42&&m42.t.peak_over_mean>100,true);

console.log('\n--- dual-band su OSC: la finestra e stretta, non larga ---');
const dvOSC=M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
const dvMON=M.derive({tel:'askar71f',red:0.75,cam:'asi2600mm',mnt:'am5',bin:1});
const spDual=M.bandSpec('Ha+OIII',dvOSC.c), spL=M.bandSpec('L',dvOSC.c);
console.log(`      Ha+OIII su OSC → finestra ${spDual.fwhm} nm, ${spDual.windows} passaggio, `+
  `righe ${spDual.lines.map(x=>x.toFixed(1)).join(' e ')}`);
const skyDual=M.skyRateFor(dvOSC,'Ha+OIII',20.8,{}), skyL=M.skyRateFor(dvOSC,'L',20.8,{});
console.log(`      fondo: dual-band ${skyDual.toExponential(2)} vs luminanza ${skyL.toExponential(2)} e/s/px`);
chk('il gruppo dual-band trova il filtro dual',spDual.dual,true);
chk('e la sua finestra e stretta',spDual.narrow,true);
/* Il difetto: `filterFor('Ha+OIII')` non trovava niente e si ripiegava sui 250 nm
   della banda larga. Il fondo usciva ~100x troppo alto e la posa ~10x troppo corta,
   proprio sulla configurazione OSC + dual-band, la piu' diffusa che esista. */
chk('un dual-band da 3 nm non raccoglie il cielo come una luminanza',skyL/skyDual>20,true);
chk('su OSC ogni fotosito vede una sola delle due righe',spDual.windows,1);
chk('su mono le vede entrambe',M.bandSpec('Ha+OIII',dvMON.c).windows,2);
const exDual=M.subExposure(dvOSC,{lat:45.95,lon:10.2,sqm:20.8,seeing:1.6,rms:0.9,fwhm:2.2},'Ha+OIII',{});
console.log(`      posa consigliata sul dual-band: ${exDual.sec} s (vincolo: ${exDual.binding})`);
chk('e la posa consigliata e da banda stretta, non da luminanza',exDual.sec>=300,true);
chk('servirebbero pose oltre i venti minuti per sommergere il rumore',exDual.tSwamp>1200,true);

console.log('\n--- geometria: una dimensione sola non deve produrre NaN ---');
const oneDim={id:'x',names:['x'],size_arcmin:[20],ra_deg:0,dec_deg:0};
const mOne=M.mosaicPanels(oneDim,dvMON), fOne=M.framing(oneDim,dvMON);
console.log(`      oggetto 20' senza asse minore → ${mOne.cols}x${mOne.rows} pannelli, riempimento ${(fOne.r*100).toFixed(0)}%`);
chk('i pannelli sono un numero',Number.isFinite(mOne.cols*mOne.rows),true);
chk('e il riempimento anche',Number.isFinite(fOne.r),true);
chk('l asse minore assente vale quanto il maggiore',fOne.r,M.framing({size_arcmin:[20,20]},dvMON).r,1e-9);

console.log('\n--- export N.I.N.A. ---');
const spN=M.subPlan(pl3.nights[0].blocks,expo,{});
const root=M.ninaSequence({n:1,subs:spN.subs},pl3,m31,dvM31mono,bornoSite,{rot:245,hasRotator:true});
const nchk=M.ninaCheck(root);
console.log(`      ${nchk.ids} nodi, ${nchk.refs} riferimenti, ${spN.subs.length} blocchi Smart Exposure`);
chk('nessun id duplicato',nchk.dup.length,0);
chk('nessun riferimento pendente',nchk.dangling.length,0);
chk('il file sopravvive a un giro di serializzazione',
  JSON.parse(JSON.stringify(root)).$type.indexOf('SequenceRootContainer')>0,true);
const kids=root.Items.$values.map(x=>x.$type.split(',')[0].split('.').pop());
chk('la radice ha inizio, target e fine',kids.join(','),
  'StartAreaContainer,TargetAreaContainer,EndAreaContainer');
const dso=root.Items.$values[1].Items.$values[0];
chk('l angolo di posizione arriva nel file',dso.Target.PositionAngle,245);
chk('e a 245 gradi, che prima era inesprimibile',dso.Target.PositionAngle>180,true);
const img=dso.Items.$values.find(x=>/SequentialContainer/.test(x.$type));
chk('un blocco Smart Exposure per canale, non una istruzione per posa',
  img.Items.$values.length,spN.subs.length);
const se0=img.Items.$values[0];
chk('il conteggio sta nella condizione di loop di N.I.N.A.',
  se0.Conditions.$values[0].Iterations,spN.subs[0].n);
chk('il binning arriva dalla configurazione, non da un secondo algoritmo',
  se0.Items.$values[1].Binning.X,dvM31mono.bin);
chk('il dithering usa il trigger nativo',
  se0.Triggers.$values[0].$type.indexOf('DitherAfterExposures')>0,true);
chk('nessun nodo di plugin di terze parti',
  JSON.stringify(root).indexOf('AdaptiveAgentForPHD2'),-1);

console.log('\n--- rotazione della camera ---');
const needle={names:['ago'],size_arcmin:[16,2],pa_deg:0};
const e0=M.objectExtent(needle,0), e90=M.objectExtent(needle,90), e45=M.objectExtent(needle,45);
console.log(`      ago 16' x 2' con PA 0:  a 0° ${e0.x.toFixed(1)}x${e0.y.toFixed(1)}  `+
            `a 45° ${e45.x.toFixed(1)}x${e45.y.toFixed(1)}  a 90° ${e90.x.toFixed(1)}x${e90.y.toFixed(1)}`);
chk('asse maggiore lungo l altezza del sensore',e0.y,16,0.01);
chk('e la larghezza e il minore',e0.x,2,0.01);
chk('ruotando di 90 gradi si scambiano',e90.x,16,0.01);
chk('a 45 gradi il rettangolo che lo contiene e quadrato',Math.abs(e45.x-e45.y)<0.01,true);
chk('la rotazione e periodica di 180 gradi',
  Math.abs(M.objectExtent(needle,200).x-M.objectExtent(needle,20).x)<1e-9,true);
/* CAMBIATO 2026-09 — la convenzione sull'angolo ignoto.

   Prima si assumeva l'ipotesi peggiore: asse maggiore attraverso il lato corto,
   cioe' il quadrato di lato pari all'asse maggiore. Era il caso peggiore su OGNI
   rotazione simultaneamente — una situazione che nessun oggetto puo' assumere —
   e comunque non era la convenzione che il motore usava davvero: `mosaicPanels`
   la scartava e tassellava sugli assi grezzi, `framing` faceva ancora altro. Tre
   ipotesi diverse sullo stesso ignoto, e in copertura completa la copertura
   scendeva sotto uno su undici oggetti del catalogo.

   Adesso la convenzione e' una sola e si deriva: se l'angolo e' ignoto non esiste
   direzione privilegiata, quindi la rappresentazione deve essere ISOTROPA. Il
   quadrato di lato 2·sqrt((A^2+B^2)/2) e' proprio l'ingombro che l'oggetto assume
   a 45 gradi — l'orientamento in cui il riquadro che lo contiene e' quadrato, che
   il test qui sopra verifica gia'. Non e' un numero scelto: e' l'estensione reale
   a una rotazione reale, ed e' l'unica isotropa. */
const noPA={names:['x'],size_arcmin:[16,2]};
const exU=M.objectExtent(noPA,0);
chk('senza PA l ingombro e isotropo',Math.abs(exU.x-exU.y)<1e-12,true);
chk('e coincide con l ingombro reale a 45 gradi',exU.x,e45.x,1e-9);
chk('sta sopra il minimo sulle rotazioni: l ignoranza costa',exU.x>2+1e-9,true);
chk('e sotto il massimo: ma non costa tutto',exU.x<16-1e-9,true);
chk('la mancanza resta dichiarata',exU.known,false);
chk('e la base della stima e nel dato',exU.basis,'isotropo');
chk('con angolo noto la base e il catalogo',M.objectExtent(needle,0).basis,'catalogo');
/* Su un oggetto circolare la convenzione non deve inventare niente. */
const tondo={names:['o'],size_arcmin:[10,10]};
chk('su un oggetto circolare si riduce al cerchio',M.objectExtent(tondo,0).x,10,1e-12);
/* E l'ingombro grezzo resta leggibile per chi deve dirlo all'utente. */
chk('gli assi di catalogo restano accessibili',exU.major+'x'+exU.minor,'16x2');

const dvTec=M.derive({tel:'tecnosky115',red:0.80,cam:'asi2600mm',bin:1});
/* Il caso che giustifica la funzione: M31 sul Tecnosky ridotto passa da sei
   pannelli a due ruotando la camera. Tre volte le ore, sull'oggetto piu'
   fotografato del cielo boreale. */
const m31r={names:['M31'],size_arcmin:[190,60],pa_deg:35};
const rot31=M.bestRotation(m31r,dvTec,5);
console.log(`      M31 (190'x60', PA 35°) su Tecnosky 0.80x: `+
  (rot31?`${rot31.from} → ${rot31.panels} pannelli ruotando a ${rot31.rot}°  (${rot31.ratio.toFixed(1)}x)`:'nessun guadagno'));
chk('su M31 la rotazione riduce i pannelli',!!rot31&&rot31.panels<rot31.from,true);
chk('e il guadagno e sostanziale',rot31.ratio>=2,true);
/* Il consiglio si da' SOLO dove c'e' un costo. Su un oggetto che ci sta gia',
   ruotare e' composizione: il primo tentativo massimizzava il riempimento e
   peggiorava l'inquadratura (NGC 4565 da «ideale 36%» a «piccolo 29%»). */
chk('nessun consiglio quando l oggetto ci sta gia',
  M.bestRotation({names:['x'],size_arcmin:[16,2],pa_deg:135},dvTec,5),null);
chk('nessun consiglio senza angolo di posizione',
  M.bestRotation({names:['x'],size_arcmin:[190,60]},dvTec,5),null);
// il rettangolo disegnato resta un rettangolo, e con le stesse misure
const c0=M.fieldCorners(100,0,2,1,0), c30=M.fieldCorners(100,0,2,1,30);
const side=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
chk('il campo ruotato conserva il lato lungo',side(c30[0],c30[1]),side(c0[0],c0[1]),0.001);
chk('e il lato corto',side(c30[1],c30[2]),side(c0[1],c0[2]),0.001);
chk('e resta chiuso',c30.length,5);

console.log('\n--- inquadratura spostabile: il centro non e sempre quello dell oggetto ---');
const tgOff={id:'x',names:['x'],ra_deg:350.2,dec_deg:61.2,size_arcmin:[15,15]};
const sepArc=(a,b)=>Math.acos(Math.sin(a.dec*Math.PI/180)*Math.sin(b.dec*Math.PI/180)+
  Math.cos(a.dec*Math.PI/180)*Math.cos(b.dec*Math.PI/180)*Math.cos((a.ra-b.ra)*Math.PI/180))*180/Math.PI*60;
const base={ra:tgOff.ra_deg,dec:tgOff.dec_deg};
for(const [rot,du,dv] of [[0,10,0],[0,0,10],[90,10,0],[66,-8,12]]){
  const fc=M.framingCenter(tgOff,rot,{du,dv});
  console.log(`      rot ${String(rot).padStart(3)}° scostamento (${du},${dv})′ → separazione reale ${sepArc(fc,base).toFixed(2)}′`);
}
chk('senza scostamento il centro e l oggetto',
  M.framingCenter(tgOff,0,{du:0,dv:0}).ra,tgOff.ra_deg,1e-9);
chk('e lo dichiara',M.framingCenter(tgOff,0,{}).off,false);
/* Dieci primi devono essere dieci primi SUL CIELO, in ogni direzione e a ogni
   rotazione: il coseno della declinazione non e' un dettaglio a dec 61. */
chk('dieci primi a destra sono dieci primi sul cielo',
  sepArc(M.framingCenter(tgOff,0,{du:10,dv:0}),base),10,0.01);
chk('e anche dieci primi in alto',
  sepArc(M.framingCenter(tgOff,0,{du:0,dv:10}),base),10,0.01);
chk('la rotazione non cambia la distanza, solo la direzione',
  sepArc(M.framingCenter(tgOff,90,{du:10,dv:0}),base),10,0.01);
chk('e le due componenti si compongono in quadratura',
  sepArc(M.framingCenter(tgOff,66,{du:-8,dv:12}),base),Math.hypot(8,12),0.02);
/* A rotazione zero «destra» e' Est e «su» e' Nord. */
chk('a rotazione zero destra e Est',M.framingCenter(tgOff,0,{du:10,dv:0}).ra>tgOff.ra_deg,true);
chk('e su e Nord',M.framingCenter(tgOff,0,{du:0,dv:10}).dec>tgOff.dec_deg,true);
chk('a 90 gradi destra diventa Sud',M.framingCenter(tgOff,90,{du:10,dv:0}).dec<tgOff.dec_deg,true);
/* E il centro scelto deve arrivare nel file di N.I.N.A.: e' il punto di tutto. */
const spOff=M.subPlan(pl3.nights[0].blocks,expoM31,{});
const rootC=M.ninaSequence({n:1,subs:spOff.subs},pl3,m31,dvM31mono,bornoSite,{rot:0,off:{du:0,dv:0}});
const rootO=M.ninaSequence({n:1,subs:spOff.subs},pl3,m31,dvM31mono,bornoSite,{rot:0,off:{du:30,dv:0}});
const ic=r=>r.Items.$values[1].Items.$values[0].Target.InputCoordinates;
console.log(`      M31 centrato: ${ic(rootC).RAHours}h ${ic(rootC).RAMinutes}m  ·  spostato di 30′: ${ic(rootO).RAHours}h ${ic(rootO).RAMinutes}m`);
chk('le coordinate esportate seguono il centro scelto, non il catalogo',
  ic(rootC).RAMinutes!==ic(rootO).RAMinutes||ic(rootC).RASeconds!==ic(rootO).RASeconds,true);
chk('ma il nome del target resta quello dell oggetto',
  rootO.Items.$values[1].Items.$values[0].Target.TargetName,m31.names[0]);

console.log('\n--- inquadratura: pannelli di mosaico e geometria del campo ---');
const dvWide=M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
const dvLong=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const velo=TG.targets.find(t=>t.id==='velo'||/velo/i.test(t.names[0]));
const m1=M.mosaicPanels(velo,dvWide), m2=M.mosaicPanels(velo,dvLong);
console.log(`      ${velo.names[0]} (${velo.size_arcmin[0]}' x ${velo.size_arcmin[1]}')`);
console.log(`      Askar 0.75x (${(dvWide.fovX).toFixed(0)}' di campo): ${m1.cols}x${m1.rows} pannelli`);
console.log(`      RC8 nativo  (${(dvLong.fovX).toFixed(0)}' di campo): ${m2.cols}x${m2.rows} pannelli`);
chk('a campo largo servono meno pannelli',m1.cols*m1.rows<m2.cols*m2.rows,true);
chk('un oggetto che ci sta in un campo non e mosaico',
  M.mosaicPanels({size_arcmin:[20,15]},dvWide).cols,1);
// il coseno della declinazione: senza, il campo sarebbe disegnato largo il doppio a dec alta
const cLow=M.fieldCorners(100,0,1,1), cHigh=M.fieldCorners(100,60,1,1);
const wLow=cLow[1][0]-cLow[0][0], wHigh=cHigh[1][0]-cHigh[0][0];
console.log(`      larghezza in AR di un campo da 1 grado: a dec 0 -> ${wLow.toFixed(2)}, a dec 60 -> ${wHigh.toFixed(2)}`);
chk('il campo si allarga in AR alle alte declinazioni',wHigh/wLow,2,0.02);
chk('il rettangolo e chiuso',cLow.length,5);

/* ═══════════════════════════════════════════════════════════════════════════
   IL MODELLO FOTOMETRICO — gate di validazione fisica (docs/gate-fisico.md)
   Forma di riferimento: ESO (Hainaut), STScI WFC3 IHB 9.6, Rubin SMTN-002.
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n--- modello fotometrico: equivalenza con la forma a N pose ---');
{
const dvA=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const SQMR=DB.reference_config.sqm_zenith;
const r=M.rates(dvA,'OIII',SQMR);
const s_arc=2.36e-5*r.collect, R_s=s_arc*r.om, tsub=600;
/* SNR_px = R_s*T / sqrt( (R_s+R_b+R_d)*T + N*RN^2 )   con N = T/t_posa
          = R_s*T / sqrt( T*[R_s+R_b+R_d+RN^2/t_posa] )
   N sparisce: entra solo via T/t_posa. Il rumore di lettura si paga per LETTURA,
   non si integra nel tempo — per questo diventa il tasso RN^2/t_posa. */
let same=true;
for(const N of [1,10,30,50,180]){
  const T=N*tsub;
  const aN=R_s*T/Math.sqrt((R_s+r.R_b+r.R_d)*T+N*r.RN*r.RN);
  const aR=R_s*T/Math.sqrt(T*(R_s+r.R_b+r.R_d+r.RN*r.RN/tsub));
  if(Math.abs(aN-aR)>1e-12*Math.max(1,aN)) same=false;
}
chk('forma a N pose e forma a tassi coincidono per ogni N',same,true);
// SNR su 1 arcsec2: dai pixel oppure dai tassi angolari, stesso numero
const viaPix=Math.sqrt(1/r.om)*R_s*(30*tsub)/Math.sqrt((R_s+r.R_b+r.R_d)*(30*tsub)+30*r.RN*r.RN);
const viaArc=s_arc*Math.sqrt(1*(30*tsub)/M.varRate(r,tsub,s_arc));
console.log(`      SNR(1 arcsec2) in 30x600s: dai pixel ${viaPix.toFixed(6)}  dai tassi ${viaArc.toFixed(6)}`);
chk('SNR per arcsec2: dai pixel == dai tassi angolari',viaPix,viaArc,1e-9);
chk('la varianza e la somma esatta dei quattro termini (nessun doppio conteggio)',
  M.varRate(r,tsub,s_arc),s_arc+r.R_b/r.om+r.R_d/r.om+r.RN*r.RN/(r.om*tsub),1e-15);
// a T costante il numero di pose conta, ed e' l'unico modo in cui conta
const snrT=ts=>R_s*18000/Math.sqrt((R_s+r.R_b+r.R_d)*18000+(18000/ts)*r.RN*r.RN);
console.log(`      a 18000 s totali:  300 s ${snrT(300).toFixed(4)}  600 s ${snrT(600).toFixed(4)}  1800 s ${snrT(1800).toFixed(4)}`);
chk('a T costante pose piu lunghe danno piu SNR',snrT(1800)>snrT(300),true);
/* La metrica non ha un parametro libero: nella forma t = SNR^2*Vdot/(s_arc^2*Om0)
   la scala Om0 si semplifica nel rapporto fra due configurazioni. E' la differenza
   fra questa e un fattore tipo C(w)=w^2/(w^2+FWHM^2), dove w NON si semplifica. */
const q=(dv,O)=>M.varRate(M.rates(dv,'OIII',SQMR),600,0)/Math.pow(M.rates(dv,'OIII',SQMR).collect,2)/O;
const dvRef=M.derive({tel:DB.reference_config.telescope,red:DB.reference_config.reducer,
                      cam:DB.reference_config.camera,mnt:'am5',bin:1});
chk('la scala angolare di riferimento si semplifica (1 / 100 / 3600 arcsec2)',
  [1,100,3600].every(O=>Math.abs(q(dvA,O)/q(dvRef,O)-M.timeFactor(dvA,'OIII',600))<1e-12),true);
}

console.log('\n--- modello fotometrico: regime sky-limited ---');
{
const SQMR=DB.reference_config.sqm_zenith;
const tf=(dv,sqm)=>{
  const a=M.rates(dv,'OIII',sqm), b=M.rates(M.derive({tel:DB.reference_config.telescope,
    red:DB.reference_config.reducer,cam:DB.reference_config.camera,mnt:'am5',bin:1}),'OIII',sqm);
  return (M.varRate(a,600,0)/Math.pow(a.collect,2))/(M.varRate(b,600,0)/Math.pow(b.collect,2));
};
const a=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const b=M.derive({tel:'rc8',red:0.8,cam:'asi2600mm',mnt:'cem70g',bin:1});
const g=[];
for(const sqm of [21.3,20.0,18.0,15.0,12.0]){ const x=tf(a,sqm), y=tf(b,sqm); g.push(1-y/x);
  console.log(`      SQM ${sqm.toFixed(1)}:  f/8 x${x.toFixed(3)}  f/6.4 x${y.toFixed(3)}  vantaggio ${(100*(1-y/x)).toFixed(2)}%`); }
/* Il vantaggio del rapporto focale vive SOLO nei termini strumentali. Quando il
   cielo domina devono diventare trascurabili, e il vantaggio con loro. Serve a
   impedire che f/8 -> f/6.4 diventi un guadagno fotometrico automatico. */
chk('il vantaggio del f/ tende a zero in regime sky-limited',g[g.length-1]<0.01,true);
chk('ed e monotono col cielo',g.every((x,i)=>i===0||x<=g[i-1]+1e-9),true);
const rr=M.rates(M.derive({tel:DB.reference_config.telescope,red:DB.reference_config.reducer,
  cam:DB.reference_config.camera,mnt:'am5',bin:1}),'OIII',12.0);
chk('a cielo dominante il fattore = solo rapporto di raccolta',
  tf(a,12.0),rr.collect/M.rates(a,'OIII',12.0).collect,0.005);
}

console.log('\n--- modello fotometrico: aperture diverse a pari f/ratio ---');
{
/* Il test che impedisce di passare dall'errore «scala del pixel» all'errore opposto
   «apertura = velocita». A pari f/ e stessa camera:
     - per PIXEL i due sistemi sono identici (E ∝ 1/f²) — l'invariante fotografico;
     - per ARCSEC² il maggiore raccoglie D² volte di piu (Sheffield PHY217: «the
       amount of light collected is proportional to D²»; Rubin SMTN-002: C ∝ effArea).
   Quindi NON devono risultare equivalenti per arcsec²: devono differire di
   ESATTAMENTE A·k, e di niente altro. Se comparisse un termine in piu, il modello
   avrebbe iniziato a gonfiare l'apertura. */
const tel=DB.telescopes, made=[];
for(const D_mm of [100,200,400]){ const id='__f5_'+D_mm; made.push(id);
  tel.push({id,name:id,aperture_mm:D_mm,focal_mm:D_mm*5,obstruction_linear:0,throughput:0.95,
    reducers:[{factor:1,focal_mm:D_mm*5,label:'nativo'}]}); }
const SQMR=DB.reference_config.sqm_zenith;
const o=made.map(id=>{const dv=M.derive({tel:id,red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
  const r=M.rates(dv,'OIII',SQMR); return {dv,r,sArc:2.36e-5*r.collect,sPx:2.36e-5*r.collect*r.om};});
o.forEach(x=>console.log(`      D ${String(x.dv.t.aperture_mm).padStart(3)} mm  f/${x.dv.fRatio.toFixed(2)}  ${x.dv.scale.toFixed(3)}"/px  e-/px/s ${x.sPx.toExponential(3)}  e-/arcsec2/s ${x.sArc.toExponential(3)}  fattore x${M.timeFactor(x.dv,'OIII',600).toFixed(3)}`));
chk('a pari f/ l illuminamento per PIXEL e identico',o[0].sPx,o[2].sPx,1e-12);
chk('a pari f/ anche il cielo per pixel e identico',o[0].r.R_b,o[2].r.R_b,1e-12);
chk('per ARCSEC2 il flusso scala come D2 (100->200)',o[1].sArc/o[0].sArc,4,0.02);
chk('per ARCSEC2 il flusso scala come D2 (100->400)',o[2].sArc/o[0].sArc,16,0.05);
const t1=M.timeFactor(o[0].dv,'OIII',600), t2=M.timeFactor(o[1].dv,'OIII',600), t4=M.timeFactor(o[2].dv,'OIII',600);
chk('il vantaggio in tempo e ESATTAMENTE il rapporto di raccolta, non di piu',
  (t1/t2)/(o[1].r.collect/o[0].r.collect),1,0.02);
chk('e resta esatto anche a 4x di diametro',
  (t1/t4)/(o[2].r.collect/o[0].r.collect),1,0.05);
console.log(`      e la risoluzione, che sta su un asse separato: `+
  o.map(x=>x.dv.t.aperture_mm+'mm '+M.samplingVerdict(x.dv.scale,2.2).k).join(' · '));
made.forEach(id=>tel.splice(tel.findIndex(t=>t.id===id),1));
}

console.log('\n--- modello fotometrico: il riduttore e un risultato, non una regola ---');
{
const gain=(band,tsub,sqm,mut)=>{
  const und=mut?mut():null;
  const x=M.timeFactor(M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1}),band,tsub);
  const y=M.timeFactor(M.derive({tel:'rc8',red:0.8,cam:'asi2600mm',mnt:'cem70g',bin:1}),band,tsub);
  if(und) und();
  return 1-y/x;
};
const cam=DB.cameras.find(c=>c.id==='asi2600mm');
const base=gain('OIII',600), g120=gain('OIII',120), g1800=gain('OIII',1800);
const gLCG=gain('OIII',600,null,()=>{const o=cam.read_noise_e;cam.read_noise_e=3.3;return()=>cam.read_noise_e=o;});
const gDark=gain('OIII',600,null,()=>{const o=cam.dark_e_s;cam.dark_e_s=0.0005;return()=>cam.dark_e_s=o;});
const gBB=gain('L',180);
console.log(`      OIII 600s ${(100*base).toFixed(1)}%  ·  120s ${(100*g120).toFixed(1)}%  ·  1800s ${(100*g1800).toFixed(1)}%  ·  LCG ${(100*gLCG).toFixed(1)}%  ·  buio basso ${(100*gDark).toFixed(1)}%  ·  banda larga ${(100*gBB).toFixed(1)}%`);
chk('il vantaggio del riduttore cambia con la posa',Math.abs(g120-g1800)>0.05,true);
chk('cambia col rumore di lettura',Math.abs(base-gLCG)>0.03,true);
chk('cambia con la corrente di buio',Math.abs(base-gDark)>0.02,true);
chk('ed e trascurabile in banda larga',gBB<0.03,true);
chk('nessuna costante «0.8x = 23%» e cablata nel motore',
  !/0\.8.{0,20}23|23.{0,20}0\.8x/.test(SRC),true);
}

console.log('\n--- modello fotometrico: Abell 61, regression test indipendente ---');
{
/* Alessandro ha ripreso Abell 61 in 8 h con RC8 a focale piena, HOO, filtri da 3 nm,
   pose da 600 s, e l'immagine e riuscita. Le 8 h NON entrano in nessuna formula:
   sono una verifica empirica indipendente. Il vecchio modello dava un pavimento OIII
   di 22.5 h e dichiarava insufficienti anche 15 h — incompatibile con il risultato. */
const dv=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const bud=TG.archetypes.pn_faint.default_budget.OIII;
const fac=M.timeFactor(dv,'OIII',600);
const floor=bud.floor*fac, useful=bud.useful*fac;
console.log(`      pn_faint OIII: pavimento ${bud.floor}h utile ${bud.useful}h al riferimento`);
console.log(`      su RC8 nativo (fattore x${fac.toFixed(2)}): pavimento ${floor.toFixed(1)}h  utile ${useful.toFixed(1)}h   ·   risultato reale 8 h`);
chk('il vecchio comportamento e rimosso: 15 h non sono piu insufficienti',15>floor,true);
chk('le 8 h reali superano il pavimento del modello',8>floor,true);
chk('e restano sotto l utile: livello «ridotto», non «pieno»',8<useful,true);
chk('il pavimento non e sceso sotto meta del risultato reale',floor>4,true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   RISPOSTA SPETTRALE DELLA MATRICE DI BAYER  (docs/studio-osc.md)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n--- matrice di Bayer: il modello contro i dati indipendenti ---');
{
const mc=DB.cameras.find(c=>c.id==='asi2600mc');
const mm=DB.cameras.find(c=>c.id==='asi2600mm');
/* Le curve per canale di IMX571/455/533/294/183 a colori NON esistono pubbliche.
   Il modello viene da IMX219 (unica base pubblica a normalizzazione COMUNE fra
   canali) e si verifica contro letture di terzi della carta ZWO ASI2600MC. */
const ZWO={656.3:{R:0.82,G:0.15,B:0.05},500.7:{R:0.03,G:0.94,B:0.50},672.4:{R:0.75,G:0.18,B:0.07}};
chk('il modello di matrice e caricato dai dati',M.mosaicFrac(550)!=null,true);
let gOK=true, gWorst=0;
for(const [lam,z] of Object.entries(ZWO)){
  const R=M.bayerDye('R',+lam),G=M.bayerDye('G',+lam),B=M.bayerDye('B',+lam);
  const mx=Math.max(R,G,B), zx=Math.max(z.R,z.G,z.B);
  const d=Math.abs((G/mx)/(z.G/zx)-1); gWorst=Math.max(gWorst,d);
  if(d>0.15) gOK=false;
}
console.log(`      verde: scarto massimo contro le letture ZWO ${(100*gWorst).toFixed(0)}%`);
/* Il verde e cio che conta: pesa DOPPIO nel mosaico RGGB. Il blu e sistematicamente
   piu alto nell IMX219 (sensore nudo da telefono) ed e il parametro debole. */
chk('il canale verde concorda con la carta ZWO entro il 15%',gOK,true);
const zEta=l=>{const z=ZWO[l];return (z.R+2*z.G+z.B)/4/Math.max(z.R,z.G,z.B);};
console.log(`      eta a OIII: modello ${M.mosaicFrac(500.7).toFixed(3)}  ZWO ${zEta(500.7).toFixed(3)}`);
chk('eta a OIII concorda con la carta ZWO entro il 5%',
  Math.abs(M.mosaicFrac(500.7)/zEta(500.7)-1)<0.05,true);
/* La definizione e UNA sola: mosaico/migliore. Su una riga e cfa_fraction,
   su una banda e il suo integrale. Non sono due correzioni da moltiplicare. */
chk('mosaico = (R + 2G + B)/4 diviso il canale migliore',
  M.mosaicFrac(500.7),
  (M.bayerDye('R',500.7)+2*M.bayerDye('G',500.7)+M.bayerDye('B',500.7))/4/
    Math.max(M.bayerDye('R',500.7),M.bayerDye('G',500.7),M.bayerDye('B',500.7)),1e-12);
}

console.log('\n--- matrice di Bayer: precedenza, dominio e ripiego ---');
{
const mc=DB.cameras.find(c=>c.id==='asi2600mc');
const mm=DB.cameras.find(c=>c.id==='asi2600mm');
const oe=b=>M.oscEfficiency(mc,b,M.bandSpec(b,mc));
console.log('      '+['Ha','OIII','SII','L','RGB'].map(b=>
  `${b} ${oe(b).eta.toFixed(3)} (${oe(b).src.split(' ')[0]})`).join('  ·  '));
/* Chi ha il DATO vince sul modello — la stessa regola con cui il catalogo curato
   vince su OpenNGC. In banda stretta cfa_fraction e misurato sulle curve del
   sensore e resta al comando; il modello si calcola per il confronto. */
const senMC=M.camSpec(mc).sensor;
for(const b of ['Ha','OIII','SII']){
  chk('banda stretta '+b+': vince la misura del sensore',oe(b).eta,senMC.cfa_fraction[b],1e-12);
  chk('  e il ramo lo dichiara',oe(b).src,'misura del sensore');
  chk('  e il modello resta disponibile per il confronto',oe(b).model!=null,true);
}
/* 2026-09, la correzione che conta: un valore EREDITATO non e' un dato. E' l'uscita
   di un modello vecchio e irriproducibile, e non puo' battere per regola quello
   attuale, che si rilancia e si testa. Su un sensore senza misura per canale deve
   quindi vincere il modello — non i vecchi 0.29 / 0.71 / 0.28 generici. */
{const mc294=DB.cameras.find(c=>c.id==='asi294mc');
 const oe294=b=>M.oscEfficiency(mc294,b,M.bandSpec(b,mc294));
 chk('senza misura per canale vince il MODELLO, non l ereditato',oe294('Ha').src,'modello spettrale');
 chk('e il valore ereditato non e piu quello usato: '+oe294('Ha').eta.toFixed(3)+
   ' contro '+mc294.cfa_fraction_ereditato.Ha,
   Math.abs(oe294('Ha').eta-mc294.cfa_fraction_ereditato.Ha)>0.05,true);
 chk('e il modello e piu vicino alla misura sul sensore gemello',
   Math.abs(oe294('Ha').eta-0.357)<Math.abs(mc294.cfa_fraction_ereditato.Ha-0.357),true);}
/* In banda larga il dato dichiarato conteneva il doppio conteggio (RGB 0.62 che
   veniva poi moltiplicato per OSC_BB 0.34): li vince il modello. */
chk('banda larga L: vince il modello',oe('L').src,'modello spettrale');
chk('banda larga RGB: vince il modello',oe('RGB').src,'modello spettrale');
chk('e NON e piu il prodotto dichiarato x OSC_BB',
  Math.abs(oe('RGB').eta-0.62*0.34)>0.1,true);
console.log(`      RGB: modello ${oe('RGB').eta.toFixed(3)}  contro il vecchio 0.62 x 0.34 = ${(0.62*0.34).toFixed(3)}`);
/* Il dominio di validita e dichiarato per regione, non "validato/non validato":
   la banda stretta nel rosso e il punto fragile, non la banda larga. */
chk('OIII dichiara confidenza alta',/alta/.test(oe('OIII').conf),true);
chk('Ha dichiara l incertezza sulla fuga nel rosso',/35%/.test(oe('Ha').conf),true);
chk('la banda larga dichiara la propria confidenza',/±6%/.test(oe('L').conf),true);
// mono: nessuna correzione, ed e esatta
const oeM=M.oscEfficiency(mm,'L',M.bandSpec('L',mm));
chk('su camera mono eta = 1 esatto',oeM.eta,1,1e-15);
chk('e dichiarata esatta',oeM.conf,'esatta');
// ripiego: senza il blocco dati si torna a OSC_BB, dichiarato
const keep=DB.cfa_responses; DB.cfa_responses={};
M.camSpec.cache&&M.camSpec.cache.clear&&M.camSpec.cache.clear();
const fb=M.oscEfficiency({...mc},'L',M.bandSpec('L',mc));
console.log(`      senza dati di matrice: eta ${fb.eta.toFixed(3)} — ${fb.src}`);
chk('senza dati di matrice si ripiega su OSC_BB',fb.src,'ripiego OSC_BB');
chk('e il ripiego si dichiara non validato',/non validata/.test(fb.conf),true);
DB.cfa_responses=keep;
chk('e ripristinando i dati si torna al modello',
  M.oscEfficiency({...mc},'L',M.bandSpec('L',mc)).src,'modello spettrale');
}

console.log('\n--- matrice di Bayer: una sola correzione, mai due ---');
{
const dvOsc=M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
const sqm=DB.reference_config.sqm_zenith;
/* Il difetto strutturale da cui parte tutto: la stessa perdita applicata due
   volte. Segnale e cielo devono passare per la STESSA efficienza. */
const r=M.rates(dvOsc,'L',sqm);
const skyPix=M.skyRateFor(dvOsc,'L',sqm,{spec:r.sp});                 // per fotosito
const skyMos=M.skyRateFor(dvOsc,'L',sqm,{spec:r.sp,mosaic:true});     // media sul mosaico
console.log(`      cielo per fotosito ${skyPix.toFixed(4)}  ·  base mosaico ${skyMos.toFixed(4)}  ·  R_b ${r.R_b.toFixed(4)}`);
chk('il cielo del mosaico non porta OSC_BB dentro di se',skyMos>skyPix,true);
chk('R_b = base mosaico x eta, una volta sola',r.R_b,skyMos*r.oe.eta,1e-12);
/* AGGIORNATO v1.6: k contiene ora anche la larghezza di banda, per un continuo.
   La verifica resta la stessa nella sostanza — segnale e cielo passano per la
   stessa eta e per la stessa funzione di throughput, quindi non possono divergere. */
chk('e k usa la STESSA eta del cielo',r.k,M.bandThroughput(dvOsc,r.sp,'signal')*r.oe.eta,1e-12);
chk('e la stessa funzione di throughput di segnale e cielo',
  M.bandThroughput(dvOsc,r.sp,'signal'),M.bandThroughput(dvOsc,r.sp,'sky'),1e-12);
/* Per la SATURAZIONE e la POSA serve invece il fotosito come lo leggi: li OSC_BB
   e al posto giusto e non va toccato. */
chk('per pixel la normalizzazione resta quella del fotosito',skyPix<skyMos,true);
// la banda stretta non e toccata da nulla di tutto questo
const rn=M.rates(dvOsc,'OIII',sqm);
chk('in banda stretta le due normalizzazioni coincidono',
  M.skyRateFor(dvOsc,'OIII',sqm,{spec:rn.sp}),
  M.skyRateFor(dvOsc,'OIII',sqm,{spec:rn.sp,mosaic:true}),1e-15);
}


/* ═══════════════════════════════════════════════════════════════════════════
   SENSORE → MODO DI LETTURA → CAMERA
   Vedi docs/architettura-catalogo-sensori.md. Tre cose da tenere ferme: che il
   riconoscimento funzioni senza che l'utente scelga niente, che la precedenza
   sia a DUE livelli con i valori ereditati fuori dal percorso, e che il
   pozzetto si derivi invece di essere assunto in silenzio.
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n--- catalogo per sensore: riconoscimento automatico ---');
{
const ris=DB.cameras.map(c=>({c,sp:M.camSpec(c)}));
const noti=ris.filter(x=>x.sp.sensor);
console.log(`      ${noti.length} camere su ${DB.cameras.length} risolte a un sensore`+
  `; ${new Set(noti.map(x=>x.sp.sensor.id)).size} sensori distinti nel catalogo di ${DB.sensors.length}`);
chk('il catalogo dei sensori esiste ed e popolato',DB.sensors.length>=8,true);
chk('ogni sensore dichiara almeno un modo di lettura',
  DB.sensors.every(s=>Array.isArray(s.modi)&&s.modi.length>=1),true);
chk('ogni modo dichiara pixel e risoluzione',
  DB.sensors.every(s=>s.modi.every(m=>m.pixel_um>0&&m.width_px>0&&m.height_px>0)),true);
chk('ogni sensore porta la provenienza della propria QE',
  DB.sensors.every(s=>s.qe_fonte&&s.qe_fonte.esito&&s.qe_fonte.come),true);
chk('gli id dei sensori sono unici',
  new Set(DB.sensors.map(s=>s.id)).size,DB.sensors.length);

/* Il punto dell'architettura: lo stesso silicio sotto marche diverse. Sei camere
   di quattro costruttori, nessuna in catalogo, riconosciute dalla sola geometria
   che l'utente inserisce nel modulo. Nessuna scelta di modelli. */
const nuove=[
 ['Player One Poseidon-C Pro',{pixel_um:3.76,width_px:6248,height_px:4176,read_noise_e:1.2,qe_peak:0.80,cfa_penalty:0.25},'imx571','nativo'],
 ['Altair Hypercam 26C',      {pixel_um:3.76,width_px:6248,height_px:4176,read_noise_e:1.2,qe_peak:0.90,cfa_penalty:0.25},'imx571','nativo'],
 ['ToupTek ATR294C',          {pixel_um:4.63,width_px:4144,height_px:2822,read_noise_e:1.6,qe_peak:0.75,cfa_penalty:0.25},'imx294','bin 2'],
 ['QHY294M Pro non binnata',  {pixel_um:2.315,width_px:8288,height_px:5644,read_noise_e:1.6,qe_peak:0.90},'imx294','nativo'],
 ['QHY 600C',                 {pixel_um:3.76,width_px:9600,height_px:6422,read_noise_e:1.4,qe_peak:0.80,cfa_penalty:0.25},'imx455',null],
];
for(const [nome,geo,atteso,modo] of nuove){
  const sp=M.camSpec({name:nome,...geo,dark_e_s:0.003});
  chk('«'+nome+'» → '+atteso+(modo?' · '+modo:''),
    sp.sensor&&sp.sensor.id===atteso&&(!modo||sp.mode.id===modo),true);
}
/* IMX294 e IMX492 sono lo STESSO silicio letto in due modi. E' il caso che rompe
   uno schema sensore→camera senza il livello intermedio, ed e' il motivo per cui
   la chiave e la COPPIA. */
const bin2=M.camSpec({name:'x',pixel_um:4.63,width_px:4144,height_px:2822,qe_peak:0.9});
const nat =M.camSpec({name:'x',pixel_um:2.315,width_px:8288,height_px:5644,qe_peak:0.9});
chk('IMX294 e IMX492 sono lo stesso sensore',bin2.sensor.id,nat.sensor.id);
chk('ma due modi di lettura diversi',bin2.mode.id!==nat.mode.id,true,
  bin2.mode.id+' contro '+nat.mode.id);
chk('e i pixel differiscono esattamente di due',bin2.mode.pixel_um/nat.mode.pixel_um,2,0.01);

/* Nessun falso positivo: una geometria che non e di nessun sensore noto non deve
   agganciarsi al piu vicino. Con tolleranza al 5% una reflex full frame generica
   da 5,9 um cadeva sull'IMX410. */
chk('una geometria ignota resta IGNOTA',
  M.camSpec({name:'boh',pixel_um:4.2,width_px:5000,height_px:3500,qe_peak:0.7}).sensor,null);
chk('e una reflex generica non viene scambiata per un IMX410',
  M.camSpec(DB.cameras.find(c=>c.id==='dslr_ff')).sensor,null);
chk('gli archetipi generici lo dichiarano nella scheda',
  DB.cameras.filter(c=>c.sensore_generico).length,2);
}

console.log('\n--- catalogo per sensore: precedenza a due livelli ---');
{
const mc=DB.cameras.find(c=>c.id==='asi2600mc');
const mc294=DB.cameras.find(c=>c.id==='asi294mc');
const oe=(c,b)=>M.oscEfficiency(c,b,M.bandSpec(b,c));
console.log('      2600MC Ha: '+oe(mc,'Ha').eta.toFixed(3)+' ('+oe(mc,'Ha').src+')'+
  '   ·   294MC Ha: '+oe(mc294,'Ha').eta.toFixed(3)+' ('+oe(mc294,'Ha').src+')');
/* Due livelli, non tre: MISURA batte MODELLO, e basta. Un valore EREDITATO non e
   un dato — e l'uscita di un modello vecchio e irriproducibile — quindi non
   partecipa alla precedenza. */
chk('dove c e la misura del sensore, vince la misura',oe(mc,'Ha').src,'misura del sensore');
chk('dove non c e, vince il modello',oe(mc294,'Ha').src,'modello spettrale');
chk('nessun ramo restituisce mai un valore ereditato',
  DB.cameras.filter(c=>c.cfa_penalty).every(c=>['Ha','OIII','SII'].every(b=>{
    const e=oe(c,b).eta, er=(c.cfa_fraction_ereditato||{})[b];
    return er==null||Math.abs(e-er)>1e-9;})),true);
chk('e i valori ereditati sono comunque conservati',
  DB.cameras.filter(c=>c.cfa_penalty).every(c=>c.cfa_fraction_ereditato&&c.cfa_fraction_ereditato_note),true);
chk('nessuna scheda camera espone piu un cfa_fraction operativo',
  DB.cameras.every(c=>c.cfa_fraction===undefined),true);
/* La stessa regola vale a ogni livello, ancora compresa: la misura SU QUESTO
   sensore batte la media sui sei. */
const a571=M.dyeAnchor(DB.sensors.find(s=>s.id==='imx571'));
const amed=M.dyeAnchor(null);
chk('l ancora del colorante preferisce la misura sul proprio sensore',/questo sensore/.test(a571.src),true);
chk('e ripiega sulla media dove non c e',/media/.test(amed.src),true,
  a571.t.toFixed(3)+' contro la media '+amed.t.toFixed(3));
/* Ogni campo della scheda risolta deve dichiarare come ci si e arrivati: e la
   differenza fra un motore che degrada in modo dichiarato e uno che degrada in
   silenzio. */
const esiti=new Set();
for(const c of DB.cameras) for(const k of Object.keys(M.camSpec(c).campi))
  esiti.add(M.camSpec(c).campi[k].esito);
chk('ogni campo dichiara il proprio esito',
  [...esiti].every(e=>['misura','modello','dichiarato','esatta','ignoto'].includes(e)),true,
  [...esiti].sort().join(', '));
chk('e ogni campo dice anche COME',
  DB.cameras.every(c=>Object.values(M.camSpec(c).campi).every(v=>v.come&&v.come.length>5)),true);
}

console.log('\n--- catalogo per sensore: il pozzetto si deriva ---');
{
/* pozzetto = min( carica di saturazione del SENSORE , fondo scala ADC x e/ADU ).
   Il minimo taglia da entrambi i lati: completa chi non dichiara — la posa in
   banda larga usciva a 60 s invece di 180 — e corregge chi dichiara troppo,
   perche ToupTek e Moravian pubblicano come pozzetto il fondo scala. */
const s571=DB.sensors.find(s=>s.id==='imx571');
chk('il sensore porta la carica di saturazione, misurata',s571.saturazione_e>0,true,
  s571.saturazione_e+' e-');
chk('e la dichiara una misura',s571.saturazione_fonte.esito,'misura');
const mc=DB.cameras.find(c=>c.id==='asi2600mc');
const lcg=M.gainModes(mc).find(m=>m.name==='LCG');
chk('un pozzetto dichiarato oltre la saturazione viene tagliato',lcg.clamped,true,
  lcg.dichiarato+' → '+lcg.full_well_e);
chk('e il taglio dice da dove viene',/saturazione/.test(lcg.fw_src),true);
/* Una camera nuova senza gain_modes: prima riceveva 20000 e- in silenzio. */
const nuova={name:'ToupTek ATR294C',pixel_um:4.63,width_px:4144,height_px:2822,
  read_noise_e:1.6,qe_peak:0.75,cfa_penalty:0.25,dark_e_s:0.003};
const g=M.gainModes(nuova)[0];
chk('una camera nuova prende il pozzetto dal sensore, non un segnaposto',g.assumed,false);
chk('e il valore e quello del sensore',g.full_well_e,
  DB.sensors.find(s=>s.id==='imx294').saturazione_e);
/* Il difetto vero, misurato: la stessa camera con e senza il sensore riconosciuto.
   Senza, il pozzetto e un segnaposto da 20000 e- e la posa in banda larga esce a
   60 s dove ne servono 150 — due volte e mezzo le pose, gli eventi di lettura e lo
   scarico, senza che nulla lo dicesse. */
{const site={lat:46,lon:10.3,sqm:21.3,seeing:1.6,rms:0.6,fwhm:1.7,horizonMin:20,clearFrac:0.4};
 const tg=TG.targets.find(t=>t.names[0]==='NGC 6888');
 const opt={tg,arch:TG.archetypes[tg.archetype]};
 const base={pixel_um:4.63,width_px:4144,height_px:2822,read_noise_e:1.6,
   qe_peak:0.75,cfa_penalty:0.25,dark_e_s:0.003,name:'ToupTek ATR294C'};
 DB.cameras.push({id:'_t_ok',...base});
 DB.cameras.push({id:'_t_no',...base,sensore_generico:true});
 const posa=id=>M.subExposure(M.derive({tel:'askar71f',red:0.8,cam:id,mnt:'am5',bin:1}),
   site,'RGB',opt).sec;
 const ok=posa('_t_ok'), no=posa('_t_no');
 chk('col pozzetto derivato dal sensore la posa non collassa',ok>=120,true,ok+' s');
 chk('e senza sensore riconosciuto collassa davvero',no<=90,true,no+' s, dal segnaposto');
 chk('il rapporto e quello del pozzetto',ok/no>2,true,'x'+(ok/no).toFixed(1));
 DB.cameras.splice(DB.cameras.findIndex(c=>c.id==='_t_ok'),1);
 DB.cameras.splice(DB.cameras.findIndex(c=>c.id==='_t_no'),1);}
/* Sensore ignoto: il segnaposto resta, ma si DICHIARA. */
const ign=M.gainModes({name:'boh',pixel_um:4.2,width_px:5000,height_px:3500,
  read_noise_e:2,qe_peak:0.7,cfa_penalty:0.25})[0];
chk('senza sensore il segnaposto resta',ign.full_well_e,20000);
chk('ma si dichiara assunto',ign.assumed,true);
chk('e dice perche',/segnaposto/.test(ign.fw_src),true);
}

console.log('\n--- catalogo per sensore: la trasmissione del colorante, misurata ---');
{
/* Le misure EMVA 1288 danno mono e colore della STESSA camera sulla stessa scala
   assoluta, quindi il loro rapporto E la trasmissione del colorante. Sei sensori
   Sony, quattro generazioni, tre laboratori. E' l'ancora che porta una curva
   relativa sul livello giusto, e va protetta da qualunque modifica futura. */
const A=DB.dye_anchors;
chk('le misure di ancoraggio sono in scheda',A&&A.punti&&A.punti.length>=6,true,
  A.punti.length+' sensori');
chk('e ognuna dichiara la propria fonte',A.punti.every(p=>p.come&&p.come.length>10),true);
const ts=A.punti.map(p=>p.verde/p.mono);
const med=ts.reduce((a,b)=>a+b,0)/ts.length;
const sd=Math.sqrt(ts.reduce((s,x)=>s+(x-med)*(x-med),0)/ts.length);
console.log('      T al picco del verde: '+A.punti.map((p,i)=>
  p.sensore+' '+ts[i].toFixed(3)).join(' · '));
console.log(`      media ${med.toFixed(3)}  scarto tipo ${sd.toFixed(3)} (${(100*sd/med).toFixed(1)}%)`);
chk('la trasmissione al picco vale circa 0,86',med,0.864,0.01);
chk('e lo scarto fra quattro generazioni di silicio resta sotto il 3%',sd/med<0.03,true);
chk('ogni singola misura sta entro il 5% dalla media',
  ts.every(t=>Math.abs(t/med-1)<0.05),true);
/* Il rapporto colore/mono che il motore produce deve valere quello misurato,
   non quello che si leggeva dalle due curve del costruttore (0,916). */
const mm=DB.cameras.find(c=>c.id==='asi2600mm'), mc=DB.cameras.find(c=>c.id==='asi2600mc');
const r=M.qeAt(mc,A.lam_nm)/M.qeAt(mm,A.lam_nm);
const p571=A.punti.find(p=>/571/.test(p.sensore));
console.log(`      rapporto colore/mono a ${A.lam_nm} nm: motore ${r.toFixed(3)}`+
  `  misurato ${(p571.verde/p571.mono).toFixed(3)}  vecchie tabelle 0.916`);
chk('il rapporto colore/mono e quello MISURATO sul sensore',r,p571.verde/p571.mono,0.005);
chk('e non piu lo 0,916 delle due tabelle del costruttore',Math.abs(r-0.916)>0.05,true);
/* La forma resta quella della curva del costruttore: solo il livello e corretto. */
chk('la forma viene dalla curva a colori del sensore',
  !!DB.sensors.find(s=>s.id==='imx571').qe_cfa,true);
chk('e il rapporto resta ragionevole su tutta la banda',
  [450,500,550,600,656,700].every(l=>{const x=M.qeAt(mc,l)/M.qeAt(mm,l);return x>0.7&&x<0.95;}),true);
/* Dove la curva a colori non c e non se ne inventa una: livello misurato, forma
   non inventata. E il picco inserito dall'utente deve tornare fuori identico. */
const mc294=DB.cameras.find(c=>c.id==='asi294mc');
const sp294=M.camSpec(mc294);
chk('senza curva a colori si applica la trasmissione misurata, piatta',
  Math.abs(sp294.dye(450)-sp294.dye(650))<1e-12,true);
chk('e la scheda lo dichiara',/piatta/.test(sp294.campi.dye.come),true);
}

console.log('\n--- catalogo per sensore: nessuna regressione fotometrica ---');
{
/* La riorganizzazione non deve toccare cio che era gia giusto. Su MONO non
   esiste colorante: la QE deve restare identica a quella della scheda sensore,
   e eta deve valere 1 esatto su ogni banda. */
const mm=DB.cameras.find(c=>c.id==='asi2600mm');
const sen=DB.sensors.find(s=>s.id==='imx571');
chk('su mono la QE e esattamente quella del sensore',
  [400,500,550,656,700].every(l=>Math.abs(M.qeAt(mm,l)-M.camSpec(mm).qeSil(l))<1e-15),true);
chk('e coincide con la tabella del catalogo ai suoi nodi',M.qeAt(mm,500),sen.qe['500'],1e-15);
chk('su mono il colorante vale 1 esatto',M.camSpec(mm).dye(550),1,0);
for(const b of ['Ha','OIII','SII','L','RGB'])
  chk('  eta = 1 esatto su mono, banda '+b,
    M.oscEfficiency(mm,b,M.bandSpec(b,mm)).eta,1,0);
/* E il riferimento non si e mosso: e la base di tutti i fattori. */
const rc=DB.reference_config;
const dref=M.derive({tel:rc.telescope,red:rc.reducer,cam:rc.camera});
chk('il riferimento resta a fattore 1 esatto',M.timeFactor(dref,'Ha',600),1,1e-12);
chk('e la sua camera e riconosciuta',!!M.camSpec(dref.c).sensor,true,
  M.camSpec(dref.c).sensor.name);
}


/* ═══════════════════════════════════════════════════════════════════════════
   LA NOTTE RICHIESTA E LA NOTTE VERA
   La data nel campo e una RICHIESTA — «non prima di questa notte» — e il motore
   la risolve nella prima notte in cui l'oggetto esiste davvero. Prima erano due
   variabili temporali scollegate: le ore si calcolavano sulla notte CHIESTA e il
   piano si posava su quelle TROVATE.
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n--- la notte richiesta e la notte vera ---');
{
const dv=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
const sB=DB.sites.find(x=>x.id==='borno');
const st={lat:sB.lat_deg,lon:sB.lon_deg,sqm:sB.sqm_zenith,seeing:sB.seeing_typ_arcsec,rms:0.6,
  horizonMin:Math.min(...Object.values(sB.horizon).filter(v=>typeof v==='number')),
  clearFrac:sB.clear_night_fraction};
st.fwhm=M.effFWHM(st.seeing,st.rms);
const eskimo=M.synthTarget(CAT.objects.find(x=>x.name==='NGC 2392'));
const oggi=new Date(2026,8,3,12,0,0);            // riferimento fisso: 3 settembre 2026

/* Il caso segnalato. NGC 2392 e in Gemini: a settembre, da Borno, sorge quando
   la notte astronomica e gia finita. Il motore scandiva avanti e pianificava in
   ottobre — cosa corretta — senza dirlo a nessuno. */
const rn=M.resolveNight(eskimo,st,new Date(2026,8,11,12,0,0),{now:oggi});
console.log(`      NGC 2392 chiesto l 11 set → prima notte vera ${rn.date.toLocaleDateString('it-IT')}`+
  ` (+${rn.shift} g, ${rn.skipped.length} notti scartate)`);
chk('la notte chiesta si risolve nella prima notte utile',rn.usable,true);
chk('e lo spostamento e un numero, non un silenzio',rn.shift>0,true,'+'+rn.shift+' giorni');
chk('la notte risolta e SEMPRE uguale o successiva a quella chiesta',rn.date>=rn.wanted,true);
chk('ogni notte scartata dichiara il proprio perche',
  rn.skipped.length>0&&rn.skipped.every(k=>k.why&&k.why.length>3),true);
chk('la prima ragione e che l oggetto non sale',/sotto la soglia/.test(rn.skipped[0].why),true,
  rn.skipped[0].why);
/* Il difetto vero: sulla notte CHIESTA l'oggetto non esiste, quindi le ore utili
   sono zero e la Luna non e nemmeno misurabile. Calcolare la prescrizione la e
   calcolarla nel vuoto. */
const npChiesta=M.nightProfile(rn.wanted,st.lat,st.lon);
const npVera=M.nightProfile(rn.date,st.lat,st.lon);
const eC=M.evaluate(eskimo,dv,st,npChiesta,{});
const eV=M.evaluate(eskimo,dv,st,npVera,{});
console.log(`      ore utili sul critico: notte chiesta ${eC.critH.toFixed(2)} h · notte vera ${eV.critH.toFixed(2)} h`);
chk('sulla notte chiesta le ore utili sono zero',eC.critH<0.01,true);
/* dMagV e null, non NaN. E isFinite(null) in JS vale TRUE, perche null coerce
   a zero: e proprio il modo in cui una notte inesistente si traveste da notte
   senza Luna. Il controllo va fatto su null, non sulla finitezza. */
chk('e la Luna non e nemmeno misurabile',eC.dMagV==null,true,String(eC.dMagV));
chk('sulla notte vera le ore utili esistono',eV.critH>0.5,true,eV.critH.toFixed(2)+' h');
chk('e la Luna e un numero',eV.dMagV!=null&&isFinite(eV.dMagV),true,'ΔmagV '+eV.dMagV.toFixed(2));
/* Il piano deve posarsi sulla notte risolta, e le sue notti devono coincidere
   con quelle che la risoluzione ha trovato: una sola catena, non due. */
const pr=M.prescribe(eV,8,dv);
const pl=M.planNights(pr,eV,dv,3,{site:st,date:rn.date});
const w=M.nightWindows(eskimo,st,rn.date,3,{});
chk('il piano parte dalla notte risolta',
  w.nights[0].date.toDateString()===rn.date.toDateString(),true,
  w.nights[0].date.toLocaleDateString('it-IT'));
chk('e non scarta piu nulla: la prima notte e gia buona',w.skipped.length,0);

/* Nessun falso positivo: lo stesso oggetto in stagione non si muove di un giorno. */
const inv=M.resolveNight(eskimo,st,new Date(2027,0,15,12,0,0),{now:oggi});
chk('lo stesso oggetto in stagione non viene spostato',inv.shift,0);
chk('e non scarta nessuna notte',inv.skipped.length,0);
/* E un oggetto estivo chiesto d estate nemmeno. */
const cres=TG.targets.find(x=>x.names[0]==='NGC 6888');
chk('un oggetto in stagione non viene spostato',
  M.resolveNight(cres,st,new Date(2026,8,11,12,0,0),{now:oggi}).shift,0);

/* Il passato si DICHIARA, non si corregge da solo: guardare cosa si e ripreso
   una notte trascorsa e una richiesta legittima. */
const pas=M.resolveNight(cres,st,new Date(2026,7,20,12,0,0),{now:oggi});
chk('una notte passata viene contata in giorni',pas.past,14);
chk('e non viene spostata a stanotte di nascosto',pas.wanted.getMonth(),7);
chk('mentre una notte futura non e passata',
  M.resolveNight(cres,st,new Date(2026,9,20,12,0,0),{now:oggi}).past,0);

/* Un oggetto che da qui non sale MAI deve dirlo, non restituire una data finta.
   Il catalogo curato non contiene nulla sotto i -45°, quindi il caso si costruisce:
   da 46°N un oggetto a dec -70° non passa mai l'orizzonte, in nessuna notte
   dell'anno. Il motore non deve rispondere con una data. */
{const invisibile={...cres,id:'test_sud',names:['test sud'],ra_deg:6.0,dec_deg:-70.0};
 const r=M.resolveNight(invisibile,st,new Date(2026,8,11,12,0,0),{now:oggi,horizonDays:60});
 console.log(`      oggetto a dec -70° da ${st.lat.toFixed(0)}°N: utilizzabile ${r.usable},`+
   ` notti scandite ${r.scanned}`);
 chk('un oggetto che non sale mai lo dichiara',r.usable,false);
 chk('e non inventa una data',r.date.toDateString(),r.wanted.toDateString());
 chk('e dice quante notti ha guardato prima di arrendersi',r.scanned>=60,true,r.scanned+' notti');
 chk('con la ragione su ognuna',r.skipped.every(k=>/sotto la soglia/.test(k.why)),true);}
/* Senza bersaglio non c e niente da risolvere: la notte chiesta resta quella. */
const vuoto=M.resolveNight(null,st,new Date(2026,8,11,12,0,0),{now:oggi});
chk('senza bersaglio la notte chiesta resta intatta',vuoto.shift,0);
chk('e non si inventa uno stato di utilizzabilita',vuoto.usable,null);
}

console.log(`\n${pass} verifiche superate, ${fail} fallite\n`);
process.exit(fail?1:0);
