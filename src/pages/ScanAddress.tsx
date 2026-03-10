import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ChevronLeft, Loader2, Check, AlertCircle, RefreshCw, MapPin, Scan } from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from "../lib/utils";

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.GEMINI_API_KEY });

export default function ScanAddress() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setError(null);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedImage(dataUrl);
        stopCamera();
        processImage(dataUrl);
      }
    }
  };

  const processImage = async (base64Image: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const base64Data = base64Image.split(",")[1];
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              },
              {
                text: "Extraia o endereço de entrega desta imagem. Se houver um código de barras ou código de rastreio, extraia-o também como 'label_code'. Retorne APENAS um JSON com os campos: street, number, neighborhood, city, state, zip_code, label_code. Se não encontrar algum campo, deixe-o vazio."
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              street: { type: Type.STRING },
              number: { type: Type.STRING },
              neighborhood: { type: Type.STRING },
              city: { type: Type.STRING },
              state: { type: Type.STRING },
              zip_code: { type: Type.STRING },
              label_code: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      setScannedData(result);
    } catch (err) {
      console.error("Error processing image:", err);
      setError("Falha ao processar a imagem. Tente novamente com uma foto mais nítida.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!scannedData) return;
    setIsSaving(true);
    try {
      // 1. Geocode the address to get lat/lng
      const fullAddress = `${scannedData.street}, ${scannedData.number}, ${scannedData.neighborhood}, ${scannedData.city}, ${scannedData.state}, ${scannedData.zip_code}`;
      
      const geocoder = new google.maps.Geocoder();
      const geocodeResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode({ address: fullAddress }, (results, status) => {
          if (status === "OK" && results) resolve(results);
          else reject(new Error("Geocoding failed: " + status));
        });
      });

      const location = geocodeResult[0].geometry.location;
      
      // 2. Save to database
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scannedData,
          latitude: location.lat(),
          longitude: location.lng(),
          is_registered_by_photo: true,
          image_url: capturedImage // In a real app, we'd upload this to storage
        })
      });

      if (response.ok) {
        navigate("/");
      } else {
        throw new Error("Failed to save address");
      }
    } catch (err) {
      console.error("Error saving address:", err);
      setError("Erro ao salvar o endereço. Verifique se o endereço extraído está correto.");
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setScannedData(null);
    setError(null);
    startCamera();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="p-4 flex items-center gap-4 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <button 
          onClick={() => {
            stopCamera();
            navigate("/");
          }} 
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Escanear Etiqueta</h1>
      </header>

      <main className="flex-1 relative flex flex-col overflow-y-auto">
        {/* Camera View */}
        {!capturedImage && (
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {isCameraActive ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {/* Overlay Guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-80 border-2 border-white/50 rounded-3xl relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl -mb-1 -mr-1"></div>
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-xs font-bold text-white/70 uppercase tracking-widest text-center px-4">
                        Posicione a etiqueta aqui
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Camera size={40} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">Acesso à Câmera</h2>
                <p className="text-gray-400 mb-8">Precisamos da câmera para ler as etiquetas de entrega automaticamente.</p>
                <button 
                  onClick={startCamera}
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-transform"
                >
                  Ativar Câmera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Captured Image Preview */}
        {capturedImage && (
          <div className="p-6 space-y-6">
            <div className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-black shadow-2xl">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-lg font-bold animate-pulse">Lendo dados com IA...</p>
                  <p className="text-sm text-gray-400 mt-2">Extraindo endereço e códigos</p>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {scannedData && !isProcessing && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center">
                      <Scan size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold">Dados Extraídos</h3>
                      <p className="text-xs text-gray-400">Revise as informações abaixo</p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Endereço</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors"
                        value={scannedData.street}
                        onChange={(e) => setScannedData({...scannedData, street: e.target.value})}
                        placeholder="Rua / Avenida"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Número</label>
                        <input 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors"
                          value={scannedData.number}
                          onChange={(e) => setScannedData({...scannedData, number: e.target.value})}
                          placeholder="Nº"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bairro</label>
                        <input 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors"
                          value={scannedData.neighborhood}
                          onChange={(e) => setScannedData({...scannedData, neighborhood: e.target.value})}
                          placeholder="Bairro"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cidade</label>
                        <input 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors"
                          value={scannedData.city}
                          onChange={(e) => setScannedData({...scannedData, city: e.target.value})}
                          placeholder="Cidade"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">CEP</label>
                        <input 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors"
                          value={scannedData.zip_code}
                          onChange={(e) => setScannedData({...scannedData, zip_code: e.target.value})}
                          placeholder="00000-000"
                        />
                      </div>
                    </div>
                    {scannedData.label_code && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Código da Etiqueta</label>
                        <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-400 font-mono">
                          {scannedData.label_code}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pb-8">
                  <button 
                    onClick={reset}
                    className="flex-1 py-4 bg-white/5 text-white rounded-2xl font-bold border border-white/10 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={20} />
                    Refazer
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Check size={20} />
                    )}
                    Salvar Endereço
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Camera Controls */}
      {!capturedImage && isCameraActive && (
        <div className="p-8 bg-gray-900/80 backdrop-blur-md border-t border-white/5 flex items-center justify-around">
          <button 
            onClick={stopCamera}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-gray-400"
          >
            <RefreshCw size={24} />
          </button>
          
          <button 
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-white p-1 shadow-2xl active:scale-90 transition-transform"
          >
            <div className="w-full h-full rounded-full border-4 border-gray-900 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-blue-600"></div>
            </div>
          </button>

          <div className="w-12 h-12"></div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
