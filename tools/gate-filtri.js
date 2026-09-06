#!/usr/bin/env node
/* GATE — QUALUNQUE FILTRO COMMERCIALE DEVE POTER ENTRARE E ARRIVARE AL MOTORE
   ═══════════════════════════════════════════════════════════════════════════

   Un catalogo di filtri non puo' pretendere che ogni produttore pubblichi una
   scheda completa. Optolong, sul L-QEF, scrive «FWHM: Quad bandpass filter» e
   pubblica solo la curva; altri dichiarano larghezze diverse per ogni finestra;
   altri ancora vendono lo stesso filtro in versione normale e Highspeed. La regola
   del progetto e' pragmatica ma non sciatta: si accetta il dato dove c'e', si
   dichiara da dove viene, e non si inventa dove manca.

   Il difetto da cui nasce questo gate era misurabile e grave: un filtro aggiunto a
   mano veniva creato, salvato, ritrovato dopo il ricaricamento e mostrato spuntato
   nella pagina — e il motore usava un altro filtro. `filterFor` ordinava per
   larghezza crescente e a parita' vinceva chi veniva prima nell'elenco, cioe' il
   CATALOGO, perche' i filtri dell'utente finiscono in coda. Un L-QEF a 250 nm
   perdeva contro un IDAS a 250 nm senza che niente lo dicesse.
   E un filtro senza larghezza dichiarata produceva `undefined` in `bandSpec`, da li'
   NaN nel fondo cielo, NaN nelle ore, Infinity nelle settimane, e la prescrizione
   lasciava cadere il canale in silenzio.

   Cinque sezioni:
     A · ogni tipologia entra e attraversa il motore senza numeri rotti
     B · la scelta esplicita di un ruolo non viene mai sostituita
     C · un multi-finestra non ha una larghezza sola, e il centro dichiarato vince
     D · un dato assunto non batte un dato dichiarato, e unknown non esclude
     E · il filtro dell utente non perde il pareggio contro il catalogo

     node tools/gate-filtri.js                                                 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let ok = 0, ko = 0;
const chk = (what, cond, extra) => {
  if (cond) { ok++; console.log('  ok   ' + what + (extra ? '   [' + extra + ']' : '')); }
  else { ko++; console.log(' FAIL  ' + what + (extra ? '   [' + extra + ']' : '')); }
};
const H = t => console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '─'.repeat(Math.min(t.length, 78)));
const F = (x, n) => x == null ? '—' : Number(x).toFixed(n == null ? 2 : n);

const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const CAT = J('catalog.json'), CIT = J('cities.json');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MARCA = '/* =====================================================================';
const PURA = html.split('<script>')[1].split('</script>')[0].split(MARCA + '\n   UI')[0];

/* Un motore su misura: catalogo con i filtri di prova aggiunti, ruota dichiarata,
   ruoli impostabili. E' lo stesso modo in cui gli altri gate isolano una ruota. */
function motore(extra, owned, roles) {
  const DB = J('setups.json'), TG = J('targets.json');
  require('./lib/enrich.js').enrich(TG, CAT.objects, ROOT);
  (extra || []).forEach(f => DB.filters.push(JSON.parse(JSON.stringify(f))));
  const ctx = { DB, TG, CAT: CAT.objects, CITIES: CIT.cities, OWNED: (owned || []).slice(),
    console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
  const M = new Function(...Object.keys(ctx), PURA +
    `return {derive,evaluate,prescribe,nightProfile,effFWHM,filterFor,bandSpec,rates,
     timeFactor,varRate,skyRateFor,filterWindows,adattoA,windowFor,windowLambda,bandWidth,bandWidthNota,
     bandWidthFonte,selectivity,ownedFilters,dualPass,imageYield,planNights,exposurePlan,
     refCfg,conRuotaDiRiferimento,
     subExposure,DB:DB,TG:TG,ruoli:r=>{ROLES=r||{};}};`)(...Object.values(ctx));
  M.ruoli(roles || {});
  return M;
}
const SITO = { lat: 46.0167, lon: 10.3333, sqm: 20.5, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
const sano = v => typeof v === 'number' && isFinite(v);
const W = o => o;
/* Chi, del campionario, quella camera lo ammette: serve solo al messaggio. */
const che_ammessi = casi => casi.map(c => c[0]).join(', ') + ', ognuno sul sensore che lo usa';

/* IL CAMPIONARIO. Non sono dati di prodotto: sono FORME, una per ogni tipologia che
   il commercio produce davvero. Servono a provare il contenitore, non a descrivere
   un modello. I filtri veri stanno in data/setups.json con la loro provenienza. */
const CAMPIONARIO = [
  { etichetta: 'banda larga classica', f: { id: 't_bb', name: 'Luminanza di prova', band: 'L', user: true,
      windows: [W({ center_nm: 550, fwhm_nm: 300, peak_t: 0.95, fwhm_source: 'manufacturer-declared' })] } },
  { etichetta: 'anti-inquinamento (LPS)', f: { id: 't_lps', name: 'LPS di prova', band: 'L', user: true,
      windows: [W({ center_nm: 545, fwhm_nm: 200, peak_t: 0.92, fwhm_source: 'manufacturer-declared' })] } },
  { etichetta: 'banda stretta singola', f: { id: 't_nb', name: 'Ha 3 nm di prova', band: 'Ha', user: true,
      windows: [W({ fwhm_nm: 3, peak_t: 0.9, fwhm_source: 'manufacturer-declared',
        lines: [{ band: 'Ha', lambda_nm: 656.28 }] })] } },
  { etichetta: 'dual-band asimmetrico', f: { id: 't_dual', name: 'Dual asimmetrico di prova', band: 'dual',
      dual: true, bands: ['Ha', 'OIII'], user: true,
      windows: [W({ fwhm_nm: 24, peak_t: 0.88, fwhm_source: 'manufacturer-declared',
                    lines: [{ band: 'Hb', lambda_nm: 486.13 }, { band: 'OIII', lambda_nm: 495.89 }, { band: 'OIII', lambda_nm: 500.68 }] }),
               W({ fwhm_nm: 10, peak_t: 0.88, fwhm_source: 'manufacturer-declared',
                    lines: [{ band: 'Ha', lambda_nm: 656.28 }] })] } },
  { etichetta: 'tri-band', f: { id: 't_tri', name: 'Tri-band di prova', band: 'dual', dual: true,
      bands: ['Ha', 'OIII', 'SII'], user: true,
      windows: [W({ fwhm_nm: 6, peak_t: 0.9, fwhm_source: 'measured', lines: [{ band: 'OIII', lambda_nm: 500.68 }] }),
               W({ fwhm_nm: 6, peak_t: 0.9, fwhm_source: 'measured', lines: [{ band: 'Ha', lambda_nm: 656.28 }] }),
               W({ fwhm_nm: 6, peak_t: 0.9, fwhm_source: 'measured', lines: [{ band: 'SII', lambda_nm: 672.4 }] })] } },
  { etichetta: 'quad-band con larghezze note', f: { id: 't_quad', name: 'Quad di prova', band: 'L',
      bands: ['Hb', 'OIII', 'Ha', 'SII'], user: true,
      windows: [W({ fwhm_nm: 30, peak_t: 0.9, fwhm_source: 'curve-derived', lines: [{ band: 'Hb', lambda_nm: 486.13 }] }),
               W({ fwhm_nm: 30, peak_t: 0.9, fwhm_source: 'curve-derived', lines: [{ band: 'OIII', lambda_nm: 495.89 }, { band: 'OIII', lambda_nm: 500.68 }] }),
               W({ fwhm_nm: 35, peak_t: 0.9, fwhm_source: 'curve-derived', lines: [{ band: 'Ha', lambda_nm: 656.28 }] }),
               W({ fwhm_nm: 35, peak_t: 0.9, fwhm_source: 'curve-derived', lines: [{ band: 'SII', lambda_nm: 672.4 }] })] } },
  { etichetta: 'multi-band, una finestra con due righe diverse', f: { id: 't_multi', name: 'Multi di prova',
      band: 'L', bands: ['OIII', 'Ha', 'SII'], user: true,
      windows: [W({ fwhm_nm: 20, peak_t: 0.9, fwhm_source: 'estimated', lines: [{ band: 'OIII', lambda_nm: 500.68 }] }),
               W({ center_nm: 664, fwhm_nm: 40, peak_t: 0.9, fwhm_source: 'estimated',
                    lines: [{ band: 'Ha', lambda_nm: 656.28 }, { band: 'SII', lambda_nm: 672.4 }] })] } },
  { etichetta: 'senza larghezza dichiarata', f: { id: 't_ign', name: 'Senza FWHM di prova', band: 'L',
      bands: ['Hb', 'OIII', 'Ha', 'SII'], user: true, peak_t: 0.9, fwhm_source: 'unknown',
      windows: [W({ lines: [{ band: 'Hb', lambda_nm: 486.13 }] }),
               W({ lines: [{ band: 'OIII', lambda_nm: 495.89 }, { band: 'OIII', lambda_nm: 500.68 }] }),
               W({ lines: [{ band: 'Ha', lambda_nm: 656.28 }] }),
               W({ lines: [{ band: 'SII', lambda_nm: 672.4 }] })] } },
];

// ═══════════════════════════════════════════════════════════════════════════
H('A · OGNI TIPOLOGIA ATTRAVERSA IL MOTORE SENZA NUMERI ROTTI');
// ═══════════════════════════════════════════════════════════════════════════
{
  let esaminati = 0, rotti = [], esclusi = [];
  for (const { etichetta, f } of CAMPIONARIO) for (const cam of ['asi2600mm', 'asi2600mc']) {
    const M = motore([f], [f.id, 'lum', 'red', 'grn', 'blu']);
    const dv = M.derive({ tel: 'rc8', red: 1, cam, mnt: 'am5', bin: 1 });
    const st = { ...SITO }; st.fwhm = M.effFWHM(1.6, 0.6);
    const np = M.nightProfile(new Date(2026, 8, 11), st.lat, st.lon);
    const t = M.TG.targets.find(x => /M31|Andromeda/i.test(x.names.join(' ')));
    let e, pr, y;
    try {
      e = M.evaluate(t, dv, st, np, {}, 'full');
      pr = M.prescribe(e, 20, dv, 1);
      y = M.imageYield(t, dv, st, pr, 'full', 0);
    } catch (err) { rotti.push(etichetta + '/' + cam + ': eccezione ' + err.message); continue; }
    esaminati++;
    /* NaN E INFINITY SONO NUMERI ROTTI. `null` NO: E' UNA RISPOSTA.

       Qui si mettevano nello stesso sacco. Con un filtro solo in ruota la maggior
       parte dei canali non ha vetro, e da quando un canale che non si puo' riprendere
       restituisce `null` invece di ore da sensore nudo, questo controllo contava come
       rotti proprio i valori che la correzione ha reso onesti. La proprieta' vera e'
       un'altra, ed e' piu' stretta: nessun NaN e nessun Infinity, MAI; e ogni `null`
       accompagnato dalla dichiarazione che quel canale non e' valutabile — un null
       muto sarebbe un difetto quanto un NaN. */
    const rotto = x => x != null && (typeof x !== 'number' || !isFinite(x));
    const numeri = [e.roadHTot, e.nights, e.weeks, e.score, pr.spent, y.P]
      .concat(Object.values(e.budget).map(b => b.useful))
      .concat(Object.values(e.budget).map(b => b.factor));
    const male = numeri.filter(rotto).length;
    if (male) rotti.push(etichetta + '/' + cam + ': ' + male + ' numeri non finiti');
    /* E ogni ora assente deve avere il suo perche' scritto accanto. */
    const muti = Object.entries(e.budget)
      .filter(([b, v]) => v.useful == null && !v.nonValutabile).map(([b]) => b);
    if (muti.length) rotti.push(etichetta + '/' + cam + ': ore assenti non dichiarate su ' + muti.join(','));
    /* E dove il canale non e' valutabile, il motivo dev'essere quello vero: nessun
       filtro in ruota per quella banda. Non un effetto collaterale. */
    const falsi = Object.entries(e.budget)
      .filter(([b, v]) => v.nonValutabile && !!M.filterFor(b, dv.c)).map(([b]) => b);
    if (falsi.length) rotti.push(etichetta + '/' + cam + ': dichiarato non valutabile con il filtro in ruota su ' + falsi.join(','));
    /* «Non escluso» significa che il motore lo trova quando lo cerca per una delle
       sue bande. Va provato SENZA concorrenti: con un `lum` in ruota, un filtro di
       banda larga piu' stretto legittimamente non viene scelto — non e' esclusione,
       e' la scelta automatica che fa il suo mestiere. Qui interessa l'altra cosa:
       che un filtro valido non sparisca perche' gli manca un parametro. */
    const bande = f.bands || [f.band];
    const solo = motore([f], [f.id]);
    const dvSolo = solo.derive({ tel: 'rc8', red: 1, cam, mnt: 'am5', bin: 1 });
    const trovato = bande.some(b => { const ff = solo.filterFor(b, dvSolo.c); return ff && ff.id === f.id; });
    if (!trovato) esclusi.push(etichetta + '/' + cam);
  }
  chk('il campionario copre le tipologie del commercio', CAMPIONARIO.length >= 8,
    CAMPIONARIO.map(x => x.etichetta.split(' ')[0]).join(', '));
  chk('tutte attraversano la catena', esaminati === CAMPIONARIO.length * 2,
    esaminati + ' passaggi su ' + CAMPIONARIO.length * 2);
  chk('nessun NaN, nessun Infinity, e ogni ora assente ha il suo perche', rotti.length === 0,
    rotti.length ? rotti.slice(0, 3).join(' · ') : esaminati + ' prescrizioni sane');
  chk('e nessuna esclusa in silenzio', esclusi.length === 0,
    esclusi.length ? esclusi.join(' · ') : 'tutte raggiungibili da almeno una banda');
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · LA SCELTA ESPLICITA DI UN RUOLO NON VIENE MAI SOSTITUITA');
// ═══════════════════════════════════════════════════════════════════════════
{
  const ruota = ['lum', 'idas', 'ha3', 'o3_3', 'lqef', 'red', 'grn', 'blu'];
  const casi = [['lum', 'la luminanza classica'], ['idas', 'un anti-inquinamento'],
                ['lqef', 'un quad-band senza larghezza'], ['ha3', 'un Ha da 3 nm, scelta deliberata']];
  /* LA SCELTA E' SOVRANA SU TUTTO QUELLO CHE IL MOTORE AVREBBE DECISO DA SOLO, e
     ha un limite solo: il vetro. Prima qui si pretendeva che ogni scelta valesse su
     ogni camera, e mezzo campionario chiedeva l'impossibile — la luminanza pura e
     l'Ha da 3 nm davanti a una matrice di Bayer, l'anti-inquinamento e il quad-band
     davanti a una monocromatica. Onorarle avrebbe voluto dire prescrivere nottate
     che non si eseguono.

     Percio' si verificano tutt e due i rami, e il secondo e' quello che prima non
     c'era: dove il sensore ammette il filtro la scelta e' esatta e non viene mai
     sostituita; dove non lo ammette la scelta non passa, e quello che si monta al
     suo posto e' comunque un filtro che quella camera puo' montare — mai un altro
     narrowband travestito da scelta dell'utente. */
  let onorati = 0, rifiutati = 0;
  for (const [id, che] of casi) for (const cam of ['asi2600mm', 'asi2600mc']) {
    const M = motore([], ruota, { L: id });
    const dv = M.derive({ tel: 'rc8', red: 1, cam, mnt: 'am5', bin: 1 });
    const f = M.DB.filters.find(x => x.id === id);
    const ammesso = M.adattoA(f, dv.c);
    const ff = M.filterFor('L', dv.c);
    if (ammesso) {
      if (ff && ff.id === id) onorati++;
      else chk('il ruolo L resta ' + id + ' su ' + cam, false, 'ha scelto ' + (ff && ff.id));
    } else {
      const ripiego = ff && (ff.id === '__none' || M.adattoA(M.DB.filters.find(x => x.id === ff.id), dv.c));
      if (ff && ff.id !== id && ripiego) rifiutati++;
      else chk('il ruolo L = ' + id + ' su ' + cam + ' doveva essere rifiutato con un ripiego valido',
        false, 'ha montato ' + (ff && ff.id));
    }
  }
  chk('dove il sensore lo ammette, la scelta esplicita non viene mai sostituita',
    onorati === 4, onorati + ' su 4 — ' + che_ammessi(casi));
  chk('e dove non lo ammette non passa, ma non lascia il posto a un altro impossibile',
    rifiutati === 4, rifiutati + ' su 4 rifiutati con un filtro che quella camera monta');

  /* E la scelta cambia davvero la fisica a valle, altrimenti sarebbe decorativa. */
  const M1 = motore([], ruota, { L: 'lum' }), M2 = motore([], ruota, { L: 'ha3' });
  const dv1 = M1.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const dv2 = M2.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const s1 = M1.bandSpec('L', dv1.c), s2 = M2.bandSpec('L', dv2.c);
  chk('e arriva fino alla fisica: un Ha nel ruolo L rende la luminanza a banda stretta',
    s1.narrow === false && s2.narrow === true && s2.fwhm === 3,
    'lum ' + s1.fwhm + ' nm narrow=' + s1.narrow + '  ·  ha3 ' + s2.fwhm + ' nm narrow=' + s2.narrow);

  /* Una scelta non puo' resuscitare un filtro che non possiedi. */
  const M3 = motore([], ['lum', 'red', 'grn', 'blu'], { L: 'idas' });
  const dv3 = M3.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('ma una scelta che nomina un filtro non posseduto decade',
    (M3.filterFor('L', dv3.c) || {}).id === 'lum', 'ripiega su ' + (M3.filterFor('L', dv3.c) || {}).id);
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · UN MULTI-FINESTRA NON HA UNA LARGHEZZA SOLA');
// ═══════════════════════════════════════════════════════════════════════════
{
  const dual = CAMPIONARIO.find(x => x.f.id === 't_dual').f;
  const M = motore([dual], [dual.id, 'lum', 'red', 'grn', 'blu']);
  chk('ogni banda vede la larghezza della PROPRIA finestra',
    M.bandWidth(dual, 'Ha') === 10 && M.bandWidth(dual, 'OIII') === 24,
    'Ha ' + M.bandWidth(dual, 'Ha') + ' nm · OIII ' + M.bandWidth(dual, 'OIII') + ' nm');
  chk('e il filtro non porta una FWHM globale che le riassuma',
    dual.fwhm_nm === undefined, 'fwhm_nm ' + dual.fwhm_nm);

  const multi = CAMPIONARIO.find(x => x.f.id === 't_multi').f;
  const M2 = motore([multi], [multi.id]);
  const w = M2.windowFor(multi, 'Ha');
  chk('il centro dichiarato di una finestra vince sul centroide delle righe',
    M2.windowLambda(w) === 664, F(M2.windowLambda(w), 2) + ' nm dichiarato, invece di ' +
    F((656.28 + 672.4) / 2, 2) + ' dedotto');
  const senzaCentro = { ...w }; delete senzaCentro.center_nm;
  chk('e senza centro dichiarato si torna al centroide, come prima',
    Math.abs(M2.windowLambda(senzaCentro) - (656.28 + 672.4) / 2) < 1e-9,
    F(M2.windowLambda(senzaCentro), 2) + ' nm');
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · UN DATO ASSUNTO NON BATTE UN DATO DICHIARATO');
// ═══════════════════════════════════════════════════════════════════════════
{
  const ign = CAMPIONARIO.find(x => x.f.id === 't_ign').f;
  const M = motore([ign], [ign.id, 'lum', 'red', 'grn', 'blu']);
  const dv = M.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('un filtro senza larghezza riceve un valore, non undefined',
    M.bandWidth(ign, 'Ha') === 250 && !M.bandWidthNota(ign, 'Ha'),
    F(M.bandWidth(ign, 'Ha'), 0) + ' nm assunti, dichiarata: ' + M.bandWidthNota(ign, 'Ha'));
  chk('e la provenienza lo dichiara', M.bandWidthFonte(ign, 'Ha') === 'unknown',
    M.bandWidthFonte(ign, 'Ha'));
  chk('la scelta automatica preferisce il dichiarato all assunto',
    (M.filterFor('L', dv.c) || {}).id === 'lum',
    'lum 300 nm dichiarati batte il filtro da 250 nm assunti');
  /* Ma resta usabile: se e' l'unico che porta quella banda, si usa. */
  const M2 = motore([ign], [ign.id]);
  const dv2 = M2.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('e unknown non lo esclude: se e l unico che porta la banda, si usa',
    (M2.filterFor('Ha', dv2.c) || {}).id === ign.id, (M2.filterFor('Ha', dv2.c) || {}).id);
  /* La provenienza non deve cambiare un numero: e' documentazione, non fisica. */
  const a = { ...CAMPIONARIO.find(x => x.f.id === 't_nb').f };
  const b = JSON.parse(JSON.stringify(a)); b.id = 't_nb2'; b.windows[0].fwhm_source = 'estimated';
  const Ma = motore([a], [a.id]), Mb = motore([b], [b.id]);
  const dva = Ma.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('e la provenienza non cambia nessun numero: e documentazione, non fisica',
    Math.abs(Ma.skyRateFor(dva, 'Ha', 20.5, { spec: Ma.bandSpec('Ha', dva.c) }) -
             Mb.skyRateFor(dva, 'Ha', 20.5, { spec: Mb.bandSpec('Ha', dva.c) })) < 1e-15,
    'dichiarato e stimato danno lo stesso fondo cielo');
}

// ═══════════════════════════════════════════════════════════════════════════
H('E · IL FILTRO DELL UTENTE NON PERDE IL PAREGGIO CONTRO IL CATALOGO');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il difetto misurato: un L-QEF dichiarato dall'utente a 250 nm perdeva contro
     l'IDAS di catalogo a 250 nm, perche' `sort` e' stabile e i filtri aggiunti a
     mano finiscono in coda a `DB.filters`. Restava spuntato in pagina e invisibile
     al motore. */
  const mio = { id: 'f_mio', name: 'Il mio anti-inquinamento', band: 'L', user: true,
    windows: [W({ center_nm: 545, fwhm_nm: 250, peak_t: 0.92, fwhm_source: 'curve-derived' })] };
  const M = motore([mio], ['idas', mio.id, 'red', 'grn', 'blu']);
  const dv = M.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const scelto = M.filterFor('L', dv.c);
  chk('a parita di larghezza vince il filtro dell utente', scelto && scelto.id === mio.id,
    'ha scelto ' + (scelto && scelto.id) + ' fra idas (catalogo) e f_mio (tuo), entrambi 250 nm');
  /* La verifica non e' vuota: senza la regola vincerebbe il catalogo, che nell'elenco
     viene prima. */
  const ordineCatalogo = M.ownedFilters().filter(f => f.band === 'L').map(f => f.id);
  chk('e la verifica non e vuota: nell elenco il catalogo viene prima',
    ordineCatalogo.indexOf('idas') < ordineCatalogo.indexOf(mio.id),
    ordineCatalogo.join(' → '));
  /* E su camera a colori passa dall'altro ramo, che deve rispettare la stessa regola. */
  const dvC = M.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const sceltoC = M.filterFor('L', dvC.c);
  chk('anche sul ramo delle camere a colori', sceltoC && sceltoC.id === mio.id,
    'ha scelto ' + (sceltoC && sceltoC.id));
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · L-QEF, PRIMO ESEMPIO CONCRETO DELL ARCHITETTURA');
// ═══════════════════════════════════════════════════════════════════════════
{
  const M = motore([], ['lqef', 'red', 'grn', 'blu']);
  const f = M.DB.filters.find(x => x.id === 'lqef');
  chk('e in catalogo', !!f, f ? f.name : '—');
  chk('con quattro finestre sulle righe che Optolong dichiara',
    M.filterWindows(f).length === 4,
    M.filterWindows(f).map(w => (w.lines || []).map(l => l.band).join('+')).join(' · '));
  chk('nessuna larghezza dichiarata, perche Optolong non la pubblica',
    M.filterWindows(f).every(w => w.fwhm_nm === undefined) && f.fwhm_source === 'unknown',
    'la scheda riporta «FWHM: Quad bandpass filter»');
  chk('la trasmissione invece e dichiarata dal produttore',
    f.peak_t === 0.90 && f.peak_t_source === 'manufacturer-declared', '>90% su tutte le righe');
  chk('non e marcato dual: Optolong lo vende come soppressore di inquinamento',
    !f.dual && f.band === 'L', 'band ' + f.band + ', dual ' + !!f.dual);
  const dv = M.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const st = { ...SITO }; st.fwhm = M.effFWHM(1.6, 0.6);
  const np = M.nightProfile(new Date(2026, 8, 11), st.lat, st.lon);
  const t = M.TG.targets.find(x => /M31|Andromeda/i.test(x.names.join(' ')));
  const e = M.evaluate(t, dv, st, np, {}, 'full');
  const pr = M.prescribe(e, 20, dv, 1);
  /* CON LUI SOLO IN RUOTA LA PRESCRIZIONE ESCE SANA — e «sana» va detto con
     precisione. La strada di default di M31 e' `lrgb_ha`, che vuole un canale Ha
     DEDICATO, e un quad-band non lo fornisce: la sua posa e' una sola, il colore lo
     separa la matrice. Quindi il costo di quella strada non e' basso, non e': il
     motore ripiega su L+RGB, che con questo vetro si fa eccome, e li' i numeri ci
     sono tutti.
     Prima qui si pretendeva un numero anche per la strada impraticabile, ed era il
     numero da sensore nudo che la correzione ha tolto di mezzo. */
  chk('e con lui solo in ruota la prescrizione esce sana',
    sano(pr.spent) && pr.alloc.every(g => sano(g.hours)) && pr.alloc.length > 0,
    'canali ' + pr.alloc.filter(g => !g.dropped).map(g => g.id).join('+') +
    ' per ' + F(pr.spent) + ' h');
  chk('  e ripiega sulla strada che quel vetro permette davvero',
    pr.road && pr.road.id !== 'lrgb_ha', 'strada ' + (pr.road || {}).id);
  chk('  mentre quella che vuole un Ha dedicato non viene costata a vuoto',
    e.roadHTot === null && e.nights === null,
    'lrgb_ha: ore ' + String(e.roadHTot) + ', notti ' + String(e.nights));
  chk('  e il motivo e scritto',
    (e.missing || []).indexOf('Ha') >= 0, 'manca ' + JSON.stringify(e.missing));
}

// ═══════════════════════════════════════════════════════════════════════════
H('G · CHI SCEGLIE IL FILTRO E CHI LO VALUTA DEVONO DIRE LA STESSA COSA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il motore ha due meccanismi che parlano di filtri: uno li SCEGLIE quando il
     ruolo e' automatico, l'altro li VALUTA calcolando le ore. Se si contraddicono,
     l'app consiglia un filtro e poi lo punisce.

     Si contraddicevano. La regola di scelta era «vince il piu' stretto», sempre.
     Su una riga e' giusta: la riga passa comunque, il cielo no. Su un CONTINUO —
     ed e' quello che raccoglie un filtro di banda larga — e' rovesciata, perche'
     stringere butta via segnale quanto butta via cielo.

     MISURATO prima della correzione, Askar 71F + 2600MM su M31 con sette banda-larga
     in ruota: l'automatico prendeva `idasd3` (180 nm) e la prescrizione chiedeva poi
     14.9 h a SQM 21.6 contro le 8.0 h di `uvir` (300 nm), l'85% in piu'; a SQM 17.8
     383.8 contro 265.7, il 44% in piu'. A ogni cielo provato il filtro scelto era
     quello che il motore stesso valutava peggiore. */
  const BB = ['lum', 'uvir', 'idas', 'idasd1', 'lpro', 'cls', 'idasd3'];
  const NB = ['ha3', 'ha35', 'ha5', 'ha65', 'ha7', 'ha12'];
  const CIELI = [21.6, 20.8, 19.5, 18.5, 17.8];
  const tM31 = motore([], BB).TG.targets.find(x => /M31|Andromeda/i.test(x.names.join(' ')));

  const orePer = (ruota, ruolo, band, sqm, cam) => {
    const K = motore([], ruota, ruolo ? { [band]: ruolo } : {});
    const dv = K.derive({ tel: 'askar71f', red: 1, cam, mnt: 'am5', bin: 1 });
    /* Se quel sensore quel filtro non lo monta, il ruolo non viene onorato e le ore
       che uscirebbero sarebbero di un ALTRO filtro. Attribuirle al filtro chiesto e'
       il modo piu' silenzioso di sbagliare una misura: meglio nessun numero. */
    if (ruolo) { const m = K.filterFor(band, dv.c); if (!m || m.id !== ruolo) return null; }
    const st = { lat: 46.0167, lon: 10.3333, sqm, seeing: 1.6, rms: 0.9, horizonMin: 20, clearFrac: 0.35 };
    st.fwhm = K.effFWHM(1.6, 0.9);
    const np = K.nightProfile(new Date(2026, 8, 11), st.lat, st.lon);
    const e = K.evaluate(tM31, dv, st, np, {}, 'full');
    return (e.budget[band] || {}).useful;
  };

  let confronti = 0, divergenze = 0, peggio = 0, esDiv = null;
  for (const sqm of CIELI) for (const cam of ['asi2600mm', 'asi2600mc']) {
    const K = motore([], BB.concat(['red', 'grn', 'blu']));
    const dv = K.derive({ tel: 'askar71f', red: 1, cam, mnt: 'am5', bin: 1 });
    const auto = (K.filterFor('L', dv.c) || {}).id;
    if (!auto) continue;
    const ore = {};
    for (const id of BB) ore[id] = orePer(BB.concat(['red', 'grn', 'blu']), id, 'L', sqm, cam);
    /* Due candidati bastano a metterli in disaccordo, e su una monocromatica sono
       esattamente due: di questi sette filtri di banda larga cinque sono da matrice.
       Chiederne tre buttava via meta' del campione — tutti i passaggi su mono. */
    const validi = Object.entries(ore).filter(([, v]) => sano(v));
    if (validi.length < 2) continue;
    confronti++;
    const migliore = validi.sort((a, b) => a[1] - b[1])[0];
    const scelto = ore[auto];
    if (migliore[0] !== auto && sano(scelto)) {
      divergenze++;
      const d = scelto / migliore[1] - 1;
      if (d > peggio) { peggio = d;
        esDiv = 'SQM ' + sqm + '/' + cam + ': scelto ' + auto + ' (' + F(scelto) + ' h), migliore ' +
          migliore[0] + ' (' + F(migliore[1]) + ' h)'; }
    }
  }
  chk('il campione copre piu cieli e tutti e due i sensori', confronti >= 8,
    confronti + ' confronti su ' + BB.length + ' filtri di banda larga');
  chk('per il ruolo di banda larga la scelta coincide con la valutazione',
    divergenze === 0, divergenze ? divergenze + ' divergenze, la peggiore ' +
    F(peggio * 100, 1) + '%: ' + esDiv : confronti + ' confronti, sempre lo stesso filtro');

  /* La verifica non e' vuota: con la regola precedente — il piu' stretto — la
     divergenza c'era, e si ricostruisce qui. */
  /* Sulla matrice, che e' dove questi sette filtri di banda larga stanno davvero
     tutti insieme: la monocromatica ne ammette due, e con due soli il difetto
     «vince il piu' stretto» non ha nemmeno lo spazio per manifestarsi. */
  const K0 = motore([], BB.concat(['red', 'grn', 'blu']));
  const dv0 = K0.derive({ tel: 'askar71f', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const piuStretto = K0.ownedFilters().filter(f => f.band === 'L' && K0.adattoA(f, dv0.c))
    .sort((a, b) => K0.bandWidth(a, 'L') - K0.bandWidth(b, 'L'))[0];
  const oreStretto = orePer(BB.concat(['red', 'grn', 'blu']), piuStretto.id, 'L', 20.8, 'asi2600mc');
  const oreScelto = orePer(BB.concat(['red', 'grn', 'blu']), (K0.filterFor('L', dv0.c) || {}).id, 'L', 20.8, 'asi2600mc');
  chk('e la regola precedente divergeva davvero, quindi non passa per vacuita',
    oreStretto > oreScelto * 1.2,
    'il piu stretto (' + piuStretto.id + ') chiederebbe ' + F(oreStretto) + ' h contro ' +
    F(oreScelto) + ' h — ' + F((oreStretto / oreScelto - 1) * 100, 1) + '% in piu');

  /* E sulla RIGA la regola opposta resta quella giusta: li' stringere guadagna. */
  const Kn = motore([], NB.concat(['lum']));
  const dvn = Kn.derive({ tel: 'askar71f', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const autoHa = (Kn.filterFor('Ha', dvn.c) || {}).id;
  chk('mentre su una riga di emissione vince ancora il piu stretto',
    autoHa === 'ha3', autoHa + ' fra ' + NB.join(', '));
  const oreNB = {};
  for (const id of NB) oreNB[id] = orePer(NB.concat(['lum']), id, 'Ha', 20.8, 'asi2600mm');
  const migliorNB = Object.entries(oreNB).filter(([, v]) => sano(v)).sort((a, b) => a[1] - b[1])[0];
  chk('e anche li scelta e valutazione coincidono', migliorNB[0] === autoHa,
    'scelto ' + autoHa + ', migliore ' + migliorNB[0] + ' (' + F(migliorNB[1]) + ' h)');

  /* Un filtro a banda stretta non deve diventare candidato AUTOMATICO per la
     luminanza solo perche' e' piu' selettivo: e' uno strumento con un altro ruolo.
     Restare scegliibile a mano e' un'altra cosa, ed e' voluto. */
  const Km = motore([], ['lum', 'ha3', 'o3_3', 's2_3', 'red', 'grn', 'blu']);
  const STRETTI = ['ha3', 'o3_3', 's2_3'];
  /* La ruota qui sopra e' una ruota da monocromatica: da quando la banda stretta
     singola e l'LRGB sono filtri per sensori senza matrice, davanti a una camera a
     colori non c'e' NIENTE da avvitare. La risposta giusta li' non e' «la luminanza»
     - quella luminanza non e' candidata - ma «nessun filtro»: la matrice di Bayer il
     colore lo fa gia' da sola, e riprendere nudi e' un'acquisizione vera, non un
     ripiego. L'invariante che si voleva difendere resta e vale su tutt'e due: un
     narrowband non diventa la luminanza automatica solo perche' e' piu' selettivo. */
  const attesa = { asi2600mm: 'lum', asi2600mc: '__none' };
  for (const cam of ['asi2600mm', 'asi2600mc']) {
    const d = Km.derive({ tel: 'askar71f', red: 1, cam, mnt: 'am5', bin: 1 });
    const l = (Km.filterFor('L', d.c) || {}).id;
    chk('e una banda stretta non diventa mai luminanza da sola (' + cam + ')',
      STRETTI.indexOf(l) < 0, 'ruolo L automatico -> ' + l);
    chk('  e la risposta e quella che quel sensore consente', l === attesa[cam],
      cam === 'asi2600mm' ? 'la luminanza che ha in ruota'
                          : 'niente da avvitare: il colore lo fa la matrice');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('H · LE CONSEGUENZE DEI RUOLI, DOVE NON DEVONO ARRIVARE E DOVE SI');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* I ruoli sono una scelta di chi riprende. Devono arrivare dappertutto nel calcolo
     della SUA configurazione, e non arrivare da nessuna parte nel RIFERIMENTO. */

  /* 1 · IL RIFERIMENTO NON HA RUOLI. `conRuotaDiRiferimento` imponeva la ruota
     dichiarata ma non i ruoli: bastava scegliere per la luminanza un filtro che il
     riferimento possiede anche lui — un ha3 — e quella scelta entrava nel
     DENOMINATORE di ogni ora prescritta. Misurato: collect da 247241 a 55.6 e fondo
     cielo da 1.105 a 0.0075, cioe' il metro spostato di un fattore 4400 per un clic
     in una tendina. */
  const RUOTA = ['ha3', 'o3_3', 's2_3', 'lum', 'red', 'grn', 'blu', 'idas'];
  const firme = new Set();
  for (const roles of [{}, { L: 'idas' }, { L: 'ha3' }, { L: 'o3_3' }, { Ha: 'ha3' }]) {
    const K = motore([], RUOTA, roles);
    const r = K.refCfg();
    const o = K.conRuotaDiRiferimento(() => ({ f: K.filterFor('L', r.dv.c), rr: K.rates(r.dv, 'L', r.sqm) }));
    firme.add([(o.f || {}).id, o.rr.collect.toPrecision(12), o.rr.R_b.toPrecision(12)].join('|'));
  }
  chk('il riferimento non cambia con i ruoli di chi lo interroga', firme.size === 1,
    firme.size + ' firme distinte su 5 combinazioni di ruoli');
  /* Non vuota: il ruolo DEVE invece cambiare la configurazione dell'utente. */
  const A = motore([], RUOTA, {}), B = motore([], RUOTA, { L: 'ha3' });
  const dA = A.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('mentre la configurazione in uso cambia eccome, quindi la verifica non e vuota',
    (A.filterFor('L', dA.c) || {}).id !== (B.filterFor('L', dA.c) || {}).id,
    (A.filterFor('L', dA.c) || {}).id + ' senza ruolo, ' + (B.filterFor('L', dA.c) || {}).id + ' con');

  /* 2 · SU UNA CAMERA A MATRICE IL VETRO DAVANTI AL SENSORE E' UNO SOLO. La scelta
     valeva per la L e non per l'RGB, e la prescrizione descriveva un'acquisizione
     impossibile: un filtro montato, due filtri nei conti. */
  const K2 = motore([], ['lum', 'idas', 'red', 'grn', 'blu'], { L: 'idas' });
  const osc = K2.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const mono = K2.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('su matrice il ruolo L governa anche il canale RGB: un vetro solo',
    (K2.filterFor('L', osc.c) || {}).id === 'idas' &&
    (K2.filterFor('RGB', osc.c) || {}).id === 'idas' &&
    (K2.bandSpec('RGB', osc.c).filter || {}).id === 'idas',
    'L → ' + (K2.filterFor('L', osc.c) || {}).id + ' · RGB → ' + (K2.filterFor('RGB', osc.c) || {}).id);
  /* Su monocromatica invece i filtri si cambiano davvero, e L e RGB sono due pose
     diverse: li' la scelta per la L non deve toccare il colore. Il ruolo con cui si
     prova dev'essere pero' uno che quella camera monta: l'anti-inquinamento e' un
     filtro da matrice e su un sensore mono non si avvita nemmeno per scelta. Si usa
     percio' l'UV/IR cut, che e' l'unico vetro del catalogo buono per tutt e due, e
     resta una scelta vera perche' l'automatico, da solo, monterebbe l'altro. */
  const K3 = motore([], ['lum', 'uvir', 'idas', 'red', 'grn', 'blu'], { L: 'lum' });
  const K3auto = motore([], ['lum', 'uvir', 'idas', 'red', 'grn', 'blu']);
  const mono3 = K3.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('mentre su monocromatica restano due pose diverse, e il colore non segue la L',
    (K3.filterFor('L', mono3.c) || {}).id === 'lum' &&
    (K3.filterFor('RGB', mono3.c) || {}).id === 'grn',
    'L → ' + (K3.filterFor('L', mono3.c) || {}).id + ' · RGB → ' + (K3.filterFor('RGB', mono3.c) || {}).id);
  chk('  e li la scelta e una scelta: senza, l automatico monterebbe un altro vetro',
    (K3auto.filterFor('L', mono3.c) || {}).id !== 'lum',
    'senza ruolo → ' + (K3auto.filterFor('L', mono3.c) || {}).id);

  /* 3 · E IL DUAL CHE RACCOGLIE INSIEME e' quello montato, non il piu' selettivo
     che possiedi. Prima la posa del canale che decide l'immagine veniva calcolata
     per un filtro diverso da quello dichiarato. */
  const RUOTAD = ['lult', 'lext', 'red', 'grn', 'blu'];
  const senza = motore([], RUOTAD, {});
  const conExt = motore([], RUOTAD, { L: 'lext' });
  const o1 = senza.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  chk('il dual montato e quello scelto, non il piu selettivo in ruota',
    (senza.dualPass(o1.c) || {}).id === 'lult' && (conExt.dualPass(o1.c) || {}).id === 'lext',
    'automatico → ' + (senza.dualPass(o1.c) || {}).id + ' · scelto lext → ' + (conExt.dualPass(o1.c) || {}).id);
  chk('e la posa del gruppo lo segue', senza.bandSpec('Ha+OIII', o1.c).fwhm === 3 &&
    conExt.bandSpec('Ha+OIII', o1.c).fwhm === 7,
    'fwhm ' + senza.bandSpec('Ha+OIII', o1.c).fwhm + ' nm contro ' +
    conExt.bandSpec('Ha+OIII', o1.c).fwhm + ' nm');

  /* 4 · UN BROADBAND MULTIBAND NON SERVE LE RIGHE COME CANALI SEPARATI. L-QEF
     dichiarava `bands: [Hb,OIII,Ha,SII]` — che sono le righe che PASSA — e cosi'
     risultava fornire i canali Ha, OIII e SII: con il solo L-QEF in ruota la SHO
     compariva senza filtri mancanti. Su un sensore a colori quelle righe arrivano
     insieme, nella stessa posa, e non si separano. Le finestre restano dichiarate:
     descrivono cosa passa, non cosa il filtro sa fare da solo. */
  const K4 = motore([], ['lqef']);
  const d4 = K4.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  chk('un broadband multiband non fornisce Ha, OIII e SII come canali',
    !K4.filterFor('Ha', d4.c) && !K4.filterFor('OIII', d4.c) && !K4.filterFor('SII', d4.c),
    'Ha → ' + ((K4.filterFor('Ha', d4.c) || {}).id || 'nessuno'));
  chk('ma serve il ruolo di banda larga, che e cio per cui e venduto',
    (K4.filterFor('L', d4.c) || {}).id === 'lqef', 'L → ' + (K4.filterFor('L', d4.c) || {}).id);
  chk('e le sue finestre restano leggibili riga per riga',
    K4.filterWindows(K4.DB.filters.find(f => f.id === 'lqef')).length === 4,
    'quattro finestre, e windowFor le trova ancora per banda');
  const t4 = K4.TG.targets.find(x => /6888/.test(x.names.join(' ')));
  const st4 = { ...SITO }; st4.fwhm = K4.effFWHM(1.6, 0.6);
  const np4 = K4.nightProfile(new Date(2026, 8, 11), st4.lat, st4.lon);
  const e4 = K4.evaluate(t4, d4, st4, np4, {}, 'full');
  chk('e il motore dichiara quali canali gli mancano', (e4.missing || []).length > 0,
    'mancanti: ' + JSON.stringify(e4.missing));
}

// ═══════════════════════════════════════════════════════════════════════════
H('I · MULTIBANDA E ANTI-INQUINAMENTO SONO PER I SENSORI A MATRICE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La pratica e' univoca: con una monocromatica si riprende con banda stretta
     singola — Ha, OIII, SII — piu' LRGB. I dual, i tri, i quad e gli anti-inquinamento
     esistono per le camere a colori.

     Per i multibanda c'e' anche la ragione fisica, e adesso il motore la calcola: su
     una monocromatica il silicio e' pancromatico, quindi ogni posa raccoglie il cielo
     di TUTTE le finestre e restituisce una riga sola. Su una matrice di Bayer no: i
     fotositi rossi vedono una finestra e i blu-verdi l'altra, ed e' esattamente per
     questo che quei filtri sono stati inventati. */
  const RUOTA = ['ha3', 'o3_3', 's2_3', 'lum', 'red', 'grn', 'blu', 'idas', 'lult', 'lext', 'lqef'];
  const K = motore([], RUOTA);
  const mono = K.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const cfa = K.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const perMatrice = K.DB.filters.filter(f => f.for_cfa).map(f => f.id);
  chk('il catalogo dichiara quali filtri sono per la matrice', perMatrice.length >= 15,
    perMatrice.length + ' filtri, fonte dichiarata: la pratica');

  const sceltiMono = ['L', 'Ha', 'OIII', 'SII', 'RGB'].map(b => (K.filterFor(b, mono.c) || {}).id);
  chk('su monocromatica nessuno di quelli finisce montato',
    sceltiMono.every(id => perMatrice.indexOf(id) < 0),
    ['L', 'Ha', 'OIII', 'SII', 'RGB'].map((b, i) => b + '→' + sceltiMono[i]).join(' '));
  chk('e non esiste nessun dual-pass da dichiarare', K.dualPass(mono.c) === null);
  chk('mentre su matrice il dual c e, ed e per questo che esiste',
    !!K.dualPass(cfa.c), 'dualPass → ' + (K.dualPass(cfa.c) || {}).id);

  /* Non e' una sparizione: il filtro resta in catalogo e resta spuntabile. Se e'
     l'unica cosa che hai su una monocromatica, il motore ti dice che quel canale non
     lo puoi fare — che e' la verita', non un rifiuto. */
  const soloDual = motore([], ['lult']);
  const dvS = soloDual.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('con il solo dual su monocromatica il motore dichiara che non puoi',
    !soloDual.filterFor('Ha', dvS.c) && !soloDual.filterFor('OIII', dvS.c),
    'Ha → nessuno, OIII → nessuno');
  const dvC = soloDual.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  chk('e sulla stessa ruota, con una camera a colori, si puo eccome',
    !!soloDual.filterFor('Ha', dvC.c) && !!soloDual.dualPass(dvC.c),
    'Ha → ' + (soloDual.filterFor('Ha', dvC.c) || {}).id);

  /* LA RAGIONE FISICA, misurata dove resta raggiungibile: un multi-finestra aggiunto
     a mano, che nessuno ha marcato per la matrice, usato su una monocromatica. */
  const due = { id: 'g_due', name: 'Due finestre', band: 'dual', dual: true, bands: ['Ha', 'OIII'],
    user: true, peak_t: 0.9,
    windows: [W({ fwhm_nm: 7, lines: [{ band: 'OIII', lambda_nm: 500.68 }] }),
              W({ fwhm_nm: 7, lines: [{ band: 'Ha', lambda_nm: 656.28 }] })] };
  const una = { ...due, id: 'g_una', bands: ['Ha'], dual: false,
    windows: [W({ fwhm_nm: 7, lines: [{ band: 'Ha', lambda_nm: 656.28 }] })] };
  const Kd = motore([due], ['g_due']), Ku = motore([una], ['g_una']);
  const dd = Kd.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const rd = Kd.rates(dd, 'Ha', 20.8), ru = Ku.rates(dd, 'Ha', 20.8);
  chk('su mono il cielo di un canale somma tutte le finestre del filtro',
    rd.R_b > ru.R_b * 1.8, F(rd.R_b, 5) + ' contro ' + F(ru.R_b, 5) +
    ' con una finestra sola — x' + F(rd.R_b / ru.R_b, 2));
  chk('mentre il segnale della riga chiesta resta identico',
    Math.abs(rd.k - ru.k) / ru.k < 0.01, F(rd.k, 5) + ' contro ' + F(ru.k, 5));
  /* Su matrice invece la maschera separa, e il costo non c'e'. */
  const dcfa = Kd.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const rdc = Kd.rates(dcfa, 'Ha', 20.8), ruc = Ku.rates(dcfa, 'Ha', 20.8);
  chk('e su matrice quel costo non esiste: la maschera le separa',
    Math.abs(rdc.R_b - ruc.R_b) / ruc.R_b < 0.01,
    F(rdc.R_b, 6) + ' contro ' + F(ruc.R_b, 6));
}

// ════════════════════════════════════════════════════════════════════════════
H('J · E AL CONTRARIO: LA BANDA STRETTA SINGOLA E L LRGB SONO DA MONOCROMATICA');
// ════════════════════════════════════════════════════════════════════════════
{
  /* La sezione I dice che multibanda e anti-inquinamento sono per i sensori a
     matrice. La regola vale nei due sensi, e questo e' l'altro: una camera a colori
     con la matrice di Bayer non monta un Ha da 3 nm, un OIII, un SII, e non monta
     nemmeno i canali L, R, G, B. Non perche' sia vietato: perche' non si fa.

     Il perche' e' la maschera. Alla riga dell'Ha risponde circa un fotosito su
     quattro, quindi tre quarti del sensore stanno al buio per tutta la posa. E i
     canali R, G, B davanti a una matrice che i colori li separa gia' li rifanno una
     seconda volta, buttando via lo stesso tre quarti per niente. */
  const MONOSOLO = ['ha3', 'o3_3', 's2_3', 'lum', 'red', 'grn', 'blu'];
  const Kj = motore([], MONOSOLO);
  const perMono = Kj.DB.filters.filter(f => f.for_mono).map(f => f.id);
  chk('il catalogo dichiara quali filtri sono da monocromatica', perMono.length >= 15,
    perMono.length + ' filtri, fonte dichiarata: la pratica');
  const entrambe = Kj.DB.filters.filter(f => !f.for_mono && !f.for_cfa).map(f => f.id);
  chk('e resta dichiarato chi puo stare davanti a tutt e due i sensori',
    entrambe.length > 0 && entrambe.every(id => !/^(ha|o3|s2)/.test(id)),
    'per entrambe: ' + entrambe.join(' ') + ' — nessun narrowband fra questi');

  const mono = Kj.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const cfa = Kj.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });

  /* Sulle righe la camera a colori non ha niente da avvitare, e il motore lo dice
     invece di sostituire in silenzio un vetro qualunque. */
  const righe = ['Ha', 'OIII', 'SII'];
  const suCfa = righe.map(b => Kj.filterFor(b, cfa.c));
  chk('con una ruota da mono, su matrice le righe non hanno filtro',
    suCfa.every(f => !f), righe.map((b, i) => b + '→' + (suCfa[i] ? suCfa[i].id : 'nessuno')).join(' '));
  const suMono = righe.map(b => Kj.filterFor(b, mono.c));
  chk('  mentre sulla monocromatica la stessa ruota le apre tutte',
    suMono.every(f => !!f), righe.map((b, i) => b + '→' + (suMono[i] ? suMono[i].id : 'nessuno')).join(' '));

  /* E sulla banda larga la risposta giusta non e' «la luminanza»: e' «niente». */
  const lC = Kj.filterFor('L', cfa.c), rgbC = Kj.filterFor('RGB', cfa.c);
  chk('e sulla banda larga la matrice riprende nuda, che e la sua acquisizione vera',
    lC && lC.id === '__none' && rgbC && rgbC.id === '__none',
    'L → ' + (lC || {}).id + ', RGB → ' + (rgbC || {}).id);
  chk('  mentre la monocromatica monta la luminanza e i tre canali',
    (Kj.filterFor('L', mono.c) || {}).id === 'lum' && !!Kj.filterFor('RGB', mono.c),
    'L → lum, RGB → ' + (Kj.filterFor('RGB', mono.c) || {}).id);

  /* NEMMENO PER SCELTA ESPLICITA, e vale nei due versi. Il ruolo e' sovrano su
     quello che il motore avrebbe deciso da solo, non sul vetro: `ROLES` in
     interfaccia e' gia' per camera, ma una scelta salvata prima della regola, o
     rimasta appesa a una camera cambiata sotto, arriverebbe fin qui. */
  const conRuolo = (roles, wheel) => motore([], wheel, roles);
  const Ka = conRuolo({ L: 'ha3' }, ['ha3', 'idas']);
  const cfaA = Ka.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  const monoA = Ka.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  chk('un Ha da 3 nm scelto a mano non si avvita su una matrice',
    (Ka.filterFor('L', cfaA.c) || {}).id !== 'ha3',
    'ruolo L = ha3 → ' + (Ka.filterFor('L', cfaA.c) || {}).id + ' (si torna alla scelta automatica)');
  chk('  e sulla monocromatica quella stessa scelta viene onorata',
    (Ka.filterFor('L', monoA.c) || {}).id === 'ha3', 'ruolo L = ha3 → ha3');
  const Kb = conRuolo({ L: 'lult' }, ['lult', 'lum']);
  const monoB = Kb.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const cfaB = Kb.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  chk('e nell altro verso: un dual scelto a mano non si avvita su una monocromatica',
    (Kb.filterFor('L', monoB.c) || {}).id !== 'lult',
    'ruolo L = lult → ' + (Kb.filterFor('L', monoB.c) || {}).id);
  chk('  mentre sulla matrice quella scelta e la sua ragione d essere',
    (Kb.filterFor('L', cfaB.c) || {}).id === 'lult' && !!Kb.dualPass(cfaB.c),
    'ruolo L = lult → lult, e dualPass lo dichiara');

  /* LA RAGIONE FISICA, misurata dove resta raggiungibile: un Ha da 3 nm aggiunto a
     mano, che nessuno ha marcato per la monocromatica, usato davanti a una matrice.
     Il segnale che arriva e' quello del quarto di fotositi che a 656 nm risponde, e
     il tempo per lo stesso SNR si moltiplica. Questo numero non e' un'opinione sulla
     pratica: e' la pratica che diventa un conto. */
  const libero = { id: 'z_ha3', name: 'Ha 3 nm senza etichetta', band: 'Ha', user: true,
    peak_t: 0.9, fwhm_source: 'measured',
    windows: [W({ fwhm_nm: 3, peak_t: 0.9, lines: [{ band: 'Ha', lambda_nm: 656.28 }] })] };
  const Kf = motore([libero], ['z_ha3']);
  const fm = Kf.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
  const fc = Kf.derive({ tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'am5', bin: 1 });
  chk('senza etichetta il filtro sta davanti a tutt e due, ed e giusto cosi',
    (Kf.filterFor('Ha', fm.c) || {}).id === 'z_ha3' && (Kf.filterFor('Ha', fc.c) || {}).id === 'z_ha3',
    'la regola sta nei dati, non in un divieto scritto nel motore');
  const ra = Kf.rates(fm, 'Ha', 20.8), rb = Kf.rates(fc, 'Ha', 20.8);
  const TSj = 600;
  const tM = Kf.varRate(ra, TSj, 0) / (ra.collect * ra.collect);
  const tC = Kf.varRate(rb, TSj, 0) / (rb.collect * rb.collect);
  console.log('       Ha 3 nm, stesso tubo: segnale mono ' + F(ra.k, 4) +
    ', matrice ' + F(rb.k, 4) + '  (x' + F(rb.k / ra.k, 3) + ')');
  chk('e alla matrice arriva solo la frazione di fotositi che a 656 nm risponde',
    rb.k / ra.k < 0.45, 'x' + F(rb.k / ra.k, 3) + ' del segnale della monocromatica');
  chk('  che in tempo per lo stesso SNR vale un fattore grande, non un dettaglio',
    tC / tM > 4, 'la matrice impiega x' + F(tC / tM, 2) + ' del tempo della monocromatica');
}

// ════════════════════════════════════════════════════════════════════════════
H('K · QUANDO UN CANALE MANCA, IL MOTIVO CHE SI LEGGE DEV ESSERE QUELLO VERO');
// ════════════════════════════════════════════════════════════════════════════
{
  /* La card di una tecnica non percorribile diceva «quanto costi non si sa»: vero e
     inutile. Adesso dice PERCHE', e il perche' lo calcola `perCheManca` guardando il
     catalogo — non la sola ruota. Sono tre risposte diverse e vanno tenute distinte,
     perche' una sola sbagliata manda a comprare una cosa che non esiste, o dice che
     non esiste una cosa che l'app stessa elenca:

       nessun filtro del catalogo serve quel sensore  ->  non esiste, e' un fatto
       esiste ma non ce l'hai                         ->  si nomina, cosi' sai cosa
       ce l'hai ma la banda e' spenta                 ->  e' una tua scelta, si riaccende

     `perCheManca` vive nella fetta UI, quindi si estrae dal sorgente e si esegue
     contro il motore e il catalogo VERI: cosi' la prova non e' su una copia. */
  const K = motore([], []);
  const uiSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .split('<script>')[1].split('</script>')[0];
  const i0 = uiSrc.indexOf('function perCheManca(');
  chk('la funzione che spiega esiste', i0 >= 0);
  const corpo = uiSrc.slice(i0, uiSrc.indexOf('\n}', i0) + 2);
  const ctxK = { DB: K.DB, OWNED: [], adattoA: K.adattoA, selectivity: K.selectivity, esc: x => x };
  const perCheManca = new Function(...Object.keys(ctxK),
    corpo + '\nreturn perCheManca;')(...Object.values(ctxK));
  const cfa = K.DB.cameras.find(c => c.id === 'asi2600mc');
  const mono = K.DB.cameras.find(c => c.id === 'asi2600mm');
  const conRuota = v => { ctxK.OWNED.length = 0; v.forEach(x => ctxK.OWNED.push(x)); };
  /* La ruota va cambiata DENTRO il contesto della funzione, non fuori. */
  const perChe = (b, cam, ruota) => {
    const c2 = { ...ctxK, OWNED: (ruota || []).slice() };
    return new Function(...Object.keys(c2), corpo + '\nreturn perCheManca;')
      (...Object.values(c2))(b, cam);
  };

  /* 1 · R, G e B davanti a una matrice di Bayer: non e' che non ce l'hai, e' che non
     esistono. Un sensore che i colori li separa gia' non si riprende con tre filtri
     colore, e infatti il catalogo non ne ha nemmeno uno marcato per la matrice. */
  for (const b of ['R', 'G', 'B']) {
    const m = perChe(b, cfa, K.DB.default_filters);
    chk('  ' + b + ' su matrice: il motivo e che non esistono', /non esistono filtri/.test(m), m);
  }
  /* E la premessa si verifica invece di darla per buona. */
  const senzaCfa = K.DB.filters.filter(f => (f.band === 'R' || (f.bands || []).includes('R')) && K.adattoA(f, cfa));
  chk('  e infatti il catalogo non ne elenca nessuno per la matrice', senzaCfa.length === 0);

  /* 2 · IL SII SU MATRICE NON E' LO STESSO CASO, ed e' l'errore che questa sezione
     esiste per impedire. Un duo-banda SII+OIII per camere a colori esiste e sta in
     catalogo: dire «non esistono filtri SII per OSC» sarebbe smentito dall'elenco
     filtri dell'app stessa, e manderebbe via chi invece potrebbe comprarlo. */
  const duoSII = K.DB.filters.filter(f => (f.band === 'SII' || (f.bands || []).includes('SII')) && K.adattoA(f, cfa));
  chk('esiste in catalogo un filtro che apre il SII su una matrice',
    duoSII.length > 0, duoSII.map(f => f.name).join(', '));
  const mSII = perChe('SII', cfa, K.DB.default_filters);
  chk('  quindi il motivo NON e «non esistono»', !/non esistono/.test(mSII), mSII);
  chk('  ed e nominato quello che ti servirebbe',
    duoSII.some(f => mSII.indexOf(f.name) >= 0), mSII);

  /* 3 · Posseduto e adatto ma non montato: e' una scelta di chi riprende, e il testo
     deve rimandare li' invece di far credere a una mancanza. */
  const mSpento = perChe('Ha', mono, ['ha3', 'lum']);
  chk('quando il filtro ce l hai, il motivo e che la banda e spenta',
    /spento/.test(mSpento) && !/non esistono|serve un filtro/.test(mSpento), mSpento);

  /* 4 · E il nome del sensore e' quello che usa chi riprende. */
  chk('il testo chiama le cose come le chiama chi riprende',
    /OSC/.test(mSII) && /monocromatica/.test(perChe('SII', mono, ['lum'])),
    mSII + '  ·  ' + perChe('SII', mono, ['lum']));

  /* 5 · Nessuna risposta vuota, su nessuna banda e su nessuno dei due sensori. */
  let vuote = 0;
  for (const b of ['Ha', 'OIII', 'SII', 'L', 'R', 'G', 'B'])
    for (const cam of [cfa, mono])
      for (const ruota of [[], K.DB.default_filters, ['lum'], ['lult']]) {
        const m = perChe(b, cam, ruota);
        if (!m || typeof m !== 'string' || m.length < 8) vuote++;
      }
  chk('e non esiste combinazione che resti senza spiegazione', vuote === 0,
    56 + ' combinazioni banda x sensore x ruota, ' + vuote + ' senza risposta');
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
process.exit(ko ? 1 : 0);
