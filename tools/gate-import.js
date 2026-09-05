/* GATE — LO STRATO IMPORTATO: BARNARD, LYNDS, DOBASHI
   ═══════════════════════════════════════════════════════════════════════════

   Verifica le invarianti dell'importazione. Non che l'importatore giri: che il
   file che produce rispetti le regole per cui e' stato scritto.

   La regola madre e' una sola, e da lei discendono quasi tutte le altre:
   l'appartenenza a un catalogo NON e' una classe fisica. «B 33» significa che
   nel 1919 li' si vedeva scuro su una lastra blu — un'affermazione
   sull'estinzione lungo la linea di vista, non sulla natura dell'oggetto. La
   Testa di Cavallo e' un oggetto Barnard e si fotografa in Ha, perche' e' una
   silhouette contro IC 434: una regola per catalogo sbaglierebbe proprio la
   nebulosa oscura piu' fotografata del cielo.                                */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let ok = 0, ko = 0;
const chk = (what, cond, extra) => {
  if (cond) { ok++; console.log('  ok   ' + what + (extra ? '   [' + extra + ']' : '')); }
  else { ko++; console.log(' FAIL  ' + what + (extra ? '   [' + extra + ']' : '')); }
};
const H = t => console.log('\n--- ' + t + ' ---');

const P = path.join(ROOT, 'data', 'darkcat.json');
if (!fs.existsSync(P)) {
  console.log('  data/darkcat.json assente: eseguire  node tools/import-dark.js');
  process.exit(1);
}
const D = JSON.parse(fs.readFileSync(P, 'utf8'));
const F = Object.fromEntries(D.fields.map((f, i) => [f, i]));
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
const TG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'targets.json'), 'utf8'));
const O = D.objects;
const norm = x => String(x).toLowerCase().replace(/[\s_'’-]+/g, '');
const frase = i => i == null ? null : (D.phrases || [])[i];

// ═══════════════════════════════════════════════════════════════════════════
H('A - provenienza e ripetibilita');
// ═══════════════════════════════════════════════════════════════════════════
chk('il file dichiara la fonte e la licenza', !!(D.source && D.license && D.license_url),
  D.license);
chk('e l attribuzione richiesta dalla licenza', Array.isArray(D.attribution) && D.attribution.length >= 3,
  (D.attribution || []).length + ' riferimenti con bibcode');
chk('ogni fonte porta interrogazione, data e conteggio',
  Array.isArray(D.provenance) && D.provenance.length >= 4 &&
  D.provenance.every(p => p.source && p.query && p.rows > 0 && p.bibcode),
  (D.provenance || []).map(p => p.source + ':' + p.rows).join(' · '));
chk('e la data di costruzione', /^\d{4}-\d{2}-\d{2}$/.test(D.built || ''), D.built);

// ═══════════════════════════════════════════════════════════════════════════
H('B - nessuna classe dedotta dal solo catalogo');
// ═══════════════════════════════════════════════════════════════════════════
{
  const conClasse = O.filter(o => o[F.cls]);
  chk('ogni classe fisica cita l evidenza su cui poggia',
    conClasse.every(o => frase(o[F.clsBasis])),
    conClasse.length + '/' + O.length + ' classificati');
  chk('e ogni classificato porta almeno un elemento di evidenza',
    conClasse.every(o => (o[F.ev] || []).length > 0));
  chk('la confidenza e sempre dichiarata, e mai «curato»',
    conClasse.every(o => o[F.clsConf] && o[F.clsConf] !== 'curato'),
    [...new Set(conClasse.map(o => o[F.clsConf]))].join(', '));
  const senza = O.filter(o => !o[F.cls]);
  chk('chi non ha evidenza sufficiente resta senza classe', senza.length > 0,
    senza.length + ' oggetti, di cui LBN a dominante rossa: ' +
    senza.filter(o => o[F.cat] === 'LBN').length);
}

// ═══════════════════════════════════════════════════════════════════════════
H('C - nessuna emissione dedotta: niente banda stretta');
// ═══════════════════════════════════════════════════════════════════════════
{
  const RIGHE = ['Ha', 'OIII', 'SII'];
  const classiConRighe = Object.entries(TG.archetypes)
    .filter(([k, a]) => Object.entries(a.default_budget || {})
      .some(([b, v]) => v.critical && RIGHE.includes(b)))
    .map(([k]) => k);
  const colpevoli = O.filter(o => classiConRighe.includes(o[F.cls]));
  chk('nessun oggetto importato riceve una classe a banda stretta',
    colpevoli.length === 0,
    colpevoli.length ? colpevoli.slice(0, 5).map(o => o[F.desig] + '=' + o[F.cls]).join(', ')
                     : 'classi presenti: ' + [...new Set(O.map(o => o[F.cls]).filter(Boolean))].join(', '));
  /* Il caso limite: le LBN piu' brillanti sul rosso. Il colore di Palomar dice
     «rosso», non «Ha»: potrebbe essere un continuo arrossato, e la differenza
     decide la ripresa. Restano senza classe. */
  const rosse = O.filter(o => o[F.cat] === 'LBN' && o[F.raw] && o[F.raw].color >= 3);
  chk('le LBN a dominante rossa restano senza classe', rosse.every(o => !o[F.cls]),
    rosse.length + ' oggetti');
}

// ═══════════════════════════════════════════════════════════════════════════
H('D - il curato prevale, e B33 resta quello che era');
// ═══════════════════════════════════════════════════════════════════════════
{
  const cur = new Set();
  for (const o of CAT.objects) {
    cur.add(norm(o.name));
    (o.aliases || []).forEach(a => cur.add(norm(a)));
  }
  const collisioni = O.filter(o =>
    cur.has(norm(o[F.desig])) || (o[F.xref] || []).some(x => cur.has(norm(x))));
  chk('nessun oggetto importato collide con una scheda curata',
    collisioni.length === 0,
    collisioni.length ? collisioni.slice(0, 5).map(o => o[F.desig]).join(', ')
                      : CAT.objects.length + ' curati intatti');

  const b33 = CAT.objects.find(o => (o.aliases || []).some(a => norm(a) === 'b33'));
  chk('B33 e ancora nel catalogo curato', !!b33, b33 ? b33.name : '—');
  if (b33) {
    chk('e ancora classificato come regione HII', b33.archetype === 'hii_classic', b33.archetype);
    chk('con la fisica della silhouette scritta',
      /silhouette|assorbimento/i.test(b33.physics || ''));
    chk('e non compare fra gli importati',
      !O.some(o => norm(o[F.desig]) === 'b33' || (o[F.xref] || []).some(x => norm(x) === 'b33')));
  }
  /* Gli altri due oscuri curati devono restare curati. */
  for (const nm of ['Barnard 150', 'LDN 1251', 'vdB 152']) {
    const c = CAT.objects.find(o => o.name === nm);
    chk(nm + ' resta curato e non importato',
      !!c && !O.some(o => norm(o[F.desig]) === norm(nm)),
      c ? c.archetype : 'assente dal curato');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('E - nessun duplicato, e i riferimenti incrociati tengono');
// ═══════════════════════════════════════════════════════════════════════════
{
  const visto = new Map();
  const dup = [];
  for (const o of O) {
    const ks = [norm(o[F.desig])].concat((o[F.xref] || []).map(norm));
    for (const k of ks) {
      if (visto.has(k) && visto.get(k) !== o[F.desig]) dup.push(k + ': ' + visto.get(k) + ' / ' + o[F.desig]);
      visto.set(k, o[F.desig]);
    }
  }
  chk('nessuna designazione compare su due oggetti diversi', dup.length === 0,
    dup.length ? dup.slice(0, 4).join(' | ') : visto.size + ' chiavi distinte');
  const conRif = O.filter(o => (o[F.xref] || []).length);
  chk('i riferimenti incrociati sono conservati', conRif.length > 500,
    conRif.length + ' oggetti con almeno un riferimento');
  /* La preferenza di designazione: dove esiste un numero Barnard e' lui a
     comparire, perche' e' quello che un astrofotografo riconosce. */
  /* Un oggetto puo' avere piu' numeri Barnard — un complesso che copre B 142 e
     B 143 — quindi averne uno fra i riferimenti e' legittimo. Quello che non deve
     succedere e' che un Barnard resti fra i riferimenti mentre in testa c e una
     designazione meno riconoscibile. */
  const relegati = O.filter(o =>
    /^(LDN|TGU)\s/i.test(String(o[F.desig])) &&
    (o[F.xref] || []).some(x => /^B\s*\d+[a-z]?$/i.test(String(x))));
  chk('nessun numero Barnard resta dietro a una designazione meno nota',
    relegati.length === 0,
    relegati.length ? relegati.slice(0, 4).map(o => o[F.desig] + ' <- ' + o[F.xref].join(',')).join(' | ')
                    : O.filter(o => /^B\s/.test(String(o[F.desig]))).length + ' Barnard in testa');
}

// ═══════════════════════════════════════════════════════════════════════════
H('F - geometria: provenienza dichiarata, angolo ignoto');
// ═══════════════════════════════════════════════════════════════════════════
{
  chk('ogni oggetto dichiara la provenienza della propria geometria',
    O.every(o => o[F.geom]),
    JSON.stringify(O.reduce((a, o) => (a[o[F.geom]] = (a[o[F.geom]] || 0) + 1, a), {})));
  chk('nessun angolo di posizione: non lo fornisce nessuna delle fonti',
    O.every(o => o[F.pa_deg] == null));
  const derivate = O.filter(o => o[F.geom] === 'derivata-da-area');
  chk('le geometrie derivate sono marcate come tali', derivate.length > 0,
    derivate.length + ' oggetti LDN, cerchio di area equivalente');
  chk('e sono circolari, perche il catalogo non da un rapporto d assi',
    derivate.every(o => !o[F.size_arcmin] || o[F.size_arcmin][0] === o[F.size_arcmin][1]));
  const galattiche = O.filter(o => o[F.geom] === 'riquadro-galattico');
  chk('il riquadro di Dobashi e dichiarato come tale', galattiche.length > 0,
    galattiche.length + ' oggetti: assi galattici, non assi dell oggetto');
}

// ═══════════════════════════════════════════════════════════════════════════
H('G - niente e stato scartato per dimensione, luminosita o Av');
// ═══════════════════════════════════════════════════════════════════════════
{
  const dim = o => { const s = o[F.size_arcmin]; return s ? Math.max(s[0], s[1]) : null; };
  const piccoli = O.filter(o => dim(o) != null && dim(o) < 20).length;
  chk('gli oggetti sotto i venti primi ci sono', piccoli > 100,
    piccoli + ' oggetti: il benchmark fotografico ne ha 13 su 20 sotto quella soglia');
  const bassoAv = O.filter(o => o[F.raw] && o[F.raw].Av != null && o[F.raw].Av < 3).length;
  chk('e quelli a bassa estinzione anche', bassoAv > 100,
    bassoAv + ' oggetti con Av < 3');
  const deboli = O.filter(o => o[F.raw] && o[F.raw].bright >= 5).length;
  chk('e le nebulose diffuse piu deboli pure', deboli > 100,
    deboli + ' con luminosita 5-6: sono quelle che la comunita cerca di piu');
  const flagged = O.filter(o => o[F.raw] && o[F.raw].flag === 1);
  chk('i marcati incerti dalla fonte sono mantenuti, non eliminati', flagged.length > 0,
    flagged.length + ' oggetti, con l incertezza fra le evidenze');
  chk('e la loro incertezza e registrata come evidenza',
    flagged.every(o => (o[F.ev] || []).some(e => /qualita/i.test(frase(e[0]) || ''))));
}

// ═══════════════════════════════════════════════════════════════════════════
H('H - i grumi restano sottostruttura');
// ═══════════════════════════════════════════════════════════════════════════
{
  const grumi = O.filter(o => /P\d+$/.test(String(o[F.num] || '')));
  chk('nessun grumo e diventato un bersaglio autonomo', grumi.length === 0);
  const conConteggio = O.filter(o => o[F.raw] && o[F.raw].clumps > 0);
  chk('ma il loro numero resta sulla nube madre', conConteggio.length > 0,
    conConteggio.length + ' nubi dichiarano quanti grumi contengono');
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
process.exit(ko ? 1 : 0);
