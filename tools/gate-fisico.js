#!/usr/bin/env node
/* GATE FISICO A..G — non modifica nulla.  node tools/gate-fisico.js  */
const path=require('path'), fs=require('fs');
const ROOT=path.join(__dirname,'..');
const pure=fs.readFileSync(ROOT+'/index.html','utf8').split('<script>')[1].split('</script>')[0]
  .split('/* =====================================================================\n   UI')[0];
const DB=JSON.parse(fs.readFileSync(ROOT+'/data/setups.json','utf8'));
const TG=JSON.parse(fs.readFileSync(ROOT+'/data/targets.json','utf8'));
const CAT=JSON.parse(fs.readFileSync(ROOT+'/data/catalog.json','utf8'));
const CIT=JSON.parse(fs.readFileSync(ROOT+'/data/cities.json','utf8'));
const ctx={DB,TG,CAT:CAT.objects,CITIES:CIT.cities,OWNED:DB.default_filters.slice(),
  console,Math,Date,Object,JSON,isFinite,parseFloat,parseInt,Number,window:{}};
const M=new Function(...Object.keys(ctx),pure+`return {derive,refCfg,timeFactor,qeAt,
  skyRateFor,bandSpec,cfaFraction,samplingVerdict,effFWHM,BAND_LAMBDA};`)(...Object.values(ctx));
const f=(x,n=3)=>(x==null||!isFinite(x))?'—':Number(x).toFixed(n);
const P=(s,n)=>String(s).padEnd(n);
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(Math.min(t.length,78)));
const S={PASS:0,FAIL:0};
const chk=(n,c,g,w)=>{c?S.PASS++:S.FAIL++;console.log('  '+(c?'\x1b[32mOK  \x1b[0m':'\x1b[31mFAIL\x1b[0m')+' '+P(n,56)
  +(g!==undefined?('  '+g+(w!==undefined?'  atteso '+w:'')):''));};
const SQM_REF=DB.reference_config.sqm_zenith;

/* ── IL MODELLO, UN POSTO SOLO ───────────────────────────────────────────
   Tassi PER PIXEL (come li pubblicano ESO/STScI/Rubin) e conversione
   a unita' di angolo solido. Nessun'altra formula altrove. */
function rates(dv,band,sqm){
  const sp=M.bandSpec(band,dv.c), lam=sp.lines[0]||M.BAND_LAMBDA[band]||550;
  const cfa=M.cfaFraction(dv.c,band);
  const osc=(dv.c.cfa_penalty&&!sp.narrow)?0.34:1;
  return {sp,lam,cfa,osc,
    k:M.qeAt(dv.c,lam)*sp.T*cfa*osc,                  // adimensionale
    om:dv.scale*dv.scale,                             // arcsec²/px
    Acm2:dv.Aeff/100,                                 // cm²
    collect:(dv.Aeff/100)*M.qeAt(dv.c,lam)*sp.T*cfa*osc,
    R_b:M.skyRateFor(dv,band,sqm,{spec:sp})*cfa,      // e-/px/s  cielo
    R_d:(dv.c.dark_e_s||0)*dv.bin*dv.bin,             // e-/px/s  buio
    RN :dv.rnEff||dv.c.read_noise_e||0};              // e- per lettura
}
// SNR di N pose, forma pubblicata (per pixel)
const snrPix=(R_s,r,T,tsub)=>R_s*T/Math.sqrt((R_s+r.R_b+r.R_d)*T+(T/tsub)*r.RN*r.RN);
// varianza per arcsec² al secondo
const Vdot=(r,tsub,s_arc)=>(s_arc||0)+r.R_b/r.om+r.R_d/r.om+r.RN*r.RN/(r.om*tsub);
// SNR su Omega0 arcsec²
const snrArc=(s_arc,r,T,tsub,Om0)=>s_arc*Math.sqrt(Om0*T/Vdot(r,tsub,s_arc));
const RD=()=>M.derive({tel:DB.reference_config.telescope,red:DB.reference_config.reducer,
  cam:DB.reference_config.camera,mnt:'am5',bin:1});
function timeFactor(dv,band,tsub,s_fot,sqm){
  const q=sqm==null?SQM_REF:sqm;
  const a=rates(dv,band,q), b=rates(RD(),band,q);
  return (Vdot(a,tsub,(s_fot||0)*a.collect)/Math.pow(a.collect,2))
       / (Vdot(b,tsub,(s_fot||0)*b.collect)/Math.pow(b.collect,2));
}
const D=(t,r,c,b,m)=>M.derive({tel:t,red:r,cam:c,mnt:m||'cem70g',bin:b||1});
module.exports={M,DB,TG,rates,Vdot,snrPix,snrArc,timeFactor,D,RD,SQM_REF,f,P,H,chk,S,fs,ROOT};
