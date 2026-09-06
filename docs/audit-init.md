# Audit INIT — stato verificato

Le quattordici voci dell'audit iniziale, con lo stato **misurato** sul codice, non
ricordato. Ogni verdetto qui sotto è stato prodotto eseguendo il motore e
confrontando i numeri: dove c'è scritto CHIUSO esiste una misura che prima
sarebbe stata diversa, dove c'è scritto APERTO esiste il caso concreto in cui
oggi sbaglia.

**Misurato al commit `4da529f`, aggiornato a `HEAD`.** Rifare le misure dopo ogni intervento: questo
documento vale finché i numeri che contiene sono riproducibili.

## Perché esiste questo file

Lo stato dell'audit viveva nella memoria della conversazione, e infatti quando è
stato richiamato a distanza di tempo **né la ricostruzione a mano né la mia
erano corrette**: due voci avevano le etichette scambiate, tre erano date per
aperte quando erano chiuse a metà, e la sola voce davvero chiusa era data per
aperta. Un elenco di difetti che dipende da chi se lo ricorda non è un elenco di
difetti.

## Il quadro

| | voce | stato | gravità | costo |
|---|---|---|---|---|
| **C-1** | fattori di cielo calcolati su una banda, applicati a tutte | 🟢 chiusa | — | — |
| **C-2** | due grandezze diverse chiamate «ore per notte» | 🟡 metà | media | medio |
| **C-3** | convenzioni divergenti sull'angolo ignoto | 🟡 metà | media | medio |
| **C-4** | arricchimento OpenNGC senza effetto | 🟢 chiusa | bassa | piccolo |
| **C-5** | confronto cieco all'inquadratura | 🟢 chiusa | — | — |
| **C-6** | segnaposto di pozzo pieno che governa la posa | 🟢 chiusa | — | — |
| **C-7** | la classe sovrascrive i dati del bersaglio | 🟡 metà | media | piccolo |
| **D-1** | rumore fotonico del soggetto mai nella varianza | 🔴 aperta | **alta** | medio |
| **D-2** | sovra e sottocampionamento trattati uguali | 🟢 chiusa | — | — |
| **D-3** | convenzioni non dichiarate come tali | 🟡 metà | media | medio |
| **D-4** | candidati sotto soglia scartati | 🟡 metà | **alta** | piccolo |
| **D-5** | ogni candidato eredita la rotazione attuale | 🟢 chiusa | — | — |
| **D-6** | fallback che scattano in silenzio | 🟡 metà | media | medio |
| **D-7** | codice e dati mai raggiunti | 🟡 metà | media | piccolo |

Sei chiuse, sette a metà, una aperta. **C-6, C-1, C-5, D-2 e D-5 chiuse**; il resto
è fermo al `4da529f`. La sequenza dell'audit resta
`C-1 → C-2 → C-3 → C-6 → C-4/D-6 → C-5/D-2 → C-7/D-1`.

---

## Le due aperte

### D-1 · il rumore fotonico del soggetto non entra mai nella varianza

`varRate(r, tsub, s_arc)` ha il termine, `timeFactor` lo espone come quarto
argomento, e **nessuno dei sei siti di chiamata lo passa**. Strumentando il
motore e girando `evaluate` + `prescribe` su tutte e tredici le schede: **156
chiamate reali, 0 con `s_arc > 0`**. Ramo morto al cento per cento.

Conseguenza fisica: il motore dimensiona ogni ora come se il soggetto non
contribuisse al proprio rumore. È corretto per un oggetto debole, sbagliato per
un nucleo brillante — ed è la ragione per cui questa voce è legata a C-7.

Il codice per calcolare la brillanza esiste già dentro `objectSatTime`: va
estratto in `sFotFor(tg, arch, band)` e portato ai sei chiamanti, che hanno già
il bersaglio in ambito. Prima però va **deciso e dichiarato** quale brillanza
rappresenti l'oggetto: il picco, la media, o la superficie che si sta inseguendo.

### ~~D-5~~ · chiusa

`fitAlternatives` riceveva **una sola** rotazione — quella corrente del bersaglio —
e la applicava a tutti. Girare la camera non costa niente: è un gesto meccanico
che si fa una volta montando. Giudicare un'ottica all'angolo di un'altra non era
prudenza, era un errore di misura.

Misurato su M31 (190′×60′, PA 35), rotazione ereditata 90°:

| candidato | ereditata | propria | |
|---|---|---|---|
| Tecnosky 115 0.80× | 4 pannelli | **2** @115° | ×2,00 |
| RC8 0.80× | 12 pannelli | **8** @115° | ×1,50 |
| Tecnosky 115 nativo | 6 pannelli | 4 @20° | ×1,50 |

La resa del Tecnosky con riduttore passa da 69 % a 94 %: era penultimo, ora è
primo.

**Due obiettivi, non uno.** `bestRotation` minimizza i *pannelli*, ed è giusto in
copertura completa. In inquadratura libera i pannelli sono uno per definizione:
lì ruotare serve a far entrare più soggetto, e l'obiettivo è la *copertura*.
`bestRotationFor` sceglie l'obiettivo in base al modo — misurato su M31, la
copertura dell'Askar passa dal 78 % al 99 %.

**Il caso negativo è la maggioranza**: 118 oggetti su 169 non hanno un angolo di
posizione, e lì non c'è niente da ottimizzare — l'ingombro è isotropo per
convenzione dichiarata, la funzione restituisce `null` e si resta sull'angolo
ereditato. Verificato su NGC 6888: nessun candidato inventa una rotazione, tutti
seguono l'angolo passato, e la resa è identica fra due angoli diversi.

**E va detto**: ogni riga porta l'angolo a cui quel sistema è stato giudicato, con
una nota che spiega perché sono diversi. Senza, il confronto sarebbe onesto e
incomprensibile — chi monta la camera dritta otterrebbe altri numeri.

**C-3 non è stato necessario.** La correzione è contenuta in `fitAlternatives`
perché `projectPanels`, `coveredSpan` e `imageYield` sono già consapevoli della
rotazione, e `prescribe` riceve il numero di pannelli già ruotato. Il residuo di
C-3 — `evaluate()` che non riceve la rotazione — tocca la tabella e la scheda,
non la classifica, e resta aperto.

---

## Le voci a metà, e quale metà manca

### ~~C-1~~ · chiusa in `cdf2aa5`
`bandWidth` portava la larghezza della **finestra** in tutto il budget, ma
`index.html:5153` — la finestra della notte — era rimasta al riassunto
**scalare**. La stessa grandezza fisica usciva due volte diversa, e solo dove i
due divergono, cioè su un L-eNhance (10 nm di riassunto, 24 sull'OIII):

| | prima | dopo |
|---|---|---|
| SQM 20.0 | lpF 0.8650 vs 1/skyFactor 0.7352 — **+17,6 %** | 0,0000 % |
| SQM 18.5 | 0.5487 vs 0.3451 — **+59,0 %** | 0,0000 % |
| SQM 17.8 | 0.3804 vs 0.2102 — **+81,0 %** | 0,0000 % |

Una riga. Le altre ruote danno numeri identici bit per bit: dove scalare e
finestra coincidono non c'era niente da correggere. `critHeff` sull'L-eNhance
passa da 5,05 a 4,29 h a SQM 20.0 e da 2,22 a 1,23 h a 17.8 — il verso giusto,
perché 24 nm di finestra sotto i lampioni depositano meno.

Verificato che gli altri due consumatori di `critFwhm` non si muovano:
`isNarrow` resta vero (24 < 50) e `moonExcessFlux` ignora la larghezza per
scelta dichiarata. Coperta da `gate-finestre` sezione I, che rimettendo il
riassunto fallisce con «fino a 81,0 %».

**Debito ancora aperto**: `tools/gate-copertura.js:170` ricostruisce l'atteso con
la formula *precedente* e passa solo perché la fixture sceglie un filtro da 3 nm.
Montandoci un L-eNhance fallirebbe contro un motore corretto.

### C-2 · il motore separa le due unità, la pagina no
`perNight` è ora orologio puro (resta 8.08 h a SQM 21.6/20.8/18.5 mentre le ore
di progetto passano da 9.84 a 77.18), e `put` tiene `h` e `projH` come campi
distinti. Ma `index.html:8741` stampa ancora la formula ritirata
`perNight = critH × lpF`, cioè due «ore per notte» diverse a tre righe di
distanza. Stesso testo obsoleto in `docs/motore.md`.

### C-3 · chiusa sull'oggetto, aperta sulla camera
La convenzione per il PA **dell'oggetto** ignoto è una sola: su 1416 campioni,
`objectExtent`, `mosaicPanels.extent`, `framing.ex` e `coveredSpan` coincidono
bit per bit, zero divergenze; riproducendo la convenzione precedente si rompe su
12 oggetti su 169. Resta però che `evaluate()` non riceve la rotazione: la
tabella mostra ore e settimane di un progetto a camera 0° accanto ai pannelli
calcolati all'angolo salvato. E «angolo non scelto» e «angolo 0°» sono ancora la
stessa cosa.

### C-4 · l'unica chiusa, e il difetto era mal formulato
«Innesti a zero» è **refutato dalla misura**: 149 oggetti ricevono un innesto,
**41 cambiano davvero un numero della prescrizione**. Il caso di scuola è M31,
verificabile in tre modi indipendenti (pannelli 4→6, consiglio di rotazione da
assente a 6→2, su RC8 20→18). Restano tre residui minimi: un campo scritto e mai
letto (`ongc_type`, scatta su 0 oggetti) e due contatori morti.

### ~~C-5~~ · chiusa
Il motore ordinava già correttamente sulla resa — copertura × profondità ×
dettaglio — e questo non è stato toccato. Il difetto era **il criterio con cui il
confronto veniva mostrato**: `level === 'insufficiente'`, che è un giudizio sulla
sola *profondità*. Una configurazione poteva dichiarare «ridotto» ed essere
disastrosa sulla copertura senza che nessuno lo dicesse.

Misurato su 312 casi: il confronto compariva nel 77 % di quelli utili, e restava
nascosto **36 volte pur essendoci di meglio**. Il peggiore:

> NGC 7000 su RC8, inquadratura libera, 16 h — la tua resa **7 %** (copre il 14 %
> del soggetto), la migliore in ruota **90 %**, livello «ridotto».

Ora il confronto si mostra anche quando un'altra configurazione supera la tua di
`RESA_GAP` (10 punti di resa, costante dichiarata e tarata sulla distribuzione
reale dei divari), con una riga che spiega **perché**: non è la profondità a
mancare, è quanto ne inquadri o a quale dettaglio. Verificato che non produca
falsi positivi: su un caso già buono — Tecnosky su M27, livello «pieno» — il
blocco non compare. Costo misurato di `fitAlternatives`: 6 ms.

### ~~C-6~~ · chiusa in `cdf2aa5`
Il meccanismo era corretto, mancavano i dati: **10 camere su 17 erano sul
segnaposto da 20 000 e⁻**. Cinque record di `sensors`, tutti dal costruttore e
con la provenienza scritta, ne hanno chiuse otto **senza una riga di motore**:
imx455 51 400 · imx533 50 000 · imx410 100 000 · imx071 46 000 · mn34230 20 000.

Da notare l'MN34230: il valore vero **coincide** con il segnaposto, quindi per
l'ASI1600 la posa non è mai stata sbagliata — era sbagliato che fosse dichiarata
assunta.

Effetto misurato: la posa in luminanza raddoppia da 60 a 120 s sulle quattro
camere a **colori**, e non cambia sulle mono. La ragione è fisica: su una mono in
banda larga `tStar` vale 45 s ed è il pavimento operativo a legare, non il
pozzetto; su una matrice di Bayer la luce si divide fra i fotositi, `tStar` sale
a 152 s e il pozzetto vero libera davvero quel tetto. La banda stretta resta a
600 s ovunque.

Le due reflex generiche restano sul segnaposto e continuano a dichiararlo: non
hanno un sensore identificabile. Il controllo di copertura che mancava ora esiste
in `gate-v17`, e togliendo il dato all'IMX455 fallisce nominando le tre camere
che ne dipendono.

### C-7 · la scheda vince dove conta, la classe resta sola su due grandezze
Budget, strade, ordine, resa e trappole leggono sempre il bersaglio; l'archetipo
entra solo in `synthTarget`, cioè dove una scheda non esiste. Misura decisiva su
IC 1396: la prescrizione è esattamente quella della scheda, mentre la sua classe
`dark_molecular` la trasformerebbe in un oggetto a banda larga. Restano di sola
classe `line_fraction` e `stellar`, quest'ultima letta in sei punti con sei copie
della stessa riga.

### ~~D-2~~ · chiusa
`resolutionFidelity` era già asimmetrica e continua; il difetto stava nei tre
punti che la ignoravano.

**`samplingVerdict` era letteralmente simmetrico**: a 0,10″/px e a 2,00″/px
restituiva la stessa pastiglia `p-warn` e una nota byte-identica, mentre la
fedeltà vale 0,999 contro 0,827. Ora i due versi hanno classe, nota e un campo
`reversibile` distinti — perché sovracampionare non perde niente (i fotoni si
sommano dopo) e sottocampionare perde dettaglio che non torna. È la stessa cosa
che il progetto già scriveva nel tooltip dell'asse dettaglio e nel commento di
`binAdvice`, e che questa funzione contraddiceva.

**Il ripiego di `binAdvice`** prendeva il bin più spinto quando nessuno era
corretto, cioè il più sottocampionato. Misurato su 21 114 combinazioni di camera,
telescopio, riduttore e seeing: il ramo si raggiunge 1937 volte e in **176
consigliava bin 3 (fedeltà 0,866) dove bin 1 vale 0,982** — con seeing mediocre e
ottiche corte, cioè una notte normale. Ora sceglie il bin più alto che *non*
sottocampiona: 176 → **0**.

**Il forfait nel punteggio**: `sSamp` penalizzava il sovracampionamento con uno
0,9 fisso mentre il sottocampionamento usava la fedeltà vera — l'asimmetria
rovesciata, ~1,2 punti su 100 senza base fisica. Ora entrambi i versi passano
dalla stessa grandezza continua.

### D-3 · dichiarato il 30 %
Censimento: **43 famiglie decisionali, 97 letterali numerici. Dichiarate come
convenzioni 13 famiglie (30 %), non dichiarate 30 (70 %)**, di cui 21 senza un
solo commento. Le tredici dichiarate lo sono bene, e `CRIT_WEIGHT` è il modello
da seguire: costante nominata, effetto misurato dal motore stesso, riga in
interfaccia con entrambi i numeri. Lo strato più muto è quello del punteggio.

### D-4 · la strada è aperta, il confronto fra setup no
`roadChoices` offre tutte le strade con la penalità in chiaro, `fillBudget` non
scarta più, `feasibility` non emette veti. Ma `index.html:2954` contiene ancora
`if (e2.missing.length) continue;` — un **veto binario e silenzioso** dentro
`fitAlternatives`. Peggio: si fonda su `e2.missing`, cioè la strada di *default*,
non su quella davvero prescritta.

### D-6 · nessun ripiego del motore dichiara di essere scattato
**Sei `catch` nel motore, zero su sei dichiarano.** Fra i ripieghi numerici, nove
sostituiscono un dato fisico con un valore plausibile. Il più costoso è
`dark_e_s || 0.003`: su una reflex non raffreddata vale il **46 % delle ore**, e
scatta senza dire niente. Va chiesto nel modulo camera come già si chiedono
pixel, risoluzione, RN e QE.

### D-7 · sette funzioni morte, quattro tenute in vita dai test
Su 148 dichiarazioni del motore, **sette sono irraggiungibili**: `moonTolerance`,
`gainModeFor`, `strategyOf`, `bandeUsate`, `lpSkyRatio`, `starsTag`, `starsTip`.
Quattro sopravvivono solo perché un test o un export le nomina — vanno rimosse
anche di lì, o il censimento si sporca di nuovo il giorno dopo.

---

## Il debito delle verifiche

Alcune verifiche che coprono queste voci **non possono fallire**, e vanno
riparate insieme alla voce che dovrebbero difendere.

| dove | che cosa |
|---|---|
| ~~`gate-strategie.js:183-184`~~ | **riparate**: confrontavano `rc8` con sé stesso e `f(x)` con `f(x)`. La scala del pixel è un *ingresso* e non poteva differire; ora si confronta ciò che il motore **produce** — `resol` e `samp` — sui due scenari |
| `test.js:1515` | ribattitura verbatim della formula di `varRate` |
| `tools/gate-copertura.js:170` | codifica la formula **precedente** a C-1; passa per scelta della fixture |
| `tools/gate-tempo.js` (blocco H) | chiama `planNights` senza `expo`, quindi il costo vale 0 e il secondo fattore non è mai esercitato |
| `tools/gate-copertura.js:188` | `fitAlternatives` provata solo con la ruota completa: 0 candidati scartati su 143, cioè l'unica configurazione in cui il veto di D-4 non scatta |

Il modello corretto esiste ed è in `tools/gate-finestre.js` sezione H: monta il
filtro che fa divergere le due regole, chiama il motore e asserisce la
differenza. Prima della correzione fallirebbe; dopo, no.

---

## Che cosa non è nell'audit ed è stato fatto lo stesso

Non riaprire: modello fotometrico per camera e modalità, pozzetto derivato,
OSC/CFA, area collettrice, rumore di lettura, posa e sue tre strategie, cielo per
banda, penalità lunare, finestre dei dual-band, mono/OSC, saturazione per
fotosito. E sul lato prescrizione: strada scientifica, filtri posseduti e
accesi, invarianza della prescrizione rispetto alla strategia, riparto delle ore,
`CRIT_WEIGHT` dichiarato, `refSub` reso deterministico, `source`/`confidence` sui
budget.
