const {row,CFG,Cw,hrs,SQM,TSUB,FWHM_SG,SB}=require('/tmp/bench3.js');
const {M}=require('/tmp/a61.js');
const f=(x,n=3)=>Number(x).toFixed(n), P=(s,n)=>String(s).padEnd(n);
console.log('SORGENTE ESTESA — [OIII] di Abell 61, brillanza superficiale MISURATA');
console.log('  Frew+2013 logF(Ha)=-11.38 · Acker+1992 I5007/I6563=1.696 · raggio OIII 155"');
console.log('  cielo SQM '+SQM+' · posa '+TSUB+' s · seeing+guida '+FWHM_SG+'" · filtro 3 nm T 0.90');
console.log();
const R=CFG.map(c=>[c[0],row(c[1],c[2],c[3],'OIII')]), A=R[0][1];
console.log('--- geometria ---');
console.log(P('config',30)+P('f/ (F/D)',10)+P('throughput',12)+P('"/px',8)+P('A_eff cm2',11)+P('QE·T·CFA',10));
R.forEach(([n,r])=>{  console.log(P(n,30)+P('f/'+f(r.fr,2),10)+P(f(r.dv.thru,3),12)+P(f(r.sc,3),8)+P(f(r.A,1),11)+P(f(r.k,3),10));});
console.log();
console.log('--- 1. ILLUMINAMENTO PER PIXEL — segue 1/f², non l\'apertura ---');
console.log(P('config',30)+P('e-/px/s ogg',13)+P('e-/px/s cielo',15)+P('rel. RC8',10)+P('(f_A/f)²·(tau/tau_A)',22));
R.forEach(([n,r])=>{console.log(P(n,30)+P(r.S_px.toExponential(3),13)+P(f(r.B_px,5),15)
  +P(f(r.S_px/A.S_px,2)+'x',10)+P(f(Math.pow(A.fr/r.fr,2)*(r.dv.thru/A.dv.thru),2)+'x',22));});
console.log();
console.log('--- 2. FLUSSO PER ARCSEC² — segue A·k, il rapporto focale sparisce ---');
console.log(P('config',30)+P('e-/arcsec2/s',14)+P('rel. RC8',10)+P('(A·k) rel.',12));
R.forEach(([n,r])=>console.log(P(n,30)+P(r.S_arc.toExponential(3),14)
  +P(f(r.S_arc/A.S_arc,3)+'x',10)+P(f((r.A*r.k)/(A.A*A.k),3)+'x',12)));
console.log();
console.log('--- 3. PENALITA STRUMENTALE P — QUI rientra il rapporto focale ---');
console.log(P('config',30)+P('cielo/arcsec2/s',17)+P('buio',8)+P('RN²/posa',10)+P('P',8)+P('P rel. RC8',12));
R.forEach(([n,r])=>console.log(P(n,30)+P(f(r.B_arc,5),17)+P(f(r.d,4),8)
  +P(f(r.rn*r.rn/r.ts,5),10)+P(f(r.P,3),8)+P(f(r.P/A.P,3)+'x',12)));
console.log();
console.log('--- 4. CAMPIONAMENTO E SEEING ---');
console.log(P('config',30)+P('"/px',8)+P('FWHM_tot',10)+P('verdetto',18)+P('C(60")',9)+P('C(6")',9)+P('C(3")',9));
R.forEach(([n,r])=>{const v=M.samplingVerdict(r.sc,FWHM_SG);
  console.log(P(n,30)+P(f(r.sc,3),8)+P(f(r.fw,3)+'"',10)+P(v.k,18)
  +P(f(Cw(60,r.fw),3),9)+P(f(Cw(6,r.fw),3),9)+P(f(Cw(3,r.fw),3),9));});
console.log();
console.log('--- 5. SINTESI: ore relative, e da dove vengono ---');
console.log(P('config',30)+P('A·k',9)+P('× P',9)+P('= ore rel.',12)+P('f/ restituisce',15));
R.forEach(([n,r])=>{const ak=(A.A*A.k)/(r.A*r.k), pp=r.P/A.P, h=hrs(r,20,60)/hrs(A,20,60);
  console.log(P(n,30)+P(f(ak,2)+'x',9)+P(f(pp,2)+'x',9)+P(f(h,2)+'x',12)
  +P(r===A?'—':f(ak/h,2)+'x = '+f(100*(1-h/ak),0)+'%',15));});
