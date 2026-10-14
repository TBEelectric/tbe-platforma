Automatický běh bez člověka: milník {{MILESTONE}}, krok {{STEP}} z docs/plan.md.

1. Přečti CLAUDE.md, v docs/plan.md celý milník {{MILESTONE}} (kvůli kontextu) a zadání kroku {{STEP}}
   včetně „Hotovo, když“. Přečti podklady, na které krok a CLAUDE.md odkazují (docs/, prototypy).
2. Zjisti stav: `git status`, `git log --oneline -10`.{{DIRTY_NOTE}}
3. Napiš stručný plán kroku (nejvýš 8 bodů, jedna řádka na bod) a pak ho rovnou implementuj. Dělej jen krok {{STEP}};
   nic z dalších kroků neimplementuj, i kdyby to šlo snadno.
4. Commituj a pushuj průběžně po logických částech podle CLAUDE.md (git push origin main).
5. Na konci musí projít: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
6. V docs/plan.md odškrtni krok {{STEP}} (`- [x]`) a hned pod jeho zadání přidej odsazený řádek
   `Výsledek: …` (1–3 věty: co je hotové, co si má člověk vyzkoušet, jaká rozhodnutí jsi udělal sám).
   Commit a push.
7. Úplně poslední řádek odpovědi: `STATUS: DONE`, nebo `STATUS: BLOCKED – <důvod>`.
