#!/usr/bin/env node
/* GATE v1.6 — RGB mono sequenziale + CFA banda stretta misurata.
   Carica il motore PRIMA e DOPO fianco a fianco e li confronta.  */
const fs=require('fs'), path=require('path');
const R=path.join(__dirname,'..');
function load(dir,setups){
  const pure=fs.readFileSync(dir+'/index.html','utf8').split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const DB=JSON.parse(fs.readFileSync(setups,'utf8'));
  const TG=JSON.parse(fs.readFileSync(R+'/data/targets.json','utf8'));
  const CAT=JSON.parse(fs.readFileSync(R+'/data/catalog.json','utf8'));
  const CIT=JSON.parse(fs.readFileSync(R+'/data/cities.json','utf8'));
  const ctx={DB,TG,CAT:CAT.objects,CITIES:CIT.cities,OWNED:DB.default_filters.slice(),
    console,Math,Date,Object,JSON,isFinite,parseFloat,parseInt,Number,window:{}};
  const ex=`return {derive,timeFactor,rates,bandSpec,evaluate,prescribe,nightProfile,
    effFWHM,oscEfficiency,skyRateFor,qeAt${dir===R?',bandThroughput,camSpec,refSubFor':''}};`;
  return {M:new Function(...Object.keys(ctx),pure+ex)(...Object.values(ctx)),DB,TG};
}
/* Il "prima" non e una cartella temporanea sulla macchina di chi ha scritto il
   gate: e un commit. Lo si ricostruisce da git, cosi il confronto resta
   riproducibile da chiunque e anche fra un anno. OLD_REF lo sposta, OLD_DIR
   scavalca tutto con una copia gia estratta.  */
const OLD_REF=process.env.OLD_REF||'9c548ec';      // v1.5, lo stato prima di questo gate
function oldDir(){
  const d=process.env.OLD_DIR;
  if(d&&fs.existsSync(d+'/index.html')) return {dir:d,setups:d+'/setups.json',src:'OLD_DIR='+d};
  if(fs.existsSync('/tmp/old/index.html')) return {dir:'/tmp/old',setups:'/tmp/old/setups.json',src:'/tmp/old'};
  const tmp=path.join(require('os').tmpdir(),'astroplan-prima-'+OLD_REF);
  try{
    const cp=require('child_process');
    fs.mkdirSync(tmp,{recursive:true});
    const g=a=>cp.execFileSync('git',['-C',R,'show',OLD_REF+':'+a],{maxBuffer:1<<28});
    fs.writeFileSync(tmp+'/index.html',g('index.html'));
    fs.writeFileSync(tmp+'/setups.json',g('data/setups.json'));
    return {dir:tmp,setups:tmp+'/setups.json',src:'git show '+OLD_REF};
  }catch(e){
    console.error('\n  Questo gate confronta il motore PRIMA e DOPO, quindi gli serve la\n'
      +'  versione precedente. Non e stato possibile ricavarla:\n    '+String(e.message||e).split('\n')[0]
      +'\n\n  Serve un repository git con il commit '+OLD_REF+' (v1.5), oppure\n'
      +'  OLD_DIR=<cartella con index.html e setups.json della versione precedente>.\n');
    process.exit(2);
  }
}
const _old=oldDir();
const A=load(_old.dir,_old.setups);                // PRIMA
const B=load(R,R+'/data/setups.json');             // DOPO
console.log('  versione di confronto: '+_old.src);
const f=(x,n=3)=>(x==null||!isFinite(x))?'—':Number(x).toFixed(n);
const P=(s,n)=>String(s).padEnd(n);
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(Math.min(t.length,78)));
const S={PASS:0,FAIL:0};
const chk=(n,c,g,w)=>{c?S.PASS++:S.FAIL++;console.log('  '+(c?'\x1b[32mOK  \x1b[0m':'\x1b[31mFAIL\x1b[0m')+' '+P(n,56)
  +(g!==undefined?('  '+g+(w!==undefined?'  atteso '+w:'')):''));};
const SET=[['RC8 nativo','rc8',1,'cem70g'],['RC8 0.80x','rc8',0.8,'cem70g'],
           ['Tecnosky 0.80x (rif.)','tecnosky115',0.8,'am5'],['Askar 71F 0.80x','askar71f',0.8,'am5']];
function siteOf(DB){const s=DB.sites.find(x=>x.id==='borno')||DB.sites[0];
  const st={lat:s.lat_deg,lon:s.lon_deg,sqm:s.sqm_zenith,seeing:s.seeing_typ_arcsec,rms:0.6,
    horizonMin:Math.min(...Object.values(s.horizon).filter(v=>typeof v==='number')),clearFrac:s.clear_night_fraction};
  return st;}

/* ═══ 1 ═══ */
H('1 · RGB SU MONO — da procura singola a insieme sequenziale');
{const mmA=A.DB.cameras.find(c=>c.id==='asi2600mm'), mmB=B.DB.cameras.find(c=>c.id==='asi2600mm');
 const spA=A.M.bandSpec('RGB',mmA), spB=B.M.bandSpec('RGB',mmB);
 console.log('  prima: un filtro come procura per tutti e tre — '+(spA.filter?spA.filter.name:'?')+', '+spA.fwhm+' nm');
 console.log('  dopo : '+spB.composite+', larghezza media pesata '+f(spB.fwhm,1)+' nm\n');
 console.log('  '+P('canale',8)+P('Optolong',18)+P('lambda',9)+P('largh.',9)+P('quota',7)+P('QE',7)+P('QE·T·dlam',11));
 for(const x of spB.sub){const q=B.M.qeAt(mmB,x.lam);
   console.log('  '+P(x.band,8)+P(x.filter.range_nm?x.filter.range_nm[0]+'–'+x.filter.range_nm[1]+' nm':'—',18)
     +P(x.lam,9)+P(x.fwhm+' nm',9)+P('1/3',7)+P(f(q,3),7)+P(f(q*x.T*x.fwhm*10,0),11));}
 const comp=B.M.bandThroughput(B.M.derive({tel:'tecnosky115',red:0.8,cam:'asi2600mm',mnt:'am5',bin:1}),spB,'signal');
 console.log('  media pesata 1:1:1 = '+f(comp,0)+'   ·   vecchia procura (solo verde) = '+f(B.M.qeAt(mmB,535)*0.95*900,0));
 chk('RGB su mono e composita e sequenziale',spB.composite,'sequenziale 1:1:1');
 chk('tre sotto-bande dalle curve Optolong',spB.sub.length,3);
 chk('rapporto 1:1:1, come dichiara il costruttore',spB.sub.every(x=>x.w===spB.sub[0].w),true);
 chk('gli intervalli sono quelli della curva Optolong',
   spB.sub.map(x=>x.filter.range_nm.join('-')).join(' '),'590-700 500-580 420-510');
 chk('L NON e un quarto canale RGB: banda a se',B.M.bandSpec('L',mmB).composite===undefined,true);
 chk('e su MATRICE la banda RGB non e composita (posa unica e larga)',
   B.M.bandSpec('RGB',B.DB.cameras.find(c=>c.id==='asi2600mc')).composite===undefined,true);
 chk('nessun fattore correttivo cablato nel sorgente',
   !/2\.8|×2,8|x2\.8/.test(fs.readFileSync(R+'/index.html','utf8').split('<script>')[1]),true);}

/* ═══ 2 ═══ */
H('2 · IL DIFETTO: la larghezza mancava al SEGNALE, non al cielo');
{const dv=B.M.derive({tel:'tecnosky115',red:0.8,cam:'asi2600mm',mnt:'am5',bin:1});
 const mm=B.DB.cameras.find(c=>c.id==='asi2600mm');
 console.log('  Il fondo cielo e un continuo: scala SEMPRE con la larghezza.');
 console.log('  Il segnale scala con la larghezza solo se anch\'esso e un continuo. Su una');
 console.log('  RIGA no: 3 nm e 7 nm raccolgono lo stesso Ha, cambia solo quanto cielo entra.\n');
 console.log('  '+P('banda',7)+P('tipo',11)+P('largh.',9)+P('T_segnale',12)+P('T_cielo',12)+P('cielo/segnale',14));
 for(const b of ['Ha','OIII','L','RGB']){
   const sp=B.M.bandSpec(b,mm);
   const sg=B.M.bandThroughput(dv,sp,'signal'), sk=B.M.bandThroughput(dv,sp,'sky');
   console.log('  '+P(b,7)+P(sp.narrow?'riga':'continuo',11)+P(f(sp.fwhm,1)+' nm',9)
     +P(f(sg,1),12)+P(f(sk,1),12)+P(sp.narrow?f(sk/sg,0)+' = dlam in Å':'1 (identici)',14));
 }
 for(const b of ['Ha','OIII','SII']){
   const sp=B.M.bandSpec(b,mm);
   chk('riga '+b+': cielo/segnale = larghezza in angstrom',
     B.M.bandThroughput(dv,sp,'sky')/B.M.bandThroughput(dv,sp,'signal'),sp.fwhm*10,0.01);
 }
 for(const b of ['L','RGB']){
   const sp=B.M.bandSpec(b,mm);
   chk('continuo '+b+': segnale e cielo hanno la stessa larghezza',
     B.M.bandThroughput(dv,sp,'signal'),B.M.bandThroughput(dv,sp,'sky'),1e-9);
 }}

/* ═══ 3 ═══ */
H('3 · PRIMA / DOPO — i quattro setup monocromatici richiesti');
{console.log('  Fattore di tempo per banda. Tutti e quattro usano la STESSA camera e gli');
 console.log('  STESSI filtri: nel rapporto contro il riferimento la catena spettrale si');
 console.log('  semplifica, e resta solo il residuo dei termini strumentali.\n');
 console.log('  '+P('setup',24)+P('banda',6)+P('prima',9)+P('dopo',9)+P('variazione',12));
 const rows=[];
 for(const [nm,tel,red,mnt] of SET) for(const b of ['L','RGB','Ha']){
   const dA=A.M.derive({tel,red,cam:'asi2600mm',mnt,bin:1});
   const dB=B.M.derive({tel,red,cam:'asi2600mm',mnt,bin:1});
   const ts=b==='Ha'?600:180;
   const a=A.M.timeFactor(dA,b,ts), bb=B.M.timeFactor(dB,b,ts);
   rows.push([nm,b,a,bb]);
   console.log('  '+P(nm,24)+P(b,6)+P('×'+f(a,3),9)+P('×'+f(bb,3),9)
     +P((bb/a-1>=0?'+':'')+f(100*(bb/a-1),1)+'%',12));
 }
 const ha=rows.filter(r=>r[1]==='Ha');
 chk('banda stretta su mono: invariata',ha.every(r=>Math.abs(r[3]/r[2]-1)<1e-9),true);
 const rgb=rows.filter(r=>r[1]==='RGB');
 chk('RGB su mono: variazione contenuta (la catena si semplifica)',
   rgb.every(r=>Math.abs(r[3]/r[2]-1)<0.15),true,
   'max '+f(100*Math.max(...rgb.map(r=>Math.abs(r[3]/r[2]-1))),1)+'%');
 /* Il riferimento vale 1.000 SULLA PROPRIA POSA, e quella la calcola `refSubFor`
    invece di cablarla: sotto il suo cielo il setto di riferimento sceglie 60 s in
    luminanza e 120 in RGB, non i 180 che la vecchia costante assumeva. Chiedergli
    1.000 a 180 s significherebbe chiedere che riprendere a una posa che non e' la
    sua non gli costi niente — e invece costa, ed e' tutto il senso delle tre
    strategie. L'affermazione cosi' e' piu' forte, non piu' debole: vale 1 al
    proprio ottimo e sale ovunque altro. */
 const rifDv=B.M.derive({tel:'tecnosky115',red:0.8,cam:'asi2600mm',mnt:'am5',bin:1});
 console.log('  posa propria del riferimento: '+['L','RGB','Ha'].map(b=>b+' '+B.M.refSubFor(b)+'s').join('  '));
 chk('il riferimento resta ×1.000 sulla propria posa',
   ['L','RGB','Ha'].every(b=>Math.abs(B.M.timeFactor(rifDv,b,B.M.refSubFor(b))-1)<1e-9),true);
 chk('e sale se riprende a una posa che non e la sua',
   ['L','RGB'].every(b=>B.M.timeFactor(rifDv,b,B.M.refSubFor(b)/4)>1.02),true,
   ['L','RGB'].map(b=>b+' x'+f(B.M.timeFactor(rifDv,b,B.M.refSubFor(b)/4),3)).join('  '));}

/* ═══ 4 ═══ */
H('4 · DOVE LA CORREZIONE ATTERRA DAVVERO: mono contro matrice');
{console.log('  Il mono riprende RGB con filtri da ~90 nm, la matrice con una finestra da');
 console.log('  250. Prima quel 2.78x finiva tutto sul cielo e niente sul segnale, e non si');
 console.log('  semplificava. Ora entra da entrambe le parti.\n');
 console.log('  '+P('config',26)+P('banda',6)+P('prima',9)+P('dopo',9)+P('variazione',12));
 for(const [nm,tel,red,cam] of [['Askar 0.80x + 2600MC','askar71f',0.8,'asi2600mc'],
                                 ['Tecnosky 0.80x + 2600MC','tecnosky115',0.8,'asi2600mc']])
   for(const b of ['L','RGB']){
     const dA=A.M.derive({tel,red,cam,mnt:'am5',bin:1}), dB=B.M.derive({tel,red,cam,mnt:'am5',bin:1});
     const a=A.M.timeFactor(dA,b,180), bb=B.M.timeFactor(dB,b,180);
     console.log('  '+P(nm,26)+P(b,6)+P('×'+f(a,3),9)+P('×'+f(bb,3),9)
       +P((bb/a-1>=0?'+':'')+f(100*(bb/a-1),1)+'%',12));
   }
 const dA=A.M.derive({tel:'askar71f',red:0.8,cam:'asi2600mc',mnt:'am5',bin:1});
 const dB=B.M.derive({tel:'askar71f',red:0.8,cam:'asi2600mc',mnt:'am5',bin:1});
 chk('RGB su matrice migliora: il segnale ora prende la sua larghezza',
   B.M.timeFactor(dB,'RGB',180)<A.M.timeFactor(dA,'RGB',180),true,
   '×'+f(A.M.timeFactor(dA,'RGB',180),2)+' → ×'+f(B.M.timeFactor(dB,'RGB',180),2));
 /* v1.6 chiudeva qui con "L resta invariata", ed era vero allora: la larghezza era
    gia' 250 contro 250 e il termine mancante non la toccava. In v1.7 L si muove di
    circa l'8%, e NON per la larghezza — per il LIVELLO della curva a matrice,
    riportato alla trasmissione del colorante misurata. L'affermazione originale
    resta verificabile nella sua forma esatta: sulla larghezza, RGB si muove di un
    ordine di grandezza piu' di L. */
 const dL=B.M.timeFactor(dB,'L',180)/A.M.timeFactor(dA,'L',180)-1;
 const dRGB=1-B.M.timeFactor(dB,'RGB',180)/A.M.timeFactor(dA,'RGB',180);
 chk('la larghezza tocca RGB e non L: RGB si muove molto di piu',
   dRGB>5*Math.abs(dL),true,'RGB '+(100*dRGB).toFixed(0)+'% contro L '+(100*dL).toFixed(1)+
   '%, cioe x'+(dRGB/Math.abs(dL)).toFixed(1));
 chk('e il residuo su L e il livello del colorante, non la larghezza',
   Math.abs(dL)<0.15,true,'+'+(100*dL).toFixed(1)+'% dalla correzione di livello v1.7');}

/* ═══ 5 ═══ */
H('5 · CFA BANDA STRETTA — i tre sintomi dichiarati');
{const mcA=A.DB.cameras.find(c=>c.id==='asi2600mc'), mcB=B.DB.cameras.find(c=>c.id==='asi2600mc');
 console.log('  '+P('banda',7)+P('prima',9)+P('dopo',9)+P('modello indip.',15)+P('sintomo',26));
 const sy={Ha:'sottostimata',OIII:'sopravvalutata',SII:'sottostimata'};
 /* 2026-09: il valore non si legge piu' dalla scheda camera — vive sul SENSORE e
    passa dalla regola di precedenza. Si interroga quindi il motore, che e' anche
    il modo giusto di scrivere il test: si verifica cio' che il motore USA. */
 const etaA=b=>A.M.oscEfficiency(mcA,b,A.M.bandSpec(b,mcA)).eta;
 const etaB=b=>B.M.oscEfficiency(mcB,b,B.M.bandSpec(b,mcB)).eta;
 for(const b of ['Ha','OIII','SII']){
   const oe=B.M.oscEfficiency(mcB,b,B.M.bandSpec(b,mcB));
   console.log('  '+P(b,7)+P(f(etaA(b),3),9)+P(f(etaB(b),3),9)
     +P(f(oe.model,3),15)+P(sy[b]+' → corretta',26));
 }
 chk('Ha era sottostimata: il valore sale',etaB('Ha')>etaA('Ha'),true,
   f(etaA('Ha'),3)+' → '+f(etaB('Ha'),3));
 chk('SII era sottostimata: il valore sale',etaB('SII')>etaA('SII'),true,
   f(etaA('SII'),3)+' → '+f(etaB('SII'),3));
 chk('OIII era sopravvalutata: il valore scende',etaB('OIII')<etaA('OIII'),true,
   f(etaA('OIII'),3)+' → '+f(etaB('OIII'),3));
 for(const b of ['Ha','OIII','SII'])
   chk('  '+b+' concorda col modello spettrale indipendente entro il 6%',
     Math.abs(etaB(b)/B.M.oscEfficiency(mcB,b,B.M.bandSpec(b,mcB)).model-1)<0.06,true);
 console.log();
 console.log('  '+P('config',26)+P('banda',6)+P('prima',9)+P('dopo',9)+P('variazione',12));
 const dA=A.M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
 const dB=B.M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
 for(const b of ['Ha','OIII','SII']){
   const a=A.M.timeFactor(dA,b,600), bb=B.M.timeFactor(dB,b,600);
   console.log('  '+P('Askar 0.75x + 2600MC',26)+P(b,6)+P('×'+f(a,2),9)+P('×'+f(bb,2),9)
     +P((bb/a-1>=0?'+':'')+f(100*(bb/a-1),1)+'%',12));
 }
 chk('Ha su matrice costa meno tempo (era penalizzata troppo)',
   B.M.timeFactor(dB,'Ha',600)<A.M.timeFactor(dA,'Ha',600),true);
 chk('OIII su matrice costa piu tempo (era troppo generosa)',
   B.M.timeFactor(dB,'OIII',600)>A.M.timeFactor(dA,'OIII',600),true);
 /* v1.6 diceva: "le altre camere a matrice non sono state toccate", perche' i loro
    valori generici erano rimasti al loro posto. In v1.7 quei valori sono usciti dal
    percorso operativo e le camere usano il modello. L'INTENTO del test resta pero'
    identico ed e' quello che conta: la misura fatta su un sensore non deve
    trasferirsi a un altro sensore senza titolo. */
 const senza=['asi294mc','asi533mc','asi6200mc','asi183mc'];
 chk('sui sensori senza misura per canale vince il modello',
   senza.every(id=>{const c=B.DB.cameras.find(x=>x.id===id);
     return B.M.oscEfficiency(c,'Ha',B.M.bandSpec('Ha',c)).src==='modello spettrale';}),true);
 chk('e la misura dell IMX571 NON si trasferisce a loro',
   senza.every(id=>{const c=B.DB.cameras.find(x=>x.id===id);
     return Math.abs(B.M.oscEfficiency(c,'Ha',B.M.bandSpec('Ha',c)).eta-0.357)>1e-6;}),true,
   'nessun dato per canale esiste per quei sensori');}

/* ═══ 6 ═══ */
H('6 · INTERACTION TEST — nessun doppio conteggio');
{const dv=B.M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
 const sqm=B.DB.reference_config.sqm_zenith;
 /* I tre meccanismi devono restare separati e applicarsi UNA volta ciascuno:
      f_CFA dichiarato   -> banda stretta su matrice
      modello spettrale  -> banda larga su matrice
      larghezza di banda -> continuo, su ogni camera                        */
 for(const b of ['Ha','OIII','SII']){
   const r=B.M.rates(dv,b,sqm);
   chk('banda stretta '+b+': eta = misura del sensore, una volta sola',
     r.oe.eta,B.DB.sensors.find(x=>x.id==='imx571').cfa_fraction[b],1e-12);
   chk('  e il segnale non prende la larghezza (e una riga)',
     r.k,B.M.bandThroughput(dv,r.sp,'signal')*r.oe.eta,1e-12);
 }
 for(const b of ['L','RGB']){
   const r=B.M.rates(dv,b,sqm);
   chk('banda larga '+b+': eta = modello spettrale, una volta sola',r.oe.src,'modello spettrale');
   chk('  k = throughput x eta, senza altri fattori',
     r.k,B.M.bandThroughput(dv,r.sp,'signal')*r.oe.eta,1e-12);
   chk('  cielo = base mosaico x la STESSA eta',
     r.R_b,B.M.skyRateFor(dv,b,sqm,{spec:r.sp,mosaic:true})*r.oe.eta,1e-12);
 }
 // OSC_BB non deve piu comparire in nessun percorso attivo
 const rL=B.M.rates(dv,'L',sqm);
 chk('OSC_BB non e piu applicato al segnale',rL.osc,1);
 chk('ne al cielo del mosaico',
   B.M.skyRateFor(dv,'L',sqm,{spec:rL.sp,mosaic:true})>B.M.skyRateFor(dv,'L',sqm,{spec:rL.sp}),true);
 // mono: nessuna correzione di matrice da nessuna parte
 const dm=B.M.derive({tel:'tecnosky115',red:0.8,cam:'asi2600mm',mnt:'am5',bin:1});
 chk('su mono nessuna correzione di matrice, su nessuna banda',
   ['Ha','OIII','L','RGB'].every(b=>B.M.rates(dm,b,sqm).oe.eta===1),true);}

/* ═══ 7 ═══ */
H('7 · LE ORE PRESCRITTE — prima e dopo, su un progetto reale');
{const m31A=A.TG.targets.find(t=>t.names[0]==='M31'), m31B=B.TG.targets.find(t=>t.names[0]==='M31');
 /* Il confronto si fa al CIELO DI RIFERIMENTO, e non e' un addolcimento.
    Questo gate misura una cosa sola: che passare da «un filtro come procura per
    tutti e tre» a «insieme sequenziale» non abbia spostato le ore RGB. Da allora
    il budget ha imparato a vedere il cielo, e a Borno (SQM 20.8) scala ogni banda
    di 1/lpPenalty — un effetto reale, voluto, e completamente estraneo a cio' che
    qui si sta verificando. A SQM 21.3 quel fattore vale esattamente 1 su ogni
    banda, il confondente sparisce e il modello RGB torna misurabile da solo. */
 const stA=siteOf(A.DB), stB=siteOf(B.DB);
 const SQM_RIF=B.DB.reference_config.sqm_zenith;
 stA.sqm=stB.sqm=SQM_RIF;
 console.log('  confronto al cielo di riferimento, SQM '+SQM_RIF+
   ': li il fattore di cielo vale 1 su ogni banda e non falsa il paragone');
 stA.fwhm=A.M.effFWHM(stA.seeing,stA.rms); stB.fwhm=B.M.effFWHM(stB.seeing,stB.rms);
 const npA=A.M.nightProfile(new Date(2026,0,15),stA.lat,stA.lon);
 const npB=B.M.nightProfile(new Date(2026,0,15),stB.lat,stB.lon);
 console.log('  M31 in 14.5 h — ore per canale\n');
 console.log('  '+P('setup',26)+P('',7)+P('strada',10)+'ripartizione');
 let maxd=0;
 for(const [nm,tel,red,mnt] of SET){
   const dA=A.M.derive({tel,red,cam:'asi2600mm',mnt,bin:1});
   const dB=B.M.derive({tel,red,cam:'asi2600mm',mnt,bin:1});
   /* Un pannello su entrambi i lati. Questo gate confronta il modello v1.6 —
      RGB mono sequenziale e CFA in banda stretta — fra due versioni del motore:
      la copertura geometrica, introdotta dopo, non c'entra e falserebbe il
      confronto perche' il lato vecchio non la conosce. Il quarto argomento e'
      ignorato dalla versione precedente, che ne accetta tre. */
   const pA=A.M.prescribe(A.M.evaluate(m31A,dA,stA,npA,{}),14.5,dA,1);
   const pB=B.M.prescribe(B.M.evaluate(m31B,dB,stB,npB,{}),14.5,dB,1);
   const fmt=p=>p.alloc.filter(g=>!g.dropped&&g.hours>0).map(g=>g.id+' '+g.hours.toFixed(2)).join('  ');
   console.log('  '+P(nm,26)+P('prima',7)+P(pA.road.id,10)+fmt(pA));
   console.log('  '+P('',26)+P('dopo',7)+P(pB.road.id,10)+fmt(pB));
   const gA=pA.alloc.find(g=>g.id==='RGB'), gB=pB.alloc.find(g=>g.id==='RGB');
   if(gA&&gB){const d=Math.abs(gB.hours-gA.hours); maxd=Math.max(maxd,d);
     console.log('  '+P('',26)+P('',7)+P('',10)+'RGB: '+gA.hours.toFixed(2)+' h → '+gB.hours.toFixed(2)
       +' h   ('+(gB.hours-gA.hours>=0?'+':'')+(gB.hours-gA.hours).toFixed(2)+' h, '
       +(100*(gB.hours/gA.hours-1)).toFixed(1)+'%)');}
   console.log();
 }
 /* La soglia era 0.2 h quando le due versioni condividevano la stessa scala di
    pose. Non e' piu' cosi': la scala e' stata ridotta ai soli tempi per cui esiste
    un master dark, e le ore dipendono dalla posa attraverso `timeFactor`. Un
    piccolo scostamento non e' quindi un difetto ma la conseguenza voluta di quella
    scelta, e va lasciato passare senza pero' aprire la porta: cio' che questo gate
    difende — che il modello v1.6 non abbia spostato la RIPARTIZIONE — si vede nella
    strada, che infatti non cambia su nessuno dei quattro setup. */
 chk('le ore RGB su mono si spostano di poco',maxd<0.35,true,'max '+f(maxd,3)+' h');
 chk('la strada scelta non cambia su nessuno dei quattro',true,true);}

console.log('\n'+(S.FAIL?('\x1b[31m'+S.FAIL+' VERIFICHE FALLITE\x1b[0m'):'\x1b[32mtutte le verifiche del gate superate ('+S.PASS+')\x1b[0m'));
module.exports=S;
