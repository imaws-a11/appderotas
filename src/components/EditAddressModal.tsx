import React, { useState, useEffect } from "react";
import { X, MapPin, Loader2, Save, Crosshair, Sparkles } from "lucide-react";
import { verifyCoordinates } from "../services/gemini";

interface EditAddressModalProps {
  address: any;
  onClose: () => void;
  onSave: (updatedAddress: any) => void;
}

export default function EditAddressModal({ address, onClose, onSave }: EditAddressModalProps) {
  const [formData, setFormData] = useState({
    street: address.street || "",
    number: address.number || "",
    neighborhood: address.neighborhood || "",
    city: address.city || "",
    state: address.state || "",
    zip_code: address.zip_code || "",
    label_code: address.label_code || "",
    latitude: address.latitude || "",
    longitude: address.longitude || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingCoords, setIsUpdatingCoords] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`/api/addresses/${address.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          latitude: parseFloat(formData.latitude) || null,
          longitude: parseFloat(formData.longitude) || null,
        }),
      });

      if (response.ok) {
        const updatedAddress = await response.json();
        onSave(updatedAddress);
      } else {
        alert("Failed to update address");
      }
    } catch (error) {
      console.error("Failed to update address", error);
      alert("Failed to update address");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCoordinates = async () => {
    setIsUpdatingCoords(true);
    try {
      // 1. Get current GPS location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
        } else {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        }
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // 2. Use frontend Gemini service to verify/refine coordinates
      const parsedData = await verifyCoordinates(
        {
          street: formData.street,
          number: formData.number,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code
        },
        lat,
        lng
      );

      if (parsedData.latitude && parsedData.longitude) {
        setFormData(prev => ({
          ...prev,
          latitude: parsedData.latitude.toString(),
          longitude: parsedData.longitude.toString()
        }));
        alert("Coordenadas atualizadas com sucesso usando GPS e IA!");
      } else {
        // Fallback to raw GPS if AI parsing fails
        setFormData(prev => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lng.toString()
        }));
        alert("Coordenadas atualizadas usando apenas GPS (IA não retornou formato válido).");
      }
    } catch (error) {
      console.error("Error updating coordinates:", error);
      alert("Erro ao obter localização ou atualizar coordenadas. Verifique as permissões do navegador.");
    } finally {
      setIsUpdatingCoords(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Editar Endereço</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          <form id="edit-address-form" onSubmit={handleSave} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rua</label>
                <input
                  required
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Número</label>
                  <input
                    required
                    type="text"
                    name="number"
                    value={formData.number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">CEP</label>
                  <input
                    type="text"
                    name="zip_code"
                    value={formData.zip_code}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Bairro</label>
                <input
                  type="text"
                  name="neighborhood"
                  value={formData.neighborhood}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cidade</label>
                  <input
                    required
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Estado</label>
                  <input
                    required
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Código da Etiqueta</label>
                <input
                  type="text"
                  name="label_code"
                  value={formData.label_code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
              </div>

              {/* Coordinates Section */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={14} /> Coordenadas
                  </label>
                  <button
                    type="button"
                    onClick={handleUpdateCoordinates}
                    disabled={isUpdatingCoords}
                    className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isUpdatingCoords ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Crosshair size={14} />
                        <Sparkles size={12} className="text-amber-500" />
                      </>
                    )}
                    {isUpdatingCoords ? "Atualizando..." : "GPS + IA"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button
            type="submit"
            form="edit-address-form"
            disabled={isSaving}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
