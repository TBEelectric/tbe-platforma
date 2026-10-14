# Plán vývoje

Docházka má prioritu. Vozový park se připravuje souběžně (Traccar, ověření dat), vývoj modulu až po docházce.

## Milník 1 – Základ projektu

- [x] Založit Next.js projekt (TypeScript, Tailwind, ESLint, App Router, `src/`), pnpm, Prettier.
      `create-next-app` odmítne neprázdnou složku (je tu `CLAUDE.md` a `docs/`): vygeneruj ho do dočasné složky
      a soubory přesuň sem, nic z `docs/` ani `CLAUDE.md` nepřepiš.
- [x] `docker-compose.yml` s PostgreSQL 16 pro lokální vývoj
- [x] Drizzle: připojení v `src/lib/db.ts`, Postgres schéma `core` (`pgSchema`, v drizzle-kit `schemaFilter`), první migrace, kostra seed skriptu
- [x] shadcn/ui, barvy a písmo podle `design.md`
- [x] Layout s bočním menu, přepínač modulů, launcher s dlaždicemi (Docházka aktivní, ostatní moduly jako „Plánováno“)
- [x] Better Auth + Google (tabulky Better Auth ve schématu `core`), dočasný allow-list e-mailů v `.env` (`AUTH_ALLOWED_EMAILS`); role přijdou v milníku 2
- [x] Vitest nastavený, první test projde
- [x] Doplnit sekci Commands v `CLAUDE.md`

## Milník 2 – Jádro

- [x] Schéma `core`: employee, employment, team, team_member, role_assignment, customer, job, site, public_holiday, audit_log
- [x] Generování státních svátků ČR (včetně Velikonoc)
- [x] Správa zaměstnanců, úvazků, part a zakázek (jednoduché tabulky a formuláře)
- [x] Napojit uživatele na zaměstnance, `role_assignment`, nahradit dočasný allow-list (přihlásí se jen aktivní zaměstnanec s e-mailem)
- [x] Seed s ukázkovými zaměstnanci, partami a zakázkami (podle náhledů obrazovek)
- [x] Audit log jako sdílená funkce
- [x] Import zaměstnanců a zakázek z Excelu podle `docs/import/sablona-importu.xlsx` (listy Zaměstnanci a Zakázky):
      náhled změn a chyb po řádcích před uložením, opakovaný import aktualizuje podle osobního čísla / čísla zakázky, nic nemaže.
      Šablona je zdrojem formátu; data v ní jsou smyšlená a slouží jako testovací vstup.

## Milník 3 – Docházka: denní zápis

- [x] Schéma `timesheets`: work_type, time_entry, absence, standby, timesheet, period_close, timesheet_settings
      (leave_entitlement už je z milníku 2); výchozí druhy práce a nastavení v seedu
- [x] Pravidla s testy: validace intervalu, překryvy, zamčený měsíc, kolize s absencí, upozornění
      (přestávka, 12 h, odpočinek), interval přes půlnoc a změna času
- [x] Obrazovka Můj den (desktop i mobil), „Pokračovat od …“
- [x] Zápis za jiného zaměstnance s důvodem
- [x] Absence a dovolená, zůstatek; žádost zaměstnance, schválení vedoucím nebo správcem
- [x] Seed: intervaly za aktuální měsíc pro ukázkové zaměstnance (jeden den Jana Nováka prázdný)

## Milník 3b – Interaktivní časová osa (mobil primárně)

Reference: prototypy `docs/design/prototypes/MobilOsa.dc.html` (mobil, primární) a `Den.dc.html` (celá obrazovka Můj den)
– převzít chování (výpočty jako čisté funkce s testy) a rozložení, UI postavit znovu. Podklady: `docs/design.md`
(Responzivita, Zobrazení zakázky, Interaktivní časová osa, Mobil – zápis dne na ose), `docs/technicky-navrh.md`,
`docs/architektura.md` (Jazyky rozhraní).

Kroky jdou po sobě; každý se pouští v nové session (ručně nebo `scripts/milestone.sh 3b`). Každý krok staví jen na
hotových krocích před ním. Značky: `[ručně]` = skript krok nespustí, udělá ho člověk s Claude Code interaktivně;
`[zastavit po]` = skript po kroku zastaví, aby člověk výsledek vyzkoušel; `[opus]` = krok běží na modelu Opus (jinak Sonnet).

- [x] **3b.1 – Jazyky**
      next-intl, texty milníků 1–3 na klíčích v `messages/cs.json`, `user.locale` (výchozí `cs`). Bez překladu.

- [x] **3b.2 – Zakázka s místem**
      Migrace `job.site_id` (povinné; existující zakázky v DB a seedu dostanou místo), formulář zakázky s výběrem /
      založením místa, seed, import zakázek podle `docs/import/sablona-importu.xlsx` (sloupce Místo, Adresa místa –
      parser a testy). Funkce zobrazení „Firma, místo“ (bez s.r.o./a.s.) s testy a její použití v existujících obrazovkách
      (správa zakázek, dosavadní Můj den). Pozn.: krok byl rozpracovaný (migrace 0007, `job-display.ts`) – navázat.
      Hotovo, když: zakázky mají místo, import nové šablony projde včetně testů, všude je vidět „Firma, místo“.
      Výsledek: Zakázky mají povinné místo (migrace dá existujícím zakázkám místo pojmenované po zakázce, opraví ho seed
      nebo import šablony), formulář zakázky nabízí místa zvoleného zákazníka nebo „+ Nové místo…“, import zakládá/páruje
      místa (podle názvu u zákazníka, bez ohledu na velikost písmen) a mění adresu; správa zakázek i Můj den ukazují
      „Firma, místo“ a stálé barvy zakázek z `jobColor` (místo barev podle pořadí v dni). Vyzkoušet: založit zakázku
      s novým místem, změnit místo, import šablony (náhled ukáže „Nové místo …“). Rozhodl jsem sám: nové místo má typ
      „stavba“; ruční změna barvy zakázky (`job.color`) zatím nemá UI.

- [x] **3b.3 – Zakázky party a obvyklý den (data a server)**
      Tabulky `team_job` (unikátní team+job) a `day_template` (jedna na zaměstnance), výchozí šablona firmy
      v `timesheet_settings`. Server akce s oprávněními, auditem a testy: připnout/odepnout zakázku party (vedoucí, správce,
      admin), uložit vlastní obvyklý den (zaměstnanec), smazat šablonu zaměstnance a nastavit výchozí šablonu firmy (správce).
      Jednoduché UI ve správě: přehled připnutých zakázek v detailu party, šablona v detailu zaměstnance (zobrazit, smazat).
      Hotovo, když: akce a oprávnění jsou otestované, správa funguje; nová osa zatím není.
      Výsledek: Migrace 0008 (`core.team_job`, `timesheets.day_template`), akce připnout/odepnout (vedoucí jen svou partu),
      uložit vlastní obvyklý den, smazat šablonu zaměstnance a nastavit výchozí šablonu firmy (klíč `default_day_template`
      v `timesheet_settings`), vše auditované; pravidla šablony a oprávnění mají testy. UI: Zakázky party v detailu party,
      Obvyklý den (zobrazení, smazání) v detailu zaměstnance. Vyzkoušet: připnout/odepnout zakázku u party, smazat šablonu.
      Rozhodl jsem sám: odepnutí a smazání šablony jsou skutečné DELETE s auditem (vazby, ne obchodní záznamy); šablona
      nese jen časy a typ (bez zakázek); akce pro výchozí šablonu firmy zatím nemá formulář (přijde s osou); vedoucí
      zatím nemá vlastní obrazovku pro připínání (jen akce, UI v 3b.8).

- [x] **3b.4 – Logika osy (čisté funkce)** [opus]
      Jen `src/modules/timesheets/rules` + testy, převzato z výpočtů v prototypech: přichytávání (15 min tažení na mobilu,
      5 min jinak), zarážky o sousedy, společná hranice navazujících intervalů (soused min. 5 min, nezmizí), kreslení
      tažením, klik do mezery = celá mezera / jinde 1 h, ne do budoucna, rozsah osy 0:00 až 6:00 +1 a interval přes půlnoc,
      použití šablon „Obvyklý den“ a „Jako včera“ (vynechá kolize), řazení naposledy použitých zakázek (max 4 + aktuální),
      sekce výběru zakázky, hledání bez diakritiky (číslo, název, firma, místo), výchozí den = nejstarší nevyplněný pracovní den.
      Hotovo, když: testy pokrývají všechna pravidla a prochází; žádné UI.
      Výsledek: Tři moduly v `rules/` s testy (44 testů): `timeline.ts` (osa v minutách od 0:00 dne do 6:00 +1,
      přichytávání 15/5 min, zarážky, společná hranice se sousedem min. 5 min, kreslení nahoru/dolů, klepnutí = celá mezera
      nebo 1 h, `maxEnd` = „teď“ pro dnešek, max. 24 h, kontrola rozsahu, převod osa ↔ okamžik včetně DST), `day-fill.ts`
      (šablona → bloky se zakázkou a druhem práce, vynechání kolizí a budoucnosti, poslední vyplněný pracovní den pro
      „Jako včera“, výchozí den přes `missingWorkdays`), `job-picker.ts` (naposledy použité, tlačítka max. 4 + aktuální,
      bez historie zakázky party, sekce, hledání bez diakritiky po slovech). Rozhodl jsem sám: kolidující nebo budoucí
      bloky šablony se vynechají celé (nezkracují se); tažení přichytává posun, ne polohu (jako prototyp); „Všechny
      aktivní“ vynechá jen zakázky party (jako mobilní prototyp); nové funkce zatím nejsou v `shared.ts` (přidá 3b.5).

- [x] **3b.5 – Server pro osu** [opus]
      Jedno načtení dat dne (intervaly, naposledy použité zakázky, zakázky party, šablona, stav měsíce). Server akce
      vytvořit / upravit / smazat interval a použít šablonu; úprava hranice upraví i souseda v jedné transakci; validace
      přes pravidla z 3b.4, audit, zamčený měsíc, zápis za jiného s důvodem. Odpovědi vhodné pro optimistickou aktualizaci
      (nový stav dne nebo chyba s klíčem hlášky). Testy akcí.
      Hotovo, když: akce jsou otestované včetně kolizí, společné hranice a zamčeného měsíce.
      Výsledek: `getTimelineDay` (intervaly v minutách osy, zablokované kusy sousedních dnů, stav a zámek měsíce, „teď“,
      naposledy použité zakázky, zakázky party, platná šablona, zdroj „Jako včera“, zakázky a druhy práce) a server akce
      `timelineAction` (vytvořit / upravit / posunout okraj nebo celý interval / smazat / Obvyklý den / Jako včera) v
      `timeline-actions.ts`; odpověď `{ ok: true, day }` nebo `{ ok: false, error: "<klíč>" }`. Rozhodování je čistá funkce
      `rules/timeline-change.ts` (oprávnění, důvod za jiného, zámek, celodenní absence, kolize i se sousedními dny,
      společná hranice přes `adjustEntry`, zakázka a druh práce) s 20 testy; služba `timeline.ts` zapíše operace v jedné
      transakci s auditem (zkracující změny první kvůli exclusion constraintu). Nové hlášky v `cs.json`, pravidla 3b.4 jsou
      v `shared.ts`. Služba nad DB nemá automatický test (repo nemá testovací DB); jednorázově ověřeno proti lokální DB.
      Rozhodl jsem sám: výchozí šablona firmy je v seedu (`default_day_template`, 7:00–11:30, 11:30–12:00, 12:00–15:30) –
      na existující DB pustit `pnpm db:seed`; „Obvyklý den“ bez historie vezme první zakázku party; „Jako včera“ s uzavřenou
      zakázkou skončí hláškou (nepřeskočí ji); smazání v den celodenní absence je povolené.

- [ ] **3b.6 – Vývojové přihlášení a přístup z telefonu v domácí síti**
      Bez tunelu a bez Google Console. (1) **Vývojové přihlášení:** na přihlašovací stránce navíc „Přihlásit jako…“
      se seznamem aktivních zaměstnanců (jméno, role); vytvoří normální Better Auth session daného uživatele. Funguje jen
      při `NODE_ENV=development` **a** `DEV_LOGIN=true` v `.env` (do `.env.example` zakomentovaně); jinak route i tlačítko
      neexistují / vrací 404. Test, který ověří, že bez obou podmínek přihlášení nejde. (2) **Přístup z telefonu:**
      skript `pnpm dev:lan` spustí Next.js na `0.0.0.0` a vypíše adresu `http://<IP Macu>:3000`; `BETTER_AUTH_URL`
      / povolené originy Better Auth upravit tak, aby fungovaly i z IP adresy v síti (jen ve vývoji). Postup do `CLAUDE.md`.
      PWA instalace a HTTPS až s nasazením na VPS (milník 5).
      Hotovo, když: na telefonu ve stejné Wi-Fi jde otevřít aplikaci a přihlásit se „jako“ ukázkový zaměstnanec;
      v produkčním buildu vývojové přihlášení neexistuje.

- [ ] **3b.7 – Mobil I: osa a úpravy**
      Mobile-first obrazovka Můj den (< 768 px) podle `MobilOsa.dc.html`: svislá osa celého dne s automatickým posunem na
      pracovní dobu a podbarvenou nocí, podržet a táhnout = nový interval (nekoliduje se scrollem), klepnutí do mezery,
      úchyty a posun se společnou hranicí, kompaktní spodní panel (−/+ 5 min, Práce/Přestávka, smazat), zavření klepnutím
      mimo, přestávka s ikonou kávy a teplou barvou, optimistické ukládání přes akce z 3b.5. Zakázka zatím = naposledy použitá.
      Hotovo, když: den jde na telefonu poskládat a upravit tažením i tlačítky.

- [ ] **3b.8 – Mobil II: zakázky a šablony** [zastavit po]
      V panelu tlačítka naposledy použitých zakázek („Firma, místo“) a „Další zakázky…“ = výběr přes celou obrazovku
      (vyhledávání, sekce Naposledy použité / Zakázky party / Všechny aktivní, špendlík pro vedoucího), druh práce jako
      tlačítka; prázdný den („Můj obvyklý den“ / „Obvyklý den“, „Jako včera“), „Uložit jako můj obvyklý den“ s potvrzením,
      výchozí den, hlavička se součty, spodní navigace. Nový člen party vidí zakázky party jako tlačítka.
      Hotovo, když: celý mobilní zápis odpovídá prototypu. Po kroku člověk vyzkouší na skutečném telefonu.

- [ ] **3b.9 – Desktop: Můj den**
      Obrazovka Můj den (≥ 1024 px) podle `Den.dc.html`: vodorovná osa nad stejnou logikou, přepínač
      „Pracovní doba / Celý den“, čára „teď“, hover s časem, kartičky intervalů propojené s osou, panel vybraného intervalu
      (−/+, Přestávka, naposledy použité zakázky, combobox zakázek se sekcemi a špendlíkem, druh práce jako tlačítka) místo
      starého formuláře, pravý sloupec (součty po zakázkách, kontroly, měsíční výkaz), ovládání klávesnicí (šipky ±5 min).
      Hotovo, když: desktop odpovídá prototypu, starý formulář „Přidat interval“ je odstraněný.

- [ ] **3b.10 – Dokončení milníku** [zastavit po]
      Zamčený měsíc jen pro čtení na mobilu i desktopu, tablet (na výšku mobil, na šířku desktop), přístupnost (popisky,
      fokus, kontrast), úklid nepoužívaného kódu staré mobilní obrazovky, Playwright test zápisu dne (mobil i desktop),
      nové PNG náhledy do `docs/design/screens/` (02-muj-den, 06-mobil-den), aktualizace `docs/design.md`.
      Hotovo, když: vše výše prochází; po kroku člověk vyzkouší iPhone Safari a Android Chrome.

## Milník 4 – Měsíc, schválení, uzávěrka

- [ ] Výpočty za měsíc s testy (noc, víkend, svátek, pohotovost, fond); zadávání pohotovosti
- [ ] Můj měsíc, potvrzení zaměstnancem
- [ ] Schvalování vedoucím, vrácení s důvodem
- [ ] Uzávěrka, znovuotevření, verze exportu
- [ ] Export XLSX + PDF pro mzdy, CSV po zakázkách
- [ ] Připomínky nevyplněných dnů (worker, e-mail)

## Milník 5 – Pilot

- [ ] Nasazení na VPS (Docker Compose, Caddy, zálohy, ověřená obnova)
- [ ] PWA (instalace na plochu firemních telefonů)
- [ ] Playwright testy hlavních scénářů (zápis dne, potvrzení, schválení, uzávěrka)
- [ ] Pilot na 3–5 lidech jeden měsíc, souběžně s Excelem

## Souběžně – příprava vozového parku

- [ ] Převod Traccaru z H2 na PostgreSQL
- [ ] Ověřit, která auta posílají skutečný tachometr (OBD) a která GPS odometr
- [ ] Vzorek dat z Traccaru za několik dní u 2–3 aut pro testy rozdělování jízd
