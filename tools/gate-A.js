const G=require('./gate-fisico.js');
const {M,DB,rates,Vdot,snrPix,snrArc,timeFactor,D,RD,SQM_REF,f,P,H,chk,S}=G;
H('A · DERIVAZIONE N-POSE — equivalenza formale');
console.log(`
  Forma pubblicata — ESO/Hainaut, STScI WFC3 IHB §9.6, Rubin SMTN-002 —
  per pixel, N pose da t_posa, T = N·t_posa:

      SNR_px = R_s·T / sqrt( (R_s + R_b + R_d)·T  +  N·RN² )
                                                      \\__ pagato per LETTURA

  Sostituendo N = T/t_posa e raccogliendo T:

      SNR_px = R_s·T / sqrt( T·[ R_s + R_b + R_d + RN²/t_posa ] )
                                                     \\__ RN diventa un TASSO

  N non compare piu': entra SOLO attraverso T/t_posa. Nessuna dipendenza
  nascosta dal numero di letture. Il termine di lettura non e' integrato nel
  tempo — e' per questo che appare come RN²/t_posa e non come RN².

  Passaggio a unita' di angolo solido: su Omega0 arcsec² ci sono n = Omega0/Om_px
  pixel. Segnale e cielo sono per arcsec² (R = x_arc·Om_px); buio e lettura sono
  per PIXEL, e vanno divisi per Om_px:

      SNR(Omega0) = sqrt(n)·R_s·T / sqrt(T·[...]) = s_arc·sqrt( Omega0·T / Vdot )

      Vdot = s_arc + b_arc + d_px/Om_px + RN²/(Om_px·t_posa)     [e-²/arcsec²/s]

      t(SNR,Omega0) = SNR²·Vdot/(s_arc²·Omega0)`);
const dv=D('rc8',1,'asi2600mm'), r=rates(dv,'OIII',SQM_REF);
const s_fot=2.36e-5, s_arc=s_fot*r.collect, R_s=s_arc*r.om, tsub=600;
console.log('\n  verifica numerica — RC8 nativo, OIII 3 nm, s_arc = '+f(s_arc,6)+' e-/arcsec²/s\n');
console.log('  '+P('N',5)+P('T (s)',9)+P('SNR_px forma N-pose',23)+P('SNR_px forma a tassi',23)+P('scarto',10));
let ok=true;
for(const N of [1,10,30,50,180]){ const T=N*tsub;
  const a=R_s*T/Math.sqrt((R_s+r.R_b+r.R_d)*T+N*r.RN*r.RN);
  const b=R_s*T/Math.sqrt(T*(R_s+r.R_b+r.R_d+r.RN*r.RN/tsub));
  if(Math.abs(a-b)>1e-12*Math.max(1,a))ok=false;
  console.log('  '+P(N,5)+P(T,9)+P(f(a,9),23)+P(f(b,9),23)+P(Math.abs(a-b).toExponential(1),10));}
chk('le due forme coincidono per ogni N',ok);
const T=30*tsub;
chk('SNR(1 arcsec²): da pixel == da tassi angolari',
  Math.abs(Math.sqrt(1/r.om)*snrPix(R_s,r,T,tsub)-snrArc(s_arc,r,T,tsub,1))<1e-9,
  f(Math.sqrt(1/r.om)*snrPix(R_s,r,T,tsub),6)+' vs '+f(snrArc(s_arc,r,T,tsub,1),6));
console.log('\n  a T costante (18000 s) il numero di pose CONTA, come deve:');
for(const ts of [300,600,900,1800]) console.log('     t_posa '+P(ts+' s',9)+' N='+P(18000/ts,6)
  +' SNR_px = '+f(snrPix(R_s,r,18000,ts),5));
chk('pose piu lunghe -> SNR piu alto a T costante',snrPix(R_s,r,18000,1800)>snrPix(R_s,r,18000,300));
chk('Omega0 si semplifica nel rapporto (1 / 100 / 3600 arcsec²)',
  [100,3600].every(O=>Math.abs(
    (Vdot(rates(dv,'OIII',SQM_REF),600,0)/Math.pow(rates(dv,'OIII',SQM_REF).collect,2)/O)/
    (Vdot(rates(RD(),'OIII',SQM_REF),600,0)/Math.pow(rates(RD(),'OIII',SQM_REF).collect,2)/O)
    -timeFactor(dv,'OIII',600))<1e-12), f(timeFactor(dv,'OIII',600),6));

H('A-bis · IL timeFactor E DI CATEGORIA B — funzione della strategia');
console.log('  Stesso telescopio, stessa camera, stesso cielo, stessa banda:\n');
console.log('  '+P('t_posa',10)+P('gain / RN',14)+P('fattore',10));
for(const ts of [120,300,600,900,1800]) console.log('  '+P(ts+' s',10)+P('HCG 1.5 e-',14)+P('×'+f(timeFactor(dv,'OIII',ts),3),10));
const cam=DB.cameras.find(c=>c.id==='asi2600mm'); const o=cam.read_noise_e;
cam.read_noise_e=3.3; const lcg=timeFactor(D('rc8',1,'asi2600mm'),'OIII',600); cam.read_noise_e=o;
console.log('  '+P('600 s',10)+P('LCG 3.3 e-',14)+P('×'+f(lcg,3),10));
chk('il fattore DIPENDE dalla posa',Math.abs(timeFactor(dv,'OIII',120)-timeFactor(dv,'OIII',1800))>0.05,
  f(timeFactor(dv,'OIII',120),3)+' -> '+f(timeFactor(dv,'OIII',1800),3));
chk('il fattore DIPENDE dal rumore di lettura',Math.abs(lcg-timeFactor(dv,'OIII',600))>0.05,
  f(timeFactor(dv,'OIII',600),3)+' -> '+f(lcg,3));
console.log('\n  => CATEGORIA B. Non e una proprieta del telescopio. Va calcolato con la');
console.log('     subExposure REALE del planner: vive in EFFICIENCY, riceve t_posa da OPERATIONS.');
module.exports=S;
