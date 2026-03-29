import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { socket } from '../socket';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, AlertCircle, MapPin } from 'lucide-react';
import { ENDPOINTS } from '../endpoints';

const RecenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
};

const Viewer = () => {
  const { code: paramCode } = useParams();
  const [code, setCode] = useState(paramCode || '');
  const [isTracking, setIsTracking] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [position, setPosition] = useState(null);
  const [error, setError] = useState('');
  const [ended, setEnded] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('receive-location', (coords) => {
      setPosition(coords);
    });

    socket.on('session-ended', () => {
      setEnded(true);
      setIsTracking(false);
      socket.disconnect();
    });

    socket.on('error', (err) => {
      setError(err.message);
      setIsTracking(false);
    });

    return () => {
      socket.off('receive-location');
      socket.off('session-ended');
      socket.off('error');
      if (isTracking) {
        socket.disconnect();
      }
    };
  }, [isTracking]);

  const handleTrack = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setEnded(false);
    
    try {
      const res = await fetch(ENDPOINTS.SESSION.VERIFY(code), {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      
      if (res.ok) {
        setSessionInfo(data);
        setIsTracking(true);
        navigate(`/viewer/${code}`);
        
        socket.connect();
        socket.emit('join-room', { code, role: 'viewer', user });
      } else {
        setError(data.message || 'Invalid code');
      }
    } catch (err) {
      setError('Server error');
    }
  };

  const stopTrackingUI = () => {
    setIsTracking(false);
    setPosition(null);
    setSessionInfo(null);
    setCode('');
    navigate('/viewer');
    socket.disconnect();
  };

  if (!isTracking && !ended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col">
        <div className="max-w-md w-full p-6 bg-white rounded-xl shadow-lg">
          <div className="flex justify-center mb-6">
            <Navigation size={48} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Track Location</h2>
          <p className="text-center text-gray-500 mb-6 text-sm">Enter the 6-character code shared by the sender.</p>
          
          {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 flex items-center gap-2"><AlertCircle size={18} /><span>{error}</span></div>}
          
          <form onSubmit={handleTrack} className="space-y-4">
            <div>
              <input 
                type="text" 
                required 
                maxLength={6}
                placeholder="e.g. A1B2C3"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-blue-500 focus:ring-blue-500 text-center font-mono text-xl tracking-widest uppercase" 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())} 
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded hover:bg-blue-700 transition">Start Tracking</button>
          </form>
          <div className="mt-4 text-center">
             <button onClick={() => navigate('/dashboard')} className="text-blue-600 text-sm hover:underline">Go to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 flex-col md:flex-row">
      <div className="w-full md:w-80 bg-white shadow-md p-6 flex flex-col z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Live Tracker</h2>
          <button onClick={() => navigate('/dashboard')} className="text-xs text-blue-600 hover:underline">My Dashboard</button>
        </div>

        {ended ? (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
             <AlertCircle className="mx-auto text-yellow-600 mb-2" size={32} />
             <h3 className="font-bold text-yellow-800 mb-1">Session Ended</h3>
             <p className="text-sm text-yellow-700 mb-4">The sender has stopped sharing their location.</p>
             <button onClick={stopTrackingUI} className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700">Track Another</button>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
             <div className="flex items-center gap-3 mb-3 pb-3 border-b border-blue-200">
               <div className="w-10 h-10 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-bold">
                 {sessionInfo?.senderId?.name?.charAt(0) || 'S'}
               </div>
               <div>
                 <p className="font-semibold text-gray-800">{sessionInfo?.senderId?.name || 'Sender'}</p>
                 <p className="text-xs text-gray-500">Live Location</p>
               </div>
             </div>
             <p className="text-xs text-blue-600 mb-4 flex items-center gap-1"><MapPin size={12}/> Receiving updates...</p>
             <button onClick={stopTrackingUI} className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm font-medium hover:bg-red-100 transition">Stop Tracking</button>
          </div>
        )}
      </div>

      <div className="flex-1 relative z-0" style={{ height: '100vh' }}>
        {!position && !ended ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <p className="text-gray-500 font-medium animate-pulse">Waiting for location data...</p>
          </div>
        ) : position ? (
          <MapContainer center={position} zoom={15} className="w-full h-full" style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={position}>
              <Popup>{sessionInfo?.senderId?.name || 'Sender'} is here</Popup>
            </Marker>
            <RecenterMap position={position} />
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
