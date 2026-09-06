# Audit INIT — stato verificato

Le quattordici voci dell'audit iniziale, con lo stato **misurato** sul codice, non
ricordato. Ogni verdetto qui sotto è stato prodotto eseguendo il motore e
confrontando i numeri: dove c'è scritto CHIUSO esiste una misura che prima
sarebbe stata diversa, dove c'è scritto APERTO esiste il caso concreto in cui
oggi sbaglia.

**Misurato al commit `4da529f`.** Rifare le misure dopo ogni intervento: questo
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
| **C-1** | fattori di cielo calcolati su una banda, applicati a tutte | 🟡 metà | media | piccolo |
| **C-2** | due grandezze diverse chiamate «ore per notte» | 🟡 metà | media | medio |
| **C-3** | convenzioni divergenti sull'angolo ignoto | 🟡 metà | media | medio |
| **C-4** | arricchimento OpenNGC senza effetto | 🟢 chiusa | bassa | piccolo |
| **C-5** | confronto cieco all'inquadratura | 🟡 metà | media | piccolo |
| **C-6** | segnaposto di pozzo pieno che governa la posa | 🟡 metà | media | piccolo |
| **C-7** | la classe sovrascrive i dati del bersaglio | 🟡 metà | media | piccolo |
| **D-1** | rumore fotonico del soggetto mai nella varianza | 🔴 aperta | **alta** | medio |
| **D-2** | sovra e sottocampionamento trattati uguali | 🟡 metà | media | medio |
| **D-3** | convenzioni non dichiarate come tali | 🟡 metà | media | medio |
| **D-4** | candidati sotto soglia scartati | 🟡 metà | **alta** | piccolo |
| **D-5** | ogni candidato eredita la rotazione attuale | 🔴 aperta | **alta** | medio |
| **D-6** | fallback che scattano in silenzio | 🟡 metà | media | medio |
| **D-7** | codice e dati mai raggiunti | 🟡 metà | media | piccolo |

Una chiusa, undici a metà, due aperte. La sequenza dell'audit resta
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

### D-5 · ogni candidato eredita la rotazione attuale

`fitAlternatives` riceve **una sola** rotazione e la applica a tutti i candidati:
quella corrente del bersaglio. `bestRotation` non compare mai lì dentro — il suo
unico uso è sul setup già scelto. Il confronto fra strumenti è quindi falsato in
modo sistematico.

Misura su M31 (190′×60′, PA 35), rotazione corrente 90°:

| candidato | pannelli ereditati | pannelli propri | fattore |
|---|---|---|---|
| RC8 nativo | 20 (4×5) | 14 (2×7) @16° | ×1,43 |
| RC8 0.80× | 16 (4×4) | 8 (4×2) @114° | **×2,00** |

Un candidato che chiede metà dei pannelli viene confrontato come se ne
chiedesse il doppio. Va calcolata la rotazione **per candidato** e dichiarata
nella riga, altrimenti il confronto diventa onesto ma incomprensibile.

---

## Le voci a metà, e quale metà manca

### C-1 · fatto il budget, manca la finestra della notte
`bandWidth` porta la larghezza della **finestra** in tutto il budget, per tutte
le bande: a SQM 18.5 lo spread fra L e 3 nm è ×10,5 dove storicamente c'era un
numero solo, e a SQM 21.3 tutti valgono esattamente 1.0000.

Ma `index.html:5153` usa ancora il riassunto **scalare** del filtro, e alimenta
`lpF`, `skyF` e `critHeff`. Con un L-eNhance — l'unico filtro in cui scalare e
finestra divergono, 10 nm contro 24 — la stessa grandezza esce due volte diversa:

```
SQM 20.0   lpF 0.8650  vs  1/skyFactor 0.7352    +17.6%
SQM 18.5   lpF 0.5487  vs  0.3451                +59.0%
SQM 17.8   lpF 0.3804  vs  0.2102                +81.0%
```

La correzione è un drop-in di una riga (`bandWidth(critFilter, critBand)`),
provata in memoria: chiude l'incoerenza e non muove nient'altro.

**Debito collegato**: `tools/gate-copertura.js:170` ricostruisce l'atteso con la
formula *vecchia* e passa solo perché la fixture sceglie un filtro da 3 nm, dove
le due regole sono indistinguibili. Montandoci un L-eNhance quel gate
fallirebbe contro un motore che si comporta correttamente.

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

### C-5 · il motore vede l'inquadratura, l'utente non lo vede mai
Ricostruendo il criterio pre-`80a4144` e applicandolo agli stessi candidati:

| caso | vecchio vincitore | copre | nuovo vincitore | copre |
|---|---|---|---|---|
| Velo, 16 h | RC8 ridotto | 8,0 % | Askar nativo | 56,0 % |
| NGC 7000, 20 h | RC8 bin 2 | 13,5 % | Askar nativo | **99,7 %** |

La correzione è reale. Ma il blocco «Con quale strumento viene meglio» è
condizionato a `level === 'insufficiente'`, e in inquadratura libera quel livello
quasi non si raggiunge — l'RC8 sul Velo dichiara «pieno» coprendo l'8 % del
soggetto. **Il confronto per resa non viene mostrato proprio nella modalità in
cui è l'unico giudizio sensato.**

### C-6 · il meccanismo c'è, i dati no
`gainModes` deriva il pozzetto dal sensore, dichiara `assumed` e l'interfaccia
rende la pastiglia «pozzetto assunto». Ma **10 camere su 17 sono ancora sul
segnaposto da 20 000 e⁻** (59 %). Aggiungere `saturazione_e` a cinque record di
`sensors` — imx533, imx455, imx071, imx410, mn34230 — ne chiude otto **senza
toccare una riga di motore**. Le due reflex generiche restano legittimamente sul
segnaposto: non hanno un sensore. Manca anche un controllo di copertura: nessun
file verifica che ogni camera con sensore riconosciuto esca da `gainModes` con
`assumed === false`.

### C-7 · la scheda vince dove conta, la classe resta sola su due grandezze
Budget, strade, ordine, resa e trappole leggono sempre il bersaglio; l'archetipo
entra solo in `synthTarget`, cioè dove una scheda non esiste. Misura decisiva su
IC 1396: la prescrizione è esattamente quella della scheda, mentre la sua classe
`dark_molecular` la trasformerebbe in un oggetto a banda larga. Restano di sola
classe `line_fraction` e `stellar`, quest'ultima letta in sei punti con sei copie
della stessa riga.

### D-2 · la metà continua è fatta, quella dei consigli no
`resolutionFidelity` è genuinamente asimmetrica (0.9994 contro 0.8270) e la resa
ordina i setup su una scala continua. Ma `samplingVerdict` è ancora
**letteralmente simmetrico**: a 0.10″/px e a 2.00″/px restituisce la stessa
classe e una nota byte-identica, mentre la fedeltà reale differisce del 17 %. E
il ripiego di `binOptions` sceglie il bin più spinto quando nessuno è corretto,
dove la risposta giusta sarebbe bin 1.

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
| `tools/gate-strategie.js:183` | `rc8.scale === rc8.scale` — confronto con sé stesso |
| `tools/gate-strategie.js:184` | `abs(f(x) − f(x)) < 1e-15` — sempre zero; gli scenari `s0`/`s1` sono calcolati e mai usati |
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
