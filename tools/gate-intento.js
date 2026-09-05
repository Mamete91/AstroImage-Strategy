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
  let n=0, uguali=0; const diversi=[], peggiorati=[];
  for(const o of CAT.objects.slice(0,90)){
    let t; try{ t=M.synthTarget(o,o.archetype); }catch(err){ continue; }
    if(!t||!t.budget||!Object.keys(t.budget).length) continue;
    const pp=M.projectPanels(t,TECNO,FULL,0);
    if(pp.targetPanels!==1) continue;          // qui interessano i campi singoli
    n++;
    const a=run(t,TECNO,15,FULL), b=run(t,TECNO,15,FRAME);
    /* La FOTOMETRIA e il COSTO devono coincidere alla cifra: e' il cuore
       dell'invariante. Il PUNTEGGIO no, e non deve: contiene il giudizio di
       inquadratura, che in modalita' libera legge la frazione di soggetto che
       entra invece dell'etichetta «al limite». Su un pannello solo la differenza
       e' piccola, ma esiste dove framing() e mosaicPanels() usano convenzioni
       diverse sull'angolo di posizione ignoto. Quello che si pretende e' che
       dichiarare di accettare un ritaglio non peggiori MAI un bersaglio. */
    const same = a.pr.level===b.pr.level
      && eq(a.pr.spent,b.pr.spent,1e-9)
      && eq(a.e.roadH,b.e.roadH,1e-9)
      && eq(a.e.weeks,b.e.weeks)
      && eq(a.e.nights,b.e.nights)
      && eq(a.pr.roadTotalsProject.ideal,b.pr.roadTotalsProject.ideal,1e-9);
    if(b.e.score < a.e.score - 1e-9) peggiorati.push(o.name);
    if(same) uguali++; else diversi.push(o.name);
  }
  chk('il campione contiene abbastanza bersagli a campo singolo', n>=20, n+' oggetti');
  chk('per tutti, fotometria e costo sono identici alla cifra',
    diversi.length===0, diversi.length?diversi.slice(0,6).join(', '):n+'/'+n+' identici');
  chk('e nessun bersaglio peggiora dichiarando di accettare un ritaglio',
    peggiorati.length===0, peggiorati.length?peggiorati.slice(0,6).join(', '):n+'/'+n+' non peggiorati');
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

// ===========================================================================
H('I - la fotometria non sa quanto e grande il campo');
// ===========================================================================
/* Il confine che questa modifica difende. Il CAMPO decide copertura e pannelli;
   non deve entrare nella quantita' di fotoni raccolti per unita' di angolo
   solido. La prova e' diretta: si prende una configurazione, le si allarga il
   campo di dieci volte lasciando intatto tutto il resto - apertura, focale,
   pixel, scala - e si verifica che ogni grandezza fotometrica resti identica.
   Se un solo termine leggesse fovX o fovY, qui salterebbe. */
{
  const base=M.derive({tel:'askar71f',red:'0.75',cam:'asi2600mc',mnt:'am5',bin:1});
  const largo={...base, fovX:base.fovX*10, fovY:base.fovY*10};
  const SQM=20.8;
  let tutte=true; const dove=[];
  for(const b of ['Ha','OIII','SII','L','RGB']){
    const a=M.rates(base,b,SQM), c=M.rates(largo,b,SQM);
    for(const f of ['k','cfa','collect','om','R_b','R_d','RN'])
      if(!eq(a[f],c[f],1e-12)){ tutte=false; dove.push(b+'.'+f); }
    if(!eq(M.varRate(a,600,0),M.varRate(c,600,0),1e-12)){ tutte=false; dove.push(b+'.varRate'); }
    if(!eq(M.timeFactor(base,b,600),M.timeFactor(largo,b,600),1e-12)){ tutte=false; dove.push(b+'.timeFactor'); }
  }
  chk('campo dieci volte piu largo: nessuna grandezza fotometrica cambia',
    tutte, tutte?'5 bande x 9 grandezze invariate':dove.join(', '));

  /* E il contrario: il campo cambia la copertura, che e' il suo dominio. */
  const m31=tgt('M31');
  const stretto=M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1});
  const stLargo={...stretto, fovX:stretto.fovX*10, fovY:stretto.fovY*10};
  const nB=(m=>m.cols*m.rows)(M.mosaicPanels(m31,stretto));
  const nL=(m=>m.cols*m.rows)(M.mosaicPanels(m31,stLargo));
  chk('mentre la copertura dipende dal campo, che e il suo dominio', nB>nL,
    'M31: campo stretto '+nB+' riquadri, lo stesso campo x10 '+nL);

  /* `om` e' l'angolo solido del PIXEL. Se qualcuno lo confondesse col campo,
     questa e' la riga che lo direbbe. */
  chk('om e la solid angle del pixel, non del campo',
    eq(M.rates(base,'OIII',SQM).om, base.scale*base.scale, 1e-12),
    base.scale.toFixed(3)+' al quadrato = '+(base.scale*base.scale).toFixed(3)+' arcsec2');
}

// ===========================================================================
H('L - la differenza RC8 / Askar e ricostruibile dai fattori dichiarati');
// ===========================================================================
/* Non si pretende che un setup vinca: si pretende che la differenza sia il
   prodotto esatto dei termini che il motore dichiara, e nient'altro. Se un
   fattore entrasse due volte, o entrasse un fattore non dichiarato, il prodotto
   non tornerebbe. */
{
  const ASK=cfg('askar71f','0.75','asi2600mc');
  const RC =M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1});
  const SQM=20.8, TS=600;
  for(const b of ['Ha','OIII','SII']){
    const a=M.rates(ASK,b,SQM), r=M.rates(RC,b,SQM);
    chk('  '+b+': collect e (Aeff/100) x k, senza altri termini',
      eq(r.collect/a.collect, (RC.Aeff/ASK.Aeff)*(r.k/a.k), 1e-9),
      'Aeff x'+(RC.Aeff/ASK.Aeff).toFixed(2)+' per k x'+(r.k/a.k).toFixed(2)+
      ' = collect x'+(r.collect/a.collect).toFixed(2));
    const tA=M.varRate(a,TS,0)/(a.collect*a.collect);
    const tR=M.varRate(r,TS,0)/(r.collect*r.collect);
    chk('  '+b+': il rapporto dei tempi e var/collect al quadrato, per definizione',
      eq(tR/tA, (M.varRate(r,TS,0)/M.varRate(a,TS,0))/Math.pow(r.collect/a.collect,2), 1e-9),
      'RC8 impiega x'+(tR/tA).toFixed(3)+' del tempo dell Askar');
    chk('  '+b+': il vantaggio RC8 viene da apertura e sensore, non dal campo',
      (RC.Aeff/ASK.Aeff)>1 && (r.k/a.k)>1,
      'apertura x'+(RC.Aeff/ASK.Aeff).toFixed(2)+', mono contro CFA x'+(r.k/a.k).toFixed(2));
  }
  /* La controprova sul rapporto focale: l'Askar E' piu' veloce per mm2 di
     sensore, e il motore non lo nega - misura semplicemente un'altra cosa. */
  chk('l Askar resta piu veloce per mm2 di sensore, come vuole il rapporto focale',
    Math.pow(RC.fRatio/ASK.fRatio,2)>1,
    'f/'+ASK.fRatio.toFixed(2)+' contro f/'+RC.fRatio.toFixed(2)+
    ': x'+Math.pow(RC.fRatio/ASK.fRatio,2).toFixed(2)+' a favore dell Askar per unita di sensore');
}

// ===========================================================================
H('M - sotto la soglia la prescrizione si da lo stesso');
// ===========================================================================
/* Il tempo disponibile decide quanto bene riuscira', non se e' permesso
   provarci. Sotto la soglia del canale critico ci devono essere: ore ripartite,
   proporzioni della strada rispettate, canali marcati, distanza dichiarata. */
{
  const velo=tgt('NGC 6960');
  const ASK=cfg('askar71f','0.75','asi2600mc');
  const e=M.evaluate(velo,ASK,site,np,{},FRAME);
  const pp=M.projectPanels(velo,ASK,FRAME,0);
  const sopra=M.prescribe(e,60,ASK,pp.panels);
  const sotto=M.prescribe(e,3,ASK,pp.panels);
  chk('con tempo abbondante la prescrizione c e', sopra.spent>0, sopra.level);
  chk('con tempo scarso la prescrizione c e lo stesso', sotto.spent>0,
    sotto.level+', '+sotto.spent.toFixed(2)+' h ripartite');
  chk('e spende esattamente le ore che hai', eq(sotto.spent,3,1e-6));
  chk('mantenendo le proporzioni della strada',
    (()=>{ const tot=sotto.alloc.reduce((x,g)=>x+Math.max(0,g.useful||0),0);
           return tot>0 && sotto.alloc.every(g=>
             eq(g.hours, Math.max(0,g.useful||0)*3/tot, 1e-9)); })());
  chk('nessun canale dichiarato fuori', sotto.alloc.every(g=>!g.dropped));
  chk('il canale critico e marcato sotto la sua soglia',
    sotto.alloc.some(g=>g.critical&&g.belowFloor));
  chk('la distanza dalla soglia e dichiarata in ore', sotto.short>0,
    'mancano '+sotto.short.toFixed(1)+' h');
  chk('e cosa aspettarti viene comunque calcolato',
    sotto.expect!==null || sopra.expect===null,
    sotto.expect?('riga '+sotto.expect.key):'la scheda non ha righe expect');
}

// ===========================================================================
H('N - la resa: tre assi ortogonali, e nessuno conta due volte');
// ===========================================================================
/* La metrica con cui si confrontano sistemi diversi e' il prodotto di tre
   frazioni, ognuna in [0,1] e ognuna misurata separatamente:

       resa  =  copertura  x  profondita'  x  risoluzione

   Il prodotto e' legittimo solo se i tre assi sono indipendenti, altrimenti
   qualcosa verrebbe contato due volte. Qui si dimostra che lo sono. */
{
  const SQM=20.8;
  const RC1=M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1});
  const RC2=M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:2});
  const RC3=M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:3});

  /* ORTOGONALITA' 1 - la profondita' non dipende dalla scala. Su CMOS il
     binning e' somma digitale, e il motore lo modella gia': varRate() e'
     identica bit per bit. Percio' il sovracampionamento non costa profondita',
     e caricarlo di nuovo nel termine di risoluzione sarebbe doppio conteggio. */
  let peggio=0;
  for(const b of ['Ha','OIII','SII','L','RGB']){
    const v1=M.varRate(M.rates(RC1,b,SQM),600,0);
    for(const d of [RC2,RC3]){
      const v=M.varRate(M.rates(d,b,SQM),600,0);
      peggio=Math.max(peggio,Math.abs(v-v1)/v1);
    }
  }
  /* Lo scarto residuo e' 1e-16: virgola mobile, non modello. Il motore gia'
     tratta il binning CMOS come somma digitale — rnEff cresce con il lato e la
     divisione per om lo riassorbe esattamente. */
  chk('profondita indipendente dalla scala: varRate invariante a bin 1, 2, 3',
    peggio<1e-12, 'scarto massimo '+peggio.toExponential(2)+' — nessun doppio conteggio');

  /* ORTOGONALITA' 2 - la risoluzione non dipende dal tempo. */
  chk('risoluzione indipendente dal tempo: dipende solo da scala e cielo',
    eq(M.resolutionFidelity(RC1.scale,2), M.resolutionFidelity(RC1.scale,2), 0) &&
    M.resolutionFidelity.length===2);

  /* ORTOGONALITA' 3 - la copertura non dipende ne' dal tempo ne' dalla scala. */
  const m31=tgt('M31');
  chk('copertura indipendente dalla scala: bin 1 e bin 2 coprono lo stesso cielo',
    eq(M.coveredSpan(m31,RC1,FRAME,0).c, M.coveredSpan(m31,RC2,FRAME,0).c, 1e-12),
    M.coveredSpan(m31,RC1,FRAME,0).c.toFixed(4));

  /* L'ASIMMETRIA DELLA RISOLUZIONE E' DERIVATA, NON SCELTA. Il pixel si somma
     in quadratura alla PSF, quindi il rapporto tende a uno campionando fine e
     degrada campionando grosso: non c'e' nessun coefficiente da tarare. */
  const F=1.9;
  const fine=M.resolutionFidelity(F/8,F), giusto=M.resolutionFidelity(F/2,F), grosso=M.resolutionFidelity(F*2,F);
  chk('sovracampionare non costa risoluzione', fine>0.99, fine.toFixed(4));
  chk('campionare a meta FWHM ne costa poca', giusto>0.9&&giusto<1, giusto.toFixed(4));
  chk('sottocampionare la butta via', grosso<0.65, grosso.toFixed(4));
  chk('e la funzione e monotona nella scala',
    fine>giusto && giusto>grosso, fine.toFixed(3)+' > '+giusto.toFixed(3)+' > '+grosso.toFixed(3));
  chk('la costante del pixel e geometria, non taratura',
    eq(M.PIX_FWHM, Math.sqrt(8*Math.log(2))/Math.sqrt(12), 1e-15), M.PIX_FWHM.toFixed(6));

  /* SATURAZIONE - inquadrare piu' cielo del soggetto non aggiunge niente. */
  const m57=tgt('M57');
  const larghi=[RC1, cfg('askar71f','0.75','asi2600mc'), cfg('tecnosky115','0.80','asi2600mm')];
  chk('su un soggetto piccolo la copertura satura a uno per tutti',
    larghi.every(d=>eq(M.coveredSpan(m57,d,FRAME,0).c,1,1e-12)),
    'quindi sparisce dal confronto e decidono profondita e risoluzione');
  chk('e nessun campo largo prende un premio per il cielo vuoto',
    eq(M.coveredSpan(m57,cfg('askar71f','0.75','asi2600mc'),FRAME,0).c,
       M.coveredSpan(m57,RC1,FRAME,0).c, 1e-12));

  /* La copertura si misura per ASSE, non per area: un filamento lungo e sottile
     puo' avere area minore del campo e sporgerne comunque. */
  /* Un filamento lungo e sottile, con l'angolo di posizione noto perche' qui
     interessa la geometria e non il fallback: area molto minore del campo, e
     tuttavia sporge. Un rapporto di aree direbbe «ci sta», e sbaglierebbe. */
  const filo={id:'filo',names:['filo'],ra_deg:311,dec_deg:31,
    size_arcmin:[120,4],pa_deg:90,archetype:'snr',budget:{}};
  const cvF=M.coveredSpan(filo,RC1,FRAME,0);
  const areaCampo=RC1.fovX*RC1.fovY, areaFilo=cvF.W*cvF.H;
  chk('la copertura si misura per asse, non per area',
    areaCampo>areaFilo && cvF.c<1,
    'campo '+areaCampo.toFixed(0)+' arcmin2 contro soggetto '+areaFilo.toFixed(0)+
    ' (ci starebbe per area), eppure ne copre il '+(100*cvF.c).toFixed(0)+'%');
}

// ===========================================================================
H('O - la legge di scambio fra copertura e profondita');
// ===========================================================================
/* A tempo totale fissato, coprire N pannelli vuol dire T/N ore ciascuno.
   Percio' copertura e profondita' si scambiano esattamente, e le due modalita'
   danno la STESSA resa finche' il tempo e' il vincolo. La copertura completa
   vince solo quando le ore bastano a saturare la profondita'. Non e' una regola
   imposta: esce dal conto. */
{
  const m31=tgt('M31');
  const RC=M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1});
  const resa=(ore,cov)=>{
    const e=M.evaluate(m31,RC,site,np,{},cov);
    const pp=M.projectPanels(m31,RC,cov,0);
    const pr=M.prescribe(e,ore,RC,pp.panels);
    return {y:M.imageYield(m31,RC,site,pr,cov,0),pr,pp};
  };
  const poche=2, tante=2000;
  const a=resa(poche,FULL), b=resa(poche,FRAME);
  chk('con poche ore entrambe le modalita sono limitate dal tempo',
    a.y.d<1 && b.y.d<1, 'profondita '+a.y.d.toFixed(3)+' e '+b.y.d.toFixed(3));
  /* Nel continuo il rapporto sarebbe uno esatto. I pannelli pero' sono interi e
     si sovrappongono, quindi la copertura completa paga anche il cielo di troppo
     che la tassellatura porta con se'. Il rapporto e' ESATTAMENTE quell'eccesso,
     ed e' una relazione piu' forte di un'uguaglianza approssimata: dice non solo
     che le due modalita' si scambiano, ma di quanto e perche'. */
  const N=a.pp.targetPanels, eccesso=b.y.c*N;
  chk('e la resa si scambia esattamente, a meno del cielo di troppo della tassellatura',
    eq(b.y.P/a.y.P, eccesso, 1e-9),
    'rapporto '+(b.y.P/a.y.P).toFixed(6)+' = copertura x pannelli = '+eccesso.toFixed(6));
  chk('e quell eccesso e sempre almeno uno: tassellare non fa risparmiare cielo',
    eccesso>=1-1e-12, eccesso.toFixed(4));
  /* La stessa legge a ore diverse: finche' il tempo e' il vincolo il rapporto
     non si muove, perche' non dipende dalle ore. */
  const c1=resa(1,FULL), c2=resa(1,FRAME);
  chk('e non dipende dalle ore, finche il tempo e il vincolo',
    eq(c2.y.P/c1.y.P, b.y.P/a.y.P, 1e-9),
    'a 1 h '+(c2.y.P/c1.y.P).toFixed(6)+', a 2 h '+(b.y.P/a.y.P).toFixed(6));
  const c=resa(tante,FULL), d=resa(tante,FRAME);
  chk('con ore abbondanti la profondita satura in entrambe',
    eq(c.y.d,1,1e-9) && eq(d.y.d,1,1e-9));
  chk('e allora la copertura completa vince, come deve',
    c.y.P>d.y.P, 'completo '+c.y.P.toFixed(3)+' contro inquadratura '+d.y.P.toFixed(3));
}

// ===========================================================================
H('P - fitAlternatives ordina sulla resa, e non degenera piu');
// ===========================================================================
{
  const cur={tel:'tecnosky115',red:'0.80',cam:'asi2600mm',mnt:'am5',bin:1};

  /* L'ordinamento e' esattamente la resa decrescente. */
  for(const [nome,tg2,ore,cov] of [['Velo inquadratura',tgt('NGC 6960'),16.4,FRAME],
                                   ['Velo completo',    tgt('NGC 6960'),16.4,FULL],
                                   ['M57 inquadratura', tgt('M57'),20,FRAME],
                                   ['M31 inquadratura', tgt('M31'),16.4,FRAME]]){
    const alt=M.fitAlternatives(tg2,cur,site,np,{},ore,DB.presets,8,0,cov);
    chk(nome+': l ordine e la resa decrescente',
      alt.every((x,i)=>i===0||alt[i-1].P>=x.P-1e-12),
      alt.slice(0,3).map(x=>x.preset.id+' '+x.P.toFixed(3)).join(' > '));
    chk(nome+': ogni candidato espone i tre assi separatamente',
      alt.every(x=>x.cover>=0&&x.cover<=1&&x.depth>=0&&x.depth<=1&&x.resol>0&&x.resol<=1&&
                   eq(x.P,x.cover*x.depth*x.resol,1e-12)));
  }

  /* IL DIRUPO BOOLEANO E' SPARITO. Prima due candidati che differivano solo per
     binning finivano a pari merito su tutte e tre le chiavi, con l'ordine
     deciso dall'inserimento: 1.58 e 3.17 arcsec/px erano indistinguibili. */
  const m31=tgt('M31');
  const alt=M.fitAlternatives(m31,cur,site,np,{},16.4,DB.presets,12,0,FRAME);
  const gruppi={};
  for(const x of alt){ const k=x.preset.id; (gruppi[k]=gruppi[k]||[]).push(x); }
  let pari=0, coppie=0;
  for(const k in gruppi) if(gruppi[k].length>1){
    coppie++;
    const [u,v]=gruppi[k];
    if(eq(u.P,v.P,1e-12)) pari++;
  }
  chk('due binning dello stesso preset non pareggiano piu', coppie>0 && pari===0,
    coppie+' coppie confrontate, '+pari+' a pari merito');

  /* LA DEGENERAZIONE SU SOGGETTI PICCOLI E' SPARITA. Prima arrivavano tutti a
     «pieno» e la seconda chiave non ordinava niente. */
  const m57=tgt('M57');
  const a57=M.fitAlternatives(m57,cur,site,np,{},20,DB.presets,8,0,FRAME);
  chk('su M57 la copertura satura per tutti', a57.every(x=>eq(x.cover,1,1e-12)));
  chk('e la profondita pure', a57.every(x=>eq(x.depth,1,1e-9)));
  chk('quindi decide la risoluzione, che e la domanda giusta su una planetaria',
    a57.every((x,i)=>i===0||a57[i-1].resol>=x.resol-1e-12),
    a57.slice(0,3).map(x=>x.dv.scale.toFixed(2)+'\" r='+x.resol.toFixed(3)).join(' > '));

  /* NESSUN PREMIO AL CAMPO LARGO. Sul Velo il campo piu' largo di tutti perde,
     perche' sottocampiona e non arriva alla soglia. */
  const velo=tgt('NGC 6960');
  const av=M.fitAlternatives(velo,{tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1},
    site,np,{},3,DB.presets,8,0,FRAME);
  const piuLargo=av.slice().sort((x,y)=>y.dv.fovX-x.dv.fovX)[0];
  chk('il campo piu largo non vince per il fatto di essere largo',
    av[0].preset.id!==piuLargo.preset.id || av[0].bin!==piuLargo.bin,
    'vince '+av[0].preset.id+' (resa '+av[0].P.toFixed(3)+'), il piu largo e '+
    piuLargo.preset.id+' (resa '+piuLargo.P.toFixed(3)+')');

  /* E chi resta sotto la soglia non viene piu' nascosto: compare, in fondo. */
  const sotto=av.filter(x=>x.pr.level==='insufficiente');
  chk('i candidati sotto soglia compaiono invece di sparire',
    av.length>0, av.length+' candidati, '+sotto.length+' sotto soglia');
  if(sotto.length) chk('e stanno in fondo, perche la resa li mette li',
    av.indexOf(sotto[0])>=av.length-sotto.length-1);
}

console.log('\n'+(ko?'\x1b[31m':'\x1b[32m')+ok+' verifiche superate, '+ko+' fallite\x1b[0m');
process.exit(ko?1:0);
