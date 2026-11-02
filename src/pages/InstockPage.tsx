import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
} from "react";
import Heading from "../components/layout/heading";
import API from "../lib/axios";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    Download,
    Search,
    Package,
    RefreshCw,
    Warehouse,
    X,
    CheckCircle2,
    Activity,
    Camera,
    Keyboard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BarcodeScanner from "../components/BarcodeScanner";

interface RackCell {
    rack_barcode_id: number;
    rack_barcode: string;
    rack_id: number;
    available_count: number;
    capacity: number;
    occupancy_status:
        | "empty"
        | "available"
        | "nearly_full"
        | "full"
        | "over_capacity";
}

interface Rack {
    rack_id: number;
    warehouse_id: number;
    rack_column_title: string;
    rack_row: number;
    rack_limit: number;
    rack_status: number;
    total_sub_racks: number;
    total_available_stock: number;
    sub_racks: RackCell[];
}

interface RackResponse {
    status: boolean;
    message: string;
    data: Rack[];
}

export default function Instock() {
    const [searchInput, setSearchInput] = useState("");
    const [selectedCell, setSelectedCell] = useState<RackCell | null>(null);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [manualBarcode, setManualBarcode] = useState("");
    const [scanMessage, setScanMessage] = useState("");
    const [scanMessageType, setScanMessageType] = useState<
        "success" | "error" | ""
    >("");
    const manualBarcodeRef = useRef<HTMLInputElement>(null);
    const isHandlingScanRef = useRef(false);

    const navigate = useNavigate();
    const playScanBeep = useCallback(() => {
        try {
            const AudioContextClass =
                window.AudioContext ||
                (
                    window as typeof window & {
                        webkitAudioContext?: typeof AudioContext;
                    }
                ).webkitAudioContext;

            if (!AudioContextClass) return;

            const audioContext = new AudioContextClass();

            const playTone = (
                frequency: number,
                startTime: number,
                duration: number,
                volume: number,
            ) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.type = "sine";
                oscillator.frequency.setValueAtTime(frequency, startTime);

                gainNode.gain.setValueAtTime(0.0001, startTime);
                gainNode.gain.exponentialRampToValueAtTime(
                    volume,
                    startTime + 0.025,
                );
                gainNode.gain.setValueAtTime(
                    volume,
                    startTime + duration - 0.05,
                );
                gainNode.gain.exponentialRampToValueAtTime(
                    0.0001,
                    startTime + duration,
                );

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            };

            const now = audioContext.currentTime;

            playTone(1046.5, now, 0.16, 0.18);
            playTone(1318.5, now + 0.13, 0.2, 0.2);
            playTone(1568, now + 0.29, 0.24, 0.16);

            setTimeout(() => {
                void audioContext.close();
            }, 700);
        } catch {
            // Audio is unavailable or blocked by the browser.
        }
    }, []);
    const {
        data: rackResponse,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
    } = useQuery<RackResponse>({
        queryKey: ["warehouse-instock-racks"],
        queryFn: async () => {
            const response = await API.get<RackResponse>(
                "api/warehouse-instock/rack-barcodes",
            );

            return response.data;
        },
        staleTime: 30_000,
    });

    const racks = rackResponse?.data ?? [];

    const filteredRacks = useMemo(() => {
        const value = searchInput.trim().toLowerCase();

        if (!value) {
            return racks;
        }

        return racks
            .map((rack) => ({
                ...rack,
                sub_racks: rack.sub_racks.filter(
                    (cell) =>
                        cell.rack_barcode.toLowerCase().includes(value) ||
                        rack.rack_column_title.toLowerCase().includes(value) ||
                        String(rack.rack_id).includes(value),
                ),
            }))
            .filter((rack) => rack.sub_racks.length > 0);
    }, [racks, searchInput]);

    const allCells = useMemo(
        () => racks.flatMap((rack) => rack.sub_racks),
        [racks],
    );

    const totalRacks = racks.length;
    const totalCells = allCells.length;

    const totalAvailableStock = allCells.reduce(
        (total, cell) => total + cell.available_count,
        0,
    );

    const emptyCells = allCells.filter(
        (cell) => cell.occupancy_status === "empty",
    ).length;

    const availableCells = allCells.filter(
        (cell) => cell.occupancy_status === "available",
    ).length;

    const nearlyFullCells = allCells.filter(
        (cell) => cell.occupancy_status === "nearly_full",
    ).length;

    const fullCells = allCells.filter(
        (cell) => cell.occupancy_status === "full",
    ).length;

    const overCapacityCells = allCells.filter(
        (cell) => cell.occupancy_status === "over_capacity",
    ).length;

    const totalCapacity = allCells.reduce(
        (total, cell) => total + cell.capacity,
        0,
    );

    const occupancyPercentage =
        totalCapacity > 0
            ? Math.min((totalAvailableStock / totalCapacity) * 100, 100)
            : 0;

    const getCellStyle = (cell: RackCell) => {
        switch (cell.occupancy_status) {
            case "empty":
                return "border-[#D6D6D6] bg-[#EEEEEE] text-[#707070] hover:bg-[#E2E2E2]";

            case "over_capacity":
                return "border-[#9333EA] bg-[#9333EA] text-white hover:bg-[#7E22CE]";

            case "full":
                return "border-[#EF3545] bg-[#EF3545] text-white hover:bg-[#DC2636]";

            case "nearly_full":
                return "border-[#F5BE13] bg-[#F5BE13] text-white hover:bg-[#E5A900]";

            default:
                return "border-[#2FC0CF] bg-[#2FC0CF] text-white hover:bg-[#20AEBE]";
        }
    };

    const getStatusLabel = (status: RackCell["occupancy_status"]) => {
        switch (status) {
            case "empty":
                return "Empty";
            case "available":
                return "Available";
            case "nearly_full":
                return "Nearly Full";
            case "full":
                return "Full";
            case "over_capacity":
                return "Over Capacity";
        }
    };
    useEffect(() => {
        const isMobile = window.matchMedia("(pointer: coarse)").matches;

        if (isMobile) return;

        const focusBarcodeInput = () => {
            if (
                document.visibilityState === "visible" &&
                document.activeElement !== manualBarcodeRef.current &&
                manualBarcodeRef.current &&
                !manualBarcodeRef.current.disabled
            ) {
                manualBarcodeRef.current.focus();
            }
        };

        const timeoutId = window.setTimeout(focusBarcodeInput, 300);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                focusBarcodeInput();
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
    }, []);
    const handleSelectCell = (cell: RackCell) => {
        navigate(`/rack/${cell.rack_barcode_id}`);
    };

    const handleClearSearch = () => {
        setSearchInput("");
        setSelectedCell(null);
    };

    const handleExport = () => {
        window.print();
    };

    const handleRackScan = useCallback(
        (barcode: string) => {
            const scannedBarcode = barcode.trim();

            if (!scannedBarcode) {
                return;
            }

            const scannedRack = allCells.find(
                (cell) =>
                    cell.rack_barcode.trim().toLowerCase() ===
                    scannedBarcode.toLowerCase(),
            );

            if (!scannedRack) {
                setScanMessage(
                    `Rack barcode "${scannedBarcode}" was not found.`,
                );
                setScanMessageType("error");
                setManualBarcode("");
                setScannerOpen(false);
                manualBarcodeRef.current?.focus();
                return;
            }

            setScanMessage(
                `Rack ${scannedRack.rack_barcode} found. Opening rack...`,
            );
            setScanMessageType("success");
            setManualBarcode("");
            setScannerOpen(false);

            playScanBeep();

            navigate(`/rack/${scannedRack.rack_barcode_id}`);
        },
        [allCells, playScanBeep, navigate],
    );

    const handleManualBarcodeSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isHandlingScanRef.current) {
            return;
        }

        const barcode = manualBarcode.trim();

        if (!barcode) {
            setScanMessage("Please enter or scan a rack barcode.");
            setScanMessageType("error");
            manualBarcodeRef.current?.focus();
            return;
        }

        isHandlingScanRef.current = true;
        setScanMessage("");
        setScanMessageType("");
        setManualBarcode("");

        handleRackScan(barcode);

        isHandlingScanRef.current = false;
        manualBarcodeRef.current?.focus();
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
                                Manage Instock
                            </h1>

                            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                                Monitor stock levels and capacity across your
                                warehouse racks.
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        onClick={handleExport}
                        className="h-10 w-full gap-2 rounded-xl bg-[#173A70] px-4 text-white shadow-sm transition hover:bg-[#102d59] sm:w-auto"
                    >
                        <Download className="size-4" />
                        Export Instock
                    </Button>
                </div>
            </Heading>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Search className="size-5" />
                        </div>

                        <div>
                            <h2 className="text-sm font-bold text-[#173A70]">
                                Find Rack or Sub-Rack
                            </h2>

                            <p className="mt-1 text-xs text-slate-500">
                                Search automatically by rack name, rack ID or
                                barcode.
                            </p>
                        </div>
                    </div>

                    <div className="flex w-full items-center gap-2 lg:max-w-md">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

                            <Input
                                value={searchInput}
                                onChange={(event) => {
                                    setSearchInput(event.target.value);
                                    setSelectedCell(null);
                                }}
                                placeholder="Search rack name or ID..."
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
                                setScanMessage("");
                                setScanMessageType("");
                                setScannerOpen(true);
                            }}
                            className="h-11 shrink-0 gap-2 rounded-xl bg-[#173A70] px-4 text-white hover:bg-[#102d59]"
                        >
                            <Camera className="size-4" />
                            <span>Scan Rack</span>
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
                    className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 sm:p-4"
                >
                    <div className="mb-3 flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-white text-[#2563EB] shadow-sm">
                            <Keyboard className="size-4" />
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-[#173A70]">
                                Barcode Scanner / Manual Entry
                            </h3>

                            <p className="text-xs text-slate-500">
                                Use a USB/Bluetooth scanner or enter the rack
                                barcode manually.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            ref={manualBarcodeRef}
                            value={manualBarcode}
                            onChange={(event) =>
                                setManualBarcode(event.target.value)
                            }
                            placeholder="Scan or enter rack barcode..."
                            autoComplete="off"
                            autoFocus
                            className="h-11 rounded-xl border-slate-200 bg-white text-sm focus-visible:border-blue-400 focus-visible:ring-blue-100"
                        />
                        <Button
                            type="submit"
                            disabled={!manualBarcode.trim()}
                            className="h-11 shrink-0 gap-2 rounded-xl bg-[#173A70] px-5 text-white hover:bg-[#102d59]"
                        >
                            <Search className="size-4" />
                            Find Rack
                        </Button>
                    </div>

                    {scanMessage && (
                        <div
                            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                                scanMessageType === "success"
                                    ? "bg-green-50 text-green-700"
                                    : "bg-red-50 text-red-700"
                            }`}
                        >
                            {scanMessageType === "success" ? (
                                <CheckCircle2 className="size-4 shrink-0" />
                            ) : (
                                <X className="size-4 shrink-0" />
                            )}
                            {scanMessage}
                        </div>
                    )}
                </form>

                {searchInput && (
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-500">
                            Showing results for{" "}
                            <span className="font-semibold text-[#173A70]">
                                {searchInput}
                            </span>
                        </p>

                        <p className="text-xs font-semibold text-[#2563EB]">
                            {filteredRacks.reduce(
                                (total, rack) => total + rack.sub_racks.length,
                                0,
                            )}{" "}
                            cells found
                        </p>
                    </div>
                )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Warehouse className="size-5 text-[#173A70]" />

                                <h2 className="text-base font-bold text-[#173A70]">
                                    Warehouse Rack Layout
                                </h2>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                                Select a sub-rack to view its stock and capacity
                                details.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {[
                                {
                                    label: "Empty",
                                    color: "bg-[#EEEEEE] ring-1 ring-slate-300",
                                },
                                {
                                    label: "Available",
                                    color: "bg-[#2FC0CF]",
                                },
                                {
                                    label: "Nearly Full",
                                    color: "bg-[#F5BE13]",
                                },
                                {
                                    label: "Full",
                                    color: "bg-[#EF3545]",
                                },
                                {
                                    label: "Over Capacity",
                                    color: "bg-[#9333EA]",
                                },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        className={`size-3 rounded ${item.color}`}
                                    />
                                    <span className="text-xs text-slate-600">
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">
                                Total Racks
                            </span>
                            <Warehouse className="size-5 text-[#2563EB]" />
                        </div>

                        <p className="mt-2 text-2xl font-bold text-[#173A70]">
                            {totalRacks}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">
                                Total Sub-Racks
                            </span>
                            <Package className="size-5 text-[#2FC0CF]" />
                        </div>

                        <p className="mt-2 text-2xl font-bold text-[#173A70]">
                            {totalCells}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">
                                Available Stock
                            </span>
                            <CheckCircle2 className="size-5 text-[#2FC0CF]" />
                        </div>

                        <p className="mt-2 text-2xl font-bold text-[#173A70]">
                            {totalAvailableStock}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">
                                Rack Occupancy
                            </span>
                            <Activity className="size-5 text-[#80C66B]" />
                        </div>

                        <p className="mt-2 text-2xl font-bold text-[#173A70]">
                            {occupancyPercentage.toFixed(1)}%
                        </p>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-[#80C66B] transition-all"
                                style={{
                                    width: `${occupancyPercentage}%`,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-5 sm:px-5">
                    {[
                        {
                            label: "Empty",
                            count: emptyCells,
                            color: "text-slate-600",
                            bg: "bg-slate-100",
                        },
                        {
                            label: "Available",
                            count: availableCells,
                            color: "text-cyan-700",
                            bg: "bg-cyan-50",
                        },
                        {
                            label: "Nearly Full",
                            count: nearlyFullCells,
                            color: "text-amber-700",
                            bg: "bg-amber-50",
                        },
                        {
                            label: "Full",
                            count: fullCells,
                            color: "text-red-700",
                            bg: "bg-red-50",
                        },
                        {
                            label: "Over Capacity",
                            count: overCapacityCells,
                            color: "text-purple-700",
                            bg: "bg-purple-50",
                        },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className={`rounded-xl ${item.bg} p-3`}
                        >
                            <p className={`text-xs font-medium ${item.color}`}>
                                {item.label}
                            </p>
                            <p
                                className={`mt-1 text-xl font-bold ${item.color}`}
                            >
                                {item.count}
                            </p>
                        </div>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3">
                        <RefreshCw className="size-8 animate-spin text-[#2563EB]" />
                        <p className="text-sm text-slate-500">
                            Loading warehouse rack cells...
                        </p>
                    </div>
                ) : isError ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
                        <p className="text-sm font-medium text-red-600">
                            {error instanceof Error
                                ? error.message
                                : "Unable to load rack data."}
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
                ) : filteredRacks.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
                            <Package className="size-7 text-slate-400" />
                        </div>

                        <h3 className="font-semibold text-slate-700">
                            No rack cells found
                        </h3>

                        <p className="max-w-sm text-sm text-slate-500">
                            {searchInput
                                ? "No rack or sub-rack matches your search. Try another barcode or rack name."
                                : "There are no active rack barcode records available."}
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
                    <div className="space-y-6 p-4 sm:p-5">
                        {filteredRacks.map((rack, index) => {
                            const rackStock = rack.sub_racks.reduce(
                                (total, cell) => total + cell.available_count,
                                0,
                            );

                            const rackCapacity = rack.sub_racks.reduce(
                                (total, cell) => total + cell.capacity,
                                0,
                            );

                            const rackPercentage =
                                rackCapacity > 0
                                    ? Math.min(
                                          (rackStock / rackCapacity) * 100,
                                          100,
                                      )
                                    : 0;

                            return (
                                <div
                                    key={index}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200"
                                >
                                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#173A70] text-white shadow-sm">
                                                    <Warehouse className="size-5" />
                                                </div>

                                                <div>
                                                    <h3 className="text-base font-bold text-[#173A70]">
                                                        Rack{" "}
                                                        {rack.rack_column_title}
                                                    </h3>

                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                                        <span>
                                                            {
                                                                rack.sub_racks
                                                                    .length
                                                            }{" "}
                                                            Sub-Racks
                                                        </span>

                                                        <span>
                                                            Capacity:{" "}
                                                            {rack.rack_limit}{" "}
                                                            per cell
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                                                    {rackStock} Stock
                                                </span>

                                                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#2563EB]">
                                                    {rack.sub_racks.length}{" "}
                                                    Cells
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="mb-1.5 flex items-center justify-between text-xs">
                                                <span className="font-medium text-slate-500">
                                                    Rack stock usage
                                                </span>

                                                <span className="font-bold text-[#173A70]">
                                                    {rackStock}/{rackCapacity} (
                                                    {rackPercentage.toFixed(1)}
                                                    %)
                                                </span>
                                            </div>

                                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                    className="h-full rounded-full bg-[#80C66B] transition-all"
                                                    style={{
                                                        width: `${rackPercentage}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto p-3 sm:p-5">
                                        <div className="grid min-w-max grid-cols-[repeat(4,minmax(76px,1fr))] gap-2 sm:grid-cols-[repeat(8,minmax(76px,1fr))] sm:gap-2.5 xl:grid-cols-[repeat(12,minmax(80px,1fr))]">
                                            {rack.sub_racks.map((cell) => {
                                                const isSelected =
                                                    selectedCell?.rack_barcode_id ===
                                                    cell.rack_barcode_id;

                                                return (
                                                    <button
                                                        type="button"
                                                        id={`rack-cell-${cell.rack_barcode_id}`}
                                                        key={
                                                            cell.rack_barcode_id
                                                        }
                                                        onClick={() =>
                                                            handleSelectCell(
                                                                cell,
                                                            )
                                                        }
                                                        title={`${cell.rack_barcode} | Stock: ${cell.available_count}/${cell.capacity} | ${getStatusLabel(cell.occupancy_status)}`}
                                                        className={`flex h-[76px] min-w-[76px] flex-col items-center justify-center rounded-xl border px-2 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${getCellStyle(
                                                            cell,
                                                        )} ${
                                                            isSelected
                                                                ? "scale-105 ring-2 ring-[#173A70] ring-offset-2 shadow-lg"
                                                                : "shadow-sm"
                                                        }`}
                                                    >
                                                        <span className="max-w-full truncate text-sm font-bold">
                                                            {cell.rack_barcode}
                                                        </span>

                                                        <span className="mt-1 text-[11px] font-semibold">
                                                            {
                                                                cell.available_count
                                                            }
                                                            /{cell.capacity}
                                                        </span>

                                                        <span className="mt-0.5 text-[9px] font-semibold uppercase opacity-90">
                                                            {getStatusLabel(
                                                                cell.occupancy_status,
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {selectedCell && (
                    <div className="border-t border-slate-100 bg-blue-50/60 p-4 sm:px-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#173A70] text-white">
                                    <Package className="size-5" />
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-slate-500">
                                        Selected Sub-Rack
                                    </p>

                                    <p className="mt-1 text-lg font-bold text-[#173A70]">
                                        {selectedCell.rack_barcode}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Available Stock
                                    </p>
                                    <p className="mt-1 font-bold text-[#173A70]">
                                        {selectedCell.available_count}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">
                                        Capacity
                                    </p>
                                    <p className="mt-1 font-bold text-[#173A70]">
                                        {selectedCell.capacity}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">
                                        Status
                                    </p>
                                    <p className="mt-1 font-bold text-[#173A70]">
                                        {getStatusLabel(
                                            selectedCell.occupancy_status,
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">
                                        Barcode ID
                                    </p>
                                    <p className="mt-1 font-bold text-[#173A70]">
                                        {selectedCell.rack_barcode_id}
                                    </p>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedCell(null)}
                                aria-label="Close selected rack details"
                                className="self-end text-slate-500 hover:bg-white hover:text-[#173A70] sm:self-center"
                            >
                                <X className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            <style>{`
                @media print {
                    body {
                        background: white !important;
                    }

                    button {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }

                    header,
                    nav,
                    input,
                    button:not([id^="rack-cell-"]) {
                        display: none !important;
                    }
                }
            `}</style>

            <BarcodeScanner
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={handleRackScan}
            />
        </div>
    );
}
