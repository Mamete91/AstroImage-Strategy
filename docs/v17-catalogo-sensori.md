# v1.7 — il catalogo diventa di sensori

*Implementazione di quanto proposto in `architettura-catalogo-sensori.md`. Suite
**460/460**, gate v1.7 **28/28**, tutti i gate precedenti verdi, zero regressioni.
Eseguibile: `node tools/gate-v17.js`.*

---

## L'idea in una riga

**Il nome commerciale di una camera non è la variabile fotometrica: lo è il
silicio.** Lo stesso IMX571 sta sotto ZWO, QHY, Player One, ToupTek, Altair e
RisingCam; un catalogo per marca lo descrive sei volte e sbaglia sei volte
insieme. Il catalogo ora descrive **sensori**, e le camere ci si agganciano da
sole.

```
SENSORE  →  MODO DI LETTURA  →  CAMERA
```

Il livello intermedio non è decorativo: **il pixel non è una proprietà del
silicio ma della lettura.** L'IMX294 e l'IMX492 sono lo stesso sensore — binnato
2×2 a 4,63 µm oppure nativo a 2,315 µm — e uno schema senza i modi si rompe su
quella coppia il primo giorno.

## L'utente non sceglie niente

Nel modulo camera si inseriscono sei numeri: nome, mono o colore, pixel,
larghezza, altezza, rumore di lettura, QE di picco. **Non c'è nessun modello da
selezionare.** Il motore riconosce la coppia sensore + modo dalla **geometria**,
che è fisica e non dipende dal marchio, e usa la **nomenclatura** come conferma:
se le due concordano la confidenza sale, se litigano vince la geometria e il
disaccordo si dichiara.

Sei camere di quattro costruttori, nessuna in catalogo, riconosciute dalla sola
geometria:

| inserito a mano | riconosciuto | pozzetto |
|---|---|---|
| Player One Poseidon-C Pro | Sony IMX571 · nativo | 48 200 e⁻ |
| Altair Hypercam 26C | Sony IMX571 · nativo | 48 200 e⁻ |
| RisingCam ATR3CMOS26000 | Sony IMX571 · nativo | 48 200 e⁻ |
| ToupTek ATR294C | Sony IMX294 / IMX492 · **bin 2** | 63 700 e⁻ |
| QHY294M Pro non binnata | Sony IMX294 / IMX492 · **nativo** | 63 700 e⁻ |
| QHY 600C | Sony IMX455 · QHY | ignoto, dichiarato |

La tolleranza sul passo del pixel è il 2%, su larghezza e altezza l'1,5% — QHY
legge qualche riga in più di ZWO sullo stesso silicio (600M +0,25%, 268M +0,5%).
Più larghi di così si pesca per caso: **al 5% una reflex full frame generica da
5,9 µm cadeva sull'IMX410.** Una geometria che non è di nessun sensore noto resta
IGNOTA e lo dice.

## La regola dei dati: due livelli e uno stato

```
MISURA     metodo, riferimento e GRANDEZZA dichiarati senza ambiguità
MODELLO    calcolato adesso, riproducibile, coperto da test
──────────────────────────────────────────────────────────────────
IGNOTO     né l'una né l'altro: segnaposto DICHIARATO, mai silenzioso
```

**`ereditato` non è un terzo gradino.** I vecchi `cfa_fraction` generici erano
l'uscita di un modello di ieri, congelata in un campo dati: non possono battere
per regola il modello attuale, che si rilancia, si testa e migliora da solo
quando migliora la curva sottostante. Sono usciti dal percorso operativo e
vivono nei campi `*_ereditato`, con la nota che spiega perché.

L'effetto, misurato:

| camera | banda | prima | dopo | ramo | ereditato |
|---|---|---|---|---|---|
| 2600MC | Hα | 0,357 | **0,357** | misura del sensore | 0,290 |
| 2600MC | OIII | 0,641 | **0,641** | misura del sensore | 0,710 |
| 294MC | Hα | 0,290 | **0,374** | modello spettrale | 0,290 |
| 294MC | SII | 0,280 | **0,414** | modello spettrale | 0,280 |
| 533MC | Hα | 0,290 | **0,374** | modello spettrale | 0,290 |

Il modello dà 0,374 sull'Hα contro lo **0,357 misurato sul sensore gemello**:
−5%. Il valore ereditato dava 0,290: −19%. **La strada «curata» era la peggiore**,
ed è il difetto che il reperto I dello studio aveva individuato.

La stessa regola vale a ogni livello, ancora compresa: la misura **su questo
sensore** batte la media sui sei.

## Il pozzetto si deriva

```
pozzetto = min( carica di saturazione del SENSORE , fondo scala ADC × e⁻/ADU )
```

Il minimo taglia da entrambi i lati.

**Completa chi non dichiara.** Una camera nuova senza `gain_modes` riceveva
20 000 e⁻ in silenzio:

| | pozzetto | posa RGB | posa L |
|---|---|---|---|
| prima | 20 000 | **60 s** | **60 s** |
| dopo | 63 700 | **150 s** | **150 s** |

Due volte e mezzo le pose, gli eventi di lettura e lo scarico, senza che nulla lo
dicesse. La banda stretta non si muove: lì limita il rumore di lettura, non la
saturazione — **600 s in entrambi i casi**.

**E corregge chi dichiara troppo.** La 2600MC dichiara 50 000 e⁻ in LCG; il pixel
ne tiene **48 200 misurati** (EMVA 1288, Lucid Triton10). Il taglio scatta su dati
veri. ToupTek arriva a dichiarare 102,5 ke⁻ per lo stesso silicio: è il fondo
scala dell'ADC (`e⁻/ADU × 65536`, verificabile riga per riga sulle sue tabelle),
non la carica di saturazione.

Dove non c'è né l'una né l'altra il segnaposto resta, **ma si dichiara**: la
pastiglia «pozzetto assunto» compare accanto alla posa, con quanto vale e di
quanto potrebbe sbagliare.

## L'unico numero fotometrico cambiato

La curva QE di una camera **a matrice** non è più una tabella indipendente da
digitalizzare: si deriva dalla curva a colori del sensore, **tenendone la forma e
correggendone il livello** sulla trasmissione del colorante misurata.

Il difetto era solo il livello. Le due curve ZWO davano un rapporto colore/mono
di **0,916** a 527,5 nm; la misura EMVA sullo stesso sensore dà **0,846**.

| λ | mono | matrice prima | matrice dopo | rapp. prima | rapp. dopo |
|---|---|---|---|---|---|
| 450 | 0,880 | 0,800 | 0,739 | 0,909 | 0,840 |
| 527,5 | 0,883 | 0,809 | 0,748 | 0,916 | **0,846** |
| 656,3 | 0,619 | 0,539 | 0,498 | 0,871 | 0,805 |
| 700 | 0,500 | 0,420 | 0,388 | 0,840 | 0,776 |

**La mono non si è mossa di un bit.** Dove la curva a colori non esiste non se ne
inventa una: si applica la trasmissione misurata, piatta — livello noto, forma
non inventata.

Non si usa qui l'inviluppo del modello di Bayer generico. Quella curva viene
dall'IMX219, il cui colorante rosso cade più in fretta di quello di una camera
astronomica (+26% a 656 nm, +44% a 672 — sta scritto nel suo stesso campo di
validazione). Nel **rapporto** mosaico/migliore che serve a η quell'errore si
semplifica in buona parte; nell'inviluppo da solo no, e propagarlo sulla QE
peggiorerebbe una cosa che funziona.

### L'ancora

Le misure EMVA 1288 danno mono e colore della **stessa** camera sulla stessa
scala assoluta, quindi il loro rapporto **è** la trasmissione del colorante:

| IMX178 | IMX183 | IMX226 | IMX571 | IMX585 | IMX492 |
|---|---|---|---|---|---|
| 0,867 | 0,873 | 0,847 | 0,846 | 0,862 | 0,890 |

**0,864 ± 0,015 — l'1,8%, su quattro generazioni di silicio e tre laboratori.**
È in scheda come `dye_anchors`, con la fonte di ogni punto, ed è coperta da un
test di regressione.

## Dove il motore si muove, e dove no

| configurazione | Hα | OIII | SII | RGB | L |
|---|---|---|---|---|---|
| RC8 + 2600MM | = | = | = | = | = |
| RC8 0,80× + 2600MM | = | = | = | = | = |
| Tecnosky 0,80× + 2600MM (rif.) | = | = | = | = | = |
| Askar 0,80× + 2600MM | = | = | = | = | = |
| RC8 + 2600MC | +16,1% | +14,9% | +16,1% | +9,1% | +9,1% |
| Askar 0,80× + 2600MC | +15,5% | +13,8% | +15,5% | +8,7% | +8,7% |
| Askar 0,80× + 294MC | **−43,4%** | +6,0% | **−55,8%** | −6,6% | −6,6% |

**Mono contro mono: scarto massimo 0,000000%.** Non «piccolo»: zero. La catena
mono non è stata toccata, e il riferimento resta a fattore 1 esatto.

Il movimento è tutto dove doveva essere: sulle camere a matrice, per il livello
del colorante ora misurato, e sulla 294MC dove il modello ha sostituito un valore
ereditato che sottostimava l'Hα del 22% e il SII del 32%.

**Su 18 combinazioni di oggetto e configurazione, nessuna strada cambia.** La
prescrizione è robusta: si muovono le ore, non la tecnica.

## Che cosa si vede

La barra di configurazione mostra il silicio sotto il nome commerciale —
*ToupTek ATR294C · 4.63 µm · **Sony IMX294 / IMX492 · bin 2*** — con il tooltip
che dice come è stato riconosciuto e da dove vengono QE, pozzetto e risposta
della matrice. Il modulo camera lo mostra **mentre si scrive**, prima di salvare.
E dove il motore assume, lo scrive.

## Stato

| | |
|---|---|
| suite (`test.js`) | **460 / 460** |
| gate v1.7 (`tools/gate-v17.js`) | **28 / 28** |
| gate v1.6, fisico, verifica modello, studio OSC | tutti verdi |
| CLI, export N.I.N.A., standalone, prova in browser | integri, zero errori JS |
| tutti gli strumenti in `tools/` | **11 su 11**, da qualunque cartella |

Trovato e corretto strada facendo: `bench-optics.js` e `bench-optics-run.js` —
il banco RC8 contro Askar del gate v1.4 — facevano `require('/tmp/a61.js')` e
`require('/tmp/bench3.js')`. **Non avevano mai funzionato per nessuno tranne chi
li aveva scritti.** Stessa forma del difetto già corretto in `gate-v16.js` (la base
di confronto in `/tmp/old`): uno strumento che gira su una macchina sola non è uno
strumento. Il caricatore del motore vive ora in `tools/lib/engine.js`, dove ogni
strumento può prenderlo.

Restano fuori, e dichiarati: la QE assoluta resta sulla scala dei costruttori
(alta del 12–38% contro le misure indipendenti, ma **uniformemente** — una scala
uniforme si semplifica nei rapporti, una mista no); l'IMX455, l'IMX533 e
l'IMX294 non hanno una carica di saturazione misurata; per nessun sensore
astronomico esiste una curva per canale pubblicata.
