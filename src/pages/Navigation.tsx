import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Navigation as NavIcon, CheckCircle2, MapPin, AlertCircle, Loader2, ChevronRight } from "lucide-react";
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

export default function Navigation() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const [route, setRoute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStopIdx, setCurrentStopIdx] = useState(0);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  useEffect(() => {
    fetchRoute();
    
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Error tracking location", error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [routeId]);

  const fetchRoute = async () => {
    try {
      const response = await fetch("/api/routes");
      const data = await response.json();
      const foundRoute = data.find((r: any) => r.id === Number(routeId));
      if (foundRoute) {
        setRoute(foundRoute);
        // Find first non-completed stop
        const firstPendingIdx = foundRoute.stops.findIndex((s: any) => s.status !== 'completed');
        setCurrentStopIdx(firstPendingIdx !== -1 ? firstPendingIdx : 0);
      }
    } catch (error) {
      console.error("Failed to fetch route", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRoute = useCallback(() => {
    if (!isLoaded || !route || !route.stops || route.stops.length === 0) return;

    const directionsService = new google.maps.DirectionsService();
    
    // We want to show the route from current location (or first stop) to all remaining stops
    const pendingStops = route.stops.slice(currentStopIdx);
    if (pendingStops.length === 0) return;

    const origin = currentLocation || { lat: pendingStops[0].latitude, lng: pendingStops[0].longitude };
    const destination = { lat: pendingStops[pendingStops.length - 1].latitude, lng: pendingStops[pendingStops.length - 1].longitude };
    
    const waypoints = pendingStops.slice(currentLocation ? 0 : 1, -1).map((stop: any) => ({
      location: { lat: stop.latitude, lng: stop.longitude },
      stopover: true
    }));

    directionsService.route(
      {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setDirections(result);
        } else {
          console.error(`error fetching directions: ${status}`);
        }
      }
    );
  }, [isLoaded, route, currentStopIdx, currentLocation]);

  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]);

  const handleCompleteStop = async () => {
    if (!route || !route.stops[currentStopIdx]) return;
    
    const stop = route.stops[currentStopIdx];
    try {
      const response = await fetch(`/api/routes/${route.id}/stops/${stop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      
      if (response.ok) {
        // Update local state
        const updatedStops = [...route.stops];
        updatedStops[currentStopIdx].status = 'completed';
        setRoute({ ...route, stops: updatedStops });
        
        // Move to next stop
        if (currentStopIdx < route.stops.length - 1) {
          setCurrentStopIdx(currentStopIdx + 1);
        } else {
          alert("Rota finalizada com sucesso!");
          navigate("/routes");
        }
      }
    } catch (error) {
      console.error("Failed to complete stop", error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Carregando navegação...</p>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Rota não encontrada</h2>
        <button onClick={() => navigate("/routes")} className="mt-4 text-blue-600 font-medium">Voltar para rotas</button>
      </div>
    );
  }

  const currentStop = route.stops[currentStopIdx];
  const isFinished = route.stops.every((s: any) => s.status === 'completed');

  return (
    <div className="flex flex-col h-screen bg-gray-100 relative overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate("/routes")} 
            className="p-2 bg-white/90 backdrop-blur shadow-lg rounded-full text-gray-700 pointer-events-auto active:scale-95 transition-transform"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 bg-white/90 backdrop-blur shadow-lg rounded-2xl p-3 border border-white/20 pointer-events-auto">
            <h1 className="text-sm font-bold text-gray-900 truncate">{route.name}</h1>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
              Parada {currentStopIdx + 1} de {route.stops.length}
            </p>
          </div>
        </div>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative z-0">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={currentLocation || (currentStop ? { lat: currentStop.latitude, lng: currentStop.longitude } : { lat: -23.5505, lng: -46.6333 })}
            zoom={15}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              styles: [
                {
                  featureType: "poi",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                }
              ]
            }}
          >
            {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: false }} />}
          </GoogleMap>
        ) : (
          <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
            <p className="text-gray-400 font-medium">Carregando mapa...</p>
          </div>
        )}
      </div>

      {/* Navigation Panel */}
      <div className="bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] p-6 pb-safe relative z-10 border-t border-gray-100">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
        
        {isFinished ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Rota Concluída!</h2>
            <p className="text-gray-500 mt-2 mb-6">Você finalizou todas as entregas desta rota.</p>
            <button 
              onClick={() => navigate("/routes")}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold active:scale-95 transition-transform"
            >
              Voltar para Lista
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                <MapPin size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  {currentStop.street}, {currentStop.number}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {currentStop.city} - {currentStop.state}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  const url = `google.navigation:q=${currentStop.latitude},${currentStop.longitude}`;
                  window.open(url, '_blank');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                <NavIcon size={20} />
                GPS Externo
              </button>
              <button 
                onClick={handleCompleteStop}
                className="flex-[1.5] flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
              >
                <CheckCircle2 size={20} />
                Concluir Parada
              </button>
            </div>
            
            <button 
              onClick={() => {
                if (currentStopIdx < route.stops.length - 1) {
                  setCurrentStopIdx(currentStopIdx + 1);
                }
              }}
              className="w-full mt-4 flex items-center justify-center gap-1 text-gray-400 text-xs font-bold uppercase tracking-widest"
            >
              Pular Parada <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
