/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_ANALYTICS_URL?: string;
  readonly VITE_TAG_REPO_URL?: string;
  readonly VITE_SPELLCHROMA_DICT_URL?: string;
  readonly VITE_SPELLCHROMA_INDEX_URL?: string;
  readonly VITE_SPELLBOOK_COMBOS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
