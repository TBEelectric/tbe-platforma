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
      zatím nemá vlastní obrazovku pro připínání (jen akce, UI v 3b.7).

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

- [x] **3b.6 – Mobil I: osa a úpravy**
      Mobile-first obrazovka Můj den (< 1024 px) podle `MobilOsa.dc.html`: svislá osa celého dne s automatickým posunem na
      pracovní dobu a podbarvenou nocí, podržet a táhnout = nový interval (nekoliduje se scrollem), klepnutí do mezery,
      úchyty a posun se společnou hranicí, kompaktní spodní panel (−/+ 5 min, Práce/Přestávka, smazat), zavření klepnutím
      mimo, přestávka s ikonou kávy a teplou barvou, optimistické ukládání přes akce z 3b.5. Zakázka zatím = naposledy použitá.
      Hotovo, když: den jde na telefonu poskládat a upravit tažením i tlačítky.
      Výsledek: Pod 1024 px se místo seznamu intervalů zobrazí `MobileTimeline` (`components/day/mobile-timeline.tsx`,
      stav a fronta ukládání v `use-timeline.ts`); desktop se nezměnil. Nová čistá logika s testy: `rules/timeline-view.ts`
      (56 px/h, popisky hodin, noc, výška bloku, počet řádků textu) a `rules/timeline-local.ts` (optimistické změny přes
      pravidla z 3b.4). Změny jdou na server po jedné přes `timelineAction`; rychlé klepání −/+ se nezahazuje, při chybě
      se den načte znovu a ukáže hláška. Rozhodl jsem sám: akce po úspěchu volá `revalidatePath` (hlavička se součty se
      aktualizuje v téže odpovědi; `router.refresh()` rušil probíhající akce); zakázka nového intervalu = první z
      `jobChipIds` (naposledy použitá, jinak zakázka party), bez ní hláška místo chyby serveru; úchyty jsou jen na vybraném
      bloku (44 px, přes okraj), blok se na dotyku vybere klepnutím a posouvá po podržení; důvod u zápisu za jiného je
      pole nad osou (ne dialog); `TimelineJob` má nově `active`. Ověřeno v náhledu 375 px myší; dotykové podržení
      (300 ms) a vibraci je nutné zkusit na skutečném telefonu (bod „Vývojové přihlášení…“ v milníku 5).

- [x] **3b.7 – Mobil II: zakázky a šablony**
      V panelu tlačítka naposledy použitých zakázek („Firma, místo“) a „Další zakázky…“ = výběr přes celou obrazovku
      (vyhledávání, sekce Naposledy použité / Zakázky party / Všechny aktivní, špendlík pro vedoucího), druh práce jako
      tlačítka; prázdný den („Můj obvyklý den“ / „Obvyklý den“, „Jako včera“), „Uložit jako můj obvyklý den“ s potvrzením,
      výchozí den, hlavička se součty, spodní navigace. Nový člen party vidí zakázky party jako tlačítka.
      Hotovo, když: celý mobilní zápis odpovídá prototypu (ověřeno v náhledu telefonu v prohlížeči).
      Výsledek: panel má přestávku, tlačítka zakázek a druhů práce; „Další zakázky…“ je celá obrazovka s hledáním a sekcemi, špendlík pro vedoucího (akce `pinTeamJobAction`); prázdný den má „Obvyklý den“ / „Jako včera“; „Uložit jako můj obvyklý den“ s potvrzením; den bez parametru se otevře na nejstarším nevyplněném dni. Špendlík jsem v náhledu neviděl (testovací účet nevede žádnou partu), ověřeno jen typově.

- [x] **3b.9 – Desktop: Můj den**
      Obrazovka Můj den (≥ 1024 px) podle `Den.dc.html`: vodorovná osa nad stejnou logikou, sbalená noc za
      šipkou ve sloupci/řádku časů jako na mobilu (viz design.md „Rozsah osy a sbalená noc“), čára „teď“, hover s časem, kartičky intervalů propojené s osou, panel vybraného intervalu
      (−/+, Přestávka, naposledy použité zakázky, combobox zakázek se sekcemi a špendlíkem, druh práce jako tlačítka) místo
      starého formuláře, pravý sloupec (součty po zakázkách, kontroly, měsíční výkaz), ovládání klávesnicí (šipky ±5 min).
      Sbalenou noc (šipka ve sloupci časů, automatické rozbalení podle dat, zachování pozice, poznámka
      „Noční práce“) doplnit i do mobilní osy z 3b.6 – mobilní osa teď končí o půlnoci a noc neumí zobrazit.
      Hotovo, když: desktop odpovídá prototypu, starý formulář „Přidat interval“ je odstraněný.
      Výsledek: Od 1024 px vybírá `ResponsiveTimeline` desktopovou osu (`desktop-timeline.tsx`), pod ním mobilní; obě
      sdílejí `useTimeline` (stav, ukládání, tlačítka zakázek, špendlík), `useNight` + `NightToggle` (sbalená noc) a čisté
      funkce v `rules/timeline-view.ts` (`nightState`, `shownRange`, `isNightEntry`, `nightBands`, 13 testů).
      Desktop: vodorovná osa s krokem 5 min, čára „teď“, hover s časem, kartičky intervalů propojené s osou, panel
      vybraného intervalu (−/+, Přestávka, tlačítka zakázek, combobox `job-combobox.tsx` se sekcemi a špendlíkem, druh
      práce, Smazat / Hotovo), klávesnice (←/→ = konec ±5 min, Shift+←/→ = začátek, Esc zruší výběr). Šipka noci je vedle
      osy (vlevo/vpravo; na mobilu nad 5:00 a pod 24:00), noc s daty se rozbalí sama, poznámka „Noční práce“ v panelu;
      na mobilu se při rozbalení nahoře zachová pozice 5:00. Smazáno: starý formulář a tabulka (`day-entries`,
      `entry-form`, `day-timeline`), akce `create/update/deleteTimeEntryAction`, `rules/forms`, `continueFrom`, služby
      v `time-entries.ts` a texty `timesheets.entries.*`. Rozhodl jsem sám: panel je pod osou vedle kartiček od 1280 px
      (užší okno ho dá nad kartičky); důvod zápisu za jiného je pole nad osou (jako na mobilu); příznak desktop/mobil
      je JS (`matchMedia`), první vykreslení je mobil. NEOVĚŘENO v prohlížeči (přihlášení jen přes Google, nešlo se
      přihlásit): vyzkoušet na desktopu kreslení tažením, okraje, posun, rozbalení noci šipkami, klávesy, combobox;
      na mobilu nahoře/dole rozbalení noci a udržení pozice.

- [x] **3b.10 – Dokončení milníku** [zastavit po]
      (1) Zamčený měsíc jen pro čtení na mobilu i desktopu: nejde kreslit, táhnout, vyplnit mezeru, upravovat v panelu,
      klávesy nic nemění, nejsou šablony ani „Uložit jako můj obvyklý den“, nahoře hláška „Měsíc je uzavřený“; logika
      „lze upravovat“ jako čistá funkce v `rules` s testem (server už zápis odmítá). (2) Tablet: kód zůstává na jedné
      hranici 1024 px (iPad na výšku = mobil, na šířku = desktop); v `docs/design.md` (Responzivita) opravit tabulku podle
      skutečnosti a čtením tříd ověřit, že ostatní obrazovky nejsou na 768–1023 px rozbité. (3) Přístupnost osy, panelu
      a výběru zakázky: `aria-label` u prvků bez textu (úchyty, šipka noci, špendlík, −/+, přestávka), role a
      `aria-selected` u bloků, viditelný fokus, na desktopu Tab na bloky a Enter = výběr, čitelný text na barevných blocích
      (čistá funkce s testem, pokud ještě není). (4) Úklid nepoužívaného kódu staré mobilní obrazovky a starého Můj den
      (komponenty, exporty, texty v `messages/cs.json`). (5) `docs/design.md`: sekce o ose a mobilu uvést do souladu
      s hotovým stavem (rozhodnutí z „Výsledek:“ 3b.4–3b.9); u statických maket `02-muj-den` a `06-mobil-den`
      v `docs/design/screens/` poznámka, že je nahradily prototypy v `docs/design/prototypes/` (PNG se negenerují).
      (6) Opravit zastaralé odkazy v milníku 3b: zadání 3b.6 „< 768 px“ → „< 1024 px“; „UI v 3b.8“ u 3b.3 → 3b.7;
      „krok 3b.8“ ve výsledku 3b.6 → bod „Vývojové přihlášení…“ v milníku 5.
      Mimo rozsah (přesunuto do milníku 5, až bude vývojové přihlášení): Playwright test zápisu dne a zkouška na
      iPhone Safari / Android Chrome. Nedělat Playwright, instalaci prohlížečů, PNG ani vývojové přihlášení.
      Hotovo, když: body 1–6 jsou hotové, lint/typecheck/test/build prochází; po kroku člověk vyzkouší v Chromu náhled
      telefonu, tabletu na výšku i na šířku a desktopu, zamčený měsíc a ovládání klávesnicí.
      Výsledek: Zamčený měsíc a den s celodenní absencí jsou jen pro čtení na mobilu i desktopu (čistá funkce `dayEditability`
      s testem, hláška „Měsíc je uzavřený“); osa má role `listbox`/`option` s `aria-selected`, viditelný fokus
      (globální `:focus-visible`) a čitelný text na blocích (`readableTextColor` s testy); úklid: `validateTimeEntry`
      a spol., akce `saveOwnDayTemplateAction`, text `timeline.readOnly`; `design.md` a odkazy v plánu opraveny. Ověřit v
      Chromu: náhled 375 px, tablet 768 px (mobil) a 1024 px (desktop), zamčený měsíc, Tab/Enter/šipky na ose. Rozhodl jsem
      sám: ostatní obrazovky na 768–1023 px jsem kontroloval jen čtením tříd (jednosloupcové, spodní navigace), ne v prohlížeči.

## Milník 4 – Měsíc, schválení, uzávěrka

Výsledek milníku: zaměstnanec vidí a potvrdí svůj měsíc, vedoucí ho schválí nebo vrátí, správce měsíc uzavře
a stáhne podklad pro mzdovou účetní; aplikace sama připomíná nevyplněné dny a lhůty.

Kroky jdou po sobě; každý se pouští v nové session (`scripts/milestone.sh 4`). **Kroky 4.1–4.5 jsou jen logika
a server (žádné obrazovky), kroky 4.6–4.9 jen obrazovky** nad hotovou logikou. Obrazovkový krok nesmí přidávat
obchodní pravidla: když nějaké chybí, doplní ho jako čistou funkci v `rules/` s testem a uvede to ve „Výsledek:“.
Značky jako v 3b: `[opus]`, `[zastavit po]`, `[ručně]`.
**Pořadí:** po 4.3 se dělají obrazovky 4.6, 4.6b (detail dne v Můj měsíc), 4.7, 4.8, pak 4.4 a 4.5 (zapojí tlačítka exportů a připomínek
na hotových obrazovkách), nakonec 4.9. Obrazovky do té doby ukazují tato tlačítka neaktivní s nápovědou.

**Právní rámec (zákoník práce; platí pro všechny kroky):**
- § 96 – evidence musí u každého zaměstnance (i DPP/DPČ) ukázat **začátek a konec** odpracované směny, práce
  přesčas, noční práce, pracovní pohotovosti a práce odvedené během pohotovosti. Přestávky se evidovat nemusí,
  ale firma musí doložit, že je poskytla. Zaměstnanec má právo nahlížet do své evidence a dostat kopii.
- Upozornění (přestávka § 88, 12 h § 83, odpočinek § 90 a § 92, limity dohod) **nikdy neblokují** uložení
  skutečného času – evidence musí odpovídat skutečnosti. Ukazují se v měsíci, při schválení a v exportu.
- Noc (22–6, § 78), sobota a neděle (§ 118) a svátek (§ 115) se počítají **podle kalendářního času** v
  Europe/Prague, ne podle `work_date`: interval pá 20:00 – so 2:00 má 2 h v pátek, 2 h v sobotu a 4 h noci.
  Kategorie se nevylučují (hodina v noci ze soboty na svátek je noc + sobota + svátek). Pozor na změnu času.
- Od 1. 10. 2023 mají **DPP a DPČ** nárok na příplatky za noc, víkend a svátek (ne za přesčas) – výpočty
  platí pro všechny typy úvazku. DPP: limit 300 h za kalendářní rok u firmy, počítá se jen odpracovaná doba
  (ne absence). DPČ: v průměru nejvýš polovina týdenní pracovní doby (20 h/týden) za dobu trvání dohody.
- **Pohotovost** (§ 78, § 95) není pracovní doba; práce během pohotovosti je odpracovaná doba. Pohotovost
  k odměně = pohotovost mimo odpracované intervaly; práce v pohotovosti se vykazuje zvlášť.
- **Svátek na pracovní den**, kdy se nepracovalo: u HPP/DPČ se vykáže jako „Svátek (neodpracováno)“ v hodinách
  denního úvazku – mzdová účetní z toho počítá náhradu mzdy u hodinové mzdy.
- **Přesčas** se pravidly pružné a nerovnoměrné doby (vyrovnávací období, rozvrh směn) zatím počítat nedá
  (otevřený bod s účetní). Rozhodnuto: „Rozdíl proti fondu“ je jen informace, **nikdy se nenazývá přesčas**.
  Přesčas se eviduje **označením intervalu** (`time_entry.overtime`), které nastavuje vedoucí nebo správce
  při schválení – tím je z evidence patrný začátek a konec přesčasu (§ 96).
- Fond je **orientační**: denní úvazek (týdenní hodiny / 5) × pracovní dny (po–pá bez svátků) podle úvazku
  platného v daný den; DPP fond nemá. V rozhraní se tak i označí („fond podle úvazku“).
- Měsíční podklad se po uzávěrce nemění: každá verze exportu je **uložený snímek** dat (ne nový výpočet
  ze živých dat), aby šla kdykoli znovu stáhnout přesně ta verze, kterou dostala účetní.

- [x] **4.1 – Výpočty měsíce (čisté funkce)** [opus]
      Nejdřív do `docs/technicky-navrh.md` doplnit právní rámec výše (slovník: přesčas = `overtime`, svátek
      neodpracovaný = `holiday_not_worked`, verze podkladu = `period_export`, připomínka = `reminder`; pravidla
      a tabulku výpočtů). Pak jen `src/modules/timesheets/rules` + testy: rozdělení intervalu podle kalendáře
      na noc / sobotu / neděli / svátek (DST, přes půlnoc, přes konec měsíce – interval patří měsíci podle
      `work_date`); fond měsíce a fond „k dnešku“ (změna úvazku v půlce měsíce, zkrácený úvazek, DPP bez fondu);
      svátek neodpracovaný; pohotovost mínus překryv s prací a práce v pohotovosti; absence po typech
      v hodinách (`absenceHours`); součty po zakázkách a druzích práce; přesčas = součet intervalů s příznakem;
      rozdíl proti fondu; souhrn upozornění měsíce (přestávka, 12 h, denní a týdenní odpočinek – týden přes
      hranici měsíce –, DPP roční limit, DPČ průměr 20 h/týden); stav dnů pro kalendář (vyplněno, chybí,
      absence, víkend, svátek, budoucí, dnes). Jedna funkce `monthSummary` vrací vše, co potřebuje Můj měsíc,
      Schvalování, Uzávěrka i export. Nové prahy do `timesheet_settings` (seed + `resolveSettings`):
      `dpc_weekly_average_limit_hours` (20), lhůty `confirm_deadline_day` (2), `approve_deadline_day` (5),
      `close_deadline_day` (7) a `reminder_time` ("07:00").
      Hotovo, když: testy pokrývají každé pravidlo včetně DST, přes půlnoc, svátku v sobotu, změny úvazku a DPP;
      žádné UI.
      Výsledek: hotové `rules/calendar-split.ts` (noc / sobota / neděle / svátek podle kalendářního času, DST),
      `fund.ts` (fond měsíce a k dnešku, svátek neodpracovaný), `standby.ts` (pohotovost k odměně a práce
      v pohotovosti), `totalsByWorkType` a `overtimeMinutes` v `totals.ts` a `month-summary.ts` (`monthSummary`
      + stav dnů + upozornění měsíce; kontroly měsíce jsou seznam `MONTH_CHECKS`, nová kontrola = jedna funkce).
      Nová nastavení v `resolveSettings` a seedu; `settings.fixture.ts` pro testy. Právní rámec, slovník a tabulka
      výpočtů v `technicky-navrh.md`. Vyzkoušet: nic v UI; po `pnpm db:seed` jsou v `timesheet_settings` nové klíče.
      Rozhodl jsem: svátek neodpracovaný jen bez jakékoli práce toho dne (i noční směny zasahující do svátku);
      rozdíl proti fondu = odpracováno + schválené absence do dneška − fond do dneška (vychází −6:00 jako v náhledu);
      DPP upozorní až nad limitem; DPČ průměr od začátku dohody do jejího konce (bez konce do konce měsíce)
      podle DPČ platné v měsíci; pohotovost patří měsíci podle dne začátku; stav dne `free` pro minulý den bez
      povinnosti (DPP); hodiny z předchozích měsíců pro DPP/DPČ dostává `monthSummary` jako vstup (načte 4.2).

- [x] **4.2 – Data měsíce a pohotovost (server)**
      Migrace: `time_entry.overtime` (boolean, výchozí false), tabulka `period_export` (month, version, created_at,
      created_by, `data` jsonb = snímek pro export), tabulka `reminder_log` (employee_id, kind, ref_date, sent_at;
      unikátní employee+kind+ref_date). Služba `getMonth(employeeId, month)` (jedno načtení: intervaly, absence,
      pohotovosti, svátky, úvazky, nastavení, stav výkazu a uzávěrky → `monthSummary`) a `getTeamMonth(month,
      teamIds | all)` pro schvalování a uzávěrku. Server akce pohotovosti vytvořit / upravit / smazat:
      zaměstnanec sám v otevřeném měsíci, vedoucí a správce za jiného s důvodem, zamčený měsíc odmítne, překryv
      vlastních pohotovostí odmítne (překryv s prací je povolený), audit. Akce „označit interval jako přesčas /
      zrušit“ (jen vedoucí své party a správce, i u potvrzeného výkazu před schválením; audit s důvodem).
      Seed: pohotovost o víkendu a jeden interval s přesčasem u ukázkových zaměstnanců.
      Hotovo, když: akce mají testy oprávnění a zámku; `getMonth` ověřen proti lokální DB.
      Výsledek: migrace `0009_month_data` (`time_entry.overtime`, `period_export`, `reminder_log`); `month-data.ts`
      s `getMonth(viewer, employeeId, month)` a `getTeamMonth(viewer, month, teamIds | "all")` (každá tabulka se
      načte jednou pro všechny, hodiny DPP od 1. 1. a DPČ od začátku dohody jedním dotazem → `monthSummary`, k tomu
      stav výkazu, zámek, intervaly, pohotovosti, popisky zakázek a druhů práce); `standbys.ts` + akce
      `create/update/deleteStandbyAction` a `setOvertimeAction`; pravidla `rules/month-changes.ts` s testy.
      Ověřeno skriptem proti lokální DB (říjen 2026): Jan Novák odpracováno 86:30, fond 168:00, k dnešku 88:00,
      rozdíl −1:30, pohotovost 40:00 (k odměně 37:30, práce v pohotovosti 2:30), přesčas 2:30; `getTeamMonth`
      pro správce 14 zaměstnanců za 44 ms, vedoucí vidí jen svou partu, kolega dostane `null`; odmítnutí překryvu,
      zámku, chybějícího důvodu, přesčasu u přestávky a u schváleného výkazu fungují.
      Vyzkoušet: po `pnpm db:seed` má Jan Novák a Petr Svoboda víkendovou pohotovost (so 6:00 – ne 22:00) a Jan
      v sobotu výjezd 9:00–11:30 označený jako přesčas; v UI zatím nic (obrazovky 4.6–4.8).
      Rozhodl jsem: smazání pohotovosti je skutečné (zůstává v auditu); pohotovost za jiného smí vedoucí, správce
      i administrátor (jako intervaly); přesčas označí jen vedoucí party a správce, nikdo sám sobě, jen u práce,
      ve stavu otevřený nebo potvrzený; pohotovost se zamyká podle měsíce svého začátku (u úpravy starý i nový
      měsíc); `getMonth` vrací `null` bez oprávnění; parta v měsíci = poslední členství v měsíci.

- [x] **4.3 – Stavy výkazu a uzávěrka (pravidla a server)** [opus]
      Čistá funkce přechodů podle „Stavy výkazu“ v `technicky-navrh.md` s testy: kdo smí, za jakých podmínek,
      hláška při odmítnutí. Potvrdit (zaměstnanec, nejdřív 1. den dalšího měsíce, bez chybějících pracovních dnů,
      bez nerozhodnutých žádostí o absenci v měsíci); schválit (vedoucí své party, správce kohokoli; nikdo sám
      sebe – výkaz vedoucího schvaluje správce, výkaz správce jiný správce, je-li jediný, schválí si ho sám a audit
      to označí); vrátit s povinným důvodem (zpět na otevřený, důvod se ukáže zaměstnanci); hromadně schválit
      výkazy bez upozornění; uzavřít měsíc (správce; všechny výkazy zaměstnanců s docházkou a úvazkem v měsíci
      schválené, žádné nerozhodnuté absence) → výkazy `closed`, uloží se snímek `period_export` verze n; znovu
      otevřít (správce, povinný důvod, výběr zaměstnanců, jejichž výkazy se vrátí na otevřený, ostatní zůstanou
      schválené) → nové uzavření = verze n+1. Kontroly před uzávěrkou jako čistá funkce (seznam položek
      ok / chyba / info podle `05-uzaverka`). Server akce s oprávněními, auditem v jedné transakci a událostmi
      pro e-mail (fronta pro 4.5, zatím jen zápis).
      Hotovo, když: všechny přechody a odmítnutí jsou otestované; zámek intervalů a absencí po potvrzení platí.
      Výsledek: pravidla `rules/timesheet-transitions.ts` (`timesheetTransition` pro potvrdit / schválit / vrátit,
      `approverCheck`, `bulkApprovable`) a `rules/period-close.ts` (`periodCloseChecks` podle 05-uzaverka:
      schválené výkazy, absence, chybějící dny jako chyba, upozornění jen jako info; `periodCloseError`,
      `periodReopenError`, `reopenedStatus`, `nextExportVersion`) s testy. Služba `timesheet-flow.ts`:
      `changeTimesheet`, `bulkApproveTimesheets`, `getPeriodState`, `closePeriod`, `reopenPeriod`, vše v jedné
      transakci se zámkem řádku, auditem a oznámeními. Server akce `confirmTimesheetAction`,
      `decideTimesheetAction` (approve / return), `bulkApproveAction`, `closePeriodAction`, `reopenPeriodAction`.
      Migrace `0010_notification` (fronta e-mailů pro 4.5). Snímek `period_export` = celý `getTeamMonth("all")`
      (souhrny, intervaly, absence, pohotovosti, zůstatek dovolené, popisky, kontroly; `format: 1`), `MonthView`
      nově nese i absence měsíce. Zámek: stávající `isMonthLocked` už zamyká intervaly, absence i pohotovost
      od potvrzení a vrácením odemyká, takže jsem ho jen pokryl testy. Ověřeno skriptem na kopii lokální DB
      (říjen 2026, „dnes“ 3. 11.): potvrzení před koncem měsíce / s chybějícími dny odmítnuto; po potvrzení
      pohotovost odmítnuta, po vrácení jde zapsat; vrácení bez důvodu i cizím vedoucím odmítnuto; vedoucí
      ani správce (je-li jiný) si sám neschválí; uzávěrka s neschválenými odmítnuta, pak verze 1; znovuotevření
      jen pro Petra (ostatní zůstanou schválení a zamčení), znovu uzavřeno jako verze 2; jediný správce si
      schválil vlastní výkaz s `selfApproval: true` v auditu; oznámení `timesheet_returned` / `timesheet_reopened`
      zapsaná s prázdným `sent_at`.
      Vyzkoušet: zatím nic v UI (obrazovky 4.6–4.8); po `pnpm db:migrate` existuje tabulka
      `timesheets.notification`.
      Rozhodl jsem: vrátit jde potvrzený i schválený výkaz až do uzávěrky (tvoje rozhodnutí); potvrzuje jen
      zaměstnanec sám; administrátor bez role správce neschvaluje; výkaz vedoucího i správce schvaluje správce;
      chybějící dny jsou v kontrole před uzávěrkou chyba; uzavřít jde až po skončení měsíce; při znovuotevření
      je nutné vybrat aspoň jednoho zaměstnance a důvod se mu ukáže jako důvod vrácení; potvrzení smaže starý
      důvod vrácení; e-mailová oznámení se zapisují jen při vrácení a znovuotevření (při potvrzení a uzávěrce
      zatím ne, připomínky lhůt řeší 4.5).

- [ ] **4.4 – Exporty (server)**
      Ze snímku `period_export` (jen uzavřený měsíc, vybraná verze): XLSX pro mzdy – list Souhrn (řádek na
      zaměstnance: osobní číslo, jméno, úvazek, fond, odpracováno, přesčas, noc, sobota, neděle, svátek odpracovaný,
      svátek neodpracovaný, pohotovost, práce v pohotovosti, absence po typech, zůstatek dovolené, upozornění),
      list Intervaly (každý interval s od–do, zakázkou s číslem, druhem práce, příznakem přesčasu), list Absence
      (typ, od–do, hodiny – účetní potřebuje data kvůli nemocenské), list Pohotovost (od–do). PDF: výkaz na
      zaměstnance (jedna stránka/oddíl na osobu, hlavička firmy, měsíc, verze, tabulka dnů, součty), i jako
      jeden soubor za všechny. Vlastní PDF zaměstnance z živých dat pro Můj měsíc s označením „Pracovní verze –
      neuzavřeno“, dokud měsíc není uzavřený. CSV hodin po zakázkách za libovolné období (středník, UTF-8 s BOM,
      podle prototypu). Hlavičky a texty přes `next-intl`, čeština s diakritikou v PDF (vložené písmo Figtree).
      Route handlery s `requireUser()` a oprávněním (mzdový export jen správce; vlastní PDF jen zaměstnanec,
      jeho vedoucí a správce). Knihovny vyber aktuální a udržované (např. exceljs, pdfkit / @react-pdf/renderer).
      Hotovo, když: data řádků exportu jsou čisté funkce s testy; soubory se vygenerují a otevřou (ověřit
      jednorázovým skriptem); stejná verze dá stejná data i po změně živých dat.
      Zapojit tlačítka na hotových obrazovkách: Stáhnout PDF v Můj měsíc (4.6), Stáhnout XLSX / PDF, verze
      uzavřených měsíců a Export hodin podle zakázek (CSV) v Uzávěrce (4.8).

- [ ] **4.5 – Připomínky a e-maily (worker)**
      `src/worker.ts`: plánovač v jednom procesu (každý den v `reminder_time`, Europe/Prague, jen pracovní dny):
      (a) nevyplněný včerejší pracovní den (podle `missingWorkdays`, bez DPP, bez absence, jen aktivní
      zaměstnanci s docházkou), (b) potvrzení měsíce 1. a v den `confirm_deadline_day`, (c) vedoucím a správci
      čekající schválení před `approve_deadline_day`, (d) správci den před `close_deadline_day`. E-mail i při
      vrácení výkazu (zaměstnanci). Ruční akce „Připomenout“ (jednomu zaměstnanci / všem chybějícím) pro vedoucí
      a správce. Každé odeslání zapíše `reminder_log` (nic se nepošle dvakrát). Odesílání přes SMTP (`SMTP_*`
      do `.env.example`); bez `SMTP_HOST` se e-mail jen vypíše do logu. Texty e-mailů přes `next-intl` podle
      `user.locale`, odkaz rovnou na den / měsíc.
      Hotovo, když: výběr příjemců je čistá funkce s testy (víkend, svátek, absence, DPP, už odesláno);
      `pnpm worker` běží a bez SMTP vypíše e-maily do logu.
      Zapojit tlačítka na hotových obrazovkách: Připomenout ve Schvalování (4.7) a Připomenout chybějícím
      v Uzávěrce (4.8).

- [x] **4.6 – Obrazovka Můj měsíc** [zastavit po]
      Podle `docs/design/screens/03-muj-mesic.png` (desktop) nad `getMonth` a akcemi z 4.2–4.3: hlavička (měsíc,
      stav, úvazek, fond podle úvazku), přepínání měsíců, karty Odpracováno / Absence / Rozdíl proti fondu /
      Pohotovost, kalendář (hodiny a druhy práce, chybí, dnes, víkend, svátek s názvem, absence, pohotovost;
      klik na den = Můj den daného dne), lišta „Měsíc půjde potvrdit od … / Doplnit …“, pravý sloupec Podle
      zakázek („Firma, místo“, ne číslo), Podle druhu práce, Průběh schválení, Upozornění měsíce; tlačítka
      Potvrdit měsíc (s potvrzovacím dialogem) a Stáhnout PDF. Vrácený výkaz: nahoře hláška s důvodem.
      Pohotovost: přidat / upravit / smazat z detailu dne v kalendáři (panel jako na Můj den). Mobil (< 1024 px):
      karty 2×2, kompaktní kalendář (číslo dne a hodiny, barva stavu), seznamy pod ním, Potvrdit měsíc jako
      tlačítko dole nad spodní navigací; položka „Měsíc“ ve spodní navigaci. Odstranit placeholder `month`.
      Stáhnout PDF zatím neaktivní s nápovědou (zapojí 4.4).
      **Měsíc jiného zaměstnance:** výběr zaměstnance nahoře (stejný vzor jako „Zapsat za jiného“ na Můj den,
      URL `/timesheets/month?employee=<id>`). Kdo smí: vedoucí za svou partu, správce docházky a administrátor
      za všechny (oprávnění „Vidět výkazy jiných“ z `technicky-navrh.md` jako čistá funkce s testem, kontrola na
      serveru). U cizího měsíce není „Potvrdit měsíc“; úpravy pohotovosti a odkaz na den jen podle
      `canWriteTimeFor`, jinak jen pro čtení. Účet bez vlastní docházky (administrátor) vidí v menu „Měsíc
      zaměstnance“ a začne výběrem.
      Hotovo, když: obrazovka odpovídá náhledu na desktopu a funguje na 375 px; potvrzení zamkne Můj den;
      vedoucí vidí měsíce své party, správce a administrátor všech, zaměstnanec jen svůj (i přes URL).
      Výsledek: stránky `/timesheets/month` (vlastní i `?employee=`, `?month=YYYY-MM-01`) a `/timesheets/month/someone`
      (výběr zaměstnance; v menu „Měsíc zaměstnance“ pro účet bez vlastní docházky), komponenty
      `components/month/` (`MonthScreen`, `ConfirmMonth`, `StandbyPanel`), texty `timesheets.month.*`, placeholder
      `month` odstraněn. Nové pravidlo nebylo potřeba: „Vidět výkazy jiných“ už je `canViewTimeOf` s testem
      a kontroluje ho `getMonth` (cizí bez práva → 404). Potvrzení bere stav z `timesheetTransition("confirm")`
      (před koncem měsíce tlačítko „Potvrdit od 1. 11.“, důvod v nápovědě; lišta jen s chybějícími dny a „Doplnit“); Stáhnout PDF je neaktivní s nápovědou.
      Ověřeno: lint, typecheck, 408 testů, build; skriptem proti lokální DB (říjen 2026) zaměstnanec vidí jen svůj
      měsíc, vedoucí svou partu (5), správce a administrátor všech (13); české texty projdou ICU s reálnými hodnotami.
      NEOVĚŘENO v prohlížeči (přihlášení jen přes Google). Vyzkoušet ručně: desktop proti `03-muj-mesic.png`
      a 375 px (karty 2×2, kompaktní kalendář, Potvrdit měsíc nad spodní navigací); klik na den otevře Můj den;
      pohotovost přidat / upravit / smazat (u cizího s důvodem); vedoucí → „Měsíc jiného“ → člen party (jen
      pro čtení u cizí party nejde otevřít); zaměstnanec s cizím `?employee=` dostane 404; po potvrzení
      (od 1. 11.) je Můj den zamčený.
      Rozhodl jsem: buňka kalendáře je odkaz na Můj den (podle náhledu), pohotovost se spravuje v kartě
      „Pohotovost“ v pravém sloupci (panel se seznamem měsíce a tlačítkem Přidat), ne v detailu dne – zadání
      chtělo obojí; karta Upozornění se ukáže jen při upozorněních měsíce.

- [ ] **4.6b – Můj měsíc: detail dne v kalendáři** [zastavit po]
      Jediná změna proti hotové 4.6: klik na den v kalendáři už nepřesměruje na Můj den, ale otevře detail dne.
      Vše ostatní na obrazovce (hlavička, karty, kalendář a jeho buňky, lišta, pravý sloupec, potvrzení, měsíc
      jiného zaměstnance, mobilní rozložení) zůstává beze změny. Server, `getMonth` a pravidla se nemění: detail
      bere data, která už `MonthView` vrací (`entries`, `absences`, `standbys`, `summary.days`, upozornění
      s datem). Vzor: `docs/design/screens/03b-muj-mesic-detail-dne.html` (přepínače Situace a Šířka nahoře).
      Obsah detailu: datum a stav dne (Vyplněno / Chybí záznam / Svátek / Víkend / Bez záznamu, Dnes), rozsah
      od–do; součty Práce, Přestávky, Absence (jen nenulové); malá osa dne v barvách zakázek (přestávky
      béžové, absence šrafovaně); seznam intervalů jen pro čtení jako pod osou v Můj den (od–do, zakázka
      s číslem a „Firma, místo“, druh práce, poznámka, doba; přestávky a absence jako řádky); pohotovost dne
      s „Upravit“, které otevře stávající panel pohotovosti (jen když smí upravovat pohotovost jako dnes);
      upozornění dne. Dole jedno tlačítko „Otevřít celý den“ (u chybějícího dne „Doplnit den“) = dosavadní
      odkaz na Můj den včetně `?employee=`. Hlavička detailu má ‹ › (předchozí / další den v měsíci) a zavřít.
      Desktop (≥ 1024 px): plovoucí panel ~390 px se šipkou na den, vždy **pod vybraným dnem**, vodorovně
      vycentrovaný na den a držený uvnitř bloku kalendáře; když se pod den nevejde, otevře se **nad ním**;
      když se nevejde ani tam, jde na stranu s víc místa a seznam intervalů se posouvá uvnitř (tlačítko
      zůstane vidět, panel ukáže aspoň ~4 intervaly, smí kousek přečnívat pod kalendář). Vybraný den má
      zvýraznění. ←/→ přepíná dny, Esc a klik mimo zavře a vrátí fokus na buňku.
      Mobil (< 1024 px): stejný obsah ve spodním panelu (max. ~¾ výšky, ztmavené pozadí), tlačítko přes celou
      šířku dole, klepnutí mimo zavře – stejný vzor jako spodní panel na ose dne.
      Zamčený měsíc: hláška se zámkem, tlačítko „Otevřít den (jen pro čtení)“, bez „Upravit“ u pohotovosti.
      Měsíc jiného zaměstnance: jméno v hlavičce detailu; s `canWriteTimeFor` tlačítko jako u vlastního, bez
      něj detail jen pro čtení bez tlačítka s nápovědou, kdo den může otevřít (dnes takový den nejde otevřít
      vůbec). Buňka se stává tlačítkem (`aria-haspopup="dialog"`, `aria-expanded`), panel je dialog.
      Nové texty v `timesheets.month.*` (cs i ostatní jazyky jako dosud).
      Hotovo, když: klik na den otevře detail se správnými intervaly a součty, které odpovídají buňce
      a Můj den; poloha panelu podle pravidel výše na desktopu i 375 px; nic jiného na obrazovce se nezměnilo;
      lint, typecheck, testy a build projdou.

- [ ] **4.7 – Obrazovka Schvalování**
      Podle `04-schvalovani.png`: měsíc (výchozí minulý), parta (vedoucí vidí své party, správce všechny + výběr),
      lhůta „schválit do …“, karty počtů, záložky Všechny / Ke schválení / S upozorněním / Schválené, tabulka
      (zaměstnanec, úvazek, odpracováno, rozdíl, noc+víkend, absence, upozornění, stav; nepotvrzený má
      „Připomenout“). Detail vpravo: stav, upozornění s daty, podle zakázek, přesčas, odkaz „Otevřít všechny
      intervaly a historii změn“ (Můj den zaměstnance jen pro čtení + audit), u intervalů přepínač „Přesčas“,
      důvod vrácení, Schválit / Vrátit k opravě, hromadně „Schválit N bez upozornění“. Poznámka „Váš vlastní
      výkaz schvaluje správce docházky“. Mobil: seznam karet místo tabulky, detail přes celou obrazovku.
      Odstranit placeholder `approval`.
      Hotovo, když: vedoucí projde schválení i vrácení na desktopu i 375 px.

- [ ] **4.8 – Obrazovka Uzávěrka a nastavení lhůt**
      Podle `05-uzaverka.png`: hlavička se stavem a lhůtou, Připomenout chybějícím, Uzavřít měsíc (dialog se
      souhrnem kontrol, aktivní jen když kontroly projdou), karty počtů, Kontrola před uzávěrkou, Stav podle
      part (průběh, „čeká na vás“), Podklad pro mzdy (XLSX, PDF; před uzávěrkou neaktivní s vysvětlením),
      Export hodin podle zakázek (CSV, výběr období), Uzavřené měsíce s verzemi, stažením každé verze a
      Znovu otevřít (dialog: důvod, výběr zaměstnanců). Nastavení modulu (`/timesheets/settings`, správce): lhůty
      a čas připomínek z 4.1 (zápis nové hodnoty s `valid_from`, audit). Mobil: jednosloupcové.
      Odstranit placeholdery `close` a `settings`.
      Hotovo, když: správce uzavře, stáhne, znovu otevře a uzavře znovu jako verzi 2.

- [ ] **4.9 – Dokončení milníku** [zastavit po]
      (1) Launcher „Čeká na vás“ podle `01-launcher.png` (doplnit chybějící den, potvrdit měsíc, schválit N výkazů,
      uzavřít měsíc) z dat 4.2–4.3. (2) Můj den: vrácený výkaz ukáže důvod; potvrzený měsíc hlášku „Měsíc je
      potvrzený“ (rozšířit `dayEditability`). (3) Přístupnost nových obrazovek (aria-label u ikon, fokus, tabulka
      s hlavičkami, dialogy). (4) `docs/design.md` (seznam obrazovek a mobilní rozložení měsíce, schvalování,
      uzávěrky) a `docs/zadani-dochazky.md` (otevřené body: přesčas, rozvrh, vyrovnávací období) uvést do
      souladu s hotovým stavem. (5) Úklid: `[section]` placeholder, pokud už nic nepokrývá.
      Hotovo, když: lint/typecheck/test/build prochází; člověk vyzkouší celý cyklus otevřený → potvrzený →
      vrácený → potvrzený → schválený → uzavřený → export → znovu otevřený → verze 2 v Chromu na desktopu i 375 px.

## Milník 5 – Pilot

- [ ] **Vývojové přihlášení a přístup z telefonu v domácí síti** (přesunuto z 3b.8; mobil se zatím testuje v náhledu telefonu v Chromu)
      Bez tunelu a bez Google Console. (1) **Vývojové přihlášení:** na přihlašovací stránce navíc „Přihlásit jako…“
      se seznamem aktivních zaměstnanců (jméno, role); vytvoří normální Better Auth session daného uživatele. Funguje jen
      při `NODE_ENV=development` **a** `DEV_LOGIN=true` v `.env` (do `.env.example` zakomentovaně); jinak route i tlačítko
      neexistují / vrací 404. Test, který ověří, že bez obou podmínek přihlášení nejde. (2) **Přístup z telefonu:**
      skript `pnpm dev:lan` spustí Next.js na `0.0.0.0` a vypíše adresu `http://<IP Macu>:3000`; `BETTER_AUTH_URL`
      / povolené originy Better Auth upravit tak, aby fungovaly i z IP adresy v síti (jen ve vývoji). Postup do `CLAUDE.md`.
      PWA instalace a HTTPS až s nasazením na VPS (milník 5).
      Hotovo, když: na telefonu ve stejné Wi-Fi jde otevřít aplikaci a přihlásit se „jako“ ukázkový zaměstnanec;
      v produkčním buildu vývojové přihlášení neexistuje. Po kroku člověk vyzkouší mobilní
      zápis (kroky 3b.6–3b.7) na skutečném telefonu.
- [ ] Nasazení na VPS (Docker Compose, Caddy, zálohy, ověřená obnova)
- [ ] PWA (instalace na plochu firemních telefonů)
- [ ] Playwright testy hlavních scénářů (zápis dne, potvrzení, schválení, uzávěrka)
- [ ] Pilot na 3–5 lidech jeden měsíc, souběžně s Excelem

## Souběžně – příprava vozového parku

- [ ] Převod Traccaru z H2 na PostgreSQL
- [ ] Ověřit, která auta posílají skutečný tachometr (OBD) a která GPS odometr
- [ ] Vzorek dat z Traccaru za několik dní u 2–3 aut pro testy rozdělování jízd
