import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Map as MapIcon, History, ChevronRight, AlertCircle, Info, Plus } from "lucide-react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

export default function Dashboard() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
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
          setLocationLoaded(true);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationLoaded(true);
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationLoaded(true);
    }
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await fetch("/api/addresses");
      const data = await response.json();
      setAddresses(data.filter((a: any) => a.latitude && a.longitude));
    } catch (error) {
      console.error("Failed to fetch addresses", error);
    } finally {
      setAddressesLoaded(true);
    }
  };

  const center = currentLocation || (addresses.length > 0 
    ? { lat: addresses[0].latitude, lng: addresses[0].longitude } 
    : { lat: -23.5505, lng: -46.6333 }); // Default to São Paulo

  // Create route path connecting all addresses
  const routePath = addresses.map(a => ({ lat: a.latitude, lng: a.longitude }));
  if (currentLocation) {
    routePath.unshift(currentLocation);
  }

  const isDataReady = addressesLoaded && locationLoaded;

  const calculateRoute = useCallback(() => {
    if (!isLoaded || !isDataReady || routePath.length < 2) return;

    const directionsService = new google.maps.DirectionsService();
    
    const origin = routePath[0];
    const destination = routePath[routePath.length - 1];
    const waypoints = routePath.slice(1, -1).map(point => ({
      location: point,
      stopover: true
    }));

    // Google Maps Directions API limits waypoints to 25.
    // If we have more, we should slice them or handle it differently.
    // For now, we'll just take the first 25 waypoints to avoid errors.
    const limitedWaypoints = waypoints.slice(0, 25);

    directionsService.route(
      {
        origin: origin,
        destination: destination,
        waypoints: limitedWaypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true // Optimize the route
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setDirectionsError(false);
        } else {
          console.error(`error fetching directions: ${status}`, result);
          setDirectionsError(true);
        }
      }
    );
  }, [isLoaded, isDataReady, routePath.length]);

  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]);

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">RoutePlanner</h1>
        <p className="text-gray-500 text-sm mt-1">Planeje suas rotas de entrega</p>
      </header>

      <div className="mb-8">
        <Link
          to="/create-route"
          className="flex items-center justify-center gap-3 p-6 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-transform text-white"
        >
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Plus size={24} />
          </div>
          <span className="font-bold text-lg">Criar Nova Rota</span>
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Mapa de Entregas</h2>
          <Link 
            to="/routes"
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            <MapIcon size={14} />
            Ver Rotas
          </Link>
        </div>
        {!(import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY ? (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-amber-800">
              A chave da API do Google Maps não está configurada. Por favor, adicione VITE_GOOGLE_MAPS_API_KEY nas configurações.
            </p>
          </div>
        ) : directionsError && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
            <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-blue-800">
              Exibindo rotas diretas. Para rotas reais pelas ruas, ative a <strong>Directions API</strong> no seu Google Cloud Console.
            </p>
          </div>
        )}
        <div className="h-64 w-full rounded-2xl overflow-hidden shadow-sm border border-gray-200 relative z-0">
          {loadError ? (
            <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="text-red-500 mb-2" size={24} />
              <p className="text-sm text-red-700 font-medium">Erro ao carregar o mapa</p>
              <p className="text-xs text-red-600 mt-1">Verifique se a API do Google Maps está ativada.</p>
            </div>
          ) : isLoaded ? (
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
              {isDataReady && addresses.map((address) => (
                <Marker 
                  key={address.id} 
                  position={{ lat: address.latitude, lng: address.longitude }} 
                  title={`${address.street}, ${address.number}`}
                />
              ))}

              {/* Real Route */}
              {directions && !directionsError && (
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    suppressMarkers: true, // We are already rendering our own markers
                    polylineOptions: {
                      strokeColor: "#3b82f6",
                      strokeOpacity: 0.8,
                      strokeWeight: 4,
                    }
                  }}
                />
              )}

              {/* Fallback Route Lines (Spoke Circuit) if Directions API fails */}
              {isDataReady && routePath.length > 1 && directionsError && (
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
