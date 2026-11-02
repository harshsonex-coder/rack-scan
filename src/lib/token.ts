const TOKEN_KEY = "rack_auth_token";

// The login token is saved on the phone so you stay logged in.
export function getToken(): string {
    try {
        return localStorage.getItem(TOKEN_KEY) ?? "";
    } catch {
        return "";
    }
}

export function setToken(token: string) {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch {
        // storage blocked: login lasts until the page is closed
    }
}

// Logout = remove the saved token.
export function clearToken() {
    try {
        localStorage.removeItem(TOKEN_KEY);
    } catch {
        // nothing to remove
    }
}
