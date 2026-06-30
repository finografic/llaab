# Port numbers used by LLAAB

**Current LLAAB port map:**

| Port    | Service        | Owned by               | Purpose                                                                   |
| ------- | -------------- | ---------------------- | ------------------------------------------------------------------------- |
| `5050`  | LLAAB Client   | LLAAB                  | Vite React SPA at `http://llaab.localhost:5050` / `http://localhost:5050` |
| `8888`  | LLAAB Server   | LLAAB                  | Bun/Hono API server; Vite proxies `/api/*` and `/terminal` here           |
| `5001`  | Icons API      | LLAAB / `@llaab/icons` | Icons write-back/API server                                               |
| `5199`  | Lucide Manager | LLAAB / icon tooling   | Icon picker UI, opened via `/icons` → `/dev/icons`                        |
| `11434` | Ollama         | External local tool    | Local Ollama API, configured by `OLLAMA_HOST=http://localhost:11434`      |
| `1234`  | LM Studio      | External local tool    | OpenAI-compatible local API at `http://localhost:1234/v1`                 |

---

**Also relevant, but not local listening ports:**

| Endpoint                        | Service            | Notes                                                          |
| ------------------------------- | ------------------ | -------------------------------------------------------------- |
| `https://opencode.ai/zen/go/v1` | OpenCode Go        | Remote OpenAI-compatible API, HTTPS `443`                      |
| Discord gateway/API             | Hermes Discord bot | Outbound HTTPS/WebSocket, generally `443`; no local LLAAB port |
| YouTube / Google APIs           | ingestion/OAuth    | Outbound HTTPS `443`                                           |

---

**Important env/config references:**

- Client port: `.env` / `.env.example` → `PORT=5050`
- Server target: `LLAAB_API_URL=http://localhost:8888`
- Server default: `apps/server/src/index.ts` → `PORT ?? 8888`
- Ollama: `OLLAMA_HOST=http://localhost:11434`
- LM Studio: `LLAAB_LMSTUDIO_BASE_URL` or default `http://localhost:1234/v1`
- Icon picker: `lucide-manager.config.json` controls `5199`; icons API uses `5001`

---

**So the practical “don’t conflict with these” list is:**

```
5050  LLAAB client
8888  LLAAB server
5001  icons API
5199  Lucide Manager
11434 Ollama
1234  LM Studio
```
