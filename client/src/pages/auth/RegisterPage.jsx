import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Mail, Lock, User, Zap, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { registerAPI } from '../../api/auth.api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Must include uppercase, lowercase, number and special character'),
  role: z.enum(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR', 'MANAGER'], {
    required_error: 'Please select a role',
  }),
});

const ROLES = [
  { value: 'PROCUREMENT_OFFICER', label: 'Procurement Officer' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'MANAGER', label: 'Manager / Approver' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerAPI(data);
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
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
        width: '100%', maxWidth: 520,
        background: '#fff', borderRadius: 20,
        padding: '48px 40px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.5s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, background: 'var(--primary)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={20} color="#fff" />
          </div>
          <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700 }}>VendorBridge</span>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Create your account</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
          Join VendorBridge to manage procurement
        </p>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Full Name"
            placeholder="John Doe"
            icon={<User size={15} />}
            error={errors.full_name?.message}
            required
            {...register('full_name')}
          />
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
            placeholder="Min 8 chars, uppercase, number, special"
            icon={<Lock size={15} />}
            error={errors.password?.message}
            hint="Must include uppercase, lowercase, number and special character"
            required
            {...register('password')}
          />

          {/* Role Select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Role <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={15} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-secondary)',
              }} />
              <select
                {...register('role')}
                style={{
                  width: '100%', padding: '11px 14px 11px 38px',
                  border: `1.5px solid ${errors.role ? 'var(--danger)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', fontSize: 14,
                  background: '#fff', color: 'var(--text-primary)',
                  outline: 'none', cursor: 'pointer', appearance: 'none',
                }}
              >
                <option value="">Select your role</option>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {errors.role && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.role.message}</span>}
          </div>

          <Button type="submit" loading={loading} fullWidth size="lg" style={{ marginTop: 8 }}>
            <UserPlus size={16} />
            Create Account
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}