#!/usr/bin/env node
/* IMPORTAZIONE DEI CATALOGHI DI NEBULOSE OSCURE E DIFFUSE
   ═══════════════════════════════════════════════════════════════════════════

   Costruisce data/darkcat.json da quattro cataloghi CDS/VizieR:

     VII/220A   Barnard 1927        349 oggetti oscuri, diametro
     VII/7A     Lynds dark (LDN)   1791 nubi oscure, area e opacita'
     VII/9      Lynds bright (LBN) 1125 nebulose diffuse, assi e colore
     VII/244A   Dobashi 2005       2216 nubi + 2830 grumi, Av MISURATO

   COSA QUESTO IMPORT NON FA, ed e' la parte importante.

   Non deduce una classe fisica dall'appartenenza a un catalogo. «Essere in
   Barnard» significa «nel 1919 si vedeva scuro su una lastra blu»: e'
   un'affermazione sull'estinzione lungo la linea di vista, non sulla fisica
   dell'oggetto. La classe qui viene assegnata solo dove esiste una MISURA —
   l'estinzione di Dobashi, l'opacita' di Lynds, il colore fotografico di
   Palomar — e porta sempre scritto su cosa poggia e con quanta confidenza.

   Non deduce emissione. Nessun oggetto importato riceve una prescrizione a
   banda stretta: per Ha, OIII e SII non esiste in questi cataloghi nessuna
   evidenza di riga. Una LBN «piu' brillante sulla lastra rossa» puo' essere
   Ha o puo' essere un continuo arrossato, e la differenza decide la ripresa:
   quegli oggetti restano senza classe invece di riceverne una inventata.

   Non scarta niente. Nessun oggetto viene escluso per dimensione, Av,
   luminosita' o assenza di riferimenti incrociati. Il benchmark fotografico
   raccolto dal web dimostra che quei filtri sarebbero sbagliati: fra i venti
   oggetti Barnard realmente fotografati tredici stanno sotto i venti primi —
   B33 ne misura quattro — e le LBN piu' celebrate sono le piu' deboli del
   catalogo, cercate proprio perche' difficili. `Flag` di Dobashi resta come
   informazione di qualita', non come criterio di eliminazione.

   Non crea bersagli dai grumi. I 2830 grumi di Dobashi sono sottostruttura
   dentro le nubi, alle stesse coordinate, e la fonte stessa li annida sotto la
   designazione madre: diventerebbero doppioni. Il loro numero resta sulla nube.

   PRECEDENZA. Il curato vince sempre. Un oggetto gia' presente in
   data/catalog.json — per nome o per alias — non viene importato, e la sua
   scheda non viene toccata. E' il motivo per cui B33 resta hii_classic con la
   fisica della silhouette, invece di diventare una nube oscura qualsiasi.

   RIPETIBILE. Ogni esecuzione riscrive il file per intero a partire dalle
   fonti, registrando query, data e conteggi nel manifesto. Due esecuzioni
   sulla stessa versione delle fonti danno lo stesso risultato.

   Uso:  node tools/import-dark.js            (scarica e costruisce)
         node tools/import-dark.js --dry      (non scrive, solo il resoconto)   */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'darkcat.json');
const DRY = process.argv.includes('--dry');

const UA = 'AstroImage-Strategy/1.1 (catalogue import; contact via repository)';
const BASE = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv';

/* Le quattro interrogazioni, dichiarate per esteso: sono la provenienza. */
const FONTI = {
  barnard: { src: 'VII/220A/barnard', max: 500,
             rif: 'Barnard E.E. 1927, Carnegie Inst. Washington',
             bibcode: '1927cbdo.book.....B' },
  ldn:     { src: 'VII/7A/ldn',       max: 2500,
             rif: 'Lynds B.T. 1962, ApJS 7, 1',
             bibcode: '1962ApJS....7....1L' },
  lbn:     { src: 'VII/9/catalog',    max: 2000,
             rif: 'Lynds B.T. 1965, ApJS 12, 163',
             bibcode: '1965ApJS...12..163L' },
  dobashi: { src: 'VII/244A/hclumps', max: 6000,
             rif: 'Dobashi K. et al. 2005, PASJ 57, S1',
             bibcode: '2005PASJ...57S...1D' },
  dobassoc:{ src: 'VII/244A/hassoc',  max: 3000,
             rif: 'Dobashi K. et al. 2005, PASJ 57, S1 — riferimenti incrociati',
             bibcode: '2005PASJ...57S...1D' }
};

const url = f => `${BASE}?-source=${f.src}&-out.max=${f.max}&-out.all`;

async function scarica(nome) {
  const f = FONTI[nome];
  const u = url(f);
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
  const txt = await r.text();
  if (/not a bot|Access Denied/i.test(txt.slice(0, 400)))
    throw new Error(`${nome}: la fonte ha risposto con una pagina di controllo, non con i dati`);
  return { txt, url: u };
}

/* Il TSV di VizieR: righe di commento, poi intestazione, unita', separatore.

   LA RIGA DELLE UNITA' NON E' DECORAZIONE, e ignorarla e' costato caro: VizieR
   rende `_RA.icrs` in due formati diversi a seconda del catalogo, e lo DICHIARA
   proprio li'.

     Barnard  VII/220A   "h:m:s"   03 32 57.4
     LDN      VII/7A     "h:m:s"   16 28 51.5
     LBN      VII/9      "h:m:s"   17 45 10.5
     Dobashi  VII/244A   "deg"     246.0562

   Le unita' vengono quindi lette e portate avanti, e la conversione le usa invece
   di indovinare dal numero di campi. Indovinare avrebbe funzionato su queste
   quattro fonti; leggerle funziona anche sulla quinta. */
function righe(txt) {
  const L = txt.split('\n').filter(l => l && !l.startsWith('#'));
  const i = L.findIndex(l => l.indexOf('recno') === 0);
  if (i < 0) { const v = []; v.units = {}; return v; }
  const hdr = L[i].split('\t').map(s => s.trim());
  const uni = (L[i + 1] || '').split('\t').map(s => s.trim().replace(/^"+|"+$/g, ''));
  const units = {};
  hdr.forEach((h, k) => units[h] = uni[k] || '');
  const out = L.slice(i + 3).map(l => {
    const c = l.split('\t'); const o = {};
    hdr.forEach((h, k) => o[h] = (c[k] || '').trim());
    return o;
  }).filter(o => o.recno);
  out.units = units;
  return out;
}

const N = x => { const v = parseFloat(x); return isFinite(v) ? v : null; };
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
const r2 = x => x == null ? null : Math.round(x * 100) / 100;

/* Sessagesimale "hh mm ss.s" / "+dd mm ss" -> gradi. VizieR fornisce _RA.icrs
   e _DE.icrs gia' calcolate: qui si converte solo il formato, non il sistema. */
/* IL DIFETTO CHE QUESTA FIRMA CHIUDE.

   `hms2deg` moltiplicava per 15 qualunque cosa ricevesse. Su Barnard, LDN e LBN —
   sessagesimali — e' giusto. Su Dobashi, che arriva in gradi decimali, ogni
   ascensione retta usciva quindici volte troppo grande: 246.0562 diventava
   3690.843. Erano 2214 record su 4499, cioe' meta' del catalogo oscuro nel posto
   sbagliato del cielo — e con essa visibilita', altezza sull'orizzonte e
   separazione dalla Luna.

   Duemilacentocinquantatre' si vedevano, perche' superavano i 360 gradi. SESSANTUNO
   no: quelli con ascensione retta vera sotto le 24 gradi restavano sotto la soglia
   e sembravano validi. Sono il motivo per cui questa correzione non poteva essere
   «taglia i fuori scala»: andava corretta la conversione, e rifatto l'import. */
function hms2deg(s, unit) {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  const p = t.split(/\s+/).map(parseFloat);
  if (!p.length || !isFinite(p[0])) return null;
  // l'unita' dichiarata dalla fonte vince; in sua assenza decide la forma
  const gradi = unit ? /deg/i.test(unit) : p.length === 1;
  if (gradi) return p[0];
  return (p[0] + (p[1] || 0) / 60 + (p[2] || 0) / 3600) * 15;
}
/* La declinazione si e' salvata per caso: un valore decimale in un solo campo
   somma a se' stesso e viene fuori giusto. Resta un caso fortunato, e le fortune
   non si lasciano nel codice: anche qui l'unita' e' esplicita. */
function dms2deg(s, unit) {
  if (!s) return null;
  const t = String(s).trim();
  const neg = /^-/.test(t);
  const p = t.replace(/^[+-]/, '').split(/\s+/).map(parseFloat);
  if (!p.length || !isFinite(p[0])) return null;
  const gradi = unit ? /deg/i.test(unit) : p.length === 1;
  const v = gradi ? p[0] : (p[0] + (p[1] || 0) / 60 + (p[2] || 0) / 3600);
  return neg ? -v : v;
}

/* La normalizzazione dei nomi: la stessa di tools/lib/enrich.js, perche' le due
   deduplicazioni devono vedere le stesse collisioni. */
const norm = x => String(x).toLowerCase().replace(/[\s_'’-]+/g, '');

/* Le forme sotto cui un oggetto puo' comparire altrove. «Barnard 150» e «B150»
   sono lo stesso oggetto, e il catalogo curato usa entrambe. */
function chiavi(cat, num) {
  /* Barnard ha voci con suffisso letterale — B 67a e' un oggetto diverso da B 67.
     Spogliare la lettera creava due chiavi diverse per lo stesso oggetto: il ramo
     LDN registrava «B 67a» fra i riferimenti ma deduplicava su «b67». */
  const n = String(num).trim().toLowerCase().replace(/^0+(?=\d)/, '');
  if (cat === 'B')   return ['b' + n, 'barnard' + n];
  if (cat === 'LDN') return ['ldn' + n, 'l' + n, 'lynds' + n];
  if (cat === 'LBN') return ['lbn' + n];
  if (cat === 'TGU') return ['tgu' + n.toLowerCase()];
  return [norm(cat + n)];
}

// ═══════════════════════════════════════════════════════════════════════════
(async function main() {
  console.log('IMPORT — nebulose oscure e diffuse\n');

  /* ── 1 · le fonti ────────────────────────────────────────────────────── */
  const dati = {}, manifesto = [];
  for (const nome of Object.keys(FONTI)) {
    process.stdout.write('  scarico ' + nome.padEnd(10));
    const { txt, url } = await scarica(nome);
    const R = righe(txt);
    dati[nome] = R;
    manifesto.push({ id: nome, source: FONTI[nome].src, ref: FONTI[nome].rif,
                     bibcode: FONTI[nome].bibcode, query: url, rows: R.length });
    console.log(R.length + ' righe' +
      (R.units && R.units['_RA.icrs'] ? '   _RA in ' + R.units['_RA.icrs'] : ''));
  }
  /* Le unita' dichiarate da ciascuna fonte, raccolte in un posto solo: e' quello
     che la conversione consulta invece di indovinare. */
  const U = {};
  for (const nome of Object.keys(FONTI))
    U[nome] = { _RA: (dati[nome].units || {})['_RA.icrs'] || '',
                _DE: (dati[nome].units || {})['_DE.icrs'] || '' };
  console.log('  unita lette: ' + Object.entries(U)
    .map(([k, v]) => k + ' ' + (v._RA || '?')).join('  ') + '\n');

  /* ── 2 · il curato, che ha la precedenza ─────────────────────────────── */
  const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const curato = new Set();
  for (const o of CAT.objects) {
    curato.add(norm(o.name));
    (o.aliases || []).forEach(a => curato.add(norm(a)));
  }
  console.log('\n  catalogo curato: ' + CAT.objects.length + ' oggetti, ' +
              curato.size + ' chiavi da rispettare');

  /* OpenNGC copre NGC/IC: non contiene nessuno di questi cataloghi (verificato),
     ma la guardia resta perche' costa niente e protegge da una fonte futura. */
  const ongcPath = path.join(ROOT, 'data', 'openngc.json');
  const ongcKeys = new Set();
  if (fs.existsSync(ongcPath)) {
    const O = JSON.parse(fs.readFileSync(ongcPath, 'utf8'));
    const F = Object.fromEntries(O.fields.map((f, i) => [f, i]));
    for (const a of O.objects) {
      ongcKeys.add(norm(a[F.name]));
      (a[F.aliases] || []).forEach(x => ongcKeys.add(norm(x)));
    }
  }

  /* ── 3 · Dobashi: le associazioni, che sono i riferimenti incrociati ──── */
  const assocPer = new Map();          // TGU(+grumo) -> [nomi]
  for (const a of dati.dobassoc) {
    const k = (a.TGU || '').trim() + ((a.Clump || '').trim() ? '/' + a.Clump.trim() : '');
    const nome = (a.Names || '').trim();
    if (!k || !nome) continue;
    (assocPer.get(k) || assocPer.set(k, []).get(k)).push(nome);
  }

  /* ── 4 · costruzione ─────────────────────────────────────────────────── */
  const out = [];
  const visti = new Set();             // chiavi gia' emesse da questo import
  const saltati = { curato: 0, ongc: 0, interno: 0, grumi: 0 };

  const gia = ks => ks.some(k => curato.has(k) || ongcKeys.has(k) || visti.has(k));
  const segna = ks => ks.forEach(k => visti.add(k));

  /* Un record. `ev` sono le evidenze: cosa sappiamo e da dove. `cls` la classe
     fisica, che esiste solo se un'evidenza la sostiene. */
  const rec = (o) => { out.push(preferisci(o)); segna(o.keys); };

  /* QUALE DESIGNAZIONE MOSTRARE. Lo stesso oggetto porta piu' numeri: la Nebulosa
     Serpente e' B 72 per chiunque la fotografi, ma nel merge arriva da LDN 66
     perche' Lynds viene prima nell'ordine di deduplicazione. L'ordine con cui si
     fondono i cataloghi e' una questione di completezza del dato; quale nome
     mostrare e' una questione di riconoscibilita', e sono due cose diverse.
     Barnard batte Lynds, che batte la sigla di Tokyo Gakugei: e' l'ordine in cui
     un astrofotografo le riconosce. Nessun dato si perde — le altre designazioni
     restano fra i riferimenti, e la ricerca le indicizza tutte. */
  const RANGO = { 'B ': 0, 'LDN ': 1, 'LBN ': 2, 'TGU ': 3 };
  const rango = d => { for (const p in RANGO) if (d.indexOf(p) === 0) return RANGO[p]; return 9; };
  function preferisci(o) {
    const cand = [o.desig].concat(
      (o.xref || []).map(x => {
        const m = String(x).match(/^(LDN|LBN|B)\s*0*(\d+[a-z]?)$/i);
        return m ? m[1].toUpperCase() + ' ' + m[2].toLowerCase() : null;
      }).filter(Boolean));
    if (cand.length < 2) return o;
    const best = cand.slice().sort((a, b) => rango(a) - rango(b))[0];
    if (best === o.desig) return o;
    o.xref = cand.filter(x => x !== best).concat(
      (o.xref || []).filter(x => !/^(LDN|LBN|B)\s*0*\d+[a-z]?$/i.test(String(x))));
    o.desig = best;
    o.cat = best.indexOf('B ') === 0 ? 'Barnard'
          : best.indexOf('LDN ') === 0 ? 'LDN'
          : best.indexOf('LBN ') === 0 ? 'LBN' : o.cat;
    o.num = best.replace(/^[A-Z]+\s*/i, '');
    return o;
  }

  // ── 4a · Dobashi, per primo: e' l'unico con una misura fisica ──────────
  let nubi = 0;
  for (const d of dati.dobashi) {
    if ((d.Clump || '').trim()) { saltati.grumi++; continue; }   // sottostruttura
    const tgu = (d.TGU || '').trim();
    if (!tgu) continue;
    const ks = chiavi('TGU', tgu);
    const xref = (assocPer.get(tgu) || []).map(s => s.replace(/[:\[\]].*$/, '').trim()).filter(Boolean);
    const xkeys = xref.flatMap(x => {
      const m = x.match(/^(LDN|B|LBN)\s*0*(\d+)/i);
      return m ? chiavi(m[1].toUpperCase(), m[2]) : [norm(x)];
    });
    if (gia(ks.concat(xkeys))) { saltati.curato++; continue; }

    const av = N(d.Av), dav = N(d.dAv);
    const a1 = N(d.dGLON), a2 = N(d.dGLAT);
    rec({
      keys: ks.concat(xkeys),
      desig: 'TGU ' + tgu, cat: 'Dobashi', num: tgu,
      ra_deg: r3(hms2deg(d['_RA.icrs'], U.dobashi._RA)), dec_deg: r3(dms2deg(d['_DE.icrs'], U.dobashi._DE)),
      /* Estensioni lungo gli assi GALATTICI, non assi di un'ellisse: il riquadro
         e' orientato dalla griglia di misura, non dalla nube. L'angolo di
         posizione dell'oggetto resta ignoto, ed e' cosi' che va usato. */
      size_arcmin: (a1 && a2) ? [r2(Math.max(a1, a2) * 60), r2(Math.min(a1, a2) * 60)] : null,
      geom: 'riquadro-galattico', pa_deg: null,
      raw: { Av: av, Av2: N(d.Av2), dAv: dav, area_deg2: N(d.S),
             SAv: N(d.SAv), clumps: N(d.Ncl), Nc: N(d.Nc), flag: N(d.Flag) },
      xref,
      cls: av != null ? 'dark_molecular' : null,
      clsConf: 'da collaudare',
      clsBasis: av != null
        ? 'estinzione visuale misurata (Av ' + av + ' mag) su mappa di conteggi stellari DSS'
        : 'nessuna misura disponibile',
      ev: [
        av != null ? { what: 'estinzione', from: 'Dobashi VII/244A',
                       value: 'Av ' + av + ' mag' + (dav ? ' ± ' + dav : ''), conf: 'misurato' } : null,
        N(d.Nc) ? { what: 'notorieta', from: 'riscontri in letteratura',
                    value: N(d.Nc) + ' cataloghi indipendenti', conf: 'misurato' } : null,
        N(d.Flag) === 1 ? { what: 'qualita', from: 'Dobashi VII/244A',
                            value: 'incertezza elevata dichiarata dalla fonte', conf: 'dichiarato' } : null
      ].filter(Boolean)
    });
    nubi++;
  }

  // ── 4b · LDN: opacita', ma nessun asse ─────────────────────────────────
  let ldn = 0;
  for (const l of dati.ldn) {
    const num = N(l.LDN); if (num == null) continue;
    const ks = chiavi('LDN', num);
    const barn = (l.Barn || '').trim();
    const bk = barn ? chiavi('B', barn) : [];
    if (gia(ks.concat(bk))) { saltati.interno++; continue; }
    const area = N(l.Area), op = N(l.Opacity);
    /* Il catalogo da' SOLO l'area. Un rapporto d'assi non c'e', e inventarlo
       sarebbe falsa precisione: si emette il cerchio di area equivalente e lo si
       dichiara derivato. */
    const d = area != null && area > 0 ? r2(2 * Math.sqrt(area / Math.PI) * 60) : null;
    rec({
      keys: ks.concat(bk),
      desig: 'LDN ' + num, cat: 'LDN', num: String(num),
      ra_deg: r3(hms2deg(l['_RA.icrs'], U.ldn._RA)), dec_deg: r3(dms2deg(l['_DE.icrs'], U.ldn._DE)),
      size_arcmin: d ? [d, d] : null,
      geom: 'derivata-da-area', pa_deg: null,
      raw: { area_deg2: area, opacity: op },
      xref: barn ? ['B ' + barn] : [],
      cls: op != null ? 'dark_molecular' : null,
      clsConf: 'da collaudare',
      clsBasis: op != null
        ? 'opacita fotografica ' + op + '/6 stimata su lastra (Lynds 1962)'
        : 'nessuna misura disponibile',
      ev: [
        op != null ? { what: 'opacita', from: 'LDN VII/7A', value: op + '/6', conf: 'stimato' } : null,
        barn ? { what: 'notorieta', from: 'riferimento incrociato', value: 'Barnard ' + barn, conf: 'misurato' } : null
      ].filter(Boolean)
    });
    ldn++;
  }

  // ── 4c · Barnard: un diametro, nient'altro ─────────────────────────────
  let bar = 0;
  for (const b of dati.barnard) {
    const num = (b.Barn || '').trim(); if (!num) continue;
    const ks = chiavi('B', num);
    if (gia(ks)) { saltati.interno++; continue; }
    const dia = N(b.Diam);
    rec({
      keys: ks,
      desig: 'B ' + num, cat: 'Barnard', num,
      ra_deg: r3(hms2deg(b['_RA.icrs'], U.lbn._RA)), dec_deg: r3(dms2deg(b['_DE.icrs'], U.lbn._DE)),
      /* Un diametro solo: l'oggetto e' circolare per quanto il catalogo sappia. */
      size_arcmin: dia ? [dia, dia] : null,
      geom: 'catalogo-diametro', pa_deg: null,
      raw: { diam_arcmin: dia },
      xref: [],
      /* Barnard non misura niente: elenca macchie scure su lastra. E' comunque
         un'osservazione di estinzione, ma senza numero — confidenza bassa. */
      cls: 'dark_molecular', clsConf: 'da collaudare',
      clsBasis: 'oscuramento osservato su lastra fotografica (Barnard 1927), senza misura di estinzione',
      ev: [{ what: 'oscuramento', from: 'Barnard VII/220A', value: 'macchia scura catalogata', conf: 'osservato' }]
    });
    bar++;
  }

  // ── 4d · LBN: assi veri e un colore che dice qualcosa ──────────────────
  let lbn = 0, lbnSenzaClasse = 0;
  for (const b of dati.lbn) {
    const num = N(b.Seq); if (num == null) continue;
    const ks = chiavi('LBN', num);
    const altro = (b.Name || '').trim();
    const ak = altro ? [norm(altro)] : [];
    if (gia(ks.concat(ak))) { saltati.curato++; continue; }
    const col = N(b.Color), br = N(b.Bright);
    const d1 = N(b.Diam1), d2 = N(b.Diam2);
    /* Il colore di Palomar e' una misura fotografica: piu' brillante sul blu
       significa luce stellare diffusa dalla polvere, cioe' riflessione. Piu'
       brillante sul rosso puo' essere Ha OPPURE un continuo arrossato, e la
       differenza decide la ripresa: li' la classe resta vuota, perche' dedurre
       una riga da un rapporto fra due lastre sarebbe inventarla. */
    const cls = (col === 1 || col === 2) ? 'reflection' : null;
    if (!cls) lbnSenzaClasse++;
    rec({
      keys: ks.concat(ak),
      desig: 'LBN ' + num, cat: 'LBN', num: String(num),
      ra_deg: r3(hms2deg(b['_RA.icrs'], U.barnard._RA)), dec_deg: r3(dms2deg(b['_DE.icrs'], U.barnard._DE)),
      size_arcmin: (d1 && d2) ? [Math.max(d1, d2), Math.min(d1, d2)] : (d1 ? [d1, d1] : null),
      geom: 'catalogo-assi', pa_deg: null,
      raw: { diam1_arcmin: d1, diam2_arcmin: d2, area_deg2: N(b.Area),
             color: col, bright: br, complex: N(b.ID) },
      xref: altro ? [altro] : [],
      cls, clsConf: cls ? 'da collaudare' : null,
      clsBasis: col === 1 ? 'piu brillante sulla lastra blu di Palomar: continuo stellare diffuso'
              : col === 2 ? 'ugualmente brillante sulle due lastre di Palomar'
              : col === 3 ? 'piu brillante sulla lastra rossa: emissione o continuo arrossato, la riga non e identificabile'
              : col === 4 ? 'visibile solo sulla lastra rossa: emissione probabile, ma la riga non e identificabile'
              : 'colore non determinato',
      ev: [
        col != null ? { what: 'colore fotografico', from: 'LBN VII/9',
                        value: ['', 'blu dominante', 'blu e rosso pari', 'rosso dominante', 'solo rosso'][col] || String(col),
                        conf: 'misurato' } : null,
        br != null ? { what: 'luminosita', from: 'LBN VII/9', value: br + '/6', conf: 'stimato' } : null,
        altro ? { what: 'notorieta', from: 'riferimento incrociato', value: altro, conf: 'misurato' } : null
      ].filter(Boolean)
    });
    lbn++;
  }

  /* ── 5 · resoconto ───────────────────────────────────────────────────── */
  console.log('\n  ══ importati ══');
  console.log('    Dobashi (nubi)     ' + String(nubi).padStart(5));
  console.log('    LDN                ' + String(ldn).padStart(5));
  console.log('    Barnard            ' + String(bar).padStart(5));
  console.log('    LBN                ' + String(lbn).padStart(5) +
              '   di cui senza classe: ' + lbnSenzaClasse + ' (rosso dominante, riga non identificabile)');
  console.log('    ------------------------');
  console.log('    totale             ' + String(out.length).padStart(5));
  console.log('\n  ══ non importati ══');
  console.log('    grumi (sottostruttura)        ' + String(saltati.grumi).padStart(5));
  console.log('    gia coperti dal curato        ' + String(saltati.curato).padStart(5));
  console.log('    gia emessi da questo import   ' + String(saltati.interno).padStart(5));

  const conClasse = out.filter(o => o.cls).length;
  const conXref = out.filter(o => o.xref.length).length;
  const conAv = out.filter(o => o.raw && o.raw.Av != null).length;
  const flagged = out.filter(o => o.raw && o.raw.flag === 1).length;
  console.log('\n  ══ integrita ══');
  console.log('    con classe fisica sostenuta da evidenza: ' + conClasse + '/' + out.length);
  console.log('    con riferimenti incrociati:              ' + conXref);
  console.log('    con estinzione misurata:                 ' + conAv);
  console.log('    marcati incerti dalla fonte (mantenuti): ' + flagged);
  console.log('    con prescrizione a banda stretta:        0  (nessuna evidenza di riga)');

  /* ── 6 · scrittura, in forma compatta ────────────────────────────────── */
  /* Le motivazioni della classe e le etichette delle evidenze sono una manciata
     di frasi ripetute migliaia di volte: in chiaro pesano piu' di un megabyte.
     Vanno in un dizionario e nel record resta l'indice. Nessuna informazione si
     perde, e chi legge il file trova le frasi per esteso in testa. */
  const dizio = [];
  const cod = t => { if (t == null) return null;
    let i = dizio.indexOf(t); if (i < 0) { i = dizio.length; dizio.push(t); } return i; };
  for (const o of out) {
    o.clsBasis = cod(o.clsBasis);
    o.ev = (o.ev || []).map(e => [cod(e.what), cod(e.from), e.value, cod(e.conf)]);
  }

  const FIELDS = ['desig', 'cat', 'num', 'ra_deg', 'dec_deg', 'size_arcmin', 'geom',
                  'pa_deg', 'cls', 'clsConf', 'clsBasis', 'raw', 'xref', 'ev'];
  const doc = {
    source: 'CDS / VizieR — Barnard, Lynds (LDN, LBN), Dobashi',
    license: 'CC BY — attribuzione obbligatoria, nessun obbligo di condivisione allo stesso modo',
    license_url: 'https://cds.unistra.fr/vizier-org/licences_vizier.html',
    attribution: manifesto.map(m => m.ref + '  [' + m.bibcode + ']')
      .filter((v, i, a) => a.indexOf(v) === i),
    note: 'Strato catalografico. Nessuna classe dedotta dalla sola appartenenza a un ' +
          'catalogo, nessuna emissione dedotta, nessun oggetto scartato per dimensione ' +
          'o luminosita. Il catalogo curato ha sempre la precedenza. I grumi di Dobashi ' +
          'sono sottostruttura e non diventano bersagli: il loro numero resta sulla nube madre.',
    built: new Date().toISOString().slice(0, 10),
    provenance: manifesto,
    fields: FIELDS,
    /* `clsBasis` e i primi/ultimi due campi di ogni evidenza sono indici in questo
       elenco: [cosa, da dove, valore, confidenza]. */
    phrases: dizio,
    ev_fields: ['what', 'from', 'value', 'conf'],
    objects: out.map(o => FIELDS.map(f => o[f] === undefined ? null : o[f]))
  };

  if (DRY) { console.log('\n  --dry: nessun file scritto'); return; }
  fs.writeFileSync(OUT, JSON.stringify(doc), 'utf8');
  console.log('\n  scritto ' + path.relative(ROOT, OUT) + '  ' +
              Math.round(fs.statSync(OUT).size / 1024) + ' KB');
})().catch(e => { console.error('\n  ERRORE: ' + e.message); process.exit(1); });
