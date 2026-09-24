import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth, useToast, Button, Input, space, color, radius } from '@trello/ui';
import { CheckCircle2, AlertCircle, Building2, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

// Chuyển tiếng Việt có dấu sang slug không dấu
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function RegisterOrg() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [codeCustomized, setCodeCustomized] = useState(false);
  const [codeStatus, setCodeStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [name, setName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const checkTimer = useRef(null);

  if (user) return <Navigate to="/" replace />;

  // Tự động sinh mã công ty từ tên công ty nếu người dùng chưa tự tay sửa
  useEffect(() => {
    if (!codeCustomized && orgName.trim()) {
      const generated = slugify(orgName);
      setOrgCode(generated);
    }
  }, [orgName, codeCustomized]);

  // Debounce kiểm tra mã công ty khả dụng
  useEffect(() => {
    const clean = orgCode.trim().toLowerCase();
    if (!clean || clean.length < 2) {
      setCodeStatus(null);
      return;
    }
    setCodeStatus('checking');
    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/auth/check-org-code', { params: { code: clean } });
        setCodeStatus(res.data.available ? 'available' : 'taken');
      } catch {
        setCodeStatus(null);
      }
    }, 400);

    return () => clearTimeout(checkTimer.current);
  }, [orgCode]);

  const validate = () => {
    const e = {};
    if (!orgName.trim() || orgName.trim().length < 2) e.orgName = 'Vui lòng nhập tên công ty (tối thiểu 2 ký tự).';
    if (!orgCode.trim() || !/^[a-z0-9-]+$/.test(orgCode.trim())) {
      e.orgCode = 'Mã công ty chỉ gồm chữ thường không dấu, số và dấu gạch ngang (VD: achau, smartlog).';
    } else if (codeStatus === 'taken') {
      e.orgCode = 'Mã công ty này đã có người đăng ký, vui lòng chọn mã khác.';
    }
    if (!name.trim()) e.name = 'Vui lòng nhập họ tên người quản trị.';
    if (!username.trim() || !/^[a-z0-9_.-]+$/.test(username.trim())) {
      e.username = 'Username chỉ gồm chữ thường, số, dấu chấm hoặc gạch dưới (VD: admin).';
    }
    if (password.length < 8) e.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const cleanCode = orgCode.trim().toLowerCase();
    const cleanUser = username.trim().toLowerCase();
    const upn = `${cleanUser}@${cleanCode}`;

    try {
      await api.post('/auth/register-org', {
        orgName: orgName.trim(),
        orgCode: cleanCode,
        name: name.trim(),
        username: cleanUser,
        password,
      });

      // Tự động đăng nhập với UPN vừa tạo
      await login(upn, password);
      toast.success(`Đăng ký Doanh nghiệp thành công! Chào mừng Super Admin ${cleanUser}.`);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể đăng ký. Mã công ty hoặc tài khoản có thể đã tồn tại.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const currentUpn = `${username.trim() || 'admin'}@${orgCode.trim() || 'ma-cong-ty'}`;

  return (
    <AuthShell
      title="Đăng ký Doanh nghiệp mới"
      subtitle="Khởi tạo tổ chức B2B SaaS với tài khoản Super-Admin độc lập."
      footer={
        <div style={{ textAlign: 'center' }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ color: '#fff', fontWeight: 600 }}>
            Đăng nhập ngay
          </Link>
        </div>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        <Input
          label="Tên Doanh nghiệp / Tổ chức"
          placeholder="Ví dụ: Logistics Á Châu"
          value={orgName}
          error={errors.orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />

        <div>
          <Input
            label="Mã định danh công ty (Company Code)"
            placeholder="Ví dụ: achau"
            value={orgCode}
            error={errors.orgCode}
            onChange={(e) => {
              setCodeCustomized(true);
              setOrgCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
            }}
          />
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            {codeStatus === 'checking' && (
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Đang kiểm tra tính khả dụng...</span>
            )}
            {codeStatus === 'available' && (
              <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Mã công ty hợp lệ và sẵn sàng sử dụng
              </span>
            )}
            {codeStatus === 'taken' && (
              <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <AlertCircle size={13} /> Mã này đã có công ty khác đăng ký!
              </span>
            )}
          </div>
        </div>

        <Input
          label="Họ tên Quản trị viên (Super Admin)"
          placeholder="Ví dụ: Nguyễn Văn A"
          value={name}
          error={errors.name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="Tên đăng nhập Admin"
          placeholder="admin"
          value={username}
          error={errors.username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
        />

        {/* Live Preview Box */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: radius.large,
          padding: '12px 14px',
          color: '#fff',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
            Xem trước tài khoản quản trị:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#60a5fa' }}>
              {currentUpn}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, background: '#16a34a', color: '#fff',
              padding: '2px 8px', borderRadius: 999,
            }}>
              <ShieldCheck size={12} /> Super Admin
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '6px 0 0' }}>
            Mọi nhân viên của công ty bạn sẽ có đuôi <code style={{ color: '#93c5fd' }}>@{orgCode || 'ma-cong-ty'}</code>, tránh 100% trùng lặp với công ty khác!
          </p>
        </div>

        <Input
          label="Mật khẩu khởi tạo"
          type="password"
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" size="lg" loading={busy} fullWidth>
          Khởi tạo Doanh nghiệp & Bắt đầu
        </Button>
      </form>
    </AuthShell>
  );
}
