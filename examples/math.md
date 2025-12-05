# Space Solar Math

Does the space solar option make sense?

## 1. Launch Costs

> **Claim:** 30,000,000 kg × $100/kg = $3B
> **If $2,600/kg:** ≈ $78B

Let’s check:

* $100/kg:
  30,000,000 kg × 100 = 3,000,000,000 → **$3B** ✅
* $2,600/kg:
  30,000,000 × 2,600 = 78,000,000,000 → **$78B** ✅

So the math is correct. The “thesis” is indeed **extremely sensitive** to actually hitting $100/kg (or close). At current Falcon 9 type costs, the idea is dead on arrival.

---

## 2. Earth Infrastructure Assumptions

### 2.1 Solar Sizing: 25 GW for 5 GW baseload

* Capacity factor (CF) ≈ 20%
* Effective average output = Nameplate × CF
* To get 5 GW *continuous*:

$$
25\ \text{GW} \times 0.2 = 5\ \text{GW}
$$

That’s exactly right, **ignoring**:

* Storage losses,
* Seasonal variation,
* Weather.

But as a back-of-envelope? **Correct.**

### 2.2 Batteries: 70 GWh for 14 hours

$$
\frac{70\ \text{GWh}}{5\ \text{GW}} = 14\ \text{hours}
$$

70 GWh = 70,000 MWh;
5 GW = 5,000 MW;
70,000 / 5,000 = 14.

Covers a 5 PM → 7 AM “dark window”: **correct** (again, ignoring inefficiencies and bad-weather days).

### 2.3 Cost: Solar + Batteries

* Solar:
  25 GW = 25,000,000,000 W
  25,000,000,000 W × $0.80/W = $20,000,000,000 → **$20B** ✅

* Batteries:
  70 GWh = 70,000,000 kWh
  70,000,000 kWh × $130/kWh = 9,100,000,000 → **$9.1B** ✅

* Total:
  20 + 9.1 = **$29.1B**, so your “closer to $29B” is right.

So relative to your stated unit prices, the image’s $22B is actually **optimistic**, not pessimistic. You’re correct to say your own estimate makes the original number look “fair” only if you assume future cost declines.

---

## 3. Space Radiators (Stefan–Boltzmann Check)

You did:

$$
P = \epsilon \sigma A (T^4 - T_{\text{env}}^4)
$$

Inputs:

* P = 5 × 10⁹ W (5 GW)
* T = 353 K (80 °C)
* T_env ≈ 3 K → negligible
* σ = 5.67 × 10⁻⁸ W/m²/K⁴
* ε ≈ 0.9

Radiative flux:

$$
\text{Flux} \approx 0.9 \cdot 5.67 \times 10^{-8} \cdot 353^4 \approx 792\ \text{W/m}^2
$$

I recomputed that: ≈ **792 W/m²** ✅

Required ideal area:

$$
A = \frac{5 \times 10^9}{792} \approx 6.3 \times 10^6\ \text{m}^2 \approx 6.3\ \text{km}^2
$$

That matches your 6.3 km². ✅

You then note:

* Real radiators suffer:

  * View-factor issues (they see each other and the spacecraft),
  * Solar absorption,
  * Thermal resistance from chip → loop → fin.

So bumping 6.3 km² up to **10–15 km²** is a totally reasonable engineering margin. Your verdict that the image is using a realistic ≈2× safety factor is **sound**.

---

## 4. Space Solar Sizing

Inputs:

* Solar constant in orbit ≈ 1,360 W/m²
* Panel efficiency ≈ 25%
* So usable flux ≈ 0.25 × 1,360 ≈ 340 W/m²

Area for 5 GW:

$$
A = \frac{5,000,000,000}{340} \approx 14,705,882\ \text{m}^2 \approx 14.7\ \text{km}^2
$$

That lines up with your **≈14.7 km²** and “15 km²” claim. ✅
So your “**spot on**” judgment is correct.

---

## 5. Mass Density & Launch Cost Sensitivity

### 5.1 Mass per Area

Total area:

* Solar: 15 km²
* Radiators: 15 km²
* Total = 30 km²

Convert:

$$
30\ \text{km}^2 = 30 \times (1{,}000\ \text{m})^2 = 30{,}000{,}000\ \text{m}^2
$$

Given total mass 30,000,000 kg:

$$
\text{Areal density} = \frac{30{,}000{,}000\ \text{kg}}{30{,}000{,}000\ \text{m}^2} = 1\ \text{kg/m}^2
$$

That arithmetic is **exactly right**.

You then argue:

* 1 kg/m² for ultra-thin orbital solar is at least *plausible*.
* 1 kg/m² for **radiators + fluid loops + structure** over 15 km² is very questionable.

That’s no longer “math,” that’s engineering judgment—but your skepticism is well placed.

### 5.2 “Corrected” Mass and Cost

You propose a more realistic:

* 5 kg/m² overall (still very lightweight)

Then:

$$
5\ \text{kg/m}^2 \times 30{,}000{,}000\ \text{m}^2 = 150{,}000{,}000\ \text{kg}
$$

Convert to metric tons:

$$
150{,}000{,}000\ \text{kg} / 1{,}000 = 150{,}000\ \text{tons}
$$

Both are correct. ✅

At $100/kg:

$$
150{,}000{,}000\ \text{kg} \times 100 = 15{,}000{,}000{,}000 = $15\text{B}
$$

Also correct. ✅

Then you add:

* +$1B materials
* +$1B buffer

Total ≈ **$17B**.

Compare to Earth-side $22–29B, and you’re right that **on pure capex arithmetic**, the space option can still win **if**:

* You can actually achieve ~5 kg/m² across *everything*,
* You genuinely get $100/kg launch,
* You’re ignoring a ton of non-trivial stuff:

  * R&D,
  * Assembly in orbit,
  * Replacement hardware,
  * Operations, maintenance, degradation, risk.

But those caveats are conceptual, not arithmetic. The calculation itself is solid.

---

## Big Picture Summary

* **Every numeric calculation you wrote checks out**:

  * Launch cost scaling (3B vs 78B),
  * Earth solar + storage sizing and cost,
  * Radiator Stefan–Boltzmann math and area,
  * Space solar area,
  * Areal density and mass escalation at 5× heavier structure,
  * Launch cost at higher mass.

* The **weak links are assumptions**, not math:

  * Reaching $100/kg to LEO (or anywhere near it) is crucial.
  * Achieving ~1–5 kg/m² for a 30 km² combined solar + radiator + structure + piping system is extremely aggressive.
  * Earth-side cost estimates don’t include full BOS, land, permitting, grid integration, and realistic storage oversizing.

* Under your assumptions:

  * Space system at **$3–17B** vs Earth system at **$22–29B** is *mathematically consistent*.
  * The thesis becomes “if launch gets very cheap and structures get ultralight, **space compute/energy could be economically competitive with large Earth installations**.”

So your arithmetic is basically airtight; the real frontier is materials, launch economics, and system complexity, not the equations themselves.
