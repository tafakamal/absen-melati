import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../api';

export default function Login() {
  const [nowa, setNowa] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
    <div className="flex items-center justify-center w-full" style={{ minHeight: '80vh' }}>
      <div className="card glass" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center mb-4">
          <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Melati Dental Care</h2>
          <p className="form-label">Sistem Absensi Karyawan</p>
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
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
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
    </div>
  );
}
