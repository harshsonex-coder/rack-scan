import {
    HashRouter,
    Navigate,
    Outlet,
    Route,
    Routes,
    useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { LogOut, Warehouse } from "lucide-react";
import InstockPage from "./pages/InstockPage";
import RackDetailsPage from "./pages/RackDetailsPage";
import LoginPage from "./pages/LoginPage";
import { clearToken, getToken } from "./lib/token";
import { Toaster } from "sonner";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false },
    },
});

function TopBar() {
    const navigate = useNavigate();
    const client = useQueryClient();

    // Logout: remove the saved token and the loaded data, then show the login page.
    const handleLogout = () => {
        clearToken();
        client.clear();
        navigate("/login", { replace: true });
    };

    return (
        <header className="sticky top-0 z-40 flex items-center justify-between bg-[#173A70] px-3 py-2 text-white shadow">
            <div className="flex items-center gap-2">
                <Warehouse className="size-5" />
                <span className="font-bold">Rack Scanner</span>
            </div>

            <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold"
            >
                <LogOut className="size-4" />
                Logout
            </button>
        </header>
    );
}

// Pages inside this layout need a login. Without a token, go to the login page.
function ProtectedLayout() {
    if (!getToken()) return <Navigate to="/login" replace />;

    return (
        <>
            <TopBar />
            <Outlet />
        </>
    );
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            {/* HashRouter: works on any free hosting without extra setup */}
              <Toaster richColors position="top-center" />
            <HashRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route element={<ProtectedLayout />}>
                        <Route path="/" element={<InstockPage />} />
                        <Route path="/rack/:id" element={<RackDetailsPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </HashRouter>
        </QueryClientProvider>
    );
}
