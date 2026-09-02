# Gate fisico — modello fotometrico narrowband

*`index.html` **non modificato**. Suite esistente **325/325**. Nuove verifiche **51/51**.
Nessun commit. Eseguibili: `tools/verifica-modello.js` · `gate-A.js` · `gate-BC.js` · `gate-DEF.js`*

---

## Fonti istituzionali usate per validare

| fonte | cosa fornisce |
|---|---|
| **ESO — Hainaut, *Signal, Noise and Detection*** | `S/N = s·t / √(s·t + n_pix·sky·t + n_pix·dark·t + n_pix·NDIT·RON²)` e `N_ron = √(n_pix·NDIT)·RON` |
| **STScI — HST WFC3 IHB §9.6** | `Σ = C·t / √[C·t + N_pix(B_sky+B_det)·t + (N_pix/N_bin)·N_read·R²]` |
| **Rubin Observatory — SMTN-002** | `C ∝ effArea` (nessun termine di focale) · `σ²_instr = (readNoise² + darkCurrent·expTime)·n_exp` · conversione mag/arcsec² → counts/pixel via plate scale |
| **Sheffield PHY217** (Dhillon) | «the amount of light collected is proportional to D²» **e** «the larger the focal ratio, the slower the camera, as the amount of light falling on **a given area of the focal plane** is smaller» |
| **UCO/Lick AY257** (Bolte) | `S/N = R*·t/√(R*·t + Rsky·t·npix + RN²·npix + D·npix·t)` |
| **Columbia CAVE — Nayar, *Radiometry and Reflectance*** | `E = L·(π/4)·(d/f)²·cos⁴α` — irradianza **per unità di area immagine** |
| **ESO FORS ETC · Gemini ITC** | sorgente estesa trattata in mag/arcsec², apertura = 1 arcsec² |

Due lacune dichiarate: il teorema di conservazione dell'*étendue* (AΩ) e la forma con
trasmissione+ostruzione dell'equazione di irradianza non sono stati recuperati da fonte
istituzionale in questa sessione (CDN bloccati). Sono standard ma non citati.

---

## A · Derivazione N-pose

Forma pubblicata, per pixel, N pose da `t_posa`, `T = N·t_posa`:

```
SNR_px = R_s·T / √( (R_s + R_b + R_d)·T  +  N·RN² )
                                             ↑ pagato per LETTURA, non integrato nel tempo
```

Sostituendo `N = T/t_posa` e raccogliendo `T`:

```
SNR_px = R_s·T / √( T·[ R_s + R_b + R_d + RN²/t_posa ] )
                                            ↑ RN diventa un TASSO
```

**`N` non compare più: entra solo attraverso `T/t_posa`.** Nessuna dipendenza nascosta dal
numero di letture.

Passaggio a unità di angolo solido — su `Ω₀` arcsec² ci sono `n = Ω₀/Ω_px` pixel; segnale e
cielo sono per arcsec² (`R = x_arc·Ω_px`), buio e lettura sono **per pixel** e vanno divisi
per `Ω_px`:

```
SNR(Ω₀) = √n · R_s·T / √(T·[…]) = s_arc·√( Ω₀·T / V̇ )

V̇ = s_arc + b_arc + d_px/Ω_px + RN²/(Ω_px·t_posa)      [e⁻²/arcsec²/s]

t(SNR,Ω₀) = SNR²·V̇ / (s_arc²·Ω₀)
```

### Verifica numerica — RC8 nativo, OIII 3 nm, `s_arc` = 0,004368 e⁻/arcsec²/s

| N | T (s) | forma N-pose | forma a tassi | scarto |
|---|---|---|---|---|
| 1 | 600 | 0,226563542 | 0,226563542 | 0 |
| 10 | 6 000 | 0,716456828 | 0,716456828 | 0 |
| 30 | 18 000 | 1,240939627 | 1,240939627 | 0 |
| 50 | 30 000 | 1,602046169 | 1,602046169 | 0 |
| 180 | 108 000 | 3,039668887 | 3,039668887 | 0 |

- le due forme coincidono per ogni N ✓
- `SNR(1 arcsec²)` calcolato dai pixel == calcolato dai tassi angolari ✓ (2,598503)
- **`Ω₀` si semplifica**: 1, 100 e 3600 arcsec² danno `0,739042` identico ✓

A T costante il numero di pose conta, come deve:
`300 s → 1,079` · `600 s → 1,241` · `900 s → 1,314` · `1800 s → 1,401` ✓

## A-bis · Il `timeFactor` è di **categoria B**

Stesso telescopio, camera, cielo, banda:

| t_posa | gain / RN | fattore |
|---|---|---|
| 120 s | HCG 1,5 e⁻ | ×0,963 |
| 300 s | HCG 1,5 e⁻ | ×0,824 |
| **600 s** | HCG 1,5 e⁻ | **×0,739** |
| 900 s | HCG 1,5 e⁻ | ×0,702 |
| 1800 s | HCG 1,5 e⁻ | ×0,658 |
| 600 s | LCG 3,3 e⁻ | ×0,958 |

**Non è una proprietà del telescopio.** È una funzione della strategia di acquisizione, e
va calcolato con la `subExposure` reale del planner. Architetturalmente: **vive in
EFFICIENCY e riceve `t_posa` da OPERATIONS**. Dipendenza fisica reale, dichiarata, non
duplicata. Ordine di chiamata già compatibile: `subExposure → timeFactor → prescribe → planNights`.

## B · Test sky-limited

RC8 f/8,0 contro RC8 f/6,4 — stessa apertura, camera, filtro, gain, posa.

| SQM | regime | f/8,0 | f/6,4 | vantaggio f/6,4 |
|---|---|---|---|---|
| 22,0 | lettura+buio dominano | ×0,861 | ×0,646 | 24,9% |
| **21,3** | lettura+buio dominano | ×0,739 | ×0,570 | **22,9%** |
| 20,5 | misto (84%) | ×0,617 | ×0,516 | 16,4% |
| 20,0 | misto (53%) | ×0,561 | ×0,491 | 12,4% |
| 19,0 | misto (21%) | ×0,491 | ×0,460 | 6,3% |
| 18,0 | cielo dominante (8,4%) | ×0,459 | ×0,446 | 2,8% |
| 16,0 | cielo dominante (1,3%) | ×0,440 | ×0,438 | 0,47% |
| 12,0 | cielo dominante (0,0%) | ×0,4362 | ×0,4362 | **0,012%** |

- il vantaggio del f/ **tende a zero** in regime sky-limited ✓
- f/8 e f/6,4 **convergono** ✓
- l'andamento è **monotono** col cielo ✓
- a cielo dominante il fattore diventa **esattamente il rapporto di raccolta**
  `×0,4362` contro `(A·k)_rif/(A·k) = ×0,4362` ✓

## C · Aperture diverse a pari f/ — il test decisivo

> **La formulazione del punto 8 va corretta, e la correzione è la sostanza del test.**
>
> «per una sorgente estesa in regime sky-limited, stesso f/ e aperture diverse devono
> risultare **sostanzialmente equivalenti per unità di superficie angolare**, e l'apertura
> maggiore deve emergere **soprattutto nella scala/risoluzione**» — **è falso.**
>
> È vero **per pixel** e **per unità di area del sensore**: lì vale `E ∝ 1/f²`.
> Non è vero **per arcsec² di cielo**: lì il flusso è `Φ ∝ A`, e un 200 mm raccoglie
> quattro volte i fotoni di un 100 mm dalla stessa porzione di cielo.
>
> Sheffield PHY217 contiene **entrambe le metà nello stesso documento**: «the amount of
> light collected is proportional to D²» e «the larger the focal ratio, the slower the
> camera, as the amount of light falling on *a given area of the focal plane* is smaller».
> Rubin SMTN-002: `C ∝ effArea`, nessun termine di focale.
>
> **Il test giusto non è «devono essere equivalenti»** — sarebbe imporre un errore.
> È: **il vantaggio dell'apertura deve valere esattamente `A·k`, e niente di più.**
> Se il modello aggiungesse qualcosa sopra il rapporto di raccolta, sarebbe passato
> all'errore opposto. Questo è ciò che il test verifica.

Telescopi sintetici a pari **f/5,00**, ostruzione 0, τ 0,95, ASI2600MM, OIII 3 nm, 600 s:

| D mm | F mm | f/ | ″/px | e⁻/px/s ogg | e⁻/arcsec²/s | A·k | fattore |
|---|---|---|---|---|---|---|---|
| 100 | 500 | f/5,00 | 1,551 | **3,430e−3** | 1,426e−3 | 60,41 | ×1,242 |
| 200 | 1000 | f/5,00 | 0,776 | **3,430e−3** | 5,703e−3 | 241,63 | ×0,310 |
| 400 | 2000 | f/5,00 | 0,388 | **3,430e−3** | 2,281e−2 | 966,53 | ×0,078 |

- a pari f/ l'illuminamento **per pixel è identico** — `3,4300e−3` per tutti e tre ✓
  *(è l'invariante che il punto 8 intuisce correttamente, ed è nel modello)*
- a pari f/ anche il **cielo per pixel è identico** — `0,013273` ✓
- per arcsec² il flusso scala **come D²**: ×4,000 e ×16,000 ✓
- il vantaggio **in tempo** è esattamente il rapporto di raccolta: ×4,000 e ×16,000 ✓
- **nessun termine extra** oltre `A·k` e i termini strumentali ✓

E la risoluzione, che è l'altra faccia e resta su un asse separato:

| D mm | ″/px | campionamento a FWHM 2,2″ |
|---|---|---|
| 100 | 1,551 | sottocampionato |
| 200 | 0,776 | corretto |
| 400 | 0,388 | sovracampionato |

**Conclusione:** a pari f/ il telescopio maggiore è più profondo di `D²` **e** più
risolvente. Le due cose sono convertibili (binnando si torna alla stessa scala e resta il
guadagno `D`), ma il vantaggio **non è «solo risoluzione»**.

## D · Riduttore 0,80× — risultato, non regola

| condizione | f/8,0 | f/6,4 | vantaggio |
|---|---|---|---|
| OIII 3 nm · 600 s · SQM 21,3 · HCG | ×0,739 | ×0,570 | **22,9%** |
| posa 120 s | ×0,963 | ×0,669 | 30,5% |
| posa 1800 s | ×0,658 | ×0,534 | 18,8% |
| cielo SQM 18,5 | ×0,472 | ×0,452 | **4,2%** |
| gain LCG (RN 3,3 e⁻) | ×0,958 | ×0,667 | 30,4% |
| buio 0,0005 e⁻/px/s | ×0,658 | ×0,534 | 18,8% |
| banda larga L · 180 s | ×0,450 | ×0,442 | **1,7%** |

Il vantaggio cambia con posa ✓, cielo ✓, rumore di lettura ✓, buio ✓, ed è trascurabile in
banda larga ✓. **Nel codice non va scritto «0,8× = 23% più veloce»: va scritto il modello.**

## E · RC8 contro Askar — tutti i parametri

Banda OIII · 600 s · SQM 21,3 · metrica: SNR per arcsec² di cielo.

| config | D | F | f/ | ″/px | τ | QE | filt | CFA | OSC | A·k |
|---|---|---|---|---|---|---|---|---|---|---|
| RC8 nativo | 203,2 | 1624 | f/7,99 | 0,478 | 0,705 | 0,90 | 0,90 | 1,00 | 1,00 | 185,1 |
| RC8 0,80× | 203,2 | 1300 | f/6,40 | 0,597 | 0,705 | 0,90 | 0,90 | 1,00 | 1,00 | 185,1 |
| Askar nativo | 71 | 490 | f/6,90 | 1,583 | 0,950 | 0,90 | 0,90 | 1,00 | 1,00 | 30,5 |
| Askar 0,75× | 71 | 367 | f/5,17 | 2,113 | 0,950 | 0,90 | 0,90 | 1,00 | 1,00 | 30,5 |
| Askar 0,75× + MC | 71 | 367 | f/5,17 | 2,113 | 0,950 | 0,82 | 0,90 | 0,71 | 1,00 | 19,7 |

| config | `b_arc` | `d_arc` | `r_arc` | `V̇` | **fotom.** | campionamento |
|---|---|---|---|---|---|---|
| RC8 nativo | 0,01690 | 0,01315 | 0,01644 | 0,04650 | ×0,74 | sovracampionato |
| RC8 0,80× | 0,01690 | 0,00843 | 0,01054 | 0,03587 | ×0,57 | sovracampionato |
| Askar nativo | 0,00278 | 0,00120 | 0,00150 | 0,00548 | ×3,22 | sottocampionato |
| Askar 0,75× | 0,00278 | 0,00067 | 0,00084 | 0,00429 | ×2,52 | sottocampionato |
| Askar 0,75× + MC | 0,00180 | 0,00067 | 0,00084 | 0,00331 | ×4,64 | sottocampionato |

```
(203,2/71)² diametri nudi                        ×8,19
raccolta reale A·k (ostruzione 45% + τ + QE)     ×6,08   a favore RC8
rapporto delle varianze V̇                        ×8,49   a sfavore RC8
─────────────────────────────────────────────────────────
RISULTATO DEL MODELLO in questa configurazione   ×4,35
lo stesso, in banda larga                        ×5,95
lo stesso, a posa 300 s                          ×4,09
lo stesso, a SQM 18,5                            ×5,76
```

- il rapporto **non è una costante**: si muove con banda, posa e cielo ✓
- il rapporto è sempre **≤ il rapporto di raccolta** ✓

**Non «RC8 è 4,35× più veloce».** «Con questa camera, questo filtro, questo cielo, questa
posa e questa metrica, il modello dà ×4,35.»

## F · OSC_BB × f_CFA — dichiarato NON VALIDATO

Cosa rappresentano, uno per uno:

| termine | corregge |
|---|---|
| `QE(λ)` | efficienza del fotosito; su OSC la curva pubblicata è quella del canale **migliore** |
| `T_filtro` | trasmissione del filtro alla riga / nella banda |
| `f_CFA` | il **numero** di fotositi che raccoglie davvero quella **riga**, pesato per la QE dei canali |
| `OSC_BB` | la **banda**: un fotosito colorato vede ~1/3 dello spettro |

Sono grandezze diverse, e **in banda stretta non si toccano** (`OSC_BB` non si applica).
In banda larga si sovrappongono: entrambe dicono «un pixel colorato raccoglie meno».

| banda | narrow | `f_CFA` | `OSC_BB` | prodotto | stato |
|---|---|---|---|---|---|
| Hα | sì | 0,29 | 1,00 | 0,290 | **VALIDATO** |
| OIII | sì | 0,71 | 1,00 | 0,710 | **VALIDATO** |
| SII | sì | 0,28 | 1,00 | 0,280 | **VALIDATO** |
| L | no | 1,00 | 0,34 | 0,340 | coerente |
| RGB | no | 0,62 | 0,34 | **0,211** | **NON VALIDATO** |

**Non scelgo un numero nuovo.** Serve ricostruire il conto per canale — integrale di
`QE_c·T` su ciascuna banda, mediato sui quattro fotositi — e confrontarlo con la forma
attuale. Lavoro separato, con la sua verifica.
I regression test A61 e NGC 6888 sono **mono e in banda stretta**: non dipendono da questo ✓

## G · Stato dei test

| | |
|---|---|
| suite esistente (`test.js`, `index.html` intatto) | **325 / 325** |
| `tools/verifica-modello.js` | 26 / 26 |
| `tools/gate-A.js` | 6 / 6 |
| `tools/gate-BC.js` | 10 / 10 |
| `tools/gate-DEF.js` | 9 / 9 |
| **totale** | **376 / 376, zero fallimenti** |

---

## La proposta

### Il modello

```js
// EFFICIENCY — un posto solo, tassi per pixel poi conversione angolare
function rates(dv, band, sqm) {
  const sp  = bandSpec(band, dv.c), lam = sp.lines[0];
  const cfa = cfaFraction(dv.c, band);
  const osc = (dv.c.cfa_penalty && !sp.narrow) ? OSC_BB : 1;   // NON validato: solo banda larga
  return {
    k      : qeAt(dv.c, lam) * sp.T * cfa * osc,
    om     : dv.scale * dv.scale,                     // arcsec²/px
    collect: (dv.Aeff/100) * k,                       // cm²·(adim)
    R_b    : skyRateFor(dv, band, sqm, {spec: sp}) * cfa,
    R_d    : (dv.c.dark_e_s||0) * dv.bin * dv.bin,
    RN     : dv.rnEff || dv.c.read_noise_e };
}
const Vdot = (r, tsub, s_arc) =>
  (s_arc||0) + r.R_b/r.om + r.R_d/r.om + r.RN*r.RN/(r.om*tsub);

function timeFactor(dv, band, tsub, s_fot) {           // tsub OBBLIGATORIO: categoria B
  const a = rates(dv, band, SQM_REF), b = rates(refDv(), band, SQM_REF);
  return (Vdot(a, tsub, (s_fot||0)*a.collect) / a.collect**2)
       / (Vdot(b, tsub, (s_fot||0)*b.collect) / b.collect**2);
}
```

Nessun `C(w)`. Nessun f/ efficace. Nessun fattore di seeing. `s_fot` opzionale: quando lo
strato fotometrico darà la brillanza dell'oggetto, la forma diventa esatta senza cambiare
struttura.

### La gerarchia

```
ASTROFISICO       cosa emette il target, quanto è debole            [invariato]
      ↓
STRUMENTALE   ┌── PHOTOMETRIC EFFICIENCY   ← questa revisione
              │     A_eff · τ · QE · T_filtro · CFA · cielo · buio · RN · t_posa
              │     metrica: SNR per arcsec². Riceve t_posa da OPERATIONS.
              ├── SAMPLING                 [invariato]
              │     focale, pixel, scala, binning
              └── RESOLUTION               [invariato]
                    seeing, guida, ottica, campionamento
      ↓
OPERATIVO         quando riprenderlo, posa, come distribuire le ore  [invariato]
```

I tre rami **non si moltiplicano fra loro**. L'unico attraversamento dichiarato è
`t_posa: OPERATIONS → EFFICIENCY`, ed è una dipendenza fisica reale (§A-bis).

### Modifica minima

| file | cosa |
|---|---|
| `index.html` | nuova `rates()` + `Vdot()`; `timeFactor(dv, band, tsub, s_fot)` |
| `index.html` `refCfg()` | esporre `Aeff` e il `derive` di riferimento |
| `index.html` `evaluate()` | passare la `t_posa` reale (già calcolata da `subExposure`) |
| `index.html` `derive()` commento | correggere «bin 2 divide il tempo per 4» |
| `index.html` glossario `bin` | idem — binning = campionamento + duty cycle + spazio disco |
| UI | dichiarare metrica, `t_posa` e cielo accanto al fattore |
| `data/*.json` | **nulla** |

**Non toccati:** archetipi, classificazione, ratio Hα/OIII/SII, ore per canale, profondità,
Luna, LP, visibilità, ranking, rotatore, N.I.N.A., export, distribuzione notti, `sigRate`
(resta: è corretto per saturazione e posa, che sono grandezze per pixel).

### Regression test, non calibrazione

**Abell 61** — pavimento OIII da 22,5 h a **5,9 h**; le 8 h reali cadono fra pavimento e
utile (11,1 h) → livello «ridotto». **Le 8 h non entrano in nessuna formula**: sono una
verifica empirica indipendente. Lo scarto residuo è nella soglia generica `pn_faint`, non
nella configurazione.

**NGC 6888 SII** — pavimento da 14,0 h a **4,1 h**; le 1,5 h reali restano sotto, ora 2,7×
invece di 9,4×.

---

**Stato: INTEGRATO in v1.4.** Suite completa **361/361** (le dieci attese che codificavano il vecchio modello sono state riscritte mantenendo l'intento, e sono state aggiunte 23 verifiche nuove: equivalenza N-pose, semplificazione della scala angolare, regime sky-limited, aperture diverse a pari f/, riduttore come risultato, neutralità del binning, flag di validazione OSC, regression test Abell 61). Gate riproducibile: `node tools/gate-fisico.js` e i suoi tre moduli.
