import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Camera, MapPin, LogOut, CheckCircle, RefreshCw, Clock, History, Calendar, X, ArrowLeft, Maximize2, Minimize2, Bell, LogIn, BarChart3 } from 'lucide-react';
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

function formatJamKerja(val, defaultVal) {
  if (!val) return defaultVal;
  const s = String(val).trim();
  if (s.includes('1899-12-30')) {
    try {
      const d = new Date(s);
      // Koreksi offset historis LMT Indonesia (+07:07:12 -> +07:00:00) yang sering terjadi di Google Sheets
      d.setMinutes(d.getMinutes() + 7);
      d.setSeconds(d.getSeconds() + 12);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch(e) {
      return s;
    }
  }
  return s;
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
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // History states
  const [activeTab, setActiveTab] = useState('riwayat');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Camera state
  const [takingPhotoFor, setTakingPhotoFor] = useState(null); // 'Masuk' | 'Keluar' | null
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.msFullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!isFullscreen) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    } catch(e) {
      console.error(e);
    }
  };
  
  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [activeToastNotif, setActiveToastNotif] = useState(null);

  // Ask for browser notification permissions
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  const fetchNotifications = useCallback(async (isInitial = false) => {
    if (!user || !user.nowa) return;
    try {
      const res = await callApi({
        action: 'get_notifications',
        nowa: user.nowa
      });
      if (res.notifications) {
        setNotifications(res.notifications);
        
        const lastViewed = localStorage.getItem(`melati_notif_last_viewed_${user.nowa}`) || '0';
        const lastViewedTime = new Date(lastViewed).getTime();
        
        let unread = 0;
        let latestNotif = null;
        
        res.notifications.forEach(n => {
          const notifTime = new Date(n.timestamp).getTime();
          if (notifTime > lastViewedTime) {
            unread++;
            if (!latestNotif || notifTime > new Date(latestNotif.timestamp).getTime()) {
              latestNotif = n;
            }
          }
        });
        
        setUnreadNotifCount(unread);
        
        if (!isInitial && latestNotif && unread > 0) {
          setActiveToastNotif(latestNotif);
          
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(latestNotif.title, {
              body: latestNotif.message,
              icon: '/logo2.png'
            });
          }
          
          setTimeout(() => {
            setActiveToastNotif(prev => (prev && prev.timestamp === latestNotif.timestamp ? null : prev));
          }, 6000);
        }
      }
    } catch(e) {
      console.error('Failed to fetch notifications:', e);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications(true);
      const interval = setInterval(() => {
        fetchNotifications(false);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const markNotificationsAsRead = () => {
    if (!user) return;
    const nowStr = new Date().toISOString();
    localStorage.setItem(`melati_notif_last_viewed_${user.nowa}`, nowStr);
    setUnreadNotifCount(0);
  };
  
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
          max_dist: parseInt(res.settings.MAX_DISTANCE || '100', 10),
          logo: res.settings.KLINIK_LOGO || null
        });
      } catch (err) {
        setLocError('Gagal mengambil pengaturan koordinat dari server. Hubungi Admin.');
      } finally {
        setFetchingSettings(false);
      }
    };
    initSettings();
  }, []);

  // 2. Get user location when activeTab changes to 'absen' or clinicConfig loads
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
    if (activeTab === 'absen' && clinicConfig) {
      getLocation();
    }
  }, [activeTab, clinicConfig, getLocation]);

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
    if (activeTab === 'riwayat' || activeTab === 'absen') {
      fetchHistory(); // Selalu fetch history untuk update state disable tombol
    }
  }, [activeTab, fetchHistory]);

  const captureAndSubmit = async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    
    try {
      await callApi({
        action: 'attend',
        nama: user.nama,
        nowa: user.nowa,
        tipe: takingPhotoFor,
        jarak: distance,
        koordinat: `${location.lat},${location.lng}`,
        photo: imageSrc
      });
      
      setSuccessMsg(`Berhasil melakukan absen ${takingPhotoFor}!`);
      setTakingPhotoFor(null);
      setShowSuccessModal(true);
      fetchHistory();
    } catch (err) {
      setErrorMsg(err.message);
      // Let the user retry or close
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredHistory = history.filter(item => {
    const d = new Date(item.timestamp);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  // Cek apakah sudah absen hari ini
  const todayStr = new Date().toLocaleDateString('id-ID');
  const hasAbsenMasukToday = history.some(item => {
    const d = new Date(item.timestamp).toLocaleDateString('id-ID');
    return d === todayStr && item.tipe === 'Masuk';
  });
  const hasAbsenKeluarToday = history.some(item => {
    const d = new Date(item.timestamp).toLocaleDateString('id-ID');
    return d === todayStr && item.tipe === 'Keluar';
  });

  const isBebasLokasi = user?.role === 'admin' || user?.role === 'user_bebas';
  const isLocationValid = isBebasLokasi || (location && distance !== null && distance <= clinicConfig?.max_dist);

  const getJamKerja = () => {
    const dayOfWeek = currentTime.getDay();
    if (user && user.jadwal && user.jadwal[dayOfWeek]) {
      const dayConfig = user.jadwal[dayOfWeek];
      if (dayConfig.active) {
        return { jm: dayConfig.start, js: dayConfig.end, isActive: true };
      } else {
        return { jm: '', js: '', isActive: false };
      }
    }
    
    // Fallback to legacy
    const isSabtu = dayOfWeek === 6;
    const isMinggu = dayOfWeek === 0;
    if (isMinggu) {
      return { jm: '', js: '', isActive: false };
    }
    const jm = isSabtu ? (user?.jamMulaiSabtu || '10:00') : (user?.jamMulai || '17:00');
    const js = isSabtu ? (user?.jamSelesaiSabtu || '17:00') : (user?.jamSelesai || '20:30');
    return { jm: formatJamKerja(jm, jm), js: formatJamKerja(js, js), isActive: true };
  };

  const checkTimeBounds = () => {
    const { jm, js, isActive } = getJamKerja();
    if (!isActive) {
      return { allowedMasuk: false, allowedKeluar: false, isOffDay: true };
    }
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    const parseTimeStr = (ts) => {
      const [h, m] = String(ts).split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const minsMulai = parseTimeStr(jm);
    const minsSelesai = parseTimeStr(js);

    const batasAwal = user?.batasAwalMasuk !== undefined ? user.batasAwalMasuk : 60;
    const batasAkhir = user?.batasAkhirPulang !== undefined ? user.batasAkhirPulang : 240;

    const allowedMasuk = currentMins >= (minsMulai - batasAwal) && currentMins <= minsSelesai;
    const allowedKeluar = currentMins >= minsMulai && currentMins <= (minsSelesai + batasAkhir);

    return { allowedMasuk, allowedKeluar, isOffDay: false };
  };

  const { allowedMasuk, allowedKeluar, isOffDay } = checkTimeBounds();

  const disableMasuk = !isLocationValid || hasAbsenMasukToday || !allowedMasuk || isOffDay;
  const disablePulang = !isLocationValid || hasAbsenKeluarToday || !hasAbsenMasukToday || !allowedKeluar || isOffDay;


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
      <div className="page-header" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src={clinicConfig?.logo ? (clinicConfig.logo.includes('/d/') ? `https://drive.google.com/thumbnail?id=${clinicConfig.logo.split('/d/')[1].split('/')[0]}&sz=w200` : clinicConfig.logo) : '/logo2.png'} 
            alt="Logo" 
            style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} 
          />
          <div>
            <div className="page-title">Melati Dental Care</div>
            <div className="page-subtitle">Assalamu'alaikum, <strong style={{ color: 'var(--text-primary)' }}>{user?.nama}</strong></div>
          </div>
        </div>
        <div className="page-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={toggleFullscreen} 
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          
          <button 
            className="btn btn-ghost btn-sm notif-badge-container" 
            onClick={() => {
              markNotificationsAsRead();
              setShowNotifModal(true);
            }}
            title="Notifikasi"
            style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <Bell size={16} />
            {unreadNotifCount > 0 && <span className="notif-badge">{unreadNotifCount}</span>}
          </button>

          {user?.role === 'admin' && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')} title="Dashboard Admin" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BarChart3 size={14} />
              <span className="sm-visible">Dashboard</span>
            </button>
          )}
          
          <button className="btn btn-danger btn-sm" onClick={handleLogout} title="Keluar" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <LogOut size={14} />
            <span className="sm-visible">Keluar</span>
          </button>
        </div>
      </div>

      <div className="main-content" style={{ paddingBottom: '90px' }}>
        {errorMsg && !takingPhotoFor && <div className="alert alert-error mb-4">{errorMsg}</div>}
        {successMsg && !takingPhotoFor && <div className="alert alert-success mb-4"><CheckCircle size={18} /> {successMsg}</div>}

        {activeTab === 'absen' ? (
          <div>
            {/* Jam Digital */}
            <div className="text-center mb-6 mt-4">
              <div style={{ fontSize: '3.5rem', fontWeight: '800', lineHeight: '1', color: 'var(--text-primary)' }}>
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.5rem', fontWeight: '500' }}>
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>

            {/* Status Lokasi Card */}
            <div className="card glass mb-6 text-center" style={{ padding: '2rem 1.5rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              {locError ? (
                <>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <MapPin size={32} />
                  </div>
                  <h3 style={{ color: 'var(--error)', marginBottom: '0.5rem' }}>Lokasi Tidak Valid</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{locError}</p>
                  <button className="btn btn-secondary mt-4 mx-auto" onClick={getLocation}><RefreshCw size={16} /> Muat Ulang Lokasi</button>
                </>
              ) : distance === null ? (
                <div style={{ padding: '2rem 0' }}>
                  <div className="spinner spinner-primary spinner-lg mx-auto mb-4"></div>
                  <p style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Mencari lokasi Anda...</p>
                </div>
              ) : isLocationValid ? (
                <>
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <CheckCircle size={36} />
                  </div>
                  <h3 style={{ color: 'var(--success)', fontSize: '1.3rem', marginBottom: '0.5rem' }}>Lokasi Valid</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>
                    Anda berada dalam radius kantor ({distance}m).
                  </p>
                  <div style={{ 
                    fontSize: '0.95rem', 
                    fontWeight: '600', 
                    color: isOffDay ? 'var(--text-muted)' : 'var(--primary)', 
                    background: isOffDay ? 'var(--surface-hover)' : 'rgba(59, 130, 246, 0.1)', 
                    padding: '0.75rem', 
                    borderRadius: '0.5rem', 
                    display: 'inline-block' 
                  }}>
                    {(() => {
                      const { jm, js, isActive } = getJamKerja();
                      if (!isActive) {
                        return 'Hari Ini Libur (Tidak ada jadwal)';
                      }
                      return `Jadwal hari ini (${jm} - ${js})`;
                    })()}
                  </div>
                  <div className="mt-4">
                    <button className="btn btn-ghost mx-auto btn-sm" style={{ color: 'var(--text-muted)' }} onClick={getLocation}><RefreshCw size={14} /> Muat Ulang Lokasi</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <MapPin size={36} />
                  </div>
                  <h3 style={{ color: 'var(--error)', fontSize: '1.3rem', marginBottom: '0.5rem' }}>Di Luar Jangkauan</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>
                    Anda berada {distance}m dari klinik. Maksimal jarak adalah {clinicConfig.max_dist}m.
                  </p>
                  <button className="btn btn-secondary mt-4 mx-auto btn-sm" onClick={getLocation}><RefreshCw size={14} /> Coba Lagi</button>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mb-4">
              <button 
                className={`btn flex-1 justify-center flex-col gap-2 ${!hasAbsenMasukToday && allowedMasuk ? 'pulse-mandatory' : ''}`}
                style={{ 
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', 
                  color: 'white', padding: '1.5rem', borderRadius: '1rem', border: 'none',
                  opacity: disableMasuk ? 0.5 : 1,
                  boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                  cursor: disableMasuk ? 'not-allowed' : 'pointer'
                }}
                onClick={() => setTakingPhotoFor('Masuk')}
                disabled={disableMasuk}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <LogIn size={24} />
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                  {hasAbsenMasukToday ? 'Sudah Masuk' : (!allowedMasuk ? 'Di Luar Jam' : 'Absen Masuk (Wajib)')}
                </span>
              </button>
              
              {allowedKeluar && (
                <button 
                  className="btn flex-1 justify-center flex-col gap-2" 
                  style={{ 
                    background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)', 
                    color: 'white', padding: '1.5rem', borderRadius: '1rem', border: 'none',
                    opacity: disablePulang ? 0.5 : 1,
                    boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.4)',
                    cursor: disablePulang ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => setTakingPhotoFor('Keluar')}
                  disabled={disablePulang}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <LogOut size={24} />
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                    {!hasAbsenMasukToday ? 'Belum Masuk' : (hasAbsenKeluarToday ? 'Sudah Pulang' : 'Pulang')}
                  </span>
                </button>
              )}
            </div>
          </div>
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

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        display: 'flex', zIndex: 90, paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)'
      }}>
        <button 
          style={{ 
            flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', 
            color: activeTab === 'riwayat' ? 'var(--primary)' : 'var(--text-muted)', 
            background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
          onClick={() => setActiveTab('riwayat')}
        >
          <History size={24} style={{ transform: activeTab === 'riwayat' ? 'scale(1.1)' : 'scale(1)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: activeTab === 'riwayat' ? '700' : '500' }}>Riwayat</span>
        </button>
        <button 
          style={{ 
            flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', 
            color: activeTab === 'absen' ? 'var(--primary)' : 'var(--text-muted)', 
            background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
          onClick={() => setActiveTab('absen')}
        >
          <Camera size={24} style={{ transform: activeTab === 'absen' ? 'scale(1.1)' : 'scale(1)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: activeTab === 'absen' ? '700' : '500' }}>Absen</span>
        </button>
      </div>

      {/* Full Screen Camera View */}
      {takingPhotoFor && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#000', zIndex: 100, display: 'flex', flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', color: 'white', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
            <button onClick={() => setTakingPhotoFor(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeft size={20} />
            </button>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>Foto Absen {takingPhotoFor}</h3>
            <div style={{ width: '40px' }}></div> {/* spacer */}
          </div>
          
          {/* Webcam */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {errorMsg && (
              <div style={{ position: 'absolute', top: '80px', left: '1rem', right: '1rem', background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}
          </div>
          
          {/* Footer controls */}
          <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <button 
              onClick={captureAndSubmit}
              disabled={loading}
              style={{ 
                width: '76px', height: '76px', borderRadius: '50%', 
                background: 'white', border: '4px solid rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                transition: 'transform 0.1s',
                transform: loading ? 'scale(0.95)' : 'scale(1)'
              }}
            >
              {loading ? (
                <div className="spinner spinner-primary"></div>
              ) : (
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid black' }}></div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success PopUp Modal */}
      {showSuccessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card text-center" style={{ width: '90%', maxWidth: '320px', padding: '2rem', animation: 'scaleIn 0.3s ease-out' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Absen Berhasil!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Data absensi Anda telah tersimpan.</p>
            
            {successMsg.includes('Masuk') && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem', lineHeight: '1.6', fontFamily: 'serif' }} dir="rtl">
                  اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4' }}>
                  "Ya Allah, sungguh aku memohon kepada-Mu ilmu yang bermanfaat, rezeki yang baik, dan amal yang diterima."
                </p>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 'bold', marginTop: '0.75rem' }}>Selamat Bekerja!</p>
              </div>
            )}

            <button className="btn btn-primary w-full" onClick={() => {
              setShowSuccessModal(false);
              setActiveTab('riwayat');
            }}>Tutup & Lihat Riwayat</button>
          </div>
        </div>
      )}

      {/* Notifications History Modal */}
      {showNotifModal && (
        <div className="modal-overlay" onClick={() => setShowNotifModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} style={{ color: 'var(--primary)' }} />
                Riwayat Notifikasi
              </div>
              <button className="modal-close" onClick={() => setShowNotifModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="notif-list">
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <Bell size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Belum ada notifikasi untuk Anda</p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <div key={i} className="notif-item">
                    <div className="notif-item-header">
                      <span className="notif-item-title">{n.title}</span>
                      <span className="notif-item-time">
                        {new Date(n.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(n.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="notif-item-msg">{n.message}</div>
                  </div>
                ))
              )}
            </div>
            
            <button className="btn btn-secondary w-full mt-4" onClick={() => setShowNotifModal(false)}>Tutup</button>
          </div>
        </div>
      )}

      {/* In-App Sliding Toast Notification Banner */}
      {activeToastNotif && (
        <div className="notification-toast">
          <div style={{ background: 'var(--primary-50)', color: 'var(--primary)', padding: '0.4rem', borderRadius: '50%', display: 'flex' }}>
            <Bell size={16} />
          </div>
          <div className="notification-toast-content">
            <div className="notification-toast-title">{activeToastNotif.title}</div>
            <div className="notification-toast-msg">{activeToastNotif.message}</div>
          </div>
          <button className="notification-toast-close" onClick={() => setActiveToastNotif(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}

