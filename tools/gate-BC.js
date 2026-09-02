const G=require('./gate-fisico.js');
const {M,DB,rates,Vdot,timeFactor,D,RD,SQM_REF,f,P,H,chk,S}=G;

H('B · TEST SKY-LIMITED — il vantaggio del f/ deve svanire');
console.log('  RC8 f/8.0 contro RC8 f/6.4. Stessa apertura, camera, filtro, gain, posa (600 s).');
console.log('  L\'unica differenza e il rapporto focale. Fattore calcolato allo STESSO cielo.\n');
console.log('  '+P('SQM',7)+P('regime',30)+P('f/8.0',10)+P('f/6.4',10)+P('vantaggio f/6.4',16));
const rows=[];
for(const sqm of [22.0,21.3,20.5,20.0,19.0,18.0,16.0,14.0,12.0]){
  const a=rates(D('rc8',1,'asi2600mm'),'OIII',sqm), b=rates(D('rc8',0.8,'asi2600mm'),'OIII',sqm), r=rates(RD(),'OIII',sqm);
  const tf=x=>(Vdot(x,600,0)/Math.pow(x.collect,2))/(Vdot(r,600,0)/Math.pow(r.collect,2));
  const ta=tf(a), tb=tf(b), gain=1-tb/ta;
  const strum=(a.R_d/a.om+a.RN*a.RN/(a.om*600))/(a.R_b/a.om);
  rows.push([sqm,strum,ta,tb,gain]);
  console.log('  '+P(sqm.toFixed(1),7)
    +P(strum>1?'lettura+buio dominano ('+f(100*strum,0)+'%)':strum>0.1?'misto ('+f(100*strum,0)+'%)':'CIELO dominante ('+f(100*strum,1)+'%)',30)
    +P('×'+f(ta,3),10)+P('×'+f(tb,3),10)+P(f(100*gain,2)+'%',16));
}
chk('il vantaggio del f/ tende a zero in regime sky-limited', rows[rows.length-1][4]<0.01,
  f(100*rows[1][4],1)+'% a SQM 21.3  ->  '+f(100*rows[rows.length-1][4],3)+'% a SQM 12');
chk('a cielo dominante f/8 e f/6.4 convergono',
  Math.abs(rows[rows.length-1][2]-rows[rows.length-1][3])<0.005,
  'f/8 ×'+f(rows[rows.length-1][2],4)+'  f/6.4 ×'+f(rows[rows.length-1][3],4));
chk('il vantaggio e monotono col cielo', rows.every((x,i)=>i===0||x[4]<=rows[i-1][4]+1e-9));
{const a=rates(D('rc8',1,'asi2600mm'),'OIII',12.0), r=rates(RD(),'OIII',12.0);
 const tf=(Vdot(a,600,0)/Math.pow(a.collect,2))/(Vdot(r,600,0)/Math.pow(r.collect,2));
 chk('a cielo dominante il fattore = solo rapporto di raccolta',
   Math.abs(tf-(r.collect/a.collect))<0.005, '×'+f(tf,4)+' contro (A·k)_rif/(A·k) = ×'+f(r.collect/a.collect,4));}
console.log('\n  => Il -23% NON e una regola del riduttore: e il valore che il modello produce');
console.log('     a SQM 21.3, 600 s, HCG, 3 nm. Cambiando cielo o posa, cambia.');

H('C · APERTURE DIVERSE A PARI f/RATIO — il test di invarianza');
console.log(`
  ATTENZIONE — la formulazione del punto 8 va corretta, e la correzione e' la
  sostanza del test. Due telescopi con LO STESSO f/ e apertura diversa:

    · per PIXEL e per unita' di AREA DEL SENSORE sono equivalenti     (E ∝ 1/f²)
    · per unita' di ANGOLO SOLIDO di cielo NON lo sono: il maggiore
      raccoglie D² volte di piu'                                       (Φ ∝ A)

  Non e' un artefatto del modello: e' l'unica lettura compatibile con le fonti.
  Sheffield PHY217 dice entrambe le meta' nello stesso documento —
  «the amount of light collected is proportional to D²» e «the larger the focal
  ratio, the slower the camera, as the amount of light falling on A GIVEN AREA
  OF THE FOCAL PLANE is smaller». Rubin SMTN-002: C ∝ effArea, nessun termine
  di focale. Columbia/Nayar: E = L·(pi/4)·(d/f)²·cos⁴a, per unita' di area IMMAGINE.

  Quindi il test giusto NON e' "devono risultare equivalenti per arcsec²" —
  sarebbe falso. Il test giusto e': il vantaggio dell'apertura deve essere
  ESATTAMENTE D² (via A·k) e NIENTE DI PIU'. Se il modello aggiungesse un
  termine sopra il rapporto di raccolta, sarebbe passato all'errore opposto.
`);
// telescopi sintetici a pari f/5.0, solo per il test (non entrano in setups.json)
const tel=DB.telescopes;
for(const [id,D_mm] of [['__t100',100],['__t200',200],['__t400',400]])
  tel.push({id,name:id,aperture_mm:D_mm,focal_mm:D_mm*5,obstruction_linear:0,throughput:0.95,
    reducers:[{factor:1,focal_mm:D_mm*5,label:'nativo'}]});
console.log('  cielo SQM 21.3 · OIII 3 nm · posa 600 s · ASI2600MM · ostruzione 0 · tau 0.95\n');
console.log('  '+P('D mm',7)+P('F mm',7)+P('f/',7)+P('"/px',8)+P('e-/px/s ogg',13)
  +P('e-/arcsec²/s',14)+P('A·k',9)+P('fattore',9));
const s_fot=2.36e-5, out=[];
for(const id of ['__t100','__t200','__t400']){
  const dv=D(id,1,'asi2600mm'), r=rates(dv,'OIII',SQM_REF);
  const s_arc=s_fot*r.collect;
  out.push([dv,r,s_arc]);
  console.log('  '+P(dv.t.aperture_mm,7)+P(f(dv.F,0),7)+P('f/'+f(dv.fRatio,2),7)+P(f(dv.scale,3),8)
    +P((s_arc*r.om).toExponential(3),13)+P(s_arc.toExponential(3),14)+P(f(r.collect,2),9)
    +P('×'+f(timeFactor(dv,'OIII',600),3),9));
}
const [A1,A2,A4]=out;
chk('a pari f/ l\'illuminamento PER PIXEL e identico',
  Math.abs(A1[2]*A1[1].om-A2[2]*A2[1].om)<1e-12 && Math.abs(A1[2]*A1[1].om-A4[2]*A4[1].om)<1e-12,
  (A1[2]*A1[1].om).toExponential(4)+' per tutti e tre');
chk('a pari f/ anche il CIELO per pixel e identico',
  Math.abs(A1[1].R_b-A2[1].R_b)<1e-12&&Math.abs(A1[1].R_b-A4[1].R_b)<1e-12, f(A1[1].R_b,6));
chk('per arcsec² il flusso scala come D² (100->200 mm = ×4)',
  Math.abs(A2[2]/A1[2]-4)<0.02, '×'+f(A2[2]/A1[2],3), '×4');
chk('per arcsec² il flusso scala come D² (100->400 mm = ×16)',
  Math.abs(A4[2]/A1[2]-16)<0.05, '×'+f(A4[2]/A1[2],3), '×16');
const t1=timeFactor(A1[0],'OIII',600), t2=timeFactor(A2[0],'OIII',600), t4=timeFactor(A4[0],'OIII',600);
chk('il vantaggio in TEMPO e esattamente il rapporto di raccolta, non di piu',
  Math.abs((t1/t2)/(A2[1].collect/A1[1].collect)-1)<0.02,
  'tempo ×'+f(t1/t2,3)+'   raccolta ×'+f(A2[1].collect/A1[1].collect,3));
chk('nessun termine extra oltre A·k e i termini strumentali',
  Math.abs((t1/t4)/(A4[1].collect/A1[1].collect)-1)<0.05,
  '100 vs 400 mm: tempo ×'+f(t1/t4,3)+'   raccolta ×'+f(A4[1].collect/A1[1].collect,3));
console.log('\n  e la RISOLUZIONE, che e l\'altra faccia e resta su un asse separato:');
console.log('  '+P('D mm',7)+P('"/px',8)+P('campionamento a FWHM 2.2"',28));
for(const [dv] of out) console.log('  '+P(dv.t.aperture_mm,7)+P(f(dv.scale,3),8)+P(M.samplingVerdict(dv.scale,2.2).k,28));
console.log('\n  => A pari f/ il telescopio maggiore NON e "equivalente per arcsec²": e piu');
console.log('     profondo di D² E piu risolvente. Le due cose sono convertibili l\'una');
console.log('     nell\'altra (binnando si torna alla stessa scala e resta il guadagno D),');
console.log('     ma il vantaggio non e "solo risoluzione".');
for(const id of ['__t100','__t200','__t400']) tel.splice(tel.findIndex(t=>t.id===id),1);
module.exports=S;
