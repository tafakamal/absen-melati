import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, UserPlus, LogOut, ArrowLeft, Settings, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../api';

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('report');
  const [users, setUsers] = useState([]);
  const [report, setReport] = useState([]);
  const [settings, setSettings] = useState({ KLINIK_LAT: '', KLINIK_LNG: '', MAX_DISTANCE: '' });
  
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form add user
  const [newNama, setNewNama] = useState('');
  const [newNowa, setNewNowa] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newShift, setNewShift] = useState('Pagi');
  const [newStatus, setNewStatus] = useState('pegawai');
  const [addingUser, setAddingUser] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (activeTab === 'users') {
        const res = await callApi({ action: 'get_users' });
        setUsers(res.users);
      } else if (activeTab === 'report') {
        const res = await callApi({ action: 'get_report' });
        setReport(res.report);
      } else if (activeTab === 'settings') {
        const res = await callApi({ action: 'get_settings' });
        setSettings({
          KLINIK_LAT: res.settings.KLINIK_LAT || '',
          KLINIK_LNG: res.settings.KLINIK_LNG || '',
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
        shift: newShift,
        status: newStatus,
        role: 'user'
      });
      setNewNama(''); setNewNowa(''); setNewPassword('');
      setSuccessMsg('Karyawan berhasil ditambahkan!');
      fetchData(); // Refresh list
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setAddingUser(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    // Pastikan koma diganti dengan titik agar format terbaca sebagai float yang benar
    const sanitizedSettings = {
      ...settings,
      KLINIK_LAT: String(settings.KLINIK_LAT).replace(',', '.'),
      KLINIK_LNG: String(settings.KLINIK_LNG).replace(',', '.')
    };

    try {
      await callApi({
        action: 'save_settings',
        settings: sanitizedSettings
      });
      setSettings(sanitizedSettings);
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

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-gradient" style={{ marginBottom: '0.2rem' }}>Dashboard Admin</h2>
          <p className="form-label" style={{ marginBottom: 0 }}>Melati Dental Care</p>
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

      <div className="flex mb-6 flex-wrap gap-2">
        <button 
          className={`btn ${activeTab === 'report' ? 'btn-primary' : 'btn-secondary'} flex-1 justify-center`}
          onClick={() => setActiveTab('report')}
        >
          <FileText size={18} /> <span className="hidden sm:inline">Laporan</span>
        </button>
        <button 
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'} flex-1 justify-center`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} /> <span className="hidden sm:inline">Karyawan</span>
        </button>
        <button 
          className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'} flex-1 justify-center`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} /> <span className="hidden sm:inline">Pengaturan</span>
        </button>
      </div>

      {errorMsg && <div className="alert alert-error mb-4">{errorMsg}</div>}
      {successMsg && <div className="alert alert-success mb-4">{successMsg}</div>}

      <div className="card glass">
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner spinner-primary"></div></div>
        ) : activeTab === 'report' ? (
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
                {report.length === 0 ? (
                  <tr><td colSpan="5" className="text-center">Belum ada data absensi</td></tr>
                ) : (
                  report.map((item, idx) => (
                    <tr key={idx}>
                      <td>{new Date(item.timestamp).toLocaleString('id-ID')}</td>
                      <td style={{ fontWeight: '500' }}>{item.nama}</td>
                      <td>
                        <span className={`badge ${item.tipe === 'Masuk' ? 'badge-success' : 'badge-error'}`}>
                          {item.tipe}
                        </span>
                      </td>
                      <td>{item.jarak} m</td>
                      <td>
                        {item.fotoUrl ? (
                          <a href={item.fotoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--secondary)', textDecoration: 'none', fontWeight: '500' }}>Lihat Foto</a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'users' ? (
          <div>
            <div className="table-container mb-6">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>No WA</th>
                    <th>Shift</th>
                    <th>Status</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan="5" className="text-center">Belum ada data karyawan</td></tr>
                  ) : (
                    users.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: '500' }}>{item.nama}</td>
                        <td>{item.nowa}</td>
                        <td><span className="badge badge-neutral">{item.shift}</span></td>
                        <td>{item.status}</td>
                        <td>{item.role === 'admin' ? <span className="badge badge-success">Admin</span> : 'User'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="mb-4" style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>Tambah Karyawan Baru</h3>
            <form onSubmit={handleAddUser}>
              <div className="flex flex-wrap gap-4">
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Nama</label>
                  <input type="text" className="form-input" value={newNama} onChange={e=>setNewNama(e.target.value)} required />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">No WA (Username)</label>
                  <input type="text" className="form-input" value={newNowa} onChange={e=>setNewNowa(e.target.value)} placeholder="0812..." required />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Password</label>
                  <input type="text" className="form-input" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Shift</label>
                  <select className="form-input" value={newShift} onChange={e=>setNewShift(e.target.value)}>
                    <option value="Pagi">Pagi</option>
                    <option value="Sore">Sore</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={newStatus} onChange={e=>setNewStatus(e.target.value)}>
                    <option value="pegawai">Pegawai</option>
                    <option value="perawat">Perawat</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-4" disabled={addingUser}>
                {addingUser ? <div className="spinner"></div> : <><UserPlus size={18} /> Tambah Karyawan</>}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h3 className="mb-2">Pengaturan Titik Absensi</h3>
            <p className="form-label mb-6">Tentukan koordinat pusat klinik. Karyawan hanya bisa absen jika berada dalam radius jarak yang ditentukan dari titik ini.</p>
            
            <form onSubmit={handleSaveSettings}>
              <div className="flex flex-col gap-4 max-w-md">
                <div className="form-group mb-0">
                  <label className="form-label">Latitude (Garis Lintang)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={settings.KLINIK_LAT} 
                    onChange={e => setSettings({...settings, KLINIK_LAT: e.target.value})} 
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
                    onChange={e => setSettings({...settings, KLINIK_LNG: e.target.value})} 
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
                    onChange={e => setSettings({...settings, MAX_DISTANCE: e.target.value})} 
                    placeholder="Contoh: 100"
                    required 
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                  {savingSettings ? <div className="spinner"></div> : <><Save size={18} /> Simpan Pengaturan</>}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
