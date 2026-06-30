/** Runtime configuration, read from the injected window.__UNICHE_CONFIG__ (see public/config.js). */
export interface UnicheConfig {
  idpUrl: string;
  realm: string;
  clientId: string;
  audience: string;
  catalogueUrl: string;
  mediaEditorApiUrl: string;
}

const injected = window.__UNICHE_CONFIG__;

export const config: UnicheConfig = {
  idpUrl: injected?.IDP_URL ?? "https://idp.uniche-eccch.eu",
  realm: injected?.REALM ?? "uniche",
  clientId: injected?.CLIENT_ID ?? "media-editor-web",
  audience: injected?.AUDIENCE ?? "uniche-platform",
  catalogueUrl: injected?.CATALOGUE_URL ?? "http://uniche-catalogue.localhost:8080",
  mediaEditorApiUrl: injected?.MEDIA_EDITOR_API_URL ?? "http://localhost:8000",
};
