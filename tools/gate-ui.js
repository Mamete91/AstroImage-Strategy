#!/usr/bin/env node
/* GATE UI — controllo STRUTTURALE dell'interfaccia. Non modifica nulla e non
   verifica niente di scientifico: quello lo fanno test.js e i gate fisici.

   Esiste per chiudere l'unica falla silenziosa del progetto. L'helper interno di
   refresh() e' `const set=(id,html)=>{const e=$(id); if(e) e.innerHTML=html;}`:
   se un id sparisce dall'HTML durante un rifacimento della UI, non succede
   niente. Nessun errore in console, nessun test rosso — solo un pezzo di
   pannello che resta vuoto per sempre. Nessuna delle 483 verifiche del motore
   puo' accorgersene, perche' nessuna tocca il DOM.

   Controlla cinque cose:
     A · la cucitura motore/UI e' ancora estraibile dagli otto strumenti
     B · nessun <script> compare prima di quello principale
     C · ogni id che il JS risolve esiste nell'HTML statico o e' generato a runtime
     D · gli ancoraggi strutturali della dashboard ci sono tutti
     E · i pattern cercati dai gate source-text non sono stati introdotti

     node tools/gate-ui.js                                                    */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

let pass=0, fail=0;
function chk(name,ok,note){
  console.log(`${ok?'  ok  ':' FAIL '} ${name}${note?`   [${note}]`:''}`);
  ok?pass++:fail++;
}

/* ═══ A · la cucitura ═══
   Gli otto strumenti tagliano index.html per stringa. Se questo taglio non
   funziona piu', smettono di funzionare tutti insieme. */
console.log('\n--- A · cucitura motore / UI ---');
const parts=html.split('<script>');
chk('esiste un blocco <script> senza attributi', parts.length>=2);
const script=parts.length>=2 ? parts[1].split('</script>')[0] : '';
const MARK='/* =====================================================================\n   UI';
const hasMark=script.indexOf(MARK)>=0;
chk('il marcatore di confine UI e presente', hasMark,
    hasMark?'riga '+(html.slice(0,html.indexOf(MARK)).split('\n').length):'MARCATORE PERDUTO');
const pure=script.split(MARK)[0];
chk('la fetta motore e non vuota', pure.length>1000, pure.length+' caratteri');
/* Il motore e' puro per costruzione: se qui compare un riferimento al DOM,
   qualcosa e' passato dal lato sbagliato della cucitura. */
const DOMISH=['document.','innerHTML','querySelector','getElementById',
              'addEventListener','localStorage','classList'];
DOMISH.forEach(k=>chk(`il motore non usa ${k}`, pure.indexOf(k)<0));

/* ═══ B · nessuno script prima ═══ */
console.log('\n--- B · posizione del blocco script ---');
chk('un solo <script> senza attributi in tutto il file',
    html.split('<script>').length===2, (html.split('<script>').length-1)+' occorrenze');
const headHtml=html.slice(0,html.indexOf('<script>'));
chk('nessun <script src=...> aggiunto prima', !/<script\s+[^>]*>/.test(headHtml));

/* ═══ C · contratto degli id ═══ */
console.log('\n--- C · contratto degli id del DOM ---');
const bodyStart=html.indexOf('<body>');
const staticHtml=html.slice(bodyStart, html.indexOf('<script>'));
const uiJs=hasMark ? script.split(MARK)[1] : script;

const setOf=(re,src)=>{ const s=new Set(); let m; while((m=re.exec(src))) s.add(m[1]); return s; };
const STATIC =setOf(/id="([A-Za-z0-9_]+)"/g, staticHtml);
/* Gli id generati a runtime arrivano da tre strade diverse: scritti per esteso
   dentro un template, costruiti dal field-builder — `fld('gf_ap',…)` — oppure
   assegnati come proprieta' su un nodo creato al volo, `el.id='toast'`. Una
   scansione del solo `id="…"` ne vedrebbe una su tre e griderebbe al lupo sulle
   altre due: quattordici falsi allarmi, che e' il modo migliore per far
   ignorare un controllo. */
const RUNTIME=new Set([...setOf(/id="([A-Za-z0-9_]+)"/g, uiJs),
                       ...setOf(/\.id=['"]([A-Za-z0-9_]+)['"]/g, uiJs)]);
/* Una quarta strada: prefisso letterale piu' coda variabile — `id="gf_${id}"`
   nel field-builder dei moduli. Il prefisso si puo' verificare, la coda no, ed
   e' giusto cosi': quella la decide chi chiama. */
const PREFIX=[...setOf(/id="([A-Za-z0-9_]+)\$\{/g, uiJs)];
const byPrefix=id=>PREFIX.some(p=>id.indexOf(p)===0&&id.length>p.length);
const REFD   =new Set([...setOf(/\$\('([A-Za-z0-9_]+)'\)/g, uiJs),
                       ...setOf(/getElementById\('([A-Za-z0-9_]+)'\)/g, uiJs),
                       ...setOf(/getElementById\("([A-Za-z0-9_]+)"\)/g, uiJs)]);
/* Gli id passati per variabile — set('d_fl',…) dentro refresh() — non si vedono
   con una scansione di $('...'), quindi si cercano come stringhe nude. */
const asString=id=>uiJs.indexOf(`'${id}'`)>=0||uiJs.indexOf(`"${id}"`)>=0;

const orphan=[...REFD].filter(id=>!STATIC.has(id)&&!RUNTIME.has(id)&&!byPrefix(id));
chk('ogni id risolto dal JS esiste nel DOM o e generato a runtime',
    orphan.length===0, orphan.length?('ORFANI: '+orphan.join(' ')):`${REFD.size} riferimenti verificati`);

/* Un id statico che nessuna riga di codice risolve o e' un ancoraggio di markup,
   o e' un residuo. Vale la pena distinguerli per nome invece che con una soglia:
     aisRing, aisCore  gradienti SVG del logo, richiamati da url(#…) nell'HTML
     steprail, derived  contenitori con solo aggancio CSS
     filtSheet, stateSheet  gli involucri di Filtri e Archivio, diventati sezioni
                        della dashboard: gli id restano perche' il contratto del
                        DOM non perda pezzi, ma nessuno li risolve piu'. */
const MARKUP_ONLY=['aisRing','aisCore','steprail','derived','filtSheet','stateSheet'];
const unused=[...STATIC].filter(id=>!asString(id));
const unexpected=unused.filter(id=>MARKUP_ONLY.indexOf(id)<0);
chk('gli id statici senza codice sono solo ancoraggi noti di markup',
    unexpected.length===0,
    unexpected.length?('INATTESI: '+unexpected.join(' ')):(unused.join(' ')||'nessuno'));
console.log(`      ${STATIC.size} id statici · ${RUNTIME.size} generati a runtime · ${REFD.size} risolti dal JS`);

/* ═══ D · ancoraggi della dashboard ═══
   I contenitori senza i quali una sezione resta muta. */
console.log('\n--- D · ancoraggi strutturali della dashboard ---');
const ANCHORS=['app','boot','rows','rxOut','rxCtx','cfgCtx','bestNight',
               'rxTarget','rxHours','rxNights','rxGo',
               'derived','night','filtBody','stateList','sumBody','preset','tel','cam','mnt',
               'site','lat','lon','sqm','date','see','rms','bin','drop','fileIn','scanOut',
               'sheet','sheetBody','tgtBody','gearBody','dlObjects'];
const missing=ANCHORS.filter(id=>!STATIC.has(id));
chk('tutti gli ancoraggi della dashboard sono nell HTML statico',
    missing.length===0, missing.length?('MANCANO: '+missing.join(' ')):ANCHORS.length+' verificati');

/* Navigazione: ogni destinazione deve avere una sezione, e viceversa. Una voce
   di sidebar che non porta da nessuna parte e' il modo piu' rapido per far
   sembrare incompleto un software finito. */
const secs=[...setOf(/data-sec="([a-z]+)"/g, staticHtml)];
const gos =[...setOf(/data-go="([a-z]+)"/g,  staticHtml)];
const dead=gos.filter(g=>secs.indexOf(g)<0);
const unreachable=secs.filter(s=>gos.indexOf(s)<0);
chk('ogni destinazione di navigazione ha la sua sezione', dead.length===0,
    dead.length?('SENZA SEZIONE: '+dead.join(' ')):gos.length+' destinazioni');
chk('ogni sezione e raggiungibile dalla navigazione', unreachable.length===0,
    unreachable.length?('IRRAGGIUNGIBILI: '+unreachable.join(' ')):secs.length+' sezioni');
chk('la funzione di navigazione esiste', /function go\(name\)/.test(uiJs));
chk('il riepilogo laterale esiste', /function renderSummary\(\)/.test(uiJs));
/* Il riepilogo deve LEGGERE i valori gia' calcolati. Se qui comparisse una
   chiamata al motore, tornerebbero due sorgenti di verita' per gli stessi numeri. */
const sumFn=(uiJs.split('function renderSummary()')[1]||'').split('\nfunction ')[0];
const ENGINE_CALLS=['derive(','evaluate(','prescribe(','planNights(','exposurePlan(',
                    'resolveNight(','nightProfile(','subExposure(','filterFor('];
const called=ENGINE_CALLS.filter(f=>sumFn.indexOf(f)>=0);
chk('il riepilogo non richiama il motore', called.length===0,
    called.length?('CHIAMATE: '+called.join(' ')):'legge solo RXDV / RXEVAL / RXNIGHT / RXPR');

/* ═══ E · pattern dei gate source-text ═══
   gate-v16 e test.js cercano costanti cablate dentro TUTTO cio' che segue il
   primo <script>, quindi anche dentro il codice della UI. */
console.log('\n--- E · costanti vietate nel sorgente ---');
chk('nessun «2.8» introdotto (lo cerca gate-v16)', !/2\.8|×2,8|x2\.8/.test(script));
chk('nessun «0.8 … 23» introdotto (lo cerca test.js)',
    !/0\.8.{0,20}23|23.{0,20}0\.8x/.test(script));

console.log(`\n${pass} verifiche superate, ${fail} fallite\n`);
process.exit(fail?1:0);
