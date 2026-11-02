// ============================================================
//  ONE PLACE FOR APP SETTINGS  (change here if something differs)
// ============================================================

// Your API address (used by every page of the app).
export const API_URL = "https://background-onlinefayda-api.3stage.in";

// The login endpoint, added after API_URL.
// !! I did not have your login API, so "api/login" is a GUESS.
// !! If login says "not found" (404), change this to your real login path.
export const LOGIN_PATH = "api/login";

// Set to true only if your API logs in with cookies instead of a token.
// (Needs the server to allow cookies from this app: CORS "credentials".)
export const USE_COOKIES = false;
