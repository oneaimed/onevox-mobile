export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// Versao do termo de consentimento da aba Treino (coleta de audio para pesquisa).
// Bump ao mudar o texto do termo -> quem aceitou versao antiga precisa reaceitar.
export const TRAINING_CONSENT_VERSION = "1.0";
