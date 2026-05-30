import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileText, UserPlus, LogOut, ArrowLeft, Settings, Save,
  Clock, Calendar, Filter, Edit3, X, ChevronDown, BarChart3,
  AlertTriangle, CheckCircle, Timer, MapPin, Upload
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

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('report');

  // Data
  const [users, setUsers] = useState([]);
  const [report, setReport] = useState([]);
  const [settings, setSettings] = useState({ KLINIK_LAT: '', KLINIK_LNG: '', MAX_DISTANCE: '', KLINIK_LOGO: '' });
  const [logoBase64, setLogoBase64] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterUser, setFilterUser] = useState('Semua');

  // Add user form
  const [newNama, setNewNama] = useState('');
  const [newNowa, setNewNowa] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newJamMulai, setNewJamMulai] = useState('17:00');
  const [newJamSelesai, setNewJamSelesai] = useState('20:30');
  const [newJamMulaiSabtu, setNewJamMulaiSabtu] = useState('10:00');
  const [newJamSelesaiSabtu, setNewJamSelesaiSabtu] = useState('17:00');
  const [newToleransi, setNewToleransi] = useState(15);
  const [newStatus, setNewStatus] = useState('pegawai');
  const [newRole, setNewRole] = useState('user');
  const [newBatasAwalMasuk, setNewBatasAwalMasuk] = useState(60);
  const [newBatasAkhirPulang, setNewBatasAkhirPulang] = useState(240);
  const [addingUser, setAddingUser] = useState(false);

  // Edit user modal
  const [editingUser, setEditingUser] = useState(null);
  const [editJamMulai, setEditJamMulai] = useState('');
  const [editJamSelesai, setEditJamSelesai] = useState('');
  const [editJamMulaiSabtu, setEditJamMulaiSabtu] = useState('');
  const [editJamSelesaiSabtu, setEditJamSelesaiSabtu] = useState('');
  const [editToleransi, setEditToleransi] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editBatasAwalMasuk, setEditBatasAwalMasuk] = useState(60);
  const [editBatasAkhirPulang, setEditBatasAkhirPulang] = useState(240);
  const [savingUser, setSavingUser] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (activeTab === 'report' || activeTab === 'recap') {
        const [reportRes, usersRes] = await Promise.all([
          callApi({ action: 'get_report' }),
          callApi({ action: 'get_users' })
        ]);
        setReport(reportRes.report);
        setUsers(usersRes.users);
      } else if (activeTab === 'users') {
        const res = await callApi({ action: 'get_users' });
        setUsers(res.users);
      } else if (activeTab === 'settings') {
        const res = await callApi({ action: 'get_settings' });
        setSettings({
          KLINIK_LAT: String(res.settings.KLINIK_LAT || '').replace('_', ''),
          KLINIK_LNG: String(res.settings.KLINIK_LNG || '').replace('_', ''),
          MAX_DISTANCE: res.settings.MAX_DISTANCE || '100'
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
      const key = `${item.nama}|${dateToKey(d)}`;
      if (!groups[key]) {
        groups[key] = { nama: item.nama, date: d, masuk: null, keluar: null };
      }
      if (item.tipe === 'Masuk') {
        // Keep earliest masuk
        if (!groups[key].masuk || new Date(item.timestamp) < new Date(groups[key].masuk)) {
          groups[key].masuk = item.timestamp;
        }
      }
      if (item.tipe === 'Keluar') {
        // Keep latest keluar
        if (!groups[key].keluar || new Date(item.timestamp) > new Date(groups[key].keluar)) {
          groups[key].keluar = item.timestamp;
        }
      }
    });

    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const rows = [];
    Object.values(groups).forEach(g => {
      const userInfo = userMap[g.nama] || {};
      const dayOfWeek = g.date.getDay(); // 0=Minggu, 6=Sabtu
      const isSabtu = dayOfWeek === 6;
      const isMinggu = dayOfWeek === 0;

      // Pilih jadwal sesuai hari
      const jamMulai = isSabtu
        ? parseTime(userInfo.jamMulaiSabtu || '10:00')
        : parseTime(userInfo.jamMulai || '17:00');
      const jamSelesai = isSabtu
        ? parseTime(userInfo.jamSelesaiSabtu || '17:00')
        : parseTime(userInfo.jamSelesai || '20:30');
      const toleransi = parseInt(userInfo.toleransi) || 0;

      const row = {
        nama: g.nama,
        tanggal: g.date,
        hari: HARI[dayOfWeek],
        isMinggu,
        jamMasuk: g.masuk ? new Date(g.masuk) : null,
        jamKeluar: g.keluar ? new Date(g.keluar) : null,
        jadwalMulai: isMinggu ? '-' : (isSabtu ? formatJamKerja(userInfo.jamMulaiSabtu, '10:00') : formatJamKerja(userInfo.jamMulai, '17:00')),
        jadwalSelesai: isMinggu ? '-' : (isSabtu ? formatJamKerja(userInfo.jamSelesaiSabtu, '17:00') : formatJamKerja(userInfo.jamSelesai, '20:30')),
        durasi: null,
        durasiMinutes: 0,
        status: isMinggu ? 'Hari Libur' : '-',
        lembur: null,
        lemburMinutes: 0,
        pulangCepat: null,
        pulangCepatMinutes: 0,
        terlambat: false
      };

      if (row.jamMasuk && row.jamKeluar) {
        const diffMs = row.jamKeluar - row.jamMasuk;
        const durasiMinutes = Math.floor(diffMs / 60000);
        row.durasiMinutes = durasiMinutes;
        row.durasi = formatDuration(durasiMinutes);

        if (!isMinggu) {
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
            if (keluarMinutes > jamSelesai.totalMinutes) {
              const lemburMenit = keluarMinutes - jamSelesai.totalMinutes;
              row.lemburMinutes = lemburMenit;
              row.lembur = formatDuration(lemburMenit);
            } else if (keluarMinutes < jamSelesai.totalMinutes) {
              const cepatMenit = jamSelesai.totalMinutes - keluarMinutes;
              row.pulangCepatMinutes = cepatMenit;
              row.pulangCepat = formatDuration(cepatMenit);
            }
          }
        }
      } else if (row.jamMasuk && !row.jamKeluar) {
        row.status = isMinggu ? 'Hari Libur' : 'Belum Pulang';
      }

      rows.push(row);
    });

    // Sort by date desc, then nama
    rows.sort((a, b) => b.tanggal - a.tanggal || a.nama.localeCompare(b.nama));
    return rows;
  }, [report, users, filterMonth, filterYear, filterUser]);

  // ─── Recap Stats ───────────────────────────────────────────
  const recapStats = useMemo(() => {
    const totalHariKerja = recapData.length;
    const totalJamKerja = recapData.reduce((sum, r) => sum + r.durasiMinutes, 0);
    const totalLembur = recapData.reduce((sum, r) => sum + r.lemburMinutes, 0);
    const hariTerlambat = recapData.filter(r => r.terlambat).length;
    return {
      totalHariKerja,
      totalJamKerja: formatDuration(totalJamKerja),
      totalLembur: formatDuration(totalLembur),
      hariTerlambat
    };
  }, [recapData]);

  // ─── Employee names for filter ─────────────────────────────
  const employeeNames = useMemo(() => {
    return users.filter(u => u.role !== 'admin').map(u => u.nama);
  }, [users]);

  // ─── Year options ──────────────────────────────────────────
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1];
  }, []);

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
        jamMulai: newJamMulai,
        jamSelesai: newJamSelesai,
        jamMulaiSabtu: newJamMulaiSabtu,
        jamSelesaiSabtu: newJamSelesaiSabtu,
        toleransi: newToleransi,
        status: newStatus,
        role: newRole,
        batasAwalMasuk: newBatasAwalMasuk,
        batasAkhirPulang: newBatasAkhirPulang
      });
      setNewNama('');
      setNewNowa('');
      setNewPassword('');
      setNewJamMulai('17:00');
      setNewJamSelesai('20:30');
      setNewJamMulaiSabtu('10:00');
      setNewJamSelesaiSabtu('17:00');
      setNewToleransi(15);
      setNewStatus('pegawai');
      setNewRole('user');
      setNewBatasAwalMasuk(60);
      setNewBatasAkhirPulang(240);
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
    setEditJamMulai(formatJamKerja(u.jamMulai, '17:00'));
    setEditJamSelesai(formatJamKerja(u.jamSelesai, '20:30'));
    setEditJamMulaiSabtu(formatJamKerja(u.jamMulaiSabtu, '10:00'));
    setEditJamSelesaiSabtu(formatJamKerja(u.jamSelesaiSabtu, '17:00'));
    setEditToleransi(u.toleransi || 15);
    setEditStatus(u.status || 'pegawai');
    setEditRole(u.role || 'user');
    setEditBatasAwalMasuk(u.batasAwalMasuk !== undefined ? u.batasAwalMasuk : 60);
    setEditBatasAkhirPulang(u.batasAkhirPulang !== undefined ? u.batasAkhirPulang : 240);
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
        jamMulai: editJamMulai,
        jamSelesai: editJamSelesai,
        jamMulaiSabtu: editJamMulaiSabtu,
        jamSelesaiSabtu: editJamSelesaiSabtu,
        toleransi: editToleransi,
        status: editStatus,
        role: editRole,
        batasAwalMasuk: editBatasAwalMasuk,
        batasAkhirPulang: editBatasAkhirPulang
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

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg('');
    setSuccessMsg('');
    const sanitizedSettings = {
      ...settings,
      KLINIK_LAT: '_' + String(settings.KLINIK_LAT).replace(',', '.'),
      KLINIK_LNG: '_' + String(settings.KLINIK_LNG).replace(',', '.')
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ─── Filter Bar Component ─────────────────────────────────
  const renderFilterBar = () => (
    <div className="filter-bar">
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
                      <span className={`badge ${item.tipe === 'Masuk' ? 'badge-success' : 'badge-error'}`}>
                        {item.tipe}
                      </span>
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
                        <a
                          href={item.fotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--secondary)', textDecoration: 'none', fontWeight: '500' }}
                        >
                          Lihat Foto
                        </a>
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

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
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
                      <span className="badge badge-info">{row.lembur}</span>
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
  const renderUsers = () => (
    <div>
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
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center" style={{ padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  Belum ada data karyawan
                </td>
              </tr>
            ) : (
              users.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: '500' }}>{item.nama}</td>
                  <td>{item.nowa}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        Sen-Jum: {formatJamKerja(item.jamMulai, '17:00')} - {formatJamKerja(item.jamSelesai, '20:30')}
                      </span>
                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                        Sabtu: {formatJamKerja(item.jamMulaiSabtu, '10:00')} - {formatJamKerja(item.jamSelesaiSabtu, '17:00')}
                      </span>
                    </div>
                  </td>
                  <td>{item.toleransi || 15} menit</td>
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
                      <button className="edit-btn" onClick={() => openEditModal(item)}>
                        <Edit3 size={13} /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-4" style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <UserPlus size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
        Tambah Karyawan Baru
      </h3>
      <form onSubmit={handleAddUser}>
        <div className="flex flex-wrap gap-4">
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
            <input
              type="text"
              className="form-input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Password login"
              required
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label className="form-label">Jam Mulai (Sen-Jum)</label>
            <input
              type="time"
              className="form-input"
              value={newJamMulai}
              onChange={e => setNewJamMulai(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label className="form-label">Jam Selesai (Sen-Jum)</label>
            <input
              type="time"
              className="form-input"
              value={newJamSelesai}
              onChange={e => setNewJamSelesai(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label className="form-label">Jam Mulai (Sabtu)</label>
            <input
              type="time"
              className="form-input"
              value={newJamMulaiSabtu}
              onChange={e => setNewJamMulaiSabtu(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label className="form-label">Jam Selesai (Sabtu)</label>
            <input
              type="time"
              className="form-input"
              value={newJamSelesaiSabtu}
              onChange={e => setNewJamSelesaiSabtu(e.target.value)}
              required
            />
          </div>
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
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
            >
              <option value="pegawai">Pegawai</option>
              <option value="magang">Magang</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>
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
        </div>
        <button type="submit" className="btn btn-primary mt-4" disabled={addingUser}>
          {addingUser ? (
            <div className="spinner"></div>
          ) : (
            <><UserPlus size={18} /> Tambah Karyawan</>
          )}
        </button>
      </form>
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
          <div className="form-group mb-0">
            <label className="form-label">Latitude (Garis Lintang)</label>
            <input
              type="text"
              className="form-input"
              value={settings.KLINIK_LAT}
              onChange={e => setSettings({ ...settings, KLINIK_LAT: e.target.value })}
              placeholder="Contoh: 3.5776976"
              required
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Longitude (Garis Bujur)</label>
            <input
              type="text"
              className="form-input"
              value={settings.KLINIK_LNG}
              onChange={e => setSettings({ ...settings, KLINIK_LNG: e.target.value })}
              placeholder="Contoh: 98.679542"
              required
            />
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

          <button type="submit" className="btn btn-primary mt-2" disabled={savingSettings}>
            {savingSettings ? <div className="spinner spinner-sm"></div> : <Save size={18} />}
            Simpan Pengaturan
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

      {/* Alerts */}
      {errorMsg && <div className="alert alert-error"><AlertTriangle size={18} /> {errorMsg}</div>}
      {successMsg && <div className="alert alert-success"><CheckCircle size={18} /> {successMsg}</div>}

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
              <p className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📅 Jadwal Senin - Jumat</p>
              <div className="flex gap-4" style={{ marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Jam Mulai</label>
                  <input
                    type="time"
                    className="form-input"
                    value={editJamMulai}
                    onChange={e => setEditJamMulai(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Jam Selesai</label>
                  <input
                    type="time"
                    className="form-input"
                    value={editJamSelesai}
                    onChange={e => setEditJamSelesai(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📅 Jadwal Sabtu</p>
              <div className="flex gap-4" style={{ marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Jam Mulai</label>
                  <input
                    type="time"
                    className="form-input"
                    value={editJamMulaiSabtu}
                    onChange={e => setEditJamMulaiSabtu(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Jam Selesai</label>
                  <input
                    type="time"
                    className="form-input"
                    value={editJamSelesaiSabtu}
                    onChange={e => setEditJamSelesaiSabtu(e.target.value)}
                    required
                  />
                </div>
              </div>
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
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                >
                  <option value="pegawai">Pegawai</option>
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
      </div>
    </>
  );
}
