#!/usr/bin/env node
/* GATE — LE CONFIGURAZIONI SONO DI CHI USA L'APP, NON DI CHI L'HA SCRITTA
   ═══════════════════════════════════════════════════════════════════════════

   Il difetto che questo gate impedisce di tornare arriva da una segnalazione vera:
   «come faccio a eliminare i setup gia' presenti? continua a dirmi che con l'RC8 e'
   meglio ma non ho un RC8». Il confronto fra configurazioni chiamava

       fitAlternatives(t, CFG, SITE, np, STATE, hours, DB.presets, 3, ...)

   e `DB.presets` sono sei combinazioni di catalogo — la strumentazione di UNA
   persona, identica per chiunque apra l'app. Chi non aveva quel telescopio si
   sentiva dire che con quel telescopio verrebbe meglio, e non aveva modo di
   toglierlo di mezzo. Non era un difetto di calcolo: `fitAlternatives` e' sempre
   stata generalista e del catalogo non sa niente. Era un difetto di CHI le veniva
   dato in pasto.

   Adesso i candidati vengono da `ap_setups`, che contiene solo le configurazioni
   spuntate da chi usa l'app. E la regola vale per TUTTE E QUATTRO le posizioni, non
   solo per il tubo: un RC8 che non hai non deve comparire, ma nemmeno una camera,
   una montatura o un riduttore che non hai. Si dichiara una configurazione INTERA,
   e solo quella entra. Il catalogo resta visibile come esempio — provare un tubo che
   non hai e' legittimo — ma non entra in nessun consiglio finche' non lo dichiari.

   Sei invarianti, e ognuno ha una prova che non e' tautologica:
     A · il motore non conosce il catalogo delle configurazioni
     B · nella UI ogni uso del catalogo e' un percorso dichiaratamente di catalogo
     C · senza dichiarazioni il confronto non propone niente (contro il vecchio)
     D · nel confronto compaiono solo le configurazioni dichiarate, per intero
     E · nessun prodotto cartesiano, e il binning non e' strumentazione
     F · un default mai scelto non diventa un possesso

     node tools/gate-setup.js                                                  */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { M, DB, TG } = require('./lib/engine.js');

let ok = 0, ko = 0;
const chk = (what, cond, extra) => {
  if (cond) { ok++; console.log('  ok   ' + what + (extra ? '   [' + extra + ']' : '')); }
  else { ko++; console.log(' FAIL  ' + what + (extra ? '   [' + extra + ']' : '')); }
};
const H = t => console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '─'.repeat(Math.min(t.length, 78)));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const MARK = '/* =====================================================================\n   UI';
const motore = script.split(MARK)[0];
const ui = script.slice(motore.length);

/* Il banco di prova: un bersaglio vero, un cielo vero, ore vere. */
const st = { lat: 46.0167, lon: 10.3333, sqm: 20.8, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
st.fwhm = M.effFWHM(st.seeing, st.rms);
const np = M.nightProfile(new Date(2026, 8, 11), st.lat, st.lon);
const T = TG.targets.find(x => /7000/.test(x.names.join(' ')));
const pres = (tel, red, cam, mnt) => ({ id: 'mio:' + tel + '|' + red + '|' + cam + '|' + mnt,
  label: [tel, red, cam, mnt].join(' '), mine: true,
  telescope: tel, reducer: red, camera: cam, mount: mnt });
const conf = (tel, red, cam, mnt) => ({ tel, red, cam, mnt, bin: 1 });
const cerca = (miei, cfg, n) => M.fitAlternatives(T, cfg, st, np, {}, 16, miei, n || 12, 0, 'framing');
const otticaDi = c => [c.tel, Number(c.red), c.cam, c.mnt].join('|');
const otticaDiPreset = p => [p.telescope, Number(p.reducer), p.camera, p.mount].join('|');

// ═══════════════════════════════════════════════════════════════════════════
H('A · IL MOTORE NON CONOSCE IL CATALOGO DELLE CONFIGURAZIONI');
// ═══════════════════════════════════════════════════════════════════════════
{
  const n = (motore.match(/DB\.presets/g) || []).length;
  chk('«DB.presets» non compare nella fetta MOTORE', n === 0, n + ' occorrenze');
  chk('e «fitAlternatives» resta generalista: riceve l elenco come parametro',
    /function fitAlternatives\(tg,cfg,site,np,state,hours,presets,/.test(motore));
  chk('dentro non nomina mai il catalogo', !/DB\.presets/.test(
    motore.slice(motore.indexOf('function fitAlternatives'),
                 motore.indexOf('function synthTarget'))));
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · NELLA UI OGNI USO DEL CATALOGO E DICHIARATO');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Non e' un divieto: il catalogo nella UI serve, e serve in punti precisi. E' un
     campanello. Se qualcuno aggiunge un nono uso di `DB.presets`, questo gate cade e
     costringe a dire in quale dei due mondi sta lavorando — l'esempio o il possesso. */
  const AMMESSI = [
    [/applyPreset\(DB\.presets\[0\]\)/,                          'configurazione di partenza, non dichiarata tua'],
    [/setupDaMigrare\(salvata,DB\.presets\[0\]\)/,               'termine di paragone della migrazione'],
    [/mio\|\|DB\.presets\.find\(x=>x\.id===v\)/,                 'la tendina risolve anche gli id di catalogo'],
    [/const cat=DB\.presets\.filter\(q=>!isMine\(/,              'gruppo «esempi di catalogo» nella tendina'],
    [/setupsAsPresets\(\)\.find\(eq\)\|\|DB\.presets\.find\(eq\)/, 'syncPreset: le tue vengono prima'],
    [/for\(const p of DB\.presets\)/,                            'righe di esempio nella lista, non spuntate'],
    [/setupsAsPresets\(\)\.find\(x=>x\.id===presetId\)\|\|DB\.presets\.find\(/, 'rxApply: le tue vengono prima'],
  ];
  const righe = ui.split('\n').map((l, i) => [i + 1, l])
    .filter(([, l]) => /DB\.presets/.test(l));
  const commento = l => /^\s*\*/.test(l) || /`DB\.presets/.test(l) || /^\s*\/\*/.test(l);
  const codice = righe.filter(([, l]) => !commento(l));
  chk('ci sono usi di catalogo da controllare', codice.length > 0, codice.length + ' righe di codice');
  const orfane = codice.filter(([, l]) => !AMMESSI.some(([re]) => re.test(l)));
  chk('nessun uso del catalogo fuori dai percorsi dichiarati', orfane.length === 0,
    orfane.length ? orfane.map(([n]) => 'riga ' + n).join(', ') : 'tutti riconosciuti');
  chk('il confronto operativo riceve le TUE configurazioni',
    /fitAlternatives\(t,CFG,SITE,np,STATE,hours,setupsAsPresets\(\)/.test(ui));
  chk('e non il catalogo', !/fitAlternatives\([^\n]*DB\.presets/.test(ui));
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · SENZA DICHIARAZIONI NON SI PROPONE NIENTE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Il confronto e' col comportamento PRECEDENTE, ricostruito qui: passare
     `DB.presets` e' letteralmente cio' che faceva la riga di prima. Se non
     proponesse niente nemmeno cosi', la verifica sarebbe vuota. */
  const cfg = conf('rc8', 1, 'asi2600mm', 'cem70g');
  const prima = cerca(DB.presets, cfg);
  const dopo = cerca([], cfg);
  chk('col catalogo il confronto proponeva strumenti altrui', prima.length > 0,
    prima.length + ' candidati, fra cui ' + prima.slice(0, 2).map(x => x.preset.label).join(' · '));
  const altrui = prima.filter(x => x.cfg.tel !== cfg.tel).length;
  chk('e in maggioranza erano tubi diversi dal proprio', altrui > 0, altrui + ' su ' + prima.length);
  chk('senza configurazioni dichiarate non propone piu niente', dopo.length === 0,
    dopo.length + ' candidati');
  chk('e non e perche la funzione si e rotta: le escluse restano leggibili',
    Array.isArray(dopo.escluse));
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · SOLO LE CONFIGURAZIONI DICHIARATE, E PER INTERO');
// ═══════════════════════════════════════════════════════════════════════════
{
  const miei = [pres('rc8', 1, 'asi2600mm', 'cem70g'), pres('askar71f', 0.75, 'asi2600mc', 'am5')];
  const cfg = conf('tecnosky115', 0.8, 'asi2600mm', 'am5');   // in uso: una terza, non dichiarata
  const c = cerca(miei, cfg);
  const dichiarate = new Set(miei.map(otticaDiPreset));
  const fuori = c.filter(x => !dichiarate.has(otticaDi(x.cfg)));
  chk('qualcosa da confrontare c e', c.length > 0, c.length + ' righe');
  chk('e nessuna riga usa una configurazione non dichiarata', fuori.length === 0,
    fuori.length ? fuori.map(x => otticaDi(x.cfg)).join(' · ') : 'tutte dichiarate');

  /* LA REGOLA VALE SU TUTTE E QUATTRO LE POSIZIONI, non solo sul tubo: un pezzo che
     non hai non deve entrare da nessuna parte. Si verificano una per una. */
  const usati = k => new Set(c.map(x => String(x.cfg[k])));
  const leciti = k => new Set(miei.map(p => String(p[{ tel: 'telescope', red: 'reducer',
    cam: 'camera', mnt: 'mount' }[k]])));
  for (const [k, nome] of [['tel', 'nessun tubo'], ['cam', 'nessuna camera'],
                           ['mnt', 'nessuna montatura'], ['red', 'nessun riduttore']]) {
    const intrusi = [...usati(k)].filter(v => !leciti(k).has(v));
    chk(nome + ' fuori da quelli dichiarati', intrusi.length === 0,
      intrusi.length ? 'intrusi: ' + intrusi.join(', ') : [...usati(k)].join(', '));
  }
  chk('il Tecnosky in uso non e fra i candidati, e non e dichiarato',
    !c.some(x => x.cfg.tel === 'tecnosky115'));

  /* E TUTTE QUELLE DICHIARATE DEVONO ENTRARE, non solo le prime. Il tetto era fisso
     a tre e contava le RIGHE: ogni configurazione ne produce due, una per binning,
     quindi con cinque dichiarate ne comparivano tre — due si prendevano due righe a
     testa e le altre due sparivano. Adesso il tetto segue le dichiarazioni
     (`Math.max(3,mySetups().length)` nella UI) e la riga migliore di ogni
     configurazione passa prima dei binning alternativi. Qui si verifica con cinque. */
  const cinque = [pres('rc8', 1, 'asi2600mm', 'cem70g'), pres('rc8', 0.8, 'asi2600mm', 'cem70g'),
    pres('tecnosky115', 1, 'asi2600mm', 'cem70g'), pres('askar71f', 0.75, 'asi2600mc', 'am5'),
    pres('redcat51', 0.92, 'asi2600mc', 'am5')];
  const q = cerca(cinque, conf('tecnosky115', 0.8, 'asi2600mm', 'am5'), Math.max(3, cinque.length));
  const viste = new Set(q.map(x => otticaDi(x.cfg)));
  chk('col tetto dell app tutte le configurazioni dichiarate compaiono',
    viste.size === cinque.length, viste.size + ' su ' + cinque.length);
  chk('nessuna configurazione intera resta fuori in silenzio', q.configTagliate === 0,
    'configTagliate ' + q.configTagliate);
  chk('e le righe restano ordinate per resa',
    q.every((x, i) => i === 0 || q[i - 1].P >= x.P - 1e-12),
    q.map(x => Math.round(x.P * 100)).join(' > '));
  /* Col tetto vecchio, fisso a tre, la copertura era incompleta: e' la misura che
     rende la verifica precedente non tautologica. */
  const tre = cerca(cinque, conf('tecnosky115', 0.8, 'asi2600mm', 'am5'), 3);
  chk('e con un tetto piu stretto il taglio si dichiara',
    new Set(tre.map(x => otticaDi(x.cfg))).size < cinque.length && tre.configTagliate > 0,
    new Set(tre.map(x => otticaDi(x.cfg))).size + ' configurazioni, ' + tre.configTagliate + ' dichiarate tagliate');
  chk('anche le righe tagliate si contano', tre.tagliate > 0, tre.tagliate + ' righe');
}

// ═══════════════════════════════════════════════════════════════════════════
H('E · NESSUN PRODOTTO CARTESIANO, E IL BINNING NON E STRUMENTAZIONE');
// ═══════════════════════════════════════════════════════════════════════════
{
  const miei = [pres('rc8', 1, 'asi2600mm', 'cem70g'), pres('askar71f', 0.75, 'asi2600mc', 'am5')];
  const c = cerca(miei, conf('tecnosky115', 0.8, 'asi2600mm', 'am5'));
  /* Possiedo un RC8 con la monocromatica e un Askar con la colori. «RC8 + colori»
     non e' una mia configurazione: i pezzi ci sono tutti, la configurazione no. */
  const inventate = c.filter(x =>
    (x.cfg.tel === 'rc8' && x.cfg.cam === 'asi2600mc') ||
    (x.cfg.tel === 'askar71f' && x.cfg.cam === 'asi2600mm') ||
    (x.cfg.tel === 'rc8' && x.cfg.mnt === 'am5') ||
    (x.cfg.tel === 'askar71f' && x.cfg.mnt === 'cem70g'));
  chk('nessuna combinazione inventata incrociando i pezzi', inventate.length === 0,
    inventate.length ? inventate.map(x => otticaDi(x.cfg)).join(' · ') : 'nessuna');
  const ottiche = new Set(c.map(x => otticaDi(x.cfg)));
  chk('le configurazioni distinte non superano quelle dichiarate',
    ottiche.size <= miei.length, ottiche.size + ' su ' + miei.length + ' dichiarate');
  chk('ma il binning viene ancora esplorato per ciascuna',
    c.length > ottiche.size, c.length + ' righe per ' + ottiche.size + ' configurazioni');

  /* IL RIDUTTORE: stesso tubo, stessa camera, due focali. Sono due configurazioni. */
  const due = [pres('tecnosky115', 1, 'asi2600mm', 'cem70g'),
               pres('tecnosky115', 0.8, 'asi2600mm', 'cem70g')];
  const d = cerca(due, conf('rc8', 1, 'asi2600mm', 'cem70g'));
  const focali = [...new Set(d.map(x => Math.round(x.dv.F)))];
  chk('lo stesso tubo con e senza riduttore da due configurazioni',
    new Set(d.map(x => otticaDi(x.cfg))).size === 2, focali.join(' e ') + ' mm');

  /* LA MONTATURA: era il difetto che questa modifica ha reso raggiungibile. La
     chiave di esclusione non la conteneva, e finche' i candidati venivano dal
     catalogo non si vedeva — nessuna coppia di preset differisce per la sola
     montatura. Qui si confronta con la chiave di PRIMA, ricostruita. */
  const stessaOttica = [pres('rc8', 1, 'asi2600mm', 'cem70g'), pres('rc8', 1, 'asi2600mm', 'am5')];
  const inUso = conf('rc8', 1, 'asi2600mm', 'cem70g');
  const e = cerca(stessaOttica, inUso);
  const chiaveVecchia = c2 => [c2.tel, Number(c2.red), c2.cam, Number(c2.bin || 1)].join('|');
  const persePrima = e.filter(x => chiaveVecchia(x.cfg) === chiaveVecchia(inUso));
  chk('lo stesso tubo su un altra montatura resta un candidato',
    e.some(x => x.cfg.mnt === 'am5' && x.bin === 1),
    e.map(x => x.cfg.mnt + ' bin' + x.bin).join(' · '));
  chk('la chiave di prima ne perdeva almeno una in silenzio', persePrima.length > 0,
    persePrima.map(x => x.cfg.mnt + ' bin' + x.bin + ' rms ' + x.rms.toFixed(2)).join(' · '));
  chk('e non erano la stessa cosa: la montatura porta il proprio errore di guida',
    new Set(e.map(x => Math.round(x.rms * 100))).size > 1,
    [...new Set(e.map(x => x.rms.toFixed(2)))].join(' e ') + ' arcsec');
  chk('la configurazione in uso continua a non confrontarsi con se stessa',
    !e.some(x => otticaDi(x.cfg) === otticaDi(inUso) && x.bin === 1));
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · UN DEFAULT MAI SCELTO NON DIVENTA UN POSSESSO');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La regola vive in `setupDaMigrare`, funzione pura di due argomenti, e si estrae
     da index.html: si interroga il codice che viene spedito, non una sua copia. */
  const i0 = ui.indexOf('function setupDaMigrare(');
  chk('la regola di migrazione e una funzione estraibile', i0 >= 0);
  const corpo = ui.slice(i0, ui.indexOf('\n}', i0) + 2);
  const mig = new Function('return ' + corpo)();
  const d0 = DB.presets[0];
  const comeIlDefault = { tel: d0.telescope, red: d0.reducer, cam: d0.camera, mnt: d0.mount, bin: 1 };

  chk('senza niente di salvato non eredita niente', mig(null, d0) === null);
  chk('una configurazione incompleta non diventa un possesso',
    mig({ tel: 'rc8' }, d0) === null);
  chk('il default mai scelto NON diventa un possesso',
    mig(comeIlDefault, d0) === null, d0.label);
  chk('ma se lo si e scelto davvero, resta',
    !!mig({ ...comeIlDefault, scelta: true }, d0));
  const diverso = { tel: 'askar71f', red: 0.75, cam: 'asi2600mc', mnt: 'am5', bin: 1 };
  const ered = mig(diverso, d0);
  chk('una configurazione diversa dal default era per forza una scelta', !!ered,
    ered ? ered.tel + ' ' + ered.red + 'x + ' + ered.cam : '—');
  chk('e si eredita per intero, riduttore compreso',
    ered && ered.red === 0.75 && ered.cam === 'asi2600mc' && ered.mnt === 'am5');
  chk('cambiare il solo riduttore basta a renderla una scelta',
    !!mig({ ...comeIlDefault, red: 0.8 }, d0));
  chk('il binning non entra in cio che si eredita',
    ered && ered.bin === undefined);

  /* E il possesso non si deduce mai dai pezzi. `addSetup` e' l'unica porta d'ingresso
     di `ap_setups`, e i suoi punti di chiamata si contano: la definizione, la
     migrazione, la spunta. Sono tutti e tre atti espliciti di chi usa l'app o
     l'eredita' di una scelta gia' fatta. Chiunque ne aggiunga un quarto fa cadere
     questa verifica e deve dire da dove viene quel possesso — che e' il punto.

     La verifica di prima cercava `gearList` vicino a `addSetup` nel testo, e cadeva:
     `setupLabel` legge il catalogo dei pezzi per comporre un nome e sta due righe
     sopra `addSetup`. Riconosceva la disposizione del file, non un comportamento. */
  const PORTE = [
    [/function addSetup\(c\)\{/,        'la definizione'],
    [/if\(eredita\)\{ addSetup\(eredita\);/, 'la migrazione da un installazione precedente'],
    [/if\(on\) addSetup\(daChiave\(k\)\);/,  'la spunta nella lista'],
  ];
  const siti = ui.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /addSetup\(/.test(l));
  const ignoti = siti.filter(([, l]) => !PORTE.some(([re]) => re.test(l)));
  chk('le configurazioni si dichiarano, non si generano', ignoti.length === 0,
    ignoti.length ? ignoti.map(([n, l]) => 'riga ' + n + ': ' + l.trim().slice(0, 40)).join(' · ')
                  : siti.length + ' punti di ingresso, tutti nominati');
  chk('e le porte sono tutte e tre ancora al loro posto',
    PORTE.every(([re]) => re.test(ui)));
}

console.log('\n' + (ko ? '\x1b[31m' : '\x1b[32m') + ok + ' verifiche superate, ' + ko + ' fallite\x1b[0m');
process.exit(ko ? 1 : 0);
