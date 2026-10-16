# Technický návrh jádra a docházky

První verze obsahuje společné jádro (přihlášení, zaměstnanci, týmy, zakázky) a modul docházky
s intervaly od–do, měsíčním potvrzením, schválením vedoucím a exportem pro mzdovou účetní.

## Slovník

Kód, databáze a API používají anglické názvy podle této tabulky; rozhraní a dokumenty jsou česky.
Nový pojem se nejdřív zapíše sem.

| Česky | V kódu | Význam |
| --- | --- | --- |
| Zaměstnanec | `employee` | Osoba v evidenci (HPP, DPP, DPČ); nemusí mít přihlášení |
| Eviduje docházku | `tracks_time` | Zaměstnanec vykazuje docházku; vypnuté u účtů bez docházky (např. administrátor mimo firmu) |
| Uživatel | `user` | Přihlašovací účet (Google), navázaný na zaměstnance |
| Pracovní poměr | `employment` | Typ úvazku a platnost od–do |
| Tým / parta | `team` | Skupina zaměstnanců s vedoucím |
| Vedoucí | `team_lead` | Schvaluje výkazy svého týmu |
| Zákazník | `customer` | Odběratel zakázek |
| Zakázka | `job` | Číslo, název, místo a zákazník; v rozhraní se zobrazuje jako „Firma, místo“ |
| Místo | `site` | Sídlo, sklad, stavba, adresa zákazníka |
| Druh práce | `work_type` | Montáž, revize, cesta, režie |
| Interval | `time_entry` | Úsek od–do: práce na zakázce, nebo přestávka |
| Absence | `absence` | Dovolená, nemoc, OČR, lékař |
| Žádost o absenci | `absence.status = requested` | Absence podaná zaměstnancem, čeká na schválení (`approved`) nebo zamítnutí (`rejected`) |
| Celodenní absence | `absence.hours is null` | Absence na celé dny; s `hours` jde o část jednoho dne (např. lékař) |
| Pohotovost | `standby` | Pracovní pohotovost od–do |
| Práce v pohotovosti | `standby_work` | Odpracovaná doba, která se překrývá s pohotovostí; vykazuje se zvlášť |
| Přesčas | `overtime` (`time_entry.overtime`) | Interval označený vedoucím nebo správcem při schválení jako práce přesčas |
| Svátek neodpracovaný | `holiday_not_worked` | Svátek na pracovní den, kdy zaměstnanec (HPP, DPČ) nepracoval; hodiny denního úvazku |
| Fond (orientační) | `fund` | Denní úvazek × pracovní dny (po–pá bez svátků) podle úvazku platného v daný den; DPP fond nemá |
| Rozdíl proti fondu | `fund_difference` | Odpracováno + absence − fond k dnešku; jen informace, **nikdy se nenazývá přesčas** |
| Měsíční výkaz | `timesheet` | Měsíc jednoho zaměstnance se stavem schválení |
| Uzávěrka | `period_close` | Uzavření měsíce pro všechny zaměstnance |
| Verze podkladu | `period_export` | Uložený snímek dat měsíce pro mzdovou účetní; každé uzavření = nová verze |
| Připomínka | `reminder` | E-mail o nevyplněném dni nebo lhůtě; odeslání se zapisuje do `reminder_log` |
| Oznámení | `notification` | Událost pro e-mail zapsaná spolu se změnou (vrácený výkaz, znovu otevřený měsíc); odešle ji worker |
| Samoschválení | `self_approval` | Jediný správce docházky schválil vlastní výkaz; audit to označí |
| Zakázky party | `team_job` | Zakázky připnuté vedoucím pro rychlý výběr |
| Šablona dne | `day_template` | „Obvyklý den“ zaměstnance pro rychlé vyplnění |
| Fond pracovní doby | `work_schedule` | Plánovaná doba a režim (pružná, nerovnoměrná) |
| Nárok na dovolenou | `leave_entitlement` | Roční nárok a zůstatek v hodinách |
| Historie změn | `audit_log` | Kdo, kdy, co a původní hodnota |
| Modul | `module` | `timesheets`, `fleet`, … |

## Datový model

Každá tabulka má `id` (UUID), `created_at`, `updated_at`; záznamy se nemažou, ale archivují (`archived_at`).
Sazby se zatím neevidují, `employment` i `job` je mohou dostat později.

### Jádro (`core`)

| Tabulka | Klíčová pole | Poznámka |
| --- | --- | --- |
| `user` | email, name, employee_id, locale (výchozí `cs`) | Vytváří Better Auth; přihlásí se jen aktivní zaměstnanec s tímto e-mailem, propojení podle e-mailu |
| `employee` | first_name, last_name, personal_number, email, active, tracks_time | Základ pro všechny moduly; e-mail = povolený účet |
| `employment` | employee_id, type (`hpp`,`dpp`,`dpc`), valid_from, valid_to, weekly_hours, schedule_type (`flexible`,`uneven`) | Výpočty berou úvazek platný v daný den |
| `team` | name, lead_employee_id | Parta s vedoucím |
| `team_member` | team_id, employee_id, valid_from, valid_to | Členství s historií |
| `role_assignment` | employee_id, module, role | Role po modulech; přiřazuje se zaměstnanci, aby šla zadat před prvním přihlášením |
| `customer` | name, ico, external_id | |
| `job` | code, name, customer_id, site_id, color, status (`active`,`closed`), external_id | Místo (`site_id`) povinné; `color` volitelná (prázdná = odvozená z id); v rozhraní se zakázka zobrazuje jako **„Firma, místo“**, číslo jen ve vyhledávání, správě a exportech |
| `site` | name, type, address, lat, lng, customer_id | `name` = krátký název místa pro montéry („Jihlava, hala A“); použije i vozový park |
| `team_job` | team_id, job_id, pinned_by, pinned_at | „Zakázky party“ – vedoucí připne zakázky, které parta právě dělá; unikátní (team_id, job_id); uzavřené zakázky se nezobrazují; změny do auditu |
| `public_holiday` | date, name | Státní svátky ČR, generované na roky dopředu |
| `audit_log` | actor_user_id, entity, entity_id, action, before, after, reason, at | |

### Docházka (`timesheets`)

| Tabulka | Klíčová pole | Poznámka |
| --- | --- | --- |
| `work_type` | code, name, counts_as_work, requires_job | Montáž, revize, cesta (se zakázkou), režie (bez zakázky) |
| `time_entry` | employee_id, work_date, start_at, end_at, kind (`work`,`break`), job_id, work_type_id, note, overtime, created_by_user_id, source (`self`,`manager`) | Práce vyžaduje druh práce a zakázku; druh „režie“ (`requires_job = false`) zakázku nevyžaduje. `work_date` = den začátku (Europe/Prague). Smazání v otevřeném měsíci je skutečné, zůstává v auditu. `overtime` (výchozí false) nastavuje vedoucí nebo správce |
| `absence` | employee_id, type (`vacation`,`sick`,`ocr`,`doctor`,`other`), date_from, date_to, hours, note, status (`requested`,`approved`,`rejected`), decided_by, decided_at, decision_reason | `hours` jen u jednoho dne (část dne); bez `hours` celé dny podle úvazku. Absenci zadanou vedoucím nebo správcem rovnou schválí |
| `standby` | employee_id, start_at, end_at, note, created_by_user_id | Patří měsíci podle dne začátku. Vlastní pohotovosti se nepřekrývají (výjimkové omezení), překryv s prací je povolený. Smazání v otevřeném měsíci je skutečné, zůstává v auditu |
| `leave_entitlement` | employee_id, year, hours_entitled, hours_carried_over | Zůstatek = nárok + převod − čerpáno |
| `timesheet` | employee_id, month, status, confirmed_at, approved_by, approved_at, return_reason | Jeden řádek na zaměstnance a měsíc |
| `period_close` | month, closed_by, closed_at, reopened_by, reopened_at, reopen_reason, export_version | |
| `period_export` | month, version (unikátně s month), created_at, created_by_user_id, data (JSON) | Snímek dat podkladu pro mzdy při každém uzavření; exporty čtou jen snímek |
| `reminder_log` | employee_id, kind, ref_date, sent_at (unikátně employee_id + kind + ref_date) | Odeslané připomínky; nic se nepošle dvakrát |
| `notification` | employee_id (příjemce), kind (`timesheet_returned`, `timesheet_reopened`), month, data (JSON: důvod…), created_by_user_id, created_at, sent_at | Fronta e-mailů: zapisuje se ve stejné transakci jako změna, odesílá worker (prázdné `sent_at` = čeká) |
| `timesheet_settings` | key, value, valid_from | Prahy a limity; výchozí šablona „Obvyklý den“ |
| `day_template` | employee_id (unikátní), items (JSON: od, do, typ `work`/`break`), updated_at | „Můj obvyklý den“ – ukládá zaměstnanec sám z vyplněného dne; správce může smazat; bez něj platí výchozí šablona firmy z `timesheet_settings`; změny do auditu |

## Stavy výkazu

```
otevřený (open) ──potvrdí zaměstnanec──▶ potvrzený (confirmed) ──schválí vedoucí──▶ schválený (approved)
     ▲                                        │                                          │
     └──────── vedoucí vrátí s důvodem ───────┘                       uzávěrka (správce, všechny schválené)
     ▲                                                                                   ▼
     └──────────── správce znovu otevře s důvodem (nová verze exportu) ─────────── uzavřený (closed) ──▶ export
```

Od potvrzení jsou intervaly, absence i pohotovost zamčené; vrácením se výkaz znovu odemkne.
Uzávěrku lze provést, až jsou všechny výkazy měsíce schválené. Pravidla: `rules/timesheet-transitions.ts`
a `rules/period-close.ts`.

- **Potvrdit:** jen vlastní výkaz, nejdřív 1. den dalšího měsíce, bez chybějících pracovních dnů a bez
  nerozhodnutých žádostí o absenci v měsíci.
- **Schválit / vrátit:** vedoucí své party, správce kohokoli; nikdo sám sebe. Výkaz vedoucího i správce schvaluje
  správce docházky; je-li správce jediný, schválí si výkaz sám a audit to označí (`self_approval`).
  Administrátor bez role správce neschvaluje. **Vrátit** lze potvrzený i schválený výkaz až do uzávěrky,
  vždy s důvodem, který zaměstnanec uvidí; vrácení zapíše oznámení pro e-mail.
- **Hromadně schválit:** jen potvrzené výkazy bez upozornění měsíce; ostatní se přeskočí s důvodem.
- **Uzavřít:** správce, po skončení měsíce, bez chyb v kontrole před uzávěrkou (všechny výkazy zaměstnanců
  s docházkou a úvazkem v měsíci schválené, žádné nerozhodnuté absence, žádné chybějící dny; upozornění jsou
  jen informace). Výkazy → `closed`, uloží se snímek `period_export` verze n.
- **Znovu otevřít:** správce s důvodem a výběrem zaměstnanců; jejich výkazy → `open` (s důvodem jako
  důvodem vrácení, oznámení pro e-mail), ostatní → `approved`. Další uzavření = verze n+1.

## Pravidla a výpočty

Všechna pravidla jsou čisté funkce v `src/modules/timesheets/rules` s testy.

**Validace (blokuje uložení):** konec po začátku, max 24 h; bez překryvů (i exclusion constraint v DB);
práce má druh práce a aktivní zakázku (kromě režie); nelze měnit potvrzený/schválený/uzavřený měsíc; nekoliduje
s celodenní absencí (žádost nebo schválená; zamítnutá a absence na hodiny neblokují).

**Den a půlnoc:** interval patří ke dni začátku (`work_date`); osa dne pokrývá 0:00 až 6:00 dalšího dne, takže interval
může končit nejpozději v 6:00 následujícího dne a nesmí se překrývat s intervaly dalšího dne (hlídá exclusion constraint
nad `start_at`/`end_at`).

**Právní rámec (zákoník práce):**
- § 96 – evidence ukazuje u každého zaměstnance (i DPP a DPČ) začátek a konec odpracované směny, práci přesčas,
  noční práci, pracovní pohotovost a práci během pohotovosti. Přestávky se evidovat nemusí, firma ale musí doložit,
  že je poskytla. Zaměstnanec smí nahlížet do své evidence a dostat kopii.
- Upozornění (přestávka § 88, 12 h § 83, odpočinek § 90 a § 92, limity dohod) **nikdy neblokují** uložení
  skutečného času. Ukazují se v měsíci, při schválení a v exportu.
- Noc (§ 78), sobota a neděle (§ 118) a svátek (§ 115) se počítají **podle kalendářního času** v Europe/Prague,
  ne podle `work_date`. Kategorie se nevylučují (hodina v noci ze soboty na svátek je noc + sobota + svátek).
- Od 1. 10. 2023 mají DPP a DPČ nárok na příplatky za noc, víkend a svátek (ne za přesčas): výpočty platí pro
  všechny typy úvazku. DPP: limit hodin za kalendářní rok u firmy, jen odpracovaná doba (ne absence). DPČ:
  v průměru nejvýš limit hodin týdně za dobu trvání dohody.
- Pohotovost (§ 78, § 95) není pracovní doba; práce během pohotovosti je odpracovaná doba.
- Svátek na pracovní den, kdy se nepracovalo: u HPP a DPČ „Svátek (neodpracováno)“ v hodinách denního úvazku.
- Přesčas se pravidly pružné a nerovnoměrné doby zatím nepočítá (otevřený bod s účetní). Eviduje se označením
  intervalu (`time_entry.overtime`), které nastaví vedoucí nebo správce při schválení. „Rozdíl proti fondu“ je
  jen informace a nikdy se nenazývá přesčas.
- Měsíční podklad se po uzávěrce nemění: každá verze exportu je uložený snímek (`period_export`), ne nový výpočet.

**Upozornění (neblokuje):** přes 6 h práce bez přestávky ≥ 30 min (přestávka = interval `break` nebo mezera
mezi intervaly; části aspoň 15 min); přes 12 h za den; odpočinek mezi dny pod 11 h; týdenní odpočinek pod 35 h
(týden po–ne, i přes hranici měsíce); pracovní den bez záznamu a absence (e-mail další ráno); DPP nad ročním
limitem (odpracováno od 1. 1. do konce měsíce); DPČ nad průměrem hodin týdně (od začátku dohody do jejího konce,
u dohody bez konce do konce měsíce). Upozornění měsíce = upozornění všech dnů a týdnů měsíce + limity dohod.

**Měsíc:** jedna čistá funkce `monthSummary` vrací vše pro Můj měsíc, Schvalování, Uzávěrku a export. Interval
a pohotovost patří měsíci podle dne začátku (Europe/Prague); noc, víkend a svátek se ale dělí podle skutečného času.

| Hodnota | Výpočet |
| --- | --- |
| Odpracováno | Součet intervalů `work` |
| Podle zakázek a druhů práce | Součet `work` po `job_id` a `work_type_id` |
| Noční práce | Část intervalů `work` mezi `night_start` a `night_end` (výchozí 22:00–6:00) podle kalendářního času |
| Sobota, neděle | Část intervalů `work` v kalendářní sobotu a neděli |
| Svátek odpracovaný | Část intervalů `work` v kalendářní den z `public_holiday` |
| Svátek neodpracovaný | Svátek po–pá bez intervalu `work` toho dne, úvazek HPP nebo DPČ: denní úvazek |
| Přesčas | Součet intervalů `work` s `overtime = true` |
| Pohotovost (k odměně) | Součet `standby` mimo odpracované intervaly |
| Práce v pohotovosti | Překryv intervalů `work` s `standby` (je zároveň v Odpracováno) |
| Absence | Schválené hodiny po typech (`absenceHours`); žádosti zvlášť; dovolená snižuje zůstatek |
| Fond měsíce | Σ denní úvazek (týdenní hodiny / 5) přes pracovní dny (po–pá bez svátků) podle úvazku platného v daný den; DPP 0 |
| Fond k dnešku | Totéž od 1. dne měsíce do dneška včetně (u minulého měsíce celý měsíc) |
| Rozdíl proti fondu | Odpracováno + absence − fond k dnešku; jen informace, u DPP se nezobrazuje |
| Stav dne | `filled` (má práci), `absence`, `holiday`, `weekend`, `missing` (pracovní den do včerejška bez záznamu), `today`, `future`, `free` (den bez povinnosti, např. DPP) |

Prahy a lhůty jsou v `timesheet_settings` (platnost od `valid_from`), ne v kódu: `night_start`, `night_end`,
`break_after_work_minutes`, `break_min_minutes`, `break_part_min_minutes`, `daily_work_warning_minutes`,
`daily_rest_minutes`, `weekly_rest_minutes`, `dpp_yearly_limit_hours`, `dpc_weekly_average_limit_hours` (20),
`confirm_deadline_day` (2), `approve_deadline_day` (5), `close_deadline_day` (7) – dny dalšího měsíce,
`reminder_time` ("07:00"), `missing_day_reminder_delay_days` (1 – za kolik pracovních dnů připomenout nevyplněný den).

**Připomínky (e-maily, `rules/reminders.ts`):** worker posílá v pracovní dny od `reminder_time` (Europe/Prague):
- nevyplněný den – pracovní den před `missing_day_reminder_delay_days` pracovními dny (1 = předchozí pracovní den,
  v pondělí tedy pátek) bez záznamu práce a bez absence (žádost i schválená); jen aktivní zaměstnanci s docházkou,
  e-mailem, úvazkem jiným než DPP a otevřeným výkazem;
- potvrzení minulého měsíce 1. den a v den `confirm_deadline_day` (víkend nebo svátek → další pracovní den; padnou-li
  na stejný den, jen jedna) zaměstnancům s otevřeným výkazem;
- schválení den před `approve_deadline_day` (víkend nebo svátek → předchozí pracovní den) každému, na koho čekají
  potvrzené výkazy (vedoucí party; správce u výkazů vedoucích, správců a part bez vedoucího), se seznamem jmen;
- uzávěrka den před `close_deadline_day` (posun jako u schválení) správcům, není-li měsíc uzavřený.
Ruční „Připomenout“ (Schvalování, jednomu) a „Připomenout chybějícím“ (Uzávěrka, všem s otevřeným výkazem) jde
jen na otevřený výkaz neuzavřeného měsíce, nejvýš jednou denně. Každé odeslání zapíše `reminder_log` (příjemce,
druh, den nebo měsíc), takže opakovaný běh ani restart nic nepošle dvakrát; frontu `notification` worker odesílá
a nastaví `sent_at`. Texty podle `user.locale`, odkaz na den nebo měsíc vede na adresu aplikace (`BETTER_AUTH_URL`).

## Oprávnění

| Akce | Zaměstnanec | Vedoucí (svůj tým) | Správce docházky | Administrátor |
| --- | --- | --- | --- | --- |
| Vlastní intervaly v otevřeném měsíci | Ano | Ano | Ano | Ano |
| Zápis za jiného | Ne | Ano | Ano | Ano |
| Potvrdit vlastní výkaz | Ano | Ano | Ano | Ano |
| Vidět výkazy jiných | Ne | Ano | Ano | Ano |
| Schválit / vrátit výkaz | Ne | Ano | Ano | Ne |
| Absence a dovolená | Žádost | Ano | Ano | Ne |
| Uzávěrka, znovuotevření, export | Ne | Ne | Ano | Ne |
| Zakázky a druhy práce | Ne | Ne | Ano | Ano |
| Zaměstnanci, týmy, úvazky, nároky | Ne | Ne | Ano | Ano |
| Uložit vlastní obvyklý den | Ano | Ano | Ano | Ano |
| Smazat obvyklý den zaměstnance, nastavit výchozí šablonu firmy | Ne | Ne | Ano | Ano |
| Pohotovost (vlastní v otevřeném měsíci / za jiného s důvodem) | Vlastní | Ano | Ano | Ano |
| Označit interval jako přesčas (do schválení, s důvodem) | Ne | Ano | Ano | Ne |
| Připomenout e-mailem nepotvrzený měsíc (jednomu / všem chybějícím) | Ne | Ano / Ne | Ano | Ne |
| Připnout zakázky party | Ne | Ano | Ano | Ano |
| Role a povolené účty | Ne | Ne | Ne | Ano |

Role v `role_assignment` (přes `employee_id`): `module = '*'`, `role = 'admin'` (administrátor) a `module = 'timesheets'`, `role = 'manager'`
(správce docházky). Zaměstnanec = každý přihlášený uživatel navázaný na aktivního zaměstnance, bez další role.
Vedoucí není samostatná role; práva plynou z `team.lead_employee_id`. Tabulky Better Auth (`user`, `session`,
`account`, `verification`) jsou ve schématu `core`.

## Export a audit

Podklad pro mzdy jen z uzavřeného měsíce a jen z uloženého snímku `period_export` vybrané verze: XLSX (listy
Souhrn po zaměstnancích, Intervaly, Absence, Pohotovost) a PDF výkaz na zaměstnance (i jeden soubor za všechny);
každý export má číslo verze. PDF měsíce zaměstnance smí stáhnout každý, kdo smí měsíc vidět; dokud měsíc není
uzavřený, je z živých dat s označením „Pracovní verze – neuzavřeno“. Samostatně CSV hodin po zakázkách za libovolné
období (středník, UTF-8 s BOM).
Každá změna se zapisuje do `audit_log`; zápis za jiného a znovuotevření vyžadují důvod.
