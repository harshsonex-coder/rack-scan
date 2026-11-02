import axios from "axios";
import API from "./axios";
import { LOGIN_PATH, USE_COOKIES } from "./config";
import { setToken } from "./token";

// The token can come back under different names depending on the API.
function extractToken(data: unknown): string {
    const d = data as Record<string, any> | null | undefined;
    const candidates = [
        d?.token,
        d?.access_token,
        d?.accessToken,
        d?.data?.token,
        d?.data?.access_token,
        d?.data?.accessToken,
        d?.user?.token,
    ];
    const found = candidates.find((v) => typeof v === "string" && v.length > 0);
    return found ?? "";
}

// Sends the login form to the API and saves the token.
// Throws an Error with a readable message if login fails.
export async function login(email: string, password: string): Promise<void> {
    try {
        const res = await API.post(LOGIN_PATH, { email, password });
        const data = res.data;

        if (data?.status === false) {
            throw new Error(data?.message || "Invalid name or password.");
        }

        const token = extractToken(data);

        if (token) {
            setToken(token);
            return;
        }

        if (USE_COOKIES) {
            // cookie login: nothing to store except a marker that we are logged in
            setToken("cookie-session");
            return;
        }

        const keys =
            data && typeof data === "object" ? Object.keys(data).join(", ") : "none";
        throw new Error(
            `Login worked but no token was found in the answer (fields: ${keys}). Tell your developer or send this to Claude.`,
        );
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            if (err.response) {
                const message = (err.response.data as { message?: string } | undefined)
                    ?.message;
                if (err.response.status === 404) {
                    throw new Error(
                        "Login address not found (404). The login path in src/lib/config.ts is probably wrong.",
                    );
                }
                throw new Error(message || `Login failed (error ${err.response.status}).`);
            }
            throw new Error(
                "Cannot reach the server. Check the internet, or the server may be blocking this app (CORS).",
            );
        }
        throw err instanceof Error ? err : new Error("Login failed.");
    }
}
