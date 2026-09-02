/* BANCO RC8 vs ASKAR 71F — sorgente estesa. Ogni effetto in colonna separata.
   ------------------------------------------------------------------------
   MODELLO (scritto qui, non richiamato dal motore)

   k = QE(λ) · T_filtro · f_CFA · [OSC_BB se continuo su matrice Bayer]
       f_CFA = frazione di fotositi che raccoglie DAVVERO quella riga
       (nota: skyRateFor() del motore da' il rate del pixel del colore GIUSTO,
        cioe' senza f_CFA: e' corretto per la saturazione, va corretto qui.)

   per PIXEL      S_px  = s·A·k·Omega_px        ∝ A/F² = 1/f²   <- item 1
   per ARCSEC²    S_arc = s·A·k                 ∝ A             <- item 2

   varianza per arcsec² al secondo:
       S_arc + B_arc  (fotoni: seguono A·k)
     + d_px/Omega_px            (buio:    ∝ F², NON attenuato dal CFA)
     + RN²/(t_posa·Omega_px)    (lettura: ∝ F², NON attenuato dal CFA)
   -> i due termini strumentali si scrivono come  B_arc·(P-1)  con
       P = 1 + (d_px + RN²/t_posa) / (B_arc·Omega_px)
     P e' l'UNICO posto da cui entra il rapporto focale su sorgente estesa.
     Su una OSC in banda stretta P e' amplificato di 1/f_CFA: i pixel del
     colore sbagliato mettono rumore di lettura e non mettono segnale.

   contrasto residuo di una struttura larga w dopo la PSF:
       C(w) = w²/(w²+FWHM_tot²),  FWHM_tot = sqrt(FWHM_seeing+guida² + (0.68·scala)²)
     -> QUI entra il campionamento.                              <- item 3/4

   ore a pari SNR:  t = SNR²/C(w)² · [S_arc + B_arc·P] / S_arc² */
const {M,DB}=require('/tmp/a61.js');
const H=6.626e-27, Cc=3e10, ARCSEC2_SR=2.35044e-11;
const ph=lam=>1/(H*Cc/(lam*1e-7));
const F_Ha=Math.pow(10,-11.38), RATIO=950/560;
const SB={ OIII:(F_Ha*RATIO)/(Math.PI*155*155)*ph(500.7),   // fot/s/cm2/arcsec2, riga
           Ha  : F_Ha        /(Math.PI*190*190)*ph(656.3) };
const MU_CONT=22.0;                                          // continuo mag/arcsec2 per L
const SQM=21.3, TSUB=600, FWHM_SG=2.2;
const CFG=[['A  RC8 + 2600MM','rc8',1.0,'asi2600mm'],
           ['B  Askar 71F + 2600MM','askar71f',1.0,'asi2600mm'],
           ['C  Askar 71F 0.75x + 2600MM','askar71f',0.75,'asi2600mm'],
           ['D  Askar 71F 0.75x + 2600MC','askar71f',0.75,'asi2600mc']];
const OSC_BB=0.34;
function row(tel,red,cam,band,tsub){
  const dv=M.derive({tel,red,cam,mnt:'cem70g',bin:1});
  const sp=M.bandSpec(band,dv.c), cfa=M.cfaFraction(dv.c,band);
  const lam=sp.lines[0], A=dv.Aeff/100, om=dv.scale*dv.scale;
  const osc=(dv.c.cfa_penalty&&!sp.narrow)?OSC_BB:1;
  const k=M.qeAt(dv.c,lam)*sp.T*cfa*osc;
  const B_arc=M.skyRateFor(dv,band,SQM,{spec:sp})/om*cfa;     // <- CFA applicato: media sul mosaico
  const S_arc=sp.narrow ? SB[band]*A*k
            : 1008*Math.pow(10,-0.4*MU_CONT)*A*k*(sp.fwhm*10);
  const d=dv.c.dark_e_s||0, rn=dv.rnEff||dv.c.read_noise_e, ts=tsub||TSUB;
  const P=1+(d+rn*rn/ts)/(B_arc*om);
  const fw=Math.sqrt(FWHM_SG*FWHM_SG+Math.pow(0.68*dv.scale,2));
  return {dv,cfa,k,A,om,S_px:S_arc*om,B_px:B_arc*om,S_arc,B_arc,d,rn,P,fw,ts,
          fr:dv.fRatio,sc:dv.scale,narrow:sp.narrow};
}
const Cw=(w,fw)=>w*w/(w*w+fw*fw);
const hrs=(r,snr,w)=>snr*snr*(r.S_arc+r.B_arc*r.P)/Math.pow(Cw(w,r.fw)*r.S_arc,2)/3600;
module.exports={row,CFG,Cw,hrs,SQM,TSUB,FWHM_SG,SB,MU_CONT};
