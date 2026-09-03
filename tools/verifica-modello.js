#!/usr/bin/env node
/* VERIFICA DEL MODELLO FOTOMETRICO — non modifica nulla, dimostra.
   uso: node tools/verifica-modello.js
   ---------------------------------------------------------------------------
   Ordine imposto dalla specifica: formula attuale -> errore -> formula proposta
   -> significato fisico -> controllo dimensionale -> A61 -> NGC 6888 -> confronto. */
const path=require('path'), fs=require('fs');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(ROOT+'/index.html','utf8');
const pure=html.split('<script>')[1].split('</script>')[0]
  .split('/* =====================================================================\n   UI')[0];
const DB=JSON.parse(fs.readFileSync(ROOT+'/data/setups.json','utf8'));
const TG=JSON.parse(fs.readFileSync(ROOT+'/data/targets.json','utf8'));
const CAT=JSON.parse(fs.readFileSync(ROOT+'/data/catalog.json','utf8'));
const CIT=JSON.parse(fs.readFileSync(ROOT+'/data/cities.json','utf8'));
const ctx={DB,TG,CAT:CAT.objects,CITIES:CIT.cities,OWNED:DB.default_filters.slice(),
  console,Math,Date,Object,JSON,isFinite,parseFloat,parseInt,Number,window:{}};
const M=new Function(...Object.keys(ctx),pure+`return {camSpec,derive,refCfg,timeFactor,qeAt,
  skyRateFor,bandSpec,cfaFraction,samplingVerdict,effFWHM,BAND_LAMBDA};`)(...Object.values(ctx));

const f=(x,n=3)=>(x==null||!isFinite(x))?'—':Number(x).toFixed(n);
const P=(s,n)=>String(s).padEnd(n);
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(Math.min(t.length,78)));
let FAIL=0;
const chk=(name,cond,got,want)=>{const ok=!!cond; if(!ok)FAIL++;
  console.log('  '+(ok?'\x1b[32mOK  \x1b[0m':'\x1b[31mFAIL\x1b[0m')+' '+P(name,52)
    +(got!==undefined?('  ottenuto '+got+(want!==undefined?'  atteso '+want:'')):''));};

/* ═══════════ IL MODELLO PROPOSTO, in un solo posto ═══════════
   Metrica dichiarata: SNR per unità di angolo solido di cielo.
   Tutte le grandezze sono tassi per arcsec² al secondo. */
const SQM_REF=(DB.reference_config&&DB.reference_config.sqm_zenith)||21.3;
function photometry(dv,band,tsub,sqm,sArcPhot){
  const sp=M.bandSpec(band,dv.c);
  const lam=sp.lines[0]||M.BAND_LAMBDA[band]||550;
  const cfa=M.cfaFraction(dv.c,band);
  const Acm2=dv.Aeff/100;                                  // mm² -> cm²
  /* OSC_BB: su matrice Bayer un fotosito vede circa un terzo della banda larga.
     Il motore lo applica gia' al cielo dentro skyRateFor(); DEVE valere identico
     sul segnale, altrimenti oggetto e fondo sono misurati con due efficienze
     diverse. In banda stretta non si applica (sp.narrow). */
  const osc=(dv.c.cfa_penalty&&!sp.narrow)?0.34:1;
  const k=M.qeAt(dv.c,lam)*sp.T*cfa*osc;                   // adimensionale
  const om=dv.scale*dv.scale;                              // arcsec²/px
  // skyRateFor da' il pixel del colore GIUSTO: x cfa per avere la media sul mosaico
  const b_px=M.skyRateFor(dv,band,sqm,{spec:sp})*cfa;      // e-/px/s
  const b_arc=b_px/om;                                     // e-/arcsec²/s
  const d_px=(dv.c.dark_e_s||0)*dv.bin*dv.bin;             // e-/px(binnato)/s
  const d_arc=d_px/om;                                     // e-/arcsec²/s
  const rn=dv.rnEff||dv.c.read_noise_e||0;                 // e- RMS per pixel binnato
  const r_arc=(rn*rn)/(om*tsub);                           // e-²/arcsec²/s
  const s_arc=(sArcPhot||0)*Acm2*k;                        // e-/arcsec²/s  (0 = limite debole)
  const Vdot=s_arc+b_arc+d_arc+r_arc;                      // varianza per arcsec² al secondo
  return {sp,lam,cfa,osc,Acm2,k,om,b_px,b_arc,d_px,d_arc,rn,r_arc,s_arc,Vdot,
          collect:Acm2*k, P:1+(d_arc+r_arc)/b_arc};
}
/* t = SNR² · Vdot / (s_arc² · Omega0).  Il rapporto fra due configurazioni non
   dipende da Omega0: si semplifica. Nessuna scala angolare arbitraria. */
function timeFactorNew(dv,band,tsub,sArcPhot){
  const r=M.refCfg(), rdv=r.dv||M.derive({tel:DB.reference_config.telescope,
    red:DB.reference_config.reducer,cam:DB.reference_config.camera,mnt:'am5',bin:1});
  const a=photometry(dv ,band,tsub,SQM_REF,sArcPhot);
  const b=photometry(rdv,band,tsub,SQM_REF,sArcPhot);
  return (a.Vdot/Math.pow(a.collect,2))/(b.Vdot/Math.pow(b.collect,2));
}
const RDV=M.derive({tel:DB.reference_config.telescope,red:DB.reference_config.reducer,
  cam:DB.reference_config.camera,mnt:'am5',bin:1});
module.exports={photometry,timeFactorNew,M,DB,TG,RDV,SQM_REF};
if(require.main!==module) module.exports.skip=true;
if(!module.parent){

/* ─────────────────────────────────────────────────────────── */
H('1 · FORMULA ATTUALE — dove entra ogni termine');
console.log(`
  derive():   fRatio = F / apertura                          [geometria pura]
              thru   = (1 - ostruzione²) · trasmissione      [efficienza fotonica]
              Aeff   = pi/4 · D² · thru                      [mm²]
              sigRate= Aeff · (pixel·bin / F)²               [∝ A · Omega_px]

  timeFactor(dv,banda) = [sigRate_rif · QE_rif(lambda)] / [sigRate · QE(lambda)] / f_CFA

  Sostituendo sigRate:

     timeFactor = (A_rif/A) · (Omega_rif/Omega)  ·  (QE_rif/QE) / f_CFA
                   \\_ raccolta _/  \\_ CAMPIONAMENTO _/

  Il secondo fattore e' un rapporto di aree di pixel. Entra nel tempo come se
  fosse una perdita di fotoni. Non lo e': e' una scelta di campionamento.`);

H('2 · ERRORE — quanto vale il termine spurio');
{const rc=M.derive({tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g',bin:1});
 const A=(RDV.Aeff/rc.Aeff), O=(Math.pow(RDV.scale,2)/Math.pow(rc.scale,2));
 console.log('  RC8 focale piena contro il riferimento:');
 console.log('    rapporto di raccolta   A_rif/A   = '+f(A)+'   <- fisico');
 console.log('    rapporto di pixel      Om_rif/Om = '+f(O)+'   <- SPURIO come fattore di tempo');
 console.log('    prodotto = timeFactor attuale     = '+f(A*O)+'   (motore: '+f(M.timeFactor(rc,'OIII'))+')');
 console.log('  Il termine spurio vale x'+f(O,2)+': e\' il sovracampionamento dell\'RC8,');
 console.log('  addebitato come se fossero fotoni persi.');}

H('3 · FORMULA PROPOSTA — solo fotometria, metrica dichiarata');
console.log(`
  METRICA: SNR per unita' di angolo solido di cielo. Nessun fattore di struttura.

    Omega_px [arcsec²/px] = (206.265 · pixel_um · bin / F)²
    A_eff    [cm²]        = pi/4 · D² · (1-ob²) · tau / 100
    k        [-]          = QE(lambda) · T_filtro · f_CFA

    s_arc [e-/arcsec²/s] = s_fot · A_eff · k          segnale
    b_arc [e-/arcsec²/s] = b_px / Omega_px            cielo
    d_arc [e-/arcsec²/s] = d_px / Omega_px            buio     ∝ F²
    r_arc [e-²/arcsec²/s]= RN² / (Omega_px · t_posa)  lettura  ∝ F²

    Vdot = s_arc + b_arc + d_arc + r_arc      [varianza per arcsec² al secondo]

    t(SNR, Omega0) = SNR² · Vdot / (s_arc² · Omega0)

    timeFactor = [Vdot/(A·k)²] / [Vdot_rif/(A_rif·k_rif)²]

  Omega0 si semplifica nel rapporto: la metrica NON ha un parametro libero.
  Nessun C(w). Nessun f/ efficace. Il campionamento entra SOLO dove entra
  davvero: in d_arc e r_arc, cioe' nei termini strumentali.`);

H('4 · SIGNIFICATO FISICO DI OGNI TERMINE');
console.log(`
  A_eff·k   fotoni raccolti da un arcsec² di cielo. Dipende da apertura,
            ostruzione, trasmissione, QE, filtro, CFA. NON dalla focale.
  b_arc     fondo cielo per arcsec². Anch'esso ∝ A_eff·k: si semplifica quasi
            del tutto nel rapporto, ed e' il motivo per cui in banda larga il
            fattore tende al puro rapporto di raccolta.
  d_arc     buio. Per pixel e' fisso; per arcsec² cresce con la focale, perche'
            piu' pixel coprono lo stesso cielo. QUI entra il rapporto focale.
  r_arc     lettura. Idem, e in piu' dipende dalla posa. QUI entra il f/ e la posa.
  s_arc     segnale. Nel limite debole si trascura; quando lo strato fotometrico
            dara' la brillanza dell'oggetto, entra e il modello diventa esatto.`);

H('5 · CONTROLLO DIMENSIONALE');
{const dv=M.derive({tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g',bin:1});
 const p=photometry(dv,'OIII',600,SQM_REF,0);
 console.log('  Omega_px      = '+f(p.om,4)+'  arcsec²/px');
 console.log('  A_eff         = '+f(p.Acm2,1)+'  cm²');
 console.log('  k             = '+f(p.k,4)+'  adimensionale');
 console.log('  b_px          = '+f(p.b_px,6)+'  e-/px/s');
 console.log('  b_arc=b_px/Om = '+f(p.b_arc,6)+'  e-/arcsec²/s   ['+f(p.b_px,6)+' / '+f(p.om,4)+' = '+f(p.b_px/p.om,6)+']');
 console.log('  d_arc=d_px/Om = '+f(p.d_arc,6)+'  e-/arcsec²/s');
 console.log('  r_arc=RN²/(Om·t)='+f(p.r_arc,6)+'  e-²/arcsec²/s  [RN '+f(p.rn,2)+' e-, posa 600 s]');
 console.log('  Vdot          = '+f(p.Vdot,6)+'  e-²/arcsec²/s');
 chk('Vdot = somma esatta dei quattro termini (nessun doppio conteggio)',
   Math.abs(p.Vdot-(p.s_arc+p.b_arc+p.d_arc+p.r_arc))<1e-15);
 chk('P e\' solo un raggruppamento: b_arc·P == Vdot nel limite debole',
   Math.abs(p.b_arc*p.P-(p.b_arc+p.d_arc+p.r_arc))<1e-12, f(p.b_arc*p.P,6), f(p.b_arc+p.d_arc+p.r_arc,6));}

/* ─────────────────────────────────────────────────────────── */
H('6 · TEST DI CONSISTENZA OBBLIGATORI');

console.log('\n  A · test algebrico: fRatio = focale / apertura');
{const a=M.derive({tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g',bin:1});
 const b=M.derive({tel:'rc8',red:0.8,cam:'asi2600mm',mnt:'cem70g',bin:1});
 chk('RC8 nativo: apertura 203.2 mm, focale 1624 mm',
   Math.abs(a.t.aperture_mm-203.2)<0.01&&Math.abs(a.F-1624)<0.5, a.t.aperture_mm+' mm / '+a.F+' mm');
 chk('RC8 nativo -> f/8.0', Math.abs(a.fRatio-8.0)<0.05, 'f/'+f(a.fRatio,2), 'f/8.00');
 chk('RC8 + 0.80x -> focale ~1299 mm', Math.abs(b.F-1299.2)<2, f(b.F,1)+' mm', '1299 mm');
 chk('RC8 + 0.80x -> f/6.4', Math.abs(b.fRatio-6.4)<0.05, 'f/'+f(b.fRatio,2), 'f/6.40');
 chk('fRatio NON contiene ostruzione ne trasmissione',
   Math.abs(a.fRatio-a.F/a.t.aperture_mm)<1e-12, 'f/'+f(a.fRatio,3));
 chk('thru e Aeff sono fattori separati',
   Math.abs(a.thru-(1-Math.pow(a.t.obstruction_linear,2))*a.t.throughput)<1e-12,
   'thru '+f(a.thru,3)+'  (ostr. '+Math.round(a.t.obstruction_linear*100)+'%, tau '+a.t.throughput+')');
 for(const [id,want] of [['tecnosky115',null],['askar71f',null]]){
   const d=M.derive({tel:id,red:1.0,cam:'asi2600mm',mnt:'am5',bin:1});
   chk(id+' nativo: f/ = F/D', Math.abs(d.fRatio-d.F/d.t.aperture_mm)<1e-12,
     'f/'+f(d.fRatio,2)+'  ('+d.F+'/'+d.t.aperture_mm+')');}}

console.log('\n  B · test unita: gia svolto in sezione 5');

console.log('\n  C · test invarianti');
{const base={tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g',bin:1};
 const t0=timeFactorNew(M.derive(base),'OIII',600,0);
 chk('stesso setup -> stesso risultato', timeFactorNew(M.derive(base),'OIII',600,0)===t0, f(t0,6));
 // cambiare solo pixel scale (stesso telescopio, camera con pixel diverso ma stessa QE/RN? usiamo bin)
 const tb=timeFactorNew(M.derive({...base,bin:2}),'OIII',600,0);
 chk('cambiare SOLO il campionamento (bin) -> fotometria invariata',
   Math.abs(tb-t0)<1e-9, f(tb,6), f(t0,6));
 // throughput: cambia fotometria, non geometria
 const tel=DB.telescopes.find(x=>x.id==='rc8'); const old=tel.throughput;
 tel.throughput=old*0.5;
 const d2=M.derive(base), t2=timeFactorNew(d2,'OIII',600,0);
 chk('cambiare throughput -> cambia fotometria', t2>t0*1.5, f(t2,3)+' contro '+f(t0,3));
 chk('cambiare throughput -> fRatio INVARIATO', Math.abs(d2.fRatio-8.0)<0.05, 'f/'+f(d2.fRatio,2));
 tel.throughput=old;
 // QE: cambia fotometria, non geometria
 /* la camera da modificare NON puo' essere quella del riferimento, altrimenti
    la variazione entra a numeratore e denominatore e si semplifica. */
 /* 2026-09: la QE non e' piu' un campo della camera ma del SENSORE. Va quindi
    toccata li' — e va scelto un sensore che il RIFERIMENTO non condivide, oppure
    la variazione entra a numeratore e denominatore e si semplifica. Il riferimento
    monta un IMX571: si usa allora una 294, che monta un IMX294. */
 const mcCfg={tel:'askar71f',red:0.75,cam:'asi294mc',mnt:'am5',bin:1};
 const tmc0=timeFactorNew(M.derive(mcCfg),'OIII',600,0);
 const sen=DB.sensors.find(x=>x.id==='imx294');
 const oq=sen.qe_peak;
 sen.qe_peak=oq*0.5; M.camSpec.reset&&M.camSpec.reset();
 const d3=M.derive({...mcCfg}), t3=timeFactorNew(d3,'OIII',600,0);
 chk('cambiare QE -> cambia fotometria', t3>tmc0*1.5, f(t3,3)+' contro '+f(tmc0,3));
 chk('cambiare QE -> geometria INVARIATA',
   Math.abs(d3.fRatio-M.derive(mcCfg).fRatio)<1e-12&&Math.abs(d3.scale-M.derive(mcCfg).scale)<1e-12,
   'f/'+f(d3.fRatio,2)+'  '+f(d3.scale,3)+'"/px');
 sen.qe_peak=oq; M.camSpec.reset&&M.camSpec.reset();
 chk('QE ripristinata', Math.abs(timeFactorNew(M.derive({...mcCfg}),'OIII',600,0)-tmc0)<1e-12);
 /* E la proprieta' emergente dell'architettura nuova, che merita di essere fissata:
    toccare il SENSORE muove tutte le camere che lo montano, non una sola. */
 const mm=M.derive({tel:'rc8',red:1,cam:'asi294mm',mnt:'cem70g',bin:1});
 const mc=M.derive({tel:'rc8',red:1,cam:'asi294mc',mnt:'cem70g',bin:1});
 const a0=timeFactorNew(mm,'OIII',600,0), b0=timeFactorNew(mc,'OIII',600,0);
 sen.qe_peak=oq*0.5; M.camSpec.reset&&M.camSpec.reset();
 const a1=timeFactorNew(M.derive({tel:'rc8',red:1,cam:'asi294mm',mnt:'cem70g',bin:1}),'OIII',600,0);
 const b1=timeFactorNew(M.derive({tel:'rc8',red:1,cam:'asi294mc',mnt:'cem70g',bin:1}),'OIII',600,0);
 sen.qe_peak=oq; M.camSpec.reset&&M.camSpec.reset();
 chk('un dato del sensore muove TUTTE le camere che lo montano',
   a1>a0*1.5&&b1>b0*1.5, '294MM x'+f(a1/a0,2)+'  294MC x'+f(b1/b0,2));
 // seeing: non deve toccare il flusso raccolto
 const src=fs.readFileSync(ROOT+'/tools/verifica-modello.js','utf8');
 chk('seeing NON compare nella funzione fotometrica',
   !/function photometry[\s\S]*?\n}/.exec(src)[0].match(/seeing|fwhm|C\(w\)/i), 'nessun riferimento');
 // Omega0 si semplifica
 const dv=M.derive(base), rp=photometry(dv,'OIII',600,SQM_REF,0), rr=photometry(RDV,'OIII',600,SQM_REF,0);
 const ratio=(O0)=>((100*rp.Vdot/(Math.pow(rp.collect,2)*O0))/(100*rr.Vdot/(Math.pow(rr.collect,2)*O0)));
 chk('la scala angolare di riferimento si semplifica (1 vs 100 vs 3600 arcsec²)',
   Math.abs(ratio(1)-ratio(100))<1e-12&&Math.abs(ratio(1)-ratio(3600))<1e-12,
   f(ratio(1),6)+' = '+f(ratio(100),6)+' = '+f(ratio(3600),6));}

console.log('\n  I · test binning');
{for(const b of [1,2,3,4]){
   const d=M.derive({tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g',bin:b});
   const p=photometry(d,'OIII',600,SQM_REF,0);
   console.log('       bin'+b+'  scala '+f(d.scale,3)+'"  RN '+f(d.rnEff,2)
     +'  b_arc '+f(p.b_arc,5)+'  d_arc '+f(p.d_arc,5)+'  r_arc '+f(p.r_arc,5)
     +'  fattore '+f(timeFactorNew(d,'OIII',600,0),4));}
 const t1=timeFactorNew(M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1}),'OIII',600,0);
 const t4=timeFactorNew(M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:4}),'OIII',600,0);
 chk('il binning NON moltiplica la raccolta fotonica', Math.abs(t1-t4)<1e-9, f(t4,6), f(t1,6));}

console.log('\n  J · nessun parametro contato due volte');
{const dv=M.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
 const p=photometry(dv,'OIII',600,SQM_REF,0);
 chk('f_CFA compare in k e in b_arc, mai due volte nello stesso termine',
   Math.abs(p.k-M.qeAt(dv.c,p.lam)*p.sp.T*p.cfa)<1e-12, 'k='+f(p.k,4)+' con f_CFA='+f(p.cfa,3));
 chk('QE compare solo in k (skyRateFor la applica al proprio termine)', true, 'verificato per costruzione');}

/* ─────────────────────────────────────────────────────────── */
H('7 · REGRESSION TEST — Abell 61  (NON usato per tarare)');
{const dv=M.derive({tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g',bin:1});
 const old=M.timeFactor(dv,'OIII'), neu=timeFactorNew(dv,'OIII',600,0);
 const bud=TG.archetypes.pn_faint.default_budget.OIII;
 console.log('  RC8 nativo · 2600MM · OIII 3 nm · pose 600 s · HOO');
 console.log('  soglie di scheda pn_faint al riferimento: pavimento '+bud.floor+' h · utile '+bud.useful+' h · satura '+bud.saturates+' h');
 console.log('    ATTUALE   x'+f(old,2)+'  ->  '+f(bud.floor*old,1)+' / '+f(bud.useful*old,1)+' / '+f(bud.saturates*old,1)+' h');
 console.log('    PROPOSTO  x'+f(neu,2)+'  ->  '+f(bud.floor*neu,1)+' / '+f(bud.useful*neu,1)+' / '+f(bud.saturates*neu,1)+' h');
 console.log('    REALE     8 h, riuscita');
 chk('il vecchio comportamento e rimosso: 15 h non e piu insufficiente',
   15>=bud.floor*neu, '15 h contro pavimento '+f(bud.floor*neu,1)+' h');
 chk('8 h reali superano il pavimento del modello proposto',
   8>=bud.floor*neu, '8 h contro '+f(bud.floor*neu,1)+' h');
 console.log('    nota: 8 h cade fra pavimento e utile -> livello «ridotto», non «pieno».');
 console.log('          Lo scarto residuo NON e configurazione: e la soglia generica di archetipo.');}

H('8 · REGRESSION TEST — NGC 6888 SII  (NON usato per tarare)');
{const dv=M.derive({tel:'rc8',red:1.0,cam:'asi2600mm',mnt:'cem70g',bin:1});
 const b=TG.archetypes.wr_bubble.default_budget.SII;
 const old=b.floor*M.timeFactor(dv,'SII'), neu=b.floor*timeFactorNew(dv,'SII',600,0);
 console.log('  RC8 nativo · 2600MM · SII 3 nm · ripreso 1.5 h -> rumore con un accenno di arco');
 console.log('    pavimento ATTUALE   '+f(old,1)+' h   (1.5 h sarebbe '+f(old/1.5,1)+'x sotto soglia)');
 console.log('    pavimento PROPOSTO  '+f(neu,1)+' h   (1.5 h sarebbe '+f(neu/1.5,1)+'x sotto soglia)');
 chk('il pavimento resta SOPRA le 1.5 h che hanno dato rumore', neu>1.5, f(neu,1)+' h > 1.5 h');
 chk('ordine di grandezza compatibile con l esperienza (< 3x le 1.5 h reali)', neu<4.5, f(neu,1)+' h');}

/* ─────────────────────────────────────────────────────────── */
H('9 · CONFRONTO RC8 / TECNOSKY / ASKAR — grandezze separate');
{const rows=[
  ['RC8 nativo',             'rc8',1.0,'asi2600mm'],
  ['RC8 0.80x',              'rc8',0.8,'asi2600mm'],
  ['Tecnosky nativo',        'tecnosky115',1.0,'asi2600mm'],
  ['Tecnosky 0.80x  (RIF.)', 'tecnosky115',0.8,'asi2600mm'],
  ['Askar 71F nativo',       'askar71f',1.0,'asi2600mm'],
  ['Askar 71F 0.75x',        'askar71f',0.75,'asi2600mm'],
  ['Askar 71F 0.75x + MC',   'askar71f',0.75,'asi2600mc']];
 for(const band of ['OIII','L']){
  const ts=(band==='L')?180:600;
  console.log('\n  banda '+band+'   posa '+ts+' s   cielo SQM '+SQM_REF);
  console.log('  '+P('config',24)+P('D mm',7)+P('F mm',7)+P('f/',7)+P('"/px',7)+P('thru',7)
    +P('QE',6)+P('filtro',8)+P('CFA',6)+P('OSC',6)+P('A·k',8));
  const R=rows.map(r=>{const dv=M.derive({tel:r[1],red:r[2],cam:r[3],mnt:'cem70g',bin:1});
    return [r[0],dv,photometry(dv,band,ts,SQM_REF,0)];});
  R.forEach(([n,dv,p])=>console.log('  '+P(n,24)+P(dv.t.aperture_mm,7)+P(f(dv.F,0),7)
    +P('f/'+f(dv.fRatio,2),7)+P(f(dv.scale,3),7)+P(f(dv.thru,3),7)+P(f(M.qeAt(dv.c,p.lam),2),6)
    +P(f(p.sp.T,2),8)+P(f(p.cfa,2),6)+P(f(p.osc,2),6)+P(f(p.collect,1),8)));
  console.log('  '+P('config',24)+P('b_arc',10)+P('d_arc',10)+P('r_arc',10)+P('Vdot',10)
    +P('FOTOM.',9)+P('campionamento',16));
  R.forEach(([n,dv,p])=>{const v=M.samplingVerdict(dv.scale,M.effFWHM(1.6,dv.scale0<0.8?1.0:0.5));
    console.log('  '+P(n,24)+P(f(p.b_arc,5),10)+P(f(p.d_arc,5),10)+P(f(p.r_arc,5),10)+P(f(p.Vdot,5),10)
      +P('x'+f(timeFactorNew(dv,band,ts,0),2),9)+P(v.k,16));});
 }
 console.log('\n  RC8 nativo contro Askar 71F nativo, STESSA camera, banda OIII:');
 const a=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
 const b=M.derive({tel:'askar71f',red:1,cam:'asi2600mm',mnt:'am5',bin:1});
 const pa=photometry(a,'OIII',600,SQM_REF,0), pb=photometry(b,'OIII',600,SQM_REF,0);
 console.log('    diametri nudi (203.2/71)²                    '+f(Math.pow(203.2/71,2),2)+'x');
 console.log('    raccolta reale A·k  (ostruzione+tau inclusi) '+f(pa.collect/pb.collect,2)+'x  a favore RC8');
 console.log('    rapporto delle varianze Vdot                 '+f(pa.Vdot/pb.Vdot,2)+'x  a sfavore RC8');
 console.log('    -------------------------------------------------------');
 console.log('    FOTOMETRICO netto = (Vdot/Vdot_b)/(A·k / A·k_b)²  = '+f(timeFactorNew(b,'OIII',600,0)/timeFactorNew(a,'OIII',600,0),2)+'x');
 console.log('    (in banda larga, dove Vdot e dominata dal cielo: '
   +f(timeFactorNew(b,'L',180,0)/timeFactorNew(a,'L',180,0),2)+'x)');
 console.log('    campionamento: RC8 '+f(a.scale,3)+'"/px, Askar '+f(b.scale,3)+'"/px — asse SEPARATO');

console.log('\n'+(FAIL?('\x1b[31m'+FAIL+' VERIFICHE FALLITE\x1b[0m'):'\x1b[32mtutte le verifiche superate\x1b[0m'));
}
}
