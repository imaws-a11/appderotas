import { useState, useRef, useEffect, ChangeEvent, FormEvent } from "react";
import { Camera, Upload, MapPin, CheckCircle2, Loader2, Edit3, Search, AlertCircle, X, Maximize } from "lucide-react";
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';

export default function RegisterAddress() {
  const [mode, setMode] = useState<'photo' | 'manual'>('photo');
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places']
  });
  
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [manualForm, setManualForm] = useState({
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    label_code: ''
  });

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Error getting location:", error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const handleCapture = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        analyzeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setAnalyzing(true);
    setResult(null);
    try {
      const response = await fetch("/api/analyze-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          latitude: location?.lat,
          longitude: location?.lng
        })
      });
      
      if (!response.ok) throw new Error("Failed to analyze");
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Failed to analyze image. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveAddress = async () => {
    if (!result) return;
    try {
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result,
          latitude: location?.lat,
          longitude: location?.lng,
          image_url: image, // In a real app, upload to cloud storage and save URL
          is_registered_by_photo: true
        })
      });
      if (response.ok) {
        alert("Address saved successfully!");
        setImage(null);
        setResult(null);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save address");
    }
  };

  const onLoad = (autocompleteObj: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteObj);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place && place.address_components) {
        let street = '';
        let number = '';
        let neighborhood = '';
        let city = '';
        let state = '';
        let zip_code = '';

        place.address_components.forEach(component => {
          const types = component.types;
          if (types.includes('route')) street = component.long_name;
          if (types.includes('street_number')) number = component.long_name;
          if (types.includes('sublocality') || types.includes('neighborhood')) neighborhood = component.long_name;
          if (types.includes('administrative_area_level_2') || types.includes('locality')) city = component.long_name;
          if (types.includes('administrative_area_level_1')) state = component.short_name;
          if (types.includes('postal_code')) zip_code = component.long_name;
        });

        setManualForm(prev => ({
          ...prev,
          street: street || prev.street,
          number: number || prev.number,
          neighborhood: neighborhood || prev.neighborhood,
          city: city || prev.city,
          state: state || prev.state,
          zip_code: zip_code || prev.zip_code
        }));

        if (place.geometry?.location) {
          setLocation({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          });
        }
      }
    }
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manualForm,
          latitude: location?.lat,
          longitude: location?.lng,
          is_registered_by_photo: false
        })
      });
      if (response.ok) {
        alert("Address saved successfully!");
        setManualForm({
          street: '',
          number: '',
          neighborhood: '',
          city: '',
          state: '',
          zip_code: '',
          label_code: ''
        });
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save address");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <h1 className="text-lg font-semibold mb-3">Registrar Endereço</h1>
        <div className="flex p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode('photo')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'photo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Escanear Foto
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Entrada Manual
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {mode === 'manual' ? (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            {loadError ? (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-red-800">Erro na Pesquisa Avançada</p>
                  <p className="text-xs text-red-700 mt-0.5">A API do Google Places não está ativada.</p>
                </div>
              </div>
            ) : isLoaded && (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY && (
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Pesquisa Avançada (Google)</label>
                <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar endereço..."
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    />
                  </div>
                </Autocomplete>
              </div>
            )}
            
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rua</label>
                <input
                  required
                  type="text"
                  value={manualForm.street}
                  onChange={e => setManualForm({...manualForm, street: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  placeholder="Rua Principal"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Número</label>
                  <input
                    required
                    type="text"
                    value={manualForm.number}
                    onChange={e => setManualForm({...manualForm, number: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    placeholder="123"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">CEP</label>
                  <input
                    required
                    type="text"
                    value={manualForm.zip_code}
                    onChange={e => setManualForm({...manualForm, zip_code: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    placeholder="12345-678"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Bairro</label>
                <input
                  type="text"
                  value={manualForm.neighborhood}
                  onChange={e => setManualForm({...manualForm, neighborhood: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  placeholder="Centro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cidade</label>
                  <input
                    required
                    type="text"
                    value={manualForm.city}
                    onChange={e => setManualForm({...manualForm, city: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    placeholder="São Paulo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Estado</label>
                  <input
                    required
                    type="text"
                    value={manualForm.state}
                    onChange={e => setManualForm({...manualForm, state: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                    placeholder="SP"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Código da Etiqueta (Opcional)</label>
                <input
                  type="text"
                  value={manualForm.label_code}
                  onChange={e => setManualForm({...manualForm, label_code: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  placeholder="LBL-123"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-medium shadow-sm active:bg-blue-700 transition-colors"
            >
              Salvar Endereço
            </button>
          </form>
        ) : !image ? (
          <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
              <Camera size={40} />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">Tirar uma Foto</h2>
              <p className="text-gray-500 text-sm max-w-[250px]">
                Capture uma foto nítida do número do prédio, placa da rua ou fachada.
              </p>
            </div>
            
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={cameraInputRef}
              onChange={handleCapture}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={galleryInputRef}
              onChange={handleCapture}
            />
            
            <div className="flex w-full max-w-xs gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-medium shadow-sm active:bg-blue-700 transition-colors flex flex-col items-center justify-center gap-2"
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
              <img src={image} alt="Captured" className="w-full h-full object-contain" />
              <button 
                onClick={() => { setImage(null); setResult(null); }}
                className="absolute top-3 right-3 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md"
              >
                Refazer
              </button>
            </div>

            {analyzing ? (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm font-medium text-gray-600">Analisando imagem e localização...</p>
              </div>
            ) : result ? (
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-emerald-500">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Endereço Identificado</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {result.formatted_address || `${result.street || ''} ${result.number || ''}, ${result.city || ''}`}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Rua</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{result.street || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Número</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{result.number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Cidade</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{result.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">CEP</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{result.zip_code || '-'}</p>
                  </div>
                </div>

                <button
                  onClick={saveAddress}
                  className="w-full py-3.5 mt-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm active:bg-emerald-700 transition-colors"
                >
                  Salvar Endereço
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
