/* Carica il motore puro — la parte di index.html prima del blocco UI — e lo
   restituisce come modulo. Ogni strumento in tools/ passa di qui.

   Esisteva gia', ma viveva in /tmp sulla macchina di chi aveva scritto i
   benchmark: bench-optics.js e bench-optics-run.js facevano require('/tmp/a61.js')
   e quindi non hanno MAI funzionato per nessun altro. Stessa forma del difetto
   corretto in gate-v16 (la base di confronto in /tmp/old): uno strumento che gira
   su una macchina sola non e' uno strumento, e' un ricordo.                    */
const fs=require('fs'), path=require('path');
const R=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(R,'index.html'),'utf8');
const pure=html.split('<script>')[1].split('</script>')[0]
  .split('/* =====================================================================\n   UI')[0];
const J=n=>JSON.parse(fs.readFileSync(path.join(R,'data',n),'utf8'));
const DB=J('setups.json'), TG=J('targets.json'), CAT=J('catalog.json'), CIT=J('cities.json');
/* Gli stessi input che riceve il browser: senza magnitudine objectSatTime non
   vede il tetto del soggetto, senza angolo di posizione mosaicPanels assume
   l'oggetto allineato al sensore. Vedi tools/lib/enrich.js. */
require('./enrich.js').enrich(TG,CAT.objects,R);
const ctx={DB,TG,CAT:CAT.objects,CITIES:CIT.cities,OWNED:DB.default_filters.slice(),
  console,Math,Date,Object,JSON,isFinite,parseFloat,parseInt,Number,window:{}};
const M=new Function(...Object.keys(ctx),pure+`return {derive,refCfg,timeFactor,rates,varRate,
  qeAt,camSpec,resolveSensor,dyeAnchor,gainModes,gainModeFor,oscEfficiency,bayerDye,mosaicFrac,
  nightWindows,nightsBounds,bestStart,planNights,resolveNight,moonIllum,moonPos,toJD,altaz,lstDeg,
  bandThroughput,samplingVerdict,framing,nightProfile,effFWHM,evaluate,prescribe,synthTarget,
  roadChannels,roadSum,costGroups,accessibleH,moonPenalty,lpPenalty,filterFor,
  dualPass,BAND_LAMBDA,BB_NM,leakOf,kExt,mosaicPanels,binAdvice,expectFor,
  cfaFraction,bandSpec,skyRateFor,subExposure,exposurePlan,objectSatTime,subPlan,
  fitAlternatives,framing,projectPanels,COV_FULL,COV_FRAMING};`)
  (...Object.values(ctx));
module.exports={M,DB,TG,CAT,CIT,ROOT:R};
