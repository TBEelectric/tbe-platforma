# Zadání docházky

Docházka je první modul platformy: denní ruční zápis intervalů od–do na zakázky pro 10–25 zaměstnanců,
měsíční potvrzení zaměstnancem, schválení vedoucím a podklady pro externí mzdovou účetní.

## Zadání

| Oblast | Zadání |
| --- | --- |
| Lidé | 10–25 zaměstnanců na HPP a DPP/DPČ |
| Zápis | Denně dodatečně, s připomínkou, když den chybí; vedoucí nebo správce může zapsat za zaměstnance |
| Režim | Pružná a nerovnoměrně rozvržená pracovní doba |
| Zakázky | Intervaly od–do jako v prototypu: každý interval je práce na zakázce s druhem práce (montáž, revize, cesta, režie), nebo přestávka |
| Cesta | Počítá se jako pracovní doba (druh práce „cesta“) |
| Absence | Dovolená s nárokem a zůstatkem, nemoc, OČR, lékař |
| Další časy | Přesčasy, svátky, víkendy, noc, pohotovost |
| Schvalování | Zaměstnanec potvrdí měsíc v aplikaci, pak schválí vedoucí za svou partu |
| Výstup | Podklady pro externí mzdovou účetní (XLSX a PDF) |
| Dnes | Excel; potřeba import zaměstnanců a zůstatků dovolené |
| Sazby | Zatím ne, datový model s nimi počítá |

## Dopady na návrh

1. **Den má začátek a konec.** Intervaly od–do dávají začátek, konec, přestávky i hodiny na zakázky v jednom
   zápisu, což odpovídá evidenci podle zákoníku práce. Aplikace hlídá překryvy a na telefonu nabídne
   „Pokračovat“ s koncem posledního intervalu a poslední zakázkou.
2. **Nerovnoměrná doba může vyžadovat plán směn.** Rozvrh se musí oznamovat předem; pokud ho firma nevede
   jinde, bude potřeba jednoduchý plán. Bez vyrovnávacího období nejde správně spočítat přesčasy.
3. **DPP a DPČ mají vlastní pravidla.** Hlídat limit hodin u DPP a nárok na dovolenou dohodářů.
4. **Party a vedoucí.** Struktura týmů s vedoucím je v jádru; stojí na ní schvalování.
5. **Aplikace dodává podklady, ne mzdy.** Spočítá hodiny, noc, víkendy, svátky, pohotovost a absence.
6. **Navázání na knihu jízd** později: druh práce „cesta“ navrhovat z jízd vozidel.

## Z prototypu „TBE Evidence pracovní doby“

Přebírá se model intervalů, kontrola překryvů, předvyplnění dalšího intervalu, součty podle zakázky
a zaměstnance a export CSV (středník, UTF-8 s BOM). Vzhled se nepřebírá (viz `design.md`).

## Pozdější rozšíření (ze zářijového konceptu, zatím ne)

- NFC čipy na stavbě a v autě, které otevřou zakázku jedním přiložením telefonu.
- Návrh začátku směny podle příjezdu auta z GPS („Auto dojelo v 7:00, začít od 7:00?“).
- Výkazy práce pro klienta jako příloha faktury.

## Otevřené body

- [ ] Vyrovnávací období a pravidla přesčasů (mzdová účetní)
- [ ] Rozvrh nerovnoměrné doby: vede se jinde, nebo plán směn v aplikaci?
- [ ] Vzor podkladu pro mzdy a současný Excel s docházkou
- [ ] Roční limit DPP a dovolená dohodářů ověřit s účetní
- [ ] Zaokrouhlování času (na minuty, nebo např. na 15 min)? Návrh: na minuty, bez zaokrouhlení
- [ ] Seznam zaměstnanců, part a vedoucích pro import
- [ ] Doména, VPS, Google Workspace (OAuth), SMTP
