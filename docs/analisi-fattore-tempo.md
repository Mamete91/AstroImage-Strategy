# Revisione del modello fotometrico — specifica da approvare

*Nessuna modifica a `index.html`. Suite esistente: **325/325**, verde, invariata.
Verifica eseguibile: `node tools/verifica-modello.js` · banco: `node tools/bench-optics-run.js`*

---

## 0. Il f/9,3 — errore mio, non del motore

Il motore non ha mai contenuto un rapporto focale efficace. `derive()` calcola
`fRatio = F / apertura` e il commento accanto dice già:

> *«tradurre la trasmissione in un "f/ efficace" è un modo di nascondere una perdita
> facendola sembrare geometria»*

Il f/9,3 l'ho introdotto **io**, come colonna di stampa nel banco, per mostrare che
l'illuminamento per pixel non segue il rapporto focale geometrico nudo. Era il modo
sbagliato di dire una cosa giusta. Rimosso. La colonna ora è:

```
(f_A/f)² · (τ/τ_A)      geometria e trasmissione come fattori separati
```

e riproduce i dati **esattamente** (1,81× = 1,81× · 3,22× = 3,22×).

Test aggiunti e superati:

| test | esito |
|---|---|
| RC8 nativo → f/8,0 | `f/7,99` ✓ |
| RC8 + 0,80× → focale 1300 mm, f/6,4 | `f/6,40` ✓ |
| `fRatio` non contiene ostruzione né trasmissione | ✓ |
| `thru` e `Aeff` restano fattori separati | `thru 0,705` (ostr. 45%, τ 0,884) ✓ |
| Tecnosky, Askar: `f/ = F/D` | `f/6,96`, `f/6,90` ✓ |

---

## 1. Formula attuale — dove entra ogni termine

```
derive():   fRatio  = F / apertura                        [geometria]
            thru    = (1 − ostruzione²) · τ               [efficienza fotonica]
            Aeff    = π/4 · D² · thru                     [mm²]
            sigRate = Aeff · (pixel·bin / F)²             [∝ A · Ω_px]

timeFactor  = [sigRate_rif · QE_rif(λ)] / [sigRate · QE(λ)] / f_CFA
```

Sostituendo:

```
timeFactor = (A_rif/A) · (Ω_rif/Ω_px) · (QE_rif/QE) / f_CFA
              \_raccolta_/  \_CAMPIONAMENTO_/
```

## 2. Errore identificato

Il secondo fattore è un rapporto di **aree di pixel**, e entra nel tempo come se fossero
fotoni persi. RC8 nativo contro il riferimento:

| | |
|---|---|
| rapporto di raccolta `A_rif/A` | **0,436** ← fisico |
| rapporto di pixel `Ω_rif/Ω` | **6,439** ← spurio come fattore di tempo |
| prodotto = `timeFactor` attuale | **2,808** (motore: 2,808) |

**Il termine spurio vale ×6,44.** È il sovracampionamento dell'RC8, addebitato come
perdita fotometrica.

## 3. Formula proposta

**Metrica dichiarata: SNR per unità di angolo solido di cielo.** Nessun fattore di
struttura, nessun `C(w)`, nessun f/ efficace.

```
Ω_px  [arcsec²/px]      = (206,265 · pixel_µm · bin / F)²
A_eff [cm²]             = π/4 · D² · (1−ob²) · τ / 100
k     [−]               = QE(λ) · T_filtro · f_CFA · [OSC_BB se continuo su Bayer]

s_arc [e⁻/arcsec²/s]    = s_fot · A_eff · k              segnale
b_arc [e⁻/arcsec²/s]    = b_px / Ω_px                    cielo
d_arc [e⁻/arcsec²/s]    = d_px / Ω_px                    buio      ∝ F²
r_arc [e⁻²/arcsec²/s]   = RN² / (Ω_px · t_posa)          lettura   ∝ F²

V̇ = s_arc + b_arc + d_arc + r_arc          varianza per arcsec² al secondo

t(SNR, Ω₀) = SNR² · V̇ / (s_arc² · Ω₀)

timeFactor = [V̇ / (A·k)²] / [V̇_rif / (A_rif·k_rif)²]
```

Forma **esatta**, non nel limite debole: `s_arc` resta nella varianza. Finché lo strato
fotometrico non fornisce la brillanza dell'oggetto si pone `s_arc = 0` e lo si dichiara.

## 4. Significato fisico

| termine | cosa è | da cosa dipende |
|---|---|---|
| `A_eff·k` | fotoni raccolti da un arcsec² di cielo | apertura, ostruzione, τ, QE, filtro, CFA — **non** dalla focale |
| `b_arc` | fondo cielo per arcsec² | ∝ `A_eff·k`: si semplifica quasi del tutto nel rapporto |
| `d_arc` | buio | per pixel è fisso; **per arcsec² cresce con F²** ← qui entra f/ |
| `r_arc` | lettura | idem, **e dipende dalla posa** ← qui entrano f/ e t_posa |
| `s_arc` | segnale | l'oggetto; nel limite debole trascurabile nella varianza |

## 5. Perché la metrica non è arbitraria

È il punto che distingue questa formulazione da un `C(w)`:

```
t(SNR, Ω₀) = SNR² · V̇ / (s_arc² · Ω₀)      →   nel RAPPORTO, Ω₀ si semplifica
```

**Verificato numericamente**: con Ω₀ = 1, 100 e 3600 arcsec² il fattore vale
`0,739042` in tutti e tre i casi. Il parametro non esiste. In `C(w) = w²/(w²+FWHM²)`
il parametro `w` **non** si semplifica: scegliere 3″ o 60″ cambia il risultato. Per
questo `C(w)` esce dal fattore di tempo e resta, se mai servirà, come modulo separato e
dichiaratamente dipendente dalla scala della struttura.

## 6. Controllo dimensionale

RC8 nativo, OIII 3 nm, posa 600 s, SQM 21,3:

| | valore | unità |
|---|---|---|
| `Ω_px` | 0,2281 | arcsec²/px |
| `A_eff` | 228,6 | cm² |
| `k` | 0,8096 | — |
| `b_px` | 0,003855 | e⁻/px/s |
| `b_arc = b_px/Ω_px` | 0,016904 | e⁻/arcsec²/s |
| `d_arc = d_px/Ω_px` | 0,013154 | e⁻/arcsec²/s |
| `r_arc = RN²/(Ω_px·t)` | 0,016443 | e⁻²/arcsec²/s |
| **`V̇`** | **0,046501** | e⁻²/arcsec²/s |

Verifiche: `V̇` è la somma esatta dei quattro termini (nessun doppio conteggio) ✓ ·
il raggruppamento `P = 1 + (d_arc+r_arc)/b_arc` è solo notazione, `b_arc·P ≡ V̇` ✓

> **Nota sul buio.** Non è al denominatore. È un tasso di varianza per arcsec², sommato
> una volta sola accanto a cielo e lettura. Nella prima stesura lo avevo messo al
> denominatore di `P`: era sbagliato ed è corretto.

## 7. Test di consistenza — tutti superati

| test | esito |
|---|---|
| stesso setup → stesso risultato | ✓ |
| cambiare **solo** il campionamento (bin 1→4) → fotometria invariata | `0,739042` in tutti e quattro ✓ |
| cambiare **throughput** → cambia fotometria, `fRatio` invariato | 0,739 → 2,419 · `f/7,99` ✓ |
| cambiare **QE** → cambia fotometria, geometria invariata | 4,645 → 13,235 · `f/5,17`, 2,113″/px ✓ |
| il **seeing** non compare nella funzione fotometrica | ✓ (verificato sul sorgente) |
| la scala angolare di riferimento si semplifica | ✓ |
| nessun parametro contato due volte | ✓ |

> Il test sulla QE è **fallito alla prima esecuzione**, e aveva ragione: avevo modificato
> la QE della camera *di riferimento*, quindi la variazione entrava a numeratore e
> denominatore e si semplificava. Test ridisegnato sulla 2600MC.

## 8. Binning — trattamento definitivo

Su CMOS la somma è digitale dopo la lettura: `RN_binnato = RN·bin`, `Ω_px ∝ bin²`,
quindi `d_arc` e `r_arc` **non cambiano**.

| bin | scala | RN | `b_arc` | `d_arc` | `r_arc` | fattore |
|---|---|---|---|---|---|---|
| 1 | 0,478″ | 1,50 | 0,01690 | 0,01315 | 0,01644 | **0,7390** |
| 2 | 0,955″ | 3,00 | 0,01690 | 0,01315 | 0,01644 | **0,7390** |
| 4 | 1,910″ | 6,00 | 0,01690 | 0,01315 | 0,01644 | **0,7390** |

Il binning **non moltiplica la raccolta fotonica** e non entra nel fattore di tempo.
Non è però «solo spazio disco» — cambia tre cose reali:

1. **campionamento** → scala del pixel, verdetto di sovra/sotto-campionamento, e quindi
   la risoluzione che porti a casa;
2. **duty cycle** → meno dati da scaricare, più pose per ora di orologio (già modellato
   in `subExposure`);
3. spazio disco.

Su CCD sarebbe diverso: lì i pozzetti si sommano *prima* della lettura e il rumore di
lettura si paga una volta. **Il commento di `derive()` che dice «bin 2 divide il tempo
per 4» va corretto**, insieme alla stessa frase nella scheda NGC 6888.

## 9. Regression test — Abell 61

*Non usato per tarare. Nessun parametro è stato scelto per farlo tornare.*

RC8 nativo · 2600MM · OIII 3 nm · pose 600 s. Soglie `pn_faint` al riferimento: 8 / 15 / 25 h.

| | pavimento | utile | satura |
|---|---|---|---|
| attuale | 22,5 h | 42,1 h | 70,2 h |
| **proposto** | **5,9 h** | 11,1 h | 18,5 h |
| **reale** | | **8 h — riuscita** | |

- Il comportamento vecchio è rimosso: 15 h non sono più «insufficiente» ✓
- Le 8 h reali superano il pavimento ✓
- **Le 8 h cadono fra pavimento e utile → livello «ridotto», non «pieno».**

Lo scarto residuo (11,1 h contro 8) **non è configurazione**: è la soglia generica
`pn_faint`, che chiede 15 h di OIII a *qualunque* planetaria debole. È il lavoro dello
strato fotometrico per oggetto, non di questa correzione.

## 10. Regression test — NGC 6888 SII

RC8 nativo · 2600MM · SII 3 nm · ripreso 1,5 h → rumore con un accenno di arco.

| | pavimento SII | 1,5 h sarebbe |
|---|---|---|
| attuale | 14,0 h | 9,4× sotto soglia |
| **proposto** | **4,1 h** | 2,7× sotto soglia |

Il pavimento resta sopra le 1,5 h ✓ e l'ordine di grandezza è compatibile con
l'esperienza ✓.

## 11. Confronto RC8 / Tecnosky / Askar — grandezze separate

Banda OIII, posa 600 s, SQM 21,3.

| config | D mm | F mm | f/ | ″/px | τ | QE | filtro | CFA | A·k |
|---|---|---|---|---|---|---|---|---|---|
| RC8 nativo | 203,2 | 1624 | f/7,99 | 0,478 | 0,705 | 0,90 | 0,90 | 1,00 | 185,1 |
| RC8 0,80× | 203,2 | 1300 | f/6,40 | 0,597 | 0,705 | 0,90 | 0,90 | 1,00 | 185,1 |
| Tecnosky nativo | 115 | 800 | f/6,96 | 0,969 | 0,960 | 0,90 | 0,90 | 1,00 | 80,7 |
| **Tecnosky 0,80× (rif.)** | 115 | 640 | f/5,57 | 1,212 | 0,960 | 0,90 | 0,90 | 1,00 | 80,7 |
| Askar nativo | 71 | 490 | f/6,90 | 1,583 | 0,950 | 0,90 | 0,90 | 1,00 | 30,5 |
| Askar 0,75× | 71 | 367 | f/5,17 | 2,113 | 0,950 | 0,90 | 0,90 | 1,00 | 30,5 |
| Askar 0,75× + MC | 71 | 367 | f/5,17 | 2,113 | 0,950 | 0,82 | 0,90 | 0,71 | 19,7 |

| config | `b_arc` | `d_arc` | `r_arc` | `V̇` | **fotometrico** | campionamento |
|---|---|---|---|---|---|---|
| RC8 nativo | 0,01690 | 0,01315 | 0,01644 | 0,04650 | **×0,74** | sovracampionato |
| RC8 0,80× | 0,01690 | 0,00843 | 0,01054 | 0,03587 | **×0,57** | sovracampionato |
| Tecnosky nativo | 0,00737 | 0,00319 | 0,00399 | 0,01455 | ×1,22 | corretto |
| Tecnosky 0,80× | 0,00737 | 0,00204 | 0,00255 | 0,01197 | ×1,00 | sottocampionato |
| Askar nativo | 0,00278 | 0,00120 | 0,00150 | 0,00548 | ×3,22 | sottocampionato |
| Askar 0,75× | 0,00278 | 0,00067 | 0,00084 | 0,00429 | **×2,52** | sottocampionato |
| Askar 0,75× + MC | 0,00180 | 0,00067 | 0,00084 | 0,00331 | ×4,64 | sottocampionato |

### Il rapporto focale è nel modello, e si misura

**Stessa apertura, stessa camera, cambia solo il riduttore** — l'unico modo pulito di
isolare f/:

| | banda stretta | banda larga |
|---|---|---|
| RC8: f/8,0 → f/6,4 | ×0,74 → **×0,57** (−23%) | ×0,45 → ×0,44 (−2%) |
| Tecnosky: f/7,0 → f/5,6 | ×1,22 → **×1,00** (−18%) | ×1,01 → ×1,00 (−1%) |
| Askar: f/6,9 → f/5,2 | ×3,22 → **×2,52** (−22%) | ×2,68 → ×2,65 (−1%) |

Un riduttore 0,8× vale **circa il 20% del tempo in banda stretta e quasi nulla in banda
larga**, a parità di tutto il resto. È esattamente il comportamento fisico atteso: dove
il cielo è luminoso il rumore strumentale è irrilevante e conta solo la raccolta; dove il
cielo è quasi assente il rapporto focale morde.

### RC8 nativo contro Askar nativo, stessa camera, OIII

```
diametri nudi (203,2/71)²                     8,19×
raccolta reale A·k (ostruzione 45% + τ)       6,08×   a favore RC8
rapporto delle varianze V̇                     8,49×   a sfavore RC8
──────────────────────────────────────────────────────
FOTOMETRICO netto                             4,35×
in banda larga (V̇ dominata dal cielo)         5,95×
campionamento: 0,478″ contro 1,583″/px        ASSE SEPARATO
```

**Nessuna delle due semplificazioni assolute regge.** Non «l'apertura decide»: fra 8,19×
e 4,35× ci sono ostruzione, trasmissione e rapporto focale. Non «f/ decide»: l'Askar è
più veloce per pixel e più lento per profondità.

### Riscontro in letteratura

Stan Moore, *CCD "f-ratio" Myth*: *«F-ratio can affect the S/N from a real camera by
varying the number of pixels used to capture the object»*, e questo conta *«in very short
exposures or narrow-band images of dim objects»*. È **esattamente** il termine `r_arc`,
ed è esattamente il regime dell'RC8 a 3 nm. La divulgazione più diffusa
(Cloud Break Optics, *Pixel by Pixel*) descrive solo l'illuminamento per pixel e chiude
con «il f/ più basso che puoi permetterti»: corretto per il punto 1, muto sugli altri tre.

## 12. Un problema aperto trovato dai test — NON risolto qui

Rendendo coerente il trattamento fra segnale e cielo è emerso che, per la **banda larga
su sensore a matrice**, `OSC_BB = 0,34` e `f_CFA` si **sovrappongono**:

- `OSC_BB` corregge la **banda**: un fotosito colorato vede circa un terzo dello spettro.
- `f_CFA` corregge il **numero di fotositi** che raccolgono quella riga.

Per L la scheda dichiara `f_CFA = 1,00` e i due non si pestano. Per **RGB** dichiara
`0,62`, e moltiplicati danno 0,21 — troppo severo: un OSC porta a casa R, G e B in una
posa sola, e il conto corretto lo rende all'incirca pari al mono, non cinque volte
peggio.

**Conseguenza:** i fattori L e RGB della 2600MC in questa tabella non sono affidabili.
La banda stretta non è toccata (`OSC_BB` non si applica), quindi **Abell 61 e NGC 6888
non ne risentono**. È un lavoro separato con la sua verifica, e non lo infilo qui.

## 13. Architettura risultante

```
STRATO ASTROFISICO    cosa emette il target, quanto è debole   [invariato]
        ↓
STRATO STRUMENTALE    ├── FATTORE FOTOMETRICO  ← questa revisione
                      │     quanto tempo per la stessa profondità per arcsec²
                      └── VERDETTO DI CAMPIONAMENTO  [invariato]
                            risoluzione, binning consigliato, qualità attesa
        ↓
STRATO OPERATIVO      quando riprenderlo, come distribuire le ore  [invariato]
```

I due rami dello strato strumentale **non si fondono**. Il fattore fotometrico non
contiene seeing, non contiene `C(w)`, non contiene un f/ efficace. Il verdetto di
campionamento non produce ore.

## 14. Modifica minima proposta

| file | modifica |
|---|---|
| `index.html` `timeFactor()` | sostituita con la forma di §3; firma `(dv, band, tsub)` |
| `index.html` | nuova `photometry(dv,band,tsub,sqm)` — i quattro termini, in un posto solo |
| `index.html` `refCfg()` | esporre `Aeff` e il `derive` di riferimento |
| `index.html` `derive()` commento | correggere «bin 2 divide il tempo per 4» |
| `index.html` glossario `bin` | idem |
| `data/targets.json` | **nulla** |
| `data/catalog.json` | **nulla** |
| `data/setups.json` | **nulla** |
| scheda NGC 6888 (project doc) | correggere «bin 2×2 → ×4 in tempo equivalente» |

**Non toccati:** archetipi, classificazione, ratio Hα/OIII/SII, ore per canale, modello
Luna, LP, visibilità, ranking, rotatore, export N.I.N.A., distribuzione delle notti,
`sigRate` (resta dov'è: è corretto per saturazione e posa, che sono grandezze per pixel).

## 15. Stato

- `index.html` **non modificato**
- suite esistente: **325/325 verde**
- verifica del nuovo modello: **tutti i test superati** (`node tools/verifica-modello.js`)
- **nessun commit**

**In attesa di approvazione.**
