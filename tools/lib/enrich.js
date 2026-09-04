/* L'INNESTO DEI DATI OpenNGC, per chi non e' il browser.

   Nell'app due funzioni dello strato UI — mergeCatalog() ed enrichTargets() —
   prendono da OpenNGC quello che il catalogo curato e le schede non hanno:
   la magnitudine e l'angolo di posizione. Vince chi ha il dato, non chi ha lo
   strato. Gli strumenti da riga di comando non passavano di li', quindi
   ricevevano schede senza magnitudine e senza angolo, e il motore rispondeva
   di conseguenza:

     objectSatTime()  senza magnitudine restituisce sempre Infinity, cioe'
                      «il soggetto non satura mai» — e il tetto del soggetto
                      sparisce dal calcolo della posa;
     objectExtent()   senza angolo di posizione non conosce l'ingombro reale,
                      e mosaicPanels() ripiega su maggiore x minore, che
                      equivale ad assumere l'oggetto allineato al sensore.

   Il motore riceveva quindi input diversi a seconda di chi lo chiamava. Questo
   file elimina la differenza replicando l'innesto, e nient'altro: non fonde i
   cataloghi, non tocca la fisica, non scrive niente su disco.

   Perche' a runtime e non in fase di build: data/openngc.json e' CC-BY-SA-4.0.
   Scrivere quei valori dentro catalog.json o targets.json li renderebbe
   plausibilmente opere derivate di un database ShareAlike, e la licenza si
   attaccherebbe a file che oggi sono proprietari. Tenendoli separati e
   innestando in memoria il problema non si pone.                            */

const fs=require('fs'), path=require('path');

/* La stessa normalizzazione dei nomi che usa l'app: senza, «NGC 6888» e
   «NGC6888» sarebbero due oggetti diversi. */
const norm=x=>String(x).toLowerCase().replace(/[\s_'’-]+/g,'');

/* Innesta magnitudine e angolo di posizione su un catalogo curato e su un
   insieme di schede. Modifica gli oggetti sul posto e restituisce il conto.
   Se openngc.json non c'e', non fa nulla e lo dichiara: e' un file opzionale,
   e nessuno strumento deve rompersi perche' manca. */
function enrich(TG,CAT,root){
  const p=path.join(root,'data','openngc.json');
  if(!fs.existsSync(p)) return {available:false,objects:0,catalog:0,targets:0};

  const O=JSON.parse(fs.readFileSync(p,'utf8'));
  const F=Object.fromEntries(O.fields.map((f,i)=>[f,i]));
  const src=new Map();
  for(const a of O.objects){
    const rec={mag:a[F.mag], pa_deg:a[F.pa_deg]};
    const nm=norm(a[F.name]);
    if(!src.has(nm)) src.set(nm,rec);
    for(const al of (a[F.aliases]||[])) { const k=norm(al); if(!src.has(k)) src.set(k,rec); }
  }

  /* Due innesti indipendenti: nessuno dei due fa da guardia all'altro, ed e'
     lo stesso difetto corretto in enrichTargets() nell'app. Chi ha gia' il
     dato se lo tiene — il curato vince sul dedotto, sempre. */
  const graft=(o,names)=>{
    let s=null;
    for(const nm of names){ if(nm==null) continue; s=src.get(norm(nm)); if(s) break; }
    if(!s) return false;
    let hit=false;
    if(o.pa_deg==null && s.pa_deg!=null){ o.pa_deg=s.pa_deg; hit=true; }
    if(o.mag==null    && s.mag!=null)   { o.mag=s.mag;       hit=true; }
    return hit;
  };

  let nc=0, nt=0;
  for(const o of (CAT||[])) if(graft(o,[o.name,...(o.aliases||[])])) nc++;
  for(const t of ((TG&&TG.targets)||[])) if(graft(t,t.names||[])) nt++;
  return {available:true,objects:O.objects.length,catalog:nc,targets:nt};
}

module.exports={enrich,norm};
