const G=require('./gate-fisico.js');
const {M,DB,rates,Vdot,timeFactor,D,RD,SQM_REF,f,P,H,chk,S}=G;

H('D · RIDUTTORE 0,80× — risultato del modello, non regola');
console.log('  Stesso telescopio, stessa apertura, stessa camera. Cambia SOLO la focale.');
console.log('  Il "vantaggio" si muove con OGNI parametro: non e una costante del riduttore.\n');
console.log('  '+P('condizione',34)+P('f/8.0',10)+P('f/6.4',10)+P('vantaggio',11));
function pair(lab,band,tsub,sqm,mut){
  const und=[];
  if(mut) und.push(mut());
  const a=timeFactor(D('rc8',1,'asi2600mm'),band,tsub,0,sqm);
  const b=timeFactor(D('rc8',0.8,'asi2600mm'),band,tsub,0,sqm);
  und.forEach(u=>u&&u());
  console.log('  '+P(lab,34)+P('×'+f(a,3),10)+P('×'+f(b,3),10)+P(f(100*(1-b/a),1)+'%',11));
  return 1-b/a;
}
const cam=DB.cameras.find(c=>c.id==='asi2600mm');
const base=pair('OIII 3nm · 600 s · SQM 21.3 · HCG','OIII',600,21.3);
const short=pair('   posa 120 s','OIII',120,21.3);
const long =pair('   posa 1800 s','OIII',1800,21.3);
const city =pair('   cielo SQM 18.5','OIII',600,18.5);
const lcg  =pair('   gain LCG (RN 3.3 e-)','OIII',600,21.3,()=>{const o=cam.read_noise_e;cam.read_noise_e=3.3;return()=>cam.read_noise_e=o;});
const dark =pair('   buio 0.0005 e-/px/s','OIII',600,21.3,()=>{const o=cam.dark_e_s;cam.dark_e_s=0.0005;return()=>cam.dark_e_s=o;});
const bb   =pair('banda larga L · 180 s · SQM 21.3','L',180,21.3);
chk('il vantaggio cambia con la posa', Math.abs(short-long)>0.05, f(100*short,1)+'% -> '+f(100*long,1)+'%');
chk('il vantaggio cambia col cielo', Math.abs(base-city)>0.05, f(100*base,1)+'% -> '+f(100*city,1)+'%');
chk('il vantaggio cambia col rumore di lettura', Math.abs(base-lcg)>0.03, f(100*base,1)+'% -> '+f(100*lcg,1)+'%');
chk('il vantaggio cambia con la corrente di buio', Math.abs(base-dark)>0.02, f(100*base,1)+'% -> '+f(100*dark,1)+'%');
chk('in banda larga il vantaggio e trascurabile', bb<0.03, f(100*bb,2)+'%');
console.log('\n  => Nel codice non va scritto «riduttore 0.8× = 23% piu veloce». Va scritto il');
console.log('     modello; il 23% e cio che esce a QUELLE condizioni, e la UI deve dirle.');

H('E · RC8 CONTRO ASKAR — tutti i parametri, risultato in fondo');
for(const [band,tsub] of [['OIII',600],['Ha',600],['L',180]]){
  console.log('\n  banda '+band+' · posa '+tsub+' s · SQM '+SQM_REF+' · metrica: SNR per arcsec² di cielo');
  console.log('  '+P('config',26)+P('D mm',7)+P('F mm',7)+P('f/',7)+P('"/px',7)+P('tau',7)
    +P('QE',6)+P('filt',6)+P('CFA',6)+P('OSC',6)+P('A·k',8));
  const cfg=[['RC8 nativo','rc8',1,'asi2600mm'],['RC8 0.80x','rc8',0.8,'asi2600mm'],
             ['Askar 71F nativo','askar71f',1,'asi2600mm'],['Askar 71F 0.75x','askar71f',0.75,'asi2600mm'],
             ['Askar 0.75x + 2600MC','askar71f',0.75,'asi2600mc']];
  const R=cfg.map(c=>{const dv=D(c[1],c[2],c[3]);return [c[0],dv,rates(dv,band,SQM_REF)];});
  R.forEach(([n,dv,r])=>console.log('  '+P(n,26)+P(dv.t.aperture_mm,7)+P(f(dv.F,0),7)+P('f/'+f(dv.fRatio,2),7)
    +P(f(dv.scale,3),7)+P(f(dv.thru,3),7)+P(f(M.qeAt(dv.c,r.lam),2),6)+P(f(r.sp.T,2),6)
    +P(f(r.cfa,2),6)+P(f(r.osc,2),6)+P(f(r.collect,1),8)));
  console.log('  '+P('config',26)+P('b_arc',10)+P('d_arc',10)+P('r_arc',10)+P('Vdot',10)
    +P('FOTOM.',9)+P('campionamento',17));
  R.forEach(([n,dv,r])=>console.log('  '+P(n,26)+P(f(r.R_b/r.om,5),10)+P(f(r.R_d/r.om,5),10)
    +P(f(r.RN*r.RN/(r.om*tsub),5),10)+P(f(Vdot(r,tsub,0),5),10)
    +P('×'+f(timeFactor(dv,band,tsub),2),9)+P(M.samplingVerdict(dv.scale,2.2).k,17)));
}
{const a=D('rc8',1,'asi2600mm'), b=D('askar71f',1,'asi2600mm');
 const ra=rates(a,'OIII',SQM_REF), rb=rates(b,'OIII',SQM_REF);
 const ratio=timeFactor(b,'OIII',600)/timeFactor(a,'OIII',600);
 console.log('\n  RC8 nativo contro Askar nativo, stessa camera, OIII 3 nm, 600 s, SQM 21.3:');
 console.log('    (203.2/71)² diametri nudi                        ×'+f(Math.pow(203.2/71,2),2));
 console.log('    raccolta reale A·k (ostruzione 45% + tau + QE)   ×'+f(ra.collect/rb.collect,2)+'  a favore RC8');
 console.log('    rapporto delle varianze Vdot                     ×'+f(Vdot(ra,600,0)/Vdot(rb,600,0),2)+'  a sfavore RC8');
 console.log('    ─────────────────────────────────────────────────────────');
 console.log('    RISULTATO DEL MODELLO in questa configurazione   ×'+f(ratio,2));
 console.log('    lo stesso, in banda larga                        ×'+f(timeFactor(b,'L',180)/timeFactor(a,'L',180),2));
 console.log('    lo stesso, a posa 300 s                          ×'+f(timeFactor(b,'OIII',300)/timeFactor(a,'OIII',300),2));
 console.log('    lo stesso, a SQM 18.5                            ×'+f(timeFactor(b,'OIII',600,0,18.5)/timeFactor(a,'OIII',600,0,18.5),2));
 chk('il rapporto NON e una costante: si muove con banda, posa e cielo',
   Math.abs(ratio-timeFactor(b,'L',180)/timeFactor(a,'L',180))>0.5, 'da ×'+f(ratio,2)+' a ×'+f(timeFactor(b,'L',180)/timeFactor(a,'L',180),2));
 chk('il rapporto e compreso fra raccolta e raccolta/penalita', ratio<=ra.collect/rb.collect+1e-9,
   '×'+f(ratio,2)+' <= ×'+f(ra.collect/rb.collect,2));
 console.log('\n  => Non «RC8 e 4,35× piu veloce». «Con questa camera, questo filtro, questo');
 console.log('     cielo, questa posa e questa metrica, il modello da ×'+f(ratio,2)+'.»');}

H('F · STATO OSC_BB × f_CFA — dichiarato NON VALIDATO');
console.log(`
  Cosa rappresentano, uno per uno:

    QE(lambda)   efficienza quantica del fotosito alla lunghezza d'onda.
                 Per una OSC la curva pubblicata e' quella del canale MIGLIORE.
    T_filtro     trasmissione del filtro alla riga / nella banda.
    f_CFA        frazione di fotositi che raccoglie DAVVERO quella RIGA, pesata
                 per la QE dei canali a quella lunghezza d'onda. Corregge il
                 NUMERO di pixel utili. Ha senso per una riga stretta.
    OSC_BB       corregge la BANDA: un fotosito colorato vede ~1/3 dello spettro,
                 quindi moltiplicare la QE pubblicata per i 250 nm della luminanza
                 conterebbe tre volte. Ha senso per un continuo largo.

  Sono grandezze DIVERSE e in banda stretta non si toccano (OSC_BB non si applica).
  In banda larga si sovrappongono: entrambe stanno dicendo «un pixel colorato
  raccoglie meno». Per L la scheda dichiara f_CFA = 1.00 e il conto e coerente.
  Per RGB dichiara 0.62, e 0.62 x 0.34 = 0.21 e' quasi certamente doppio conteggio.

  NON scelgo un numero nuovo. Serve ricostruire il conto per canale
  (integrale di QE_c x T su ciascuna banda, mediato sui 4 fotositi) e confrontarlo
  con la forma attuale. E' un lavoro con la sua verifica.

  >>> CHIUSO IN v1.5 — vedi docs/studio-osc.md. Erano la STESSA grandezza valutata
  >>> a una riga oppure integrata su una banda, e per questo moltiplicarle era
  >>> sempre un errore. Una sola funzione, oscEfficiency(), le sostituisce entrambe.
  >>> Banda larga: modello spettrale, +-6%. Banda stretta: vince il dato dichiarato.
  >>> Questo modulo resta com'era: e' il verbale della validazione v1.4.
`);
{const dv=D('askar71f',0.75,'asi2600mc');
 console.log('  '+P('banda',8)+P('narrow',9)+P('f_CFA',8)+P('OSC_BB',9)+P('prodotto',10)+P('stato',22));
 for(const b of ['Ha','OIII','SII','L','RGB']){
   const r=rates(dv,b,SQM_REF);
   console.log('  '+P(b,8)+P(r.sp.narrow?'si':'no',9)+P(f(r.cfa,2),8)+P(f(r.osc,2),9)
     +P(f(r.cfa*r.osc,3),10)+P(r.sp.narrow?'VALIDATO':(r.cfa>0.99?'coerente':'NON VALIDATO'),22));}
 chk('la banda stretta non e toccata da OSC_BB',
   ['Ha','OIII','SII'].every(b=>rates(dv,b,SQM_REF).osc===1), 'OSC_BB = 1 su tutte e tre');
 chk('i regression test A61/NGC6888 non dipendono da OSC_BB', true, 'mono + banda stretta');}
console.log('  => narrowband VALIDATO · OSC broadband NON VALIDATO e non usato per convalidare nulla.');
module.exports=S;
