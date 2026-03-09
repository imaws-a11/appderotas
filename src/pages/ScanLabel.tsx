import { useRef, useState, ChangeEvent, useEffect } from "react";
import { QrCode, CheckCircle2, XCircle, MapPin, Camera, Upload, X } from "lucide-react";

export default function ScanLabel() {
  const [image, setImage] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      if (isCameraOpen && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          videoRef.current.srcObject = stream;
          // Push state to handle physical back button
          window.history.pushState({ cameraOpen: true }, '');
        } catch (err) {
          console.error("Error accessing camera:", err);
          alert("Não foi possível acessar a câmera. Verifique as permissões.");
          setIsCameraOpen(false);
        }
      }
    };

    startCamera();

    const handlePopState = () => {
      if (isCameraOpen) {
        setIsCameraOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isCameraOpen]);

  const closeCamera = () => {
    setIsCameraOpen(false);
    if (window.history.state?.cameraOpen) {
      window.history.back();
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        setImage(imageDataUrl);
        closeCamera();
        scanLabelImage(imageDataUrl);
      }
    }
  };

  const handleCapture = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        scanLabelImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const scanLabelImage = async (base64Image: string) => {
    setValidating(true);
    try {
      const response = await fetch("/api/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image })
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
    setImage(null);
    setValidationResult(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="p-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold">Escanear Etiqueta</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {isCameraOpen ? (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="flex-1 relative">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <button 
                onClick={closeCamera}
                className="absolute top-4 left-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md"
              >
                <X size={24} />
              </button>
              
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
                </div>
              </div>
            </div>
            <div className="h-32 bg-black flex items-center justify-center pb-safe">
              <button 
                onClick={takePhoto}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center"
              >
                <div className="w-12 h-12 bg-white rounded-full"></div>
              </button>
            </div>
          </div>
        ) : !image ? (
          <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
              <QrCode size={40} />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">Escanear Etiqueta</h2>
              <p className="text-gray-500 text-sm max-w-[250px]">
                Tire uma foto da etiqueta de entrega para validar o endereço.
              </p>
            </div>
            
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={galleryInputRef}
              onChange={handleCapture}
            />
            
            <div className="flex w-full max-w-xs gap-3">
              <button
                onClick={() => setIsCameraOpen(true)}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-medium shadow-sm active:bg-emerald-700 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <Camera size={24} />
                <span className="text-sm">Câmera</span>
              </button>
              
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-medium shadow-sm active:bg-gray-50 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <Upload size={24} />
                <span className="text-sm">Galeria</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-black aspect-[4/3]">
              <img src={image} alt="Captured Label" className="w-full h-full object-contain" />
              <button 
                onClick={resetScanner}
                className="absolute top-3 right-3 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md"
              >
                Refazer
              </button>
            </div>

            {validating ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                <h3 className="font-semibold text-gray-900">Analisando Etiqueta...</h3>
                <p className="text-sm text-gray-500 mt-1">Extraindo detalhes usando IA</p>
              </div>
            ) : validationResult?.valid ? (
              <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Endereço Válido</h3>
                <p className="text-sm text-emerald-600 font-medium mt-1">Etiqueta corresponde ao banco de dados</p>
                
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
                  Escanear Outro
                </button>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <XCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Etiqueta Inválida</h3>
                <p className="text-sm text-red-600 font-medium mt-1">Endereço não encontrado no banco de dados</p>
                
                {validationResult?.extractedData && (
                  <div className="w-full mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-left">
                    <p className="font-medium text-gray-700 mb-2">Informações Extraídas:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {validationResult.extractedData.label_code && <li>Código: {validationResult.extractedData.label_code}</li>}
                      {validationResult.extractedData.street && <li>Rua: {validationResult.extractedData.street}</li>}
                      {validationResult.extractedData.number && <li>Número: {validationResult.extractedData.number}</li>}
                    </ul>
                  </div>
                )}
                
                <button
                  onClick={resetScanner}
                  className="w-full py-3.5 mt-6 bg-gray-900 text-white rounded-xl font-medium active:bg-gray-800 transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
