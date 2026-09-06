/* GATE — LE TRE STRATEGIE DI ACQUISIZIONE
   ═══════════════════════════════════════════════════════════════════════════

   600 s non e' un obbligo: e' il punto in cui il motore smette di regalare tempo
   al rumore di lettura. Ma chi riprende guarda vento, guida e stelle del campo, e
   puo' legittimamente volerne 300. Il compito del motore non e' impedire quella
   scelta — e' PREZZARLA.

   Le tre strategie sono tre priorita' sullo stesso motore, non tre motori:

     RESA        la catena dei tetti attuale. Massima efficienza fotometrica.
     EQUILIBRIO  la posa piu' corta che costa al massimo un decimo. La robustezza
                 si prende dove e' quasi gratis, non a qualunque prezzo.
     DINAMICA    nessuna stella alla magnitudine protetta va a fondo scala: cade
                 l'eccezione con cui RESA supera `tStar` per restare sopra il
                 pavimento operativo.

   L'INVARIANTE CHE NON SI NEGOZIA: la prescrizione del bersaglio non cambia mai.
   Le ore di PROGETTO sono quelle che il soggetto chiede; cambia solo quante ore di
   OROLOGIO servono a depositarle, ed e' la stessa distinzione che la Luna ha
   introdotto in C-2 — un secondo fattore sulla stessa conversione.

   E il prezzo non e' un moltiplicatore: da sigma² = (fondo + lettura)/t il tempo
   di orologio vale 1/(eff·duty)² = 1/merit², dove `merit` e' calcolato da sempre e
   contiene sia il rumore di lettura sia scarichi e assestamenti.               */

const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { M, DB, TG, CAT } = require('./lib/engine.js');

let ok = 0, ko = 0;
const chk = (what, cond, extra) => {
  if (cond) { ok++; console.log('  ok   ' + what + (extra ? '   [' + extra + ']' : '')); }
  else { ko++; console.log(' FAIL  ' + what + (extra ? '   [' + extra + ']' : '')); }
};
const H = t => console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '─'.repeat(Math.min(t.length, 78)));
const F = (x, n) => x == null ? '—' : Number(x).toFixed(n == null ? 2 : n);
const P = (s, n) => String(s).padEnd(n);
const ST = ['resa', 'equilibrio', 'dinamica'];

const sito = q => { const s = { lat: 46.0167, lon: 10.3333, sqm: q, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 }; s.fwhm = M.effFWHM(s.seeing, s.rms); return s; };
const borno = sito(20.8), citta = sito(18.5);
const D = new Date(2026, 8, 15);
const np = M.nightProfile(D, borno.lat, borno.lon);
const rc8 = M.derive({ tel: 'rc8', red: '1', cam: 'asi2600mm', mnt: 'cem70g', bin: 1 });
const cres = TG.targets.find(t => /6888/.test(t.names.join(' ')));
const m31 = TG.targets.find(t => t.names[0] === 'M31');

const scenario = (tg, dv, site, ore, strategy) => {
  const npx = M.nightProfile(D, site.lat, site.lon);
  const e = M.evaluate(tg, dv, site, npx, {});
  const pr = M.prescribe(e, ore, dv, 1);
  const expo = M.exposurePlan(pr, dv, site, { archetype: tg.archetype, tg, strategy });
  const blocchi = pr.alloc.filter(g => !g.dropped && g.hours > 0)
    .map(g => ({ id: g.id, h: g.hours, critical: g.critical, bands: g.bands }));
  const sp = M.subPlan(blocchi, expo, {});
  return { e, pr, expo, sp, blocchi };
};

// ═══════════════════════════════════════════════════════════════════════════
H('A · LA PRESCRIZIONE NON CAMBIA MAI');
// ═══════════════════════════════════════════════════════════════════════════
{
  const rif = scenario(cres, rc8, borno, 20, 'resa').pr;
  const ore = g => g.hours;
  let identiche = true, dettaglio = [];
  for (const st of ST) {
    const pr = scenario(cres, rc8, borno, 20, st).pr;
    for (const g of pr.alloc) {
      const r = rif.alloc.find(x => x.id === g.id);
      if (!r || Math.abs(ore(g) - ore(r)) > 1e-9) { identiche = false; dettaglio.push(st + '/' + g.id); }
    }
  }
  console.log('       ' + rif.alloc.filter(g => g.hours > 0).map(g => g.id + ' ' + F(g.hours) + ' h').join('  '));
  chk('le tre strategie partono dalla stessa prescrizione, ora per ora',
    identiche, dettaglio.length ? dettaglio.join(' ') : 'identiche a 1e-9');
  /* E la strada scelta non cambia: se cambiasse, cambierebbe anche il progetto. */
  const strade = ST.map(st => scenario(cres, rc8, borno, 20, st).pr.road.id);
  chk('e nemmeno la strada', new Set(strade).size === 1, strade.join(' / '));
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · L ORDINE DELLE POSE E IL COSTO CHE NE SEGUE');
// ═══════════════════════════════════════════════════════════════════════════
{
  const casi = [
    ['RC8 f/8, OIII 3 nm, SQM 20.8', rc8, borno, 'OIII'],
    ['RC8 f/8, luminanza, SQM 20.8', rc8, borno, 'L'],
    ['RC8 f/8, OIII 3 nm, SQM 18.5', rc8, citta, 'OIII'],
  ];
  console.log('  ' + P('caso', 32) + ST.map(x => P(x, 16)).join(''));
  console.log('  ' + '─'.repeat(80));
  let ordinate = true, monotone = true, coerenti = true, det = [];
  for (const [lab, dv, site, band] of casi) {
    const S = M.exposureStrategies(dv, site, band, { hours: 8, tg: cres, arch: TG.archetypes[cres.archetype] });
    console.log('  ' + P(lab, 32) + ST.map(k =>
      P(S[k].sec + ' s  +' + Math.round(S[k].cost * 100) + '%', 16)).join(''));
    if (!(S.dinamica.sec <= S.equilibrio.sec + 1e-9 && S.equilibrio.sec <= S.resa.sec + 1e-9)) ordinate = false;
    for (const k of ST) {
      /* Piu' corta ⇒ costo maggiore. Mai il contrario: sarebbe segnale creato
         dal nulla. */
      if (S[k].sec < S.resa.sec && !(S[k].cost > 0)) { monotone = false; det.push(lab + '/' + k); }
      if (S[k].sec === S.resa.sec && Math.abs(S[k].cost) > 1e-9) { monotone = false; det.push(lab + '/' + k + ' pari'); }
      /* Il costo deve essere ESATTAMENTE (merit_resa/merit)²−1, non una stima. */
      const atteso = Math.pow(S.resa.merit / S[k].merit, 2) - 1;
      if (Math.abs(S[k].cost - atteso) > 1e-12) { coerenti = false; det.push(lab + '/' + k + ' costo'); }
    }
  }
  chk('DINAMICA <= EQUILIBRIO <= RESA, per costruzione', ordinate, true);
  chk('una posa piu corta costa sempre di piu, e una uguale costa zero',
    monotone, det.length ? det.slice(0, 3).join(' ') : 'nessuna eccezione');
  chk('e il costo e esattamente (merit_resa/merit)^2 - 1, non una stima',
    coerenti, 'verificato a 1e-12');
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · IL COSTO CONTIENE ANCHE GLI SCARICHI, NON SOLO IL RUMORE DI LETTURA');
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = M.exposureStrategies(rc8, borno, 'L', { hours: 8, tg: cres, arch: TG.archetypes[cres.archetype] });
  const din = S.dinamica, resa = S.resa;
  console.log('       RESA ' + resa.sec + ' s: eff ' + F(resa.eff, 3) + ' duty ' + F(resa.duty, 3) +
    '   DINAMICA ' + din.sec + ' s: eff ' + F(din.eff, 3) + ' duty ' + F(din.duty, 3));
  chk('una posa piu corta perde anche sul ciclo di lavoro, non solo sulla lettura',
    din.sec < resa.sec ? din.duty < resa.duty - 1e-9 : true,
    'duty ' + F(din.duty, 4) + ' contro ' + F(resa.duty, 4));
  /* Il costo dal solo rumore di lettura sarebbe piu' basso: la differenza e'
     esattamente il tempo che se ne va in scarichi e assestamenti. */
  const soloRN = Math.pow(resa.eff / din.eff, 2) - 1;
  console.log('       costo dal solo rumore di lettura ' + F(soloRN * 100, 1) + '%, ' +
    'con gli scarichi ' + F(din.cost * 100, 1) + '%');
  chk('e il costo totale supera quello della sola lettura',
    din.sec < resa.sec ? din.cost > soloRN + 1e-9 : true, true);
  /* subPlan porta gli scarichi nel tempo di orologio: deve superare l integrazione. */
  const sc = scenario(cres, rc8, borno, 20, 'dinamica');
  chk('e il tempo di orologio del piano supera sempre l integrazione',
    sc.sp.clockH > sc.sp.integH, F(sc.sp.clockH) + ' h contro ' + F(sc.sp.integH) + ' h');
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · IL COSTO ARRIVA AL PIANO — capacita, notti, nessun sovraccarico');
// ═══════════════════════════════════════════════════════════════════════════
{
  const out = ST.map(st => {
    const s = scenario(cres, rc8, borno, 20, st);
    const b = M.planNights(s.pr, s.e, rc8, 60, { site: borno, date: D, expo: s.expo, strategy: st }).bounds;
    return { st, b, s };
  });
  out.forEach(x => console.log('       ' + P(x.st, 12) + 'capacita ' + F(x.b.capacity, 0) + ' h · minimo ' +
    x.b.min + ' notti · ' + x.s.sp.subs.reduce((a, y) => a + y.n, 0) + ' pose'));
  const resa = out[0];
  chk('una strategia meno efficiente non aumenta la capacita della notte',
    out.every(x => x.b.capacity <= resa.b.capacity + 1e-9), true);
  chk('e non chiede mai meno notti di RESA',
    out.every(x => x.b.min >= resa.b.min), out.map(x => x.st[0] + x.b.min).join(' '));
  /* Il tappeto: nessuna notte oltre le proprie ore, in nessuna strategia. */
  let casi = 0, sforati = [];
  for (const st of ST) for (const site of [borno, citta]) for (const mode of ['sessione', 'progetto']) {
    const s = scenario(cres, rc8, site, 20, st);
    const b = M.planNights(s.pr, s.e, rc8, 60, { site, date: D, expo: s.expo, strategy: st }).bounds;
    for (const n of [b.min, b.min + 2]) {
      if (!n || n > b.max) continue;
      const pl = M.planNights(s.pr, s.e, rc8, n, { site, date: D, expo: s.expo, strategy: st, mode });
      if (!pl.ok) continue;
      casi++;
      for (const nt of pl.nights) if (nt.usedH > nt.availH + 1e-6)
        sforati.push(st + '/' + site.sqm + '/' + mode + '/n' + n);
    }
  }
  chk('nessuna notte viene caricata oltre le proprie ore, in nessuna strategia',
    sforati.length === 0, sforati.length ? sforati.slice(0, 3).join(' ') : casi + ' piani, zero sforamenti');
}

// ═══════════════════════════════════════════════════════════════════════════
H('E · DINAMICA NON PROMETTE RISOLUZIONE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il vincolo semantico che il nome porta con se': DINAMICA riguarda alte luci,
     stelle e robustezza. La risoluzione la decidono ottica, seeing e guida, e
     nessuna strategia la tocca. */
  const s0 = scenario(m31, rc8, borno, 20, 'resa');
  const s1 = scenario(m31, rc8, borno, 20, 'dinamica');
  /* QUESTE DUE NON POTEVANO FALLIRE. Confrontavano `rc8.scale` con se stesso e
     `f(x)` con `f(x)`: vere per qualunque valore, e gli scenari s0 ed s1 — calcolati
     due righe sopra proprio per questo — non entravano nel confronto. Cio' che
     volevano dire e' che la strategia non tocca la geometria, e ora lo dicono
     confrontando i due scenari, che e' l'unico modo in cui l'affermazione ha senso. */
  /* La scala del pixel e' un INGRESSO — `dv` e' lo stesso oggetto nei due scenari —
     quindi confrontarla non direbbe niente. Cio' che ha senso verificare e' che non
     cambi quello che il motore PRODUCE sulla geometria: la fedelta' di risoluzione e
     il verdetto di campionamento escono da `evaluate`, e una strategia che li
     toccasse starebbe cambiando l'immagine, non solo la posa. */
  chk('la fedelta di risoluzione non cambia con la strategia',
    Math.abs(s0.e.resol - s1.e.resol) < 1e-15, F(s0.e.resol, 4) + ' in entrambe');
  chk('e nemmeno il verdetto di campionamento',
    s0.e.samp.k === s1.e.samp.k && s0.e.samp.cls === s1.e.samp.cls,
    s0.e.samp.k);
  /* `coverage` e' l'INTENTO ('full' / 'framing'), non un numero: la frazione
     coperta sta in `covered.c`. Confrontarla con F() dava NaN — un errore mio, non
     del motore. */
  chk('e nemmeno la resa geometrica del bersaglio',
    Math.abs(s0.e.resol - s1.e.resol) < 1e-12 &&
    s0.e.coverage === s1.e.coverage &&
    Math.abs(s0.e.covered.c - s1.e.covered.c) < 1e-12 &&
    s0.e.targetPanels === s1.e.targetPanels,
    'resol ' + F(s0.e.resol, 4) + ' · copertura ' + F(s0.e.covered.c, 4) +
    ' · ' + s0.e.targetPanels + ' pannelli');
  /* Quello che DINAMICA cambia davvero: le stelle che salva. */
  const S = M.exposureStrategies(rc8, borno, 'L', { hours: 8, tg: m31, arch: TG.archetypes[m31.archetype] });
  console.log('       luminanza: RESA ' + S.resa.sec + ' s satura oltre V ' + F(S.resa.magSafe, 1) +
    ' · DINAMICA ' + S.dinamica.sec + ' s satura oltre V ' + F(S.dinamica.magSafe, 1));
  chk('DINAMICA protegge stelle piu deboli, ed e la sua unica promessa',
    S.dinamica.sec < S.resa.sec ? S.dinamica.magSafe > S.resa.magSafe + 0.1 : true,
    'guadagno ' + F(S.dinamica.magSafe - S.resa.magSafe, 2) + ' mag');
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · IL CASO DEL FORUM — OIII a 600 s, e quanto costa scendere');
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = M.exposureStrategies(rc8, borno, 'OIII', { hours: 8, tg: cres, arch: TG.archetypes[cres.archetype] });
  const c = S.curve;
  console.log('  ' + P('posa', 8) + P('merito', 10) + P('costo', 10) + 'vincolo');
  console.log('  ' + '─'.repeat(60));
  for (const t of [600, 480, 300, 180, 120]) {
    const x = c.find(y => y.sec === t); if (!x) continue;
    console.log('  ' + P(x.sec + ' s', 8) + P(F(x.merit, 3), 10) + P('+' + Math.round(x.cost * 100) + '%', 10) + x.binding);
  }
  const a300 = c.find(x => x.sec === 300);
  chk('la curva prezza qualunque posa della griglia, non solo le tre',
    c.length >= 5, c.length + ' pose prezzate da ' + c[0].sec + ' s a ' + c[c.length - 1].sec + ' s');
  chk('scendere a 300 s e permesso e ha un prezzo dichiarato',
    !!a300 && a300.cost > 0.2, a300 ? '+' + Math.round(a300.cost * 100) + '%' : 'assente');
  /* E il prezzo cresce in modo monotono scendendo: mai una posa piu' corta che
     costi meno di una piu' lunga. */
  const ord = c.slice().sort((a, b) => a.sec - b.sec);
  chk('e il prezzo cresce sempre scendendo di posa',
    ord.every((x, i) => i === 0 || ord[i - 1].cost >= x.cost - 1e-12), true);
}

// ═══════════════════════════════════════════════════════════════════════════
H('G · LA LUNA RESTA COERENTE E PER CANALE');
// ═══════════════════════════════════════════════════════════════════════════
{
  const xlp = M.lpExcessFlux(borno.sqm, 250);
  const p = b => M.moonPenalty(b, 1.64, 3, false, xlp);   // Luna piena a 90°
  console.log('       ' + ['Ha', 'OIII', 'SII', 'L'].map(b => b + ' ' + F(p(b) * 100, 0) + '%').join('  '));
  chk('l OIII non e immune alla Luna: sta peggio della luminanza',
    p('OIII') < p('L'), 'OIII ' + F(p('OIII'), 3) + ' contro L ' + F(p('L'), 3));
  chk('e l Ha resta il canale delle notti illuminate',
    p('Ha') > p('L') && p('Ha') > p('OIII'), 'Ha ' + F(p('Ha'), 3));
  chk('la larghezza del filtro non entra nella penalizzazione lunare',
    Math.abs(M.moonPenalty('OIII', 1.64, 3, false, xlp) - M.moonPenalty('OIII', 1.64, 7, false, xlp)) < 1e-12,
    'un 3 nm e un 7 nm prendono la stessa Luna, in proporzione');
  /* E la strategia non deve alterare la Luna: sono due fattori indipendenti sulla
     stessa conversione. */
  const pen = [];
  for (const st of ST) {
    const s = scenario(cres, rc8, borno, 20, st);
    const b = M.planNights(s.pr, s.e, rc8, 60, { site: borno, date: D, expo: s.expo, strategy: st });
    pen.push(b.bounds.capH[0] / b.bounds.windows.nights[0].availH);
  }
  chk('e la strategia non tocca la Luna: la capacita scende, la sua causa resta distinta',
    pen[0] >= pen[1] - 1e-9 && pen[1] >= pen[2] - 1e-9,
    pen.map(x => F(x, 3)).join(' >= '));
}

// ═══════════════════════════════════════════════════════════════════════════
H('H · LA RUOTA CHE HAI DAVVERO — nessuna prescrizione impossibile');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il motore sceglieva fra tutte le strade della scheda senza guardare la ruota:
     con venti ore su NGC 6888 prendeva SHO e assegnava otto ore al SII anche a chi
     un SII non ce l'ha. Non era un avviso mancato — era una prescrizione che quella
     persona non poteva eseguire, e di venti ore ne restavano undici senza che le
     altre nove venissero ridistribuite.

     Con un corredo completo il difetto non si manifesta mai, ed e' esattamente il
     motivo per cui e' rimasto nascosto: la suite gira sui filtri di serie. Questo
     blocco gira invece sui corredi che la gente ha davvero. */
  const ENG=require('./lib/engine.js');
  const fs=require('fs'), path=require('path');
  const RT=path.join(__dirname,'..');
  const pure=fs.readFileSync(path.join(RT,'index.html'),'utf8')
    .split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const DBx=JSON.parse(fs.readFileSync(path.join(RT,'data','setups.json'),'utf8'));
  const TGx=JSON.parse(fs.readFileSync(path.join(RT,'data','targets.json'),'utf8'));
  const CATx=JSON.parse(fs.readFileSync(path.join(RT,'data','catalog.json'),'utf8'));
  const CITx=JSON.parse(fs.readFileSync(path.join(RT,'data','cities.json'),'utf8'));
  const RUOTA=[];                                   // la ruota, manipolabile
  const ctx={DB:DBx,TG:TGx,CAT:CATx.objects,CITIES:CITx.cities,OWNED:RUOTA,
    console,Math,Date,Object,JSON,isFinite,parseFloat,parseInt,Number,window:{}};
  const Mx=new Function(...Object.keys(ctx),pure+`return {derive,evaluate,prescribe,
    nightProfile,effFWHM,filterFor};`)(...Object.values(ctx));

  const st={lat:46.0167,lon:10.3333,sqm:20.8,seeing:1.6,rms:0.6,horizonMin:20,clearFrac:0.35};
  st.fwhm=Mx.effFWHM(st.seeing,st.rms);
  const npx=Mx.nightProfile(new Date(2026,8,6),st.lat,st.lon);
  const mono=Mx.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1});
  const osc =Mx.derive({tel:'askar71f',red:0.75,cam:'asi2600mc',mnt:'am5',bin:1});
  const ruota=ids=>{ RUOTA.length=0; ids.forEach(i=>RUOTA.push(i)); };
  const tutti=DBx.default_filters.slice();

  /* Il numero che conta: ore assegnate a un canale che quella ruota non copre,
     senza che nessuna strada alternativa sia stata provata. */
  const impossibili=(dv)=>{
    let n=0, ore=0, muti=0, esempi=[];
    for(const tg of TGx.targets){
      let e,pr; try{ e=Mx.evaluate(tg,dv,st,npx,{}); pr=Mx.prescribe(e,20,dv,1); }catch(err){ continue; }
      const senza=pr.alloc.filter(g=>!g.dropped&&g.hours>0&&
        (g.bands||[]).some(b=>!Mx.filterFor(b,dv.c)));
      if(!senza.length) continue;
      n++; ore+=senza.reduce((a,g)=>a+g.hours,0);
      if(!pr.missing.length) { muti++; esempi.push(tg.names[0]); }
    }
    return {n,ore,muti,esempi};
  };

  const corredi=[
    ['completo (di serie)',tutti],
    ['Ha+OIII+LRGB, niente SII',tutti.filter(f=>!/^s2|^sii/.test(f))],
    ['solo un dual-band',['lult']],
    ['solo camera a colori',[]],
  ];
  console.log('  '+P('corredo',30)+P('mono',18)+'OSC');
  console.log('  '+'─'.repeat(64));
  let mutiTot=0;
  for(const [lab,ids] of corredi){
    ruota(ids);
    const a=impossibili(mono), b=impossibili(osc);
    mutiTot+=a.muti+b.muti;
    console.log('  '+P(lab,30)+
      P(a.n?a.n+' su '+TGx.targets.length+', '+F(a.ore,0)+' h':'nessuna',18)+
      (b.n?b.n+' su '+TGx.targets.length+', '+F(b.ore,0)+' h':'nessuna'));
  }
  chk('nessun corredo produce una prescrizione impossibile IN SILENZIO',
    mutiTot===0, mutiTot?mutiTot+' casi muti':'ogni caso residuo dichiara il filtro che manca');

  /* Il caso che ha aperto la questione, misurato. */
  ruota(tutti.filter(f=>!/^s2|^sii/.test(f)));
  {
    const cres=TGx.targets.find(t=>/6888/.test(t.names.join(' ')));
    const pr=Mx.prescribe(Mx.evaluate(cres,mono,st,npx,{}),20,mono,1);
    console.log('       NGC 6888 senza SII: strada '+pr.road.id+
      (pr.filterLimited?' (ristretta dai filtri)':'')+
      ' · '+pr.alloc.filter(g=>g.hours>0).map(g=>g.id+' '+F(g.hours,1)+'h').join(' '));
    chk('senza SII il Crescent ripiega su HOO invece di prescrivere il SII',
      pr.road.id==='hoo'&&!pr.alloc.some(g=>g.id==='SII'&&g.hours>0),true);
    chk('e dichiara che la scelta e stata ristretta dai filtri',
      pr.filterLimited&&pr.blocked.some(b=>b.needs.includes('SII')),
      'con SII si aprirebbe '+pr.blocked.map(b=>b.road).join(', '));
    /* Il guadagno vero non e' «spende tutte le venti ore» — HOO ha un utile di
       15.5 h e oltre quello il motore non gonfia niente, il surplus resta
       `unused`. Il guadagno e' che le ore ESEGUIBILI aumentano: prima chi non
       aveva il SII riceveva SHO e poteva realizzarne 10.7 su 20, adesso riceve
       HOO e le realizza tutte. */
    const eseguibili=g=>g.filter(x=>x.hours>0&&(x.bands||[]).every(b=>Mx.filterFor(b,mono.c)))
      .reduce((a,x)=>a+x.hours,0);
    ruota(tutti);
    const conSII=Mx.prescribe(Mx.evaluate(cres,mono,st,npx,{}),20,mono,1);
    ruota(tutti.filter(f=>!/^s2|^sii/.test(f)));
    const prNo=Mx.prescribe(Mx.evaluate(cres,mono,st,npx,{}),20,mono,1);
    const persePrima=conSII.alloc.filter(x=>x.id==='SII').reduce((a,x)=>a+x.hours,0);
    console.log('       con la vecchia scelta avrebbe ricevuto '+conSII.road.id+
      ' e perso '+F(persePrima,1)+' h sul SII; ora riceve '+prNo.road.id+
      ' con '+F(eseguibili(prNo.alloc),1)+' h tutte eseguibili');
    chk('e le ore eseguibili aumentano invece di finire su un filtro assente',
      eseguibili(prNo.alloc)>eseguibili(conSII.alloc)+1,
      F(eseguibili(prNo.alloc),1)+' h contro '+F(eseguibili(conSII.alloc),1)+' h');
    chk('senza lasciare una sola ora su un canale che non puoi riprendere',
      prNo.alloc.every(x=>x.hours===0||(x.bands||[]).every(b=>Mx.filterFor(b,mono.c))),true);
  }

  /* Dove NESSUNA strada e' percorribile non si finisce in un vicolo cieco: la
     prescrizione resta e il filtro mancante si dichiara. */
  ruota([]);
  {
    const cres=TGx.targets.find(t=>/6888/.test(t.names.join(' ')));
    const pr=Mx.prescribe(Mx.evaluate(cres,osc,st,npx,{}),20,osc,1);
    chk('con nessun filtro la prescrizione arriva lo stesso',
      pr.alloc.some(g=>g.hours>0), pr.alloc.filter(g=>g.hours>0).map(g=>g.id).join('+'));
    chk('e dice esattamente quale filtro serve',
      pr.missing.length>0, 'serve '+pr.missing.join(' e '));
    /* Le galassie invece restano riprendibili: la matrice di Bayer e' il filtro. */
    const m31=TGx.targets.find(t=>t.names[0]==='M31');
    const pm=Mx.prescribe(Mx.evaluate(m31,osc,st,npx,{}),20,osc,1);
    chk('mentre su una galassia la matrice di Bayer basta, e non chiede niente',
      pm.missing.length===0, 'strada '+pm.road.id);
  }

  /* L'RGB per le sole stelle non deve squalificare una strada: senza R G B in
     ruota la banda stretta si fa lo stesso, si perde il colore delle stelle. */
  ruota(['ha3','o3_3','s2_3']);
  {
    const cres=TGx.targets.find(t=>/6888/.test(t.names.join(' ')));
    const pr=Mx.prescribe(Mx.evaluate(cres,mono,st,npx,{}),20,mono,1);
    console.log('       con soli Ha OIII SII: strada '+pr.road.id+' · canali '+
      pr.alloc.filter(g=>g.hours>0).map(g=>g.id).join('+')+
      (pr.starsDropped.length?' · caduto '+pr.starsDropped.join(','):''));
    chk('senza R G B la banda stretta resta percorribile',
      pr.missing.length===0&&pr.alloc.some(g=>g.hours>0), 'strada '+pr.road.id);
    chk('e il canale per le sole stelle cade con una nota invece di bloccare tutto',
      pr.starsDropped.includes('RGB'), pr.starsDropped.join(',')||'nessuno');
  }
  ruota(tutti);
}

// ═══════════════════════════════════════════════════════════════════════════
H('I · LA STRATEGIA NON TOCCA CHE COSA RIPRENDI');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il difetto arrivato dal campo, su NGC 7000 con un Askar e una camera a colori:
     scegliendo Dinamica la prescrizione passava da HOO — Ha e OIII insieme — a una
     strada con il solo Ha. Cambiare il COME cambiava il CHE COSA.

     La causa era una retroazione nella UI: le ore passate al motore erano la
     capacita' calcolata CON la posa della strategia scelta, quindi Dinamica ne
     toglieva qualche punto percentuale e il motore ripiegava su una strada piu'
     economica. Ora quella capacita' si misura sempre sulla posa di Resa.

     Qui si verifica l'invariante a tappeto, riproducendo la catena della UI.

     ATTENZIONE, e' il punto debole di questa verifica: la catena qui sotto fissa
     `strategy:'resa'` di proprio pugno. Se qualcuno togliesse quella scelta
     dall'app, la simulazione continuerebbe a passarla e il gate resterebbe verde
     mentre il difetto e' tornato. La riga del sorgente va quindi controllata per
     quello che dice davvero, non riprodotta a memoria. */
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const i = src.indexOf('RXCAP=vivi.length');
    const blocco = i > 0 ? src.slice(Math.max(0, i - 900), i) : '';
    const usa = /expo0\s*=\s*exposurePlan\([\s\S]*?strategy:\s*'resa'/.test(blocco);
    chk('l app misura la capacita sulla posa di RESA, non su quella scelta', usa,
      i > 0 ? (usa ? "strategy:'resa' fissato nel sorgente"
                   : 'LA RETROAZIONE E TORNATA: RXCAP usa la posa della strategia scelta')
            : 'blocco RXCAP non trovato');
    const dopo = i > 0 ? src.slice(i, i + 600) : '';
    chk('e ridimensiona la prescrizione proprio con quella capacita',
      /prescribe\(e\s*,\s*RXCAP\s*,/.test(dopo));
  }

  const CFG = [
    ['RC8+2600MM', { tel: 'rc8', red: '1', cam: 'asi2600mm', mnt: 'cem70g', bin: 1 }],
    ['Tecno+2600MM', { tel: 'tecnosky115', red: 0.80, cam: 'asi2600mm', mnt: 'am5', bin: 1 }],
    ['Askar+2600MC', { tel: 'askar71f', red: 0.75, cam: 'asi2600mc', mnt: 'am5', bin: 1 }],
    ['RedCat+2600MC', { tel: 'redcat51', red: 0.92, cam: 'asi2600mc', mnt: 'am5', bin: 1 }],
  ];
  const DD = new Date(2026, 8, 11);
  let casi = 0, diverse = [], oreDiverse = [];
  for (const [lab, cfg] of CFG) for (const q of [20.8, 18.5]) {
    const st = { lat: 46.0167, lon: 10.3333, sqm: q, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
    st.fwhm = M.effFWHM(st.seeing, st.rms);
    const npx = M.nightProfile(DD, st.lat, st.lon);
    const dv = M.derive(cfg);
    for (const tg of TG.targets) for (const N of [1, 2, 3, 5, 8]) {
      let W; try { W = M.nightWindows(tg, st, DD, N, {}); } catch (e) { continue; }
      if (!W.nights.length) continue;
      const av = W.nights.slice(0, N).reduce((a, x) => a + x.availH, 0);
      if (!(av > 0)) continue;
      const per = {};
      for (const S of ST) {
        let e, pr0, ex0, cap, pr;
        try {
          e = M.evaluate(tg, dv, st, npx, {});
          pr0 = M.prescribe(e, av, dv, 1);
          const vivi = pr0.alloc.filter(g => !g.dropped && g.hours > 0);
          /* La catena corretta: la capacita' che dimensiona la prescrizione si
             misura SEMPRE sulla posa di Resa, mai su quella scelta. */
          ex0 = M.exposurePlan(pr0, dv, st, { archetype: tg.archetype, tg, strategy: 'resa' });
          cap = vivi.length
            ? W.nights.slice(0, N).reduce((a, x) => a + x.availH * M.mixPenalty(vivi, dv, tg, st, x, ex0), 0)
            : av;
          pr = M.prescribe(e, cap, dv, 1);
        } catch (err) { continue; }
        per[S] = { road: pr.road.id, spent: pr.spent,
                   canali: pr.alloc.filter(g => g.hours > 0).map(g => g.id).sort().join('+') };
      }
      if (Object.keys(per).length < 3) continue;
      casi++;
      const rs = new Set(ST.map(S => per[S].road));
      const cs = new Set(ST.map(S => per[S].canali));
      if (rs.size > 1 && diverse.length < 4)
        diverse.push(tg.names[0] + '/' + lab + '/' + N + 'n: ' + ST.map(S => per[S].road).join('≠'));
      if (rs.size > 1 || cs.size > 1) oreDiverse.push(1);
    }
  }
  console.log('       ' + casi + ' combinazioni: ' + CFG.length + ' configurazioni x 2 cieli x ' +
    TG.targets.length + ' bersagli x 5 durate');
  chk('la strategia non cambia mai la strada, su nessuna combinazione',
    diverse.length === 0, diverse.length ? diverse.join(' · ') : casi + ' casi, zero divergenze');
  chk('e non cambia nemmeno quali canali prescrivi',
    oreDiverse.length === 0, oreDiverse.length ? oreDiverse.length + ' casi' : 'identici ovunque');
}

// ═══════════════════════════════════════════════════════════════════════════
H('L · CON UN DUAL-BAND, HA E OIII NON SI SEPARANO');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Attraverso un L-Ultimate le due righe arrivano nella stessa posa: una strada
     che pianifica l'Ha e scarta l'OIII descrive gli stessi scatti con meta' dei
     dati non contati. Nel catalogo le strade cosi' sono tre — ngc7000/hargb,
     sh2-129/ha_only, m31/lrgb_ha — ma M31 non e' un caso vero, perche' li' l'OIII
     ha utile zero e la coppia non esiste.

     LA REGOLA E' STRETTA: si esclude solo quando la scheda offre l'alternativa
     accoppiata, e SOLO con il dual-band attivo. Su monocromatica, o su una camera
     a colori senza un dual Ha/OIII in ruota, i passaggi sono davvero separati e
     saltare l'OIII fa risparmiare ore vere: li' la strada resta. */
  const stx = { lat: 46.0167, lon: 10.3333, sqm: 20.8, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
  stx.fwhm = M.effFWHM(stx.seeing, stx.rms);
  const npx = M.nightProfile(new Date(2026, 8, 11), stx.lat, stx.lon);
  const osc = M.derive({ tel: 'askar71f', red: 0.75, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const mono = M.derive({ tel: 'rc8', red: '1', cam: 'asi2600mm', mnt: 'cem70g', bin: 1 });
  const ORE = [2, 5, 10, 18, 24, 30, 40];
  const spezzata = pr => {
    const ids = pr.alloc.filter(g => g.hours > 0).flatMap(g => g.bands || [g.id]);
    return ids.indexOf('Ha') >= 0 !== ids.indexOf('OIII') >= 0;
  };
  const conCoppia = ['NGC 7000', 'Sh2-129'];
  let rotti = [], monoOk = 0, oscOk = 0;
  for (const nome of conCoppia) {
    const tg = TG.targets.find(x => x.names.some(n => n === nome)); if (!tg) continue;
    for (const h of ORE) {
      const po = M.prescribe(M.evaluate(tg, osc, stx, npx, {}), h, osc, 1);
      if (spezzata(po)) rotti.push(nome + '/OSC/' + h + 'h: ' + po.road.id);
      else oscOk++;
      const pm = M.prescribe(M.evaluate(tg, mono, stx, npx, {}), h, mono, 1);
      if (spezzata(pm)) monoOk++;      // su mono la spezzata DEVE restare possibile
    }
  }
  console.log('       OSC con L-Ultimate: ' + oscOk + '/' + (conCoppia.length * ORE.length) +
    ' prescrizioni con la coppia intera · su mono la strada a riga singola resta usata ' +
    monoOk + ' volte');
  chk('su dual-band la coppia Ha/OIII non si spezza mai, a nessuna durata',
    rotti.length === 0, rotti.length ? rotti.slice(0, 3).join(' · ') : oscOk + ' prescrizioni');
  chk('ma su monocromatica la strada a riga singola resta disponibile, perche li risparmia davvero',
    monoOk > 0, monoOk + ' casi su ' + (conCoppia.length * ORE.length));
  /* M31: nessuna strada accoppiata, quindi la regola non deve toccarla — l'Ha come
     rinforzo del rosso su una galassia e' una tecnica reale. */
  const m = TG.targets.find(x => x.names[0] === 'M31');
  if (m) {
    const pm = M.prescribe(M.evaluate(m, mono, stx, npx, {}), 30, mono, 1);
    chk('e su M31 la strada LRGB+Ha sopravvive: li la coppia non esiste',
      /ha/.test(pm.road.id), 'strada ' + pm.road.id);
  }
  /* E il filtro viaggia col gruppo, cosi la UI puo dirlo senza richiamare il motore. */
  const pc = M.prescribe(M.evaluate(TG.targets.find(x => /6888/.test(x.names.join(' '))), osc, stx, npx, {}), 26, osc, 1);
  const gj = pc.alloc.find(g => g.joint);
  chk('il gruppo congiunto dichiara il filtro che lo produce',
    !!(gj && gj.filterName && gj.filterDual), gj ? gj.filterName : 'nessun gruppo congiunto');
}

// ═══════════════════════════════════════════════════════════════════════════
H('M · PIU ORE NON PUO SIGNIFICARE MENO CANALI');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il riempimento buttava via un canale quando il suo pavimento non entrava nelle
     ore rimaste, ma il ramo sotto-soglia riscala invece tutto senza buttare niente.
     Ne usciva una fascia — larga quanto il pavimento del canale piu' piccolo — in
     cui quel canale spariva, con il canale presente sia sopra sia sotto. Su
     NGC 7000: assente fra 18.37 h e 20.09 h, presente a 18 h e a 21 h. */
  const stx = { lat: 46.0167, lon: 10.3333, sqm: 20.8, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
  stx.fwhm = M.effFWHM(stx.seeing, stx.rms);
  const npx = M.nightProfile(new Date(2026, 8, 11), stx.lat, stx.lon);
  const CFG = [
    { tel: 'rc8', red: '1', cam: 'asi2600mm', mnt: 'cem70g', bin: 1 },
    { tel: 'askar71f', red: 0.75, cam: 'asi2600mc', mnt: 'am5', bin: 1 },
  ];
  let passi = 0, cali = [];
  for (const cfg of CFG) {
    const dv = M.derive(cfg);
    for (const tg of TG.targets) {
      let e; try { e = M.evaluate(tg, dv, stx, npx, {}); } catch (err) { continue; }
      let prec = null;
      for (let h = 1; h <= 45; h += 0.5) {
        let pr; try { pr = M.prescribe(e, h, dv, 1); } catch (err) { continue; }
        const n = pr.alloc.filter(g => g.hours > 1e-9).length;
        if (prec !== null) {
          passi++;
          /* A STRADA PARI. Se la strada cambia, cambia anche la tecnica, e una
             tecnica diversa ha legittimamente un numero di canali diverso: su
             Sh2-155 a 26 h il motore preferisce fare HOO per INTERO (tre canali,
             «pieno») invece di HaRGB a meta' (cinque canali, «ridotto»), ed e' una
             scelta difendibile. Quello che non deve piu' succedere e' perdere un
             canale RESTANDO sulla stessa strada — era il difetto del riempimento.

             Nota agli atti: la scelta della strada NON e' monotona nelle ore. Su
             M27 oscilla fra hoo_hdr e lrgb_ho a 3, 3.5, 4, 5, 7, 7.5 h. E' un
             difetto di un'altra famiglia — sta nella selezione a tre passate di
             `prescribe`, non nel riempimento — e non e' stato corretto qui. */
          if (n < prec.n && pr.road.id === prec.road) cali.push(tg.names[0] + '/' + cfg.tel + ': ' +
            prec.h + 'h→' + prec.n + ' canali, ' + h + 'h→' + n + ' (strada ' + pr.road.id + ')');
        }
        prec = { n, h, road: pr.road.id };
      }
    }
  }
  console.log('       ' + passi + ' passi di mezz ora confrontati su ' + TG.targets.length +
    ' bersagli x ' + CFG.length + ' configurazioni');
  chk('a strada pari, aggiungere ore non toglie mai un canale',
    cali.length === 0, cali.length ? cali.slice(0, 3).join(' · ') : 'nessun calo, mai');
  /* E nessun canale viene piu' buttato: chi resta sotto la propria soglia lo
     dichiara, che e' la stessa regola gia' valida per la prescrizione e il piano. */
  const t7 = TG.targets.find(x => /7000/.test(x.names.join(' ')));
  const dv7 = M.derive(CFG[1]);
  const e7 = M.evaluate(t7, dv7, stx, npx, {});
  let scartati = 0, dichiarati = 0;
  for (let h = 1; h <= 40; h += 1) {
    const pr = M.prescribe(e7, h, dv7, 1);
    scartati += pr.alloc.filter(g => g.dropped).length;
    dichiarati += pr.alloc.filter(g => g.belowFloor).length;
  }
  chk('nessun canale viene piu buttato via', scartati === 0, scartati + ' scarti in 40 durate');
  chk('e chi resta sotto la soglia lo dichiara', dichiarati > 0, dichiarati + ' avvertimenti');
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
if (ko) process.exitCode = 1;
module.exports = { ok, ko };
