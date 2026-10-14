# Pravidla automatického běhu (nikdo nesleduje)

- Nikdo neodpoví na otázky ani neschválí plán. Neptej se a nečekej na souhlas. Nejasnosti rozhodni rozumně podle
  docs/ a CLAUDE.md; rozhodnutí uveď v commit message a v řádku „Výsledek:“ v docs/plan.md.
- Když nejde pokračovat bez člověka (chybí údaj nebo přístup, podklady si zásadně odporují, je potřeba Google Cloud
  Console, tajné klíče, placená služba, instalace nástroje do systému, nevratná operace s daty): nehádej. Pod krok
  v docs/plan.md přidej odsazený řádek `BLOKOVÁNO: <co přesně je potřeba od člověka>`, commitni, pushni a skonči
  posledním řádkem `STATUS: BLOCKED – <důvod>`.
- Když build nebo testy selžou a do tří pokusů o opravu je nespravíš, postupuj stejně (BLOKOVÁNO + STATUS: BLOCKED).
- Nikdy: force push, přepis historie (rebase, reset publikovaných commitů), jiná větev než main, úpravy `.env`
  (jen `.env.example`), mazání dat mimo lokální vývojovou databázi, globální instalace, práce mimo repozitář.
- Nespouštěj procesy, které samy neskončí (`pnpm dev`, tunel, watch). Pokud potřebuješ server ověřit, spusť ho na pozadí
  s časovým limitem a po ověření ukonči.
- Drž se rozsahu kroku. Hotové kroky a jejich kód měň jen kvůli nutné opravě; uveď to ve „Výsledek:“.
- Na konci nesmí v gitu zůstat necommitnuté změny a vše musí být pushnuté.

# Úspornost (každý tah znovu posílá celou historii – méně tahů a menší výstupy = levnější běh)

- Soubor, který budeš měnit, si přečti jednou celý (Read), místo opakovaného `grep -n` / `sed -n` po kouscích.
- Změny v jednom souboru dělej najednou: jeden větší Edit nebo Write celého souboru místo série drobných editů.
- Nové soubory piš rovnou celé (Write).
- Během práce pouštěj jen související testy (`pnpm vitest run <soubor>`); celé `pnpm test`, `pnpm typecheck`,
  `pnpm lint` a `pnpm build` až na konci (a po opravě znovu jen to, co selhalo).
- Výstupy příkazů zkracuj: `… 2>&1 | tail -40`; diffy jen `git diff --stat`, celý diff jen u konkrétního souboru.
- Nevytvářej dočasné ladicí soubory a skripty, pokud to jde jinak; když ano, smaž je před commitem.
- Plán i průběžné komentáře piš stručně; nevypisuj obsah souborů ani shrnutí změn, které jsou vidět v commitech.
- Nečti podklady, které krok nepotřebuje (prototypy jen u UI kroků, import jen u kroků s importem).
