import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Camera, MapPin, LogOut, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../api';

// Haversine formula
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371000; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return Math.round(R * c);
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

export default function Attendance() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  
  // Settings from API
  const [clinicConfig, setClinicConfig] = useState(null);
  const [fetchingSettings, setFetchingSettings] = useState(true);

  // States
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [locError, setLocError] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch settings from API first
  useEffect(() => {
    const initSettings = async () => {
      try {
        const res = await callApi({ action: 'get_settings' });
        const parseCoord = (val) => parseFloat(String(val || '0').replace(',', '.'));
        setClinicConfig({
          lat: parseCoord(res.settings.KLINIK_LAT),
          lng: parseCoord(res.settings.KLINIK_LNG),
          max_dist: parseInt(res.settings.MAX_DISTANCE || '100', 10)
        });
      } catch (err) {
        setLocError('Gagal mengambil pengaturan koordinat dari server. Hubungi Admin.');
      } finally {
        setFetchingSettings(false);
      }
    };
    initSettings();
  }, []);

  // 2. Once settings are loaded, get user location
  const getLocation = useCallback(() => {
    if (!clinicConfig) return;
    
    setLocError('');
    setLocation(null);
    setDistance(null);

    if (!navigator.geolocation) {
      setLocError('Geolocation tidak didukung di browser ini.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ lat, lng });
        
        const dist = getDistanceFromLatLonInM(clinicConfig.lat, clinicConfig.lng, lat, lng);
        setDistance(dist);
      },
      (err) => {
        setLocError('Gagal mendapatkan lokasi. Pastikan GPS aktif dan diizinkan.');
      },
      { enableHighAccuracy: true }
    );
  }, [clinicConfig]);

  useEffect(() => {
    if (clinicConfig) {
      getLocation();
    }
  }, [clinicConfig, getLocation]);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setPhoto(imageSrc);
    }
  }, [webcamRef]);

  const handleAttend = async (tipe) => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!location) {
      setErrorMsg('Lokasi belum ditemukan. Tunggu sebentar atau refresh halaman.');
      return;
    }
    
    if (distance > clinicConfig.max_dist) {
      setErrorMsg(`Anda berada di luar jangkauan (${distance}m). Maksimal ${clinicConfig.max_dist}m dari klinik.`);
      return;
    }

    if (!photo) {
      setErrorMsg('Silakan ambil foto selfie terlebih dahulu.');
      return;
    }

    setLoading(true);
    try {
      await callApi({
        action: 'attend',
        nama: user.nama,
        nowa: user.nowa,
        tipe: tipe,
        jarak: distance,
        koordinat: `${location.lat},${location.lng}`,
        photo: photo
      });
      
      setSuccessMsg(`Berhasil melakukan absen ${tipe}!`);
      setPhoto(null); 
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (fetchingSettings) {
    return (
      <div className="flex flex-col items-center justify-center w-full" style={{ minHeight: '60vh' }}>
        <div className="spinner spinner-primary mb-4"></div>
        <p className="text-secondary">Menyiapkan konfigurasi sistem...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-gradient" style={{ marginBottom: 0 }}>Absensi</h2>
          <p className="form-label" style={{ marginBottom: 0 }}>Halo, <strong>{user?.nama}</strong></p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <button className="btn btn-secondary" onClick={() => navigate('/admin')} style={{ padding: '0.5rem 1rem' }}>
              Dashboard
            </button>
          )}
          <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </div>

      <div className="card glass mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={22} color={distance !== null && distance <= clinicConfig?.max_dist ? 'var(--success)' : 'var(--error)'} />
            <h3 style={{ margin: 0 }}>Status Lokasi</h3>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem', borderRadius: '50%' }} 
            onClick={getLocation}
            title="Refresh Lokasi"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        
        {locError ? (
          <div className="alert alert-error">{locError}</div>
        ) : location && distance !== null ? (
          <div style={{ background: 'rgba(255,255,255,0.5)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <p className="mb-2">Jarak Anda dari klinik: <strong>{distance} meter</strong></p>
            {distance <= clinicConfig.max_dist ? (
              <p className="badge badge-success mb-0" style={{ fontSize: '0.95rem', padding: '0.4rem 1rem' }}>Lokasi Valid</p>
            ) : (
              <p className="badge badge-error mb-0" style={{ fontSize: '0.95rem', padding: '0.4rem 1rem' }}>Di Luar Jangkauan (Maks {clinicConfig.max_dist}m)</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-secondary">
            <div className="spinner spinner-primary" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
            Mencari titik koordinat GPS...
          </div>
        )}
      </div>

      <div className="card glass mb-6">
        <h3 className="mb-4 flex items-center gap-2"><Camera size={20} /> Bukti Selfie</h3>
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          borderRadius: 'var(--radius-md)', 
          overflow: 'hidden', 
          backgroundColor: '#000', 
          aspectRatio: '3/4',
          maxHeight: '400px',
          display: 'flex',
          justifyContent: 'center',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
        }}>
          {!photo ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img src={photo} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        
        <div className="mt-4">
          {!photo ? (
            <button className="btn btn-secondary w-full justify-center" onClick={capture}>
              Ambil Foto
            </button>
          ) : (
            <button className="btn btn-secondary w-full justify-center" onClick={() => setPhoto(null)}>
              Ulangi Foto
            </button>
          )}
        </div>
      </div>

      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
      {successMsg && <div className="alert alert-success"><CheckCircle size={20} /> {successMsg}</div>}

      <div className="flex gap-4">
        <button 
          className="btn btn-primary flex-1 justify-center" 
          onClick={() => handleAttend('Masuk')}
          disabled={loading || !photo || (distance !== null && distance > clinicConfig?.max_dist)}
        >
          {loading ? <div className="spinner"></div> : 'Absen Masuk'}
        </button>
        <button 
          className="btn btn-danger flex-1 justify-center" 
          onClick={() => handleAttend('Keluar')}
          disabled={loading || !photo || (distance !== null && distance > clinicConfig?.max_dist)}
        >
          {loading ? <div className="spinner"></div> : 'Absen Keluar'}
        </button>
      </div>
    </div>
  );
}
