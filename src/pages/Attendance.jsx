import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Camera, MapPin, LogOut, CheckCircle, RefreshCw, Clock, History, Calendar, FileText } from 'lucide-react';
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
  const [currentTime, setCurrentTime] = useState(new Date());

  // History states
  const [activeTab, setActiveTab] = useState('absen');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  
  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1];

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch settings from API first
  useEffect(() => {
    const initSettings = async () => {
      try {
        const res = await callApi({ action: 'get_settings' });
        const parseCoord = (val) => parseFloat(String(val || '0').replace('_', '').replace(',', '.'));
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

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await callApi({ action: 'get_report' });
      // Filter hanya riwayat milik user yang sedang login
      const myHistory = res.report.filter(r => r.nama === user.nama);
      setHistory(myHistory);
    } catch (err) {
      console.error('Gagal mengambil riwayat:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user.nama]);

  useEffect(() => {
    if (activeTab === 'riwayat') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const filteredHistory = history.filter(item => {
    const d = new Date(item.timestamp);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  if (fetchingSettings) {
    return (
      <div className="flex flex-col items-center justify-center w-full" style={{ minHeight: '60vh' }}>
        <div className="spinner spinner-primary spinner-lg mb-4"></div>
        <p style={{ color: 'var(--text-muted)' }}>Menyiapkan konfigurasi sistem...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div>
            <div className="page-title">Absensi</div>
            <div className="page-subtitle">Halo, <strong style={{ color: 'var(--text-primary)' }}>{user?.nama}</strong></div>
          </div>
        </div>
        <div className="page-header-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem', marginRight: '0.5rem' }}>
            <Clock size={14} />
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {user?.role === 'admin' && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>
              Dashboard
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </div>

      <div className="tab-nav" style={{ marginTop: '0', borderTop: 'none', background: 'var(--surface)', padding: '0.5rem 1rem' }}>
        <button
          className={`tab-btn ${activeTab === 'absen' ? 'active' : ''}`}
          onClick={() => setActiveTab('absen')}
        >
          <Camera size={16} />
          <span>Absen</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'riwayat' ? 'active' : ''}`}
          onClick={() => setActiveTab('riwayat')}
        >
          <History size={16} />
          <span>Riwayat</span>
        </button>
      </div>

      <div className="main-content">
        {activeTab === 'absen' ? (
          <>
            <div className="card glass mb-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <MapPin size={20} color={distance !== null && distance <= clinicConfig?.max_dist ? 'var(--success)' : 'var(--error)'} />
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Status Lokasi</h3>
                </div>
                <button 
                  className="edit-btn" 
                  onClick={getLocation}
                  title="Refresh Lokasi"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              
              {locError ? (
                <div className="alert alert-error">{locError}</div>
              ) : location && distance !== null ? (
                <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <p className="mb-2">Jarak Anda dari klinik: <strong>{distance} meter</strong></p>
                  {distance <= clinicConfig.max_dist ? (
                    <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>✓ Lokasi Valid</span>
                  ) : (
                    <span className="badge badge-error" style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>✗ Di Luar Jangkauan (Maks {clinicConfig.max_dist}m)</span>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: '1.5' }}>
                    <div>Titik Klinik: {clinicConfig.lat}, {clinicConfig.lng}</div>
                    <div>Lokasi Anda: {location.lat}, {location.lng}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <div className="spinner spinner-primary" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  Mencari titik koordinat GPS...
                </div>
              )}
            </div>

            <div className="card glass mb-6">
              <h3 className="mb-4 flex items-center gap-2" style={{ fontSize: '1rem' }}><Camera size={18} /> Bukti Selfie</h3>
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
                    <Camera size={18} /> Ambil Foto
                  </button>
                ) : (
                  <button className="btn btn-secondary w-full justify-center" onClick={() => setPhoto(null)}>
                    <RefreshCw size={18} /> Ulangi Foto
                  </button>
                )}
              </div>
            </div>

            {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
            {successMsg && <div className="alert alert-success"><CheckCircle size={18} /> {successMsg}</div>}

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
          </>
        ) : (
          <div className="card glass">
            <h3 className="mb-4 flex items-center gap-2"><History size={18} /> Riwayat Absensi Saya</h3>
            
            <div className="filter-bar mb-4">
              <span className="filter-label">Filter:</span>
              <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="spinner spinner-primary"></div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Jam</th>
                      <th>Tipe</th>
                      <th>Jarak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                          <Calendar size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                          Belum ada riwayat absensi di bulan ini.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((item, idx) => {
                        const d = new Date(item.timestamp);
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 500 }}>{d.toLocaleDateString('id-ID')}</td>
                            <td>{d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>
                              <span className={`badge ${item.tipe === 'Masuk' ? 'badge-success' : 'badge-error'}`}>
                                {item.tipe}
                              </span>
                            </td>
                            <td>{item.jarak} m</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
