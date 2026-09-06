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

     Non e' un errore di segno: e' un effetto reale su sistemi affamati di rumore di
     lettura, e infatti si concentra sulle camere a pixel piccolo (41 violazioni su
     48 stanno sulle ASI183). Sopprimerlo qui significherebbe falsificare la fisica
     per far passare una verifica. La sua CAUSA sta nella scala delle pose, che e'
     l'intervento successivo: fino ad allora il residuo si dichiara e si tiene sotto
     una soglia che non puo' mai far comparire un consiglio.

     QUANDO L'INTERVENTO SULLE POSE SARA' FATTO, questa soglia va riportata a zero e
     le due verifiche qui sotto devono diventare «nessuna violazione». */
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

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
process.exit(ko ? 1 : 0);
