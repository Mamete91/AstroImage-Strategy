# Gate v1.6 — RGB monocromatico sequenziale · CFA banda stretta misurata

*I due punti rimasti aperti dopo la v1.5. Suite **389/389**, gate **94/94**, zero
regressioni. Eseguibile: `node tools/gate-v16.js` (carica il motore prima e dopo
fianco a fianco).*

---

## Il difetto era un altro, ed era più semplice

Nella v1.5 avevo scritto che il motore modellava la banda RGB del mono come una
finestra larga da 250 nm a piena efficienza, con una sovrastima di **×2,8**.

**Era una lettura sbagliata del codice.** `filterFor('RGB', mono)` restituiva già il
filtro **verde** come procura — 90 nm, non 250. Il ×2,8 esiste, ma nasce altrove:

```
k (segnale) = qeAt × T × η            ← NON conteneva la larghezza di banda
cielo       = qeAt × T × larghezza    ← la conteneva
```

Il fondo cielo è un continuo e scala sempre con la larghezza. Il **segnale** scala
con la larghezza **solo se anch'esso è un continuo**: su una riga no — un filtro da
3 nm e uno da 7 nm raccolgono lo stesso Hα, e cambia solo quanto cielo ci entra
dentro. È esattamente il motivo per cui la banda stretta funziona, ed è il motivo
per cui questa asimmetria non l'aveva mai fatta emergere.

Ma per un **continuo** l'asimmetria non si semplifica quando due configurazioni
usano larghezze diverse: mono RGB a ~93 nm contro matrice a 250 nm → **2,78×** che
finiva tutto sul cielo e niente sul segnale.

**Non è un fattore correttivo: è un termine che mancava.** La larghezza entra ora da
`bandThroughput()`, la stessa funzione e la stessa convenzione del fondo, così le due
non possono più divergere.

| banda | tipo | segnale | cielo | cielo/segnale |
|---|---|---|---|---|
| Hα, OIII, SII | riga | 0,6 · 0,8 · 0,2 | 16,7 · 24,3 · 5,3 | **30 Å = Δλ** |
| L | continuo | 2001 | 2001 | **1 (identici)** |
| RGB | continuo | 699 | 699 | **1 (identici)** |

## 1 · La banda RGB come insieme sequenziale

Le ore RGB si dividono fra R, G e B secondo il rapporto **1:1:1** dichiarato da
Optolong, e in ogni istante la camera raccoglie attraverso **un** filtro. Il tasso
medio sul totale della banda è la media pesata dei tre.

| canale | intervallo Optolong | λ | larghezza | quota | QE | QE·T·Δλ |
|---|---|---|---|---|---|---|
| R | 590–700 nm | 645 | 110 nm | 1/3 | 0,645 | 674 |
| G | 500–580 nm | 540 | 80 nm | 1/3 | 0,876 | 666 |
| B | 420–510 nm | 465 | 90 nm | 1/3 | 0,886 | 758 |

**Media pesata = 699** contro la vecchia procura (solo il verde, 90 nm) = **752**:
−7%. Gli intervalli sono letti dalla curva pubblicata da Optolong e dichiarati come
tali nel dato — **non sono FWHM certificate**, e il campo `range_source` lo scrive.

**L non è un quarto canale RGB**: resta una banda a sé, con la sua riga di budget e
la sua larghezza. E su una camera a **matrice** la banda RGB non è composita: lì la
posa è una sola e larga, e a separare i colori è il mosaico.

## 2 · Prima / dopo sui quattro setup monocromatici

| setup | L | RGB | Hα |
|---|---|---|---|
| RC8 nativo | ×0,450 → ×0,450 | ×0,471 → ×0,474 **+0,5%** | invariato |
| RC8 0,80× | ×0,442 → ×0,442 | ×0,452 → ×0,453 **+0,2%** | invariato |
| Tecnosky 0,80× (rif.) | ×1,000 | ×1,000 | ×1,000 |
| Askar 71F 0,80× | ×2,676 → ×2,676 | ×2,716 → ×2,721 **+0,2%** | invariato |

**Sul mono contro mono non cambia quasi nulla, ed è il risultato corretto:** i
quattro setup usano la stessa camera e gli stessi filtri, quindi la catena spettrale
si semplifica esattamente nel rapporto contro il riferimento. Resta solo il residuo
dei termini strumentali, che si spostano perché è cambiato il fondo cielo.

In ore, su M31 a 14,5 h: **RGB si sposta di 0,00–0,03 h**, e la strada scelta non
cambia su nessuno dei quattro.

## 3 · Dove la correzione atterra davvero

| configurazione | banda | prima | dopo | |
|---|---|---|---|---|
| Askar 0,80× + 2600MC | RGB | ×17,15 | **×2,06** | −88% |
| | L | ×6,09 | ×6,09 | invariata |
| Tecnosky 0,80× + 2600MC | RGB | ×6,34 | **×0,76** | −88% |
| | L | ×2,25 | ×2,25 | invariata |

L resta invariata perché mono e matrice usavano già la stessa larghezza (250 vs 250).

### Il compromesso vero, che ora esce dal modello

Stessa ottica, stessa apertura, cambia solo la camera:

| banda | mono | matrice | rapporto | fattore |
|---|---|---|---|---|
| **RGB** | 699 (93 nm) | 1854 × 0,49 = **908** (250 nm) | **1,30** | ×0,76 |
| **L** | 2001 (250 nm) | 1840 × 0,49 = **907** (250 nm) | 0,45 | ×2,25 |

**In RGB la matrice vince**: raccoglie su 250 nm continui mentre il mono ne prende
~93 per volta, e anche pagando il mosaico resta avanti di 1,3×. **In luminanza
perde di 2×**: stessa larghezza per entrambi, quindi resta solo il mosaico — e una
matrice una luminanza non può farla, divide la banda in tre.

È il compromesso che ogni astrofotografo conosce, e ora **esce dal modello invece
che da una costante**.

## 4 · CFA banda stretta — i tre sintomi

| banda | prima | dopo | modello indipendente | sintomo |
|---|---|---|---|---|
| Hα | 0,290 | **0,357** | 0,374 | sottostimata (−22%) → corretta |
| OIII | 0,710 | **0,641** | 0,640 | sopravvalutata (+11%) → corretta |
| SII | 0,280 | **0,393** | 0,414 | sottostimata (−32%) → corretta |

I valori vengono dalla carta QE per canale della ASI2600MC con la definizione
`η = (R + 2G + B)/4 / max(R,G,B)`, e concordano entro il 6% con il modello
spettrale indipendente costruito su IMX219.

Effetto sul fattore di tempo (Askar 0,75× + 2600MC):

| | prima | dopo | |
|---|---|---|---|
| Hα | ×22,73 | **×15,84** | −30% |
| OIII | ×4,64 | **×5,40** | +16% |
| SII | ×25,11 | **×13,89** | −45% |

**Le altre camere a matrice non sono state toccate.** Per i loro sensori non esiste
alcun dato per canale, e trasferirvi una misura fatta su un altro sensore sarebbe
prestarle un titolo che non ha.

## 5 · Interaction test — nessun doppio conteggio

I tre meccanismi restano separati e si applicano **una volta ciascuno**:

| | dove | verificato |
|---|---|---|
| `cfa_fraction` dichiarato | banda stretta su matrice | `η = dato`, e `k = throughput × η` |
| modello spettrale | banda larga su matrice | `η = modello`, `k` e cielo con la **stessa** η |
| larghezza di banda | continuo, su ogni camera | `signal == sky` per i continui, `sky/signal = Δλ` per le righe |

E in più: `OSC_BB` non è più applicato né al segnale né al cielo del mosaico;
su camera mono non c'è correzione di matrice su nessuna banda (`η = 1` esatto).

## 6 · Stato

| | |
|---|---|
| suite (`test.js`) | **389 / 389** |
| gate v1.6 (`tools/gate-v16.js`) | **43 / 43** |
| gate fisico v1.4 + verifica modello | **51 / 51**, nessuna regressione |
| CLI, export N.I.N.A., standalone | integri |

Non è stato modificato nessun altro parametro per compensare gli effetti dei due
interventi.
