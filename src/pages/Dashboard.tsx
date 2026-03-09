import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Camera, QrCode, Map as MapIcon, History, ChevronRight, AlertCircle } from "lucide-react";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

export default function Dashboard() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  useEffect(() => {
    fetchAddresses();
    
    // Real-time location tracking
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Error getting location:", error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await fetch("/api/addresses");
      const data = await response.json();
      setAddresses(data.filter((a: any) => a.latitude && a.longitude));
    } catch (error) {
      console.error("Failed to fetch addresses", error);
    }
  };

  const center = currentLocation || (addresses.length > 0 
    ? { lat: addresses[0].latitude, lng: addresses[0].longitude } 
    : { lat: -23.5505, lng: -46.6333 }); // Default to São Paulo

  // Create route path connecting all addresses (like spoke circuit)
  const routePath = addresses.map(a => ({ lat: a.latitude, lng: a.longitude }));
  if (currentLocation) {
    routePath.unshift(currentLocation);
  }

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">RouteMaster</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie suas rotas e entregas</p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          to="/register"
          className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-2xl border border-blue-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 text-blue-600">
            <Camera size={24} />
          </div>
          <span className="font-semibold text-blue-900 text-sm text-center">Registrar<br/>Endereço</span>
        </Link>
        
        <Link
          to="/scan"
          className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-2xl border border-emerald-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3 text-emerald-600">
            <QrCode size={24} />
          </div>
          <span className="font-semibold text-emerald-900 text-sm text-center">Escanear<br/>Etiqueta</span>
        </Link>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Locais Registrados</h2>
        {!(import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-amber-800">
              A chave da API do Google Maps não está configurada. Por favor, adicione VITE_GOOGLE_MAPS_API_KEY nas configurações.
            </p>
          </div>
        )}
        <div className="h-48 w-full rounded-2xl overflow-hidden shadow-sm border border-gray-200 relative z-0">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={12}
              options={{ disableDefaultUI: true, zoomControl: true }}
            >
              {/* Current Location Marker */}
              {currentLocation && (
                <Marker 
                  position={currentLocation} 
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: "#3b82f6",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                  }}
                />
              )}
              
              {/* Address Markers */}
              {addresses.map((address) => (
                <Marker 
                  key={address.id} 
                  position={{ lat: address.latitude, lng: address.longitude }} 
                  title={`${address.street}, ${address.number}`}
                />
              ))}

              {/* Route Lines (Spoke Circuit) */}
              {routePath.length > 1 && (
                <Polyline
                  path={routePath}
                  options={{
                    strokeColor: "#3b82f6",
                    strokeOpacity: 0.8,
                    strokeWeight: 3,
                    geodesic: true
                  }}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Acesso Rápido</h2>
        
        <Link to="/routes" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm active:bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600">
              <MapIcon size={20} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Minhas Rotas</p>
              <p className="text-xs text-gray-500">Gerenciar entregas ativas</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>

        <Link to="/history" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm active:bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600">
              <History size={20} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Histórico de Endereços</p>
              <p className="text-xs text-gray-500">Ver locais registrados</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>
      </div>
    </div>
  );
}
