# Architektura platformy

Všechny aplikace TBE jsou **jedna modulární aplikace**: jeden Next.js projekt, jedna databáze PostgreSQL,
jedno přihlášení přes firemní Google účet. Mezi moduly se přepíná dlaždicemi v launcheru nebo
přepínačem v bočním menu.

## Moduly

| Modul | Složka v `src/modules/` | Stav |
| --- | --- | --- |
| Jádro (zaměstnanci, týmy, zákazníci, zakázky, místa, svátky, audit) | `core` | 1. verze |
| Docházka | `timesheets` | 1. verze |
| Zakázky (správa zakázek a zákazníků, později hodiny a další funkce nad zakázkami) | `jobs` | před pilotem |
| Vozový park a kniha jízd | `fleet` | další |
| Nemovitosti | `properties` | plánováno |
| Sklad | `inventory` | plánováno |
| Nářadí a technika | `tools` | plánováno |

Zakázkový systém není samostatná aplikace: zakázky a zákazníci jsou v jádru od začátku.

**Rozhodnuto (10/2026):** zakázky dostanou vlastní modul `jobs` s dlaždicí v launcheru. Tabulky `customer`, `job`,
`site` a `team_job` zůstávají v jádru jako sdílená kmenová data; modul `jobs` vlastní obrazovky a nové funkce
(vlastní tabulky ve schématu `jobs`). Hodiny zůstávají v docházce a modul `jobs` je čte přes její veřejné API;
stejně později jízdy z vozového parku a materiál ze skladu. Závislosti jen jedním směrem: `jobs` → ostatní moduly
→ `core`; žádný modul kromě `jobs` ho neimportuje.

## Proč jedna aplikace

- Data se prolínají: hodiny na zakázky, jízdy na zakázky, materiál na zakázky, nářadí u zaměstnance.
- Jedno přihlášení bez SSO, jedno nasazení, jedna záloha.
- Modul je samostatná složka s veřejným rozhraním (`index.ts`); v případě potřeby jde vyčlenit do samostatného balíčku (monorepo).

## Klíčová rozhodnutí

1. Oprávnění po modulech (role se přidělují zvlášť pro každý modul).
2. Termíny a revize (STK, revize nářadí, revize v nemovitostech) jsou jeden mechanismus v jádru.
3. Vozový park = vše s GPS, jízdami nebo SPZ; nářadí a technika = vše, co se vydává lidem nebo na zakázky.
4. Sklad (množství) a nářadí (jednotlivé kusy s výrobním číslem) jsou dva moduly.
5. Jedna PWA pro všechny moduly; offline se řeší po modulech.

## Jazyky rozhraní

**Rozhodnuto:** aplikace je od začátku připravená na víc jazyků. **Zatím se nepřekládá** – existuje jen čeština.
Důvod: část montérů jsou Ukrajinci; ukrajinština se doplní později jen překladem, bez úprav obrazovek.

Pravidla:
- Všechny texty rozhraní jdou přes překladové klíče (`next-intl`), nikdy natvrdo v komponentách.
  Soubory `messages/cs.json` (teď jediný), později `messages/uk.json`. Klíče po modulech
  (`timesheets.day.addInterval`, `core.employees.title` …).
- Platí i pro chybové hlášky, upozornění, e-maily, PDF/XLSX exporty (hlavičky sloupců) a stavy (např. „Potvrzeno“).
- Data se nepřekládají: názvy zakázek, firem, míst, poznámky.
- Formát data, času a čísel podle jazyka uživatele (`Intl`), časové pásmo vždy Europe/Prague.
- `user.locale` (výchozí `cs`); přepínač jazyka v profilu se přidá až s druhým jazykem.
- Ikony u klíčových akcí (přestávka, zakázka, absence) pomáhají i bez překladu.

## Provoz

Jeden Next.js projekt bez monorepa; monorepo až při druhé nasazované aplikaci (např. nativní mobil, portál pro nájemníky).

Vlastní VPS, Docker Compose (web, worker, PostgreSQL, Caddy jako HTTPS proxy), denní záloha databáze
mimo server, e-maily přes SMTP. Traccar zůstává samostatná služba; před napojením vozového parku převést
jeho databázi z H2 na PostgreSQL (samostatná databáze).
