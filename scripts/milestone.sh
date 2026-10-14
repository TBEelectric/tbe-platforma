#!/usr/bin/env bash
# Pouští kroky milníku z docs/plan.md jeden po druhém, každý v nové session Claude Code (claude -p).
# Po každém kroku ověří výsledek (STATUS, odškrtnutí v plánu, lint/typecheck/test/build, čistý a pushnutý git).
#
# Použití:
#   scripts/milestone.sh 3b                 # další neodškrtnutý krok, pak se zeptá, zda pokračovat
#   scripts/milestone.sh 3b --yes           # všechny kroky bez ptaní (zastaví u [ručně], [zastavit po] a chyby)
#   scripts/milestone.sh 3b --steps 2       # nejvýš 2 kroky
#   scripts/milestone.sh 3b --plan-only     # jen ukáže plán dalšího kroku, nic nemění
#   scripts/milestone.sh 3b --dry-run       # vypíše, který krok by se spustil, a příkaz
# Volby: --model <alias>  --effort <low|medium|high|xhigh|max>  --max-turns <n> (výchozí 300)
#        --budget <usd>   --auto (permission mode auto místo seznamu povolených příkazů)
#
# Kompatibilní s bash 3.2 (macOS). Volitelně jq pro čitelný průběh (brew install jq).

set -uo pipefail

MILESTONE="${1:-}"
if [ -z "$MILESTONE" ] || [ "${MILESTONE#-}" != "$MILESTONE" ]; then
  sed -n '2,15p' "$0"; exit 2
fi
shift

YES=0; MAX_STEPS=999; PLAN_ONLY=0; DRY_RUN=0; MODEL=""; EFFORT=""; MAX_TURNS=300; BUDGET=""; AUTO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --steps) MAX_STEPS="$2"; shift ;;
    --plan-only) PLAN_ONLY=1; MAX_STEPS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --model) MODEL="$2"; shift ;;
    --effort) EFFORT="$2"; shift ;;
    --max-turns) MAX_TURNS="$2"; shift ;;
    --budget) BUDGET="$2"; shift ;;
    --auto) AUTO=1 ;;
    *) echo "Neznámá volba: $1"; exit 2 ;;
  esac
  shift
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Spusť ve složce projektu (git)."; exit 2; }
cd "$ROOT"
PLAN="docs/plan.md"
PROMPT_TPL="scripts/claude/step-prompt.md"
RULES="scripts/claude/headless-rules.md"
LOG_DIR="logs/claude-runs"
mkdir -p "$LOG_DIR"

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_yel=$'\033[33m'; c_dim=$'\033[2m'; c_b=$'\033[1m'; c_0=$'\033[0m'
say()  { printf '%s\n' "${c_b}▶ $*${c_0}"; }
ok()   { printf '%s\n' "${c_grn}✔ $*${c_0}"; }
warn() { printf '%s\n' "${c_yel}! $*${c_0}"; }
fail() { printf '%s\n' "${c_red}✖ $*${c_0}"; notify "TBE: $*"; exit 1; }
notify() {
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$1\" with title \"Claude Code – milník $MILESTONE\"" >/dev/null 2>&1 || true
  fi
  printf '\a'
}

# Claude Code: bash nevidí aliasy a PATH ze zsh, proto ho hledáme i v běžných instalačních místech.
# Vlastní cestu jde zadat proměnnou CLAUDE_BIN=/cesta/ke/claude.
find_claude() {
  if [ -n "${CLAUDE_BIN:-}" ] && [ -x "$CLAUDE_BIN" ]; then printf '%s' "$CLAUDE_BIN"; return 0; fi
  if command -v claude >/dev/null 2>&1; then command -v claude; return 0; fi
  for c in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude" "/opt/homebrew/bin/claude" \
           "/usr/local/bin/claude" "$HOME/.npm-global/bin/claude" "$HOME/.bun/bin/claude"; do
    [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done
  # Poslední pokus: zeptat se přihlašovacího zsh (načte ~/.zshrc včetně aliasů a PATH).
  if command -v zsh >/dev/null 2>&1; then
    c="$(zsh -ic 'whence -p claude 2>/dev/null || alias claude 2>/dev/null' 2>/dev/null | tail -1 | sed -E "s/^claude=//; s/^'//; s/'$//")"
    [ -n "$c" ] && [ -x "${c%% *}" ] && { printf '%s' "${c%% *}"; return 0; }
  fi
  return 1
}
CLAUDE="$(find_claude)" || fail "Nenašel jsem Claude Code. V terminálu spusť: type claude  – a pak skript pusť s CLAUDE_BIN=<cesta> scripts/milestone.sh $MILESTONE"
for cmd in git pnpm docker; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Chybí příkaz: $cmd"
done
HAVE_JQ=0; command -v jq >/dev/null 2>&1 && HAVE_JQ=1
[ $HAVE_JQ -eq 1 ] || warn "jq není nainstalované – průběh bude méně čitelný (brew install jq)."
[ -f "$PLAN" ] && [ -f "$PROMPT_TPL" ] && [ -f "$RULES" ] || fail "Chybí $PLAN, $PROMPT_TPL nebo $RULES."

ms_re="$(printf '%s' "$MILESTONE" | sed 's/\./\\./g')"

# Řádek prvního neodškrtnutého kroku milníku, např.: - [ ] **3b.4 – Logika osy** [zastavit po]
next_step_line() { grep -E "^- \[ \] \*\*${ms_re}\.[0-9]+" "$PLAN" | head -1; }
step_id()    { printf '%s' "$1" | sed -E "s/^- \[ \] \*\*(${ms_re}\.[0-9]+).*/\1/"; }
step_title() { printf '%s' "$1" | sed -E 's/^- \[ \] \*\*(.*)\*\*.*/\1/'; }
is_done()    { grep -qE "^- \[x\] \*\*$(printf '%s' "$1" | sed 's/\./\\./g')[^0-9]" "$PLAN"; }
dirty()      { [ -n "$(git status --porcelain)" ]; }
unpushed()   { git fetch -q origin 2>/dev/null; [ "$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)" != "0" ]; }

# Bash příkazy povolené bez ptaní (soubory upravuje permission mode acceptEdits).
ALLOWED=(
  "Bash(pnpm *)" "Bash(npx *)" "Bash(node *)" "Bash(tsx *)"
  "Bash(docker compose *)" "Bash(docker ps*)"
  "Bash(git status*)" "Bash(git diff*)" "Bash(git log*)" "Bash(git show*)" "Bash(git add *)"
  "Bash(git commit *)" "Bash(git push origin main)" "Bash(git rm *)" "Bash(git mv *)" "Bash(git restore *)"
  "Bash(ls *)" "Bash(cat *)" "Bash(head *)" "Bash(tail *)" "Bash(wc *)" "Bash(find *)" "Bash(grep *)"
  "Bash(mkdir *)" "Bash(mv *)" "Bash(cp *)" "Bash(touch *)" "Bash(sleep *)" "Bash(timeout *)"
  "Bash(curl -s http://localhost*)" "Bash(curl http://localhost*)" "Bash(kill *)" "Bash(lsof *)"
  "WebFetch" "WebSearch"
)

progress() {
  if [ $HAVE_JQ -eq 1 ]; then
    jq -r --unbuffered '
      if .type=="assistant" then
        (.message.content[]? |
          if .type=="text" then "  " + (.text | gsub("\n";" ") | .[0:220])
          elif .type=="tool_use" then "  \u001b[2m$ " + .name + " " +
            ((.input.command // .input.file_path // .input.pattern // .input.url // "") | tostring | gsub("\n";" ") | .[0:140]) + "\u001b[0m"
          else empty end)
      elif .type=="result" then
        "  \u001b[2m— konec: " + (.subtype // "") + ", tahů " + ((.num_turns // 0)|tostring) +
        ", odhad $" + ((.total_cost_usd // 0)*100|round/100|tostring) + "\u001b[0m"
      else empty end' 2>/dev/null
  else
    grep -o '"text":"[^"]\{0,200\}' | sed 's/"text":"/  /'
  fi
}

run_step() {
  local id="$1" log="$2" note="$3" prompt mode_args
  prompt="$(sed -e "s/{{MILESTONE}}/${MILESTONE}/g" -e "s/{{STEP}}/${id}/g" "$PROMPT_TPL")"
  prompt="${prompt//\{\{DIRTY_NOTE\}\}/$note}"
  if [ $PLAN_ONLY -eq 1 ]; then
    prompt="Milník ${MILESTONE}, krok ${id} z docs/plan.md. Přečti CLAUDE.md, docs/plan.md a podklady kroku a napiš podrobný plán implementace kroku ${id} (soubory, migrace, testy, pořadí, rizika, co rozhodneš sám). Nic neměň."
    mode_args=(--permission-mode plan)
  elif [ $AUTO -eq 1 ]; then
    mode_args=(--permission-mode auto --permission-prompts none)
  else
    mode_args=(--permission-mode acceptEdits --permission-prompts none --allowedTools "${ALLOWED[@]}")
  fi
  local extra=()
  [ -n "$MODEL" ]  && extra+=(--model "$MODEL")
  [ -n "$EFFORT" ] && extra+=(--effort "$EFFORT")
  [ -n "$BUDGET" ] && extra+=(--max-budget-usd "$BUDGET")

  if [ $DRY_RUN -eq 1 ]; then
    printf '%s\n' "$CLAUDE -p --append-system-prompt-file $RULES --output-format stream-json --verbose --max-turns $MAX_TURNS ${mode_args[*]} ${extra[*]} <<< \"<prompt>\""
    printf '%s\n%s\n' "--- prompt ---" "$prompt"
    return 0
  fi

  printf '%s' "$prompt" | "$CLAUDE" -p \
      --append-system-prompt-file "$RULES" \
      --output-format stream-json --verbose \
      --max-turns "$MAX_TURNS" \
      --name "${MILESTONE}-${id}" \
      ${extra[@]+"${extra[@]}"} \
      "${mode_args[@]}" \
    | tee "$log" | progress
  return "${PIPESTATUS[1]}"
}

# Poslední řádek STATUS z finální odpovědi (událost "result"), ne z průběžného textu.
final_status() {
  if [ $HAVE_JQ -eq 1 ]; then
    jq -r 'select(.type=="result") | .result // ""' "$1" 2>/dev/null | grep -E '^ *STATUS: ' | tail -1 | sed 's/^ *//'
  else
    tail -1 "$1" | grep -oE 'STATUS: (DONE|BLOCKED[^"\\]*)' | tail -1
  fi
}

gates() {
  say "Kontrola: lint, typecheck, test, build"
  pnpm -s lint      >"$1.lint.txt" 2>&1      || { tail -30 "$1.lint.txt"; return 1; }
  pnpm -s typecheck >"$1.typecheck.txt" 2>&1 || { tail -30 "$1.typecheck.txt"; return 1; }
  pnpm -s test      >"$1.test.txt" 2>&1      || { tail -40 "$1.test.txt"; return 1; }
  pnpm -s build     >"$1.build.txt" 2>&1     || { tail -40 "$1.build.txt"; return 1; }
  return 0
}

count=0
first=1
while [ $count -lt "$MAX_STEPS" ]; do
  line="$(next_step_line)"
  if [ -z "$line" ]; then ok "Milník $MILESTONE nemá žádný neodškrtnutý krok."; notify "Milník $MILESTONE hotový"; exit 0; fi
  id="$(step_id "$line")"; title="$(step_title "$line")"

  if printf '%s' "$line" | grep -q '\[ručně\]' && [ $PLAN_ONLY -eq 0 ]; then
    warn "Krok $title je označený [ručně]. Udělej ho v interaktivním Claude Code:"
    printf '   claude "Pokračuj milníkem %s, krok %s z docs/plan.md. Přečti CLAUDE.md a podklady, ukaž plán a veď mě."\n' "$MILESTONE" "$id"
    printf '   Po dokončení krok odškrtni a spusť skript znovu.\n'
    notify "Krok $id čeká na ruční provedení"; exit 0
  fi

  note=""
  if dirty; then
    if [ $first -eq 1 ] && [ $PLAN_ONLY -eq 0 ]; then
      warn "V gitu jsou necommitnuté změny – předám je kroku $id jako rozpracovanou práci."
      git status --short
      note=" V gitu jsou necommitnuté změny: považuj je za rozpracovanou práci na tomto kroku, zkontroluj je, dokonči a commitni (nic nezahazuj)."
    elif [ $PLAN_ONLY -eq 0 ]; then
      fail "Po předchozím kroku zůstaly necommitnuté změny. Zkontroluj git status."
    fi
  fi

  if [ $PLAN_ONLY -eq 0 ] && [ $DRY_RUN -eq 0 ]; then
    docker compose up -d db >/dev/null 2>&1 || fail "Nepodařilo se spustit databázi (docker compose up -d db)."
  fi

  ts="$(date +%Y%m%d-%H%M%S)"; log="$LOG_DIR/${id}-${ts}.jsonl"
  say "Krok $title  ${c_dim}(log: $log)${c_0}"
  [ $first -eq 1 ] && printf '%s\n' "${c_dim}  Claude Code: $CLAUDE ($("$CLAUDE" --version 2>/dev/null | head -1))${c_0}"
  start=$(date +%s)
  run_step "$id" "$log" "$note"; rc=$?
  mins=$(( ($(date +%s) - start) / 60 ))
  [ $DRY_RUN -eq 1 ] && exit 0
  if [ $PLAN_ONLY -eq 1 ]; then ok "Plán kroku $id je výše (celý v $log)."; exit 0; fi

  [ $rc -eq 0 ] || warn "claude skončil s kódem $rc (např. limit tahů nebo rozpočtu)."
  status="$(final_status "$log")"
  case "$status" in
    "STATUS: DONE"*) ;;
    "STATUS: BLOCKED"*) fail "Krok $id je blokovaný: ${status#STATUS: BLOCKED} – viz řádek BLOKOVÁNO v $PLAN." ;;
    *) fail "Krok $id neskončil STATUS: DONE (po $mins min, poslední stav: ${status:-žádný}). Viz $log." ;;
  esac
  is_done "$id"  || fail "Krok $id není v $PLAN odškrtnutý."
  gates "$LOG_DIR/${id}-${ts}" || fail "Kontroly po kroku $id neprošly (výstupy v $LOG_DIR)."
  dirty    && fail "Po kroku $id zůstaly necommitnuté změny."
  unpushed && fail "Krok $id má nepushnuté commity."

  ok "Krok $id hotový za $mins min."
  grep -A12 -E "^- \[x\] \*\*$(printf '%s' "$id" | sed 's/\./\\./g')[^0-9]" "$PLAN" | grep -m1 'Výsledek:' | sed 's/^ */   /'
  notify "Krok $id hotový"
  count=$((count+1)); first=0

  if printf '%s' "$line" | grep -q '\[zastavit po\]'; then
    warn "Krok $id je označený [zastavit po] – vyzkoušej výsledek a pak spusť skript znovu."; exit 0
  fi
  if [ $YES -eq 0 ] && [ $count -lt "$MAX_STEPS" ] && [ -n "$(next_step_line)" ]; then
    printf '%s' "Pokračovat krokem $(step_id "$(next_step_line)")? [Enter = ano, n = konec] "
    read -r answer </dev/tty || answer="n"
    [ "$answer" = "n" ] && exit 0
  fi
done
ok "Hotovo ($count kroků)."
