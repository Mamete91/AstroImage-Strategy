#!/usr/bin/env node
/* GATE — LE COSE CHE PEGGIORANO NON DEVONO MIGLIORARE IL GIUDIZIO
   ═══════════════════════════════════════════════════════════════════════════

   Un motore che consiglia puo' sbagliare un numero senza fare danni. Non puo'
   sbagliare il VERSO: se peggiorando una condizione fisica il giudizio migliora,
   l'utente riceve un consiglio attivo di usare lo strumento sbagliato, e nessuna
   quantita' di precisione altrove lo salva.

   Questo gate raccoglie le monotonie che il motore deve rispettare, una sezione
   per ciascuna. Ognuna e' verificata in modo ESAUSTIVO sullo spazio delle
   combinazioni reali del catalogo, non su un caso scelto a mano, e ognuna porta
   accanto la ricostruzione del comportamento PRECEDENTE: se il codice vecchio non
   violasse l'invariante, la verifica sarebbe vuota e non se ne accorgerebbe
   nessuno.

     node tools/gate-monotonia.js                                              */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { M, DB, TG } = require('./lib/engine.js');

let ok = 0, ko = 0;
const chk = (what, cond, extra) => {
  if (cond) { ok++; console.log('  ok   ' + what + (extra ? '   [' + extra + ']' : '')); }
  else { ko++; console.log(' FAIL  ' + what + (extra ? '   [' + extra + ']' : '')); }
};
const H = t => console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '─'.repeat(Math.min(t.length, 78)));
const F = (x, n) => x == null ? '—' : Number(x).toFixed(n == null ? 2 : n);
/* La soglia entro cui il residuo dichiarato deve restare finche' la scala delle
   pose non e' corretta. E' meta' di RESA_GAP: un consiglio compare a 10 punti. */
const RESA_GAP_LOCALE = 0.09;

const NP = M.nightProfile(new Date(2026, 8, 11), 46.0167, 10.3333);
const sito = (seeing, rms, sqm) => {
  const s = { lat: 46.0167, lon: 10.3333, sqm: sqm == null ? 20.8 : sqm,
    seeing, rms, horizonMin: 20, clearFrac: 0.35 };
  s.fwhm = M.effFWHM(seeing, rms); return s;
};
/* Un campione di ottiche che copre l'intervallo vero del campionamento: dal
   sovracampionato spinto al sottocampionato grossolano. Se la monotonia vale solo
   dove il pixel e' fine, non vale. */
const OTTICHE = [
  ['rc10', 1, 'dslr_ff'], ['rc8', 1, 'asi2600mm'], ['rc8', 0.8, 'asi2600mm'],
  ['tecnosky115', 0.8, 'asi2600mm'], ['tecnosky115', 1, 'asi183mm'],
  ['askar71f', 1, 'asi2600mm'], ['wo_gt81', 1, 'asi294mm'],
  ['redcat51', 1, 'asi071mc'], ['tak_fsq85', 0.73, 'asi071mc'],
  ['c11', 1, 'asi183mm'], ['meade_sc10', 1, 'asi183mc'],
];
const resa = (t, dv, site, ore, cov) => {
  const e = M.evaluate(t, dv, site, NP, {}, cov || 'framing');
  const pr = M.prescribe(e, ore, dv, e.panels || 1);
  return M.imageYield(t, dv, site, pr, cov || 'framing', 0);
};

// ═══════════════════════════════════════════════════════════════════════════
H('A · PEGGIORARE LA GUIDA O IL SEEING NON PUO ALZARE LA RESA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La scala del giudizio e' la resa fotografica P = copertura x profondita x
     dettaglio. Le prime due non c'entrano con la FWHM; la terza era costruita come
     FRAZIONE della risoluzione che la notte concede, quindi peggiorando la notte
     saliva. Qui si scandisce tutto lo spazio. */
  const RMS = [0.3, 0.5, 0.8, 1.2, 1.8, 2.5, 3.5];
  const SEE = [1.0, 1.4, 1.8, 2.4, 3.2, 4.0];
  let casiR = 0, violR = 0, peggioR = 0, esR = null;
  let casiS = 0, violS = 0, peggioS = 0, esS = null;
  /* La ricostruzione del comportamento PRECEDENTE: l'asse dettaglio era
     `resolutionFidelity(scala, fwhm)`. Si ricalcola qui la resa vecchia dagli
     stessi ingredienti, per dimostrare che l'invariante NON era rispettato — cioe'
     che questa sezione non passa per vacuita'. */
  const resaVecchia = (y, dv, site) =>
    y.c * y.d * M.resolutionFidelity(dv.scale, site.fwhm);
  let violVecchiaR = 0, violVecchiaS = 0, violDettaglio = 0;

  for (const t of TG.targets) {
    for (const [tel, red, cam] of OTTICHE) for (const bin of [1, 2]) {
      let dv; try { dv = M.derive({ tel, red, cam, mnt: 'am5', bin }); } catch (e) { continue; }

      let prec = null, precV = null, precR = null;
      for (const r of RMS) {
        const st = sito(1.6, r);
        const y = resa(t, dv, st, 16);
        const v = resaVecchia(y, dv, st);
        if (prec != null) {
          casiR++;
          if (y.P > prec + 1e-9) { violR++;
            if (y.P - prec > peggioR) { peggioR = y.P - prec;
              esR = `${t.names[0]} ${tel} ${red}x ${cam} bin${bin}: rms sale a ${r}" e la resa passa da ${F(prec * 100, 1)}% a ${F(y.P * 100, 1)}%`; } }
          if (v > precV + 1e-9) violVecchiaR++;
          if (y.r > precR + 1e-12) violDettaglio++;
        }
        prec = y.P; precV = v; precR = y.r;
      }
      prec = null; precV = null; precR = null;
      for (const s of SEE) {
        const st = sito(s, 0.6);
        const y = resa(t, dv, st, 16);
        const v = resaVecchia(y, dv, st);
        if (prec != null) {
          casiS++;
          if (y.P > prec + 1e-9) { violS++;
            if (y.P - prec > peggioS) { peggioS = y.P - prec;
              esS = `${t.names[0]} ${tel} ${red}x ${cam} bin${bin}: seeing sale a ${s}" e la resa passa da ${F(prec * 100, 1)}% a ${F(y.P * 100, 1)}%`; } }
          if (v > precV + 1e-9) violVecchiaS++;
          if (y.r > precR + 1e-12) violDettaglio++;
        }
        prec = y.P; precV = v; precR = y.r;
      }
    }
  }
  chk('il campione non e vuoto', casiR > 200 && casiS > 200, casiR + ' passi su RMS, ' + casiS + ' sul seeing');
  /* Se questi due fossero zero la sezione non proverebbe niente: la formula
     precedente deve violare, altrimenti non c'era niente da correggere. */
  /* Quasi ogni passo, non ogni passo: dove la copertura o la profondita' sono
     gia' sature il prodotto non si muove, e sono una manciata di casi. */
  chk('la verifica non e vuota: l asse precedente risaliva su quasi ogni passo (RMS)',
    violVecchiaR > casiR * 0.95, violVecchiaR + ' violazioni su ' + casiR + ' passi');
  chk('e altrettanto sul seeing',
    violVecchiaS > casiS * 0.95, violVecchiaS + ' violazioni su ' + casiS + ' passi');

  /* IL RESIDUO, E PERCHE' NON E' ZERO.

     L'asse dettaglio adesso e' assoluto e scende sempre. Ma la resa ha tre fattori,
     e la PROFONDITA' contiene un effetto vero che tira nell'altro verso: con stelle
     piu' grasse la posa puo' allungarsi, e una posa piu' lunga paga meno letture,
     quindi le ore richieste calano. Misurato sul caso peggiore — NGC 7331, RC10 +
     full-frame a bin 1 — le ore ideali passano da 23.56 a 18.80 quando il seeing
     peggiora, e la profondita' sale da 0.679 a 0.851 mentre il dettaglio scende da
     1.000 a 0.899: il prodotto sale di 8.6 punti.

     Non e' un errore di segno: e' un effetto FISICO VERO. Con stelle piu' grasse la
     posa puo' allungarsi senza saturare, e una posa piu' lunga paga meno eventi di
     lettura, quindi le ore richieste calano davvero. Si vede solo dove il rumore di
     lettura e' un socio in affari: prima si concentrava sulle ASI183 a pixel
     piccolo, adesso su una full-frame ad f/8.

     Attribuivo la causa alla scala delle pose e mi aspettavo che l'intervento sul
     binning la chiudesse. Non l'ha chiusa: il residuo e' sceso da 8.63 a 7.20 punti
     — quella parte era il tetto di saturazione che scalava come bin^4 — e il resto
     e' il canale del rumore di lettura, che e' corretto. Sopprimerlo significherebbe
     falsificare la fisica per far passare una verifica.

     Resta quindi dichiarato e delimitato. Il limite non e' arbitrario: e' RESA_GAP,
     la soglia oltre la quale il confronto mostra un consiglio in pagina. Sotto
     quella soglia il residuo non puo' produrre una raccomandazione sbagliata, che e'
     la cosa che conta davvero. L'asse dettaglio da solo, che era il difetto, non
     risale piu' su nessuno dei 3146 passi. */
  chk('l asse dettaglio da solo non si rovescia mai piu',
    violDettaglio === 0, violDettaglio + ' risalite dell asse dettaglio su ' +
    (casiR + casiS) + ' passi');
  chk('un RMS peggiore alza la resa solo entro il residuo dichiarato',
    peggioR < RESA_GAP_LOCALE, violR + ' violazioni su ' + casiR + ' passi, residuo massimo ' +
    F(peggioR * 100, 2) + ' pt' + (esR ? ' — ' + esR : ''));
  chk('e cosi un seeing peggiore',
    peggioS < RESA_GAP_LOCALE, violS + ' violazioni su ' + casiS + ' passi, residuo massimo ' +
    F(peggioS * 100, 2) + ' pt' + (esS ? ' — ' + esS : ''));
  chk('il residuo non puo far comparire un consiglio: resta sotto RESA_GAP',
    Math.max(peggioR, peggioS) < 0.10,
    'residuo ' + F(Math.max(peggioR, peggioS) * 100, 2) + ' pt contro 10.00 pt di soglia');
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · NELLA CLASSIFICA LA MONTATURA PEGGIORE NON PUO VINCERE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il caso che l'utente vede: due configurazioni identiche tranne la montatura,
     confrontate da `fitAlternatives`. Prima l'inversione era sistematica — 308311
     confronti, 1914 dei quali oltre RESA_GAP, cioe' mostrati come consiglio. */
  const ms = DB.mounts.filter(m => m.rms_typ_arcsec != null)
    .sort((a, b) => a.rms_typ_arcsec - b.rms_typ_arcsec);
  const buona = ms[0], cattiva = ms[ms.length - 1];
  chk('il catalogo offre due montature abbastanza diverse', buona.rms_typ_arcsec < cattiva.rms_typ_arcsec - 0.3,
    buona.id + ' ' + buona.rms_typ_arcsec + '" contro ' + cattiva.id + ' ' + cattiva.rms_typ_arcsec + '"');

  let confronti = 0, inversioni = 0, sopraSoglia = 0, peggio = null;
  const est = { tel: 'c11', red: 1, cam: 'asi533mm', mnt: 'cem70g', bin: 1 };   // una terza, estranea
  for (const t of TG.targets.slice(0, 5)) for (const [tel, red, cam] of OTTICHE) {
    const miei = [
      { id: 'A', label: buona.id, telescope: tel, reducer: red, camera: cam, mount: buona.id },
      { id: 'B', label: cattiva.id, telescope: tel, reducer: red, camera: cam, mount: cattiva.id }];
    let alts; try { alts = M.fitAlternatives(t, est, sito(1.6, 0.6), NP, {}, 16, miei, 12, 0, 'framing'); }
    catch (e) { continue; }
    for (const bin of [1, 2]) {
      const a = alts.find(x => x.cfg.mnt === buona.id && x.bin === bin);
      const b = alts.find(x => x.cfg.mnt === cattiva.id && x.bin === bin);
      if (!a || !b) continue;
      confronti++;
      if (b.P > a.P + 1e-9) { inversioni++;
        if (b.P - a.P > 0.10) sopraSoglia++;
        if (!peggio || b.P - a.P > peggio.d)
          peggio = { d: b.P - a.P, s: `${t.names[0]} ${tel} ${red}x ${cam} bin${bin}: ${cattiva.id} ${F(b.P * 100, 1)}% batte ${buona.id} ${F(a.P * 100, 1)}%` };
      }
    }
  }
  chk('ci sono confronti da giudicare', confronti > 40, confronti + ' coppie');
  chk('la montatura che guida peggio non finisce mai davanti', inversioni === 0,
    inversioni ? inversioni + ' inversioni, la peggiore: ' + peggio.s : confronti + ' coppie, nessuna inversione');
  chk('e nessuna arriva a farsi mostrare come consiglio', sopraSoglia === 0,
    sopraSoglia + ' oltre RESA_GAP');
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · L RMS CHE HAI MISURATO RAGGIUNGE I CANDIDATI');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Due funzioni rispondevano alla stessa domanda: `rmsForMount` nella UI onorava
     il valore scritto a mano, `mountRms` nel motore leggeva solo il catalogo. Il
     confronto le usava insieme, quindi la configurazione in uso e i candidati erano
     giudicati con due grandezze diverse — anche quando montavano la stessa
     montatura. Ora `fitAlternatives` accetta `rmsFor`. */
  const t = TG.targets[0];
  const miei = [{ id: 'A', label: 'rc8+am5', telescope: 'rc8', reducer: 1, camera: 'asi2600mm', mount: 'am5' }];
  const est = { tel: 'c11', red: 1, cam: 'asi533mm', mnt: 'cem70g', bin: 1 };
  const senza = M.fitAlternatives(t, est, sito(1.6, 0.6), NP, {}, 16, miei, 12, 0, 'framing');
  const conBuono = M.fitAlternatives(t, est, sito(1.6, 0.6), NP, {}, 16, miei, 12, 0, 'framing', () => 0.35);
  const conCattivo = M.fitAlternatives(t, est, sito(1.6, 0.6), NP, {}, 16, miei, 12, 0, 'framing', () => 2.50);
  const rms = a => (a.find(x => x.bin === 1) || {}).rms;
  chk('senza dichiarazione si usa un valore di catalogo positivo', rms(senza) > 0,
    'rms usato ' + F(rms(senza), 2) + '"');
  chk('dichiarando 0.35" il candidato lo riceve', Math.abs(rms(conBuono) - 0.35) < 1e-9, F(rms(conBuono), 2) + '"');
  chk('dichiarando 2.50" pure', Math.abs(rms(conCattivo) - 2.50) < 1e-9, F(rms(conCattivo), 2) + '"');
  const pB = (conBuono.find(x => x.bin === 1) || {}).P, pC = (conCattivo.find(x => x.bin === 1) || {}).P;
  chk('e la resa del candidato segue il verso giusto', pB > pC,
    'con 0.35" resa ' + F(pB * 100, 1) + '%, con 2.50" ' + F(pC * 100, 1) + '%');
  /* Non basta che il numero arrivi: deve arrivare SOLO quando e' un valore vero. */
  const conZero = M.fitAlternatives(t, est, sito(1.6, 0.6), NP, {}, 16, miei, 12, 0, 'framing', () => 0);
  chk('uno zero non viene scambiato per una dichiarazione',
    Math.abs(rms(conZero) - rms(senza)) < 1e-9, 'ripiega sul catalogo: ' + F(rms(conZero), 2) + '"');
  const conNulla = M.fitAlternatives(t, est, sito(1.6, 0.6), NP, {}, 16, miei, 12, 0, 'framing', () => null);
  chk('e nemmeno un null', Math.abs(rms(conNulla) - rms(senza)) < 1e-9, F(rms(conNulla), 2) + '"');
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · IL METRO DELL ASSE DETTAGLIO E FISSO');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La proprieta' che rende l'asse confrontabile fra candidati: il denominatore non
     dipende dalle condizioni. Si verifica per costruzione, misurando la resa di UNA
     configurazione sotto notti diverse e controllando che l'asse dettaglio si muova
     SOLO come si muove la FWHM consegnata. */
  const dv = M.derive({ tel: 'wo_gt81', red: 1, cam: 'asi294mm', mnt: 'am5', bin: 2 });
  const t = TG.targets[0];
  let coerenti = 0, tot = 0;
  for (const s of [1.0, 1.6, 2.5, 4.0]) for (const r of [0.3, 0.8, 2.0]) {
    const st = sito(s, r);
    const y = resa(t, dv, st, 16);
    tot++;
    const atteso = Math.min(1, y.fwhmRif / y.fwhmImg);
    if (Math.abs(y.r - atteso) < 1e-12) coerenti++;
  }
  chk('l asse dettaglio e il rapporto fra il metro fisso e la FWHM consegnata',
    coerenti === tot, coerenti + '/' + tot);
  const y1 = resa(t, dv, sito(1.0, 0.3), 16), y2 = resa(t, dv, sito(4.0, 2.0), 16);
  chk('il metro e lo stesso sotto due notti opposte', Math.abs(y1.fwhmRif - y2.fwhmRif) < 1e-12,
    F(y1.fwhmRif, 3) + '" in entrambe');
  chk('e la FWHM consegnata invece cambia, come deve',
    y2.fwhmImg > y1.fwhmImg * 1.5, F(y1.fwhmImg, 2) + '" contro ' + F(y2.fwhmImg, 2) + '"');
  chk('la resa resta nell intervallo 0-1', y1.P <= 1 + 1e-12 && y1.P >= 0 && y2.P <= 1 + 1e-12 && y2.P >= 0,
    F(y1.P, 3) + ' e ' + F(y2.P, 3));
  /* `resolutionFidelity` resta dov'e' e continua a rispondere alla SUA domanda. */
  chk('resolutionFidelity non e stata toccata: resta la fedelta di campionamento',
    Math.abs(M.resolutionFidelity(2, 2) - 2 / Math.sqrt(4 + Math.pow(M.PIX_FWHM * 2, 2))) < 1e-12);
}

// ═══════════════════════════════════════════════════════════════════════════
H('E · IL RIFERIMENTO DELLE ORE NON DIPENDE DAI FILTRI CHE POSSIEDI');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Le ore delle schede sono scritte su una configurazione dichiarata nei dati,
     ruota compresa. Il fattore che le converte deve avere quel denominatore fisso:
     se cambia con i filtri di chi guarda, ogni utente misura con un metro diverso e
     i numeri non sono confrontabili ne' con la scheda ne' fra loro.

     Il difetto che questa sezione impedisce di tornare: `refSubFor` era stato
     scritto apposta per questo — «un riferimento che dipende da chi lo interroga
     non e' un riferimento» — ma copriva la sola POSA. I tassi, che sono il
     denominatore vero del fattore, passavano da `bandSpec`, che il filtro lo
     sceglie fra quelli POSSEDUTI. Misurato in banda Ha su camera a colori: con la
     ruota dichiarata il riferimento usa ha3 e il suo fondo cielo vale 0.007453; con
     un L-eNhance in ruota passava a lenh e il fondo saliva a 0.024292, 3.26 volte,
     e il fattore scendeva da 11.77 a 6.21. */
  const fs2 = require('fs');
  const src = fs2.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const MARCA = '/* =====================================================================';
  const pura = src.split('<script>')[1].split('</script>')[0].split(MARCA + '\n   UI')[0];
  const CATd = JSON.parse(fs2.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const CITd = JSON.parse(fs2.readFileSync(path.join(ROOT, 'data', 'cities.json'), 'utf8'));
  const conRuota = ruota => {
    const ctx = { DB, TG, CAT: CATd.objects, CITIES: CITd.cities, OWNED: ruota.slice(),
      console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
    return new Function(...Object.keys(ctx), pura +
      'return {refCfg,rates,timeFactor,refSubFor,conRuotaDiRiferimento,derive,ruoli:r=>{ROLES=r||{};}};')(...Object.values(ctx));
  };
  const RUOTE = [
    ['dichiarata nei dati', DB.reference_config.filters],
    ['di serie', DB.default_filters],
    ['solo L-eNhance', ['lenh', 'lum', 'red', 'grn', 'blu']],
    ['solo L-eXtreme', ['lext', 'lum', 'red', 'grn', 'blu']],
    ['solo L-Ultimate', ['lult', 'lum', 'red', 'grn', 'blu']],
    ['amputata al solo lum', ['lum']],
  ];
  const BANDE = ['Ha', 'OIII', 'SII', 'L', 'R', 'G', 'B'];
  chk('il campione copre ruote davvero diverse', RUOTE.length >= 6, RUOTE.length + ' ruote');

  /* IL DENOMINATORE SI OSSERVA SOLO ATTRAVERSO `timeFactor`, e va osservato li'.

     Chiamare `rates` dentro `conRuotaDiRiferimento` da questo gate proverebbe
     soltanto che l'helper funziona: forzerebbe la ruota giusta a prescindere da
     cosa fa il motore, ed e' una verifica che passa anche col difetto rimesso —
     l'ho scritta cosi' la prima volta e infatti non lo rilevava.

     Il modo onesto e' tenere fermo il NUMERATORE — stessa ottica, e per le bande
     di controllo lo stesso filtro effettivamente usato — e muovere il RESTO della
     ruota. Se il fattore si sposta, si e' spostato il denominatore. */
  const K0 = conRuota(DB.reference_config.filters);
  const dv0 = K0.derive({ tel: DB.reference_config.telescope, red: DB.reference_config.reducer,
    cam: DB.reference_config.camera, mnt: 'am5', bin: 1 });
  /* L'IDAS va IMPOSTO, non sperato. Da quando la scelta automatica preferisce, per
     un ruolo di banda larga, il filtro che raccoglie di piu' — larghezza x
     trasmissione — un IDAS in ruota non viene piu' scelto da solo per la luminanza:
     vince il `lum`, che e' piu' largo. Per interrogare il denominatore serve che il
     numeratore usi davvero l'IDAS, e il modo giusto e' il meccanismo dei ruoli. */
  const conIdas = conRuota(DB.reference_config.filters.concat(['idas']));
  conIdas.ruoli({ L: 'idas' });
  const dvI = conIdas.derive({ tel: DB.reference_config.telescope, red: DB.reference_config.reducer,
    cam: DB.reference_config.camera, mnt: 'am5', bin: 1 });
  const fL = conIdas.timeFactor(dvI, 'L');
  chk('aggiungere un IDAS alla ruota fa costare di piu la luminanza, non uguale',
    fL > 1.05, 'L ' + fL.toFixed(4) + ' — col difetto il riferimento prendeva in prestito lo stesso IDAS e usciva 1.0000');
  /* E le bande che l IDAS non tocca non si muovono di un millesimo. */
  const fermi = ['Ha', 'OIII', 'SII'].every(b =>
    Math.abs(conIdas.timeFactor(dvI, b) - K0.timeFactor(dv0, b)) < 1e-12);
  chk('mentre la banda stretta, che quel filtro non tocca, resta identica', fermi,
    ['Ha', 'OIII', 'SII'].map(b => b + ' ' + conIdas.timeFactor(dvI, b).toFixed(6)).join(' · '));

  /* Non basta che sia fisso: deve valere UNO sulla configurazione di riferimento
     con la sua ruota, altrimenti sarebbe fisso e sbagliato. */
  chk('e vale uno esatto sulla configurazione di riferimento',
    BANDE.every(b => Math.abs(K0.timeFactor(dv0, b) - 1) < 1e-12),
    BANDE.map(b => b + ' ' + K0.timeFactor(dv0, b).toFixed(6)).join(' · '));

  /* E la verifica non e' vuota: il NUMERATORE deve invece muoversi con la ruota,
     perche' e' il filtro che usi davvero. Se non si muovesse, questa sezione
     passerebbe anche su un motore che dei filtri non sa niente. */
  const dvOsc = { tel: 'rc8', red: 1, cam: 'asi2600mc', mnt: 'cem70g', bin: 1 };
  const fattori = ['lenh', 'lext', 'lult'].map(f => {
    const K = conRuota([f, 'lum', 'red', 'grn', 'blu']);
    return K.timeFactor(K.derive(dvOsc), 'Ha', 300);
  });
  chk('mentre il numeratore segue il filtro che usi davvero',
    Math.max.apply(null, fattori) > Math.min.apply(null, fattori) * 1.15,
    fattori.map(x => x.toFixed(4)).join(' · ') + '  (L-eNhance, L-eXtreme, L-Ultimate)');
  chk('e il filtro piu stretto costa meno ore, non di piu',
    fattori[2] < fattori[1] && fattori[1] < fattori[0],
    'L-Ultimate ' + fattori[2].toFixed(2) + ' < L-eXtreme ' + fattori[1].toFixed(2) +
    ' < L-eNhance ' + fattori[0].toFixed(2));
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · IL CIELO PENALIZZA IL PUNTEGGIO UNA VOLTA SOLA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il punteggio ha cinque termini: 0.26 sWin + 0.20 sFit + 0.12 sSamp +
     0.34 sFeas + 0.08 sMount. L'inquinamento luminoso entrava in DUE di essi —
     in `sWin` attraverso `skyF`, e in `sFeas` attraverso le settimane, che vengono
     dal budget gia' gonfiato da `lpPenalty`. Peso complessivo 0.60 per un solo
     fatto fisico.

     Il calendario invece lo paga una volta sola e lo dichiara: `perNight` usa le
     ore grezze «perche' il cielo e' gia' dentro il budget». Era il punteggio a non
     essersi accorto della stessa cosa.

     Adesso `sWin` usa `moonF`, cioe' il costo MARGINALE della Luna dato quel cielo.
     La Luna resta contata li' — e' transitoria e nel budget non entra — e
     l'inquinamento resta contato dove si decidono le ore. */
  const SQM = [21.6, 21.3, 20.8, 20.0, 19.0, 18.5, 17.8];
  const dv = M.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'cem70g', bin: 1 });
  let passi = 0, viol = 0, peggio = 0, es = null;
  for (const t of TG.targets) {
    let prec = null;
    for (const q of SQM) {
      const e = M.evaluate(t, dv, sito(1.6, 0.6, q), NP, {}, 'full');
      if (prec != null) {
        passi++;
        if (e.score > prec + 1e-9) { viol++;
          if (e.score - prec > peggio) { peggio = e.score - prec;
            es = t.names[0] + ': SQM scende a ' + q + ' e il punteggio sale da ' + prec + ' a ' + e.score; } }
      }
      prec = e.score;
    }
  }
  chk('il campione non e vuoto', passi > 60, passi + ' passi su ' + TG.targets.length + ' bersagli');
  chk('un cielo peggiore non alza mai il punteggio', viol === 0,
    viol ? viol + ' violazioni, la peggiore: ' + es : passi + ' passi, tutti in discesa');

  /* NON TAUTOLOGICO: il punteggio deve comunque MUOVERSI col cielo, altrimenti
     questa verifica passerebbe su un motore che dell'SQM non sa niente. */
  const estremi = TG.targets.map(t => [
    M.evaluate(t, dv, sito(1.6, 0.6, 21.6), NP, {}, 'full').score,
    M.evaluate(t, dv, sito(1.6, 0.6, 17.8), NP, {}, 'full').score]);
  const mossi = estremi.filter(([a, b]) => a - b >= 5).length;
  chk('e il punteggio reagisce davvero al cielo', mossi >= TG.targets.length / 2,
    mossi + ' bersagli su ' + TG.targets.length + ' perdono almeno 5 punti da SQM 21.6 a 17.8');

  /* E il doppio conteggio non deve tornare: `sWin` non puo' contenere il fattore
     dell'inquinamento. Si verifica sul comportamento, non sul testo: a parita' di
     Luna — cioe' senza Luna — la finestra non deve dipendere dall'SQM. */
  const t0 = TG.targets[0];
  const senzaLuna = [21.6, 19.0, 17.8].map(q => {
    const e = M.evaluate(t0, dv, sito(1.6, 0.6, q), NP, {}, 'full');
    return { q, critH: e.critH, moonF: e.moonF, sWin: Math.min(1, Math.max(0, e.critH * e.moonF / 5)) };
  });
  const finestraFerma = senzaLuna.every(x =>
    Math.abs(x.sWin - senzaLuna[0].sWin) < 1e-9 || Math.abs(x.moonF - senzaLuna[0].moonF) > 1e-9);
  chk('la finestra della notte non dipende piu dall inquinamento luminoso', finestraFerma,
    senzaLuna.map(x => 'SQM ' + x.q + ' → ' + F(x.sWin, 4)).join(' · '));
  /* La controprova: la vecchia forma, ricostruita, dipendeva eccome. */
  const vecchia = [21.6, 19.0, 17.8].map(q => {
    const e = M.evaluate(t0, dv, sito(1.6, 0.6, q), NP, {}, 'full');
    return Math.min(1, Math.max(0, e.critH * e.skyF / 5));
  });
  chk('mentre la forma precedente ci dipendeva, e la verifica non e vuota',
    Math.abs(vecchia[0] - vecchia[2]) > 1e-6,
    vecchia.map(x => F(x, 4)).join(' · ') + ' con skyF, che contiene l inquinamento');
}

// ═══════════════════════════════════════════════════════════════════════════
H('G · IL BINNING NON CREA FOTONI');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Su CMOS la somma e' digitale: si legge ogni fotosito e poi si sommano i numeri.
     Il rumore di lettura entra quattro volte in un pixel da 2x2, quindi il rapporto
     segnale/rumore per la stessa porzione di cielo resta quello. Il motore lo
     dichiara in tre punti; qui si verifica che lo faccia davvero, in tutti e tre i
     posti dove il binning tocca una decisione. */
  const CAM = ['asi2600mm', 'asi2600mc', 'asi183mm', 'dslr_ff'];
  const BANDE = ['L', 'Ha', 'OIII', 'R'];
  let tf = 0, tfKo = 0, sat = 0, satKo = 0, esSat = null, esTf = null;
  for (const cam of CAM) for (const b of BANDE) {
    let rif = null, rifSat = null;
    for (const bin of [1, 2, 3, 4]) {
      let dv; try { dv = M.derive({ tel: 'rc8', red: 1, cam, mnt: 'am5', bin }); } catch (e) { continue; }
      const f = M.timeFactor(dv, b);
      if (rif == null) rif = f;
      else { tf++; if (Math.abs(f - rif) > 1e-9) { tfKo++; esTf = cam + '/' + b + ' bin' + bin + ': ' + f.toFixed(6) + ' contro ' + rif.toFixed(6); } }
      const tg = TG.targets.find(x => x.mag != null && x.size_arcmin);
      if (tg) {
        const sp = M.bandSpec(b, dv.c);
        const st = M.objectSatTime(dv, b, tg, TG.archetypes[tg.archetype], { full_well_e: 50000 }, sp, {});
        if (isFinite(st)) {
          if (rifSat == null) rifSat = st;
          else { sat++; if (Math.abs(st / rifSat - 1) > 1e-9) { satKo++; esSat = cam + '/' + b + ' bin' + bin + ': ' + st.toFixed(1) + ' s contro ' + rifSat.toFixed(1); } }
        }
      }
    }
  }
  chk('il campione non e vuoto', tf > 30 && sat > 20, tf + ' confronti sul fattore, ' + sat + ' sul tetto');
  chk('il fattore di tempo non cambia col binning', tfKo === 0,
    tfKo ? tfKo + ' scarti, per esempio ' + esTf : tf + ' confronti identici');
  chk('e nemmeno il tetto di saturazione del soggetto', satKo === 0,
    satKo ? satKo + ' scarti, per esempio ' + esSat : sat + ' confronti identici');

  /* Il difetto che questa sezione impedisce di tornare: `objectSatTime` divideva una
     seconda volta per bin^2 un tasso che l'angolo solido lo conteneva gia', e il
     tetto scendeva come bin^4 — 17654, 1103, 218, 69 s su NGC 6888. La conseguenza
     visibile era la posa: a bin 4 crollava da 180 a 60 s. */
  const tgP = TG.targets.find(x => /6888/.test(x.names.join(' '))) || TG.targets[0];
  const pose = [1, 2, 3, 4].map(bin => {
    const dv = M.derive({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin });
    return M.subExposure(dv, { sqm: 20, seeing: 2.5, rms: 0.6, fwhm: M.effFWHM(2.5, 0.6) },
      'L', { tg: tgP, arch: TG.archetypes[tgP.archetype] }).sec;
  });
  chk('e la posa consigliata non si accorcia salendo di binning',
    pose.every(x => x === pose[0]), pose.map((x, i) => 'bin' + (i + 1) + ' ' + x + 's').join(' · '));

  /* E il dato esposto non deve promettere un guadagno che non c'e'. */
  const opt = M.binOptions({ tel: 'rc8', red: 1, cam: 'asi2600mm', mnt: 'am5', bin: 1 }, 2.2);
  chk('e il tempo relativo dichiarato da binOptions non promette sconti',
    opt.every(o => Math.abs(o.timeRel - 1) < 1e-12),
    opt.map(o => 'bin' + o.bin + ' ' + o.timeRel.toFixed(3)).join(' · ') +
    ' — valeva 1/bin², cioe la risposta del binning hardware su CCD');

  /* NON TAUTOLOGICO: il binning deve comunque CAMBIARE qualcosa, altrimenti queste
     verifiche passerebbero su un motore che lo ignora. Cambia la scala del pixel e
     quindi il campionamento, che e' esattamente cio' per cui si bina. */
  chk('mentre la scala del pixel cambia eccome, ed e il motivo per cui si bina',
    Math.abs(opt[1].scale - opt[0].scale * 2) < 1e-9 && opt[0].samp.k !== opt[1].samp.k,
    opt.map(o => 'bin' + o.bin + ' ' + o.scale.toFixed(2) + '"/px ' + o.samp.k).join(' · '));
}

// ═══════════════════════════════════════════════════════════════════════════
H('H · LA GUIDA DIPENDE DALLA FOCALE, IL CAMPIONAMENTO DAL PIXEL');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il catalogo delle montature distingue «uso normale» da «lunga focale»: errore
     periodico, flessioni e vento pesano di piu' quando il tubo e' lungo, e non hanno
     la minima idea di quale sensore ci sia dietro. Il motore pero' commutava su
     `scale0 = 206.265 x pixel / F`, che il pixel lo contiene.

     Misurato prima: RC8 a 1300 mm, focale identica. Con una 2600MM (3.76 um) usciva
     il ramo «lunga focale» 1.3"; con una full-frame da 5.90 um il ramo «tipico»
     0.9". Il 23.2% di scarto sulla FWHM efficace per aver cambiato sensore, su 16
     ottiche del catalogo su 46. */
  let mobili = 0, tot = 0, esempio = null;
  for (const t of DB.telescopes) for (const r of (t.reducers || [{ factor: 1 }])) {
    const rami = new Set(); const det = [];
    for (const c of DB.cameras) {
      let dv; try { dv = M.derive({ tel: t.id, red: r.factor, cam: c.id, mnt: 'am5', bin: 1 }); }
      catch (e) { continue; }
      const v = M.mountRms('am5', dv.F);
      rami.add(v); det.push({ cam: c.id, px: dv.c.pixel_um, F: dv.F, v });
    }
    if (!det.length) continue;
    tot++;
    if (rami.size > 1) { mobili++; if (!esempio) esempio = t.id + ' ' + r.factor + 'x: ' +
      det.slice(0, 2).map(d => d.cam + ' → ' + d.v + '"').join(', '); }
  }
  chk('il campione copre tutto il catalogo ottico', tot >= 40, tot + ' ottiche');
  chk('a focale ferma, cambiare camera non cambia l RMS meccanico assunto', mobili === 0,
    mobili ? mobili + ' ottiche ancora mobili, per esempio ' + esempio
           : tot + ' ottiche, nessuna cambia ramo con la camera');

  /* La controprova: la regola PRECEDENTE, ricostruita, cambiava eccome. */
  let mobiliVecchia = 0;
  for (const t of DB.telescopes) for (const r of (t.reducers || [{ factor: 1 }])) {
    const rami = new Set();
    for (const c of DB.cameras) {
      let dv; try { dv = M.derive({ tel: t.id, red: r.factor, cam: c.id, mnt: 'am5', bin: 1 }); }
      catch (e) { continue; }
      rami.add(dv.scale0 < 0.8);          // la soglia di prima, sulla scala del pixel
    }
    if (rami.size > 1) mobiliVecchia++;
  }
  chk('e la verifica non e vuota: la regola precedente cambiava con la camera',
    mobiliVecchia > 0, mobiliVecchia + ' ottiche su ' + tot + ' con la soglia sulla scala');

  /* Ma la focale deve continuare a contare, altrimenti la verifica passerebbe su un
     motore che assegna sempre lo stesso numero. */
  const corto = M.mountRms('am5', 400), lungo = M.mountRms('am5', 2000);
  chk('mentre la focale continua a decidere, come deve', lungo > corto,
    '400 mm → ' + corto + '"  ·  2000 mm → ' + lungo + '"');

  /* E il pixel deve continuare a decidere il CAMPIONAMENTO: e' la sua domanda. */
  const a = M.derive({ tel: 'rc8', red: 0.8, cam: 'asi183mm', mnt: 'am5', bin: 1 });
  const b = M.derive({ tel: 'rc8', red: 0.8, cam: 'asi2400mc', mnt: 'am5', bin: 1 });
  chk('e il pixel continua a decidere il campionamento',
    Math.abs(a.scale0 - b.scale0) > 0.3 && M.mountRms('am5', a.F) === M.mountRms('am5', b.F),
    'stessa focale ' + F(a.F, 0) + ' mm: scala ' + F(a.scale0, 3) + '" contro ' +
    F(b.scale0, 3) + '", stesso RMS ' + M.mountRms('am5', a.F) + '"');
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
process.exit(ko ? 1 : 0);
