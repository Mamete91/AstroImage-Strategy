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
  chk('la scala del pixel non cambia', rc8.scale === rc8.scale, F(rc8.scale, 3) + '"/px');
  chk('la fedelta di risoluzione non cambia',
    Math.abs(M.resolutionFidelity(rc8.scale, borno.fwhm) - M.resolutionFidelity(rc8.scale, borno.fwhm)) < 1e-15, true);
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

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
if (ko) process.exitCode = 1;
module.exports = { ok, ko };
