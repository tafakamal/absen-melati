import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../api';

export default function Login() {
  const [nowa, setNowa] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [logo, setLogo] = useState(null);
  const [appTitle, setAppTitle] = useState('Melati Dental Care');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Fetch settings to get the logo
    callApi({ action: 'get_settings' })
      .then(res => {
        if (res.settings) {
          if (res.settings.KLINIK_LOGO) setLogo(res.settings.KLINIK_LOGO);
          if (res.settings.APP_TITLE) setAppTitle(res.settings.APP_TITLE);
        }
      })
      .catch(console.error);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await callApi({
        action: 'login',
        nowa,
        password
      });

      login(result.user);
      
      // Request fullscreen programmatically on user interaction
      try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      } catch (f) {
        // ignore fullscreen blocker
      }
      
      if (result.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card glass login-card">
        <div className="login-brand">
          <img 
            src={logo ? (logo.includes('/d/') ? `https://drive.google.com/thumbnail?id=${logo.split('/d/')[1].split('/')[0]}&sz=w400` : logo) : (import.meta.env.BASE_URL + 'logo2.png')} 
            alt="Klinik Logo" 
            style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '1rem', borderRadius: '12px' }} 
          />
          <h2>{appTitle}</h2>
          <p className="login-tagline">Sistem Absensi Karyawan</p>
          <p className="login-time">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' • '}
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nomor WhatsApp</label>
            <input 
              type="text" 
              className="form-input" 
              value={nowa}
              onChange={(e) => setNowa(e.target.value)}
              placeholder="08123456789"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingRight: '2.5rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full justify-center"
            disabled={isLoading}
          >
            {isLoading ? <div className="spinner"></div> : (
              <>
                <LogIn size={20} />
                Masuk
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Copyright */}
      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', zIndex: 1, position: 'relative' }}>
        &copy; {new Date().getFullYear()} <a href="https://wa.me/6285360787962" target="_blank" rel="noreferrer" style={{ color: '#10b981', fontWeight: '600', textDecoration: 'none' }}>@thafa_kamal</a>
      </div>
    </div>
  );
}
