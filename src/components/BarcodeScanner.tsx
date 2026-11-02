"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
    Camera,
    Loader2,
    X,
    AlertCircle,
    ScanLine,
    Flashlight,
    SwitchCamera,
    CheckCircle2,
    Clock,
} from "lucide-react";

interface BarcodeScannerProps {
    open: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void | Promise<void>;
    recentScans?: string[];
    isProcessing?: boolean;
}

type CameraFacingMode = "environment" | "user";

interface ExtendedCameraCapabilities extends MediaTrackCapabilities {
    torch?: boolean;
    focusMode?: string[];
}

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
    focusMode?: string;
    torch?: boolean;
    pointsOfInterest?: Array<{ x: number; y: number }>;
}

const BARCODE_FORMATS = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.QR_CODE,
];

export default function BarcodeScanner({
    open,
    onClose,
    onScan,
    recentScans = [],
    isProcessing = false,
}: BarcodeScannerProps) {
    const scannerId = useId().replace(/:/g, "");

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const onScanRef = useRef(onScan);
    const onCloseRef = useRef(onClose);
    const cancelledRef = useRef(false);
    const videoTrackRef = useRef<MediaStreamTrack | null>(null);
    const scanStartingRef = useRef(false);
    const scanProcessingRef = useRef(false);
    const scanCooldownRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);

    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState("");
    const [facingMode, setFacingMode] =
        useState<CameraFacingMode>("environment");

    const [torchSupported, setTorchSupported] = useState(false);
    const [torchEnabled, setTorchEnabled] = useState(false);

    const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
    const [focusMessage, setFocusMessage] = useState("");
    const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        onScanRef.current = onScan;
        onCloseRef.current = onClose;
    }, [onScan, onClose]);

    const prepareAudio = useCallback(async () => {
        if (typeof window === "undefined" || !("AudioContext" in window)) {
            return null;
        }

        try {
            if (!audioContextRef.current || audioContextRef.current.state === "closed") {
                audioContextRef.current = new window.AudioContext();
            }

            if (audioContextRef.current.state === "suspended") {
                await audioContextRef.current.resume();
            }

            return audioContextRef.current;
        } catch {
            return null;
        }
    }, []);

   

    const stopScanner = useCallback(async () => {
        const currentScanner = scannerRef.current;

        scannerRef.current = null;
        videoTrackRef.current = null;

        scanStartingRef.current = false;
        scanProcessingRef.current = false;
        scanCooldownRef.current = false;

        if (!currentScanner) return;

        try {
            if (currentScanner.isScanning) {
                await currentScanner.stop();
            }
        } catch {
            // Scanner may already be stopped.
        }

        try {
            currentScanner.clear();
        } catch {
            // Scanner may already be cleared.
        }
    }, []);

    const configureCamera = useCallback(async (track: MediaStreamTrack) => {
        videoTrackRef.current = track;

        try {
            const capabilities = track.getCapabilities() as ExtendedCameraCapabilities;
            setTorchSupported(Boolean(capabilities.torch));
        } catch {
            setTorchSupported(false);
        }

        try {
            await track.applyConstraints({
                advanced: [
                    {
                        focusMode: "continuous",
                    } as ExtendedMediaTrackConstraintSet,
                ],
            });
        } catch {
            // The camera may already manage autofocus automatically.
        }
    }, []);

    const startScanner = useCallback(
        async (mode: CameraFacingMode) => {
            if (
                !open ||
                cancelledRef.current ||
                scanStartingRef.current
            ) {
                return;
            }

            scanStartingRef.current = true;

            setIsStarting(true);
            setError("");
            setTorchEnabled(false);
            setTorchSupported(false);
            setFocusMessage("");
            setFocusPoint(null);

            let scanner: Html5Qrcode | null = null;

            try {
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                });

                if (cancelledRef.current) return;

                scanner = new Html5Qrcode(scannerId, {
                    formatsToSupport: BARCODE_FORMATS,
                    verbose: false,
                });

                scannerRef.current = scanner;

                await scanner.start(
                    {
                        facingMode: { ideal: mode },
                    },
                    {
                        fps: 25,
                        disableFlip: false,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const width = Math.floor(
                                viewfinderWidth * 0.94,
                            );

                            const height = Math.floor(
                                Math.min(
                                    190,
                                    Math.max(120, viewfinderHeight * 0.30),
                                ),
                            );

                            return {
                                width,
                                height,
                            };
                        },
                        videoConstraints: {
                            facingMode: { ideal: mode },
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                            frameRate: { ideal: 30, max: 30 },
                        },
                    },
                    (decodedText) => {
                        const barcode = decodedText.trim();

                        if (
                            !barcode ||
                            cancelledRef.current ||
                            scanProcessingRef.current ||
                            scanCooldownRef.current
                        ) {
                            return;
                        }

                        scanProcessingRef.current = true;
                        scanCooldownRef.current = true;

                        void Promise.resolve()
                            .then(() => onScanRef.current(barcode))
                            .finally(() => {
                                scanProcessingRef.current = false;

                                window.setTimeout(() => {
                                    scanCooldownRef.current = false;
                                }, 900);
                            });
                    },
                    () => undefined,
                );

                if (cancelledRef.current) {
                    if (scanner.isScanning) {
                        await scanner.stop().catch(() => undefined);
                    }

                    scanner.clear();
                    return;
                }

                const scannerElement =
                    document.getElementById(scannerId);

                const videoElement =
                    scannerElement?.querySelector("video") ?? null;

                const stream =
                    videoElement?.srcObject as MediaStream | null;

                const videoTrack =
                    stream?.getVideoTracks()[0] ?? null;

                if (videoTrack) {
                    await configureCamera(videoTrack);
                }
            } catch (scanError) {
                if (!cancelledRef.current) {
                    setError(
                        scanError instanceof Error
                            ? scanError.message
                            : "Unable to access the camera. Please check camera permissions.",
                    );

                    if (scannerRef.current === scanner) {
                        scannerRef.current = null;
                    }

                    if (scanner) {
                        try {
                            if (scanner.isScanning) {
                                await scanner.stop();
                            }
                        } catch {
                            // Camera may already be stopped.
                        }

                        try {
                            scanner.clear();
                        } catch {
                            // Scanner may already be cleared.
                        }
                    }
                }
            } finally {
                scanStartingRef.current = false;

                if (!cancelledRef.current) {
                    setIsStarting(false);
                    setIsSwitchingCamera(false);
                }
            }
        },
        [open, scannerId, configureCamera],
    );

    useEffect(() => {
        if (!open) return;

        cancelledRef.current = false;
        scanProcessingRef.current = false;
        scanCooldownRef.current = false;
        scanStartingRef.current = false;

        void startScanner(facingMode);

        return () => {
            cancelledRef.current = true;
            void stopScanner();
        };
    }, [open, facingMode, startScanner, stopScanner]);

    const handleSwitchCamera = async () => {
        if (
            isStarting ||
            isSwitchingCamera ||
            isProcessing ||
            scanProcessingRef.current
        ) {
            return;
        }

        setIsSwitchingCamera(true);

        await stopScanner();

        const nextMode: CameraFacingMode =
            facingMode === "environment" ? "user" : "environment";

        setFacingMode(nextMode);
    };

    const handleToggleTorch = async () => {
        const track = videoTrackRef.current;

        if (
            !track ||
            !torchSupported ||
            isStarting ||
            isProcessing
        ) {
            return;
        }

        try {
            const nextTorchState = !torchEnabled;

            await track.applyConstraints({
                advanced: [
                    {
                        torch: nextTorchState,
                    } as ExtendedMediaTrackConstraintSet,
                ],
            });

            setTorchEnabled(nextTorchState);
        } catch {
            setTorchSupported(false);
            setTorchEnabled(false);
            setFocusMessage("Flashlight is not available on this camera.");

            window.setTimeout(() => setFocusMessage(""), 1800);
        }
    };

    const handleTapToFocus = async (event: ReactPointerEvent<HTMLDivElement>) => {
        void prepareAudio();
        const track = videoTrackRef.current;

        if (!track || isStarting || isProcessing || isSwitchingCamera) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const videoElement = document
            .getElementById(scannerId)
            ?.querySelector("video");

        let imageLeft = bounds.left;
        let imageTop = bounds.top;
        let imageWidth = bounds.width;
        let imageHeight = bounds.height;

        if (videoElement?.videoWidth && videoElement.videoHeight) {
            const scale = Math.min(
                bounds.width / videoElement.videoWidth,
                bounds.height / videoElement.videoHeight,
            );

            imageWidth = videoElement.videoWidth * scale;
            imageHeight = videoElement.videoHeight * scale;
            imageLeft += (bounds.width - imageWidth) / 2;
            imageTop += (bounds.height - imageHeight) / 2;
        }

        const pointX = (event.clientX - imageLeft) / imageWidth;
        const pointY = (event.clientY - imageTop) / imageHeight;

        if (pointX < 0 || pointX > 1 || pointY < 0 || pointY > 1) {
            return;
        }

        const x = pointX;
        const y = pointY;

        setFocusPoint({ x: x * 100, y: y * 100 });

        try {
            const capabilities = track.getCapabilities() as ExtendedCameraCapabilities;
            const focusModes = Array.isArray(capabilities.focusMode)
                ? capabilities.focusMode
                : [];
            const preferredMode = focusModes.includes("single-shot")
                ? "single-shot"
                : "continuous";

            await track.applyConstraints({
                advanced: [
                    {
                        focusMode: preferredMode,
                        pointsOfInterest: [{ x, y }],
                    } as ExtendedMediaTrackConstraintSet,
                ],
            });

            setFocusMessage("Focusing on selected area...");
            window.setTimeout(() => setFocusMessage(""), 1200);

            if (preferredMode === "single-shot" && focusModes.includes("continuous")) {
                window.setTimeout(() => {
                    void track.applyConstraints({
                        advanced: [
                            {
                                focusMode: "continuous",
                            } as ExtendedMediaTrackConstraintSet,
                        ],
                    }).catch(() => undefined);
                }, 900);
            }
        } catch {
            try {
                await track.applyConstraints({
                    advanced: [
                        {
                            focusMode: "continuous",
                        } as ExtendedMediaTrackConstraintSet,
                    ],
                });

                setFocusMessage("Autofocus requested. Tap again if the image is still blurry.");
                window.setTimeout(() => setFocusMessage(""), 1800);
            } catch {
                setFocusMessage("Tap-to-focus is not supported by this camera. Move the phone slightly closer or farther away.");
                window.setTimeout(() => setFocusMessage(""), 2600);
            }
        }

        window.setTimeout(() => setFocusPoint(null), 1000);
    };

    useEffect(() => {
        return () => {
            const audioContext = audioContextRef.current;
            audioContextRef.current = null;

            if (audioContext && audioContext.state !== "closed") {
                void audioContext.close().catch(() => undefined);
            }
        };
    }, []);

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onCloseRef.current();
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[99999] h-[100dvh] w-screen overflow-hidden bg-black">
            <div className="relative flex h-full w-full flex-col bg-black">
                <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-black/90 px-4 py-3 text-white backdrop-blur-sm sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                            <Camera className="size-5" />
                        </div>

                        <div>
                            <h2 className="text-base font-bold sm:text-lg">
                                Scan Product Barcode
                            </h2>

                            <p className="mt-0.5 text-xs text-slate-300">
                                Keep the barcode inside the scanning frame
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close scanner"
                        className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50"
                    >
                        <X className="size-6" />
                    </button>
                </div>

                <div
                    className="relative flex min-h-0 flex-1 touch-manipulation items-center justify-center overflow-hidden bg-black"
                    onPointerDown={(event) => void handleTapToFocus(event)}
                >
                    <div
                        id={scannerId}
                        className="scanner-fullscreen h-full w-full"
                    />

                    {focusPoint && !isStarting && (
                        <div
                            className="pointer-events-none absolute z-[4] size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.02)]"
                            style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
                        >
                            <span className="absolute inset-2 rounded-full border border-yellow-200/80" />
                        </div>
                    )}

                    {!error && !isStarting && (
                        <>
                            <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
                                <div className="relative h-[160px] w-[94%] max-w-[850px]">
                                    <div className="absolute -left-1 -top-1 size-9 rounded-tl-xl border-l-4 border-t-4 border-blue-400" />
                                    <div className="absolute -right-1 -top-1 size-9 rounded-tr-xl border-r-4 border-t-4 border-blue-400" />
                                    <div className="absolute -bottom-1 -left-1 size-9 rounded-bl-xl border-b-4 border-l-4 border-blue-400" />
                                    <div className="absolute -bottom-1 -right-1 size-9 rounded-br-xl border-b-4 border-r-4 border-blue-400" />

                                    <div className="barcode-scan-line absolute left-0 right-0 top-0 h-[3px] rounded-full bg-blue-400 shadow-[0_0_14px_4px_rgba(59,130,246,0.9)]" />
                                </div>
                            </div>

                            <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-[3] flex justify-center px-3">
                                <div className="rounded-full bg-black/70 px-4 py-2 text-center text-xs font-medium text-white backdrop-blur-sm">
                                    Tap the barcode or QR code to focus · Keep it inside the frame
                                </div>
                            </div>
                        </>
                    )}

                    {isStarting && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black">
                            <Loader2 className="size-10 animate-spin text-blue-400" />

                            <p className="text-sm font-medium text-white">
                                Starting high-quality camera...
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/95 p-5">
                            <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-white p-5 text-center shadow-2xl">
                                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                                    <AlertCircle className="size-7" />
                                </div>

                                <h3 className="mt-4 text-lg font-bold text-slate-900">
                                    Camera Access Failed
                                </h3>

                                <p className="mt-2 break-words text-sm text-slate-600">
                                    {error}
                                </p>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#173A70] px-4 font-medium text-white transition-colors hover:bg-[#102d59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50"
                                >
                                    Close Scanner
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative z-10 max-h-[42dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-black/95 px-4 py-3 text-white backdrop-blur-sm sm:px-6">
                    {focusMessage && (
                        <p className="mb-3 text-center text-xs font-medium text-blue-300">
                            {focusMessage}
                        </p>
                    )}

                    <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <ScanLine className="size-5 shrink-0 text-blue-400" />

                            <p className="text-xs text-slate-200 sm:text-sm">
                                {isProcessing
                                    ? "Adding scanned barcode..."
                                    : "Ready for next barcode"}
                            </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">
                            {recentScans.length} scanned
                        </span>
                    </div>

                    {isProcessing && (
                        <div className="mx-auto mt-2 flex max-w-2xl items-center gap-2 text-xs text-amber-300">
                            <Loader2 className="size-3.5 animate-spin" />
                            Processing barcode...
                        </div>
                    )}

                    <div className="mx-auto mt-3 max-w-2xl rounded-xl border border-white/10 bg-white/[0.06] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Clock className="size-4 text-blue-300" />

                                <h3 className="text-xs font-bold text-white sm:text-sm">
                                    Recently Scanned
                                </h3>
                            </div>

                            <span className="text-[11px] text-slate-400">
                                Latest successful scans
                            </span>
                        </div>

                        {recentScans.length === 0 ? (
                            <p className="py-3 text-center text-xs text-slate-400">
                                Scanned product barcodes will appear here.
                            </p>
                        ) : (
                            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                                {recentScans.slice(0, 20).map((barcode, index) => (
                                    <div
                                        key={`${barcode}-${index}`}
                                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200"
                                    >
                                        <CheckCircle2 className="size-3.5 shrink-0" />

                                        <span className="break-all">
                                            {barcode}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-slate-400">
                        Keep the barcode clear, steady and fully visible.
                    </p>

                    <div className="mx-auto mt-3 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
                        {torchSupported && (
                            <button
                                type="button"
                                onClick={() => {
                                    void prepareAudio();
                                    void handleToggleTorch();
                                }}
                                disabled={isStarting || isSwitchingCamera || isProcessing}
                                className={`inline-flex h-10 items-center justify-center rounded-xl border border-white/20 px-3 font-medium text-white transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50 ${
                                    torchEnabled
                                        ? "bg-blue-600 hover:bg-blue-700"
                                        : "bg-white/10"
                                }`}
                            >
                                <Flashlight className="mr-2 size-4" />
                                {torchEnabled ? "Flash On" : "Flash"}
                            </button>
                        )}
                    </div>

                    <div className="mx-auto mt-2 grid max-w-2xl grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                void prepareAudio();
                                void handleSwitchCamera();
                            }}
                            disabled={
                                isStarting ||
                                isSwitchingCamera ||
                                isProcessing
                            }
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 font-medium text-white transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {isSwitchingCamera ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                                <SwitchCamera className="mr-2 size-4" />
                            )}
                            Switch Camera
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 font-medium text-white transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50"
                        >
                            <X className="mr-2 size-4" />
                            Close Scanner
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .scanner-fullscreen,
                .scanner-fullscreen > div {
                    width: 100% !important;
                    height: 100% !important;
                }

                .scanner-fullscreen video {
                    cursor: crosshair !important;
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: contain !important;
                    object-position: center center !important;
                    background: #000 !important;
                }

                .scanner-fullscreen canvas {
                    display: none !important;
                }

                .scanner-fullscreen #qr-shaded-region {
                    display: none !important;
                }

                .scanner-fullscreen__dashboard,
                #${scannerId}__dashboard_section {
                    display: none !important;
                }

                .barcode-scan-line {
                    animation: barcode-scan 2s ease-in-out infinite alternate;
                    will-change: transform;
                }

                @keyframes barcode-scan {
                    from {
                        transform: translateY(0);
                    }

                    to {
                        transform: translateY(154px);
                    }
                }
            `}</style>
        </div>
    );
}