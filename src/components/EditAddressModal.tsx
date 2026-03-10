import React, { useState, useEffect } from "react";
import { X, MapPin, Loader2, Save, Crosshair, Sparkles, Map as MapIcon } from "lucide-react";
import { verifyCoordinates, getAddressFromLocation } from "../services/gemini";

interface EditAddressModalProps {
  address?: any; // Optional for "Add" mode
  onClose: () => void;
  onSave: (updatedAddress: any) => void;
}

export default function EditAddressModal({ address, onClose, onSave }: EditAddressModalProps) {
  const isEdit = !!address;
  const [formData, setFormData] = useState({
    street: address?.street || "",
    number: address?.number || "",
    neighborhood: address?.neighborhood || "",
    city: address?.city || "",
    state: address?.state || "",
    zip_code: address?.zip_code || "",
    label_code: address?.label_code || "",
    latitude: address?.latitude || "",
    longitude: address?.longitude || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingCoords, setIsUpdatingCoords] = useState(false);
  const [isFillingAddress, setIsFillingAddress] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      let finalLat = parseFloat(formData.latitude);
      let finalLng = parseFloat(formData.longitude);

      // AI Validation Step
      if (finalLat && finalLng) {
        setIsValidating(true);
        try {
          const verified = await verifyCoordinates(
            {
              street: formData.street,
              number: formData.number,
              city: formData.city,
              state: formData.state,
              zip_code: formData.zip_code
            },
            finalLat,
            finalLng
          );

          if (verified.latitude && verified.longitude) {
            const distance = Math.sqrt(
              Math.pow(verified.latitude - finalLat, 2) + 
              Math.pow(verified.longitude - finalLng, 2)
            );

            // If distance is more than ~100 meters (roughly 0.001 degrees)
            if (distance > 0.001) {
              const confirmUpdate = window.confirm(
                "A IA detectou que as coordenadas fornecidas podem não corresponder exatamente ao endereço. Deseja usar as coordenadas corrigidas pela IA?"
              );
              if (confirmUpdate) {
                finalLat = verified.latitude;
                finalLng = verified.longitude;
                setFormData(prev => ({
                  ...prev,
                  latitude: finalLat.toString(),
                  longitude: finalLng.toString()
                }));
              }
            }
          }
        } catch (err) {
          console.error("AI Validation failed", err);
        } finally {
          setIsValidating(false);
        }
      }

      const url = isEdit ? `/api/addresses/${address.id}` : "/api/addresses";
      const method = isEdit ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          latitude: finalLat || null,
          longitude: finalLng || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onSave(result);
      } else {
        alert(isEdit ? "Failed to update address" : "Failed to create address");
      }
    } catch (error) {
      console.error("Failed to save address", error);
      alert("Failed to save address");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCoordinates = async () => {
    setIsUpdatingCoords(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
        } else {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            (err) => {
              console.error("Geolocation error:", err);
              reject(new Error("Não foi possível obter sua localização. Verifique as permissões do navegador."));
            }, 
            { 
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        }
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

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
        alert("Coordenadas atualizadas com sucesso!");
      } else {
        setFormData(prev => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lng.toString()
        }));
        alert("Coordenadas atualizadas usando apenas GPS.");
      }
    } catch (error) {
      console.error("Error updating coordinates:", error);
      alert("Erro ao obter localização.");
    } finally {
      setIsUpdatingCoords(false);
    }
  };

  const handleFillFromLocation = async () => {
    setIsFillingAddress(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
        } else {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            (err) => {
              console.error("Geolocation error:", err);
              reject(new Error("Não foi possível obter sua localização. Verifique as permissões do navegador."));
            }, 
            { 
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        }
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const addressData = await getAddressFromLocation(lat, lng);

      setFormData(prev => ({
        ...prev,
        street: addressData.street || prev.street,
        number: addressData.number || prev.number,
        neighborhood: addressData.neighborhood || prev.neighborhood,
        city: addressData.city || prev.city,
        state: addressData.state || prev.state,
        zip_code: addressData.zip_code || prev.zip_code,
        latitude: lat.toString(),
        longitude: lng.toString()
      }));
      
      alert("Endereço identificado com sucesso!");
    } catch (error: any) {
      console.error("Error filling address:", error);
      alert(error.message || "Erro ao obter endereço da localização.");
    } finally {
      setIsFillingAddress(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Editar Endereço" : "Novo Endereço"}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          <div className="mb-6">
            <button
              type="button"
              onClick={handleFillFromLocation}
              disabled={isFillingAddress}
              className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isFillingAddress ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <MapIcon size={20} />
                  Preencher via Localização Atual
                </>
              )}
            </button>
          </div>

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
            {isValidating ? "Validando Endereço..." : isSaving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Adicionar Endereço"}
          </button>
        </div>
      </div>
    </div>
  );
}
