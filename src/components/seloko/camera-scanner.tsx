"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera,
  Loader2,
  X,
  CameraIcon,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";

interface CameraScannerProps {
  onDetected: (licensePlate: string) => void;
}

type DeviceInfo = { id: string; label: string };
type Mode = "select" | "preview" | "processing" | "detected" | "manual";

export function CameraScanner({ onDetected }: CameraScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [mode, setMode] = useState<Mode>("select");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedPlate, setDetectedPlate] = useState("");
  const [manualPlate, setManualPlate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [ocrDebug, setOcrDebug] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const cleanup = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // List cameras
  const listCameras = useCallback(async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      tempStream.getTracks().forEach((t) => t.stop());
    } catch {
      return;
    }

    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const cameras = allDevices
      .filter((d) => d.kind === "videoinput")
      .map((d) => ({
        id: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
      }));

    setDevices(cameras);

    if (cameras.length > 0) {
      let toSelect = "";
      if (isMobile) {
        const rear = cameras.find(
          (c) =>
            c.label.toLowerCase().includes("back") ||
            c.label.toLowerCase().includes("rear")
        );
        toSelect = rear?.id || cameras[cameras.length - 1].id;
      } else {
        const real = cameras.find(
          (c) =>
            !c.label.toLowerCase().includes("virtual") &&
            !c.label.toLowerCase().includes("cast") &&
            !c.label.toLowerCase().includes("obs")
        );
        toSelect = real?.id || cameras[0].id;
      }
      setSelectedDevice(toSelect);
    }
  }, [isMobile]);

  // Start camera
  const startCamera = useCallback(
    async (deviceId?: string, facingOverride?: "environment" | "user") => {
      cleanup();
      await new Promise((r) => setTimeout(r, 500));

      const video = videoRef.current;
      if (!video) {
        console.log("[Camera] Video element not found, retrying...");
        // Retry after DOM update
        await new Promise((r) => setTimeout(r, 500));
        const retryVideo = videoRef.current;
        if (!retryVideo) {
          console.log("[Camera] Video still not found");
          return;
        }
      }

      const targetVideo = videoRef.current;
      if (!targetVideo) return;

      const useDevice = deviceId || selectedDevice;
      // Di HP label device sering kosong/ambigu, jadi pemilihan depan-belakang
      // pakai facingMode; deviceId dipertahankan untuk desktop multi-webcam.
      const useFacing = facingOverride ?? facing;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isMobile
            ? { facingMode: { ideal: useFacing }, width: { ideal: 1280 } }
            : useDevice
              ? { deviceId: { exact: useDevice } }
              : true,
          audio: false,
        });
        streamRef.current = stream;
        targetVideo.srcObject = stream;

        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000);
          targetVideo.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve();
          };
        });

        await targetVideo.play();
        console.log("[Camera] Playing:", targetVideo.videoWidth, "x", targetVideo.videoHeight);
        setMode("preview");

        // Init Tesseract
        if (!workerRef.current) {
          try {
            const { createWorker } = await import("tesseract.js");
            workerRef.current = await createWorker("eng");
            console.log("[OCR] Tesseract ready");
          } catch (err) {
            console.error("[OCR] Init failed:", err);
          }
        }

        // Start scanning
        setIsScanning(true);
        setScanCount(0);
        startScanningLoop();
      } catch (err: any) {
        console.error("[Camera] Error:", err);
        toast.error(`Kamera gagal: ${err.message}`);
      }
    },
    [selectedDevice, cleanup, facing, isMobile]
  );

  // Scanning loop
  const startScanningLoop = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    let count = 0;

    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      count++;
      setScanCount(count);

      // Draw full frame
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      // Single focused region (center of frame)
      const rw = canvas.width * 0.5;
      const rh = canvas.height * 0.25;
      const rx = (canvas.width - rw) / 2;
      const ry = (canvas.height - rh) / 2;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = rw;
      cropCanvas.height = rh;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) return;

      cropCtx.drawImage(canvas, rx, ry, rw, rh, 0, 0, rw, rh);

      // === AGGRESSIVE PREPROCESSING ===
      const imageData = cropCtx.getImageData(0, 0, rw, rh);
      const data = imageData.data;

      // Step 1: Grayscale with high contrast
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        // Increase contrast dramatically
        const contrast = 2.0;
        const adjusted = Math.min(255, Math.max(0, contrast * (gray - 128) + 128));
        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
      }

      // Step 2: Calculate Otsu's threshold
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        histogram[data[i]]++;
      }
      const totalPixels = rw * rh;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];
      
      let sumB = 0;
      let wB = 0;
      let wF = 0;
      let maxVariance = 0;
      let threshold = 128;

      for (let i = 0; i < 256; i++) {
        wB += histogram[i];
        if (wB === 0) continue;
        wF = totalPixels - wB;
        if (wF === 0) break;

        sumB += i * histogram[i];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const variance = wB * wF * (mB - mF) * (mB - mF);

        if (variance > maxVariance) {
          maxVariance = variance;
          threshold = i;
        }
      }

      console.log("[OCR] Otsu threshold:", threshold);

      // Step 3: Apply Otsu threshold
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i] > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      cropCtx.putImageData(imageData, 0, 0);

      // Step 4: Scale up 2x for better OCR
      const scaledCanvas = document.createElement("canvas");
      scaledCanvas.width = rw * 2;
      scaledCanvas.height = rh * 2;
      const scaledCtx = scaledCanvas.getContext("2d");
      if (scaledCtx) {
        scaledCtx.imageSmoothingEnabled = false;
        scaledCtx.drawImage(cropCanvas, 0, 0, rw * 2, rh * 2);
      }

      const plate = await ocrOnCanvas(scaledCanvas);
      if (plate) {
        console.log("[OCR] DETECTED:", plate);
        setDetectedPlate(plate);
        setMode("detected");
        cleanup();
        toast.success(`Plat terdeteksi: ${plate}`);
        return;
      }
    }, 2000);
  }, [cleanup]);

  // STRICT Indonesian plate pattern
  const extractPlate = (text: string): string | null => {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    setOcrDebug(cleaned);

    console.log("[OCR] Cleaned:", cleaned);

    // STRICT Indonesian plate patterns
    // Format: 1-3 letters + 1-4 numbers + 0-3 letters (suffix optional)
    // Examples: B1234ABC, BH1234, DK12AB, AB1234CD

    // Pattern 1: letters + numbers + letters (standard)
    const p1 = cleaned.match(/^([A-Z]{1,3})(\d{1,4})([A-Z]{1,3})$/);
    if (p1) {
      // Validate: numbers must be 1-4 digits
      if (p1[2].length >= 1 && p1[2].length <= 4) {
        const result = `${p1[1]} ${p1[2]} ${p1[3]}`;
        console.log("[OCR] Pattern 1:", result);
        return result;
      }
    }

    // Pattern 2: letters + numbers only (no suffix)
    const p2 = cleaned.match(/^([A-Z]{1,3})(\d{1,4})$/);
    if (p2) {
      // Validate: must have at least 3 numbers
      if (p2[2].length >= 3 && p2[2].length <= 4) {
        const result = `${p2[1]} ${p2[2]}`;
        console.log("[OCR] Pattern 2:", result);
        return result;
      }
    }

    // Pattern 3: search in text with spaces
    const p3 = text.toUpperCase().match(/([A-Z]{1,3})\s+(\d{1,4})\s+([A-Z]{1,3})/);
    if (p3 && p3[2].length >= 3) {
      const result = `${p3[1]} ${p3[2]} ${p3[3]}`;
      console.log("[OCR] Pattern 3:", result);
      return result;
    }

    // Pattern 4: search letters + numbers
    const p4 = text.toUpperCase().match(/([A-Z]{1,3})\s*(\d{3,4})/);
    if (p4) {
      const result = `${p4[1]} ${p4[2]}`;
      console.log("[OCR] Pattern 4:", result);
      return result;
    }

    console.log("[OCR] No pattern matched");
    return null;
  };

  // OCR on canvas
  const ocrOnCanvas = async (canvas: HTMLCanvasElement): Promise<string | null> => {
    if (!workerRef.current) return null;

    try {
      const { data } = await workerRef.current.recognize(canvas);
      console.log("[OCR] Raw:", data.text.trim(), "Conf:", data.confidence);

      // Skip low confidence results
      if (data.confidence < 40) {
        console.log("[OCR] Confidence too low, skipping");
        return null;
      }

      if (data.text.trim().length === 0) return null;

      return extractPlate(data.text);
    } catch (err) {
      console.error("[OCR] Error:", err);
      return null;
    }
  };

  // Kirim frame ke API deteksi plat
  const detectPlateViaApi = async (
    canvas: HTMLCanvasElement
  ): Promise<string | null> => {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (!blob) return null;

    const form = new FormData();
    form.append("image", blob, "capture.jpg");

    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_PLATE_API_URL ??
          "http://localhost:5000/api/detect-plate",
        { method: "POST", body: form }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setOcrDebug(`${json.plate_number ?? "-"} (${json.confidence ?? 0})`);
      if (json.status !== "success" || !json.plate_number) return null;
      return String(json.plate_number).toUpperCase().trim();
    } catch (err) {
      console.error("[PlateAPI] Error:", err);
      toast.error("API deteksi plat tidak terjangkau");
      return null;
    }
  };

  // Manual capture
  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    setCapturedImage(dataUrl);
    cleanup();
    setMode("processing");

    const plate = await detectPlateViaApi(canvas);
    if (plate) {
      setDetectedPlate(plate);
      setMode("detected");
      toast.success(`Plat terdeteksi: ${plate}`);
    } else {
      setErrorMessage("Plat tidak terdeteksi. Input manual.");
      setMode("manual");
    }
  };

  // Accept
  const handleAcceptDetected = () => {
    onDetected(detectedPlate);
    handleClose();
  };

  const handleAcceptManual = () => {
    const plate = manualPlate.toUpperCase().trim();
    if (plate.length >= 5) {
      onDetected(plate);
      toast.success(`Plat: ${plate}`);
      handleClose();
    } else {
      toast.error("Minimal 5 karakter");
    }
  };

  // Switch camera
  const handleSwitch = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    cleanup();
    setMode("select");
    setCapturedImage(null);
    setDetectedPlate("");
    setScanCount(0);
    setOcrDebug("");
    await startCamera(deviceId);
  };

  // Balik kamera depan/belakang (mobile)
  const handleFlipFacing = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    setScanCount(0);
    setOcrDebug("");
    await startCamera(undefined, next);
  };

  // Retake - FIXED: go back to preview mode first
  const handleRetake = () => {
    console.log("[Camera] Retake");
    cleanup();
    setCapturedImage(null);
    setDetectedPlate("");
    setManualPlate("");
    setErrorMessage("");
    setScanCount(0);
    setOcrDebug("");
    // Go to preview mode, camera will restart
    setMode("preview");
    // Small delay then restart camera
    setTimeout(() => {
      startCamera();
    }, 300);
  };

  // Open
  const handleOpen = async () => {
    setIsOpen(true);
    setMode("select");
    setCapturedImage(null);
    setDetectedPlate("");
    setManualPlate("");
    setErrorMessage("");
    setScanCount(0);
    setOcrDebug("");
    setFacing("environment");
    await new Promise((r) => setTimeout(r, 300));
    await listCameras();
  };

  // Close
  const handleClose = () => {
    cleanup();
    setIsOpen(false);
    setMode("select");
    setDevices([]);
    setSelectedDevice("");
    setCapturedImage(null);
    setDetectedPlate("");
    setManualPlate("");
    setErrorMessage("");
    setScanCount(0);
    setOcrDebug("");
  };

  useEffect(() => {
    return () => {
      cleanup();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [cleanup]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleOpen}
        title="Scan plat nomor"
        className="h-11 w-11 shrink-0 md:h-9 md:w-9"
      >
        <Camera className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={handleClose} />

          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-white z-10">
              <h2 className="font-semibold flex items-center gap-2 text-sm">
                <Camera className="h-4 w-4" />
                Scan Plat Nomor
              </h2>
              <div className="flex items-center gap-2">
                {isScanning && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    Scan #{scanCount}
                  </span>
                )}
                <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Camera selector */}
              {!isMobile && devices.length > 1 && (mode === "select" || mode === "preview") && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Pilih Kamera:</Label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {devices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => handleSwitch(device.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition ${
                          selectedDevice === device.id
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {selectedDevice === device.id ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <CameraIcon className="h-3 w-3 text-gray-400" />
                        )}
                        {device.label.substring(0, 20)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video preview - ALWAYS rendered when in select/preview mode */}
              {(mode === "select" || mode === "preview") && (
                <div style={{ position: "relative", width: "100%", background: "#000", borderRadius: "8px", overflow: "hidden" }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ display: "block", width: "100%", height: "auto", minHeight: "250px", background: "#000" }}
                  />
                  <canvas ref={canvasRef} style={{ display: "none" }} />

                  {/* Flip kamera (mobile) */}
                  {isMobile && mode === "preview" && (
                    <button
                      type="button"
                      onClick={handleFlipFacing}
                      className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white"
                      aria-label={
                        facing === "environment" ? "Pakai kamera depan" : "Pakai kamera belakang"
                      }
                    >
                      <SwitchCamera className="h-4 w-4" />
                    </button>
                  )}

                  {/* Scan indicator */}
                  {mode === "preview" && isScanning && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div
                        className="absolute border-2 border-yellow-400 border-dashed rounded"
                        style={{ left: "25%", top: "37.5%", width: "50%", height: "25%" }}
                      />
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        🔍 #{scanCount}
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 text-center">
                        <span className="bg-black/60 text-white text-xs px-2 py-1 rounded">
                          Arahkan plat ke kotak ini
                        </span>
                      </div>
                    </div>
                  )}

                  {mode === "select" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button onClick={() => startCamera()} size="lg">
                        <Camera className="mr-2 h-5 w-5" />
                        Nyalakan Kamera
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Captured image - shown in processing/detected/manual modes */}
              {(mode === "processing" || mode === "detected" || mode === "manual") && capturedImage && (
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <img src={capturedImage} alt="Plat nomor" className="w-full h-auto max-h-[250px] object-contain" />
                  {mode === "processing" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="flex flex-col items-center gap-2 text-white">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm">Membaca plat nomor...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OCR Debug */}
              {ocrDebug && mode === "preview" && (
                <div className="text-xs bg-muted p-2 rounded font-mono">
                  OCR: {ocrDebug}
                </div>
              )}

              {/* Detected */}
              {mode === "detected" && detectedPlate && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-700 mb-1">Plat terdeteksi:</p>
                  <p className="text-2xl font-bold font-mono text-green-800">{detectedPlate}</p>
                </div>
              )}

              {/* Manual */}
              {mode === "manual" && (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    {errorMessage}
                  </div>
                  <div className="space-y-2">
                    <Label>No. Polisi</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="BH 1234 XX"
                        value={manualPlate}
                        onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleAcceptManual()}
                        autoFocus
                        className="font-mono text-lg tracking-wider"
                      />
                      <Button onClick={handleAcceptManual} disabled={manualPlate.length < 5}>
                        OK
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-2">
                {mode === "preview" && (
                  <Button className="flex-1" onClick={handleCapture}>
                    <Camera className="mr-2 h-4 w-4" />
                    Capture Manual
                  </Button>
                )}

                {mode === "processing" && (
                  <Button className="flex-1" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Membaca...
                  </Button>
                )}

                {mode === "detected" && (
                  <>
                    <Button className="flex-1" onClick={handleAcceptDetected}>
                      Gunakan: {detectedPlate}
                    </Button>
                    <Button variant="outline" onClick={handleRetake}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Ulangi
                    </Button>
                  </>
                )}

                {mode === "manual" && (
                  <>
                    <Button className="flex-1" onClick={handleAcceptManual} disabled={manualPlate.length < 5}>
                      Gunakan Plat Ini
                    </Button>
                    <Button variant="outline" onClick={handleRetake}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Ulangi
                    </Button>
                  </>
                )}
              </div>

              {/* Tips */}
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <p className="font-medium mb-1">Cara pakai:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><b>Posisikan plat di tengah layar</b> (kotak kuning)</li>
                  <li>Pastikan plat <b>mendatar dan jelas</b></li>
                  <li>Jarak 30-50cm dari plat</li>
                  <li>Hindari bayangan dan silau</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
