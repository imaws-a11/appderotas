import { Link } from "react-router-dom";
import { Camera, QrCode, Map as MapIcon, History, ChevronRight } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">RouteMaster</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your routes and deliveries</p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          to="/register"
          className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-2xl border border-blue-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 text-blue-600">
            <Camera size={24} />
          </div>
          <span className="font-semibold text-blue-900 text-sm text-center">Register<br/>Address</span>
        </Link>
        
        <Link
          to="/scan"
          className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-2xl border border-emerald-100 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3 text-emerald-600">
            <QrCode size={24} />
          </div>
          <span className="font-semibold text-emerald-900 text-sm text-center">Scan<br/>Label</span>
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Quick Access</h2>
        
        <Link to="/routes" className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm active:bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600">
              <MapIcon size={20} />
            </div>
            <div>
              <p className="font-medium text-gray-900">My Routes</p>
              <p className="text-xs text-gray-500">Manage active deliveries</p>
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
              <p className="font-medium text-gray-900">Address History</p>
              <p className="text-xs text-gray-500">View registered locations</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>
      </div>
    </div>
  );
}
