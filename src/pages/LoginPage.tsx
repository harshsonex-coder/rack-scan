import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Loader2, ScanLine, Warehouse } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { login } from "../lib/auth";
import { getToken } from "../lib/token";

export default function LoginPage() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Already logged in: skip the login screen.
    if (getToken()) return <Navigate to="/" replace />;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!name.trim() || !password) {
            setError("Please enter your name and password.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await login(name.trim(), password);
            navigate("/", { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Login failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid min-h-screen w-full grid-cols-1 bg-white md:grid-cols-12">
            {/* LEFT SIDE: picture panel (hidden on phones) */}
            <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-[#173A70] to-[#2563EB] md:col-span-6 md:flex xl:col-span-8">
                <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-white/10" />
                <div className="absolute -right-16 -top-16 size-72 rounded-full bg-white/10" />

                <div className="relative z-10 flex max-w-md flex-col items-center px-8 text-center text-white">
                    <div className="flex size-24 items-center justify-center rounded-3xl bg-white/15">
                        <Warehouse className="size-12" />
                    </div>
                    <h1 className="mt-6 text-3xl font-bold">Rack Scanner</h1>
                    <p className="mt-2 text-white/80">
                        Scan racks and product barcodes quickly and keep your
                        warehouse stock up to date.
                    </p>
                </div>
            </div>

            {/* RIGHT SIDE: form */}
            <div className="flex flex-col justify-center px-6 py-10 md:col-span-6 md:px-12 xl:col-span-4">
                <div className="mx-auto w-full max-w-sm">
                    {/* logo shown on phones */}
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[#173A70] text-white md:hidden">
                        <ScanLine className="size-8" />
                    </div>

                    <h2 className="mb-6 text-center text-3xl font-bold text-slate-900 md:text-4xl">
                        Login your account
                    </h2>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label
                                htmlFor="login-name"
                                className="text-sm font-medium text-gray-700"
                            >
                                Name
                            </label>
                            <Input
                                id="login-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your email or username"
                                autoComplete="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                disabled={loading}
                                className="mt-1 h-11 rounded-xl border-gray-300 focus-visible:border-blue-500 focus-visible:ring-blue-200"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="login-password"
                                className="text-sm font-medium text-gray-700"
                            >
                                Password
                            </label>
                            <div className="relative mt-1">
                                <Input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    disabled={loading}
                                    className="h-11 rounded-xl border-gray-300 pr-11 focus-visible:border-blue-500 focus-visible:ring-blue-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-5" />
                                    ) : (
                                        <Eye className="size-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="h-11 w-full gap-2 rounded-xl bg-[#173A70] text-base font-semibold text-white transition-all duration-200 hover:bg-blue-700"
                        >
                            {loading && <Loader2 className="size-5 animate-spin" />}
                            {loading ? "Signing in..." : "Sign In"}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
