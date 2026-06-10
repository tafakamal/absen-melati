import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileText, UserPlus, LogOut, ArrowLeft, Settings, Save,
  Clock, Calendar, Filter, Edit3, X, ChevronDown, BarChart3,
  AlertTriangle, CheckCircle, Timer, MapPin, Upload, Maximize2, Minimize2, Key,
  Eye, EyeOff, XCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../api';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  return { h, m, totalMinutes: h * 60 + m };
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

function formatDuration(totalMinutes) {
  if (totalMinutes <= 0) return '-';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const INITIAL_SCHEDULE = {
  1: { active: true, start: '17:00', end: '20:30' },
  2: { active: true, start: '17:00', end: '20:30' },
  3: { active: true, start: '17:00', end: '20:30' },
  4: { active: true, start: '17:00', end: '20:30' },
  5: { active: true, start: '17:00', end: '20:30' },
  6: { active: true, start: '10:00', end: '17:00' },
  0: { active: false, start: '08:00', end: '17:00' }
};

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('report');

  // Data
  const [users, setUsers] = useState([]);
  const [report, setReport] = useState([]);
  const [settings, setSettings] = useState({ KLINIK_LAT: '', KLINIK_LNG: '', MAX_DISTANCE: '', KLINIK_LOGO: '', APP_TITLE: '', GREETING_TITLE: '', GREETING_TEXT: '', NOMINAL_LEMBUR_PER_KALI: '30000', NOMINAL_HONOR_DOKTER: '100000', CLINIC_LOCATIONS: '' });
  const [lemburApprovals, setLemburApprovals] = useState([]);
  const [logoBase64, setLogoBase64] = useState(null);
  const [clinicLocationsList, setClinicLocationsList] = useState([]);

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

  // UI state
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notifRecipient, setNotifRecipient] = useState('Semua');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterUser, setFilterUser] = useState('Semua');

  // Add user form
  const [newNama, setNewNama] = useState('');
  const [newNowa, setNewNowa] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newToleransi, setNewToleransi] = useState(15);
  const [newStatus, setNewStatus] = useState('pegawai');
  const [newRole, setNewRole] = useState('user');
  const [newBatasAwalMasuk, setNewBatasAwalMasuk] = useState(60);
  const [newBatasAkhirPulang, setNewBatasAkhirPulang] = useState(240);
  const [addingUser, setAddingUser] = useState(false);
  const [newJadwal, setNewJadwal] = useState(INITIAL_SCHEDULE);
  const [newCabangKlinik, setNewCabangKlinik] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  // Edit user modal
  const [editingUser, setEditingUser] = useState(null);
  const [editJadwal, setEditJadwal] = useState(INITIAL_SCHEDULE);
  const [editToleransi, setEditToleransi] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editBatasAwalMasuk, setEditBatasAwalMasuk] = useState(60);
  const [editBatasAkhirPulang, setEditBatasAkhirPulang] = useState(240);
  const [savingUser, setSavingUser] = useState(false);
  const [editCabangKlinik, setEditCabangKlinik] = useState([]);
  
  // Reset Password Modal
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Lembur Approval Modal
  const [showLemburModal, setShowLemburModal] = useState(false);
  const [selectedLemburRow, setSelectedLemburRow] = useState(null);
  const [approveMinutesInput, setApproveMinutesInput] = useState('');
  const [savingLembur, setSavingLembur] = useState(false);

  // Manual Absen Modal
  const [showManualAbsenModal, setShowManualAbsenModal] = useState(false);
  const [manualUser, setManualUser] = useState('');
  const [manualTipe, setManualTipe] = useState('Masuk');
  const [manualDate, setManualDate] = useState(new Date().toISOString().substring(0, 10));
  const [manualTime, setManualTime] = useState(`${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`);
  const [manualKeterangan, setManualKeterangan] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Password Visibility States
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (users && users.length > 0 && !manualUser) {
      const firstEmp = users.find(u => u.role !== 'admin');
      if (firstEmp) setManualUser(firstEmp.nama);
    }
  }, [users, manualUser]);

  // ─── Data Fetching ─────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (activeTab === 'report' || activeTab === 'recap') {
        const [reportRes, usersRes, settingsRes] = await Promise.all([
          callApi({ action: 'get_report' }),
          callApi({ action: 'get_users' }),
          callApi({ action: 'get_settings' })
        ]);
        setReport(reportRes.report);
        setUsers(usersRes.users);
        setSettings(prev => ({ 
          ...prev, 
          NOMINAL_LEMBUR_PER_KALI: settingsRes.settings.NOMINAL_LEMBUR_PER_KALI || settingsRes.settings.NOMINAL_LEMBUR_PER_MENIT || '30000',
          NOMINAL_HONOR_DOKTER: settingsRes.settings.NOMINAL_HONOR_DOKTER || '100000' 
        }));
        
        try {
          const lemburRes = await callApi({ action: 'get_lembur_approvals' });
          setLemburApprovals(lemburRes.approvals || []);
        } catch (e) {
          console.warn('Lembur API endpoint not available yet:', e.message);
          setLemburApprovals([]);
        }
      } else if (activeTab === 'users') {
        const [res, settingsRes] = await Promise.all([
          callApi({ action: 'get_users' }),
          callApi({ action: 'get_settings' })
        ]);
        setUsers(res.users);
        let clinics = [];
        try {
          if (settingsRes.settings.CLINIC_LOCATIONS) {
            clinics = JSON.parse(settingsRes.settings.CLINIC_LOCATIONS);
          } else if (settingsRes.settings.KLINIK_LAT && settingsRes.settings.KLINIK_LNG) {
            clinics = [{ 
              name: 'Klinik Utama', 
              lat: String(settingsRes.settings.KLINIK_LAT).replace('_', ''), 
              lng: String(settingsRes.settings.KLINIK_LNG).replace('_', '') 
            }];
          }
        } catch(e) {}
        setClinicLocationsList(clinics);
      } else if (activeTab === 'settings') {
        const res = await callApi({ action: 'get_settings' });
        
        let clinics = [];
        try {
          if (res.settings.CLINIC_LOCATIONS) {
            clinics = JSON.parse(res.settings.CLINIC_LOCATIONS);
          } else if (res.settings.KLINIK_LAT && res.settings.KLINIK_LNG) {
            clinics = [{ 
              name: 'Klinik Utama', 
              lat: String(res.settings.KLINIK_LAT).replace('_', ''), 
              lng: String(res.settings.KLINIK_LNG).replace('_', '') 
            }];
          }
        } catch(e) {}
        setClinicLocationsList(clinics);
        
        setSettings({
          KLINIK_LAT: String(res.settings.KLINIK_LAT || '').replace('_', ''),
          KLINIK_LNG: String(res.settings.KLINIK_LNG || '').replace('_', ''),
          MAX_DISTANCE: res.settings.MAX_DISTANCE || '100',
          KLINIK_LOGO: res.settings.KLINIK_LOGO || '',
          GREETING_TITLE: res.settings.GREETING_TITLE || 'Melati Dental Care',
          GREETING_TEXT: res.settings.GREETING_TEXT || "Assalamu'alaikum",
          NOMINAL_LEMBUR_PER_KALI: res.settings.NOMINAL_LEMBUR_PER_KALI || res.settings.NOMINAL_LEMBUR_PER_MENIT || '30000',
          NOMINAL_HONOR_DOKTER: res.settings.NOMINAL_HONOR_DOKTER || '100000'
        });
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // ─── Filtered Report Data ──────────────────────────────────
  const filteredReport = useMemo(() => {
    return report.filter(item => {
      const d = new Date(item.timestamp);
      if (d.getMonth() !== filterMonth || d.getFullYear() !== filterYear) return false;
      if (filterUser !== 'Semua' && item.nama !== filterUser) return false;
      return true;
    });
  }, [report, filterMonth, filterYear, filterUser]);

  // ─── Report Stats ──────────────────────────────────────────
  const reportStats = useMemo(() => {
    const masuk = filteredReport.filter(r => r.tipe === 'Masuk').length;
    const keluar = filteredReport.filter(r => r.tipe === 'Keluar').length;
    const distances = filteredReport
      .map(r => parseFloat(r.jarak))
      .filter(d => !isNaN(d));
    const avgJarak = distances.length > 0
      ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1)
      : '0';
    return { masuk, keluar, avgJarak };
  }, [filteredReport]);

  // ─── Recap Data ────────────────────────────────────────────
  const recapData = useMemo(() => {
    // Build user lookup
    const userMap = {};
    users.forEach(u => {
      userMap[u.nama] = u;
    });

    // Filter report by month/year/user
    const filtered = report.filter(item => {
      const d = new Date(item.timestamp);
      if (d.getMonth() !== filterMonth || d.getFullYear() !== filterYear) return false;
      if (filterUser !== 'Semua' && item.nama !== filterUser) return false;
      return true;
    });

    // Group by nama + date
    const groups = {};
    filtered.forEach(item => {
      const d = new Date(item.timestamp);
      const dateKey = dateToKey(d);
      const key = `${item.nama}|${dateKey}`;
      if (!groups[key]) {
        groups[key] = { nama: item.nama, date: d, dateKey, masuk: null, keluar: null, tipe: null };
      }
      if (item.tipe === 'Masuk') {
        // Keep earliest masuk
        if (!groups[key].masuk || new Date(item.timestamp) < new Date(groups[key].masuk)) {
          groups[key].masuk = item.timestamp;
        }
      } else if (item.tipe === 'Keluar') {
        // Keep latest keluar
        if (!groups[key].keluar || new Date(item.timestamp) > new Date(groups[key].keluar)) {
          groups[key].keluar = item.timestamp;
        }
      } else if (item.tipe === 'Izin' || item.tipe === 'Sakit') {
        groups[key].tipe = item.tipe;
      }
    });

    const HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const rows = [];
    Object.values(groups).forEach(g => {
      const userInfo = userMap[g.nama] || {};
      const dayOfWeek = g.date.getDay(); // 0=Minggu, 6=Sabtu
      const isSabtu = dayOfWeek === 6;
      const isMinggu = dayOfWeek === 0;

      // Pilih jadwal sesuai hari
      let jamMulai = null;
      let jamSelesai = null;
      let isActive = true;

      if (userInfo.jadwal && userInfo.jadwal[dayOfWeek]) {
        const dayConfig = userInfo.jadwal[dayOfWeek];
        if (dayConfig.active) {
          jamMulai = parseTime(dayConfig.start);
          jamSelesai = parseTime(dayConfig.end);
        } else {
          isActive = false;
        }
      } else {
        // Fallback to legacy
        if (isMinggu) {
          isActive = false;
        } else {
          const jm = isSabtu ? (userInfo.jamMulaiSabtu || '10:00') : (userInfo.jamMulai || '17:00');
          const js = isSabtu ? (userInfo.jamSelesaiSabtu || '17:00') : (userInfo.jamSelesai || '20:30');
          jamMulai = parseTime(jm);
          jamSelesai = parseTime(js);
        }
      }

      const toleransi = parseInt(userInfo.toleransi) || 0;
      const isDokter = userInfo.status === 'dokter';
      const isIzinSakit = g.tipe === 'Izin' || g.tipe === 'Sakit';
      const dateKey = g.dateKey;
      const row = {
        nama: g.nama,
        dateKey: dateKey,
        tanggal: g.date,
        hari: HARI[dayOfWeek],
        isMinggu: !isActive || isIzinSakit,
        jamMasuk: g.masuk ? new Date(g.masuk) : null,
        jamKeluar: g.keluar ? new Date(g.keluar) : null,
        jadwalMulai: (!isActive || isIzinSakit) ? '-' : (jamMulai ? formatJamKerja(jamMulai.h + ':' + String(jamMulai.m).padStart(2, '0'), '') : '-'),
        jadwalSelesai: (!isActive || isIzinSakit) ? '-' : (jamSelesai ? formatJamKerja(jamSelesai.h + ':' + String(jamSelesai.m).padStart(2, '0'), '') : '-'),
        durasi: (isDokter || isIzinSakit) ? '-' : null,
        durasiMinutes: 0,
        status: isIzinSakit ? g.tipe : (isDokter ? '-' : (!isActive ? 'Hari Libur' : '-')),
        lembur: (isDokter || isIzinSakit) ? '-' : null,
        lemburMinutes: 0,
        pulangCepat: (isDokter || isIzinSakit) ? '-' : null,
        pulangCepatMinutes: 0,
        terlambat: false
      };

      if (row.jamMasuk && row.jamKeluar) {
        const diffMs = row.jamKeluar - row.jamMasuk;
        const durasiMinutes = Math.floor(diffMs / 60000);
        row.durasiMinutes = durasiMinutes;
        if (!isDokter) {
          row.durasi = formatDuration(durasiMinutes);
        }

        if (isActive && !isDokter) {
          // Late check
          if (jamMulai) {
            const masukMinutes = row.jamMasuk.getHours() * 60 + row.jamMasuk.getMinutes();
            const batasMinutes = jamMulai.totalMinutes + toleransi;
            if (masukMinutes > batasMinutes) {
              const terlambatMenit = masukMinutes - jamMulai.totalMinutes;
              row.status = `Terlambat ${terlambatMenit}m`;
              row.terlambat = true;
            } else {
              row.status = 'Tepat Waktu';
            }
          }

          // Overtime / early leave
          if (jamSelesai) {
            const keluarMinutes = row.jamKeluar.getHours() * 60 + row.jamKeluar.getMinutes();
            let lemburMenit = 0;

            if (keluarMinutes > jamSelesai.totalMinutes) {
              lemburMenit += keluarMinutes - jamSelesai.totalMinutes;
            }

            const isPegawaiAtauPerawat = userInfo.status === 'pegawai' || userInfo.status === 'perawat';
            if (isPegawaiAtauPerawat && jamMulai) {
              const masukMinutes = row.jamMasuk.getHours() * 60 + row.jamMasuk.getMinutes();
              if (masukMinutes < jamMulai.totalMinutes) {
                lemburMenit += jamMulai.totalMinutes - masukMinutes;
              }
            }

            if (lemburMenit > 0) {
              row.lemburMinutes = lemburMenit;
              row.lembur = formatDuration(lemburMenit);
              
              const approval = lemburApprovals.find(a => a.date === dateKey && a.nama === row.nama);
              if (approval) {
                row.lemburStatus = approval.status;
                row.lemburApprovedMinutes = approval.approvedMinutes;
                row.lemburApprovedAdmin = approval.adminName;
              } else {
                row.lemburStatus = 'Pending';
                row.lemburApprovedMinutes = 0;
              }
            }

            if (keluarMinutes < jamSelesai.totalMinutes) {
              const cepatMenit = jamSelesai.totalMinutes - keluarMinutes;
              row.pulangCepatMinutes = cepatMenit;
              row.pulangCepat = formatDuration(cepatMenit);
            }
          }
        }
      } else if (row.jamMasuk && !row.jamKeluar) {
        row.status = isDokter ? '-' : (!isActive ? 'Hari Libur' : 'Belum Pulang');
      }

      rows.push(row);
    });

    // Sort by date desc, then nama
    rows.sort((a, b) => b.tanggal - a.tanggal || a.nama.localeCompare(b.nama));
    return rows;
  }, [report, users, filterMonth, filterYear, filterUser, lemburApprovals]);

  // ─── Recap Stats ───────────────────────────────────────────
  const recapStats = useMemo(() => {
    const totalHariKerja = recapData.length;
    const totalJamKerja = recapData.reduce((sum, r) => sum + r.durasiMinutes, 0);
    const totalLembur = recapData.reduce((sum, r) => sum + r.lemburMinutes, 0);
    const totalLemburApproved = recapData.reduce((sum, r) => sum + (r.lemburApprovedMinutes || 0), 0);
    
    const jumlahLemburApproved = recapData.filter(r => r.lemburStatus === 'Approved').length;
    const nominalPerKali = parseInt(settings.NOMINAL_LEMBUR_PER_KALI || '30000', 10);
    const totalUangLembur = jumlahLemburApproved * nominalPerKali;
    
    const hariTerlambat = recapData.filter(r => r.terlambat).length;
    
    let isDokter = false;
    let totalHonorDokter = 0;
    if (filterUser !== 'Semua') {
      const selectedUser = users.find(u => u.nama === filterUser);
      if (selectedUser && selectedUser.status === 'dokter') {
        isDokter = true;
        const nominalHonor = parseInt(settings.NOMINAL_HONOR_DOKTER || '100000', 10);
        totalHonorDokter = totalHariKerja * nominalHonor;
      }
    }
    
    return {
      totalHariKerja,
      totalJamKerja: formatDuration(totalJamKerja),
      totalLembur: formatDuration(totalLembur),
      totalLemburApproved: formatDuration(totalLemburApproved),
      totalUangLembur: `Rp ${totalUangLembur.toLocaleString('id-ID')}`,
      hariTerlambat,
      isDokter,
      totalHonorDokter: `Rp ${totalHonorDokter.toLocaleString('id-ID')}`
    };
  }, [recapData, settings.NOMINAL_LEMBUR_PER_KALI, settings.NOMINAL_HONOR_DOKTER, filterUser, users]);

  // ─── Employee names for filter ─────────────────────────────
  const employeeNames = useMemo(() => {
    return users.filter(u => u.role !== 'admin').map(u => u.nama);
  }, [users]);

  // ─── Year options ──────────────────────────────────────────
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1];
  }, []);

  const renderWeeklySchedule = (schedule, setSchedule, isDokter = false) => {
    const days = [
      { id: 1, name: 'Senin' },
      { id: 2, name: 'Selasa' },
      { id: 3, name: 'Rabu' },
      { id: 4, name: 'Kamis' },
      { id: 5, name: 'Jumat' },
      { id: 6, name: 'Sabtu' },
      { id: 0, name: 'Ahad' }
    ];

    const handleToggle = (dayId) => {
      setSchedule(prev => ({
        ...prev,
        [dayId]: {
          ...prev[dayId],
          active: !prev[dayId].active
        }
      }));
    };

    const handleTimeChange = (dayId, field, val) => {
      setSchedule(prev => ({
        ...prev,
        [dayId]: {
          ...prev[dayId],
          [field]: val
        }
      }));
    };

    return (
      <div className="weekly-schedule-grid">
        <div className="schedule-header">
          <div>Hari</div>
          <div style={{ textAlign: 'center' }}>Aktif</div>
          {!isDokter && <div>Jam Kerja</div>}
        </div>
        {days.map(d => {
          const dayConfig = schedule[d.id] || { active: false, start: '08:00', end: '17:00' };
          return (
            <div key={d.id} className={`schedule-row ${dayConfig.active ? 'active' : 'inactive'}`}>
              <div className="day-name">{d.name}</div>
              <div className="day-active-chk">
                <input
                  type="checkbox"
                  checked={dayConfig.active}
                  onChange={() => handleToggle(d.id)}
                />
              </div>
              {!isDokter && (
                <div className="day-times">
                  <input
                    type="time"
                    className="form-input time-small"
                    value={dayConfig.start}
                    onChange={e => handleTimeChange(d.id, 'start', e.target.value)}
                    disabled={!dayConfig.active}
                    required={dayConfig.active}
                  />
                  <span className="time-separator">s/d</span>
                  <input
                    type="time"
                    className="form-input time-small"
                    value={dayConfig.end}
                    onChange={e => handleTimeChange(d.id, 'end', e.target.value)}
                    disabled={!dayConfig.active}
                    required={dayConfig.active}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderUserScheduleSummary = (userRow) => {
    if (userRow.jadwal) {
      const days = [
        { id: 1, name: 'Sen' },
        { id: 2, name: 'Sel' },
        { id: 3, name: 'Rab' },
        { id: 4, name: 'Kam' },
        { id: 5, name: 'Jum' },
        { id: 6, name: 'Sab' },
        { id: 0, name: 'Min' }
      ];

      const activeDays = days.filter(d => userRow.jadwal[d.id] && userRow.jadwal[d.id].active);

      if (activeDays.length === 0) {
        return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Libur / Tidak ada jadwal</span>;
      }

      const groups = {};
      activeDays.forEach(d => {
        const times = `${userRow.jadwal[d.id].start} - ${userRow.jadwal[d.id].end}`;
        if (!groups[times]) {
          groups[times] = [];
        }
        groups[times].push(d.name);
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
          {Object.entries(groups).map(([times, dayNames]) => (
            <div key={times} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ 
                background: 'var(--primary-50)', 
                color: 'var(--primary)', 
                padding: '1px 5px', 
                borderRadius: '4px', 
                fontWeight: 600,
                fontSize: '0.7rem'
              }}>
                {dayNames.join(', ')}
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{times}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
        <div><span style={{ fontWeight: 600 }}>Sen-Jum:</span> {formatJamKerja(userRow.jamMulai, '17:00')} - {formatJamKerja(userRow.jamSelesai, '20:30')}</div>
        <div><span style={{ fontWeight: 600 }}>Sabtu:</span> {formatJamKerja(userRow.jamMulaiSabtu, '10:00')} - {formatJamKerja(userRow.jamSelesaiSabtu, '17:00')}</div>
      </div>
    );
  };

  // ─── Handlers ──────────────────────────────────────────────
  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await callApi({
        action: 'add_user',
        nama: newNama,
        nowa: newNowa,
        password: newPassword,
        jamMulai: newJadwal[1].start,
        jamSelesai: newJadwal[1].end,
        jamMulaiSabtu: newJadwal[6].start,
        jamSelesaiSabtu: newJadwal[6].end,
        toleransi: newStatus === 'dokter' ? 0 : newToleransi,
        status: newStatus,
        role: newRole,
        batasAwalMasuk: newStatus === 'dokter' ? 0 : newBatasAwalMasuk,
        batasAkhirPulang: newStatus === 'dokter' ? 0 : newBatasAkhirPulang,
        jadwal: newJadwal,
        cabangKlinik: newCabangKlinik
      });
      setNewNama('');
      setNewNowa('');
      setNewPassword('');
      setNewToleransi(15);
      setNewStatus('pegawai');
      setNewRole('user');
      setNewBatasAwalMasuk(60);
      setNewBatasAkhirPulang(240);
      setNewJadwal(INITIAL_SCHEDULE);
      setNewCabangKlinik([]);
      setShowAddUserModal(false);
      setSuccessMsg('Karyawan berhasil ditambahkan!');
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setAddingUser(false);
    }
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setEditToleransi(u.toleransi || 15);
    setEditStatus(u.status || 'pegawai');
    setEditRole(u.role || 'user');
    setEditBatasAwalMasuk(u.batasAwalMasuk !== undefined ? u.batasAwalMasuk : 60);
    setEditBatasAkhirPulang(u.batasAkhirPulang !== undefined ? u.batasAkhirPulang : 240);
    setEditCabangKlinik(u.cabangKlinik || []);
    
    if (u.jadwal) {
      setEditJadwal(u.jadwal);
    } else {
      const jm = formatJamKerja(u.jamMulai, '17:00');
      const js = formatJamKerja(u.jamSelesai, '20:30');
      const jms = formatJamKerja(u.jamMulaiSabtu, '10:00');
      const jss = formatJamKerja(u.jamSelesaiSabtu, '17:00');
      setEditJadwal({
        1: { active: true, start: jm, end: js },
        2: { active: true, start: jm, end: js },
        3: { active: true, start: jm, end: js },
        4: { active: true, start: jm, end: js },
        5: { active: true, start: jm, end: js },
        6: { active: true, start: jms, end: jss },
        0: { active: false, start: '08:00', end: '17:00' }
      });
    }
    
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    setErrorMsg('');
    try {
      await callApi({
        action: 'update_user',
        nowa: editingUser.nowa,
        nama: editingUser.nama,
        jamMulai: editJadwal[1].start,
        jamSelesai: editJadwal[1].end,
        jamMulaiSabtu: editJadwal[6].start,
        jamSelesaiSabtu: editJadwal[6].end,
        toleransi: editStatus === 'dokter' ? 0 : editToleransi,
        status: editStatus,
        role: editRole,
        batasAwalMasuk: editStatus === 'dokter' ? 0 : editBatasAwalMasuk,
        batasAkhirPulang: editStatus === 'dokter' ? 0 : editBatasAkhirPulang,
        jadwal: editJadwal,
        cabangKlinik: editCabangKlinik
      });
      setEditingUser(null);
      setSuccessMsg('Data karyawan berhasil diperbarui!');
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPasswordValue || !resetPasswordUser) return;
    setSavingUser(true);
    setErrorMsg('');
    try {
      await callApi({
        action: 'update_user',
        nowa: resetPasswordUser.nowa,
        password: resetPasswordValue
      });
      setResetPasswordUser(null);
      setResetPasswordValue('');
      setSuccessMsg(`Password untuk ${resetPasswordUser.nama} berhasil direset!`);
      fetchData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg('');
    setSuccessMsg('');
    const sanitizedSettings = {
      ...settings,
      CLINIC_LOCATIONS: JSON.stringify(clinicLocationsList),
      KLINIK_LAT: clinicLocationsList.length > 0 ? '_' + String(clinicLocationsList[0].lat).replace(',', '.') : '_' + String(settings.KLINIK_LAT).replace(',', '.'),
      KLINIK_LNG: clinicLocationsList.length > 0 ? '_' + String(clinicLocationsList[0].lng).replace(',', '.') : '_' + String(settings.KLINIK_LNG).replace(',', '.')
    };
    try {
      await callApi({
        action: 'save_settings',
        settings: sanitizedSettings,
        logoBase64: logoBase64
      });
      setLogoBase64(null); // reset file state after success
      setSettings({
        ...sanitizedSettings,
        KLINIK_LAT: sanitizedSettings.KLINIK_LAT.replace('_', ''),
        KLINIK_LNG: sanitizedSettings.KLINIK_LNG.replace('_', '')
      });
      setSuccessMsg('Pengaturan lokasi berhasil disimpan!');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      setErrorMsg('Judul dan pesan notifikasi wajib diisi');
      return;
    }
    setSendingNotif(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await callApi({
        action: 'send_notification',
        recipient: notifRecipient,
        title: notifTitle,
        message: notifMessage
      });
      setNotifTitle('');
      setNotifMessage('');
      setSuccessMsg('Notifikasi berhasil dikirim ke karyawan!');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSendingNotif(false);
    }
  };

  const handleSaveLembur = async (status) => {
    setSavingLembur(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        action: 'approve_lembur',
        date: selectedLemburRow.dateKey,
        nama: selectedLemburRow.nama,
        lemburMinutes: selectedLemburRow.lemburMinutes,
        approvedMinutes: status === 'Approved' ? parseInt(approveMinutesInput, 10) : 0,
        status: status,
        adminName: 'Admin'
      };
      await callApi(payload);
      
      setLemburApprovals(prev => {
        const filtered = prev.filter(a => !(a.date === payload.date && a.nama === payload.nama));
        return [...filtered, payload];
      });
      
      setSuccessMsg(`Lembur ${status === 'Approved' ? 'disetujui' : 'ditolak'} untuk ${payload.nama}`);
      setShowLemburModal(false);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingLembur(false);
    }
  };

  const handleManualAbsenSubmit = async (e) => {
    e.preventDefault();
    if (!manualUser) {
      setErrorMsg('Pilih karyawan terlebih dahulu');
      return;
    }
    setSavingManual(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Prevent duplicate manual attendance for Doctors on the same day
      const targetUser = users.find(u => u.nama === manualUser);
      if (targetUser && targetUser.status === 'dokter') {
        const targetDateStr = manualDate; // YYYY-MM-DD
        const hasExisting = report.some(item => {
          if (item.nama !== manualUser) return false;
          const itemDateStr = dateToKey(new Date(item.timestamp));
          return itemDateStr === targetDateStr;
        });
        
        if (hasExisting) {
          setErrorMsg(`Dokter ${manualUser} sudah memiliki catatan absensi pada tanggal ${new Date(manualDate).toLocaleDateString('id-ID')}. Dokter tidak diperbolehkan memiliki lebih dari 1 absensi per hari.`);
          setSavingManual(false);
          return;
        }
      }

      const selectedDateTime = new Date(`${manualDate}T${manualTime}:00`);
      
      const payload = {
        action: 'attend',
        nama: manualUser,
        tipe: manualTipe,
        jarak: 0,
        koordinat: '-',
        photo: '',
        keterangan: manualKeterangan || (manualTipe === 'Izin' ? 'Izin (Manual)' : manualTipe === 'Sakit' ? 'Sakit (Manual)' : 'Absen Manual oleh Admin'),
        timestamp: selectedDateTime.toISOString()
      };
      
      await callApi(payload);
      
      setSuccessMsg(`Absen manual ${manualTipe} berhasil disimpan untuk ${manualUser}`);
      setShowManualAbsenModal(false);
      setManualKeterangan('');
      fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan absensi manual');
    } finally {
      setSavingManual(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ─── Filter Bar Component ─────────────────────────────────
  const renderFilterBar = () => (
    <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
      <span className="filter-label"><Filter size={14} /> Filter:</span>
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
      <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
        <option value="Semua">Semua Karyawan</option>
        {employeeNames.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <button 
        type="button" 
        className="btn btn-primary" 
        onClick={() => {
          const now = new Date();
          setManualDate(now.toISOString().substring(0, 10));
          setManualTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
          setShowManualAbsenModal(true);
        }}
        style={{ marginLeft: 'auto', padding: '0.4rem 1rem', fontSize: '0.88rem' }}
      >
        + Absen Manual
      </button>
    </div>
  );

  // ─── Tab: Laporan Absensi ──────────────────────────────────
  const renderReport = () => (
    <div>
      {renderFilterBar()}

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{reportStats.masuk}</div>
          <div className="stat-label">Total Absen Masuk</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{reportStats.keluar}</div>
          <div className="stat-label">Total Absen Keluar</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{reportStats.avgJarak}m</div>
          <div className="stat-label">Rata-rata Jarak</div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Nama</th>
              <th>Tipe</th>
              <th>Jarak</th>
              <th>Foto</th>
            </tr>
          </thead>
          <tbody>
            {filteredReport.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center" style={{ padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <Calendar size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <br />Tidak ada data absensi untuk periode ini
                </td>
              </tr>
            ) : (
              filteredReport.map((item, idx) => {
                const d = new Date(item.timestamp);
                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{d.toLocaleDateString('id-ID')}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td style={{ fontWeight: '500' }}>{item.nama}</td>
                    <td>
                      {item.tipe === 'Masuk' ? (
                        <span className="badge badge-success">{item.tipe}</span>
                      ) : item.tipe === 'Keluar' ? (
                        <span className="badge badge-error">{item.tipe}</span>
                      ) : item.tipe === 'Izin' ? (
                        <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5' }}>{item.tipe}</span>
                      ) : item.tipe === 'Sakit' ? (
                        <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>{item.tipe}</span>
                      ) : (
                        <span className="badge badge-neutral">{item.tipe}</span>
                      )}
                    </td>
                    <td>
                      {item.jarak} m
                      {item.koordinat && (
                        <a 
                          href={`https://www.google.com/maps?q=${item.koordinat}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}
                        >
                          <MapPin size={12} style={{ display: 'inline', marginRight: '2px' }}/>
                          Peta
                        </a>
                      )}
                    </td>
                    <td>
                      {item.fotoUrl ? (
                        <button
                          onClick={() => setSelectedPhoto(item.fotoUrl)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--secondary)', fontWeight: '500', padding: 0, minHeight: 'auto', height: 'auto', textTransform: 'none' }}
                        >
                          Lihat Foto
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Tab: Rekap Jam Kerja ──────────────────────────────────
  const renderRecap = () => (
    <div>
      {renderFilterBar()}

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{recapStats.totalHariKerja}</div>
          <div className="stat-label">Total Hari Kerja</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{recapStats.totalJamKerja}</div>
          <div className="stat-label">Total Jam Kerja</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{recapStats.totalLembur}</div>
          <div className="stat-label">Total Lembur</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{recapStats.hariTerlambat}</div>
          <div className="stat-label">Hari Terlambat</div>
        </div>
        {!recapStats.isDokter && (
          <>
            <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--primary)' }}>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{recapStats.totalLemburApproved}</div>
              <div className="stat-label" style={{ color: 'var(--primary)', fontWeight: '600' }}>Lembur Disetujui</div>
            </div>
            <div className="stat-card" style={{ background: 'var(--primary)', color: 'white', border: '1px solid var(--primary)' }}>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>{recapStats.totalUangLembur}</div>
              <div className="stat-label" style={{ color: 'white', opacity: 0.9 }}>Uang Lembur</div>
            </div>
          </>
        )}
        {recapStats.isDokter && (
          <div className="stat-card" style={{ background: 'var(--primary)', color: 'white', border: '1px solid var(--primary)', gridColumn: 'span 2' }}>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{recapStats.totalHonorDokter}</div>
            <div className="stat-label" style={{ color: 'white', opacity: 0.9 }}>Total Honor Kehadiran</div>
          </div>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Hari</th>
              <th>Tanggal</th>
              <th>Jadwal</th>
              <th>Jam Masuk</th>
              <th>Jam Keluar</th>
              <th>Durasi Kerja</th>
              <th>Status</th>
              <th>Lembur</th>
              <th>Pulang Cepat</th>
            </tr>
          </thead>
          <tbody>
            {recapData.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center" style={{ padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <BarChart3 size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <br />Tidak ada data rekap untuk periode ini
                </td>
              </tr>
            ) : (
              recapData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: '500' }}>{row.nama}</td>
                  <td>
                    <span className={`badge ${row.isMinggu ? 'badge-error' : row.hari === 'Sabtu' ? 'badge-info' : 'badge-neutral'}`}>
                      {row.hari}
                    </span>
                  </td>
                  <td>{row.tanggal.toLocaleDateString('id-ID')}</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {row.isMinggu ? <span style={{ color: 'var(--text-muted)' }}>Libur</span> : `${row.jadwalMulai} - ${row.jadwalSelesai}`}
                  </td>
                  <td>
                    {row.jamMasuk
                      ? row.jamMasuk.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </td>
                  <td>
                    {row.jamKeluar
                      ? row.jamKeluar.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </td>
                  <td>{row.durasi || '-'}</td>
                  <td>
                    {row.status === 'Tepat Waktu' ? (
                      <span className="badge badge-success">
                        <CheckCircle size={12} /> {row.status}
                      </span>
                    ) : row.status === 'Belum Pulang' ? (
                      <span className="badge badge-warning">
                        <Timer size={12} /> {row.status}
                      </span>
                    ) : row.status === 'Izin' ? (
                      <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={12} /> Izin
                      </span>
                    ) : row.status === 'Sakit' ? (
                      <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Sakit
                      </span>
                    ) : row.terlambat ? (
                      <span className="badge badge-error">
                        <AlertTriangle size={12} /> {row.status}
                      </span>
                    ) : (
                      <span className="badge badge-neutral">{row.status}</span>
                    )}
                  </td>
                  <td>
                    {row.lembur ? (
                      <button 
                        className={`badge ${row.lemburStatus === 'Approved' ? 'badge-success' : row.lemburStatus === 'Rejected' ? 'badge-error' : 'badge-info'}`}
                        style={{ cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => {
                          setSelectedLemburRow(row);
                          setApproveMinutesInput(row.lemburApprovedMinutes || row.lemburMinutes);
                          setShowLemburModal(true);
                        }}
                        title="Klik untuk proses persetujuan lembur"
                      >
                        {row.lemburStatus === 'Approved' ? <CheckCircle size={12} /> : row.lemburStatus === 'Rejected' ? <XCircle size={12} /> : <Clock size={12} />}
                        {row.lembur} 
                        {row.lemburStatus === 'Approved' && ` (${formatDuration(row.lemburApprovedMinutes)})`}
                        {row.lemburStatus === 'Rejected' && ` (Ditolak)`}
                      </button>
                    ) : '-'}
                  </td>
                  <td>
                    {row.pulangCepat ? (
                      <span className="badge badge-warning">{row.pulangCepat}</span>
                    ) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Tab: Karyawan ─────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter(u => u.nama.toLowerCase().includes(searchUser.toLowerCase()) || u.nowa.includes(searchUser));
  }, [users, searchUser]);

  const renderUsers = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <input 
          type="text" 
          className="form-input" 
          placeholder="Cari nama / WA..." 
          value={searchUser}
          onChange={e => setSearchUser(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
          <UserPlus size={18} /> Tambah Karyawan
        </button>
      </div>

      <div className="table-container mb-6">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>No WA</th>
              <th>Jam Kerja</th>
              <th>Toleransi</th>
              <th>Status</th>
              <th>Role</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center" style={{ padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  Belum ada data karyawan
                </td>
              </tr>
            ) : (
              filteredUsers.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: '500' }}>{item.nama}</td>
                  <td>{item.nowa}</td>
                  <td>
                    {renderUserScheduleSummary(item)}
                  </td>
                  <td>{item.status === 'dokter' ? '-' : `${item.toleransi || 15} menit`}</td>
                  <td>
                    <span className={`badge ${item.status === 'perawat' ? 'badge-info' : 'badge-neutral'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.role === 'admin' ? (
                      <span className="badge badge-success">Admin</span>
                    ) : 'User'}
                  </td>
                  <td>
                    {item.role !== 'admin' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="edit-btn" onClick={() => openEditModal(item)}>
                          <Edit3 size={13} /> Edit
                        </button>
                        <button className="edit-btn" style={{ background: 'var(--bg-secondary)' }} onClick={() => setResetPasswordUser(item)}>
                          <Key size={13} /> Password
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );

  // ─── Tab: Pengaturan ───────────────────────────────────────
  const renderSettings = () => (
    <div>
      <h3 className="mb-2">
        <Settings size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
        Pengaturan Titik Absensi
      </h3>
      <p className="form-label mb-6">
        Tentukan koordinat pusat klinik. Karyawan hanya bisa absen jika berada dalam radius jarak yang ditentukan dari titik ini.
      </p>

      <form onSubmit={handleSaveSettings}>
        <div className="flex flex-col gap-4 max-w-md">
          <div className="form-group mb-4">
            <label className="form-label">Daftar Lokasi Klinik (Cabang)</label>
            {clinicLocationsList.map((clinic, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  value={clinic.name} 
                  onChange={e => {
                    const newList = [...clinicLocationsList];
                    newList[index].name = e.target.value;
                    setClinicLocationsList(newList);
                  }}
                  placeholder="Nama Klinik (mis: Cabang A)" 
                  style={{ flex: 1.5, minWidth: 0 }}
                  required
                />
                <input 
                  type="text" 
                  className="form-input" 
                  value={clinic.lat} 
                  onChange={e => {
                    const newList = [...clinicLocationsList];
                    newList[index].lat = e.target.value;
                    setClinicLocationsList(newList);
                  }}
                  placeholder="Latitude" 
                  style={{ flex: 1, minWidth: 0 }}
                  required
                />
                <input 
                  type="text" 
                  className="form-input" 
                  value={clinic.lng} 
                  onChange={e => {
                    const newList = [...clinicLocationsList];
                    newList[index].lng = e.target.value;
                    setClinicLocationsList(newList);
                  }}
                  placeholder="Longitude" 
                  style={{ flex: 1, minWidth: 0 }}
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setClinicLocationsList(clinicLocationsList.filter((_, i) => i !== index))}
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '0 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Hapus Lokasi"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button 
              type="button" 
              className="btn btn-secondary mt-2" 
              onClick={() => setClinicLocationsList([...clinicLocationsList, { name: '', lat: '', lng: '' }])}
              style={{ width: '100%' }}
            >
              + Tambah Cabang Klinik
            </button>
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Maksimal Jarak Absen (Meter)</label>
            <input
              type="number"
              className="form-input"
              value={settings.MAX_DISTANCE}
              onChange={e => setSettings({ ...settings, MAX_DISTANCE: e.target.value })}
              placeholder="Contoh: 100"
              required
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Link URL Logo Klinik</label>
            <input
              type="text"
              className="form-input"
              value={settings.KLINIK_LOGO || ''}
              onChange={e => setSettings({ ...settings, KLINIK_LOGO: e.target.value })}
              placeholder="Contoh: https://i.ibb.co.com/Tp8ZHHp/logo2.png"
            />
            {settings.KLINIK_LOGO && (
              <div style={{marginTop:'0.5rem'}}>
                <span style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>Pratinjau Logo:</span><br/>
                <img src={settings.KLINIK_LOGO.includes('/d/') ? `https://drive.google.com/thumbnail?id=${settings.KLINIK_LOGO.split('/d/')[1].split('/')[0]}&sz=w200` : settings.KLINIK_LOGO} alt="Current Logo" style={{maxHeight:'50px', borderRadius:'4px', marginTop:'0.2rem'}} />
              </div>
            )}
          </div>

          <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
          
          <div className="form-group mb-0">
            <label className="form-label">Judul Aplikasi (Tampil di Halaman Login)</label>
            <input
              type="text"
              className="form-input"
              value={settings.APP_TITLE || ''}
              onChange={e => setSettings({ ...settings, APP_TITLE: e.target.value })}
              placeholder="Contoh: Melati Dental Care"
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Judul Sapaan (Di Atas Salam)</label>
            <input
              type="text"
              className="form-input"
              value={settings.GREETING_TITLE || ''}
              onChange={e => setSettings({ ...settings, GREETING_TITLE: e.target.value })}
              placeholder="Contoh: MELATI DENTAL CARE"
            />
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Teks Sapaan (Salam)</label>
            <input
              type="text"
              className="form-input"
              value={settings.GREETING_TEXT || ''}
              onChange={e => setSettings({ ...settings, GREETING_TEXT: e.target.value })}
              placeholder="Contoh: Assalamu'alaikum,"
            />
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Nominal Uang Lembur (per Kejadian/Kali)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Rp</span>
              <input
                type="number"
                className="form-input"
                value={settings.NOMINAL_LEMBUR_PER_KALI || '30000'}
                onChange={e => setSettings({ ...settings, NOMINAL_LEMBUR_PER_KALI: e.target.value })}
                placeholder="Contoh: 30000"
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>*Biaya flat setiap kali lembur disetujui (Approved).</span>
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Nominal Honor Dokter (per Hari Hadir)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Rp</span>
              <input
                type="number"
                className="form-input"
                value={settings.NOMINAL_HONOR_DOKTER || '100000'}
                onChange={e => setSettings({ ...settings, NOMINAL_HONOR_DOKTER: e.target.value })}
                placeholder="Contoh: 100000"
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>*Honor yang dihitung berdasarkan jumlah hari kehadiran Dokter.</span>
          </div>

          <button type="submit" className="btn btn-primary mt-2" disabled={savingSettings}>
            {savingSettings ? <div className="spinner spinner-sm"></div> : <Save size={18} />}
            Simpan Pengaturan
          </button>
        </div>
      </form>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h3 className="mb-2">
        <Upload size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
        📢 Kirim Notifikasi PWA
      </h3>
      <p className="form-label mb-6">
        Kirimkan pesan/pengumuman penting kepada karyawan. Notifikasi ini akan langsung memicu push notification di layar handphone karyawan (jika diinstal).
      </p>

      <form onSubmit={handleSendNotification}>
        <div className="flex flex-col gap-4 max-w-md">
          <div className="form-group mb-0">
            <label className="form-label">Penerima Notifikasi</label>
            <select
              className="form-input"
              value={notifRecipient}
              onChange={e => setNotifRecipient(e.target.value)}
            >
              <option value="Semua">Semua Karyawan</option>
              {users.filter(u => u.role !== 'admin').map((u, i) => (
                <option key={i} value={u.nowa}>{u.nama} ({u.nowa})</option>
              ))}
            </select>
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Judul Pesan</label>
            <input
              type="text"
              className="form-input"
              value={notifTitle}
              onChange={e => setNotifTitle(e.target.value)}
              placeholder="Contoh: Pengumuman Libur"
              required
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Isi Pesan / Pengumuman</label>
            <textarea
              className="form-input"
              rows="4"
              value={notifMessage}
              onChange={e => setNotifMessage(e.target.value)}
              placeholder="Tulis pesan pengumuman Anda di sini..."
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary mt-2" disabled={sendingNotif}>
            {sendingNotif ? <div className="spinner spinner-sm"></div> : <Save size={18} />}
            Kirim Notifikasi
          </button>
        </div>
      </form>
    </div>
  );

  // ─── Tabs config ───────────────────────────────────────────
  const tabs = [
    { id: 'report', label: 'Laporan Absensi', icon: FileText },
    { id: 'recap', label: 'Rekap Jam Kerja', icon: BarChart3 },
    { id: 'users', label: 'Karyawan', icon: Users },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  // ─── Render ────────────────────────────────────────────────
  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="text-gradient">Dashboard Admin</h2>
          <p className="form-label" style={{ marginBottom: 0 }}>Melati Dental Care — Sistem Absensi</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="btn btn-ghost" 
            onClick={toggleFullscreen} 
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ padding: '0.5rem 1rem' }}>
            <ArrowLeft size={16} /> Absen
          </button>
          <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </div>

      <div className="main-content">

      {/* Tab Navigation */}
      <div className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>



      {/* Content Card */}
      <div className="card glass">
        {loading ? (
          <div className="flex justify-center" style={{ padding: '3rem 1rem' }}>
            <div className="spinner spinner-primary"></div>
          </div>
        ) : activeTab === 'report' ? (
          renderReport()
        ) : activeTab === 'recap' ? (
          renderRecap()
        ) : activeTab === 'users' ? (
          renderUsers()
        ) : (
          renderSettings()
        )}
      </div>

      {/* Footer Copyright */}
      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        &copy; {new Date().getFullYear()} <a href="https://wa.me/6285360787962" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>@thafa_kamal</a>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ margin: 0 }}>
                <Edit3 size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                Edit Karyawan
              </h3>
              <button
                className="edit-btn"
                onClick={() => setEditingUser(null)}
                style={{ padding: '0.4rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <p className="form-label mb-4" style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              {editingUser.nama}
            </p>

            <form onSubmit={handleUpdateUser}>
              <p className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📅 Penjadwalan Kerja Mingguan</p>
              {renderWeeklySchedule(editJadwal, setEditJadwal, editStatus === 'dokter')}
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Akses Cabang Klinik</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {clinicLocationsList.length === 0 && <span style={{color: 'var(--text-muted)'}}>Belum ada cabang klinik yang dikonfigurasi.</span>}
                  {clinicLocationsList.map((clinic, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-secondary)', padding: '5px 10px', borderRadius: '4px' }}>
                      <input 
                        type="checkbox"
                        checked={editCabangKlinik.includes(clinic.name)}
                        onChange={e => {
                          if (e.target.checked) setEditCabangKlinik([...editCabangKlinik, clinic.name]);
                          else setEditCabangKlinik(editCabangKlinik.filter(c => c !== clinic.name));
                        }}
                      />
                      {clinic.name}
                    </label>
                  ))}
                </div>
              </div>
              {editStatus !== 'dokter' && (
                <div className="form-group">
                  <label className="form-label">Toleransi Terlambat (menit)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editToleransi}
                    onChange={e => setEditToleransi(e.target.value)}
                    min="0"
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                >
                  <option value="pegawai">Pegawai</option>
                  <option value="dokter">Dokter</option>
                  <option value="magang">Magang</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Role Akun</label>
                <select
                  className="form-input"
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                >
                  <option value="user">User Biasa</option>
                  <option value="user_bebas">User Bebas Lokasi</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editStatus !== 'dokter' && (
                <div className="flex gap-4">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Batas Awal Masuk (mnt)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editBatasAwalMasuk}
                      onChange={e => setEditBatasAwalMasuk(Number(e.target.value))}
                      placeholder="60"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Batas Akhir Pulang (mnt)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editBatasAkhirPulang}
                      onChange={e => setEditBatasAkhirPulang(Number(e.target.value))}
                      placeholder="240"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary" disabled={savingUser} style={{ flex: 1 }}>
                  {savingUser ? <div className="spinner"></div> : <><Save size={16} /> Simpan</>}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingUser(null)}
                  style={{ flex: 1 }}
                >
                  <X size={16} /> Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Lembur Approval Modal */}
      {showLemburModal && selectedLemburRow && (
        <div className="modal-overlay" onClick={() => setShowLemburModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Persetujuan Lembur</h3>
              <button onClick={() => setShowLemburModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ marginBottom: '0.5rem' }}><strong>Nama:</strong> {selectedLemburRow.nama}</p>
              <p style={{ marginBottom: '0.5rem' }}><strong>Tanggal:</strong> {selectedLemburRow.tanggal.toLocaleDateString('id-ID')}</p>
              <p style={{ marginBottom: '0.5rem' }}><strong>Jadwal:</strong> {selectedLemburRow.jadwalMulai} - {selectedLemburRow.jadwalSelesai}</p>
              <p style={{ margin: 0 }}><strong>Total Lembur Tercatat:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedLemburRow.lembur}</span> ({selectedLemburRow.lemburMinutes} menit)</p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Total Menit Disetujui</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="number" 
                  className="form-input" 
                  value={approveMinutesInput} 
                  onChange={e => setApproveMinutesInput(e.target.value)} 
                  max={selectedLemburRow.lemburMinutes}
                  min="0"
                />
                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>Menit</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Maksimal: {selectedLemburRow.lemburMinutes} menit</span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <button 
                className="btn" 
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }} 
                onClick={() => handleSaveLembur('Rejected')}
                disabled={savingLembur}
              >
                {savingLembur ? '...' : 'Tolak Lembur'}
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={() => handleSaveLembur('Approved')}
                disabled={savingLembur}
              >
                {savingLembur ? '...' : 'Setujui Lembur'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: '1rem', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button onClick={() => setSelectedPhoto(null)} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>
            {(() => {
              if (!selectedPhoto) return null;
              let driveId = null;
              const match = selectedPhoto.match(/id=([^&]+)/);
              if (match && match[1]) driveId = match[1];
              else {
                const match2 = selectedPhoto.match(/file\/d\/([^/]+)/);
                if (match2 && match2[1]) driveId = match2[1];
              }
              
              const srcUrl = driveId 
                ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000` 
                : selectedPhoto;
              
              return (
                <img 
                  src={srcUrl} 
                  alt="Absensi" 
                  style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '0.5rem' }} 
                  onError={(e) => {
                    // Fallback to new tab if image completely fails to load
                    e.target.style.display = 'none';
                    if (e.target.parentNode) {
                      const link = document.createElement('a');
                      link.href = selectedPhoto;
                      link.target = '_blank';
                      link.innerText = 'Buka Foto di Tab Baru';
                      link.className = 'btn btn-primary mt-4';
                      e.target.parentNode.appendChild(link);
                    }
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}
      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2><UserPlus size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Tambah Karyawan Baru</h2>
              <button className="close-btn" onClick={() => setShowAddUserModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddUser}>
              <div className="flex flex-wrap gap-4" style={{ marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label className="form-label">Status Pegawai / Dokter</label>
                  <select
                    className="form-input"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                  >
                    <option value="pegawai">Pegawai</option>
                    <option value="dokter">Dokter</option>
                    <option value="perawat">Perawat</option>
                    <option value="magang">Magang</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Nama Lengkap</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newNama}
                    onChange={e => setNewNama(e.target.value)}
                    placeholder="Nama karyawan"
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">No WA (Username)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newNowa}
                    onChange={e => setNewNowa(e.target.value)}
                    placeholder="0812..."
                    required
                  />
                </div>
                 <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className="form-input"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Password login"
                      style={{ paddingRight: '2.5rem' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4" style={{ marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label className="form-label">Akses Cabang Klinik</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {clinicLocationsList.length === 0 && <span style={{color: 'var(--text-muted)'}}>Belum ada cabang klinik yang dikonfigurasi.</span>}
                    {clinicLocationsList.map((clinic, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-secondary)', padding: '5px 10px', borderRadius: '4px' }}>
                        <input 
                          type="checkbox"
                          checked={newCabangKlinik.includes(clinic.name)}
                          onChange={e => {
                            if (e.target.checked) setNewCabangKlinik([...newCabangKlinik, clinic.name]);
                            else setNewCabangKlinik(newCabangKlinik.filter(c => c !== clinic.name));
                          }}
                        />
                        {clinic.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ flex: '1 1 100%', marginTop: '1rem', marginBottom: '1.5rem' }}>
                <p className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📅 Penjadwalan Kerja Mingguan</p>
                {renderWeeklySchedule(newJadwal, setNewJadwal, newStatus === 'dokter')}
              </div>
              
              <div className="flex flex-wrap gap-4">
                {newStatus !== 'dokter' && (
                  <div className="form-group" style={{ flex: '1 1 140px' }}>
                    <label className="form-label">Toleransi (menit)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newToleransi}
                      onChange={e => setNewToleransi(e.target.value)}
                      min="0"
                      required
                    />
                  </div>
                )}
                <div className="form-group" style={{ flex: '1 1 160px' }}>
                  <label className="form-label">Role Akun</label>
                  <select
                    className="form-input"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                  >
                    <option value="user">User Biasa</option>
                    <option value="user_bebas">User Bebas Lokasi</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {newStatus !== 'dokter' && (
                  <>
                    <div className="form-group" style={{ flex: '1 1 180px' }}>
                      <label className="form-label">Batas Awal Masuk (mnt)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newBatasAwalMasuk}
                        onChange={e => setNewBatasAwalMasuk(Number(e.target.value))}
                        placeholder="60"
                      />
                    </div>
                    <div className="form-group" style={{ flex: '1 1 180px' }}>
                      <label className="form-label">Batas Akhir Pulang (mnt)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newBatasAkhirPulang}
                        onChange={e => setNewBatasAkhirPulang(Number(e.target.value))}
                        placeholder="240"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex gap-2 mt-6">
                <button type="submit" className="btn btn-primary" disabled={addingUser} style={{ flex: 1 }}>
                  {addingUser ? <div className="spinner"></div> : <><Save size={16} /> Simpan Karyawan</>}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)} style={{ flex: 1 }}>
                  <X size={16} /> Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Absen Modal */}
      {showManualAbsenModal && (
        <div className="modal-overlay" onClick={() => setShowManualAbsenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2>📅 Input Absen Manual</h2>
              <button className="close-btn" onClick={() => setShowManualAbsenModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleManualAbsenSubmit}>
              <div className="form-group">
                <label className="form-label">Nama Karyawan</label>
                <select
                  className="form-input"
                  value={manualUser}
                  onChange={e => setManualUser(e.target.value)}
                  required
                >
                  <option value="" disabled>Pilih Karyawan</option>
                  {users.filter(u => u.role !== 'admin').map(u => (
                    <option key={u.nama} value={u.nama}>{u.nama} ({u.status})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tipe Kehadiran</label>
                <select
                  className="form-input"
                  value={manualTipe}
                  onChange={e => setManualTipe(e.target.value)}
                  required
                >
                  <option value="Masuk">Masuk</option>
                  <option value="Keluar">Keluar</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    className="form-input"
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    required
                  />
                </div>
                {(manualTipe === 'Masuk' || manualTipe === 'Keluar') && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Jam</label>
                    <input
                      type="time"
                      className="form-input"
                      value={manualTime}
                      onChange={e => setManualTime(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Keterangan / Catatan</label>
                <textarea
                  className="form-input"
                  value={manualKeterangan}
                  onChange={e => setManualKeterangan(e.target.value)}
                  placeholder="Contoh: Lupa absen, Izin sakit dengan surat, dll."
                  rows="3"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="flex gap-2 mt-6">
                <button type="submit" className="btn btn-primary" disabled={savingManual} style={{ flex: 1 }}>
                  {savingManual ? <div className="spinner"></div> : 'Simpan Absensi'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowManualAbsenModal(false)} style={{ flex: 1 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="modal-overlay" onClick={() => { setResetPasswordUser(null); setResetPasswordValue(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="close-btn" onClick={() => { setResetPasswordUser(null); setResetPasswordValue(''); }}><X size={20} /></button>
            </div>
            
             <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">Password Baru untuk {resetPasswordUser.nama}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetPassword ? "text" : "password"}
                    className="form-input"
                    value={resetPasswordValue}
                    onChange={e => setResetPasswordValue(e.target.value)}
                    placeholder="Masukkan password baru"
                    style={{ paddingRight: '2.5rem' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary" disabled={savingUser} style={{ flex: 1 }}>
                  {savingUser ? <div className="spinner"></div> : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Generic Error PopUp Modal */}
      {errorMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card text-center" style={{ width: '90%', maxWidth: '320px', padding: '2rem', animation: 'scaleIn 0.3s ease-out' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--error)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <AlertTriangle size={48} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Error</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>{errorMsg}</p>
            <button className="btn btn-primary w-full" onClick={() => setErrorMsg('')}>Tutup</button>
          </div>
        </div>
      )}

      {/* Generic Success PopUp Modal */}
      {successMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card text-center" style={{ width: '90%', maxWidth: '320px', padding: '2rem', animation: 'scaleIn 0.3s ease-out' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Berhasil</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>{successMsg}</p>
            <button className="btn btn-primary w-full" onClick={() => setSuccessMsg('')}>Tutup</button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
