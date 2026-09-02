# Il ramo OSC in banda larga — da zona cieca a stima con confidenza

*Studio dedicato. Chiude il punto §F del gate fisico, dove il ramo era dichiarato
NON VALIDATO. Eseguibile: `node tools/studio-osc.js`. Suite: **386/386**.*

---

## Il punto di partenza

Il gate aveva isolato un doppio conteggio e si era fermato lì, correttamente:

| termine | cosa corregge | dove ha senso |
|---|---|---|
| `f_CFA` | il **numero** di fotositi che raccolgono quella **riga** | banda stretta |
| `OSC_BB` | la **banda**: un fotosito colorato vede circa un terzo dello spettro | banda larga |

Per L la scheda dichiarava `f_CFA = 1,00` e il conto tornava. Per RGB dichiarava
`0,62`, e `0,62 × 0,34 = 0,21` contava due volte la stessa perdita. Il motore non
sceglieva un numero: marcava il ramo e si fermava.

**La chiave era già lì, non vista:** non sono due grandezze. Sono la *stessa*,
valutata a una riga oppure integrata su una banda. Per questo moltiplicarle è
sempre un errore, e per questo una sola funzione le sostituisce entrambe.

---

## 1 · I dati — cosa esiste davvero

**Risultato decisivo, e negativo:** curve QE **per canale** per IMX571, IMX455,
IMX533, IMX294 e IMX183 a colori **non esistono nel dominio pubblico**.

| fonte | esito |
|---|---|
| Sony — flyer pubblici di tutti e cinque i sensori | recuperati: **nessuna figura spettrale**. I datasheet completi sono sotto NDA |
| ZWO / QHY / Player One | carte QE nelle pagine prodotto, **nessun dato tracciabile**; ZWO e QHY pubblicano curve *reciprocamente incompatibili* per lo stesso silicio |
| letteratura (Betoule+2023, Gill+2022, Alarcon+2023) | misure NIST-tracciabili di qualità — **tutte del sensore MONO** |
| trasmissione dei coloranti Bayer per questi sensori | **nessuna misura pubblicata** |

Restano due basi che conservano il rapporto **fra** i canali — cosa rara, perché
quasi tutti i database (camspec compreso) normalizzano ogni canale a 1 e
distruggono proprio l'informazione che serve:

- **A** — Sony IMX219 digitalizzata a normalizzazione comune, 400–700 nm passo 1 nm
- **B** — letture di terzi della carta ZWO ASI2600MC a 656,3 / 500,7 / 672,4 nm

**Costruisco su A, verifico su B.** Se non avessero concordato, il modello non si
sarebbe fatto.

---

## 2 · Il modello

Una definizione sola, valida in entrambi i regimi:

```
η(banda) = ⟨ mosaico(λ) ⟩ / ⟨ migliore(λ) ⟩     pesato su QE(λ)·T_filtro(λ)

mosaico  = (T_R + 2·T_G + T_B)/4        RGGB: 1 rosso, 2 verdi, 1 blu
migliore = max(T_R, T_G, T_B)           ciò che mostra la curva QE pubblicata
```

Su una **riga** si riduce esattamente alla definizione di `cfa_fraction`. Su una
**banda larga** dà l'integrale. Nessun dato esterno: poiché la curva pubblicata di
una OSC *è* `QE_mono × colorante_migliore`, si ha `QE_mono = QE_pub / migliore`, e
la formula si chiude usando solo la curva della camera stessa.

## 3 · La verifica indipendente

Il modello viene da IMX219; i dati di controllo da IMX571. Normalizzazioni diverse,
quindi si confrontano i rapporti al canale dominante.

| λ nm | R:G:B modello | R:G:B ZWO |
|---|---|---|
| 656,3 (Hα) | 1,000 : 0,195 : 0,106 | 1,000 : 0,183 : 0,061 |
| 500,7 (OIII) | 0,068 : 1,000 : 0,493 | 0,032 : 1,000 : 0,532 |
| 672,4 (SII) | 1,000 : 0,256 : 0,144 | 1,000 : 0,240 : 0,093 |

**Il verde concorda entro il 7% su tutte e tre le righe** — ed è il verde a pesare
doppio nel mosaico. Il blu è sistematicamente 1,5–1,7× più alto nell'IMX219: atteso,
è un sensore nudo da telefono contro una camera astronomica.

Contro le **due curve ZWO** (mono e colore della stessa camera), `migliore(λ)`
dovrebbe riprodurre il loro rapporto:

| λ | 400 | 450 | **500** | **550** | **600** | 650 | 656 | 672 | 700 |
|---|---|---|---|---|---|---|---|---|---|
| scarto | +16% | +10% | **−1%** | **+1%** | **−7%** | +20% | +26% | +44% | +91% |

**Accordo ottimo fra 500 e 600 nm, degrada nel rosso.** Il colorante rosso
dell'IMX219 cade più in fretta di quello dell'IMX571, oppure la carta ZWO è
ottimista. È il limite onesto del trapianto, ed è proprio dove vivono Hα e SII.

## 4 · Il risultato che rovescia l'aspettativa

Sensibilità al parametro debole — la coda rossa di verde e blu, che fra sensori
reali varia di quasi due ordini di grandezza e per questi sensori non è misurata:

| fuga nel rosso | η Hα | η OIII | η SII | η banda larga |
|---|---|---|---|---|
| ×0,5 | 0,312 | 0,640 | 0,332 | 0,469 |
| **nominale** | **0,374** | **0,640** | **0,414** | **0,484** |
| ×2 | 0,498 | 0,640 | 0,578 | 0,513 |

```
banda stretta nel ROSSO (Hα, SII)   ±35–40%   ← fragile
banda stretta nel VERDE (OIII)      ±2%       ← solido
banda LARGA (L, RGB)                ±6%       ← solido
```

E la dipendenza dallo **spettro della sorgente** — che era il timore principale —
risulta **trascurabile: ±3%** fra sorgente piatta, solare, blu e rossa.

> **Il ramo dichiarato «validato» poggia sul parametro fragile; quello dichiarato
> «non validato» no.** In banda larga la fuga fra canali è una perturbazione piccola
> su un segnale grande. Sull'Hα è *tutto* il contributo di verde e blu.

Ed è così che si spiega il vecchio `0,34`: è il valore a crosstalk **zero** —
`(¼ rosso + ½ verde + ¼ blu)/3 = 0,333`. La fuga misurata lo alza del 40%.

## 5 · L'architettura

```
oscEfficiency(camera, banda, spec) → { eta, src, model, declared, conf }
```

**Regola di precedenza: chi ha il DATO vince sul modello** — la stessa regola con
cui il catalogo curato vince su OpenNGC.

| regime | chi decide | perché |
|---|---|---|
| banda stretta | **dato dichiarato** in `cfa_fraction` | misurato sulle curve del sensore; nel rosso il modello porta ±35% |
| banda larga | **modello spettrale** | il dato dichiarato conteneva il doppio conteggio |
| dati di matrice assenti | **ripiego su `OSC_BB`**, dichiarato non validato | nessun numero inventato |
| camera mono | `η = 1`, esatta | non c'è matrice |

Il modello si calcola **sempre**, anche quando non decide: resta nella diagnostica
accanto al dato, così la discrepanza è visibile invece che nascosta.

**E una sola correzione, mai due.** `skyRateFor()` ha ora due normalizzazioni
esplicite: *per fotosito* (default — serve a saturazione e posa, che sono grandezze
del singolo pixel, e lì `OSC_BB` è al posto giusto) e *mosaico* (per la fotometria
per arcsec², dove la correzione la applica `oscEfficiency` a valle). Segnale e cielo
passano per la stessa η: misurarli con efficienze diverse era il difetto d'origine.

## 6 · Cosa cambia

| configurazione | banda | prima | adesso | |
|---|---|---|---|---|
| Askar 0,75× + 2600MC | L | ×8,59 | **×5,94** | −31% |
| | RGB | ×39,87 | **×16,73** | −58% |
| | Hα | ×22,73 | ×22,73 | **invariato** |
| | OIII | ×4,64 | ×4,64 | **invariato** |
| Tecnosky 0,8× + 2600MC | L | ×3,26 | ×2,25 | −31% |

**La banda stretta non si muove di un decimale**: il modello fotometrico validato
in v1.4 è intatto. Il motore concorda con lo studio indipendente entro il **2%**.

## 7 · Cosa NON è stato fatto, e perché

Costruendo il modello è emerso un **secondo** difetto, indipendente, sul lato
**mono**: il motore modella la banda RGB come una singola finestra larga
(250 nm a piena efficienza), mentre un mono la riprende con tre filtri da 90 nm
**in sequenza**, un terzo del tempo ciascuno. La sovrastima è di circa **×2,8**, e
non si semplifica nel confronto con la OSC — che una posa larga la fa davvero.

Conseguenza: il rapporto RGB fra OSC e mono resta affetto da quel difetto, e resta
dichiarato come tale. **Non l'ho corretto in questo lavoro**: tocca il ramo mono,
che è validato, e merita il suo gate come l'ha avuto il fattore di tempo. Ma non è
più una zona cieca — è una quantità identificata e quantificata.

Non ho nemmeno toccato `cfa_fraction` in banda stretta, benché il modello e le
letture ZWO **concordino fra loro e non col motore**:

| banda | motore | modello | da ZWO |
|---|---|---|---|
| Hα | 0,290 | 0,374 | 0,357 |
| OIII | 0,710 | 0,640 | 0,641 |
| SII | 0,280 | 0,414 | 0,393 |

Due fonti indipendenti entro il 6% l'una dall'altra, e il motore fuori di −22% /
+11% / −32%. È un caso serio, ma è il ramo validato: va cambiato con il suo gate e
i suoi regression test, non di straforo dentro un altro lavoro.

## 8 · Le verifiche

| | |
|---|---|
| il modello è caricato dai dati, non cablato | ✓ |
| il verde concorda con la carta ZWO entro il 15% | ✓ (7%) |
| η a OIII concorda con ZWO entro il 5% | ✓ (0,640 contro 0,641) |
| `mosaico = (R+2G+B)/4 / migliore`, per definizione | ✓ |
| banda stretta: vince il dato dichiarato, per tutte e tre le righe | ✓ |
| e il modello resta disponibile per il confronto | ✓ |
| banda larga: vince il modello, e non è più `dichiarato × OSC_BB` | ✓ |
| il dominio di validità è dichiarato per regione | ✓ |
| camera mono: η = 1 esatto | ✓ |
| senza dati di matrice → ripiego su `OSC_BB`, dichiarato | ✓ |
| `R_b` = base mosaico × η, **una volta sola** | ✓ |
| `k` usa la **stessa** η del cielo | ✓ |
| per pixel resta la normalizzazione del fotosito (saturazione, posa) | ✓ |
| in banda stretta le due normalizzazioni coincidono | ✓ |

**Suite completa: 386/386.** Gate fisico v1.4: 51/51, banda stretta identica
bit per bit.
