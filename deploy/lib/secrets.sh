load_env() {
  local provider="${SECRETS_PROVIDER:-dotenv}"

  case "$provider" in
    op|1password)
      if command -v op &>/dev/null; then
        if [ -f .env ]; then
          eval "$(op inject -i .env -o - 2>/dev/null)"
        fi
      else
        echo "WARNING: SECRETS_PROVIDER=op but 1Password CLI is not installed. Falling back to dotenv." >&2
        [ -f .env ] && set -a && source .env && set +a
      fi
      ;;
    dotenv|env|"")
      [ -f .env ] && set -a && source .env && set +a
      ;;
    bitwarden)
      if command -v bw &>/dev/null; then
        if [ -f .env ]; then
          set -a
          source .env
          set +a
        fi
      else
        echo "WARNING: SECRETS_PROVIDER=bitwarden but Bitwarden CLI is not installed. Falling back to dotenv." >&2
        [ -f .env ] && set -a && source .env && set +a
      fi
      ;;
    *)
      echo "WARNING: Unknown SECRETS_PROVIDER '$provider'. Falling back to dotenv." >&2
      [ -f .env ] && set -a && source .env && set +a
      ;;
  esac
}

check_critical_vars() {
  local missing=0
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: Required variable '$var' is not set. Check your secrets provider." >&2
      missing=1
    fi
  done
  return $missing
}
