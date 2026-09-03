# Catalogo: da elenco di camere a catalogo di sensori

*Studio di architettura. Nessuna modifica al motore. Tre linee di ricerca su fonti
primarie — documentazione Sony, dati pubblicati dai costruttori di camere, misure
indipendenti — e la verifica di quanto ne discende, misurata sul motore.*

---

## Il risultato che non era nella domanda

Prima dell'architettura, il reperto più grosso, perché cambia il peso di tutto il resto.

**Le tabelle QE del motore sono sistematicamente alte dal 12% al 38% rispetto alle
misure indipendenti, e lo sono di quantità diverse su camere diverse.**

| | motore | misura indipendente | fonte | scarto |
|---|---|---|---|---|
| 2600MM @ 527,5 nm | 88,3% | **74,1%** | Lucid, EMVA 1288 (IMX571 mono) | +19% |
| 2600MC @ 527,5 nm | 80,9% | **62,7%** | Lucid, EMVA 1288 (IMX571 verde) | +29% |
| 6200MM @ 475 nm | 89,6% | **80%** | Alarcon 2023, PASP — monocromatore, fotodiodo calibrato | +12% |
| 6200MM @ 700 nm | 51,0% | **37–42%** | Alarcon · Gill · Betoule, concordi | +21…+38% |

L'origine è nota e documentata dalla ricerca: **nessun costruttore di camere
astronomiche pubblica QE assoluta.** ZWO intitola le proprie curve *"Relative QE
Curve"*; per la ASI294 il manuale scrive letteralmente **«TBD»** e la pagina dice
*«we estimate is over 75%»*; per la ASI178 dice *«around 70%–80%»* e aggiunge che
Sony non ha fornito la QE assoluta. Le curve sono forme relative riscalate su un
picco dichiarato, e il picco dichiarato è alto.

### Ma quanto costa davvero

Poco dove le camere si somigliano, molto dove non si somigliano — che è esattamente
dove il motore serve. Riscalando **solo** la 2600MM (×0,839) e la 2600MC (×0,775)
alle misure EMVA:

| | Hα | OIII | RGB | L |
|---|---|---|---|---|
| Askar 0,80× + **2600MM** | +1,9% | +1,9% | +0,5% | +0,2% |
| Askar 0,80× + **2600MC** | **+22,8%** | **+19,1%** | +9,1% | +9,7% |
| RC8 + **2600MM** | +4,3% | +4,5% | +1,4% | +0,6% |
| RC8 + **2600MC** | **+24,9%** | **+22,8%** | +10,3% | +11,0% |

Il confronto mono-contro-mono non si muove: il riferimento è anch'esso una 2600MM e
la scala si semplifica nel rapporto. **Il confronto mono-contro-matrice si muove
fino al 25%**, perché lì le due camere sono riscalate di fattori diversi e la
differenza non si semplifica. È la decisione su cui verteva tutto il gate v1.6.

Il rapporto che porta l'errore è uno solo:

| QE colore / QE mono a 527,5 nm | |
|---|---|
| motore | **0,916** |
| misurato sullo stesso sensore (Lucid/EMVA, IMX571) | **0,846** |
| media di sei sensori Sony, tre laboratori (vedi sotto) | **0,864 ± 0,015** |
| **rapporto dei picchi dichiarati da ZWO stessa** (80% / 91%) | **0,879** |

L'ultima riga è la più imbarazzante e la più facile: **le mie due tabelle non sono
coerenti nemmeno con la fonte da cui le ho ricavate.** ZWO dichiara 91% e 80%, cioè
0,879; le mie tabelle danno 0,911 al picco. La MC è alta del 3,6% rispetto alla MM
contro la fonte usata per costruirle entrambe. Un terzo dello scarto si chiude senza
alcun dato nuovo, solo rimettendo in riga le tabelle con la loro stessa sorgente.

---

## Una convalida nuova, e forte, del modello di Bayer

Le misure EMVA 1288 hanno una proprietà che nessuna curva di costruttore ha: **mono
e colore della stessa camera, misurati sulla stessa scala assoluta**. Il loro
rapporto è la trasmissione del colorante, misurata:

```
QE_colore(λ) / QE_mono(λ) = T_colorante(λ)
```

Al picco del verde, su sei sensori Sony di quattro generazioni:

| sensore | λ | mono | verde | **T_G** | fonte |
|---|---|---|---|---|---|
| IMX178 | 530 | 75,0% | 65,0% | **0,867** | FLIR BFS-U3-63S4 M/C — pubblicato |
| IMX183 | 525 | 79,0% | 69,0% | **0,873** | FLIR BFS-U3-200S6 M/C — pubblicato |
| IMX226 | 530 | 85,0% | 72,0% | **0,847** | FLIR BFS-U3-120S4 M/C — pubblicato |
| IMX571 | 527,5 | 74,1% | 62,7% | **0,846** | Lucid Triton10 26MP — ricavato da soglia EMVA |
| IMX585 | 527,5 | 90,5% | 78,0% | **0,862** | Lucid Triton10 8.3MP — ricavato |
| IMX492 | 527,5 | 81,9% | 72,9% | **0,890** | Lucid Atlas10 47MP — ricavato |

**Media 0,864, scarto tipo 0,015 — l'1,8%.** Quattro generazioni di silicio, tre
laboratori, e la trasmissione del colorante verde al suo picco è la stessa entro il
2%. Non è una coincidenza: è il comportamento del colorante, ed è la prima conferma
indipendente dell'ipotesi su cui poggia `sony_bayer_generic` — che una curva di
mosaico Sony si possa trasferire fra sensori della stessa famiglia.

Nota metodologica: le tre righe Lucid sono **ricavate**, non pubblicate. Lucid
pubblica il rumore di buio e la soglia assoluta di sensibilità; EMVA 1288 §2.4 dà
`η = (σ_d + 0,5)/μ_p,min`. La derivazione è stata validata contro i quattro casi
FLIR in cui entrambe le grandezze sono pubblicate, e torna entro 0,3 punti
percentuali su tutti e quattro. Va comunque marcata come derivata.

Il modello attuale, invece, alle righe che contano:

| riga | λ | mosaico/migliore (modello) | dichiarato 2600MC |
|---|---|---|---|
| OIII | 500,7 | 0,640 | 0,641 |
| Hα | 656,3 | 0,374 | 0,357 |
| SII | 671,6 | 0,412 | 0,393 |

---

# 1 · Gerarchia: due livelli o tre

**Due. La proposta a tre era mia ed era sovradimensionata.** Tre ragioni, e poi una
quarta che viene dalla ricerca e che è la più importante.

**I · Il terzo gradino non viene mai scelto.** `mosaicFrac()` legge
`DB.cfa_response`, che c'è sempre: il modello è disponibile per ogni camera a
matrice. Quindi `ereditato` è raggiungibile solo quando il modello manca — e allora
è infondato quanto lui. Un gradino di precedenza mai selezionato non è una rete di
sicurezza: è codice morto con un costo di test.

**II · L'ordine `modello > ereditato` è una tautologia, non un giudizio.** I valori
ereditati *sono* l'uscita di un modello: una derivazione a mano su curve tipiche,
congelata in un campo dati. Il confronto è quindi fra un modello vecchio e
irriproducibile e uno attuale, rieseguibile e coperto da test. Il secondo vince per
costruzione — migliora da solo quando migliora la curva sottostante. Una precedenza
tautologica non ha bisogno di un gradino: ha bisogno di una cancellazione.

**III · Tre gradini ne invitano un quarto.** Due livelli con una prova di ammissione
sono una procedura di decisione; tre sono una trattativa.

**IV · La ricerca dimostra che «dichiarato» non è affatto sinonimo di «misurato».**
Questo è il punto che cambia la forma della regola:

- ZWO, ASI294, QE di picco: **«TBD»** nel manuale, *«we estimate»* nella pagina.
- ZWO, ASI178, QE di picco: *«around 70%–80%»*, assoluta non fornita da Sony.
- **Altair** dichiara *«>90% Peak»* per la Hypercam 26C, che è a **colori**: è la
  cifra del **mono**. Dodici punti percentuali.
- **ZWO contraddice sé stessa**: pozzetto IMX571 di 50 ke⁻ nel manuale 2024 e
  73 ke⁻ nella pagina 2025, stessa camera. Idem sull'IMX585: 47 ke⁻ nel manuale,
  40 ke⁻ nella pagina Air.
- **ToupTek e Moravian pubblicano come «pozzetto» il fondo scala dell'ADC.**
  Verificabile aritmeticamente sulle loro stesse tabelle: `pozzetto = e⁻/ADU ×
  65536` in ogni riga. ToupTek dichiara **102,5 ke⁻** per un IMX571 il cui pixel
  satura intorno ai **51 ke⁻** — e Lucid, misurando secondo EMVA, trova
  **48,2 ke⁻** (mono) e **49,5 ke⁻** (colore). Il numero di ToupTek è alto del
  doppio e non è sbagliato: è un'altra grandezza, non etichettata.

Un dato dichiarato da un costruttore non è automaticamente migliore di un modello.
A volte non è nemmeno una misura. **Quindi la prova di ammissione non può essere
«qualcuno lo ha pubblicato»: deve riguardare come è stato ottenuto.**

## La regola

```
MISURA     ammessa solo se sono dichiarati TUTTI e quattro:
             · il metodo          (banco, monocromatore, EMVA 1288, confronto…)
             · il riferimento     (fotodiodo calibrato, sensore di QE nota, standard)
             · la GRANDEZZA       QE assoluta / risposta relativa per fotone /
                                  risposta relativa per watt · carica di saturazione /
                                  fondo scala ADC — senza ambiguità
             · documento e data   (il costruttore contraddice sé stesso fra edizioni)

MODELLO    calcolato adesso dal motore, riproducibile, coperto da test
───────────────────────────────────────────────────────────────────────
IGNOTO     né l'una né l'altro: segnaposto DICHIARATO, mai silenzioso
```

`ereditato` **non diventa un terzo gradino: diventa un campo di documentazione.**
`cfa_fraction_previous`, già presente sulla 2600MC, è esattamente il modello da
generalizzare — il valore resta visibile, tracciabile e fuori dal percorso di
calcolo.

`IGNOTO` non è un gradino di precedenza: è uno **stato**. Serve dove non esiste
nemmeno un modello — il pozzetto senza `gain_modes`, la corrente di buio — e la sua
regola è una sola: il segnaposto si usa e **si dichiara**. Oggi il motore scrive
`assumed: true` e nessuno lo legge.

## La regola applicata a quello che la ricerca ha trovato

| | esito | perché |
|---|---|---|
| FLIR / Basler / Lucid, EMVA 1288 | **MISURA** | standard citato, condizioni dichiarate (16 bit, ISP disattivo, 20 °C), grandezza definita |
| Alarcon 2023 · Betoule 2023 · Gill 2022 | **MISURA** | monocromatore, fotodiodo calibrato NIST/Hamamatsu, referato |
| QHY, QE assoluta misurata | **condizionata** | metodo comparativo contro un ICX694 di QE *assunta*: un anello più lontano dalla catena metrologica. L'articolo sull'IMX585 non dichiara alcun metodo |
| Buil (ASI294MM) | **condizionata** | spettrografo UVEX, sperimentatore trasparente, ma non è un banco a sfera integratrice |
| «QE di picco XX%» dei costruttori | **RESPINTO** | grandezza non definita, spesso stima esplicita |
| curve «relative» senza normalizzazione dichiarata | **RESPINTO** | inutilizzabili per il confronto fra camere |
| «pozzetto» non distinto dal fondo scala ADC | **RESPINTO** | dimostrato: è un'altra grandezza |
| gli attuali `cfa_fraction` generici su 7 camere | **RESPINTO** | modello congelato |
| SharpCap, astropical, astrojolo | **RESPINTO** come ancora | SharpCap non misura affatto la QE; gli altri due aggregano specifiche di costruttore |

---

# 2 · Separare SENSORE e CAMERA

**Sì, ma non per la ragione data.** Sdoppiare una quindicina di schede non vale una
modifica di schema. Le ragioni che la valgono sono altre tre.

### Ragione I — il motore smette di farsi dire ciò che può calcolare

La ricerca dimostra l'identità:

```
pozzetto_camera = min( carica_di_saturazione_SENSORE ,  fondo_scala_ADC × e⁻/ADU )
```

Le tabelle di ToupTek la soddisfano riga per riga (`e⁻/ADU × 65536`), quelle di
Moravian anche, e la misura EMVA di Lucid fissa la carica di saturazione
dell'IMX571 a 48,2 ke⁻. Con `carica_di_saturazione` a livello sensore e
`(bit, e⁻/ADU)` a livello camera, **il segnaposto da 20000 e⁻ sparisce per ogni
camera il cui sensore sia noto** — cioè per tutte — e nello stesso momento il
motore riconosce i 102,5 ke⁻ di ToupTek per quello che sono. È il difetto numerico
più grande trovato nel percorso «camera nuova» (×3 sulla posa in banda larga),
risolto dalla struttura invece che dall'inserimento dati.

### Ragione II — un dato solo sistema molte camere

La risposta per canale del mosaico è una proprietà pura del silicio, ed è
esattamente il dato che non esiste per camera. Se un giorno esce una curva
dell'IMX294 a colori, **una** riga rimette a posto ZWO, QHY, Player One, ToupTek,
Altair e RisingCam insieme.

### Ragione III — le contraddizioni fra costruttori diventano visibili

Con una riga di sensore, il *«>90% peak»* di Altair per una IMX571 **a colori**
collide con lo *«80%»* di ZWO **nello stesso posto**, e il motore può rifiutare o
segnalare. Oggi sarebbero due righe camera indipendenti, entrambe credute.

## Tre trappole, tutte emerse dalla ricerca

**A · Il pixel non è una proprietà del sensore: è una proprietà del MODO DI
LETTURA.** L'IMX294 è nativamente 8288×5644 a 2,315 µm; ZWO lo vende binnato
4144×2822 a 4,63 µm; la ASI294MM può sbloccare il bin 1 — e allora **è
l'IMX492**, stesso silicio letto in un altro modo. Quindi

```
SENSORE  →  MODO DI LETTURA  →  CAMERA
```

non `SENSORE → CAMERA`. Senza il livello intermedio la coppia IMX294/IMX492 rompe
lo schema il primo giorno. È proprio il sensore su cui verte la domanda.

**B · Il rumore di lettura è limitato, non condiviso.** Il sensore fissa un
pavimento; la catena analogica e l'ADC della camera ci aggiungono. Lo scarto fra
costruttori sullo stesso silicio è reale — IMX178 mono: 75% @530 (FLIR) contro 81%
@541 (Basler), e 2,45 e⁻ contro 3 e⁻ di rumore. Quindi il rumore resta **della
camera**; il sensore porta il pavimento come **regola di validazione**, non come
valore condiviso. Una regola vale più di un numero copiato.

**C · L'ambiguità fotone/watt non è risolta da nessun costruttore.** Nessuno — ZWO,
QHY, Player One, Altair, ToupTek, Atik, Moravian — dichiara se la propria «risposta
relativa» sia per fotone o per watt. Le due differiscono di un fattore λ, ed è la
spiegazione più probabile di una parte delle contraddizioni fra curve. Una scheda
che memorizza una curva senza quel campo **mescolerà le due in silenzio**. Serve
quindi, su ogni curva:

```
grandezza: QE_assoluta | relativa_per_fotone | relativa_per_watt | ignota
```

e `ignota` **non è utilizzabile per il confronto fra camere diverse**.

## Lo schema

```
SENSORE            IMX571
  costruttore, famiglia, tecnologia (BSI/FSI), otturatore
  area utile mm, disposizione della matrice (RGGB…)
  carica_di_saturazione_e   ← misura, con la sua prova di ammissione
  pavimento_rumore_e        ← regola di validazione, non valore
  qe_curve[]                ← con grandezza, metodo, riferimento, documento, data
  cfa_response              ← curva per canale a normalizzazione COMUNE, se esiste
  modi_lettura[]            ← pixel_um, larghezza, altezza, binning nativo

CAMERA             ZWO ASI2600MM Pro
  sensore + modo_lettura    ← la chiave è la COPPIA
  bit_adc, e_per_adu[]
  gain_modes[]              ← soglia HCG, rumore, pozzetto DERIVATO dalla formula
  dark_e_s(T)
  finestra ottica, raffreddamento, elettronica
  qe_curve[]                ← solo se la CAMERA è stata misurata (raro, prezioso)
```

---

# 3 · Perimetro: quali sensori, dato che il planetario è fuori

La domanda si risolve con l'evidenza, non con l'opinione.

**IMX678 esce — l'evidenza è negativa.** Nessuna camera raffreddata TEC con IMX678
esiste nelle linee 2026 di nessuno degli otto costruttori esaminati. ZWO ASI678MC/MM
non raffreddate, ToupTek G3M678 archiviata dal costruttore stesso sotto
`/planetary-cameras/`, OGMA «Guide/Planetary», Altair planetaria.

**IMX585 entra — l'evidenza è positiva, e netta.** Cinque costruttori vendono corpi
raffreddati per il profondo cielo: ZWO ASI585MC/MM **Pro** (TEC a due stadi, −35 °C
sotto ambiente, e ZWO lo chiama *«a new ZWO deep sky camera»*), QHY miniCAM8 (−45 °C
sotto ambiente), Player One Uranus-M/C PRO, ToupTek ATR585, Altair Hypercam 585 TEC.

Dei quindici sensori dell'elenco di partenza, **sette sono planetari o di guida** —
IMX462, IMX662, IMX290, IMX224, IMX464, IMX678 e, di fatto, IMX178. Escluderli non
è una perdita: è il perimetro.

L'insieme che il mercato spedisce davvero per il profondo cielo:

| classe | sensori |
|---|---|
| oltre il pieno formato | IMX411 · IMX461 |
| pieno formato | IMX455 · IMX410 · IMX366 |
| APS-C | **IMX571** |
| 4/3″ | **IMX294 / IMX492** (stesso silicio, due modi) · IMX269 |
| 1″ e dintorni | **IMX533** · IMX183 · IMX585 |
| 1,1″ scientifici | IMX428 · IMX432 · IMX304 |
| non Sony | Gpixel GSENSE2020 / 4040 / 6060 |

Circa quindici righe di sensore coprono praticamente ogni camera deep-sky di otto
costruttori. A livello camera le stesse coprirebbero ottanta e passa schede. È
l'argomento della deduplicazione: **vero, e secondario** rispetto alle tre ragioni
di sopra.

---

# 4 · ASI294MC e ASI178: che cosa manca davvero

## ASI294MC

| dato | stato | sotto la regola a due livelli |
|---|---|---|
| QE di picco | ZWO: manuale **«TBD»**, pagina *«we estimate is over 75%»* | **RESPINTO.** Non è una misura, è una stima dichiarata tale. Il motore oggi porta `qe_peak: 0.75` come se fosse un dato |
| QE(λ) | curva «relative», normalizzazione non dichiarata | **RESPINTO** per il confronto fra camere |
| CFA per canale | **non esiste**, da nessuno | modello, ±35% nel rosso |
| pozzetto | 63,7 ke⁻ dichiarato. 63700/16384 = 3,89 e⁻/ADU a 14 bit: plausibile come carica di saturazione, ma non dichiarato come tale | **condizionato** — ed è esattamente ciò che la formula del §2 verificherebbe da sola |
| soglia HCG | gain ≥ 120, dichiarata | ammessa (parametro operativo, non fotometrico) |
| rumore di lettura | 1,2 e⁻ a 35 dB, «sotto 2 e⁻» in HCG | ammesso |
| corrente di buio | grafico vs temperatura pubblicato | digitalizzabile |

**Nessuna misura indipendente dell'IMX294 esiste.** Il corpus referato sui CMOS Sony
astronomici è, in tutto, **IMX455 e IMX411**. Il vicino più prossimo è l'IMX492 —
stesso silicio, letto senza binning — su cui esistono la misura di Buil (~84% verde,
UVEX) e la mia derivazione da Lucid (81,9% mono, 72,9% verde). Utilizzabili come
verifica di plausibilità, **non** come QE della 294.

**Conclusione onesta: la 294MC non può andare ad alta confidenza, e la strada più
redditizia non è cercare la QE — è la struttura.** Il pozzetto derivato dalla
coppia sensore/ADC vale ×3 sulla posa in banda larga; una QE di picco più precisa
del 10% vale, sui confronti che contano, molto meno.

## ASI178MM / ASI178MC

Qui succede una cosa istruttiva.

**La 178 è il sensore meglio documentato di tutto l'elenco.** Tre misure
indipendenti sul mono — FLIR 75% @530 nm ed EMVA completa, Basler 81% @541 nm,
più la carta di The Imaging Source dichiarata *«courtesy of Sony Deutschland GmbH»* —
e, unica di tutta la lista insieme all'IMX183, **QE assoluta per canale su scala
comune**: B 61% @460 · G 65% @530 · R 41% @625, EMVA 1288, 20 °C, ISP disattivo.
Il pozzetto è confermato da tre fonti che concordano: 15 ke⁻ (ZWO), 14,2 (FLIR),
14,3 (Basler). E **non ha modo HCG**: da non modellare.

Sul **mono** la 178 potrebbe entrare subito ad alta confidenza reale: η = 1, niente
matrice, QE misurata da due laboratori.

**Ed è irrilevante per questo motore.** 1/1,8″, 7,4 × 5 mm, 2,4 µm: sull'RC8 a
1624 mm sono 0,30″/px su un campo di 15,7′ × 10,6′. È un sensore da planetario e da
guida, cioè fuori perimetro dichiarato.

**La lezione vale più del caso:** la disponibilità del dato e la rilevanza sono
anticorrelate. I sensori ben documentati sono quelli industriali, perché li vendono
anche a chi pubblica misure EMVA; quelli astro-specifici — IMX571, IMX533, IMX294,
IMX455 — non hanno *nessuna* misura assoluta pubblicata, perché sono andati quasi
solo all'astronomia e alla sorveglianza di fascia alta. **Il catalogo per sensori è
proprio ciò che permette di sfruttare i primi per convalidare i modelli usati sui
secondi** — che è esattamente quello che la tabella T_G qui sopra ha appena fatto.

---

# 5 · Come procederei

Sei mosse, in quest'ordine. L'ordine non è negoziabile: le prime tre valgono più
delle altre tre messe insieme, e nessuna richiede dati che non ci siano già.

**1 · Rimettere in riga le due tabelle QE con la loro stessa fonte.** ZWO dichiara
91% e 80%: il rapporto deve essere 0,879, non 0,911. Nessun dato nuovo, un terzo
dello scarto chiuso, e l'unico numero che sposta i confronti mono-contro-matrice.

**2 · Pozzetto e modo di guadagno nel modulo camera, e `assumed` mostrato.** È il
×3 sulla posa in banda larga. Due righe di modulo e un campo già calcolato che
nessuno legge.

**3 · Regola a due livelli, e i sette `cfa_fraction` generici in documentazione.**
Declassare, non cancellare: `cfa_fraction_previous` è già il modello.

**4 · Schema `SENSORE → MODO DI LETTURA → CAMERA`,** con `carica_di_saturazione` a
livello sensore e il pozzetto della camera *derivato*. E `cam.cfa_response`
finalmente dereferenziato su `DB.cfa_responses[id]`, che oggi è un campo morto.

**5 · Le sei righe T_G come test di regressione.** La trasmissione del colorante
verde al picco vale 0,864 ± 0,015 su quattro generazioni di silicio: è l'ancora
indipendente che a `sony_bayer_generic` mancava. Un test che la verifica protegge il
modello di Bayer da qualunque modifica futura.

**6 · Le misure indipendenti come sorgente di prima classe,** con la loro prova di
ammissione: EMVA 1288 dei costruttori di visione industriale, e i lavori referati su
IMX455/IMX411. Sono l'unica QE assoluta che esista.

Quello che **non** farei: rincorrere la QE assoluta camera per camera. Non esiste,
i costruttori non la misurano, e l'errore che introduce si semplifica quasi del
tutto nei confronti fra configurazioni simili. L'errore che **non** si semplifica è
quello fra mono e matrice, e quello si chiude con la mossa 1 — che costa niente.

---

## Fonti

**Sony.** Undici *flyer* pubblici verificati (IMX178LQJ, IMX290/178/226, IMX183,
IMX294CJK, IMX571BQR-J, IMX571BLR-J, IMX533CQK-D, IMX533CLK, IMX455, IMX585-AAQJ1,
IMX492LQJ, IMX410CQK) su `sony-semicon.com`: **nessuno contiene una carta
spettrale.** Il modello templato dà una sola grandezza fotometrica, uno scalare di
sensibilità. La scheda completa — che *contiene* le tre curve R/G/B a normalizzazione
comune, come si vede sui due datasheet integrali circolanti (IMX078CQK, e
**IMX219PQH5-C**, che è proprio la base di `sony_bayer_generic`) — è dietro un
rapporto commerciale, e anche lì è **una figura, senza tabella numerica**.

**Costruttori di camere.** ZWO, QHY, Player One, Altair, ToupTek, Atik, Moravian,
RisingCam. Solo ToupTek e Moravian pubblicano e⁻/ADU numerico; solo QHY distingue
QE assoluta da relativa; nessuno dichiara fotone contro watt; RisingCam non ha
alcuna pubblicazione tecnica (è hardware ToupTek in OEM).

**Misure indipendenti.** Alarcon et al. 2023 (PASP 135, 055001 · arXiv 2302.03700),
Betoule et al. 2023 (A&A 670, A119 · arXiv 2211.04913), Gill et al. 2022
(arXiv 2207.13052) — IMX455 e IMX411, monocromatore e fotodiodo calibrato. FLIR
Blackfly S, pagine EMVA 1288 per modello. Basler, *EMVA Data Overview* BAS2412.
Lucid Vision Labs, dati EMVA per Triton10 e Atlas10. Christian Buil, ASI294MM.
