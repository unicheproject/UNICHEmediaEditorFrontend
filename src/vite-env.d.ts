/// <reference types="vite/client" />

interface UnicheRuntimeConfig {
  IDP_URL: string;
  REALM: string;
  CLIENT_ID: string;
  AUDIENCE: string;
  CATALOGUE_URL: string;
  MEDIA_EDITOR_API_URL: string;
}

interface Window {
  __UNICHE_CONFIG__?: UnicheRuntimeConfig;
}
