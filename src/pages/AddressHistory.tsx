import { useState, useEffect } from "react";
import { History, MapPin, Search, Trash2, AlertTriangle, X, Edit3, Crosshair, Loader2 } from "lucide-react";
import EditAddressModal from "../components/EditAddressModal";

export default function AddressHistory() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressToDelete, setAddressToDelete] = useState<any>(null);
  const [addressToEdit, setAddressToEdit] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingCoordsFor, setUpdatingCoordsFor] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await fetch("/api/addresses");
      const data = await response.json();
      setAddresses(data);
    } catch (error) {
      console.error("Failed to fetch addresses", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCoordinates = async (address: any) => {
    if (!("geolocation" in navigator)) {
      alert("Geolocalização não suportada pelo seu navegador.");
      return;
    }

    setUpdatingCoordsFor(address.id);

    try {
      // 1. Get current GPS position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // 2. Use backend endpoint to verify/refine coordinates with Gemini and Google Maps
      const response = await fetch('/api/verify-coordinates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: {
            street: address.street,
            number: address.number,
            city: address.city,
            state: address.state,
            zip_code: address.zip_code
          },
          latitude: lat,
          longitude: lng
        })
      });

      if (!response.ok) {
        throw new Error('Failed to verify coordinates');
      }

      const parsedData = await response.json();
      
      let newLat = lat;
      let newLng = lng;
      let usedAI = false;

      if (parsedData.latitude && parsedData.longitude) {
        newLat = parsedData.latitude;
        newLng = parsedData.longitude;
        usedAI = true;
      }

      // 3. Update the address in the database
      const updateResponse = await fetch(`/api/addresses/${address.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...address,
          latitude: newLat,
          longitude: newLng
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update address in database');
      }

      const updatedAddress = await updateResponse.json();
      
      // 4. Update local state
      setAddresses(addresses.map(a => a.id === updatedAddress.id ? updatedAddress : a));
      
      if (usedAI) {
        alert("Coordenadas atualizadas com sucesso usando GPS e IA!");
      } else {
        alert("Coordenadas atualizadas usando apenas GPS (IA não retornou formato válido).");
      }

    } catch (error) {
      console.error("Error updating coordinates:", error);
      alert("Erro ao atualizar coordenadas. Verifique sua conexão e permissões de GPS.");
    } finally {
      setUpdatingCoordsFor(null);
    }
  };

  const handleDelete = async () => {
    if (!addressToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/addresses/${addressToDelete.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setAddresses(addresses.filter(a => a.id !== addressToDelete.id));
        setAddressToDelete(null);
      } else {
        alert("Failed to delete address");
      }
    } catch (error) {
      console.error("Failed to delete address", error);
      alert("Failed to delete address");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddressUpdated = (updatedAddress: any) => {
    setAddresses(addresses.map(a => a.id === updatedAddress.id ? updatedAddress : a));
    setAddressToEdit(null);
  };

  const filteredAddresses = addresses.filter(address => {
    const query = searchQuery.toLowerCase();
    return (
      (address.street && address.street.toLowerCase().includes(query)) ||
      (address.number && address.number.toLowerCase().includes(query)) ||
      (address.city && address.city.toLowerCase().includes(query)) ||
      (address.state && address.state.toLowerCase().includes(query)) ||
      (address.label_code && address.label_code.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      <header className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <h1 className="text-lg font-semibold mb-3">Histórico de Endereços</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar endereços..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl text-sm transition-all outline-none"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <History size={32} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Nenhum histórico ainda</h2>
            <p className="text-gray-500 text-sm mt-1">Os endereços que você registrar aparecerão aqui</p>
          </div>
        ) : filteredAddresses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Search size={32} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Nenhum resultado encontrado</h2>
            <p className="text-gray-500 text-sm mt-1">Tente buscar com outros termos</p>
          </div>
        ) : (
          filteredAddresses.map((address) => (
            <div key={address.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4 relative">
              {address.image_url ? (
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  <img src={address.image_url} alt="Address" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl shrink-0 bg-blue-50 flex items-center justify-center text-blue-300">
                  <MapPin size={32} />
                </div>
              )}
              
              <div className="flex-1 min-w-0 flex flex-col justify-center pr-16">
                <h3 className="font-semibold text-gray-900 truncate">
                  {address.street}, {address.number}
                </h3>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {address.city} - {address.state}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {address.is_registered_by_photo ? (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded uppercase tracking-wider">Foto</span>
                  ) : null}
                  {address.label_code ? (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded uppercase tracking-wider">Etiqueta</span>
                  ) : null}
                  
                  <button
                    onClick={() => handleUpdateCoordinates(address)}
                    disabled={updatingCoordsFor === address.id}
                    className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-[10px] font-medium rounded uppercase tracking-wider disabled:opacity-50"
                    title="Atualizar coordenadas com GPS + IA"
                  >
                    {updatingCoordsFor === address.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Crosshair size={12} />
                    )}
                    GPS+IA
                  </button>
                </div>
              </div>

              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button 
                  onClick={() => setAddressToEdit(address)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label="Editar endereço"
                >
                  <Edit3 size={18} />
                </button>
                <button 
                  onClick={() => setAddressToDelete(address)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Excluir endereço"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {addressToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Excluir Endereço?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Tem certeza que deseja excluir o endereço <strong>{addressToDelete.street}, {addressToDelete.number}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setAddressToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 px-4 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Excluir
                    </>
                  )}
                </button>
              </div>
            </div>
            <button 
              onClick={() => setAddressToDelete(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Edit Address Modal */}
      {addressToEdit && (
        <EditAddressModal 
          address={addressToEdit} 
          onClose={() => setAddressToEdit(null)} 
          onSave={handleAddressUpdated} 
        />
      )}
    </div>
  );
}
