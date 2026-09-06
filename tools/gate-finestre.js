#!/usr/bin/env node
/* GATE FINESTRE — un filtro dual-band apre DUE finestre, non una.

   Il difetto da cui nasce questo gate. Optolong dichiara per l'L-eNhance due
   finestre di larghezza DIVERSA: 10 nm sull'Ha e circa 24 nm sulla regione che
   contiene Hbeta 486.1 e le due righe dell'OIII, 495.9 e 500.7. Il catalogo
   dei filtri sapeva conservare una sola larghezza per filtro, e il motore la
   applicava a entrambe le finestre.

   Le conseguenze erano due, e la seconda e' peggiore della prima.

   PRIMA. Il canale OIII attraverso un L-eNhance veniva calcolato con 10 nm di
   finestra invece di 24: il fondo cielo — che e' un continuo e scala con la
   larghezza — usciva meno della meta' del vero.

   SECONDA, e vale per TUTTI i dual, non solo per l'L-eNhance. Il gruppo di
   costo «Ha+OIII» prendeva `lines[0]`, cioe' 656.3 nm, e con esso la QE
   dell'Ha, la frazione di mosaico dell'Ha e la larghezza dell'Ha. La finestra
   dell'OIII non entrava ne' nel fondo cielo ne' nel mosaico: il gruppo era
   Ha-only travestito da dual. Su una camera a matrice e' il caso d'uso piu'
   diffuso che esista, ed e' anche quello in cui la differenza e' massima,
   perche' a 656 nm risponde circa un terzo dei fotositi e a 500 nm quasi due
   terzi.

   La struttura corretta e' a due livelli, e la distinzione e' fisica:
       finestra (window) = quanto CIELO passa      -> larghezza, trasmissione
       riga    (line)    = quale SEGNALE passa     -> le righe dentro la finestra
   Una finestra da 24 nm che contiene tre righe non e' tre finestre: il vetro e'
   uno solo e la sua trasmissione si conta una volta.

   Questo gate non verifica la fisica del cielo — quella sta in gate-fisico e in
   test.js. Verifica che la RAPPRESENTAZIONE regga: che le due finestre esistano
   separatamente, che la piu' larga porti il cielo che le compete, e che nessuna
   scorciatoia rimetta il dual a Ha-only.

     node tools/gate-finestre.js                                              */

const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

/* Il motore si costruisce qui, e non con l'helper condiviso, perche' questo gate
   deve poter CAMBIARE la ruota fra una misura e l'altra: isolare un filtro solo
   e' l'unico modo per attribuirgli quello che si misura. L'helper tiene `OWNED`
   chiusa dentro di se'; qui la si passa per riferimento e resta in mano. */
const pure = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .split('<script>')[1].split('</script>')[0]
  .split('/* =====================================================================\n   UI')[0];
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'setups.json'), 'utf8'));
const TG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'targets.json'), 'utf8'));
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
const CIT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cities.json'), 'utf8'));
const RUOTA = DB.default_filters.slice();
const ctx = { DB, TG, CAT: CAT.objects, CITIES: CIT.cities, OWNED: RUOTA,
  console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
const M = new Function(...Object.keys(ctx), pure + `return {derive,rates,bandSpec,skyRateFor,
  qeAt,camSpec,mosaicFrac,oscEfficiency,dualPass,filterFor,evaluate,prescribe,
  nightProfile,effFWHM,bandThroughput,lpPenalty,throughputFor};`)(...Object.values(ctx));

let ok = 0, ko = 0;
const chk = (what, cond, extra) => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${what}${extra ? `   [${extra}]` : ''}`);
  cond ? ok++ : ko++;
};
const H = t => console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '─'.repeat(Math.min(t.length, 78)));
const F = (x, n) => x == null ? '—' : Number(x).toFixed(n == null ? 3 : n);
const P = (s, n) => String(s).padEnd(n);

const OSC = M.derive({ tel: 'askar71f', red: '1', cam: 'asi2600mc', mnt: 'am5', bin: 1 });
const MONO = M.derive({ tel: 'askar71f', red: '1', cam: 'asi2600mm', mnt: 'am5', bin: 1 });
const SQM = 20.8;

/* La ruota si riduce a un filtro solo, per isolare quello che si sta misurando. */
const soloIl = id => { RUOTA.length = 0; RUOTA.push(id); };
const ruota = v => { RUOTA.length = 0; v.forEach(x => RUOTA.push(x)); };

// ═══════════════════════════════════════════════════════════════════════════
H('A · IL CATALOGO SA DIRE DUE FINESTRE');
// ═══════════════════════════════════════════════════════════════════════════
{
  const lenh = DB.filters.find(f => f.id === 'lenh');
  chk('l L-eNhance esiste nel catalogo', !!lenh);

  /* Il dato nuovo: un elenco di finestre, ciascuna con la sua larghezza e le
     righe che contiene. Il vecchio `fwhm_nm` puo' restare come riepilogo, ma non
     puo' piu' essere l'unica verita'. */
  const w = lenh && lenh.windows;
  chk('e dichiara le sue finestre una per una', Array.isArray(w) && w.length === 2,
    Array.isArray(w) ? w.length + ' finestre' : 'nessun campo windows: il filtro ha una larghezza sola');

  if (Array.isArray(w) && w.length === 2) {
    const larga = w.slice().sort((a, b) => b.fwhm_nm - a.fwhm_nm)[0];
    const stretta = w.slice().sort((a, b) => a.fwhm_nm - b.fwhm_nm)[0];
    chk('la finestra larga e quella dichiarata da Optolong: 24 nm',
      Math.abs(larga.fwhm_nm - 24) < 0.51, F(larga.fwhm_nm, 1) + ' nm');
    chk('la finestra stretta e quella dell Ha: 10 nm',
      Math.abs(stretta.fwhm_nm - 10) < 0.51, F(stretta.fwhm_nm, 1) + ' nm');

    /* Le righe sono il CONTENUTO della finestra, non altre finestre. */
    const righe = larga.lines || [];
    const ha = (l, x) => l.some(y => Math.abs((y.lambda_nm != null ? y.lambda_nm : y) - x) < 0.6);
    chk('la finestra larga contiene Hbeta 486.1', ha(righe, 486.1),
      righe.length + ' righe dichiarate');
    chk('e contiene entrambe le righe dell OIII, 495.9 e 500.7',
      ha(righe, 495.9) && ha(righe, 500.7));
    chk('la finestra stretta contiene solo l Ha',
      (stretta.lines || []).length === 1 && ha(stretta.lines || [], 656.3));

    /* Il centroide non si inventa: se c'e', deve nascere dalle righe. */
    const cw = larga.cwl_nm;
    const dentro = cw == null || (cw > 480 && cw < 506);
    chk('nessun centroide inventato fuori dalla finestra', dentro,
      cw == null ? 'assente, ricavato dalle righe' : F(cw, 1) + ' nm');
  }

  /* I due filtri simmetrici restano simmetrici: la struttura non deve
     inventare asimmetrie dove non ce ne sono. */
  for (const [id, larg, hb] of [['lext', 7, false], ['lult', 3, false]]) {
    const f = DB.filters.find(x => x.id === id);
    const ws = f && f.windows;
    if (!Array.isArray(ws)) { chk(f.name + ': due finestre dichiarate', false, 'campo windows assente'); continue; }
    chk(f.name + ': due finestre uguali da ' + larg + ' nm',
      ws.length === 2 && ws.every(x => Math.abs(x.fwhm_nm - larg) < 0.51),
      ws.map(x => F(x.fwhm_nm, 1)).join(' + ') + ' nm');
    const tutte = ws.flatMap(x => x.lines || []);
    const conHb = tutte.some(y => Math.abs((y.lambda_nm != null ? y.lambda_nm : y) - 486.1) < 0.6);
    chk(f.name + ': Hbeta escluso, come dichiara il costruttore', conHb === hb);
    /* A 3 nm la 4959 non ci sta accanto alla 5007: distano 4.8 nm. */
    const con4959 = tutte.some(y => Math.abs((y.lambda_nm != null ? y.lambda_nm : y) - 495.9) < 0.6);
    chk(f.name + ': la 4959 entra solo se la finestra e larga abbastanza',
      con4959 === (larg >= 4.8), con4959 ? 'inclusa' : 'esclusa');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · IL DUAL NON È PIÙ Ha-ONLY NEL FONDO CIELO');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* E' il criterio di accettazione posto esplicitamente: non basta sostituire
     10 con 24, il gruppo deve smettere di essere l'Ha travestito. */
  for (const [id, nome] of [['lult', 'L-Ultimate 3/3'], ['lext', 'L-eXtreme 7/7'], ['lenh', 'L-eNhance 10/24']]) {
    soloIl(id);
    const bHa = M.skyRateFor(OSC, 'Ha', SQM, { mosaic: true });
    const bO3 = M.skyRateFor(OSC, 'OIII', SQM, { mosaic: true });
    const bDual = M.skyRateFor(OSC, 'Ha+OIII', SQM, { mosaic: true });
    console.log('       ' + P(nome, 18) + 'Ha ' + F(bHa, 5) + '   OIII ' + F(bO3, 5) + '   gruppo ' + F(bDual, 5));
    chk(nome + ': il gruppo non coincide con il solo Ha',
      Math.abs(bDual - bHa) > 1e-9,
      Math.abs(bDual - bHa) > 1e-9 ? 'il gruppo vede due finestre' : 'IL GRUPPO E ANCORA Ha-ONLY');
    chk(nome + ': il gruppo sta fra le due finestre, non sotto la piu bassa',
      bDual >= Math.min(bHa, bO3) - 1e-9);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · LA FINESTRA LARGA PORTA IL CIELO CHE LE COMPETE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il fondo cielo e' un continuo: raddoppiando la finestra raddoppia. Il
     confronto e' fra due filtri identici in tutto tranne la larghezza della
     finestra blu — l'eXtreme a 7 nm e l'eNhance a 24. */
  soloIl('lext'); const o3_ext = M.skyRateFor(OSC, 'OIII', SQM, { mosaic: true });
  soloIl('lenh'); const o3_enh = M.skyRateFor(OSC, 'OIII', SQM, { mosaic: true });
  const r = o3_enh / o3_ext;
  console.log('       OIII: eXtreme ' + F(o3_ext, 5) + '  eNhance ' + F(o3_enh, 5) + '  rapporto ' + F(r, 2));
  chk('il canale OIII dell eNhance pesa piu di quello dell eXtreme', r > 1.5,
    'rapporto ' + F(r, 2) + ', atteso circa 24/7 = 3.4');
  chk('e il rapporto e quello delle larghezze, non un numero qualunque',
    Math.abs(r - 24 / 7) / (24 / 7) < 0.25, F(r, 2) + ' contro ' + F(24 / 7, 2));

  /* Il canale Ha invece NON deve cambiare: quella finestra e' 10 nm in un caso
     e 7 nell'altro, quindi cambia poco e nel verso giusto. */
  soloIl('lext'); const ha_ext = M.skyRateFor(OSC, 'Ha', SQM, { mosaic: true });
  soloIl('lenh'); const ha_enh = M.skyRateFor(OSC, 'Ha', SQM, { mosaic: true });
  chk('sull Ha il rapporto e 10/7, non 24/7',
    Math.abs((ha_enh / ha_ext) - 10 / 7) / (10 / 7) < 0.2, F(ha_enh / ha_ext, 2));
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · IL SEGNALE DI RIGA NON SCALA CON LA FINESTRA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* E' il motivo per cui la banda stretta funziona, e la correzione non lo deve
     rompere: un filtro da 3 nm e uno da 24 raccolgono lo STESSO Ha. Cambia solo
     quanto cielo entra con esso. */
  const segn = id => { soloIl(id); return M.rates(OSC, 'Ha', SQM).k; };
  const k3 = segn('lult'), k24 = segn('lenh');
  chk('l Ha raccolto e lo stesso attraverso 3 nm e attraverso 10',
    Math.abs(k3 - k24) / Math.max(k3, k24) < 0.05,
    'k 3nm ' + F(k3, 4) + '  k 10nm ' + F(k24, 4));

  /* L'unica differenza legittima sul segnale OIII e' atomica: dentro una
     finestra larga entra anche la 4959, che vale 1/2.98 della 5007. */
  const so3 = id => { soloIl(id); return M.rates(OSC, 'OIII', SQM).k; };
  const s3 = so3('lult'), s24 = so3('lenh');
  const atteso = 1 + 1 / 2.98;
  console.log('       segnale OIII: 3 nm ' + F(s3, 4) + '   24 nm ' + F(s24, 4) +
    '   rapporto ' + F(s24 / s3, 3) + '   atteso ' + F(atteso, 3) + ' (5007 + 4959)');
  chk('la finestra larga raccoglie anche la 4959, la stretta no',
    Math.abs((s24 / s3) - atteso) / atteso < 0.08,
    'rapporto ' + F(s24 / s3, 3));
}

// ═══════════════════════════════════════════════════════════════════════════
H('E · IL MOSAICO DI BAYER SEGUE LA FINESTRA, NON LA PRIMA RIGA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* A 656 nm risponde circa un terzo dei fotositi, a 500 quasi due terzi: e'
     la ragione fisica per cui il dual-band funziona su una camera a colori.
     Prendere `lines[0]` per tutto il gruppo la cancellava. */
  const cs = M.camSpec(OSC.c), resp = cs ? cs.resp : null;
  const mHa = M.mosaicFrac(656.3, resp), mO3 = M.mosaicFrac(500.7, resp);
  console.log('       mosaico: Ha ' + F(mHa) + '   OIII ' + F(mO3));
  chk('le due finestre cadono su frazioni di matrice diverse', Math.abs(mHa - mO3) > 0.15);

  soloIl('lenh');
  const sp = M.bandSpec('Ha+OIII', OSC.c);
  const eta = M.oscEfficiency(OSC.c, 'Ha+OIII', sp).eta;
  console.log('       eta del gruppo: ' + F(eta) + '   (Ha ' + F(mHa) + ', OIII ' + F(mO3) + ')');
  chk('l efficienza del gruppo non e quella del solo Ha',
    Math.abs(eta - mHa) > 0.02,
    Math.abs(eta - mHa) > 0.02 ? 'pesata sulle due finestre' : 'E ANCORA LA FRAZIONE DELL Ha');
  chk('e sta fra le due, come una media deve', eta >= Math.min(mHa, mO3) - 0.02 && eta <= Math.max(mHa, mO3) + 0.02,
    F(eta));
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · NIENTE SI È ROTTO A VALLE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* dualPass ordina i dual per larghezza crescente per scegliere il migliore in
     ruota. Con due larghezze per filtro, quell'ordinamento deve restare sensato
     e deterministico. */
  ruota(['lenh', 'lext', 'lult']);
  const d = M.dualPass(OSC.c);
  chk('fra tre dual in ruota il motore prende il piu selettivo', d && d.id === 'lult',
    d ? d.name : 'nessuno');

  /* Il flag `narrow` decide il modo di guadagno e la posa: a 24 nm deve restare
     banda stretta, perche' fisicamente lo e'. */
  soloIl('lenh');
  const spO3 = M.bandSpec('OIII', OSC.c);
  chk('a 24 nm la banda resta stretta', spO3.narrow === true, 'fwhm ' + F(spO3.fwhm, 1) + ' nm');

  /* E la prescrizione deve continuare ad arrivare, su tutto il catalogo. */
  const st = { lat: 46.0167, lon: 10.3333, sqm: SQM, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
  st.fwhm = M.effFWHM(st.seeing, st.rms);
  const np = M.nightProfile(new Date(2026, 8, 11), st.lat, st.lon);
  let vive = 0, rotte = 0;
  for (const t of TG.targets) {
    try {
      const e = M.evaluate(t, OSC, st, np, {});
      const pr = M.prescribe(e, 30, OSC, 1);
      if (pr && pr.alloc && pr.alloc.some(g => g.hours > 0)) vive++; else rotte++;
    } catch (err) { rotte++; }
  }
  chk('con il solo L-eNhance ogni scheda riceve comunque una prescrizione',
    rotte === 0, vive + ' vive, ' + rotte + ' rotte');
}

ruota(DB.default_filters);

// ═══════════════════════════════════════════════════════════════════════════
H('G · UN FOTOSITO VEDE UNA FINESTRA, IL MOSAICO LE VEDE TUTTE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La distinzione che la prima stesura di questa correzione aveva sbagliato, e che
     e' venuta fuori solo mettendo il rimedio sotto attacco.

     Le due finestre di un dual raccolgono nello stesso istante, ma non sullo stesso
     silicio: su una matrice di Bayer i fotositi rossi vedono la finestra dell'Ha e i
     blu-verdi quella dell'OIII. Per la media sul mosaico — la fotometria per
     arcsec², il rapporto segnale-rumore — le due si SOMMANO. Per la SATURAZIONE no:
     a saturare e' un fotosito vero, e quel fotosito ne vede una sola, quindi conta
     la finestra piu' illuminata.

     Sommarle anche per pixel gonfiava il tasso di 1.27x sull'L-eNhance e di 1.66x
     sui dual simmetrici, e da li' accorciava la posa consigliata. Il modello
     precedente sbagliava nel verso opposto — prendeva la finestra dell'Ha, la meno
     illuminata — quindi il difetto non e' che «prima era giusto»: era sbagliato
     prima e sbagliato dopo, in due direzioni diverse. */
  for (const [id, nome] of [['lult', 'L-Ultimate 3/3'], ['lext', 'L-eXtreme 7/7'], ['lenh', 'L-eNhance 10/24']]) {
    soloIl(id);
    const sp = M.bandSpec('Ha+OIII', OSC.c);
    if (!sp.sub || sp.sub.length < 2) { chk(nome + ': ha due finestre', false); continue; }
    const perPixel = M.skyRateFor(OSC, 'Ha+OIII', SQM, { spec: sp });
    const mosaico = M.skyRateFor(OSC, 'Ha+OIII', SQM, { spec: sp, mosaic: true });
    const r = sp.sub.map(x => M.qeAt(OSC.c, x.lam) * x.T * x.fwhm * 10);
    const atteso = Math.max.apply(null, r) / r.reduce((a, b) => a + b, 0);
    console.log('       ' + P(nome, 18) + 'per pixel / mosaico ' + F(perPixel / mosaico, 3) +
      '   atteso ' + F(atteso, 3));
    chk(nome + ': per pixel vale la finestra piu illuminata, non la somma',
      Math.abs(perPixel / mosaico - atteso) < 0.005, F(perPixel / mosaico, 3));
    chk(nome + ': e per pixel si raccoglie meno che sul mosaico',
      perPixel < mosaico - 1e-12);

    /* Su monocromatica la distinzione non esiste: ogni pixel vede entrambe. */
    const spM = M.bandSpec('Ha+OIII', MONO.c);
    const pm = M.skyRateFor(MONO, 'Ha+OIII', SQM, { spec: spM });
    const mm = M.skyRateFor(MONO, 'Ha+OIII', SQM, { spec: spM, mosaic: true });
    chk(nome + ': su monocromatica per pixel e mosaico coincidono',
      Math.abs(pm - mm) / mm < 1e-9, F(pm / mm, 3));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('H · LA LARGHEZZA CHE CONTA È QUELLA DELLA BANDA CHIESTA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Due punti in cui il riassunto scalare del filtro sopravviveva alla correzione.

     Il primo: scegliere fra due filtri per la finestra PIU' LARGA sembrava prudente
     ed era sbagliato. Con un L-eNhance e un Ha da 12 nm in ruota, per la banda Ha
     conta la finestra dell'Ha — 10 nm sull'eNhance — non i suoi 24 nm sul blu.

     Il secondo, e vale di piu': `lpPenalty` trasforma la larghezza in ORE, e a
     differenza di `timeFactor` non si semplifica contro la configurazione di
     riferimento, perche' la stessa larghezza compare ai due lati del rapporto. Li'
     l'errore sopravvive intero fino al numero di ore prescritte. */
  ruota(['lenh', 'ha12']);
  const perHa = M.filterFor('Ha', OSC.c);
  chk('per l Ha vince la finestra da 10 nm dell eNhance, non un Ha da 12',
    perHa && perHa.id === 'lenh', perHa ? perHa.name : 'nessuno');

  ruota(['lenh', 'o3_12']);
  const perO3 = M.filterFor('OIII', OSC.c);
  chk('per l OIII vince invece l OIII da 12, non i 24 nm dell eNhance',
    perO3 && perO3.id === 'o3_12', perO3 ? perO3.name : 'nessuno');

  /* La larghezza che arriva alle ore e' quella della finestra della banda. */
  soloIl('lenh');
  const wHa = M.bandSpec('Ha', OSC.c).fwhm, wO3 = M.bandSpec('OIII', OSC.c).fwhm;
  console.log('       eNhance: banda Ha ' + F(wHa, 1) + ' nm, banda OIII ' + F(wO3, 1) + ' nm');
  chk('le due bande dello stesso filtro hanno larghezze diverse', Math.abs(wHa - wO3) > 10);
  const pHa = M.lpPenalty(18.5, wHa), pO3 = M.lpPenalty(18.5, wO3);
  console.log('       penalita da inquinamento a SQM 18.5: Ha ' + F(pHa, 3) + '   OIII ' + F(pO3, 3));
  chk('e da cielo inquinato la finestra larga e penalizzata di piu', pO3 < pHa,
    'rapporto ' + F(pHa / pO3, 3));

  /* La prova che quella larghezza arriva davvero fino alle ore. */
  const st = { lat: 46.0167, lon: 10.3333, sqm: 18.5, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
  st.fwhm = M.effFWHM(st.seeing, st.rms);
  const np = M.nightProfile(new Date(2026, 8, 11), st.lat, st.lon);
  const t = TG.targets.find(x => /7000/.test(x.names.join(' '))) || TG.targets[0];
  const e = M.evaluate(t, OSC, st, np, {});
  const bO3 = e.budget && e.budget.OIII, bHa = e.budget && e.budget.Ha;
  if (bO3 && bHa) {
    console.log('       ' + t.names[0] + ' a SQM 18.5: fattore cielo Ha ' + F(bHa.skyFactor, 3) +
      '   OIII ' + F(bO3.skyFactor, 3));
    chk('il fattore cielo distingue le due bande dello stesso vetro',
      Math.abs(bHa.skyFactor - bO3.skyFactor) > 1e-6,
      Math.abs(bHa.skyFactor - bO3.skyFactor) > 1e-6 ? 'distinti' : 'ANCORA IL RIASSUNTO SCALARE');
  } else chk('il bilancio espone il fattore cielo per banda', false, 'budget non leggibile');
  ruota(DB.default_filters);
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
if (ko) process.exitCode = 1;
module.exports = { ok, ko };
