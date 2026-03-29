import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { socket } from "../socket";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation, AlertCircle, MapPin } from "lucide-react";
import { ENDPOINTS } from "../endpoints";
import "leaflet/dist/leaflet.css";

// ✅ Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ✅ Fix resize issue (same as dashboard)
const FixMapSize = () => {
  const map = useMap();

  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    setTimeout(() => map.invalidateSize(), 300);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);

  return null;
};

// ✅ Smooth recenter (same logic as dashboard)
const RecenterMap = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      const currentZoom = map.getZoom();
      map.setView(position, currentZoom < 14 ? 14 : currentZoom, {
        animate: true,
      });
    }
  }, [position, map]);

  return null;
};

const Viewer = () => {
  const { code: paramCode } = useParams();
  const [code, setCode] = useState(paramCode || "");
  const [isTracking, setIsTracking] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    socket.on("receive-location", (coords) => {
      setPosition(coords);
    });

    socket.on("session-ended", () => {
      setEnded(true);
      setIsTracking(false);
      socket.disconnect();
    });

    socket.on("error", (err) => {
      setError(err.message);
      setIsTracking(false);
    });

    return () => {
      socket.off("receive-location");
      socket.off("session-ended");
      socket.off("error");
      if (isTracking) socket.disconnect();
    };
  }, [isTracking]);

  const handleTrack = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setEnded(false);

    try {
      const res = await fetch(ENDPOINTS.SESSION.VERIFY(code), {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setSessionInfo(data);
        setIsTracking(true);
        navigate(`/viewer/${code}`);

        socket.connect();
        socket.emit("join-room", { code, role: "viewer", user });
      } else {
        setError(data.message || "Invalid code");
      }
    } catch {
      setError("Server error");
    }
  };

  const stopTrackingUI = () => {
    setIsTracking(false);
    setPosition(null);
    setSessionInfo(null);
    setCode("");
    navigate("/viewer");
    socket.disconnect();
  };

  // ================= ENTRY SCREEN =================
  if (!isTracking && !ended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col">
        <div className="max-w-md w-full p-6 bg-white rounded-xl shadow-lg">
          <div className="flex justify-center mb-6">
            <Navigation size={48} className="text-blue-600" />
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
            Track Location
          </h2>

          <p className="text-center text-gray-500 mb-6 text-sm">
            Enter the 6-character code shared by the sender.
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleTrack} className="space-y-4">
            <input
              type="text"
              required
              maxLength={6}
              placeholder="A1B2C3"
              className="w-full p-3 border rounded text-center font-mono text-xl tracking-widest uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />

            <button className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 transition">
              Start Tracking
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= MAIN UI =================
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100 flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-white shadow-md p-6 flex flex-col z-10">
        <h2 className="text-xl font-bold mb-6">Live Tracker</h2>

        {ended ? (
          <div className="bg-yellow-50 p-4 rounded">
            Session Ended
            <button
              onClick={stopTrackingUI}
              className="mt-3 w-full bg-yellow-600 text-white py-2 rounded"
            >
              Track Another
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-sm mb-2">
              Tracking: {sessionInfo?.senderId?.name || "Sender"}
            </p>
            <button
              onClick={stopTrackingUI}
              className="w-full bg-red-100 text-red-600 py-2 rounded"
            >
              Stop Tracking
            </button>
          </div>
        )}
      </div>

      {/* MAP */}
      <div className="flex-1 h-full relative z-10 w-full min-w-0">
        {!position && !ended ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
            <MapPin size={48} className="mb-4 opacity-50 animate-bounce" />
            <p className="font-medium">Waiting for live location...</p>
          </div>
        ) : position ? (
          <MapContainer
            key={position?.toString()}
            center={position}
            zoom={15}
            className="w-full h-full"
            zoomControl={false}
            minZoom={4}
            maxZoom={18}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution="&copy; OSM & CARTO"
            />

            {/* 🔥 Live badge */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-[1000] text-sm animate-pulse">
              Live Tracking Active
            </div>

            <Marker position={position}>
              <Popup>{sessionInfo?.senderId?.name || "Sender"} is here</Popup>
            </Marker>

            <RecenterMap position={position} />
            <FixMapSize />
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <p className="text-gray-400">Map unavailable</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Viewer;
