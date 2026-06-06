import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Zap, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { forgotPasswordAPI } from '../../api/auth.api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Enter your email');
    setLoading(true);
    try {
      await forgotPasswordAPI(email);
      setSent(true);
      toast.success('Reset link sent to your email');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      padding: '40px 20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#fff', borderRadius: 20,
        padding: '48px 40px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.5s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700 }}>VendorBridge</span>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Mail size={28} color="#065f46" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Check your inbox</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
              We sent a password reset link to <strong>{email}</strong>
            </p>
            <Link to="/login">
              <Button variant="secondary" fullWidth>
                <ArrowLeft size={15} /> Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Forgot password?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
              Enter your email and we'll send you a reset link
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Input
                label="Email Address"
                type="email"
                placeholder="you@company.com"
                icon={<Mail size={15} />}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                Send Reset Link
              </Button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Link to="/login" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}