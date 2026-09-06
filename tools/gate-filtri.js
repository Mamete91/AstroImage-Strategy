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
     timeFactor,skyRateFor,filterWindows,windowFor,windowLambda,bandWidth,bandWidthNota,
     bandWidthFonte,selectivity,ownedFilters,dualPass,imageYield,planNights,exposurePlan,
     subExposure,DB:DB,TG:TG,ruoli:r=>{ROLES=r||{};}};`)(...Object.values(ctx));
  M.ruoli(roles || {});
  return M;
}
const SITO = { lat: 46.0167, lon: 10.3333, sqm: 20.5, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
const sano = v => typeof v === 'number' && isFinite(v);
const W = o => o;

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
    const numeri = [e.roadHTot, e.nights, e.weeks, e.score, pr.spent, y.P]
      .concat(Object.values(e.budget).map(b => b.useful))
      .concat(Object.values(e.budget).map(b => b.factor));
    const male = numeri.filter(x => !sano(x)).length;
    if (male) rotti.push(etichetta + '/' + cam + ': ' + male + ' numeri non finiti');
    /* «Non escluso» significa che il motore lo trova quando lo cerca per una delle
       sue bande: un filtro valido non deve sparire perche' gli manca un parametro. */
    const bande = f.bands || [f.band];
    const trovato = bande.some(b => { const ff = M.filterFor(b, dv.c); return ff && ff.id === f.id; });
    if (!trovato) esclusi.push(etichetta + '/' + cam);
  }
  chk('il campionario copre le tipologie del commercio', CAMPIONARIO.length >= 8,
    CAMPIONARIO.map(x => x.etichetta.split(' ')[0]).join(', '));
  chk('tutte attraversano la catena', esaminati === CAMPIONARIO.length * 2,
    esaminati + ' passaggi su ' + CAMPIONARIO.length * 2);
  chk('nessun NaN, nessun Infinity, nessuna eccezione', rotti.length === 0,
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
  let rispettati = 0;
  for (const [id, che] of casi) for (const cam of ['asi2600mm', 'asi2600mc']) {
    const M = motore([], ruota, { L: id });
    const dv = M.derive({ tel: 'rc8', red: 1, cam, mnt: 'am5', bin: 1 });
    const ff = M.filterFor('L', dv.c);
    if (ff && ff.id === id) rispettati++;
    else chk('il ruolo L resta ' + id + ' su ' + cam, false, 'ha scelto ' + (ff && ff.id));
  }
  chk('ogni scelta esplicita del ruolo L viene rispettata', rispettati === casi.length * 2,
    rispettati + ' su ' + casi.length * 2 + ' — ' + casi.map(c => c[0]).join(', ') + ', mono e colori');

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
  chk('e con lui solo in ruota la prescrizione esce sana',
    sano(e.roadHTot) && sano(e.nights) && sano(pr.spent) && pr.alloc.every(g => sano(g.hours)),
    'progetto ' + F(e.roadHTot) + ' h · notti ' + F(e.nights, 1) + ' · canali ' +
    pr.alloc.filter(g => !g.dropped).map(g => g.id).join('+'));
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
process.exit(ko ? 1 : 0);
