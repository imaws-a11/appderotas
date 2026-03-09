/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Home, Camera, QrCode, Map, History } from "lucide-react";
import { cn } from "./lib/utils";

// Pages
import Dashboard from "./pages/Dashboard";
import RegisterAddress from "./pages/RegisterAddress";
import ScanLabel from "./pages/ScanLabel";
import RoutesList from "./pages/RoutesList";
import AddressHistory from "./pages/AddressHistory";

function BottomNav() {
  const location = useLocation();
  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/register", icon: Camera, label: "Register" },
    { path: "/scan", icon: QrCode, label: "Scan" },
    { path: "/routes", icon: Map, label: "Routes" },
    { path: "/history", icon: History, label: "History" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1",
                isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 pb-16 font-sans text-gray-900">
        <main className="max-w-md mx-auto min-h-screen bg-white shadow-sm relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/register" element={<RegisterAddress />} />
            <Route path="/scan" element={<ScanLabel />} />
            <Route path="/routes" element={<RoutesList />} />
            <Route path="/history" element={<AddressHistory />} />
          </Routes>
          <BottomNav />
        </main>
      </div>
    </Router>
  );
}
