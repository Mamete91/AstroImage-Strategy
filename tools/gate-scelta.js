/* GATE — COME SI SCEGLIE LA STRADA, E CHI LA VINCOLA
   ═══════════════════════════════════════════════════════════════════════════

   Due regole, e vanno tenute separate perche' rispondono a domande diverse:

     I FILTRI dicono quali tecniche sono POSSIBILI. Senza un SII non esiste una
     SHO; con un dual-band davanti a una camera a colori, Ha e OIII arrivano nella
     stessa posa e non si separano.

     LE ORE dicono quale, fra quelle possibili, ha senso stanotte. Possedere un SII
     non significa che la SHO vada bene con sei ore: la scheda del Crescent chiede
     diciotto ore «e la disciplina di dare al SII le sue».

   Il difetto che questo gate impedisce di tornare: la scelta fra le tecniche
   possibili avveniva con TRE passate in sequenza — la piu' ricca che completi, poi
   la piu' ricca il cui livello accessibile entra, poi quella il cui pavimento
   entra — e ognuna scandiva l'elenco ordinato per ricchezza. Ogni passata presa da
   sola e' monotona; il salto FRA passate no, perche' `ideal > acc`, e quando la
   prima cominciava a scattare vinceva una strada PIU' POVERA di quella che stava
   vincendo con la seconda:

     M31   4.5 h  passata 2 -> lrgb_ha (ideale 8.2)
           5.0 h  passata 1 -> lrgb    (ideale 4.9)   mezz'ora in piu', un canale in meno
           8.5 h  passata 1 -> lrgb_ha (ideale 8.2)

   Adesso c'e' un criterio solo — la strada piu' ricca che riesci a COMPLETARE — e
   la monotonia esce dalla costruzione, non da una memoria della scelta precedente:
   l'insieme delle strade completabili cresce con le ore e non si restringe mai, e
   si prende sempre il massimo di un insieme che cresce.                          */

const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { M, DB, TG, CAT } = require('./lib/engine.js');

let ok = 0, ko = 0;
const chk = (what, cond, extra) => {
  if (cond) { ok++; console.log('  ok   ' + what + (extra ? '   [' + extra + ']' : '')); }
  else { ko++; console.log(' FAIL  ' + what + (extra ? '   [' + extra + ']' : '')); }
};
const H = t => console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '─'.repeat(Math.min(t.length, 78)));
const F = (x, n) => x == null ? '—' : Number(x).toFixed(n == null ? 1 : n);
const P = (s, n) => String(s).padEnd(n);

const sito = q => { const s = { lat: 46.0167, lon: 10.3333, sqm: q, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 }; s.fwhm = M.effFWHM(s.seeing, s.rms); return s; };
const D = new Date(2026, 8, 11);
const CFG = [
  ['RC8+MM', { tel: 'rc8', red: '1', cam: 'asi2600mm', mnt: 'cem70g', bin: 1 }],
  ['Tecno+MM', { tel: 'tecnosky115', red: 0.80, cam: 'asi2600mm', mnt: 'am5', bin: 1 }],
  ['Askar+MC', { tel: 'askar71f', red: 0.75, cam: 'asi2600mc', mnt: 'am5', bin: 1 }],
  ['RedCat+MC', { tel: 'redcat51', red: 0.92, cam: 'asi2600mc', mnt: 'am5', bin: 1 }],
];

// ═══════════════════════════════════════════════════════════════════════════
H('A · LA RICCHEZZA NON SCENDE MAI SALENDO DI ORE');
// ═══════════════════════════════════════════════════════════════════════════
{
  let passi = 0, cali = [], ritorni = [], cambi = 0, immotivati = [];
  for (const [lab, cfg] of CFG) for (const q of [21.3, 20.8, 18.5]) {
    const st = sito(q), np = M.nightProfile(D, st.lat, st.lon), dv = M.derive(cfg);
    for (const t of TG.targets) {
      let e; try { e = M.evaluate(t, dv, st, np, {}); } catch (err) { continue; }
      let prev = null; const visti = [];
      for (let h = 1; h <= 70; h += 0.5) {
        let pr; try { pr = M.prescribe(e, h, dv, 1); } catch (err) { continue; }
        const cur = { id: pr.road.id, ideal: pr.roadTotals.ideal, h };
        if (prev) {
          passi++;
          if (cur.ideal < prev.ideal - 1e-9 && cali.length < 4)
            cali.push(t.names[0] + '/' + lab + '/sqm' + q + ': ' + F(prev.h) + 'h ' + prev.id +
              ' (' + F(prev.ideal) + ') → ' + F(h) + 'h ' + cur.id + ' (' + F(cur.ideal) + ')');
          if (cur.id !== prev.id) {
            cambi++;
            if (visti.indexOf(cur.id) >= 0 && ritorni.length < 4)
              ritorni.push(t.names[0] + '/' + lab + ': torna a ' + cur.id + ' a ' + F(h) + 'h');
            visti.push(prev.id);
            /* Un cambio e' motivato se la strada nuova e' piu' ricca: e' l'unica
               ragione ammessa, dato che il criterio e' «la piu' ricca completabile». */
            if (cur.ideal < prev.ideal - 1e-9 && immotivati.length < 4)
              immotivati.push(t.names[0] + '/' + lab + ' a ' + F(h) + 'h');
          }
        }
        prev = cur;
      }
    }
  }
  console.log('       ' + passi + ' passi di mezz\'ora · ' + CFG.length + ' configurazioni x 3 cieli x ' +
    TG.targets.length + ' bersagli · ' + cambi + ' cambi di strada');
  chk('la ricchezza della strada non scende mai aggiungendo ore',
    cali.length === 0, cali.length ? cali.join(' · ') : 'zero cali su ' + passi + ' passi');
  chk('e non si torna mai a una strada gia lasciata',
    ritorni.length === 0, ritorni.length ? ritorni.join(' · ') : 'zero ritorni');
  chk('ogni cambio di strada va verso una tecnica piu ricca',
    immotivati.length === 0, immotivati.length ? immotivati.join(' · ') : cambi + ' cambi, tutti in salita');
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · I TRE BERSAGLI CHE RIMBALZAVANO');
// ═══════════════════════════════════════════════════════════════════════════
{
  const st = sito(20.8), np = M.nightProfile(D, st.lat, st.lon);
  const dv = M.derive(CFG[0][1]);
  for (const nome of ['Sh2-155', 'M27', 'M31']) {
    const t = TG.targets.find(x => x.names[0] === nome); if (!t) continue;
    const e = M.evaluate(t, dv, st, np, {});
    const seq = []; let prev = null, sceso = false, prevIdeal = -1;
    for (let h = 2; h <= 44; h += 0.5) {
      const pr = M.prescribe(e, h, dv, 1);
      if (pr.road.id !== prev) { seq.push(F(h) + 'h ' + pr.road.id); prev = pr.road.id; }
      if (pr.roadTotals.ideal < prevIdeal - 1e-9) sceso = true;
      prevIdeal = pr.roadTotals.ideal;
    }
    console.log('       ' + P(nome, 9) + seq.join('  →  '));
    chk(nome + ' sale e basta, senza rimbalzi', !sceso, seq.length + ' cambi');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · LE ORE NON POSSONO APRIRE UNA TECNICA CHE I FILTRI VIETANO');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La divisione dei compiti: i filtri dicono cosa e' possibile, le ore quale fra
     le possibili. Con la ruota ridotta, nessuna quantita' di ore deve far comparire
     una tecnica che quei filtri non permettono. */
  const pure = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const CIT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cities.json'), 'utf8'));
  const CATx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const RUOTA = DB.default_filters.slice();
  const ctx = { DB, TG, CAT: CATx.objects, CITIES: CIT.cities, OWNED: RUOTA,
    console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
  const Mx = new Function(...Object.keys(ctx), pure + `return {derive,evaluate,prescribe,
    nightProfile,effFWHM,filterFor,dualPass,setUsing:(v)=>{USING=v},getUsing:()=>USING};`)(...Object.values(ctx));

  const st = sito(20.8), np = Mx.nightProfile(D, st.lat, st.lon);
  const mono = Mx.derive(CFG[0][1]), osc = Mx.derive(CFG[2][1]);
  const cres = TG.targets.find(x => /6888/.test(x.names.join(' ')));
  const bande = pr => pr.alloc.filter(g => g.hours > 0).flatMap(g => g.bands || [g.id]);

  const conUso = (using, dv, ore) => { Mx.setUsing(using);
    const r = Mx.prescribe(Mx.evaluate(cres, dv, st, np, {}), ore, dv, 1);
    Mx.setUsing(null); return r; };

  /* Spento il SII, nessuna quantita' di ore deve riportare la SHO. */
  let sioSII = [];
  for (const h of [10, 20, 30, 45, 70, 120]) {
    const pr = conUso(['Ha', 'OIII', 'L', 'R', 'G', 'B'], mono, h);
    if (pr.road.id === 'sho' && !(pr.missing || []).length) sioSII.push(h + 'h');
  }
  chk('spento il SII, nessuna quantita di ore riporta la SHO',
    sioSII.length === 0, sioSII.length ? sioSII.join(' ') : 'provato fino a 120 h');

  /* E il colore delle stelle non deve cadere solo perche' hai spento la banda
     stretta: «RGB» e' il gruppo dei tre filtri colore, non una banda in ruota. */
  const conRGB = conUso(['Ha', 'OIII', 'L', 'R', 'G', 'B'], mono, 40);
  chk('spegnere una banda stretta non fa cadere il colore delle stelle',
    !(conRGB.starsDropped || []).length && bande(conRGB).indexOf('RGB') >= 0,
    'canali ' + conRGB.alloc.filter(g => g.hours > 0).map(g => g.id).join('+'));
  /* Mentre spegnere davvero R G B lo fa cadere, ed e' giusto. */
  const senzaRGB = conUso(['Ha', 'OIII'], mono, 40);
  chk('mentre spegnere R G B lo fa cadere, e lo dichiara',
    (senzaRGB.starsDropped || []).indexOf('RGB') >= 0, 'caduto ' + (senzaRGB.starsDropped || []).join(','));

  /* Spento tutto cio' che una tecnica richiede, la prescrizione arriva lo stesso e
     distingue «spento da te» da «non posseduto»: la cura e' un clic, non un
     acquisto. */
  const spento = conUso(['Ha', 'L', 'R', 'G', 'B'], mono, 40);
  chk('con la banda spenta la prescrizione arriva comunque',
    spento.alloc.some(g => g.hours > 0), 'strada ' + spento.road.id);
  chk('e il motore sa che l hai spenta tu, non che ti manca',
    (spento.missingOff || []).length > 0 && (spento.missingOff || []).indexOf('OIII') >= 0,
    'spente: ' + (spento.missingOff || []).join(','));

  /* Su dual-band la coppia resta coppia anche passando dai filtri. */
  Mx.setUsing(null);
  const dual = Mx.dualPass(osc.c);
  chk('la camera a colori riconosce il dual-band in ruota', !!dual, dual ? dual.name : 'nessuno');
  const po = Mx.prescribe(Mx.evaluate(cres, osc, st, np, {}), 40, osc, 1);
  const b = bande(po);
  chk('e su di essa Ha e OIII compaiono sempre insieme',
    (b.indexOf('Ha') >= 0) === (b.indexOf('OIII') >= 0), 'canali ' + b.join('+'));
  Mx.setUsing(null);
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · SU SENSORE BAYER IL COLORE NON È UN FILTRO IN RUOTA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Davanti a una camera a colori i vetri veri sono due famiglie: il narrow che
     apre le righe (L-Ultimate, L-eXtreme, ALP-T, NBZ, Duo-Band…) e il banda-larga
     che ripulisce il fondo cielo (LPS, L-Pro, CLS, UV/IR cut). Il colore non sta
     in ruota: lo fa la matrice di Bayer, ed è disponibile anche a ruota vuota.
     Il motore lo dice restituendo il filtro sentinella `__none`, e chi legge quella
     risposta non deve scambiarla per un'assenza. */
  const pure = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const CIT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cities.json'), 'utf8'));
  const CATx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const RUOTA = DB.default_filters.slice();
  const ctx = { DB, TG, CAT: CATx.objects, CITIES: CIT.cities, OWNED: RUOTA,
    console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
  const Mx = new Function(...Object.keys(ctx), pure + `return {derive,filterFor,dualPass,
    setUsing:(v)=>{USING=v}};`)(...Object.values(ctx));
  const ruota = v => { RUOTA.length = 0; v.forEach(x => RUOTA.push(x)); };
  const osc = Mx.derive(CFG[2][1]).c, mono = Mx.derive(CFG[0][1]).c;
  const vetro = (b, c) => { try { const f = Mx.filterFor(b, c); return f ? f.id : null; } catch (e) { return 'ERR'; } };

  chk('la camera di prova è davvero a colori', !!osc.cfa_penalty, osc.name);

  /* A ruota vuota: il narrow non c'è, il colore sì. */
  ruota([]);
  chk('a ruota vuota il sensore Bayer dà comunque il colore',
    vetro('RGB', osc) === '__none', 'RGB → ' + vetro('RGB', osc));
  chk('ma nessuna riga stretta si apre senza il suo vetro',
    vetro('Ha', osc) == null && vetro('OIII', osc) == null && vetro('SII', osc) == null);
  chk('sul monocromatico invece a ruota vuota non si raccoglie nulla',
    ['RGB', 'L', 'R', 'G', 'B', 'Ha'].every(b => vetro(b, mono) == null));

  /* Solo il dual-band: le due righe si aprono, il colore resta della matrice. */
  ruota(['lext']);
  chk('col solo L-eXtreme si aprono Ha e OIII',
    vetro('Ha', osc) === 'lext' && vetro('OIII', osc) === 'lext');
  chk('e il colore resta disponibile: era il caso che faceva sparire il riquadro',
    vetro('RGB', osc) === '__none', 'RGB → ' + vetro('RGB', osc));
  chk('il SII però no: quel vetro non ce l hai', vetro('SII', osc) == null);

  /* Il banda-larga non apre righe nuove: migliora le pose a colori. */
  for (const [id, nome] of [['idas', 'IDAS LPS P2'], ['lpro', 'Optolong L-Pro'],
                            ['cls', 'Astronomik CLS'], ['uvir', 'UV/IR cut']]) {
    ruota([id]);
    chk('il ' + nome + ' serve il colore, non le righe',
      vetro('RGB', osc) === id && vetro('Ha', osc) == null, 'RGB → ' + vetro('RGB', osc));
  }

  /* Fra due banda-larga vince il più selettivo: taglia più fondo cielo. */
  ruota(['idas', 'lpro', 'uvir']);
  const scelto = vetro('RGB', osc);
  const largh = DB.filters.find(f => f.id === scelto).fwhm_nm;
  chk('fra più banda-larga il motore prende il più selettivo',
    DB.filters.filter(f => ['idas', 'lpro', 'uvir'].indexOf(f.id) >= 0)
      .every(f => f.fwhm_nm >= largh), scelto + ' a ' + F(largh, 0) + ' nm');

  /* Il dual SII+OIII apre il sulfuro anche su camera a colori. */
  ruota(['askard2']);
  chk('il dual SII+OIII apre il sulfuro su sensore a colori',
    vetro('SII', osc) === 'askard2' && vetro('OIII', osc) === 'askard2');
  chk('ma non l idrogeno, che quel vetro non lascia passare', vetro('Ha', osc) == null);

  /* I riquadri R, G e B separati appartengono al monocromatico. */
  ruota(['red', 'grn', 'blu']);
  chk('sul monocromatico R, G e B sono tre decisioni distinte',
    vetro('R', mono) === 'red' && vetro('G', mono) === 'grn' && vetro('B', mono) === 'blu');
  ruota(DB.default_filters.slice());
  Mx.setUsing(null);
}

/* La lettura di `__none` sta nella fetta UI, fuori dal motore: la si verifica sul
   testo, perché un confronto di troppo rimetterebbe il difetto. */
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const da = html.indexOf('function bandePossedute');
  const corpo = da > 0 ? html.slice(da, da + 2200) : '';
  const fine = corpo.indexOf('\nfunction toggleBanda');
  chk('i riquadri non scartano la risposta «Bayer»',
    da > 0 && corpo.slice(0, fine > 0 ? fine : corpo.length).indexOf("!=='__none'") < 0,
    fine > 0 ? 'bandePossedute letta' : 'funzione non trovata');
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
if (ko) process.exitCode = 1;
module.exports = { ok, ko };
