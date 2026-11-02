import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import API from "../lib/axios";
import Heading from "../components/layout/heading";
import BarcodeScanner from "../components/BarcodeScanner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    ArrowLeft,
    Barcode,
    Package,
    Search,
    RefreshCw,
    Warehouse,
    X,
    Boxes,
    ScanLine,
    CheckCircle2,
    AlertCircle,
    Keyboard,
} from "lucide-react";

interface RackInstockBarcode {
    instock_id: number;
    instock_product_barcode: string;
    instock_product_id: number;
    instock_rack_barcode_id: number;
}

interface RackDetails {
    rack_barcode_id: number;
    rack_barcode: string;
}

interface RackInstockBarcodeResponse {
    status: boolean;
    message: string;
    rack: RackDetails | null;
    total: number;
    data: RackInstockBarcode[];
}

interface ScanSkuResponse {
    status: boolean;
    type?: string;
    message: string;
    product_code?: string;
    scanned_barcode?: string;
    existing_barcode?: string;
    existing_rack_barcode_id?: number;
    existing_rack_name?: string;
    child_barcodes?: string[];
    total_found?: number;
    moved_count?: number;
    already_in_rack?: number;
    created_count?: number;
}

interface ApiErrorResponse {
    status?: boolean;
    message?: string;
}

const barcodeColors = [
    "border-blue-300 bg-blue-100 text-blue-900",
    "border-cyan-300 bg-cyan-100 text-cyan-900",
    "border-emerald-300 bg-emerald-100 text-emerald-900",
    "border-purple-300 bg-purple-100 text-purple-900",
    "border-amber-300 bg-amber-100 text-amber-900",
    "border-red-300 bg-red-100 text-red-900",
    "border-indigo-300 bg-indigo-100 text-indigo-900",
    "border-teal-300 bg-teal-100 text-teal-900",
    "border-orange-300 bg-orange-100 text-orange-900",
    "border-pink-300 bg-pink-100 text-pink-900",
    "border-slate-300 bg-slate-100 text-slate-900",
    "border-lime-300 bg-lime-100 text-lime-900",
];

const getBarcodeColor = (barcode: string) => {
    let hash = 0;

    for (let i = 0; i < barcode.length; i++) {
        hash = (hash * 31 + barcode.charCodeAt(i)) | 0;
    }

    return barcodeColors[Math.abs(hash) % barcodeColors.length];
};

const scanSkuApi = async (
    scannedBarcode: string,
    rackBarcodeId: number,
): Promise<ScanSkuResponse> => {
    const response = await API.post<ScanSkuResponse>(
        "api/warehouse-instock/scan-product-barcode",
        {
            rack_barcode_id: rackBarcodeId,
            barcode_product_code: scannedBarcode.trim(),
        },
    );

    return response.data;
};

export default function RackInstockDetails() {
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();

    const rackBarcodeId = Number(params.id);

    const [searchInput, setSearchInput] = useState("");
    const [manualBarcode, setManualBarcode] = useState("");
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanMessage, setScanMessage] = useState("");
    const [scanStatus, setScanStatus] = useState<"success" | "error" | null>(
        null,
    );
    const [isScanning, setIsScanning] = useState(false);
    const [recentScans, setRecentScans] = useState<string[]>([]);

    const manualBarcodeRef = useRef<HTMLInputElement>(null);
    const isScanningRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);

    const unlockScanAudio = useCallback(async (): Promise<AudioContext | null> => {
        try {
            const AudioContextClass =
                window.AudioContext ||
                (
                    window as typeof window & {
                        webkitAudioContext?: typeof AudioContext;
                    }
                ).webkitAudioContext;

            if (!AudioContextClass) {
                return null;
            }

            if (
                !audioContextRef.current ||
                audioContextRef.current.state === "closed"
            ) {
                audioContextRef.current = new AudioContextClass();
            }

            const context = audioContextRef.current;

            if (context.state === "suspended") {
                await context.resume();
            }

            return context;
        } catch {
            return null;
        }
    }, []);

    const playScanBeep = useCallback(
        async (type: "success" | "error" = "success"): Promise<void> => {
            const context = await unlockScanAudio();

            if (!context || context.state !== "running") {
                return;
            }

            const now = context.currentTime;

            const playTone = (
                frequency: number,
                start: number,
                duration: number,
                volume: number,
                wave: OscillatorType = "sine",
                endFrequency?: number,
            ) => {
                const oscillator = context.createOscillator();
                const gain = context.createGain();

                oscillator.type = wave;
                oscillator.frequency.setValueAtTime(frequency, start);

                if (endFrequency !== undefined) {
                    oscillator.frequency.exponentialRampToValueAtTime(
                        endFrequency,
                        start + duration,
                    );
                }

                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(
                    volume,
                    start + 0.015,
                );
                gain.gain.setValueAtTime(
                    volume,
                    start + duration * 0.25,
                );
                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    start + duration,
                );

                oscillator.connect(gain);
                gain.connect(context.destination);

                oscillator.start(start);
                oscillator.stop(start + duration);
            };

            const playImpactNoise = (
                start: number,
                duration: number,
                volume: number,
            ) => {
                const bufferSize = Math.floor(
                    context.sampleRate * duration,
                );

                const buffer = context.createBuffer(
                    1,
                    bufferSize,
                    context.sampleRate,
                );

                const channel = buffer.getChannelData(0);

                for (let i = 0; i < bufferSize; i++) {
                    const fade = Math.pow(1 - i / bufferSize, 3);
                    channel[i] = (Math.random() * 2 - 1) * fade;
                }

                const source = context.createBufferSource();
                const filter = context.createBiquadFilter();
                const gain = context.createGain();

                source.buffer = buffer;

                filter.type = "lowpass";
                filter.frequency.setValueAtTime(160, start);
                filter.frequency.exponentialRampToValueAtTime(
                    35,
                    start + duration,
                );

                gain.gain.setValueAtTime(volume, start);
                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    start + duration,
                );

                source.connect(filter);
                filter.connect(gain);
                gain.connect(context.destination);

                source.start(start);
                source.stop(start + duration);
            };

            if (type === "success") {
                playTone(659.25, now, 0.14, 0.16);
                playTone(830.61, now + 0.12, 0.16, 0.18);
                playTone(1046.5, now + 0.25, 0.2, 0.2);
                playTone(1318.51, now + 0.43, 0.3, 0.12);
            } else {
                playTone(95, now, 0.85, 0.7, "sine", 28);
                playTone(48, now, 1.0, 0.55, "sine", 22);
                playTone(170, now, 0.2, 0.25, "sawtooth", 55);

                playImpactNoise(now, 0.7, 0.3);

                playTone(440, now + 0.35, 0.2, 0.15, "triangle", 330);
                playTone(330, now + 0.58, 0.2, 0.15, "triangle", 220);
                playTone(220, now + 0.81, 0.28, 0.18, "triangle", 110);
            }
        },
        [unlockScanAudio],
    );

    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                void audioContextRef.current.close().catch(() => undefined);
                audioContextRef.current = null;
            }
        };
    }, []);

    const {
        data: barcodeResponse,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
    } = useQuery<RackInstockBarcodeResponse>({
        queryKey: ["rack-instock-barcodes", rackBarcodeId],
        queryFn: async () => {
            const response = await API.get<RackInstockBarcodeResponse>(
                `api/warehouse-instock/rack-instock-barcodes/${rackBarcodeId}`,
            );

            return response.data;
        },
        enabled: Number.isInteger(rackBarcodeId) && rackBarcodeId > 0,
        staleTime: 0,
    });

    const barcodes = barcodeResponse?.data ?? [];

    const filteredBarcodes = useMemo(() => {
        const value = searchInput.trim().toLowerCase();

        if (!value) {
            return barcodes;
        }

        return barcodes.filter((item) =>
            item.instock_product_barcode?.toLowerCase().includes(value),
        );
    }, [barcodes, searchInput]);

    const handleClearSearch = () => {
        setSearchInput("");
        setScanMessage("");
        setScanStatus(null);
    };

    useEffect(() => {
        const focusBarcodeInput = () => {
            const isDesktop = window.matchMedia("(min-width: 768px)").matches;

            if (
                isDesktop &&
                document.visibilityState === "visible" &&
                !isScanningRef.current &&
                !scannerOpen &&
                manualBarcodeRef.current &&
                !manualBarcodeRef.current.disabled
            ) {
                manualBarcodeRef.current.focus();
            }
        };

        const timeoutId = window.setTimeout(focusBarcodeInput, 300);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                window.setTimeout(focusBarcodeInput, 100);
            }
        };

        window.addEventListener("focus", focusBarcodeInput);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener("focus", focusBarcodeInput);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, [scannerOpen]);

    const handleSkuScan = useCallback(
        async (scannedBarcode: string): Promise<void> => {
            const barcode = scannedBarcode.trim();

            if (!barcode || isScanningRef.current || !rackBarcodeId) {
                return;
            }

            isScanningRef.current = true;
            setIsScanning(true);
            setSearchInput("");
            setManualBarcode("");
            setScanMessage("");
            setScanStatus(null);

            try {
                const response = await scanSkuApi(barcode, rackBarcodeId);

                if (response.type === "rack") {
                    setScanMessage(response.message);
                    setScanStatus("success");

                    await playScanBeep("success");

                    setScannerOpen(false);
                    navigate("/");
                    return;
                }

                setScanMessage(response.message);
                setScanStatus(response.status ? "success" : "error");

                if (response.status) {
                    await playScanBeep("success");

                    setRecentScans((previous) =>
                        [barcode, ...previous.filter((item) => item !== barcode)].slice(
                            0,
                            20,
                        ),
                    );

                    await refetch();
                    setSearchInput("");
                } else {
                    await playScanBeep("error");
                }
            } catch (err: unknown) {
                let message = "Unable to process the scanned SKU.";

                if (axios.isAxiosError<ApiErrorResponse>(err)) {
                    message =
                        err.response?.data?.message ??
                        err.message ??
                        message;
                } else if (err instanceof Error) {
                    message = err.message;
                }

                setScanMessage(message);
                setScanStatus("error");

                await playScanBeep("error");
            } finally {
                isScanningRef.current = false;
                setIsScanning(false);

                if (
                    !scannerOpen &&
                    window.matchMedia("(min-width: 768px)").matches
                ) {
                    window.setTimeout(() => {
                        manualBarcodeRef.current?.focus();
                    }, 150);
                }
            }
        },
        [rackBarcodeId, playScanBeep, refetch, navigate, scannerOpen],
    );

    const handleManualBarcodeSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        const barcode = manualBarcode.trim();

        if (!barcode || isScanningRef.current) {
            return;
        }

        setManualBarcode("");
        await handleSkuScan(barcode);

        if (
            !scannerOpen &&
            window.matchMedia("(min-width: 768px)").matches
        ) {
            manualBarcodeRef.current?.focus();
        }
    };

    return (
        <div className="mt-3 w-full min-w-0 space-y-5 px-3 pb-6 sm:space-y-6 sm:px-5 lg:px-6">
            <Heading>
                <div className="flex w-full flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#173A70] text-white shadow-sm">
                            <Warehouse className="size-5" />
                        </div>

                        <div className="min-w-0">
                            <h1 className="text-lg font-bold tracking-tight text-[#173A70] sm:text-2xl">
                                Rack Instock Details
                            </h1>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <p className="text-xs text-slate-500 sm:text-sm">
                                    Rack:
                                </p>

                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#173A70] sm:text-sm">
                                    <Warehouse className="size-3.5" />
                                    {barcodeResponse?.rack?.rack_barcode}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                                View and search all product barcodes stored in
                                this rack.
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/")}
                        className="h-10 w-full gap-2 rounded-xl border-slate-200 text-[#173A70] hover:bg-blue-50 sm:w-auto"
                    >
                        <ArrowLeft className="size-4" />
                        Back to Racks
                    </Button>
                </div>
            </Heading>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Barcode className="size-5" />
                        </div>

                        <div>
                            <h2 className="text-sm font-bold text-[#173A70]">
                                Product Barcodes
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Search or scan a product SKU in this rack.
                            </p>
                        </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

                            <Input
                                value={searchInput}
                                onChange={(event) => {
                                    setSearchInput(event.target.value);
                                    setScanMessage("");
                                    setScanStatus(null);
                                }}
                                placeholder="Search product barcode..."
                                className="h-11 rounded-xl border-slate-200 pl-9 pr-10 text-sm focus-visible:border-blue-400 focus-visible:ring-blue-100"
                            />

                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    aria-label="Clear search"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>

                        <Button
                            type="button"
                            onClick={() => {
                                void unlockScanAudio();
                                setScanMessage("");
                                setScanStatus(null);
                                setScannerOpen(true);
                            }}
                            disabled={isLoading || isScanning}
                            className="h-11 shrink-0 gap-2 rounded-xl bg-[#173A70] px-4 text-white hover:bg-[#2563EB]"
                        >
                            <ScanLine className="size-4" />
                            {isScanning ? "Processing..." : "Camera Scan"}
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="h-11 shrink-0 gap-2 rounded-xl border-slate-200 px-3 text-[#173A70] hover:bg-blue-50"
                        >
                            <RefreshCw
                                className={`size-4 ${
                                    isFetching ? "animate-spin" : ""
                                }`}
                            />
                            <span className="hidden sm:inline">Refresh</span>
                        </Button>
                    </div>
                </div>

                <form
                    onSubmit={handleManualBarcodeSubmit}
                    className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row"
                >
                    <div className="relative min-w-0 flex-1">
                        <Keyboard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

                        <Input
                            ref={manualBarcodeRef}
                            value={manualBarcode}
                            onClick={() => {
                                void unlockScanAudio();
                            }}
                            onChange={(event) => {
                                setManualBarcode(event.target.value);
                                setScanMessage("");
                                setScanStatus(null);
                            }}
                            placeholder="Scan with USB/Bluetooth scanner or enter barcode manually..."
                            disabled={isScanning}
                            autoComplete="off"
                            className="h-11 rounded-xl border-slate-200 pl-9 text-sm focus-visible:border-blue-400 focus-visible:ring-blue-100"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={!manualBarcode.trim() || isScanning}
                        className="h-11 gap-2 rounded-xl bg-[#173A70] px-5 text-white hover:bg-[#2563EB]"
                    >
                        <Barcode className="size-4" />
                        {isScanning ? "Processing..." : "Add Barcode"}
                    </Button>
                </form>

                <p className="mt-2 text-xs text-slate-500">
                    You can use the camera, a USB/Bluetooth barcode scanner, or
                    enter a barcode manually. For a physical scanner, focus this
                    input and scan; configure the scanner to send Enter after
                    each barcode.
                </p>

                {scanMessage && (
                    <div
                        className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                            scanStatus === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-red-200 bg-red-50 text-red-700"
                        }`}
                    >
                        {scanStatus === "success" ? (
                            <CheckCircle2 className="size-5 shrink-0" />
                        ) : (
                            <AlertCircle className="size-5 shrink-0" />
                        )}

                        <span>{scanMessage}</span>
                    </div>
                )}

                {searchInput && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-500">
                            Searching for{" "}
                            <span className="font-semibold text-[#173A70]">
                                {searchInput}
                            </span>
                        </p>

                        <p className="text-xs font-semibold text-[#2563EB]">
                            {filteredBarcodes.length} results found
                        </p>
                    </div>
                )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-[#173A70] text-white">
                            <Boxes className="size-5" />
                        </div>

                        <div>
                            <h2 className="text-base font-bold text-[#173A70]">
                                {barcodeResponse?.rack?.rack_barcode}
                            </h2>

                            <p className="mt-1 text-xs text-slate-500">
                                Each product barcode is displayed as a separate
                                colored badge.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                            Total: {barcodeResponse?.total ?? 0}
                        </span>

                        <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                            Showing: {filteredBarcodes.length}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3">
                        <RefreshCw className="size-8 animate-spin text-[#2563EB]" />
                        <p className="text-sm text-slate-500">
                            Loading rack product barcodes...
                        </p>
                    </div>
                ) : isError ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
                        <p className="text-sm font-medium text-red-600">
                            {error instanceof Error
                                ? error.message
                                : "Unable to load product barcodes."}
                        </p>

                        <Button
                            type="button"
                            onClick={() => refetch()}
                            variant="outline"
                            className="rounded-lg border-slate-200 text-[#173A70]"
                        >
                            Try Again
                        </Button>
                    </div>
                ) : filteredBarcodes.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
                            <Package className="size-7 text-slate-400" />
                        </div>

                        <h3 className="font-semibold text-slate-700">
                            {searchInput
                                ? "No matching barcodes found"
                                : "No products in this rack"}
                        </h3>

                        <p className="max-w-sm text-sm text-slate-500">
                            {searchInput
                                ? "Try searching with another product barcode."
                                : "There are currently no available product barcodes stored in this rack."}
                        </p>

                        {searchInput && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClearSearch}
                                className="rounded-lg"
                            >
                                Clear Search
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
                        {filteredBarcodes.map((item) => (
                            <div
                                key={item.instock_id}
                                className={`group inline-flex w-fit max-w-full items-center gap-2.5 rounded-xl border px-4 py-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${getBarcodeColor(
                                    item.instock_product_barcode,
                                )}`}
                            >
                                <p
                                    className="break-all text-sm font-bold leading-5"
                                    title={item.instock_product_barcode}
                                >
                                    {item.instock_product_barcode}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <BarcodeScanner
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={handleSkuScan}
                recentScans={recentScans}
                isProcessing={isScanning}
            />
        </div>
    );
}