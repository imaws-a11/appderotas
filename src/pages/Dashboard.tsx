import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Map as MapIcon, History, ChevronRight, AlertCircle, Info, Plus, MapPin, X, Check, Crosshair, Sparkles, ListOrdered, Camera } from "lucide-react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { cn } from "../lib/utils";
import EditAddressModal from "../components/EditAddressModal";
import { getAddressFromLocation } from "../services/gemini";

const containerStyle = {
  width: '100%',
  height: '100%'
};

const mapStyles = [
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
];

export default function Dashboard() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number}>({ lat: -23.5505, lng: -46.6333 });
  const [hasSetInitialCenter, setHasSetInitialCenter] = useState(false);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState(false);
  const [isAddingFromMap, setIsAddingFromMap] = useState(false);
  const [tempMarker, setTempMarker] = useState<{lat: number, lng: number} | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefilledAddress, setPrefilledAddress] = useState<any>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showOrderList, setShowOrderList] = useState(false);

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
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(newLoc);
          
          if (!hasSetInitialCenter) {
            setMapCenter(newLoc);
            setHasSetInitialCenter(true);
          }
          
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
      const validAddresses = data.filter((a: any) => a.latitude && a.longitude);
      setAddresses(validAddresses);
      
      if (validAddresses.length > 0 && !hasSetInitialCenter && !currentLocation) {
        setMapCenter({ lat: validAddresses[0].latitude, lng: validAddresses[0].longitude });
        setHasSetInitialCenter(true);
      }
    } catch (error) {
      console.error("Failed to fetch addresses", error);
    } finally {
      setAddressesLoaded(true);
    }
  };

  const handleRecenter = () => {
    if (currentLocation) {
      setMapCenter(currentLocation);
    }
  };

  const center = currentLocation || (addresses.length > 0 
    ? { lat: addresses[0].latitude, lng: addresses[0].longitude } 
    : { lat: -23.5505, lng: -46.6333 }); // Default to São Paulo

  // Create route path connecting all addresses
  const routePath = addresses.length > 0 ? addresses.map(a => ({ lat: a.latitude, lng: a.longitude })) : [];
  if (routePath.length > 0 && currentLocation) {
    routePath.unshift(currentLocation);
  }

  const isDataReady = addressesLoaded && locationLoaded;

  const calculateRoute = useCallback(() => {
    if (!isLoaded || !isDataReady || routePath.length < 2 || !showRoute) {
      setDirections(null);
      return;
    }

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

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!isAddingFromMap || !e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setTempMarker({ lat, lng });
    setIsFetchingAddress(true);
    
    try {
      const addressData = await getAddressFromLocation(lat, lng);
      setPrefilledAddress({
        ...addressData,
        latitude: lat,
        longitude: lng
      });
      setShowAddModal(true);
    } catch (error) {
      console.error("Error fetching address from map click:", error);
      alert("Erro ao obter endereço desta localização.");
    } finally {
      setIsFetchingAddress(false);
      setIsAddingFromMap(false);
      setTempMarker(null);
    }
  };

  const handleAddressSaved = (newAddress: any) => {
    setAddresses(prev => [...prev, newAddress]);
    setShowAddModal(false);
    setPrefilledAddress(null);
  };

  const toggleAddressSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">RoutePlanner</h1>
        <p className="text-gray-500 text-sm mt-1">Planeje suas rotas de entrega</p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          to="/create-route"
          className="flex flex-col items-center justify-center gap-2 p-6 bg-blue-600 rounded-3xl shadow-lg shadow-blue-200 active:scale-95 transition-transform text-white"
        >
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Plus size={24} />
          </div>
          <span className="font-bold text-sm">Criar Rota</span>
        </Link>
        <Link
          to="/scan-address"
          className="flex flex-col items-center justify-center gap-2 p-6 bg-gray-900 rounded-3xl shadow-lg shadow-gray-200 active:scale-95 transition-transform text-white"
        >
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <Camera size={24} />
          </div>
          <span className="font-bold text-sm">Escanear</span>
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Mapa de Entregas</h2>
          <div className="flex gap-2">
            {selectedIds.length > 1 && (
              <Link
                to={`/create-route?ids=${selectedIds.join(',')}`}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-purple-600 text-white shadow-sm active:scale-95 transition-all animate-in zoom-in-90"
              >
                <Sparkles size={14} />
                Rotear ({selectedIds.length})
              </Link>
            )}
            {showRoute && (
              <button
                onClick={() => setShowOrderList(!showOrderList)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95",
                  showOrderList ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-white text-blue-600 border border-blue-100 shadow-sm"
                )}
              >
                <ListOrdered size={14} />
                {showOrderList ? "Ocultar Lista" : "Ver Sequência"}
              </button>
            )}
            {showRoute && (
              <button
                onClick={() => {
                  setShowRoute(false);
                  setShowOrderList(false);
                }}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-100 active:scale-95 transition-all"
              >
                <X size={14} />
                Sair da Rota
              </button>
            )}
            {!showRoute && addresses.length > 0 && (
              <button
                onClick={() => setShowRoute(true)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600 text-white shadow-sm active:scale-95 transition-all"
              >
                <MapIcon size={14} />
                Ver Rota
              </button>
            )}
            <button
              onClick={() => setIsAddingFromMap(!isAddingFromMap)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-all",
                isAddingFromMap 
                  ? "bg-amber-100 text-amber-700 border border-amber-200 ring-2 ring-amber-200" 
                  : "text-blue-600 bg-blue-50 hover:bg-blue-100"
              )}
            >
              {isAddingFromMap ? <X size={14} /> : <MapPin size={14} />}
              {isAddingFromMap ? "Cancelar" : "Add via Mapa"}
            </button>
          </div>
        </div>
        
        {isAddingFromMap && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
              <MapPin size={18} />
            </div>
            <p className="text-xs text-amber-800 font-medium">
              Toque em qualquer lugar no mapa para marcar a localização e adicionar um endereço.
            </p>
          </div>
        )}

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
          <div className="h-80 w-full rounded-2xl overflow-hidden shadow-sm border border-gray-200 relative z-0">
            {loadError ? (
              <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="text-red-500 mb-2" size={24} />
                <p className="text-sm text-red-700 font-medium">Erro ao carregar o mapa</p>
                <p className="text-xs text-red-600 mt-1">Verifique se a API do Google Maps está ativada.</p>
              </div>
            ) : isLoaded ? (
              <>
                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={mapCenter}
                  zoom={14}
                  onClick={handleMapClick}
                  onDragStart={() => {}} // User is panning
                  options={{ 
                    disableDefaultUI: true, 
                    zoomControl: false,
                    styles: mapStyles,
                    draggableCursor: isAddingFromMap ? 'crosshair' : 'grab'
                  }}
                >
                  {/* Current Location Marker */}
                  {currentLocation && (
                    <Marker 
                      position={currentLocation} 
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#3b82f6",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 3,
                      }}
                    />
                  )}

                  {/* Temp Marker for picking from map */}
                  {tempMarker && (
                    <Marker 
                      position={tempMarker}
                      animation={google.maps.Animation.BOUNCE}
                    />
                  )}
                  
                  {/* Address Markers */}
                  {isDataReady && addresses.map((address, index) => {
                    const isSelected = selectedIds.includes(address.id);
                    const routeIndex = showRoute ? index + 1 : null;
                    
                    return (
                      <Marker 
                        key={address.id} 
                        position={{ lat: address.latitude, lng: address.longitude }} 
                        title={`${address.street}, ${address.number}`}
                        onClick={() => toggleAddressSelection(address.id)}
                        label={routeIndex ? {
                          text: routeIndex.toString(),
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: "bold"
                        } : undefined}
                        icon={isSelected || showRoute ? {
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 10,
                          fillColor: showRoute ? "#3b82f6" : "#9333ea",
                          fillOpacity: 1,
                          strokeWeight: 2,
                          strokeColor: "#ffffff"
                        } : undefined}
                      />
                    );
                  })}

                  {/* Real Route */}
                  {showRoute && directions && !directionsError && addresses.length > 0 && (
                    <DirectionsRenderer
                      directions={directions}
                      options={{
                        suppressMarkers: true,
                        polylineOptions: {
                          strokeColor: "#3b82f6",
                          strokeOpacity: 0.9,
                          strokeWeight: 5,
                        }
                      }}
                    />
                  )}

                  {/* Fallback Route Lines (Spoke Circuit) if Directions API fails */}
                  {showRoute && isDataReady && routePath.length > 1 && directionsError && addresses.length > 0 && (
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
                
                {/* Map Controls */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                  <button 
                    onClick={handleRecenter}
                    className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-gray-600 active:scale-95 transition-transform border border-gray-100"
                  >
                    <Crosshair size={20} />
                  </button>
                </div>
              </>
            ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {showOrderList && showRoute && addresses.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ListOrdered size={16} className="text-blue-600" />
                Sequência de Paradas
              </h3>
              <span className="text-[10px] font-medium px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                {addresses.length} paradas
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {addresses.map((address, idx) => (
                <div key={address.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {address.street}, {address.number}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {address.neighborhood}, {address.city}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Acesso Rápido</h2>
        
        {showAddModal && (
          <EditAddressModal 
            address={prefilledAddress}
            onClose={() => {
              setShowAddModal(false);
              setPrefilledAddress(null);
            }}
            onSave={handleAddressSaved}
          />
        )}

        {isFetchingAddress && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-gray-700">Obtendo endereço...</p>
            </div>
          </div>
        )}

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
