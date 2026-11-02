import axios from "axios";
import { toast } from "sonner";
import { API_URL, LOGIN_PATH, USE_COOKIES } from "./config";
import { clearToken, getToken } from "./token";

// Shared API connection used by all pages.
const API = axios.create({
    baseURL: API_URL,
    timeout: 20000,
    withCredentials: USE_COOKIES,
});

// Send the saved login token with every request.
API.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
});

API.interceptors.response.use(
    (response) => {
        // Show a toast for success / error messages sent by the server.
        if (response?.data) {
            const data = response.data;
            const method = response.config.method?.toLowerCase();

            if (typeof data.success === "string" && data.success.length > 0) {
                toast.dismiss();
                toast.success(data.success);
            } else if (typeof data.error === "string" && data.error.length > 0) {
                toast.dismiss();
                toast.error(data.error);
            } else if (
                data.status === "success" &&
                typeof data.message === "string" &&
                data.message.length > 0
            ) {
                toast.dismiss();
                toast.success(data.message);
            } else if (
                method !== "get" &&
                typeof data.message === "string" &&
                data.message.length > 0 &&
                data.status !== false
            ) {
                toast.dismiss();
                toast.success(data.message);
            }
        }

        return response;
    },
    (error) => {
        const status = error?.response?.status;

        // 401 = not logged in: remove the token and go to the login page.
        if (
            status === 401 &&
            !String(error.config?.url ?? "").includes(LOGIN_PATH)
        ) {
            clearToken();
            window.location.hash = "#/login";
        }

        // Show a toast for every other error (same rules as your website).
        if (status !== 401) {
            const data = error?.response?.data;
            const validationErrors = data?.errors;

            const firstError =
                validationErrors && typeof validationErrors === "object"
                    ? Object.values(validationErrors)
                          .flat()
                          .find(
                              (message): message is string =>
                                  typeof message === "string" &&
                                  message.length > 0,
                          )
                    : undefined;

            const message =
                firstError ??
                (typeof data?.message === "string" && data.message.length > 0
                    ? data.message
                    : undefined) ??
                (typeof data?.error === "string" && data.error.length > 0
                    ? data.error
                    : undefined);

            if (message) {
                toast.dismiss();
                toast.error(message);
            }
        }

        return Promise.reject(error);
    },
);

export default API;