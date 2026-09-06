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

// ═══════════════════════════════════════════════════════════════════════════
H('E · LA TECNICA LA PUÒ SCEGLIERE CHI RIPRENDE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* HOO e SHO sullo stesso oggetto non sono meglio e peggio: sono due immagini
     diverse. Il motore consiglia la piu' ricca che riesci a completare, ma resta
     un consiglio — e quando chi riprende ne vuole un'altra, tutto il resto deve
     seguirla, non solo un'etichetta.

     Qui si verifica che la scelta comandi davvero, e soprattutto che cosa NON
     riesce a scavalcare. */
  const pure = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const CIT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cities.json'), 'utf8'));
  const CATx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const RUOTA = DB.default_filters.slice();
  const ctx = { DB, TG, CAT: CATx.objects, CITIES: CIT.cities, OWNED: RUOTA,
    console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
  const Mx = new Function(...Object.keys(ctx), pure + `return {derive,evaluate,prescribe,
    nightProfile,effFWHM,dualPass,setUsing:(v)=>{USING=v}};`)(...Object.values(ctx));
  const ruota = v => { RUOTA.length = 0; v.forEach(x => RUOTA.push(x)); };

  const st = sito(20.8), np = Mx.nightProfile(D, st.lat, st.lon);
  const mono = Mx.derive(CFG[0][1]), osc = Mx.derive(CFG[2][1]);
  const cres = TG.targets.find(x => /6888/.test(x.names.join(' ')));
  const canali = pr => pr.alloc.filter(g => g.hours > 0).map(g => g.id).sort().join('+');
  const dai = (dv, ore, road) => Mx.prescribe(Mx.evaluate(cres, dv, st, np, {}), ore, dv, 1,
    road ? { road } : null);

  /* 1 · La scelta comanda, e comanda tutto quello che sta a valle. */
  const a = dai(mono, 14, null);
  const b = dai(mono, 14, 'sho');
  console.log('       automatica  ' + P(a.road.id, 6) + canali(a) + '   ' + a.level);
  console.log('       scelta SHO  ' + P(b.road.id, 6) + canali(b) + '   ' + b.level);
  chk('senza scelta decide il motore', a.roadPicked === false && a.roadAuto === a.road.id);
  chk('con la scelta la strada e quella voluta', b.road.id === 'sho' && b.roadPicked === true);
  chk('e i canali cambiano davvero, non solo l etichetta',
    canali(b).indexOf('SII') >= 0 && canali(a).indexOf('SII') < 0, canali(b));
  chk('il motore dichiara che cosa avrebbe scelto da solo',
    b.roadAuto === a.road.id && b.roadAutoSame === false, 'auto: ' + b.roadAuto);

  /* 2 · Scegliere non nasconde il prezzo: la SHO a 14 h non e' piena. */
  chk('una tecnica scelta ma non completabile lo dichiara',
    b.level !== 'pieno' && b.roadTotals.ideal > 14, b.level + ', ideale ' + F(b.roadTotals.ideal) + ' h');
  chk('e la prescrizione arriva lo stesso', b.alloc.some(g => g.hours > 0));

  /* 3 · Una strada che questo oggetto non ha viene ignorata, non rompe niente. */
  const c = dai(mono, 14, 'una_strada_che_non_esiste');
  chk('una tecnica che l oggetto non prevede torna all automatico',
    c.road.id === a.road.id && c.roadPicked === false, 'chiesta comunque: ' + c.roadRequested);

  /* 4 · La coppia del dual-band non si scavalca nemmeno scegliendo.
     Non e' una tecnica piu' povera: attraverso un dual Ha e OIII arrivano nella
     stessa posa, e sceglierne una sola descrive una ripresa che non esiste. */
  const sette = TG.targets.find(x => /7000/.test(x.names.join(' ')));
  ruota(['lult']);
  const dual = Mx.dualPass(osc.c);
  chk('la camera a colori ha un dual-band in ruota', !!dual, dual ? dual.name : 'nessuno');
  const eS = Mx.evaluate(sette, osc, st, np, {});
  const base = Mx.prescribe(eS, 40, osc, 1);
  const spezzata = (sette.roads || []).map(r => r.id)
    .find(id => (base.roadChoices || []).every(c => c.id !== id));
  const off = (base.roadChoices || []).map(c => c.id);
  console.log('       tecniche offerte su ' + sette.names[0] + ': ' + off.join(', '));
  if (spezzata) {
    const forz = Mx.prescribe(eS, 40, osc, 1, { road: spezzata });
    const ch = forz.alloc.filter(g => g.hours > 0).flatMap(g => g.bands || [g.id]);
    chk('la strada spezzata non e nemmeno offerta', off.indexOf(spezzata) < 0, spezzata);
    chk('e forzandola a mano la coppia resta comunque coppia',
      (ch.indexOf('Ha') >= 0) === (ch.indexOf('OIII') >= 0),
      'canali ' + ch.join('+'));
  } else {
    chk('su questo oggetto non ci sono strade spezzate da escludere', true, 'niente da provare');
    chk('(coppia gia verificata altrove)', true);
  }
  ruota(DB.default_filters);

  /* 5 · I filtri invece NON bloccano una scelta esplicita: la si prescrive e si
     dichiara che cosa manca. E' una decisione, non un errore del motore. */
  ruota(DB.default_filters.filter(x => x !== 's2_3' && x !== 's2_65' && x !== 's2_12'));
  const senzaSII = dai(mono, 40, null);
  chk('senza SII il motore da solo non propone la SHO', senzaSII.road.id !== 'sho',
    'sceglie ' + senzaSII.road.id);
  const forzata = dai(mono, 40, 'sho');
  chk('ma se la scegli tu la SHO si prescrive lo stesso',
    forzata.road.id === 'sho' && forzata.roadPicked === true);
  chk('e il motore dice che ti serve il SII',
    (forzata.missing || []).indexOf('SII') >= 0, 'manca: ' + (forzata.missing || []).join(','));
  chk('mentre in automatico non manca niente', (senzaSII.missing || []).length === 0);
  ruota(DB.default_filters);

  /* 6 · L'elenco che l'interfaccia rende premibile deve essere completo e sensato. */
  const el = a.roadChoices || [];
  chk('l elenco delle tecniche premibili non e vuoto', el.length >= 2, el.length + ' tecniche');
  chk('ogni voce porta nome, condizione e ore per farla piena',
    el.every(c => c.id && c.name && c.ideal > 0));
  chk('la strada in uso e sempre fra quelle offerte',
    el.some(c => c.id === a.road.id) && el.some(c => c.id === b.road.id));

  /* 7 · E scegliere non deve rompere la monotonia dell automatico: quella regola
     vive tutta nel ramo senza scelta, e va lasciata intatta. */
  let cadute = 0, prev = null;
  for (let h = 1; h <= 60; h += 0.5) {
    const p = dai(mono, h, null);
    const r = p.roadTotals.ideal;
    if (prev != null && r < prev - 1e-9) cadute++;
    prev = Math.max(prev == null ? r : prev, r);
  }
  chk('in automatico la ricchezza non retrocede al crescere delle ore', cadute === 0,
    cadute + ' cali su 119 passi');
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · NESSUN CANDIDATO VALIDO SPARISCE, E CHI SPARISCE LO DICE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* `fitAlternatives` scartava un candidato con `if(e2.missing.length) continue;`,
     e `e2.missing` sono — lo dice il commento che le calcola — le bande della STRADA
     DI DEFAULT per cui non hai un filtro. Ma `prescribe` sceglie fra le strade che la
     tua ruota permette: un candidato la cui strada di default chiede il SII poteva
     avere una prescrizione HOO perfettamente eseguibile, e spariva lo stesso.

     Con la ruota completa non succede mai, ed e' la ragione per cui nessuna verifica
     se ne accorgeva: tutte girano con `DB.default_filters`. Serve provarlo con un
     corredo parziale, che e' la norma. */
  const pure2 = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const CIT2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cities.json'), 'utf8'));
  const CAT2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const TG2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'targets.json'), 'utf8'));
  require(path.join(ROOT, 'tools', 'lib', 'enrich.js')).enrich(TG2, CAT2.objects, ROOT);
  const conRuota = ruota => {
    const RU = ruota.slice();
    const ctx2 = { DB, TG: TG2, CAT: CAT2.objects, CITIES: CIT2.cities, OWNED: RU,
      console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
    return new Function(...Object.keys(ctx2), pure2 + `return {derive,evaluate,prescribe,
      nightProfile,effFWHM,fitAlternatives,projectPanels};`)(...Object.values(ctx2));
  };
  const stF = { lat: 46.0167, lon: 10.3333, sqm: 20.8, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
  const CFGF = { tel: 'askar71f', red: 0.75, cam: 'asi2600mc', mnt: 'am5', bin: 1 };
  const conta = Mx => {
    const npF = Mx.nightProfile(D, stF.lat, stF.lon);
    stF.fwhm = Mx.effFWHM(1.6, 0.6);
    let inCl = 0, esc = 0, senzaMotivo = 0;
    for (const t of TG2.targets) for (const cov of ['full', 'framing']) {
      let a; try { a = Mx.fitAlternatives(t, CFGF, stF, npF, {}, 20, DB.presets, 99, 0, cov); }
      catch (e) { continue; }
      inCl += a.length;
      for (const x of (a.escluse || [])) { esc++; if (!x.manca || !x.manca.length) senzaMotivo++; }
    }
    return { inCl, esc, senzaMotivo };
  };

  /* 1 · con la ruota completa non cambia niente, e nessuno resta fuori. */
  const piena = conta(conRuota(DB.default_filters));
  chk('con la ruota completa nessun candidato resta fuori', piena.esc === 0,
    piena.inCl + ' in classifica');

  /* 2 · IL CANDIDATO VALIDO CHE PRIMA SPARIVA. Con il solo dual-band la strada di
     default di molte schede chiede il SII, che non hai: il veto vecchio li toglieva
     tutti, mentre la prescrizione che ne esce e' HOO ed e' eseguibile. */
  const Mdual = conRuota(['lult', 'idas']);
  const dual = conta(Mdual);
  /* Il termine di paragone e' il VETO VECCHIO ricostruito qui: quanti candidati
     sarebbero rimasti scartando su `e2.missing`, cioe' sulla strada di default.
     Una soglia assoluta non direbbe niente; questo confronto si', ed e' il difetto. */
  const npDual = Mdual.nightProfile(D, stF.lat, stF.lon);
  stF.fwhm = Mdual.effFWHM(1.6, 0.6);
  let vecchio = 0;
  for (const t of TG2.targets) for (const cov of ['full', 'framing'])
    for (const pz of DB.presets) for (const bin of [1, 2]) {
      let dv2; try { dv2 = Mdual.derive({ tel: pz.telescope, red: pz.reducer, cam: pz.camera, mount: pz.mount, mnt: pz.mount, bin }); } catch (e) { continue; }
      let e2; try { e2 = Mdual.evaluate(t, dv2, stF, npDual, {}, cov); } catch (e) { continue; }
      if (!(e2.missing || []).length) vecchio++;
    }
  console.log('       solo dual-band: ' + dual.inCl + ' in classifica ora, ' + vecchio +
    ' col veto vecchio, ' + dual.esc + ' esclusi dichiarati');
  chk('il veto vecchio toglieva candidati che ora restano', dual.inCl > vecchio,
    '+' + (dual.inCl - vecchio) + ' recuperati');
  /* La prova che sono VALIDI: la loro prescrizione non ha niente di mancante. */
  const npD = Mdual.nightProfile(D, stF.lat, stF.lon);
  stF.fwhm = Mdual.effFWHM(1.6, 0.6);
  /* Serve un bersaglio la cui strada di DEFAULT chiede un filtro che non hai: e'
     esattamente il caso in cui il veto vecchio scattava pur essendoci una strada
     percorribile. Con il solo dual-band sono NGC 7635, Sh2-155, IC 1805, IC 1396. */
  const cres2 = TG2.targets.find(x => /7635/.test(x.names.join(' ')));
  const aD = Mdual.fitAlternatives(cres2, CFGF, stF, npD, {}, 20, DB.presets, 99, 0, 'full');
  chk('e ogni candidato in classifica ha una prescrizione davvero eseguibile',
    aD.every(x => !(x.pr.missing || []).length), aD.length + ' su ' + cres2.names[0]);
  /* E la strada di default di quella scheda chiedeva davvero qualcosa che non hai:
     e' il caso in cui il veto vecchio scattava. */
  const eD = Mdual.evaluate(cres2, Mdual.derive(CFGF), stF, npD, {}, 'full');
  chk('mentre la strada di default chiedeva un filtro che non hai',
    (eD.missing || []).length > 0, cres2.names[0] + ': manca ' + (eD.missing || []).join(','));

  /* 3 · IL CANDIDATO DAVVERO INESEGUIBILE resta fuori, e con il motivo scritto. */
  chk('chi resta fuori e escluso perche la sua PRESCRIZIONE non e eseguibile',
    dual.esc > 0 && dual.senzaMotivo === 0,
    dual.esc + ' esclusi, tutti con il motivo');
  /* Su un bersaglio solo gli esclusi possono essere zero, e l'asserzione
     passerebbe a vuoto: si raccolgono su tutto il catalogo. */
  const escTutti = [];
  for (const t of TG2.targets) for (const cov of ['full', 'framing']) {
    let a; try { a = Mdual.fitAlternatives(t, CFGF, stF, npDual, {}, 20, DB.presets, 99, 0, cov); }
    catch (e) { continue; }
    for (const x of (a.escluse || [])) escTutti.push(x);
  }
  chk('ci sono davvero esclusi da esaminare', escTutti.length > 0, escTutti.length + ' su tutto il catalogo');
  chk('e ognuno dichiara che cosa gli manca e su quale strada',
    escTutti.length > 0 && escTutti.every(x => x.manca && x.manca.length && x.road),
    escTutti.length ? escTutti[0].preset.label + ' → manca ' + escTutti[0].manca.join(',') +
      ' sulla strada ' + escTutti[0].road : 'nessuno');

  /* 4 · il veto non guarda piu' la strada di default: verificato sul sorgente,
     perche' e' un ritorno indietro di una riga. */
  const src2 = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  /* Il codice, non il commento che lo racconta: il difetto e' descritto qui sopra
     fra apici inversi, e una regex ingenua ci ricascava. */
  chk('il veto non si fonda piu su e2.missing',
    !/[^`]if\(e2\.missing\.length\) continue;/.test(src2) &&
    /pr\.missing&&pr\.missing\.length/.test(src2), 'si fonda su pr.missing');
  chk('e l interfaccia dichiara chi non compare',
    /alts\.escluse&&alts\.escluse\.length/.test(src2));
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
if (ko) process.exitCode = 1;
module.exports = { ok, ko };
