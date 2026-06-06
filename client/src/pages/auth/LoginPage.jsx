import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, Mail, Lock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { loginAPI } from '../../api/auth.api';
import useAuthStore from '../../store/authStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await loginAPI(data);
      const { user, token } = res.data.data;
      setAuth(user, token);
      toast.success(`Welcome back, ${user.full_name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
    }}>
      {/* Left Panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        display: 'none',
      }} className="left-panel">
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 44, height: 44, background: 'var(--primary)',
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={22} color="#fff" />
            </div>
            <span style={{ color: '#fff', fontFamily: 'Syne', fontSize: 22, fontWeight: 700 }}>
              VendorBridge
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 48, fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
            Procurement<br />
            <span style={{ color: '#60a5fa' }}>Simplified.</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 17, lineHeight: 1.7 }}>
            Manage vendors, RFQs, quotations, and purchase orders — all in one place.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 40 }}>
            {['Vendor Management & RFQ Creation', 'Quotation Comparison Engine', 'Approval Workflows & PO Generation', 'Invoice Automation & Analytics'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, background: '#60a5fa', borderRadius: '50%', flexShrink: 0 }} />
                <span style={{ color: '#cbd5e1', fontSize: 15 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px 40px',
        margin: 'auto',
        borderRadius: 20,
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.5s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div style={{
            width: 40, height: 40, background: 'var(--primary)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={20} color="#fff" />
          </div>
          <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            VendorBridge
          </span>
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Welcome back</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
          Sign in to your procurement account
        </p>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Input
            label="Email Address"
            type="email"
            placeholder="you@company.com"
            icon={<Mail size={15} />}
            error={errors.email?.message}
            required
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            icon={<Lock size={15} />}
            error={errors.password?.message}
            required
            {...register('password')}
          />

          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} fullWidth size="lg" style={{ marginTop: 4 }}>
            <LogIn size={16} />
            Sign In
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Create one
          </Link>
        </p>

        {/* Demo credentials hint */}
        <div style={{
          marginTop: 24, padding: '12px 16px',
          background: '#f0f9ff', borderRadius: 10,
          border: '1px solid #bae6fd',
        }}>
          <p style={{ fontSize: 12, color: '#0369a1', fontWeight: 500, marginBottom: 4 }}>Demo Credentials</p>
          <p style={{ fontSize: 12, color: '#0369a1' }}>admin@vendorbridge.com / Admin@1234</p>
        </div>
      </div>
    </div>
  );
}