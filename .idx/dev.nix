# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  channel = "unstable";

  packages = [
    pkgs.gcc
    pkgs.mise
    pkgs.openssl
    pkgs.pkg-config
  ];

  env = {};

  idx = {
    extensions = [];

    previews = {
      enable = true;
      previews = {
        web = {
          command = [
            "sh"
            "-c"
            ''
              export PATH="$HOME/.local/share/mise/shims:$PATH"
              bun run --cwd apps/web migrate
              bun run --cwd apps/web seed
              exec bun run --cwd apps/web dev:server -- --host 0.0.0.0 --port "$PORT"
            ''
          ];
          manager = "web";
          env = {
            PORT = "$PORT";
            TRUSTED_PROXY = "true";
            __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS = ".cloudworkstations.dev";
          };
        };
      };
    };

    workspace = {
      onCreate = {
        bootstrap = ''
          set -eu
          export PATH="$HOME/.local/share/mise/shims:$PATH"

          if [ ! -f .env ]; then
            cp .env.example .env
          fi

          set_env_value() {
            key="$1"
            value="$2"
            escaped_value="$(printf '%s' "$value" | sed 's/[&|]/\\&/g')"
            if grep -q "^''${key}=" .env; then
              sed -i "s|^''${key}=.*|''${key}=''${escaped_value}|" .env
            else
              printf '\n%s=%s\n' "$key" "$value" >> .env
            fi
          }

          get_env_value() {
            key="$1"
            grep "^''${key}=" .env | tail -n 1 | cut -d= -f2-
          }

          ensure_generated_value() {
            key="$1"
            value="$2"
            current_value="$(get_env_value "$key" || true)"
            if [ -z "$current_value" ]; then
              set_env_value "$key" "$value"
            fi
          }

          ensure_generated_value "SESSION_SECRET" "$(openssl rand -base64 32)"
          ensure_generated_value "TOTP_ENCRYPTION_KEY" "$(openssl rand -base64 32)"
          ensure_generated_value "ENGINE_HMAC_SECRET" "$(openssl rand -hex 32)"

          engine_hmac_secret="$(get_env_value "ENGINE_HMAC_SECRET" || true)"
          if [ -n "$engine_hmac_secret" ]; then
            ensure_generated_value \
              "ENGINE_HMAC_KEYS_JSON" \
              "'{\"web\":\"$engine_hmac_secret\"}'"
          fi

          mise install
          bun install
          mise run generate
        '';
      };

      onStart = {
        engine = ''
          export PATH="$HOME/.local/share/mise/shims:$PATH"
          cargo run -p engine --bin engine
        '';
      };
    };
  };
}
