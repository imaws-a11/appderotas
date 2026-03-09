import { useState, useEffect } from "react";
import { History, MapPin, Search } from "lucide-react";

export default function AddressHistory() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <h1 className="text-lg font-semibold mb-3">Address History</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search addresses..." 
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
            <h2 className="text-lg font-semibold text-gray-900">No history yet</h2>
            <p className="text-gray-500 text-sm mt-1">Addresses you register will appear here</p>
          </div>
        ) : (
          addresses.map((address) => (
            <div key={address.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4">
              {address.image_url ? (
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  <img src={address.image_url} alt="Address" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl shrink-0 bg-blue-50 flex items-center justify-center text-blue-300">
                  <MapPin size={32} />
                </div>
              )}
              
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-semibold text-gray-900 truncate">
                  {address.street}, {address.number}
                </h3>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {address.city} - {address.state}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {address.is_registered_by_photo ? (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded uppercase tracking-wider">Photo</span>
                  ) : null}
                  {address.label_code ? (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded uppercase tracking-wider">Label</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
