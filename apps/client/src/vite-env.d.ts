/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SERVER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
