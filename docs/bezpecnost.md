# Bezpečnost

Bezpečnostní kontrola před pilotem (krok 5.2 v `docs/plan.md`) a jak ji opakovat před každým nasazením.
Pravidla, která se ověřují, jsou v `docs/technicky-navrh.md` (sekce Oprávnění, Export a audit).

## Jak kontrolu spustit

```
docker compose up -d db
pnpm security:check            # build + kontrola (1–2 minuty)
pnpm security:check --no-build # se stávajícím produkčním buildem (.next)
pnpm security:check --keep     # databázi tbe_security po běhu nesmaže (ladění)
```

Co příkaz dělá (`src/scripts/security-check/`):

1. **Pojistka:** běží jen proti lokálnímu PostgreSQL (`DATABASE_URL` na `localhost`/`127.0.0.1`), jinak skončí.
   `SMTP_HOST` je pro build, server i skript vždy prázdný, takže žádný e-mail neodejde (`sendMail` jen loguje).
2. **Databáze:** v lokálním kontejneru vytvoří samostatnou databázi `tbe_security`, nasadí migrace a `pnpm db:seed`.
   Vývojová databáze `tbe` zůstane netknutá. Na konci (i po chybě) se `tbe_security` smaže.
3. **Testovací data** (`fixtures.ts`): party Secchk A a B, zaměstnanci, vedoucí, správce, administrátor,
   archivovaný a deaktivovaný administrátor; záznamy se značkami (`SecchkEb`, `secchk-note-eb`), podle kterých se
   v HTML pozná únik cizích dat; měsíce otevřený (minulý), potvrzený/schválený (předminulý) a leden 2016, který
   během kontroly uzavře správce (snímek pro mzdy v1).
4. **Server:** `pnpm build` a `next start` na portu 3100 s `DEV_LOGIN=true` (produkční build ho musí ignorovat).
   Session vytvoří skript přímo v databázi a cookie podepíše `BETTER_AUTH_SECRET`, stejně jako po přihlášení
   přes Google.
5. **Volání:** stránky a route handlery přes HTTP `GET`; server akce přes HTTP `POST` s hlavičkou `Next-Action`
   (ID z `.next/server/server-reference-manifest.json` podle souboru a jména exportu) a argumenty zakódovanými
   Reactovým `encodeReply`, tedy přesně jako prohlížeč. Bound argumenty (ID, měsíc, zaměstnanec) jsou jen první
   argumenty volání, kontrola je proto podvrhuje stejně jako útočník.
6. **Verdikt:** zamítnutý pokus nesmí změnit sledované řádky ani přidat řádek do `audit_log`; ke každé akci
   patří povolený kontrolní případ, který změnu provede (důkaz, že požadavek akci opravdu volá).
   Stránka bez oprávnění musí vykreslit `notFound()` a nesmí obsahovat značky cizích dat.
7. **Pokrytí:** kontrola selže, když build obsahuje server akci, stránku nebo route handler, pro který nemá
   případ. Nová akce bez bezpečnostního případu tedy kontrolu shodí – doplňte případ do `suites/`.

Výstup: řádek na každou kontrolu, souhrn a kód 1 při chybě; výstup serveru (včetně zalogovaných e-mailů) je
v `logs/security-check-server.log` (necommituje se).

## Soupis

Stav po kroku 5.2. „Brána“ = první kontrola v kódu (`requirePermission(…)` vrátí 404, `requireUser()` přesměruje
na přihlášení); „Konkrétní kontrola“ = kde se rozhoduje o konkrétním zaměstnanci, partě, měsíci nebo záznamu.
Vstupy od klienta jsou vždy podvrhnutelné: pole formuláře, bound argumenty akcí, `searchParams`, `params`.

### Stránky

| Stránka | Brána | Vstupy | Konkrétní kontrola |
| --- | --- | --- | --- |
| `/` (launcher) | `requireUser` | – | dlaždice a úkoly jen z vlastních oprávnění |
| `/employees`, `/employees/new`, `/employees/teams` | `canManageEmployees` | – | – |
| `/employees/[id]` | `canManageEmployees` | `id` | role mění jen `canManageAccess`; stav administrátora jen administrátor |
| `/employees/teams/[id]` | `canManageEmployees` | `id` | – |
| `/employees/import` | `canManageAccess` | – | – |
| `/jobs`, `/jobs/new`, `/jobs/[id]`, `/jobs/customers…` | `canManageJobs` | `id` | – |
| `/timesheets` | `requireUser` | – | přehled jen z vlastních oprávnění |
| `/timesheets/day` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | `date`, `employee` | cizí zaměstnanec: `canWriteTimeFor` (parta k danému dni), jinak 404 |
| `/timesheets/day/someone` | `canWriteForSomeoneElse` | `date` | seznam `listWritableEmployees` (vedoucí jen svou partu) |
| `/timesheets/month` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | `month`, `employee` | `getMonth` → `canViewTimeOf`, jinak 404 |
| `/timesheets/month/someone` | `canWriteForSomeoneElse` | `month` | seznam `listWritableEmployees` |
| `/timesheets/absences` | `canOpenAbsences` | – | vlastní absence; k rozhodnutí jen `listDecidableEmployees` (administrátor nikoho) |
| `/timesheets/approval` | `canApproveTimesheets` | `month`, `team`, `tab`, `employee` | `team` jen z `listApprovalTeams`; data z `getTeamMonth` (vedoucí své party); `employee` jen ze seznamu |
| `/timesheets/close`, `/timesheets/settings` | `canCloseTimesheetPeriod` | `month` | – |
| `/login` | veřejná | `error` | vývojové přihlášení jen při `devLoginEnabled()` |

### Server akce

| Akce | Brána | Konkrétní kontrola |
| --- | --- | --- |
| **Jádro** (`src/modules/core/actions.ts`) | | |
| `createEmployeeAction` | `canManageEmployees` | přihlašovací e-mail jen `canManageAccess` |
| `updateEmployeeAction(id)` | `canManageEmployees` | změna e-mailu jen `canManageAccess` |
| `setEmployeeStateAction(id, change)` | `canManageEmployees` | `change` jen z výčtu; nikdo sám sebe nedeaktivuje/nearchivuje; stav administrátora (deaktivace, archivace, aktivace, obnovení) mění jen administrátor |
| `addEmploymentAction(employeeId)`, `updateEmploymentAction(employmentId)`, `changeTeamAction(employeeId)` | `canManageEmployees` | – |
| `setRolesAction(employeeId)` | `canManageAccess` | služba nedovolí odebrat posledního administrátora |
| `createTeamAction`, `updateTeamAction(id)`, `setTeamArchivedAction(id)` | `canManageEmployees` | – |
| `pinTeamJobAction(teamId)`, `unpinTeamJobAction(teamId, jobId)` | `canPinAnyTeamJobs` | `canPinTeamJobs(teamId)` (vedoucí jen svou partu); služba: parta a zakázka existují |
| `createJobAction`, `updateJobAction(id)`, `setJobArchivedAction(id)`, `createCustomerAction`, `updateCustomerAction(id)`, `setCustomerArchivedAction(id)` | `canManageJobs` | – |
| **Docházka** (`src/modules/timesheets/actions.ts`) | | |
| `setLeaveAction(employeeId)` | `canManageEmployees` | – |
| `deleteDayTemplateAction(employeeId)`, `setDefaultDayTemplateAction` | `canManageDayTemplates` | – |
| `createAbsenceAction` | `canOpenAbsences` | služba: vlastní = žádost (`canRecordOwnTime`), za jiného `canDecideAbsence` (parta ke dni začátku) + důvod; zamčené měsíce odmítne |
| `decideAbsenceAction(id, decision)` | `canOpenAbsences` | služba: `canDecideAbsence` vlastníka uloženého záznamu (nikdy sám sobě, administrátor ne) |
| `cancelAbsenceAction(id)` | `canOpenAbsences` | služba: vlastní žádost, nebo `canDecideAbsence` + důvod; ne v zamčeném měsíci |
| `createStandbyAction`, `updateStandbyAction(id)`, `deleteStandbyAction(id)` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | služba `standbyChangeError`: `canWriteTimeFor` vlastníka (u úpravy z uloženého záznamu, zaměstnanec se nemění), důvod za jiného, zámek měsíce |
| `setOvertimeAction(entryId, overtime)` | `canApproveTimesheets` | služba `overtimeFlagError`: `canFlagOvertime` vlastníka intervalu, ne vlastní, jen před schválením a uzávěrkou, s důvodem |
| `confirmTimesheetAction(month)` | `canRecordOwnTime` | jen vlastní výkaz (zaměstnanec ze session); `timesheetTransition` |
| `decideTimesheetAction(employeeId, month, decision)` | `canApproveTimesheets` | `decision` jen `approve`/`return`; `timesheetTransition`: vedoucí své party v měsíci, správce kohokoli, nikdo sám sebe |
| `bulkApproveAction(month, employeeIds)` | `canApproveTimesheets` | služba bere jen výkazy, které smí viewer schválit |
| `remindEmployeeAction(employeeId, month)` | `canApproveTimesheets` | služba `canRemind` (vedoucí své party, správce) |
| `closePeriodAction(month)`, `reopenPeriodAction(month, employeeIds)`, `saveSettingsAction`, `remindMissingAction(month)` | `canCloseTimesheetPeriod` | pravidla uzávěrky (`rules/period-close.ts`) |
| **Časová osa** (`src/modules/timesheets/timeline-actions.ts`) | | |
| `timelineAction(input)` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | služba `planTimelineChange`: `canWriteTimeFor` (parta ke dni), důvod za jiného, zámek měsíce; ID intervalu jen z daného dne daného zaměstnance |
| `loadTimelineDayAction(employeeId, date)` | totéž | `canWriteTimeFor`, jinak `null` |
| `pinTeamJobAction(employeeId, date, jobId, pinned)` | totéž | `canPinTeamJobs` pro partu zaměstnance k danému dni |
| `saveOwnTemplateAction(items)` | `canSaveOwnDayTemplate` | jen vlastní šablona (zaměstnanec ze session) |
| **Ostatní** | | |
| `importAction` (`timesheets/import/actions.ts`) | `canManageAccess` | náhled nic nezapisuje; zápis v jedné transakci |
| `signOut` (`src/lib/auth-actions.ts`) | – | Better Auth zruší session z cookie (řádek v `session`) |
| `devSignInAction` (`src/lib/dev-login-actions.ts`) | `devLoginEnabled()`, jinak 404 | jen aktivní zaměstnanec s e-mailem |

### Route handlery

| Route | Brána | Konkrétní kontrola |
| --- | --- | --- |
| `/api/auth/[...all]` | Better Auth | jen Google; `validateUserInfo` pustí jen aktivního zaměstnance s e-mailem; kontrola originu |
| `/employees/import/template` | `getCurrentUser` + `canManageAccess` | jinak 404 |
| `/timesheets/export/payroll/[month]/[version]/xlsx`, `…/pdf` | `requireUser` | `getPeriodSnapshot` → `canCloseTimesheetPeriod`, jinak 404; jen snímek |
| `/timesheets/export/month-pdf?employee=&month=` | `requireUser` | `getMonth` → `canViewTimeOf`, jinak 404 |
| `/timesheets/export/job-hours?from=&to=` | `requireUser` | `getJobHours` → `canCloseTimesheetPeriod`, jinak 404 |

## Co kontrola ověřuje

- **Oprávnění na serveru** (`suites/pages.ts`, `suites/actions.ts`): každá stránka pro zaměstnance, vedoucího
  vlastní a cizí party, správce docházky, administrátora, bez session a s podvrženou cookie; podvržené
  `?employee=`, `?team=`, `?month=`, `?date=` a ID v cestě. Všech 43 server akcí bez přihlášení a pro každou roli
  s cizím ID, zaměstnancem, partou nebo měsícem, zápis do potvrzeného, schváleného a uzavřeného měsíce, cizí ID
  intervalu pod vlastním zaměstnancem, podvržené bound argumenty (`change`, `decision`).
- **Vývojové přihlášení** (`suites/session.ts`): produkční build s `DEV_LOGIN=true` nemá sekci na `/login`,
  `devSignInAction` vrací 404 a nevytvoří session, endpoint nemá HTTP adresu; `.env.example` a
  `docker-compose.yml` `DEV_LOGIN` nezapínají. Funkci `isDevLoginEnabled` hlídá `src/lib/dev-login.test.ts`.
- **Session:** odhlášení smaže řádek v `session` a stará cookie nic neotevře; archivovaný a deaktivovaný
  zaměstnanec, změněný e-mail a účet bez zaměstnance přijdou o přístup hned při dalším požadavku; odebraná role
  správce a odebraný vedoucí party také; prošlá session a cookie podepsaná jiným tajemstvím neplatí; cookies
  `HttpOnly`, `SameSite=Lax`, s `https` adresou `__Secure-` a `Secure`; cache session v cookie je vypnutá;
  server akce i Better Auth odmítnou cizí origin i adresu z LAN (rozšířené origins jen ve vývoji).
- **Exporty a e-maily** (`suites/exports.ts`, `suites/mail.ts`): kdo stáhne mzdový XLSX/PDF, CSV hodin, PDF
  měsíce a šablonu importu; hlavičky `Content-Disposition: attachment`, `Cache-Control: private, no-store`;
  podvržená verze, měsíc nebo ID → 404. E-maily z ručních připomínek, fronty `notification` a připomínek celého
  měsíce: adresát je jen dotčený člověk, text neobsahuje údaje nikoho, koho by adresát nesměl vidět, odkazy jen na
  `BETTER_AUTH_URL`.
- **Chyby a tajemství** (`suites/errors.ts`): chybové stránky, chybné akce a chyby Better Auth bez SQL, stack
  trace, cest a URL databáze; hodnoty `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `SMTP_PASSWORD` nejsou
  v odpovědích, logu serveru ani v `.next/static`. Neplatné ID (`x`, 36 pomlček) v cestě detailu, v `?employee=`
  a v bound argumentech akcí skončí 404 / chybou formuláře „Záznam nenalezen.“ bez chyby v logu serveru;
  log celého běhu nesmí obsahovat chybu `22P02`.

Ručně (mimo `security:check`) se v kroku 5.2 prošlo: `pnpm audit`, historie gitu (147 commitů: žádný soubor
`.env*` kromě `.env.example`, žádné klíče Google, privátní klíče ani tokeny; hodnoty z lokálního `.env` se
v historii, sledovaných souborech, buildu ani v `logs/` nevyskytují; v historii jsou jen lokální výchozí přístupy
`tbe:tbe@localhost` z `docker-compose.yml` a smyšlené adresy v testech). Opakovat před nasazením (příkazy níže).

```
pnpm audit
git log --all --diff-filter=A --name-only --format= | grep -iE '(^|/)\.env|\.pem$|\.key$'
git log --all -p -G'GOCSPX-|BEGIN [A-Z ]*PRIVATE KEY|apps\.googleusercontent\.com' --format=%h
```

## Nálezy

Závažnost: **vysoká** – cizí data nebo práva bez oprávnění; **střední** – obejití pravidla tabulky Oprávnění
s nutností jiné role; **nízká** – bez úniku dat (chybový kód, odolnost, závislost bez dosahu); **info** – na vědomí.

### Opravené v kroku 5.2

| # | Závažnost | Nález | Oprava |
| --- | --- | --- | --- |
| 1 | střední | Správce docházky mohl aktivovat deaktivovaného nebo obnovit archivovaného administrátora (`setEmployeeStateAction(id, "activate" \| "restore")`); tím vrátil přihlášení účtu s rolí administrátora, ačkoli role a povolené účty smí měnit jen administrátor. Kód hlídal jen deaktivaci a archivaci. | Pravidlo `canChangeEmployeeState` (`core/permissions.ts`, test) pro všechny čtyři změny; používá ho akce i stránka detailu. Případ v `security:check`. |
| 2 | nízká | `setEmployeeStateAction`: argument `change` z `.bind` se neověřoval; neznámá hodnota skončila chybou 500 (nic se nezměnilo). | `change` a `id` ověřuje Zod, jinak 404. |
| 3 | nízká | `updateEmploymentAction` četla formulář před kontrolou oprávnění; požadavek s nevalidními argumenty skončil 500 místo přesměrování na přihlášení. | Čte se až po `requirePermission` (uvnitř `handleFormAction`). |

### Opravené po kroku 5.2

| # | Závažnost | Nález | Oprava |
| --- | --- | --- | --- |
| 6 | nízká | Neplatné UUID v cestě nebo v argumentu akce (např. `/employees/abc` jako správce, `setLeaveAction("x")`) skončilo chybou databáze `22P02` a 500 místo 404. Odpověď nic neprozradila (jen digest), ale log serveru dostal chybu se SQL a parametry. Volná kontrola `/^[0-9a-f-]{36}$/` u `?employee=` (Den, Měsíc, PDF měsíce) pustila do databáze i 36 pomlček. | Helper `src/lib/ids.ts` (test): stránky detailu a akce bez formuláře volají `idOrNotFound` (→ `notFound()`), formulářové akce `boundId` (→ chyba „Záznam nenalezen.“), `?employee=` `isId`; vždy až po `requirePermission`. Případy v `security:check` (`suites/errors.ts`). |

### Otevřené

| # | Závažnost | Nález | Návrh |
| --- | --- | --- | --- |
| 4 | nízká | `pnpm audit`: **high** `braces` ≤ 3.0.3 (GHSA-vfj7-8cjw-p6xm, DoS hluboce vnořeným vzorem) přes `shadcn` → `fast-glob`/`micromatch` a `eslint-config-next`. Nejde aktualizovat: opravená verze 3.0.4 v registru npm zatím není (nejnovější je 3.0.3). Dosah: jen nástroje (CLI shadcn, ESLint, build) se vzory z repozitáře, aplikace ho se vstupem uživatele nevolá. | Po vydání 3.0.4 `pnpm update braces` (případně `pnpm.overrides`); `shadcn` se za běhu používá jen kvůli `shadcn/tailwind.css`. |
| 5 | nízká | `pnpm audit`: moderate `esbuild` ≤ 0.24.2 (dev server esbuild) přes `drizzle-kit` → `@esbuild-kit`. Dev server esbuild se nikde nespouští, `drizzle-kit` jen pro migrace. | Aktualizovat s novější verzí `drizzle-kit`. |
| 7 | info | Zamítnutá stránka se streamuje se stavem 200; `notFound()`/`redirect()` přijde v payloadu (Cache Components). Obsah stránky se nevykreslí, data neuniknou; jen stavový kód není 404/307. | Ponechat. Kontrola proto hledá značku `NEXT_HTTP_ERROR_FALLBACK;404` a `NEXT_REDIRECT`. |
| 8 | info | `NextIntlClientProvider` posílá do prohlížeče celý katalog překladů (i texty administrace a vývojového přihlášení). Texty nejsou tajné. | Při růstu katalogu předávat jen potřebné jmenné prostory (výkon). |
| 9 | info | Log serveru při chybě obsahuje SQL i s parametry (ID, jména). | Při nasazení na VPS: přístup k logům jen pro správce, rotace logů. |
| 10 | info | Nasazení (krok VPS): cookies jsou `Secure` jen s `https` `BETTER_AUTH_URL`; kontrola originu server akcí porovnává `Origin` s `Host`/`X-Forwarded-Host`, Caddy musí předat správný `Host`; `DEV_LOGIN` nesmí být v produkční konfiguraci. | Do kroku nasazení: `BETTER_AUTH_URL=https://…`, ověřit hlavičky za Caddy, `security:check` spustit nad stejným buildem. |

## Rozhodnutí

- Kontrola běží proti samostatné databázi `tbe_security` (seed + testovací data), ne proti vývojové `tbe`,
  aby nepřepsala ručně zadaná data; po běhu se smaže.
- Server akce se volají přes HTTP jako z prohlížeče, ne přímým voláním funkcí: ověřuje se tím i session,
  cookies, origin a to, že klient může poslat jakékoli bound argumenty.
- Stav administrátora (aktivace, deaktivace, archivace, obnovení) mění jen administrátor (potvrzeno zadavatelem).
- Šablona importu odpovídá bez oprávnění i bez session 404 (používá `getCurrentUser`); to je v pořádku,
  soubor neobsahuje data.
- Přihlášení přes Google se v kontrole nevolá (kontaktovalo by Google); povolené e-maily hlídají testy
  `signInRejection`/`canEmployeeSignIn` a `requireUser` při každém požadavku (účet bez zaměstnance → odmítnut).
- Uzavřený měsíc kontroly je leden 2016 (před úvazky ze seedu); nastavení docházky dostanou v kontrolní
  databázi kopii platnou od 2015.
