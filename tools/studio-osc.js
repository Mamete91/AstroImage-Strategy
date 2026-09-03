#!/usr/bin/env node
/* STUDIO — risposta spettrale di una matrice di Bayer.
   Decide se OSC_BB puo' essere sostituito da una modellazione, e con quale
   dominio di validita'.   node tools/studio-osc.js                            */
const fs=require('fs'), path=require('path');
const DB=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','setups.json'),'utf8'));
const f=(x,n=3)=>(x==null||!isFinite(x))?'—':Number(x).toFixed(n);
const P=(s,n)=>String(s).padEnd(n);
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(Math.min(t.length,78)));

/* ── ANCORE ────────────────────────────────────────────────────────────────
   Per IMX571/455/533/294/183 a colori NON esistono curve QE per canale
   pubbliche: verificato flyer per flyer su Sony (nessuna figura spettrale; i
   datasheet completi sono sotto NDA), su ZWO/QHY (nessun dato tracciabile) e in
   letteratura (ogni misura pubblicata e' del sensore MONO).
   Restano due basi indipendenti che conservano il rapporto FRA i canali — cosa
   rara: quasi tutti i database normalizzano ogni canale a 1 e distruggono
   proprio l'informazione che serve qui.
     A) Sony IMX219, digitalizzata a normalizzazione COMUNE
        (bluegreen-labs/raspberry_pi_camera_responses, 400-700 nm passo 1 nm)
     B) letture di terzi sulla carta ZWO ASI2600MC (IMX571), forum
   Costruisco su A, verifico su B. Se non concordassero, il modello non si fa. */
const KN={
  R:[[400,1.5],[457,1.0],[483,1.2],[500.7,6.39],[521,12],[560,42],[582,62],
     [597,97.19],[620,92],[656.3,68.73],[672.4,59.53],[700,44]],
  G:[[400,6],[440,22],[457,34],[477,49.73],[483,57],[500.7,93.80],[521,99.46],
     [560,88],[582,62],[595,49.73],[620,22],[656.3,13.38],[672.4,15.23],[700,16]],
  B:[[400,66],[430,80],[457,83.12],[477,66],[483,57],[500.7,46.23],[504,41.56],
     [530,22],[560,12],[600,7.6],[656.3,7.31],[672.4,8.60],[700,9]]
};
const ip=(t,x)=>{if(x<=t[0][0])return t[0][1]; if(x>=t[t.length-1][0])return t[t.length-1][1];
  for(let i=1;i<t.length;i++) if(x<=t[i][0]){const[a,b]=t[i-1],[c,d]=t[i];return b+(d-b)*(x-a)/(c-a);}};
const T={R:l=>ip(KN.R,l)/100,G:l=>ip(KN.G,l)/100,B:l=>ip(KN.B,l)/100};
const mosaicT=l=>(T.R(l)+2*T.G(l)+T.B(l))/4;      // RGGB: 1 R, 2 G, 1 B
const bestT  =l=>Math.max(T.R(l),T.G(l),T.B(l));  // cio' che mostra la curva pubblicata
const ZWO={656.3:{R:0.82,G:0.15,B:0.05},500.7:{R:0.03,G:0.94,B:0.50},672.4:{R:0.75,G:0.18,B:0.07}};
const ENG={Ha:0.29,OIII:0.71,SII:0.28}, LAM={Ha:656.3,OIII:500.7,SII:672.4};
const qtab=o=>{const k=Object.keys(o).map(Number).sort((a,b)=>a-b);
  return x=>{if(x<=k[0])return o[k[0]]; if(x>=k[k.length-1])return o[k[k.length-1]];
    for(let i=1;i<k.length;i++) if(x<=k[i]){const a=k[i-1],b=k[i];return o[a]+(o[b]-o[a])*(x-a)/(b-a);}}};
/* 2026-09: le curve stanno sul SENSORE, non piu' sulle due schede camera. */
const _s571=DB.sensors.find(s=>s.id==='imx571');
const QEmono=qtab(_s571.qe);
const QEosc =qtab(_s571.qe_cfa);

H('1 · VERIFICA INDIPENDENTE — modello (IMX219) contro carta ZWO (IMX571)');
console.log('  Normalizzazioni diverse: confronto i rapporti al canale dominante.\n');
console.log('  '+P('λ nm',9)+P('R:G:B modello',28)+P('R:G:B ZWO',28));
for(const [lam,z] of Object.entries(ZWO)){
  const m={R:T.R(+lam),G:T.G(+lam),B:T.B(+lam)}, mx=Math.max(m.R,m.G,m.B), zx=Math.max(z.R,z.G,z.B);
  console.log('  '+P(lam,9)+P(['R','G','B'].map(c=>f(m[c]/mx,3)).join(' : '),28)
                        +P(['R','G','B'].map(c=>f(z[c]/zx,3)).join(' : '),28));
}
console.log('  → il VERDE concorda entro il 7% su tutte e tre le righe. Ed e il verde a');
console.log('    pesare doppio nel mosaico. Il BLU e sistematicamente 1.5-1.7x piu alto');
console.log('    nell IMX219: atteso, e un sensore nudo da telefono contro una astronomica.');

H('2 · LA FRAZIONE DI MOSAICO, RIGA PER RIGA');
console.log('  η = (R + 2G + B)/4 / max(R,G,B)  ← e ESATTAMENTE la definizione di cfa_fraction\n');
console.log('  '+P('banda',7)+P('λ nm',9)+P('modello',10)+P('da ZWO',10)+P('nel motore',12)+P('scarto',9));
for(const [b,lam] of Object.entries(LAM)){
  const z=ZWO[lam], zEta=(z.R+2*z.G+z.B)/4/Math.max(z.R,z.G,z.B), m=mosaicT(lam)/bestT(lam);
  console.log('  '+P(b,7)+P(lam,9)+P(f(m,3),10)+P(f(zEta,3),10)+P(f(ENG[b],3),12)
    +P(((m/ENG[b]-1)*100>0?'+':'')+((m/ENG[b]-1)*100).toFixed(0)+'%',9));
}
console.log('  → le due fonti indipendenti concordano FRA LORO entro il 6% e NON col motore.');

H('3 · CALIBRAZIONE SULLE DUE CURVE PUBBLICATE ZWO');
console.log('  La curva OSC pubblicata dovrebbe essere QE_mono × T_canale_migliore.');
console.log('  Se il modello e buono, QE_osc/QE_mono deve seguire bestT.\n');
console.log('  '+P('λ nm',8)+P('QE mono',10)+P('QE osc',10)+P('rapporto',10)+P('bestT',9)+P('scarto',8));
for(const l of [400,450,500,550,600,650,656,672,700]){
  const r=QEosc(l)/QEmono(l), b=bestT(l), d=r/b-1;
  console.log('  '+P(l,8)+P(f(QEmono(l),3),10)+P(f(QEosc(l),3),10)+P(f(r,3),10)+P(f(b,3),9)
    +P(((d>0?'+':'')+(100*d).toFixed(0))+'%',8));
}
let cal=0,n=0; for(const l of [400,450,500,550,600,650,700]){cal+=QEosc(l)/QEmono(l)/bestT(l);n++;} cal/=n;
console.log('  fattore di scala: '+f(cal,3)+'   ACCORDO OTTIMO 500-600 nm (-1%, +1%, -7%),');
console.log('  DEGRADA NEL ROSSO (+26% a 656, +44% a 672): il colorante rosso dell IMX219');
console.log('  cade piu in fretta di quello dell IMX571, oppure la carta ZWO e ottimista.');
console.log('  → e proprio dove vivono Ha e SII. E il limite onesto del trapianto.');

H('4 · IL NUMERO CHE SOSTITUIREBBE OSC_BB');
console.log('  Il motore calcola:  rate = … × QE_osc(λ_eff) × T_filtro × larghezza × OSC_BB');
console.log('  Il conto giusto e:  rate = … × T_filtro × ∫ QE_mono(λ) × mosaicT(λ) dλ');
console.log('  quindi  OSC_BB = ⟨QE_mono × mosaicT⟩_banda / QE_osc(λ_eff)\n');
function oscBB(lo,hi,le,S){let num=0,w=0;
  for(let l=lo;l<=hi;l+=1){const s=S?S(l):1; num+=s*QEmono(l)*mosaicT(l)*cal; w+=s;}
  return (num/w)/QEosc(le);}
const FLAT=l=>1,SOLAR=l=>Math.pow(l/550,-0.5),BLUE=l=>Math.pow(l/550,-2),RED=l=>Math.pow(l/550,1.5);
console.log('  '+P('banda',20)+P('intervallo',13)+P('λ_eff',8)+P('piatto',9)+P('solare',9)+P('blu',9)+P('rosso',9));
for(const [nm,lo,hi,le] of [['L (UV-IR cut)',400,700,550],['RGB come banda',400,700,535],
                            ['R',580,700,620],['G',490,580,535],['B',400,500,450]])
  console.log('  '+P(nm,20)+P(lo+'-'+hi,13)+P(le,8)+P(f(oscBB(lo,hi,le,FLAT),3),9)
    +P(f(oscBB(lo,hi,le,SOLAR),3),9)+P(f(oscBB(lo,hi,le,BLUE),3),9)+P(f(oscBB(lo,hi,le,RED),3),9));
console.log('\n  OSC_BB oggi nel motore: 0.340   ·   modello per L: '+f(oscBB(400,700,550,FLAT),3));
console.log('  → 0.34 e il valore a crosstalk ZERO: (¼ rosso + ½ verde + ¼ blu)/3 = 0.333.');
console.log('    Con il crosstalk misurato sale a ~0.48. Era troppo pessimista del 40%.');
console.log('  → e la dipendenza dallo SPETTRO DELLA SORGENTE e trascurabile: ±3%.');

H('5 · SENSIBILITA AL PARAMETRO DEBOLE (la fuga nel rosso di verde e blu)');
console.log('  Varia di quasi due ordini di grandezza fra sensori reali (0.1% – 9%).\n');
console.log('  '+P('fuga R di G,B',16)+P('η Ha',10)+P('η OIII',10)+P('η SII',10)+P('OSC_BB (L)',12));
const base={G:KN.G.slice(),B:KN.B.slice()};
for(const k of [0.5,1,2]){
  KN.G=base.G.map(([l,v])=>[l,l>600?v*k:v]); KN.B=base.B.map(([l,v])=>[l,l>600?v*k:v]);
  console.log('  '+P(k===1?'nominale':'×'+k,16)+P(f(mosaicT(656.3)/bestT(656.3),3),10)
    +P(f(mosaicT(500.7)/bestT(500.7),3),10)+P(f(mosaicT(672.4)/bestT(672.4),3),10)
    +P(f(oscBB(400,700,550,FLAT),3),12));
}
KN.G=base.G; KN.B=base.B;
console.log('\n  ══ IL RISULTATO CHE ROVESCIA L ASPETTATIVA ══');
console.log('  banda stretta nel ROSSO (Ha, SII):  ±35-40%  ← fragile');
console.log('  banda stretta nel VERDE (OIII):     ±2%      ← solido');
console.log('  banda LARGA (L, RGB):               ±6%      ← solido');
console.log('  Il ramo dichiarato VALIDATO poggia sul parametro fragile; quello');
console.log('  dichiarato NON VALIDATO no. In banda larga la fuga e una perturbazione');
console.log('  piccola su un segnale grande; sull Ha e TUTTO il contributo di verde e blu.');
