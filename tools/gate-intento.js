/* GATE — INTENZIONE DI COPERTURA
   ═══════════════════════════════════════════════════════════════════════════

   Il catalogo dice quanto e' grande il soggetto in cielo. Non dice che chi
   riprende voglia fotografarlo tutto. Prima di questo gate il motore lo dava
   per scontato: dall'ingombro catalogato ricavava i pannelli, e dai pannelli
   il costo del progetto — cosi' il Velo diventava ventiquattro campi anche per
   chi voleva soltanto il Pipistrello.

   Qui si verifica la separazione:

       ingombro del bersaglio     resta quello del catalogo, sempre
              |
       intenzione di copertura    completo / inquadratura
              |
       estensione del progetto    cio' che si e' scelto di riprendere
              |
       pannelli del progetto  ->  costo del progetto

   Le due domande — quanti campi vuole il SOGGETTO e quanti ne chiede il
   PROGETTO — restano entrambe risposte. La prima non sparisce mai: in
   inquadratura libera cambia ruolo, da preventivo a informazione.

   Il gate NON verifica la fotometria: quella e' delle 483 regressioni e di
   gate-copertura. Qui si guarda soltanto che l'intenzione entri nel conto dove
   deve e da nessun'altra parte.                                               */

const {M,DB,TG,CAT}=require('./lib/engine.js');

let ok=0, ko=0;
const chk=(what,cond,extra)=>{
  if(cond) { ok++; console.log('  ok   '+what+(extra?'   ['+extra+']':'')); }
  else     { ko++; console.log(' FAIL  '+what+(extra?'   ['+extra+']':'')); }
};
const H=t=>console.log('\n--- '+t+' ---');
const FULL='full', FRAME='framing';
const RANK=['pieno','ridotto','minimo','parziale','insufficiente'];
/* Le settimane di un bersaglio che non sale mai valgono Infinity, e
   `Infinity - Infinity` e' NaN: un confronto per differenza direbbe «diversi»
   proprio dove sono identici. Qui i non finiti si confrontano per identita'. */
const eq=(x,y,tol)=>{
  if(!isFinite(x)||!isFinite(y)) return x===y||(Number.isNaN(x)&&Number.isNaN(y));
  return Math.abs(x-y)<=(tol==null?1e-12:tol);
};

/* Sito e notte di riferimento: gli stessi di gate-copertura, perche' i due gate
   vanno letti insieme e confrontare numeri presi sotto cieli diversi non dice
   niente a nessuno. */
const site={lat:46.0167,lon:10.3333,sqm:20.8,seeing:1.6,rms:0.6,
  horizonMin:20,clearFrac:0.35};
site.fwhm=M.effFWHM(site.seeing,site.rms);
const np=M.nightProfile(new Date(2026,8,15),site.lat,site.lon);

const tgt=name=>{
  const o=CAT.objects.find(x=>x.name===name||(x.aliases||[]).includes(name));
  if(!o) throw new Error('bersaglio assente dal catalogo: '+name);
  return M.synthTarget(o,o.archetype);
};
const cfg=(tel,red,cam,bin)=>M.derive({tel,red,cam,mnt:'cem70g',bin:bin||1});

const RC8   = cfg('rc8','0.80','asi2600mm');
const TECNO = cfg('tecnosky115','0.80','asi2600mm');
const ASKAR = cfg('askar71f','1','asi2600mm');

/* Una prescrizione completa sotto una data intenzione. `hours` sono le ore
   DISPONIBILI, che non cambiano con l'intenzione: il tempo di chi riprende e'
   suo, e' l'obiettivo che cambia. */
const run=(t,dv,hours,cov)=>{
  const e=M.evaluate(t,dv,site,np,{},cov);
  const pp=M.projectPanels(t,dv,cov,0);
  const pr=M.prescribe(e,hours,dv,pp.panels);
  return {e,pp,pr};
};

// ═══════════════════════════════════════════════════════════════════════════
H('A · il bersaglio non viene mai falsificato');
// ═══════════════════════════════════════════════════════════════════════════
/* Il difetto che questa modifica NON deve introdurre: rimpicciolire il soggetto
   per farlo stare nel campo. L'ingombro catalogato e' un dato astronomico e
   resta identico sotto entrambe le intenzioni. */
{
  const velo=tgt('NGC 6960');
  const before=JSON.stringify(velo.size_arcmin);
  const pf=M.projectPanels(velo,RC8,FULL,0);
  const pr=M.projectPanels(velo,RC8,FRAME,0);
  chk('l\'ingombro catalogato non cambia con l\'intenzione',
    JSON.stringify(velo.size_arcmin)===before, before);
  chk('i pannelli del SOGGETTO sono gli stessi nelle due modalita\'',
    pf.targetPanels===pr.targetPanels, pf.targetPanels+' = '+pr.targetPanels);
  chk('cambia solo quelli del PROGETTO',
    pf.panels===pf.targetPanels && pr.panels===1,
    'completo '+pf.panels+' · inquadratura '+pr.panels);
  chk('l\'inquadratura si dichiara limitata solo se il soggetto eccede',
    pr.limited===true && pf.limited===false);
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · TEST 1 — bersaglio che sta in un campo: le due modalita\' coincidono');
// ═══════════════════════════════════════════════════════════════════════════
/* Il caso che deve restare immobile. Se l'intenzione cambiasse qualcosa qui,
   avrebbe smesso di essere una domanda sulla geometria e sarebbe diventata un
   moltiplicatore travestito. */
for(const [nome,dv] of [['M57 · RC8',RC8],['M27 · RC8',RC8],['M57 · Tecnosky',TECNO]]){
  const t=tgt(nome.split(' ·')[0]);
  const a=run(t,dv,20,FULL), b=run(t,dv,20,FRAME);
  chk(nome+': un pannello in entrambe',
    a.pp.panels===1 && b.pp.panels===1);
  chk(nome+': stesso livello di prescrizione',
    a.pr.level===b.pr.level, a.pr.level);
  chk(nome+': stesse ore spese, alla cifra',
    Math.abs(a.pr.spent-b.pr.spent)<1e-9, a.pr.spent.toFixed(4)+' h');
  chk(nome+': stesso costo di progetto',
    Math.abs(a.pr.roadTotalsProject.ideal-b.pr.roadTotalsProject.ideal)<1e-9,
    a.pr.roadTotalsProject.ideal.toFixed(2)+' h');
  chk(nome+': nessuna delle due si dichiara limitata',
    a.pp.limited===false && b.pp.limited===false);
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · TEST 2 — soggetto grande in copertura completa: il mosaico si paga');
// ═══════════════════════════════════════════════════════════════════════════
{
  const velo=tgt('NGC 6960');
  const f=run(velo,RC8,27,FULL);
  chk('il Velo su RC8 chiede piu\' di un campo', f.pp.targetPanels>1, f.pp.targetPanels+' pannelli');
  chk('il progetto li paga tutti', f.pr.panels===f.pp.targetPanels);
  chk('il costo di progetto e' + String.fromCharCode(39) + ' un campo moltiplicato per i pannelli',
    eq(f.pr.roadTotalsProject.ideal, f.e.roadH*f.pr.panels, 1e-9),
    f.e.roadH.toFixed(2)+' x '+f.pr.panels+' = '+f.pr.roadTotalsProject.ideal.toFixed(2)+' h');
  /* La relazione che conta davvero: il totale di progetto e' il per-campo
     moltiplicato per i pannelli, e non c'e' nessun altro fattore in mezzo. */
  chk('spentTotal == spent × pannelli',
    Math.abs(f.pr.spentTotal - f.pr.spent*f.pr.panels)<1e-9,
    f.pr.spent.toFixed(2)+' × '+f.pr.panels+' = '+f.pr.spentTotal.toFixed(2)+' h');
  chk('le ore disponibili si dividono fra i pannelli',
    Math.abs(f.pr.hours - f.pr.hoursTotal/f.pr.panels)<1e-9,
    f.pr.hoursTotal+' h / '+f.pr.panels+' = '+f.pr.hours.toFixed(2)+' h per campo');
  /* Il Velo di catalogo e' il filamento occidentale, 70' x 6': due pannelli su
     RC8. Bastano a provare il meccanismo, non a provarlo sotto carico. M31 sulla
     stessa ottica ne chiede molti di piu', ed e' li' che si vede se il costo di
     progetto regge davvero. */
  const m31=tgt('M31');
  const g2=run(m31,RC8,27,FULL);
  chk('M31 su RC8 chiede un mosaico serio', g2.pp.targetPanels>=8,
    g2.pp.targetPanels+' pannelli');
  chk('e con 27 h il progetto completo non ci sta',
    g2.pr.roadTotalsProject.ideal>27,
    g2.pr.roadTotalsProject.ideal.toFixed(0)+' h per '+g2.pp.targetPanels+' campi');
  chk('anche sotto carico spentTotal resta spent per i pannelli',
    eq(g2.pr.spentTotal, g2.pr.spent*g2.pr.panels, 1e-9));
  /* Anche qui la strada cambia — con 27 h su un campo invece di 1,8 il motore
     puo' permettersi molto di piu' — quindi il costo di un campo in inquadratura
     non e' il quindicesimo esatto del progetto completo. Cio' che deve valere e'
     che il progetto costi meno, che i campi siano uno, e che nessun campo riceva
     meno ore di prima. */
  const h2=run(m31,RC8,27,FRAME);
  chk('in inquadratura libera M31 e un campo solo', h2.pr.panels===1);
  chk('e il progetto costa molto meno del mosaico completo',
    h2.pr.roadTotalsProject.ideal < g2.pr.roadTotalsProject.ideal/2,
    g2.pr.roadTotalsProject.ideal.toFixed(0)+' h -> '+h2.pr.roadTotalsProject.ideal.toFixed(1)+' h');
  chk('con tutte le ore concentrate su quel campo',
    h2.pr.hours>g2.pr.hours,
    g2.pr.hours.toFixed(1)+' h -> '+h2.pr.hours.toFixed(1)+' h per campo');
  chk('e un livello non peggiore',
    RANK.indexOf(h2.pr.level)<=RANK.indexOf(g2.pr.level),
    g2.pr.level+' -> '+h2.pr.level);
  chk('senza perdere quanti campi vorrebbe il soggetto',
    h2.pp.targetPanels===g2.pp.targetPanels, h2.pp.targetPanels+' riquadri');
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · TEST 3 — soggetto grande in inquadratura libera: si paga un campo');
// ═══════════════════════════════════════════════════════════════════════════
/* Il test principale. */
{
  const velo=tgt('NGC 6960');
  const f=run(velo,RC8,27,FULL), g=run(velo,RC8,27,FRAME);
  chk('il progetto e\' un campo solo', g.pr.panels===1, '1 di '+g.pp.targetPanels);
  chk('il costo NON e\' moltiplicato per i pannelli del soggetto',
    g.pr.roadTotalsProject.ideal < f.pr.roadTotalsProject.ideal,
    'inquadratura '+g.pr.roadTotalsProject.ideal.toFixed(1)+
    ' h vs completo '+f.pr.roadTotalsProject.ideal.toFixed(1)+' h');
  chk('ed e\' esattamente il costo di un campo del progetto completo',
    Math.abs(g.pr.roadTotalsProject.ideal - f.pr.roadTotalsProject.ideal/f.pr.panels)<1e-9);
  chk('le ore disponibili restano intere: non si dividono',
    Math.abs(g.pr.hours-g.pr.hoursTotal)<1e-9, g.pr.hours.toFixed(1)+' h');
  chk('il livello raggiunto non peggiora passando all\'inquadratura',
    ['pieno','ridotto','minimo','parziale','insufficiente'].indexOf(g.pr.level) <=
    ['pieno','ridotto','minimo','parziale','insufficiente'].indexOf(f.pr.level),
    f.pr.level+' -> '+g.pr.level);
  /* L'informazione non si perde: e' la richiesta esplicita di chi ha commissionato
     la modifica, ed e' la ragione per cui `targetPanels` sopravvive nel risultato. */
  chk('il motore sa ancora quanti campi vorrebbe il soggetto intero',
    g.pp.targetPanels>1 && g.pr.targetPanels>1,
    'soggetto completo: '+g.pp.targetPanels+' riquadri');
  chk('e dichiara di essere in inquadratura limitata',
    g.pp.limited===true && g.pr.coverage==='framing');
  /* La fotometria del singolo campo non e' toccata: e' la stessa grandezza sotto
     entrambe le intenzioni, ed e' cio' che tiene separate profondita' e copertura. */
  chk('la profondita\' del singolo campo e\' la stessa fisica',
    Math.abs(f.pr.roadTotalsProject.ideal/f.pr.panels -
             g.pr.roadTotalsProject.ideal/g.pr.panels)<1e-9);
}

// ═══════════════════════════════════════════════════════════════════════════
H('E · TEST 4 — confronto fra strumenti: l\'obiettivo cambia la classifica');
// ═══════════════════════════════════════════════════════════════════════════
/* Un tubo a campo largo e uno a campo stretto non rispondono alla stessa
   domanda. Che le due classifiche possano divergere non e' un effetto
   collaterale: e' il comportamento voluto. */
{
  const velo=tgt('NGC 6960');
  const cur={tel:'tecnosky115',red:'0.80',cam:'asi2600mm',mnt:'cem70g',bin:1};
  const aF=M.fitAlternatives(velo,cur,site,np,{},27,DB.presets,6,0,FULL);
  const aG=M.fitAlternatives(velo,cur,site,np,{},27,DB.presets,6,0,FRAME);
  chk('la copertura completa produce candidati', aF.length>0, aF.length+' candidati');
  chk('l\'inquadratura libera produce candidati', aG.length>0, aG.length+' candidati');
  chk('ogni candidato dichiara la propria intenzione',
    aF.every(x=>x.coverage===FULL) && aG.every(x=>x.coverage===FRAME));
  chk('ogni candidato dichiara i pannelli del SOGGETTO con la propria ottica',
    aG.every(x=>x.targetPanels>=1));
  chk('in inquadratura libera nessun candidato paga il mosaico',
    aG.every(x=>x.panels===1));
  chk('in copertura completa i candidati pagano la propria geometria',
    aF.every(x=>x.panels===x.targetPanels));
  /* Il costo di progetto del campo stretto crolla quando non deve piu' coprire
     tutto: e' esattamente il caso dell'RC8 sul Pipistrello. */
  /* Lo STESSO candidato nelle due classifiche, non il primo RC8 dell'una contro
     il primo dell'altra: possono essere configurazioni diverse, e il confronto
     non direbbe niente. */
  const key=x=>x.preset.id+'|'+x.bin;
  const mF=new Map(aF.map(x=>[key(x),x])), mG=new Map(aG.map(x=>[key(x),x]));
  const comuni=[...mF.keys()].filter(k=>mG.has(k));
  chk('le due classifiche condividono candidati confrontabili', comuni.length>0,
    comuni.length+' configurazioni in comune');
  /* ATTENZIONE a cosa si puo' pretendere qui. Verrebbe da scrivere «in
     inquadratura libera nessun candidato costa di piu'», e sarebbe sbagliato:
     `projectH` e' il costo IDEALE DELLA STRADA SCELTA, e la strada la sceglie
     prescribe() in base alle ore che restano a ciascun campo. Concentrando 27 h
     su un campo solo invece di dividerle fra due, l'RC8 passa da HOO a SHO —
     una tecnica piu' ricca, che costa di piu' e da' un'immagine migliore. Il
     costo che sale e' il segno che la modifica funziona, non che regredisce.

     Le invarianti vere sono altre tre. */
  let sameRoad=0, richer=0;
  for(const k of comuni){
    const x=mF.get(k), y=mG.get(k);
    chk('  '+k+': in inquadratura il progetto e un campo solo', y.panels===1);
    chk('  '+k+': ogni campo riceve almeno le ore che riceveva prima',
      y.pr.hours>=x.pr.hours-1e-9,
      x.pr.hours.toFixed(1)+' h -> '+y.pr.hours.toFixed(1)+' h per campo');
    chk('  '+k+': il livello raggiunto non peggiora',
      RANK.indexOf(y.pr.level)<=RANK.indexOf(x.pr.level),
      x.pr.level+' -> '+y.pr.level);
    if(x.pr.road.id===y.pr.road.id){
      sameRoad++;
      chk('  '+k+': stessa strada ('+x.pr.road.id+'), il costo si divide per i pannelli',
        eq(y.projectH, x.projectH/x.targetPanels, 1e-9),
        x.projectH.toFixed(1)+' h -> '+y.projectH.toFixed(1)+' h su '+x.targetPanels+' campi');
    } else {
      richer++;
      chk('  '+k+': strada migliore ('+x.pr.road.id+' -> '+y.pr.road.id+'), resa possibile dalle ore concentrate',
        y.pr.hours>x.pr.hours,
        x.projectH.toFixed(1)+' h -> '+y.projectH.toFixed(1)+' h');
    }
  }
  chk('almeno un candidato mantiene la strada e dimezza il costo', sameRoad>0,
    sameRoad+' a strada invariata, '+richer+' promossi a una strada piu ricca');
  chk('le due classifiche non sono obbligate a coincidere',
    true, 'completo: '+aF.slice(0,3).map(x=>x.preset.id).join(', ')+
          '  ·  inquadratura: '+aG.slice(0,3).map(x=>x.preset.id).join(', '));
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · TEST 5 — nessuna variazione fotometrica sui bersagli a campo singolo');
// ═══════════════════════════════════════════════════════════════════════════
/* La rete piu' larga: tutto il catalogo. Per ogni oggetto che entra in un campo,
   le due intenzioni devono dare lo stesso identico risultato — non simile, lo
   stesso. E' l'invariante che rende questa una domanda e non un moltiplicatore. */
{
  let n=0, uguali=0, diversi=[];
  for(const o of CAT.objects.slice(0,90)){
    let t; try{ t=M.synthTarget(o,o.archetype); }catch(err){ continue; }
    if(!t||!t.budget||!Object.keys(t.budget).length) continue;
    const pp=M.projectPanels(t,TECNO,FULL,0);
    if(pp.targetPanels!==1) continue;          // qui interessano i campi singoli
    n++;
    const a=run(t,TECNO,15,FULL), b=run(t,TECNO,15,FRAME);
    const same = a.pr.level===b.pr.level
      && eq(a.pr.spent,b.pr.spent,1e-9)
      && eq(a.e.roadH,b.e.roadH,1e-9)
      && eq(a.e.weeks,b.e.weeks)
      && eq(a.e.nights,b.e.nights)
      && eq(a.e.score,b.e.score)
      && eq(a.pr.roadTotalsProject.ideal,b.pr.roadTotalsProject.ideal,1e-9);
    if(same) uguali++; else diversi.push(o.name);
  }
  chk('il campione contiene abbastanza bersagli a campo singolo', n>=20, n+' oggetti');
  chk('per tutti, le due intenzioni danno risultati identici',
    diversi.length===0, diversi.length?diversi.slice(0,6).join(', '):n+'/'+n+' identici');
}

// ═══════════════════════════════════════════════════════════════════════════
H('G · l\'intenzione non tocca nulla che non sia il conto del progetto');
// ═══════════════════════════════════════════════════════════════════════════
{
  const velo=tgt('NGC 6960');
  const a=run(velo,RC8,27,FULL), b=run(velo,RC8,27,FRAME);
  chk('le ore per canale del singolo campo non cambiano',
    Math.abs(a.e.roadH-b.e.roadH)<1e-9, a.e.roadH.toFixed(3)+' h');
  chk('il campionamento non cambia', a.e.samp.k===b.e.samp.k, a.e.samp.k);
  chk('l\'inquadratura geometrica non cambia',
    Math.abs(a.e.fit.r-b.e.fit.r)<1e-12);
  chk('la banda critica non cambia', a.e.critBand===b.e.critBand, a.e.critBand);
  chk('le ore utili per notte non cambiano',
    eq(a.e.perNight,b.e.perNight));
  /* Cambia invece cio' che deve cambiare: quante notti serve tenerlo. */
  chk('cambiano le settimane, perche\' cambia il progetto',
    a.e.weeks>b.e.weeks, a.e.weeks.toFixed(1)+' -> '+b.e.weeks.toFixed(1)+' settimane');
}

// ═══════════════════════════════════════════════════════════════════════════
H('H · valori di default e ingressi malformati');
// ═══════════════════════════════════════════════════════════════════════════
{
  const velo=tgt('NGC 6960');
  const base=M.projectPanels(velo,RC8,FULL,0);
  for(const [nome,v] of [['assente',undefined],['nullo',null],['stringa ignota','boh'],
                         ['vuota',''],['numero',3],['maiuscolo','FRAMING']]){
    const p=M.projectPanels(velo,RC8,v,0);
    chk('intenzione '+nome+' ricade su copertura completa',
      p.intent===FULL && p.panels===base.targetPanels, p.intent);
  }
  chk('solo la stringa esatta attiva l\'inquadratura',
    M.projectPanels(velo,RC8,FRAME,0).intent===FRAME);
  chk('evaluate() senza intenzione si comporta come copertura completa',
    M.evaluate(velo,RC8,site,np,{}).panels===base.targetPanels);
  chk('le costanti esportate sono quelle usate',
    M.COV_FULL===FULL && M.COV_FRAMING===FRAME);
}

console.log('\n'+(ko?'\x1b[31m':'\x1b[32m')+ok+' verifiche superate, '+ko+' fallite\x1b[0m');
process.exit(ko?1:0);
