import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Check, ChevronLeft, Save, Loader2, Sparkles } from "lucide-react";
import { optimizeRoute } from "../services/gemini";

export default function CreateRoute() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [routeName, setRouteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    fetchAddresses();
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Error getting location", error)
      );
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
      setLoading(false);
    }
  };

  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleOptimize = async () => {
    if (selectedIds.length < 2) {
      alert("Selecione pelo menos 2 endereços para otimizar.");
      return;
    }

    setOptimizing(true);
    try {
      const selectedAddresses = addresses.filter(a => selectedIds.includes(a.id));
      const { optimizedOrder } = await optimizeRoute(selectedAddresses, currentLocation);

      if (optimizedOrder && optimizedOrder.length > 0) {
        setSelectedIds(optimizedOrder);
        alert("Rota otimizada com sucesso!");
      } else {
        alert("Falha ao otimizar rota.");
      }
    } catch (error) {
      console.error("Error optimizing route", error);
      alert("Erro ao otimizar rota.");
    } finally {
      setOptimizing(false);
    }
  };

  const handleSave = async () => {
    if (!routeName.trim()) {
      alert("Por favor, dê um nome para a rota.");
      return;
    }
    if (selectedIds.length === 0) {
      alert("Selecione pelo menos um endereço.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeName,
          addressIds: selectedIds
        })
      });

      if (response.ok) {
        navigate("/routes");
      } else {
        alert("Falha ao criar rota.");
      }
    } catch (error) {
      console.error("Error creating route", error);
      alert("Erro ao criar rota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="p-4 bg-white border-b border-gray-200 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 hover:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold">Nova Rota</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Nome da Rota</label>
          <input 
            type="text" 
            placeholder="Ex: Entrega Manhã - Centro" 
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleOptimize}
            disabled={optimizing || selectedIds.length < 2}
            className="w-full flex items-center justify-center gap-2 py-4 bg-purple-50 text-purple-700 rounded-xl font-bold border border-purple-100 active:scale-95 transition-all disabled:opacity-50"
          >
            {optimizing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Otimizar Sequência com IA
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Selecione os Endereços ({selectedIds.length})</h2>
            <span className="text-xs text-gray-500">Apenas endereços com coordenadas</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-sm text-gray-500">Nenhum endereço disponível.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {addresses.map((address) => {
                const isSelected = selectedIds.includes(address.id);
                const orderIndex = selectedIds.indexOf(address.id);
                return (
                  <button
                    key={address.id}
                    onClick={() => toggleSelection(address.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                      isSelected 
                        ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200" 
                        : "bg-white border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300"
                    }`}>
                      {isSelected ? (
                        <span className="text-[10px] font-bold">{orderIndex + 1}</span>
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                        {address.street}, {address.number}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{address.city} - {address.state}</p>
                    </div>
                    <div className="text-gray-300">
                      <MapPin size={18} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-gray-200 sticky bottom-0">
        <button
          onClick={handleSave}
          disabled={saving || selectedIds.length === 0 || !routeName.trim()}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
        >
          {saving ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Save size={20} />
              Salvar Rota
            </>
          )}
        </button>
      </div>
    </div>
  );
}
