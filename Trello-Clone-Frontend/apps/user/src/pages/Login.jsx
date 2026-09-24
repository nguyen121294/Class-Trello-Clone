import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth, useToast, Button, Input, space } from '@trello/ui';
import { AuthShell } from '../components/AuthShell';

export function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const validate = () => {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) e.email = 'Vui lòng nhập email hoặc định danh tài khoản (VD: admin@achau hoặc you@example.com).';
    if (!password) e.password = 'Vui lòng nhập mật khẩu.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await login(email.trim(), password);
      const to = location.state?.from?.pathname ?? '/';
      navigate(to, { replace: true });
    } catch {
      toast.error('Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Đăng nhập hệ thống"
      subtitle="Quản trị Dự án & Phân quyền Doanh nghiệp B2B."
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
          <div>
            Chưa có tài khoản cá nhân?{' '}
            <Link to="/register" style={{ color: '#fff', fontWeight: 600 }}>
              Đăng ký
            </Link>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 10 }}>
            🏢 Bạn là Doanh nghiệp mới?{' '}
            <Link to="/register-org" style={{ color: '#93c5fd', fontWeight: 700, textDecoration: 'underline' }}>
              Đăng ký Tổ chức (Nhận quyền Super-Admin)
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        <Input
          label="Tài khoản / Email"
          placeholder="admin@achau hoặc you@example.com"
          autoComplete="username"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Mật khẩu"
          type="password"
          placeholder="Nhập mật khẩu của bạn"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="lg" loading={busy} fullWidth>
          Đăng nhập
        </Button>
        <Link to="/forgot-password" style={{ color: '#fff', fontSize: 13, textAlign: 'center', opacity: 0.9 }}>
          Quên mật khẩu?
        </Link>
      </form>
    </AuthShell>
  );
}
