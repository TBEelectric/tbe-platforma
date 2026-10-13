# Vozový park – shrnutí rozhodnutí

Další modul po docházce. Podrobné zadání v1.0: dokument „TBE electric — zadání aplikace pro správu vozového parku“
a dopady doplňujících odpovědí (odkaz v `README.md`).

## Potvrzeno

- 6–15 vozidel (osobní, dodávky, nákladní, přívěsy, stroje, elektromobily); vlastní Traccar, Teltonika FMC003.
- Traccar běží na H2 → před napojením převést na PostgreSQL.
- Skutečný tachometr jen u části aut; u každého vozidla evidovat zdroj km (OBD / GPS), u GPS kalibrace při tankování.
- Auta se berou bez přiřazení; **kniha jízd se vede na vozidlo**, řidič se k jízdě přiřadí jen kvůli náhradám.
- Cestovní náhrady (stravné, cestovní příkazy) navázat na docházku a jízdy; zahraniční cesty občas.
- Zakázka mívá více míst → místo navrhne zákazníka, zakázku vybírá uživatel.
- Elektromobily: stav baterie, jen pokud ho tracker dodá. Pokuty a škodní události později.

## Pravidla pro rozdělování jízd (ze zářijového konceptu, ověřit na datech)

- Zastávka do 10 min (benzínka) jízdu neukončí; jízdy se sloučí.
- Stání se zapnutým motorem přes 5 min = volnoběh, ne nová jízda.
- Mikro-pohyby pod 100 m filtrovat.
- Odjezd na oběd nebo do stavebnin: km k dané zakázce jako režie.
- Odpojení OBD jednotky → upozornění správci.

## Otevřené

- Zdanění soukromého užití aut (účetní), viditelnost soukromých tras, délka GPS historie.
