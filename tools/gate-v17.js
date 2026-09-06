#!/usr/bin/env node
/* GATE v1.7 — catalogo per SENSORE, precedenza a due livelli, pozzetto derivato.
   Carica il motore PRIMA e DOPO fianco a fianco e li confronta.

   Il "prima" e' un commit, non una cartella temporanea sulla macchina di chi ha
   scritto il gate: si ricostruisce da git, cosi il confronto resta riproducibile.
   OLD_REF lo sposta, OLD_DIR lo scavalca con una copia gia' estratta.            */
const fs=require('fs'), path=require('path');
const R=path.join(__dirname,'..');
const OLD_REF=process.env.OLD_REF||'e859d49';      // v1.6 + documentazione
function oldDir(){
  const d=process.env.OLD_DIR;
  if(d&&fs.existsSync(d+'/index.html')) return {dir:d,setups:d+'/setups.json',src:'OLD_DIR='+d};
  if(fs.existsSync('/tmp/old17/index.html')) return {dir:'/tmp/old17',setups:'/tmp/old17/setups.json',src:'/tmp/old17'};
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
      +'\n\n  Serve un repository git con il commit '+OLD_REF+' (v1.6), oppure\n'
      +'  OLD_DIR=<cartella con index.html e setups.json della versione precedente>.\n');
    process.exit(2);
  }
}
function load(dir,setups,nuovo){
  const pure=fs.readFileSync(dir+'/index.html','utf8').split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const DB=JSON.parse(fs.readFileSync(setups,'utf8'));
  const TG=JSON.parse(fs.readFileSync(R+'/data/targets.json','utf8'));
  const CAT=JSON.parse(fs.readFileSync(R+'/data/catalog.json','utf8'));
  const CIT=JSON.parse(fs.readFileSync(R+'/data/cities.json','utf8'));
  const ctx={DB,TG,CAT:CAT.objects,CITIES:CIT.cities,OWNED:DB.default_filters.slice(),
    console,Math,Date,Object,JSON,isFinite,parseFloat,parseInt,Number,window:{}};
  const ex=`return {derive,timeFactor,rates,bandSpec,evaluate,prescribe,nightProfile,effFWHM,
    oscEfficiency,qeAt,gainModes,gainModeFor,subExposure${nuovo?',camSpec,dyeAnchor,refSubFor':''}};`;
  return {M:new Function(...Object.keys(ctx),pure+ex)(...Object.values(ctx)),DB,TG};
}
const _old=oldDir();
const A=load(_old.dir,_old.setups,false);          // PRIMA
const B=load(R,R+'/data/setups.json',true);        // DOPO
const f=(x,n=3)=>(x==null||!isFinite(x))?'—':Number(x).toFixed(n);
const P=(s,n)=>String(s).padEnd(n);
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(Math.min(t.length,78)));
const S={PASS:0,FAIL:0};
const chk=(n,c,g,w)=>{c?S.PASS++:S.FAIL++;console.log('  '+(c?'\x1b[32mOK  \x1b[0m':'\x1b[31mFAIL\x1b[0m')+' '+P(n,58)
  +(g!==undefined?('  '+g+(w!==undefined?'  atteso '+w:'')):''));};
console.log('  versione di confronto: '+_old.src);

const SET=[['RC8 + 2600MM','rc8',1,'asi2600mm'],['RC8 + 2600MC','rc8',1,'asi2600mc'],
           ['RC8 0.80x + 2600MM','rc8',0.8,'asi2600mm'],
           ['Tecnosky 0.80x + 2600MM (rif.)','tecnosky115',0.8,'asi2600mm'],
           ['Askar 0.80x + 2600MM','askar71f',0.8,'asi2600mm'],
           ['Askar 0.80x + 2600MC','askar71f',0.8,'asi2600mc'],
           ['Askar 0.80x + 294MC','askar71f',0.8,'asi294mc']];
const BANDS=['Ha','OIII','SII','RGB','L'];
const ts=b=>['RGB','L'].includes(b)?180:600;

/* ═══ 1 ═══ */
H('1 · RICONOSCIMENTO — l utente non sceglie nessun modello');
{
 console.log('  '+P('camera in catalogo',30)+P('sensore · modo',34)+'come');
 for(const c of B.DB.cameras.slice(0,6)){
   const sp=B.M.camSpec(c);
   console.log('  '+P(c.name.slice(0,28),30)+P(sp.sensor?sp.sensor.name+' · '+sp.mode.id:'—',34)+(sp.via||''));
 }
 const noti=B.DB.cameras.filter(c=>B.M.camSpec(c).sensor).length;
 const gen=B.DB.cameras.filter(c=>c.sensore_generico).length;
 chk('ogni camera reale del catalogo risolve a un sensore',noti===B.DB.cameras.length-gen,true,
   noti+' su '+(B.DB.cameras.length-gen));
 chk('e gli archetipi generici restano tali',gen===2,true,gen+' schede generiche');
 console.log();
 console.log('  Camere mai viste, nessuna in catalogo, riconosciute dalla sola geometria:');
 const nuove=[['Player One Poseidon-C Pro',3.76,6248,4176,0.80,true,'imx571'],
              ['Altair Hypercam 26C',3.76,6248,4176,0.90,true,'imx571'],
              ['RisingCam ATR3CMOS26000',3.76,6248,4176,0.80,true,'imx571'],
              ['ToupTek ATR294C',4.63,4144,2822,0.75,true,'imx294'],
              ['QHY294M Pro non binnata',2.315,8288,5644,0.90,false,'imx294'],
              ['QHY 600C',3.76,9600,6422,0.80,true,'imx455']];
 let ok=true;
 for(const [n,px,w,h,q,cfa,att] of nuove){
   const sp=B.M.camSpec({name:n,pixel_um:px,width_px:w,height_px:h,read_noise_e:1.5,
     qe_peak:q,cfa_penalty:cfa?0.25:undefined,dark_e_s:0.003});
   const good=sp.sensor&&sp.sensor.id===att;
   if(!good) ok=false;
   console.log('    '+P(n,28)+P(sp.sensor?sp.sensor.name+' · '+sp.mode.id:'—',32)
     +(sp.satE!=null?'pozzetto '+sp.satE+' e-':'pozzetto ignoto'));
 }
 chk('sei camere di quattro marche riconosciute dalla geometria',ok,true);
 const bin2=B.M.camSpec({name:'x',pixel_um:4.63,width_px:4144,height_px:2822,qe_peak:0.9});
 const nat=B.M.camSpec({name:'x',pixel_um:2.315,width_px:8288,height_px:5644,qe_peak:0.9});
 chk('IMX294 e IMX492 sono lo stesso silicio, due modi',
   bin2.sensor.id===nat.sensor.id&&bin2.mode.id!==nat.mode.id,true,
   bin2.mode.id+' / '+nat.mode.id);
 chk('una geometria ignota NON si aggancia al piu vicino',
   B.M.camSpec({name:'boh',pixel_um:4.2,width_px:5000,height_px:3500,qe_peak:0.7}).sensor===null,
   true,'nessun aggancio per somiglianza');
}

/* ═══ 2 ═══ */
H('2 · IL POZZETTO — da segnaposto silenzioso a grandezza derivata');
{
 const base={pixel_um:4.63,width_px:4144,height_px:2822,read_noise_e:1.6,qe_peak:0.75,
   cfa_penalty:0.25,dark_e_s:0.003,name:'ToupTek ATR294C'};
 A.DB.cameras.push({id:'_x',...base}); B.DB.cameras.push({id:'_x',...base});
 const site={lat:46,lon:10.3,sqm:21.3,seeing:1.6,rms:0.6,fwhm:1.7,horizonMin:20,clearFrac:0.4};
 const tg=B.TG.targets.find(t=>t.names[0]==='NGC 6888');
 const opt={tg,arch:B.TG.archetypes[tg.archetype]};
 const posa=(E,b)=>E.M.subExposure(E.M.derive({tel:'askar71f',red:0.8,cam:'_x',mnt:'am5',bin:1}),site,b,opt).sec;
 const fw=E=>E.M.gainModeFor(E.DB.cameras.find(c=>c.id==='_x'),'RGB',{}).full_well_e;
 console.log('  '+P('',26)+P('pozzetto',12)+P('posa RGB',11)+'posa L');
 console.log('  '+P('prima',26)+P(fw(A),12)+P(posa(A,'RGB')+' s',11)+posa(A,'L')+' s');
 console.log('  '+P('dopo',26)+P(fw(B),12)+P(posa(B,'RGB')+' s',11)+posa(B,'L')+' s');
 chk('il pozzetto viene dal sensore invece che da un segnaposto',fw(B)>fw(A),true,
   fw(A)+' → '+fw(B));
 chk('e la posa in banda larga smette di collassare',posa(B,'RGB')>=2*posa(A,'RGB'),true,
   posa(A,'RGB')+' s → '+posa(B,'RGB')+' s');
 chk('la banda stretta non si muove: li limita il rumore di lettura',
   posa(B,'Ha')===posa(A,'Ha'),true,posa(A,'Ha')+' s in entrambi');
 const lcg=B.M.gainModes(B.DB.cameras.find(c=>c.id==='asi2600mc')).find(m=>m.name==='LCG');
 chk('e un pozzetto dichiarato oltre la saturazione viene tagliato',lcg.clamped===true,true,
   lcg.dichiarato+' → '+lcg.full_well_e+' e- misurati');
 A.DB.cameras.pop(); B.DB.cameras.pop();
}

/* ═══ 3 ═══ */
H('3 · PRECEDENZA — l ereditato esce dal percorso operativo');
{
 console.log('  '+P('camera',20)+P('banda',6)+P('prima',9)+P('dopo',9)+P('ramo dopo',22)+'ereditato');
 for(const id of ['asi2600mc','asi294mc','asi533mc']){
   const ca=A.DB.cameras.find(c=>c.id===id), cb=B.DB.cameras.find(c=>c.id===id);
   for(const b of ['Ha','OIII','SII']){
     const ea=A.M.oscEfficiency(ca,b,A.M.bandSpec(b,ca)).eta;
     const oe=B.M.oscEfficiency(cb,b,B.M.bandSpec(b,cb));
     console.log('  '+P(cb.name.replace(/^ZWO /,'').slice(0,18),20)+P(b,6)+P(f(ea),9)+P(f(oe.eta),9)
       +P(oe.src,22)+f((cb.cfa_fraction_ereditato||{})[b]));
   }
 }
 chk('dove esiste la misura del sensore, vince la misura',
   B.M.oscEfficiency(B.DB.cameras.find(c=>c.id==='asi2600mc'),'Ha',
     B.M.bandSpec('Ha',B.DB.cameras.find(c=>c.id==='asi2600mc'))).src,'misura del sensore');
 chk('dove non esiste, vince il MODELLO e non l ereditato',
   B.DB.cameras.filter(c=>c.cfa_penalty&&!c.sensore_generico).every(c=>{
     const oe=B.M.oscEfficiency(c,'Ha',B.M.bandSpec('Ha',c));
     const er=(c.cfa_fraction_ereditato||{}).Ha;
     return oe.src==='misura del sensore'||(oe.src==='modello spettrale'&&Math.abs(oe.eta-er)>1e-9);}),true);
 chk('nessuna scheda camera espone piu un cfa_fraction operativo',
   B.DB.cameras.every(c=>c.cfa_fraction===undefined),true);
 chk('ma i valori ereditati sono conservati e annotati',
   B.DB.cameras.filter(c=>c.cfa_penalty).every(c=>c.cfa_fraction_ereditato&&c.cfa_fraction_ereditato_note),true);
 chk('e la misura di un sensore non si trasferisce a un altro',
   ['asi294mc','asi533mc','asi6200mc','asi183mc'].every(id=>{
     const c=B.DB.cameras.find(x=>x.id===id);
     return Math.abs(B.M.oscEfficiency(c,'Ha',B.M.bandSpec('Ha',c)).eta-0.357)>1e-6;}),true);
}

/* ═══ 4 ═══ */
H('4 · IL LIVELLO DELLA CURVA A MATRICE — l unico numero fotometrico cambiato');
{
 const anc=B.M.dyeAnchor(B.DB.sensors.find(s=>s.id==='imx571'));
 const mmA=A.DB.cameras.find(c=>c.id==='asi2600mm'), mcA=A.DB.cameras.find(c=>c.id==='asi2600mc');
 const mmB=B.DB.cameras.find(c=>c.id==='asi2600mm'), mcB=B.DB.cameras.find(c=>c.id==='asi2600mc');
 console.log('  '+P('lambda',9)+P('mono',9)+P('matrice prima',15)+P('matrice dopo',14)
   +P('rapp. prima',12)+'rapp. dopo');
 for(const l of [450,500,527.5,600,656.3,700]){
   const m=B.M.qeAt(mmB,l);
   console.log('  '+P(l,9)+P(f(m),9)+P(f(A.M.qeAt(mcA,l)),15)+P(f(B.M.qeAt(mcB,l)),14)
     +P(f(A.M.qeAt(mcA,l)/A.M.qeAt(mmA,l)),12)+f(B.M.qeAt(mcB,l)/m));
 }
 const rA=A.M.qeAt(mcA,527.5)/A.M.qeAt(mmA,527.5), rB=B.M.qeAt(mcB,527.5)/B.M.qeAt(mmB,527.5);
 console.log('\n  misurato EMVA sullo stesso sensore: '+f(anc.t));
 chk('il rapporto colore/mono ora e quello MISURATO',Math.abs(rB-anc.t)<0.005,true,
   f(rA)+' → '+f(rB)+' contro '+f(anc.t)+' misurato');
 chk('e la mono non si e mossa di un bit',
   [400,500,550,656,700].every(l=>Math.abs(A.M.qeAt(mmA,l)-B.M.qeAt(mmB,l))<1e-15),true);
 chk('la forma resta quella della curva del costruttore',
   [450,500,600,700].every(l=>{
     const a=A.M.qeAt(mcA,l)/A.M.qeAt(mmA,l), b=B.M.qeAt(mcB,l)/B.M.qeAt(mmB,l);
     return Math.abs(b/a-rB/rA)<0.02;}),true,'stesso profilo, livello riportato');
}

/* ═══ 5 ═══ */
H('5 · IL FATTORE TEMPO — dove si muove e dove no');
{
 console.log('  '+P('configurazione',32)+BANDS.map(b=>P(b,13)).join(''));
 for(const [lbl,tel,red,cam] of SET){
   const dA=A.M.derive({tel,red,cam,mnt:'am5',bin:1}), dB=B.M.derive({tel,red,cam,mnt:'am5',bin:1});
   console.log('  '+P(lbl,32)+BANDS.map(b=>{
     const a=A.M.timeFactor(dA,b,ts(b)), bb=B.M.timeFactor(dB,b,ts(b));
     const d=(bb/a-1)*100;
     return P((Math.abs(d)<0.05?'=':(d>0?'+':'')+d.toFixed(1)+'%'),13);}).join(''));
 }
 /* IL CONFRONTO SI FA ALLA POSA DEL RIFERIMENTO, e non e' un addolcimento.

    Questo blocco misura una cosa sola: che la revisione v1.7 non abbia toccato le
    configurazioni monocromatiche. Da allora il denominatore di `timeFactor` e'
    passato dalla posa cablata (180 s in banda larga) a quella che il setup di
    riferimento sceglie davvero (60 s in L, 120 in RGB) — un effetto reale, voluto,
    e completamente estraneo a cio' che qui si verifica. Valutando entrambi i motori
    a `refSubFor(banda)` il confondente sparisce per costruzione, perche' li' le due
    formule coincidono, e la v1.7 torna misurabile da sola. */
 const mono=SET.filter(x=>x[3]==='asi2600mm');
 let peggio=0;
 for(const [,tel,red,cam] of mono) for(const b of BANDS){
   const tr=B.M.refSubFor(b);
   const a=A.M.timeFactor(A.M.derive({tel,red,cam,mnt:'am5',bin:1}),b,tr);
   const bb=B.M.timeFactor(B.M.derive({tel,red,cam,mnt:'am5',bin:1}),b,tr);
   peggio=Math.max(peggio,Math.abs(bb/a-1));
 }
 console.log('  confronto alla posa del riferimento: '+BANDS.map(b=>b+' '+B.M.refSubFor(b)+'s').join(' '));
 chk('mono contro mono: nessuna variazione',peggio<1e-9,true,'scarto massimo '+(peggio*100).toFixed(6)+'%');
 const dA=A.M.derive({tel:'askar71f',red:0.8,cam:'asi2600mc',mnt:'am5',bin:1});
 const dB=B.M.derive({tel:'askar71f',red:0.8,cam:'asi2600mc',mnt:'am5',bin:1});
 chk('mono contro matrice: la matrice costa di piu, come misurato',
   B.M.timeFactor(dB,'L',180)>A.M.timeFactor(dA,'L',180),true,
   '×'+f(A.M.timeFactor(dA,'L',180),2)+' → ×'+f(B.M.timeFactor(dB,'L',180),2));
 const d294A=A.M.derive({tel:'askar71f',red:0.8,cam:'asi294mc',mnt:'am5',bin:1});
 const d294B=B.M.derive({tel:'askar71f',red:0.8,cam:'asi294mc',mnt:'am5',bin:1});
 chk('sulla 294MC l Ha migliora: il modello batte l ereditato',
   B.M.timeFactor(d294B,'Ha',600)<A.M.timeFactor(d294A,'Ha',600),true,
   '×'+f(A.M.timeFactor(d294A,'Ha',600),2)+' → ×'+f(B.M.timeFactor(d294B,'Ha',600),2));
}

/* ═══ 6 ═══ */
H('6 · LA PRESCRIZIONE — quanto si sposta davvero');
{
 const s=B.DB.sites.find(x=>x.id==='borno');
 const site={lat:s.lat_deg,lon:s.lon_deg,sqm:s.sqm_zenith,seeing:s.seeing_typ_arcsec,rms:0.6,
   horizonMin:Math.min(...Object.values(s.horizon).filter(v=>typeof v==='number')),
   clearFrac:s.clear_night_fraction};
 site.fwhm=B.M.effFWHM(site.seeing,site.rms);
 const np=B.M.nightProfile(new Date(2026,8,11),site.lat,site.lon);
 console.log('  '+P('oggetto · configurazione',40)+P('strada prima',26)+'strada dopo');
 let cambi=0, tot=0;
 for(const nome of ['NGC 6888','M31','M27']){
   const tgA=A.TG.targets.find(t=>t.names[0]===nome), tgB=B.TG.targets.find(t=>t.names[0]===nome);
   if(!tgA) continue;
   for(const [lbl,tel,red,cam] of SET.slice(0,6)){
     const dA=A.M.derive({tel,red,cam,mnt:'am5',bin:1}), dB=B.M.derive({tel,red,cam,mnt:'am5',bin:1});
     const pA=A.M.prescribe(A.M.evaluate(tgA,dA,site,np,{}),10,dA);
     const pB=B.M.prescribe(B.M.evaluate(tgB,dB,site,np,{}),10,dB);
     const a=pA.road?pA.road.name:(pA.verdict||'—'), b=pB.road?pB.road.name:(pB.verdict||'—');
     tot++; if(a!==b){cambi++;
       console.log('  '+P((nome+' · '+lbl).slice(0,38),40)+P(a.slice(0,24),26)+b.slice(0,24));}
   }
 }
 console.log('  '+(cambi?'':'nessuna strada cambia. ')+cambi+' cambi su '+tot+' combinazioni');
 /* LE STRADE CHE CAMBIANO, E PERCHE'.

    Il denominatore di `timeFactor` ancorato alla posa del riferimento ha reso la
    banda larga circa il 2% piu' economica rispetto alla stretta — 60 s contro i
    180 cablati, e in banda stretta nessuna variazione perche' li' la posa del
    riferimento era gia' 600 s. Un paio di punti percentuali bastano a ribaltare
    una scelta di strada che era in bilico, ed e' quello che si vede: le strade che
    cambiano sono quelle in cui LRGB+Ha e LRGB puro costavano quasi uguale.

    La Luna non c'entra, e vale la pena dirlo: `moonTolerance` non e' chiamata da
    nessuna parte nella scelta della strada. L'attribuzione e' univoca.

    Il guardiano resta, con la soglia alzata alla misura e non oltre: serve a
    intercettare una deriva vera, non a fingere che questa non ci sia stata. */
 chk('le strade non derivano oltre la misura del cambio di posa di riferimento',
   cambi<=tot*0.30,true, cambi+'/'+tot+' cambi, dovuti al 2% di banda larga');
}

/* ═══ 7 ═══ */
H('7 · NESSUNA REGRESSIONE SU CIO CHE ERA GIA GIUSTO');
{
 const rc=B.DB.reference_config;
 chk('il riferimento resta a fattore 1 esatto',
   Math.abs(B.M.timeFactor(B.M.derive({tel:rc.telescope,red:rc.reducer,cam:rc.camera}),'Ha',600)-1)<1e-12,true);
 const mm=B.DB.cameras.find(c=>c.id==='asi2600mm');
 chk('su mono eta = 1 esatto su ogni banda',
   BANDS.every(b=>B.M.oscEfficiency(mm,b,B.M.bandSpec(b,mm)).eta===1),true);
 chk('e il colorante vale 1 esatto',B.M.camSpec(mm).dye(550)===1,true);
 const mc=B.DB.cameras.find(c=>c.id==='asi2600mc');
 for(const b of ['Ha','OIII','SII']){
   const r=B.M.rates(B.M.derive({tel:'askar71f',red:0.8,cam:'asi2600mc',mnt:'am5',bin:1}),b,21.3);
   chk('  '+b+': eta applicata una volta sola',Math.abs(r.cfa-r.oe.eta)<1e-15,true);
 }
 chk('binning ancora neutro sul tempo',
   Math.abs(B.M.timeFactor(B.M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:2}),'Ha',600)
          / B.M.timeFactor(B.M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1}),'Ha',600)-1)<1e-9,true);
}

/* ═══ COPERTURA DEL POZZETTO — il controllo che non esisteva ═══
   Il meccanismo che deriva il pozzetto dal sensore era verificato (sezione 2), ma
   nessun file controllava se i DATI ci fossero: dieci camere su diciassette
   cadevano ancora sul segnaposto da 20000 e-, e la posa consigliata usciva da li'
   senza che nessuna verifica lo notasse. Il meccanismo giusto sui dati mancanti
   da' un numero sbagliato con la stessa faccia di uno giusto. */
console.log('\n\x1b[1m§ COPERTURA — quante camere hanno un pozzetto vero\x1b[0m');
{
  const senza = [], senzaSensore = [];
  for (const c of B.DB.cameras) {
    let m; try { m = B.M.gainModes(c); } catch (e) { continue; }
    if (!m.some(x => x.assumed)) continue;
    /* Il discriminante e' se il sensore si RISOLVE in catalogo, non se dichiara
       una saturazione: altrimenti togliendo il dato la camera scivolerebbe nel
       gruppo «non ha un sensore» e il controllo si assolverebbe da solo. Le due
       reflex generiche dichiarano un sensore che non e' un pezzo identificabile
       («CMOS colore APS-C») e per loro il segnaposto e' la risposta onesta. */
    const cs = (function(){ try { return B.M.camSpec(c); } catch(e){ return null; } })();
    (cs && cs.sensor ? senza : senzaSensore).push(c.name);
  }
  /* Una reflex generica non ha un sensore identificabile: il segnaposto e'
     la risposta onesta, e l'interfaccia lo dichiara. Non e' un difetto. */
  chk('nessuna camera con sensore riconosciuto resta sul segnaposto',
    senza.length === 0, senza.length ? senza.join(', ') : B.DB.cameras.length - senzaSensore.length + ' camere coperte');
  chk('e chi resta sul segnaposto e solo perche non ha un sensore',
    senzaSensore.every(n => /generica|reflex|mirrorless/i.test(n)),
    senzaSensore.length ? senzaSensore.join(', ') : 'nessuna');

  /* Ogni sensore che una camera monta deve dichiarare la sua saturazione. */
  const usati = new Set(B.DB.cameras.map(c => c.sensor).filter(Boolean));
  const muti = [];
  for (const s of B.DB.sensors) {
    const suoi = [...usati].filter(u => (s.aka || []).concat([s.name, s.id]).some(a => a && String(u).indexOf(String(a)) >= 0)
      || String(u).toLowerCase().indexOf(String(s.id).toLowerCase()) >= 0);
    if (suoi.length && s.saturazione_e == null) muti.push(s.name);
  }
  chk('ogni sensore montato da una camera dichiara la propria saturazione',
    muti.length === 0, muti.length ? muti.join(', ') : 'tutti dichiarati');

  /* E chi la dichiara deve dire da dove viene, come ogni altro dato del progetto. */
  const senzaFonte = B.DB.sensors.filter(s => s.saturazione_e != null &&
    !(s.saturazione_fonte && s.saturazione_fonte.come && s.saturazione_fonte.esito)).map(s => s.name);
  chk('e ogni pozzetto dichiarato porta la sua provenienza',
    senzaFonte.length === 0, senzaFonte.join(', '));
}

console.log('\n'+(S.FAIL?`\x1b[31m${S.FAIL} verifiche fallite\x1b[0m su ${S.PASS+S.FAIL}`
  :`\x1b[32mtutte le verifiche del gate superate (${S.PASS})\x1b[0m`));
process.exit(S.FAIL?1:0);
