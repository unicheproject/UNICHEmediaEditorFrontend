// DEV runtime config. In a container this file is regenerated from env at startup
// (see docker/docker-entrypoint.sh) so the SAME image works across environments.
// IDP_URL must equal the issuer the Catalogue validates against (issuer-consistency rule).
window.__UNICHE_CONFIG__ = {
  IDP_URL: "https://idp.uniche-eccch.eu",
  REALM: "uniche",
  CLIENT_ID: "media-editor-web",
  AUDIENCE: "uniche-platform",
  CATALOGUE_URL: "https://catalogue.uniche-eccch.eu",
  MEDIA_EDITOR_API_URL: "https://uniche-media-editor-api.cfserver3.net",
};