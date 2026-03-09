import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { QrCode, CheckCircle2, XCircle, MapPin } from "lucide-react";

export default function ScanLabel() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!scanResult) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        /* verbose= */ false
      );
      
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [scanResult]);

  const onScanSuccess = (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setScanResult(decodedText);
    validateLabel(decodedText);
  };

  const onScanFailure = (error: any) => {
    // Ignore frequent scan failures
  };

  const validateLabel = async (code: string) => {
    setValidating(true);
    try {
      const response = await fetch("/api/validate-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await response.json();
      setValidationResult(data);
    } catch (error) {
      console.error(error);
      setValidationResult({ valid: false, error: "Network error" });
    } finally {
      setValidating(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setValidationResult(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="p-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold">Scan Label</h1>
      </header>

      <div className="flex-1 p-4 flex flex-col items-center">
        {!scanResult ? (
          <div className="w-full max-w-sm flex flex-col items-center mt-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Scan QR or Barcode</h2>
              <p className="text-gray-500 text-sm mt-1">Point your camera at the delivery label</p>
            </div>
            
            <div className="w-full bg-white p-2 rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div id="reader" className="w-full rounded-2xl overflow-hidden [&>video]:object-cover"></div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm mt-8 space-y-6">
            {validating ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <h3 className="font-semibold text-gray-900">Validating Label...</h3>
                <p className="text-sm text-gray-500 mt-1 break-all">{scanResult}</p>
              </div>
            ) : validationResult?.valid ? (
              <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Valid Address</h3>
                <p className="text-sm text-emerald-600 font-medium mt-1">Label matches database</p>
                
                <div className="w-full mt-6 p-4 bg-gray-50 rounded-xl text-left">
                  <div className="flex items-start gap-3">
                    <MapPin size={20} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {validationResult.address.street}, {validationResult.address.number}
                      </p>
                      <p className="text-sm text-gray-500">
                        {validationResult.address.city} - {validationResult.address.state}
                      </p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={resetScanner}
                  className="w-full py-3.5 mt-6 bg-gray-900 text-white rounded-xl font-medium active:bg-gray-800 transition-colors"
                >
                  Scan Another
                </button>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <XCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Invalid Label</h3>
                <p className="text-sm text-red-600 font-medium mt-1">Address not found in database</p>
                
                <div className="w-full mt-6 p-4 bg-gray-50 rounded-xl break-all text-sm text-gray-500">
                  Scanned code: {scanResult}
                </div>
                
                <button
                  onClick={resetScanner}
                  className="w-full py-3.5 mt-6 bg-gray-900 text-white rounded-xl font-medium active:bg-gray-800 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
