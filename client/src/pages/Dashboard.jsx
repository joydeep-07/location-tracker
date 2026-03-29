import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { socket } from "../socket";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Copy, LogOut, Menu, MapPin, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ENDPOINTS } from '../endpoints';

// ✅ Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ✅ FIXED Map Resize Issue
const FixMapSize = () => {
  const map = useMap();

  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    setTimeout(() => {
      map.invalidateSize();
    }, 300);

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  return null;
};

const RecenterMap = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      const currentZoom = map.getZoom();
      map.setView(position, currentZoom < 14 ? 13 : currentZoom, {
        animate: true,
      });
    }
  }, [position, map]);

  return null;
};

const Dashboard = () => {
  const { user, logoutContext } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [position, setPosition] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [error, setError] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const watchIdRef = useRef(null);

  // Initial location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => setError("Location access denied"),
      { enableHighAccuracy: true },
    );
    return () => stopSharing();
  }, []);

  useEffect(() => {
    socket.on("viewer-list", setViewers);
    return () => socket.off("viewer-list");
  }, []);

  const startSharing = async () => {
    try {
      const res = await fetch(ENDPOINTS.SESSION.CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        setSession(data);
        socket.connect();
        socket.emit("join-room", { code: data.code, role: "sender", user });

        // Start watching position
        if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              const coords = [pos.coords.latitude, pos.coords.longitude];
              setPosition(coords);
              socket.emit("send-location", { code: data.code, coordinates: coords });
            },
            (err) => setError("Error watching position"),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
          );
        } else {
          setError("Geolocation is not supported by your browser");
        }
      } else {
        setError(data.message || "Failed to create session");
      }
    } catch (err) {
      setError("Server error");
    }
  };

  const stopSharing = async () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (session) {
      try {
        await fetch(ENDPOINTS.SESSION.STOP(session.code), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        });
      } catch (err) {
        console.error(err);
      }

      socket.emit("stop-session", { code: session.code });
      setSession(null);
      setViewers([]);
      socket.disconnect();
    }
  };

  const copyCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.code);
    }
  };

  const handleLogout = async () => {
    stopSharing();
    await fetch(ENDPOINTS.AUTH.LOGOUT, {
      method: "POST",
      credentials: "include",
    });
    logoutContext();
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-100 flex flex-col md:flex-row">

      {/* Mobile Hamburger */}
      <button
        onClick={() => setIsPanelOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-white text-gray-800 rounded-sm shadow-lg border border-gray-200 hover:bg-gray-50"
      >
        <Menu size={24} />
      </button>

      {/* Mobile Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div
              onClick={() => setIsPanelOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 md:hidden overflow-y-auto"
            >
              <div className="p-6 flex flex-col h-full">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Hello, <span className="font-bold">{user?.name}</span>
                  </h2>
                </div>

                {!session ? (
                  <button
                    onClick={startSharing}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-sm font-medium shadow-sm hover:scale-[1.02] transition-all w-full"
                  >
                    Start Sharing
                  </button>
                ) : (
                  <div className="bg-blue-50 border border-blue-100 rounded-sm p-4 space-y-4">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Your Tracking Code</p>
                    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-blue-200 shadow-sm">
                      <p className="text-lg font-mono font-bold text-gray-800 tracking-widest">
                        {session.code}
                      </p>
                      <button
                        onClick={copyCode}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Copy size={20} className="text-gray-600" />
                      </button>
                    </div>
                    <button
                      onClick={stopSharing}
                      className="w-full bg-red-500 text-white py-3 rounded-xl font-medium shadow-sm hover:bg-red-600 transition-all"
                    >
                      Stop Sharing
                    </button>
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    Viewers ({viewers.length})
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 min-h-[80px]">
                    {viewers.length === 0 ? (
                      <p className="text-center text-gray-400 mt-2">No one is watching yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {viewers.map((v, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            {v.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-8 space-y-3">
                  <button
                    onClick={() => {
                      navigate("/viewer");
                      setIsPanelOpen(false);
                    }}
                    className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-3 rounded-xl font-medium shadow-sm hover:scale-[1.02] transition-all"
                  >
                    Track Someone Else
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-red-600 py-3 rounded-xl hover:bg-gray-100 transition-all font-medium"
                  >
                    <LogOut size={20} />
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-80 h-full bg-white/95 backdrop-blur-md shadow-xl border-r border-gray-200 p-6 flex-shrink-0 flex-col overflow-y-auto z-30">
        <h2 className="text-xl font-bold text-gray-800 mb-8">
          Hello, <span className="text-blue-600">{user?.name}</span>
        </h2>

        {/* Sharing Section */}
        {!session ? (
          <button
            onClick={startSharing}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-sm shadow-md transition-all active:scale-[0.98]"
          >
            Start Sharing Location
          </button>
        ) : (
          <div className="bg-blue-50 border border-blue-100 rounded-sm p-4 space-y-4">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Your Tracking Code</p>
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-sm border border-blue-200 shadow-sm">
              <span className="text-lg font-mono font-bold text-gray-800 tracking-widest">
                {session.code}
              </span>
              <button
                onClick={copyCode}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                title="Copy code"
              >
                <Copy size={20} />
              </button>
            </div>
            <button
              onClick={stopSharing}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-sm shadow-sm transition-all active:scale-[0.98]"
            >
              Stop Sharing
            </button>
          </div>
        )}

        {/* Viewers */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center justify-between">
            Active Viewers
            <span className="bg-blue-100 text-blue-800 text-xs py-0.5 px-2 rounded-full font-bold">
              {viewers.length}
            </span>
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-[100px] flex items-center justify-center">
            {viewers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center">No one is currently tracking your location</p>
            ) : (
              <ul className="w-full space-y-2">
                {viewers.map((viewer, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {viewer.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="mt-auto pt-8 space-y-3">
          <button
            onClick={() => navigate("/viewer")}
            className="w-full bg-white border-2 border-indigo-100 text-indigo-600 font-medium py-3 rounded-xl hover:bg-indigo-50 transition-all active:scale-[0.98]"
          >
            Track Someone Else
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-500 hover:bg-red-50 py-3 rounded-xl transition-all font-medium"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>

      {/* MAP */}
      <div className="flex-1 h-full relative z-10 w-full min-w-0">
        {position ? (
          <MapContainer
            key={position?.toString() + (session ? "-active" : "-idle")}
            center={position}
            zoom={session ? 16 : 14}
            className="w-full h-full"
            zoomControl={false}
            minZoom={4}
            maxZoom={18}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            />
            {session && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-[1000] font-medium text-sm animate-pulse">Live Sharing Active</div>}
            <Marker position={position}>
              <Popup>You are here</Popup>
            </Marker>
            <RecenterMap position={position} />
            <FixMapSize />
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
            <MapPin size={48} className="mb-4 text-gray-300 opacity-50 animate-bounce" />
            <p className="font-medium">Getting your precise location...</p>
          </div>
        )}

        {error && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-100 border border-red-200 text-red-700 px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;