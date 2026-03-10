import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Map as MapIcon, Plus, Navigation as NavIcon, Clock, CheckCircle2, ChevronRight } from "lucide-react";

export default function RoutesList() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await fetch("/api/routes");
      const data = await response.json();
      setRoutes(data);
    } catch (error) {
      console.error("Failed to fetch routes", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStop = async (routeId: number, stopId: number) => {
    try {
      const response = await fetch(`/api/routes/${routeId}/stops/${stopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      if (response.ok) {
        setRoutes(routes.map(route => {
          if (route.id === routeId) {
            return {
              ...route,
              stops: route.stops.map((stop: any) => {
                if (stop.id === stopId) {
                  return { ...stop, status: "completed" };
                }
                return stop;
              })
            };
          }
          return route;
        }));
      }
    } catch (error) {
      console.error("Failed to update stop status", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="p-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold">Minhas Rotas</h1>
        <Link to="/create-route" className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
          <Plus size={20} />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <MapIcon size={32} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Nenhuma rota ainda</h2>
            <p className="text-gray-500 text-sm mt-1">Crie sua primeira rota para começar a entregar</p>
            <Link to="/create-route" className="mt-6 inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium shadow-sm active:bg-blue-700 transition-colors">
              Criar Rota
            </Link>
          </div>
        ) : (
          routes.map((route) => (
            <div key={route.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{route.name || `Rota #${route.id}`}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(route.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><MapIcon size={12} /> {route.stops?.length || 0} paradas</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full capitalize">
                  {route.status}
                </span>
              </div>
              
              <div className="p-4 bg-gray-50/50">
                <button 
                  onClick={() => navigate(`/navigation/${route.id}`)}
                  className="w-full mb-4 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                >
                  <NavIcon size={18} />
                  Iniciar Navegação
                </button>

                <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-gray-200">
                  {route.stops?.map((stop: any, idx: number) => {
                    const isCompleted = stop.status === 'completed';
                    return (
                    <div key={stop.id} className={`flex items-start gap-3 relative z-10 ${isCompleted ? 'opacity-60' : ''}`}>
                      <div className={`w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center shrink-0 mt-0.5 ${isCompleted ? 'border-emerald-500' : 'border-blue-500'}`}>
                        {isCompleted ? (
                          <CheckCircle2 size={12} className="text-emerald-600" />
                        ) : (
                          <span className="text-[10px] font-bold text-blue-600">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <p className={`text-sm font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{stop.street}, {stop.number}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{stop.city}</p>
                        
                        {!isCompleted && (
                          <div className="flex items-center gap-2 mt-3">
                            <button 
                              onClick={() => navigate(`/navigation/${route.id}`)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium"
                            >
                              <NavIcon size={14} /> Navegar
                            </button>
                            <button 
                              onClick={() => handleCompleteStop(route.id, stop.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium"
                            >
                              <CheckCircle2 size={14} /> Concluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
