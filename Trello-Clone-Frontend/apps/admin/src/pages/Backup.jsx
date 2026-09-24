import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Input, EmptyState, useToast, color, space, font, radius, shadow,
} from '@trello/ui';
import {
  KeyRound, CalendarClock, History, BookOpen, CheckCircle2, XCircle, Loader2,
  AlertTriangle, Trash2, Database, FileCog, Plug, Clock, ChevronDown, PlayCircle,
  FolderArchive, Terminal, Copy, Check, Eye, EyeOff, ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { FormSkeleton } from '../components/PageSkeleton';

/* ----------------------------------------------------------------- helpers */

const pad = (n) => String(n).padStart(2, '0');
const DOW = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function parseCron(expr) {
  const p = (expr || '').trim().split(/\s+/);
  if (p.length !== 5) return { mode: 'custom', raw: expr, hour: 2, minute: 0, everyN: 6, dow: 1, dom: 1 };
  const [min, hour, dom, , dowF] = p;
  const m = Number(min) || 0;
  if (/^\*\/\d+$/.test(hour) && dom === '*' && dowF === '*') {
    return { mode: 'hourly', everyN: Number(hour.slice(2)) || 1, minute: m, hour: 2, dow: 1, dom: 1, raw: expr };
  }
  const h = Number(hour) || 0;
  if (dowF !== '*') return { mode: 'weekly', hour: h, minute: m, dow: Number(dowF) || 0, dom: 1, everyN: 6, raw: expr };
  if (dom !== '*') return { mode: 'monthly', hour: h, minute: m, dom: Number(dom) || 1, dow: 1, everyN: 6, raw: expr };
  if (/^\d+$/.test(hour)) return { mode: 'daily', hour: h, minute: m, dow: 1, dom: 1, everyN: 6, raw: expr };
  return { mode: 'custom', raw: expr, hour: 2, minute: 0, everyN: 6, dow: 1, dom: 1 };
}

function buildCron(s) {
  if (s.mode === 'custom') return s.raw || '0 2 * * *';
  if (s.mode === 'hourly') return `${s.minute} */${s.everyN} * * *`;
  if (s.mode === 'weekly') return `${s.minute} ${s.hour} * * ${s.dow}`;
  if (s.mode === 'monthly') return `${s.minute} ${s.hour} ${s.dom} * *`;
  return `${s.minute} ${s.hour} * * *`;
}

function describeCron(s) {
  const t = `${pad(s.hour)}:${pad(s.minute)}`;
  if (s.mode === 'hourly') return `Mỗi ${s.everyN} tiếng`;
  if (s.mode === 'weekly') return `Hằng tuần ${DOW[s.dow]} lúc ${t}`;
  if (s.mode === 'monthly') return `Hằng tháng ngày ${s.dom} lúc ${t}`;
  if (s.mode === 'custom') return s.raw || '—';
  return `Hằng ngày lúc ${t}`;
}

const fmtSize = (b) => {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
};

const fmtDate = (s) => (s ? new Date(s).toLocaleString('vi-VN', {
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
}) : '—');

const dur = (a, b) => {
  if (!a || !b) return '';
  const sec = Math.max(0, Math.round((new Date(b) - new Date(a)) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m${pad(sec % 60)}s`;
};

const maskEmail = (email, masked) => {
  if (!email || !masked) return email || '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const visible = name.slice(0, Math.min(6, Math.max(2, Math.floor(name.length / 2))));
  return `${visible}***@${domain}`;
};

const STATUS = {
  success: { Icon: CheckCircle2, c: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', t: 'Thành công' },
  failed: { Icon: XCircle, c: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', t: 'Thất bại' },
  running: { Icon: Loader2, c: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', t: 'Đang chạy', spin: true },
  pending: { Icon: Loader2, c: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', t: 'Chờ', spin: true },
};

/* ------------------------------------------------------------- sub components */

function Tabs({ tab, setTab, historyCount }) {
  const items = [
    { id: 'connect', label: 'Kết nối', Icon: Plug },
    { id: 'config', label: 'Cấu hình', Icon: CalendarClock },
    { id: 'history', label: 'Lịch sử', Icon: History, badge: historyCount },
    { id: 'guide', label: 'Hướng dẫn', Icon: BookOpen },
  ];
  return (
    <div style={{
      display: 'inline-flex',
      gap: 6,
      background: 'rgba(15, 23, 42, 0.65)',
      padding: '5px 6px',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      marginBottom: space.lg,
      flexWrap: 'wrap',
    }}>
      {items.map((it) => {
        const on = tab === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setTab(it.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              border: on ? '1px solid rgba(34, 197, 94, 0.45)' : '1px solid transparent',
              borderRadius: '7px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              background: on ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
              color: on ? '#22c55e' : 'rgba(255, 255, 255, 0.7)',
              transition: 'all .14s ease-in-out',
            }}
          >
            <it.Icon size={16} color={on ? '#22c55e' : 'currentColor'} />
            {it.label}
            {it.badge !== undefined && it.badge !== null ? (
              <span style={{
                marginLeft: 2,
                fontSize: 11,
                fontWeight: 700,
                background: on ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                color: on ? '#4ade80' : 'rgba(255, 255, 255, 0.8)',
                borderRadius: '999px',
                padding: '1px 7px',
              }}>
                {it.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, dotColor, Icon, children }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 210,
      background: 'rgba(15, 23, 42, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.09)',
      borderRadius: '12px',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: dotColor || '#94a3b8',
        marginBottom: 8,
      }}>
        {dotColor ? (
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            display: 'inline-block',
            boxShadow: `0 0 6px ${dotColor}`,
          }} />
        ) : Icon ? (
          <Icon size={13} />
        ) : null}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ScopeRow({ Icon, title, hint, on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 16px',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all .14s ease-in-out',
        border: `1px solid ${on ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
        background: on ? 'rgba(34, 197, 94, 0.05)' : 'rgba(15, 23, 42, 0.45)',
        boxSizing: 'border-box',
      }}
    >
      {/* Checkbox circle */}
      <span style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1.5px solid ${on ? '#22c55e' : 'rgba(255, 255, 255, 0.2)'}`,
        background: on ? '#22c55e' : 'transparent',
        color: '#ffffff',
        transition: 'all .14s',
      }}>
        {on ? <Check size={12} strokeWidth={3} /> : null}
      </span>

      {/* Icon */}
      <span style={{
        width: 32,
        height: 32,
        borderRadius: '8px',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: on ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
        color: on ? '#4ade80' : 'rgba(255, 255, 255, 0.6)',
      }}>
        <Icon size={17} />
      </span>

      {/* Text */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
          {title}
        </span>
        <span style={{
          display: 'block',
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: font.mono,
          marginTop: 2,
        }}>
          {hint}
        </span>
      </span>
    </div>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '9px 10px',
        border: active ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '7px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        transition: 'all .12s',
        background: active ? '#3b82f6' : 'rgba(15, 23, 42, 0.5)',
        color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function SchedulePicker({ sched, setSched }) {
  const upd = (patch) => setSched((s) => ({ ...s, ...patch }));
  const timeVal = `${pad(sched.hour)}:${pad(sched.minute)}`;
  const onTime = (e) => {
    const [h, m] = (e.target.value || '00:00').split(':').map(Number);
    upd({ hour: h || 0, minute: m || 0 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 5 mode buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <ModeBtn active={sched.mode === 'hourly'} onClick={() => upd({ mode: 'hourly' })}>Mỗi N tiếng</ModeBtn>
        <ModeBtn active={sched.mode === 'daily'} onClick={() => upd({ mode: 'daily' })}>Hằng ngày</ModeBtn>
        <ModeBtn active={sched.mode === 'weekly'} onClick={() => upd({ mode: 'weekly' })}>Hằng tuần</ModeBtn>
        <ModeBtn active={sched.mode === 'monthly'} onClick={() => upd({ mode: 'monthly' })}>Hằng tháng</ModeBtn>
        <ModeBtn active={sched.mode === 'custom'} onClick={() => upd({ mode: 'custom' })}>Tự gõ</ModeBtn>
      </div>

      {/* Input area */}
      <div>
        {sched.mode === 'hourly' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
              MỖI MẤY TIẾNG
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={sched.everyN}
              onChange={(e) => upd({ everyN: Number(e.target.value) || 1 })}
              style={inputFieldStyle}
            />
          </div>
        )}

        {sched.mode === 'weekly' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                THỨ
              </label>
              <select value={sched.dow} onChange={(e) => upd({ dow: Number(e.target.value) })} style={inputFieldStyle}>
                {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                GIỜ
              </label>
              <input type="time" value={timeVal} onChange={onTime} style={inputFieldStyle} />
            </div>
          </div>
        )}

        {sched.mode === 'monthly' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                NGÀY TRONG THÁNG
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={sched.dom}
                onChange={(e) => upd({ dom: Number(e.target.value) || 1 })}
                style={inputFieldStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                GIỜ
              </label>
              <input type="time" value={timeVal} onChange={onTime} style={inputFieldStyle} />
            </div>
          </div>
        )}

        {sched.mode === 'custom' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
              CRON EXPRESSION
            </label>
            <input
              type="text"
              value={sched.raw ?? ''}
              onChange={(e) => upd({ raw: e.target.value })}
              placeholder="0 2 * * *"
              style={inputFieldStyle}
            />
          </div>
        )}

        {sched.mode === 'daily' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
              GIỜ
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="time"
                value={timeVal}
                onChange={onTime}
                style={{ ...inputFieldStyle, paddingRight: 36 }}
              />
              <Clock
                size={16}
                color="rgba(255, 255, 255, 0.4)"
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Blue preview box */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '11px 16px',
        background: 'rgba(30, 58, 138, 0.28)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: '8px',
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#60a5fa' }}>
          → {describeCron(sched)}
        </span>
        <code style={{
          fontSize: 13,
          color: '#93c5fd',
          fontFamily: font.mono,
          letterSpacing: '0.08em',
        }}>
          {buildCron(sched)}
        </code>
      </div>

      <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.45)', margin: 0 }}>
        Timezone: Asia/Ho_Chi_Minh (GMT+7)
      </p>
    </div>
  );
}

const inputFieldStyle = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: 14,
  fontFamily: font.text,
  boxSizing: 'border-box',
  outline: 'none',
};

function SectionCard({ iconBg, iconColor, Icon, title, badge, children }) {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          flexShrink: 0,
          background: iconBg || 'rgba(59, 130, 246, 0.15)',
          color: iconColor || '#3b82f6',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={17} />
        </span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0 }}>
            {title}
          </h2>
        </div>
        {badge ? (
          <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export function BackupPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('config');
  const [form, setForm] = useState(null);
  const [sched, setSched] = useState({ mode: 'daily', hour: 2, minute: 0, everyN: 6, dow: 1, dom: 1, raw: '0 2 * * *' });
  const [advOpen, setAdvOpen] = useState(false);
  const [creds, setCreds] = useState({ clientId: '', clientSecret: '' });
  const [masked, setMasked] = useState(true);
  const [viewLogRun, setViewLogRun] = useState(null);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Settings query
  const settings = useQuery({
    queryKey: ['admin', 'backup', 'settings'],
    queryFn: async () => (await api.get('/admin/backup/settings')).data,
  });

  useEffect(() => {
    if (settings.data) {
      setForm(settings.data);
      setSched(parseCron(settings.data.cronExpr));
    }
  }, [settings.data]);

  // Runs query
  const runs = useQuery({
    queryKey: ['admin', 'backup', 'runs'],
    queryFn: async () => (await api.get('/admin/backup/runs', { params: { limit: 20 } })).data,
    refetchInterval: (q) => (q.state.data?.some((r) => ['pending', 'running'].includes(r.status)) ? 4000 : false),
  });

  // Save settings mutation
  const save = useMutation({
    mutationFn: (patch) => api.put('/admin/backup/settings', patch),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'backup', 'settings'], res.data);
      toast.success('Đã lưu cấu hình backup.');
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Lưu cấu hình thất bại.'),
  });

  // Save credentials mutation
  const saveCreds = useMutation({
    mutationFn: () => api.put('/admin/backup/gdrive/creds', creds),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'backup', 'settings'], res.data);
      setCreds({ clientId: '', clientSecret: '' });
      toast.success('Đã lưu credentials. Hãy bấm "Kết nối Google".');
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Lưu credentials thất bại.'),
  });

  // Disconnect mutation
  const disconnect = useMutation({
    mutationFn: () => api.post('/admin/backup/gdrive/disconnect'),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'backup', 'settings'], res.data);
      toast.success('Đã ngắt kết nối Google Drive.');
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Không thể ngắt kết nối.'),
  });

  // Manual run mutation
  const runNow = useMutation({
    mutationFn: () => api.post('/admin/backup/run'),
    onSuccess: () => {
      toast.success('Đã bắt đầu tiến trình backup.');
      qc.invalidateQueries({ queryKey: ['admin', 'backup', 'runs'] });
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Không thể bắt đầu backup.'),
  });

  // Delete run mutation
  const delRun = useMutation({
    mutationFn: (id) => api.delete(`/admin/backup/runs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'backup', 'runs'] }),
    onError: (e) => toast.error(e.response?.data?.message ?? 'Không thể xoá bản ghi.'),
  });

  // OAuth Google connect popup
  const connect = async () => {
    try {
      const { data } = await api.get('/admin/backup/gdrive/oauth/start', { params: { origin: window.location.origin } });
      const w = 560;
      const h = 720;
      const x = window.screen.width / 2 - w / 2;
      const y = window.screen.height / 2 - h / 2;
      window.open(data.authUrl, 'gdrive-oauth', `width=${w},height=${h},left=${x},top=${y}`);
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'Hãy nhập và lưu Client ID / Secret trước.');
    }
  };

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type !== 'backup-oauth-result') return;
      if (e.data.ok) {
        toast.success(`Đã kết nối thành công: ${e.data.msg}`);
      } else {
        toast.error(`Kết nối thất bại: ${e.data.msg}`);
      }
      qc.invalidateQueries({ queryKey: ['admin', 'backup', 'settings'] });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [qc, toast]);

  if (settings.isLoading || (settings.data && !form)) {
    return (
      <div style={{ width: '100%' }}>
        <FormSkeleton blocks={3} />
      </div>
    );
  }

  if (settings.isError || !form) {
    return (
      <div style={{ width: '100%' }}>
        <Card>
          <EmptyState
            icon={<AlertTriangle size={36} color="#ef4444" />}
            title="Không tải được cấu hình backup"
            description="Vui lòng kiểm tra kết nối mạng hoặc liên hệ kỹ thuật."
          />
        </Card>
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const list = runs.data ?? [];
  const last = list[0];
  const isRunning = list.some((r) => ['pending', 'running'].includes(r.status));
  const scopeCount = [form.scopeDb, form.scopeUploads, form.scopeConfigs].filter(Boolean).length;

  const saveConfig = () => save.mutate({
    enabled: form.enabled,
    cronExpr: buildCron(sched),
    retentionCount: Number(form.retentionCount) || 3,
    scopeDb: form.scopeDb,
    scopeUploads: form.scopeUploads,
    scopeConfigs: form.scopeConfigs,
    rcloneRemote: form.rcloneRemote || 'gdrive',
    remoteFolder: form.remoteFolder || 'masterlms-backups',
  });

  const redirectUri = `${window.location.origin.replace(/\/$/, '')}/api/backup/oauth/callback`;

  const copyRedirect = () => {
    navigator.clipboard?.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  return (
    <div style={{ width: '100%', fontFamily: font.text, color: '#ffffff' }}>
      {/* Privacy mask banner */}
      <div
        onClick={() => setMasked((m) => !m)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setMasked((m) => !m); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '8px 16px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          fontSize: 12.5,
          color: '#fbbf24',
          marginBottom: 18,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <ShieldAlert size={15} />
        <span>
          {masked
            ? 'Đang ẩn thông tin nhạy cảm — tiền, SĐT, email đã mask. Nhấn vào đây để hiện lại'
            : 'Đang hiển thị đầy đủ thông tin. Nhấn vào đây để mask ẩn dữ liệu'}
        </span>
        {masked ? <Eye size={14} style={{ marginLeft: 4 }} /> : <EyeOff size={14} style={{ marginLeft: 4 }} />}
      </div>

      {/* Page Title & Subtitle */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: font.display,
          fontSize: 26,
          fontWeight: 700,
          color: '#ffffff',
          margin: '0 0 6px 0',
        }}>
          Backup
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255, 255, 255, 0.6)', fontSize: 13.5 }}>
          <span style={{
            width: 22,
            height: 22,
            borderRadius: '6px',
            background: 'rgba(6, 182, 212, 0.15)',
            color: '#22d3ee',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <FolderArchive size={14} />
          </span>
          <span>Sao lưu DB + uploads + configs lên Google Drive · auto theo lịch hoặc backup ngay</span>
        </div>
      </div>

      {/* Summary Cards Bar (4 items matching screenshot) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 22,
      }}>
        {/* Card 1: KẾT NỐI */}
        <SummaryCard
          label="KẾT NỐI"
          dotColor={form.connected ? '#22c55e' : '#ef4444'}
        >
          <div style={{ fontSize: 19, fontWeight: 800, color: form.connected ? '#22c55e' : 'rgba(255,255,255,0.85)' }}>
            {form.connected ? 'OK' : 'Chưa kết nối'}
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {form.connected ? maskEmail(form.gdriveAccountEmail, masked) : 'Vào tab Kết nối'}
          </div>
        </SummaryCard>

        {/* Card 2: LẦN CUỐI */}
        <SummaryCard
          label="LẦN CUỐI"
          Icon={Clock}
        >
          <div style={{ fontSize: 19, fontWeight: 800, color: last ? (STATUS[last.status]?.c || '#ffffff') : '#ffffff' }}>
            {last ? STATUS[last.status]?.t : 'Chưa có'}
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {last
              ? `${fmtDate(last.startedAt)} · ${fmtSize(last.sizeBytes)} · ${dur(last.startedAt, last.finishedAt)}`
              : 'Chưa chạy backup nào'}
          </div>
        </SummaryCard>

        {/* Card 3: AUTO · BẬT/TẮT */}
        <SummaryCard
          label={`AUTO · ${form.enabled ? 'BẬT' : 'TẮT'}`}
          Icon={CalendarClock}
          dotColor={form.enabled ? '#3b82f6' : 'rgba(255,255,255,0.3)'}
        >
          <div style={{ fontSize: 19, fontWeight: 800, color: '#ffffff' }}>
            {form.enabled ? describeCron(sched) : 'Tắt'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginTop: 4 }}>
            Giữ {form.retentionCount || 3} bản
          </div>
        </SummaryCard>

        {/* Card 4: Big Green Action Button "Backup ngay" */}
        <div style={{ display: 'flex', minHeight: 90 }}>
          <button
            type="button"
            disabled={!form.connected || isRunning || runNow.isPending}
            onClick={() => runNow.mutate()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '16px 20px',
              borderRadius: '12px',
              border: 'none',
              cursor: form.connected && !isRunning ? 'pointer' : 'not-allowed',
              background: form.connected && !isRunning
                ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                : 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: 15.5,
              fontWeight: 700,
              boxShadow: form.connected && !isRunning ? '0 4px 14px rgba(34, 197, 94, 0.35)' : 'none',
              transition: 'all .15s ease-in-out',
              opacity: form.connected && !isRunning ? 1 : 0.6,
            }}
          >
            {runNow.isPending || isRunning ? (
              <>
                <Loader2 size={20} className="backup-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <PlayCircle size={20} />
                <span>Backup ngay</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs tab={tab} setTab={setTab} historyCount={list.length} />

      {/* ------------------------------------------------------------- TAB 1: KẾT NỐI */}
      {tab === 'connect' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionCard
            Icon={Plug}
            iconBg="rgba(34, 197, 94, 0.15)"
            iconColor="#22c55e"
            title="Kết nối Google Drive"
          >
            {form.connected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 18px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '10px',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#4ade80',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CheckCircle2 size={20} />
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                        Tài khoản: {maskEmail(form.gdriveAccountEmail, masked)}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.55)', marginTop: 2 }}>
                        Rclone remote: <code>{form.rcloneRemote || 'gdrive'}</code> · Thư mục: <code>{form.remoteFolder || 'masterlms-backups'}</code>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={disconnect.isPending}
                    onClick={() => disconnect.mutate()}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '8px',
                      color: '#f87171',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'background .12s',
                    }}
                  >
                    {disconnect.isPending ? 'Đang ngắt...' : 'Ngắt kết nối'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680 }}>
                <p style={{ fontSize: 13.5, color: 'rgba(255, 255, 255, 0.65)', margin: 0 }}>
                  Dán <strong>Client ID</strong> và <strong>Client Secret</strong> từ Google Cloud Console (OAuth Client ID Web Application) để liên kết Google Drive.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                      CLIENT ID
                    </label>
                    <input
                      type="text"
                      value={creds.clientId}
                      onChange={(e) => setCreds((c) => ({ ...c, clientId: e.target.value }))}
                      placeholder="...apps.googleusercontent.com"
                      style={inputFieldStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                      CLIENT SECRET
                    </label>
                    <input
                      type="password"
                      value={creds.clientSecret}
                      onChange={(e) => setCreds((c) => ({ ...c, clientSecret: e.target.value }))}
                      placeholder="GOCSPX-..."
                      style={inputFieldStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={!creds.clientId || !creds.clientSecret || saveCreds.isPending}
                    onClick={() => saveCreds.mutate()}
                    style={{
                      padding: '10px 18px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: creds.clientId && creds.clientSecret ? 'pointer' : 'not-allowed',
                      opacity: creds.clientId && creds.clientSecret ? 1 : 0.6,
                    }}
                  >
                    {saveCreds.isPending ? 'Đang lưu...' : 'Lưu credentials'}
                  </button>

                  <button
                    type="button"
                    onClick={connect}
                    style={{
                      padding: '10px 20px',
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <KeyRound size={16} />
                    <span>Đăng nhập Google</span>
                  </button>
                </div>

                {/* Redirect URI helper box */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.45)', marginBottom: 4 }}>
                      AUTHORIZED REDIRECT URI TRONG GOOGLE CLOUD
                    </div>
                    <code style={{ fontSize: 12.5, color: '#38bdf8', fontFamily: font.mono }}>
                      {redirectUri}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={copyRedirect}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedRedirect ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                    <span>{copiedRedirect ? 'Đã copy' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ------------------------------------------------------------- TAB 2: CẤU HÌNH */}
      {tab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Big Auto Backup Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '20px 24px',
            borderRadius: '12px',
            border: `1.5px solid ${form.enabled ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            background: form.enabled ? 'rgba(34, 197, 94, 0.06)' : 'rgba(15, 23, 42, 0.6)',
            boxSizing: 'border-box',
          }}>
            {/* Green rounded square icon */}
            <span style={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: form.enabled ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.06)',
              color: form.enabled ? '#22c55e' : 'rgba(255, 255, 255, 0.4)',
              border: `1px solid ${form.enabled ? 'rgba(34, 197, 94, 0.4)' : 'transparent'}`,
            }}>
              <CheckCircle2 size={24} />
            </span>

            {/* Banner text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{
                  margin: 0,
                  fontFamily: font.display,
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#ffffff',
                }}>
                  Auto backup {form.enabled ? 'BẬT' : 'TẮT'}
                </h3>
                {form.enabled ? (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '.05em',
                    color: '#34d399',
                    background: '#064e3b',
                    borderRadius: '999px',
                    padding: '3px 10px',
                  }}>
                    SCHEDULER ACTIVE
                  </span>
                ) : null}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
                Chạy tự động: <strong style={{ color: '#ffffff' }}>{describeCron(sched)}</strong>
              </p>
            </div>

            {/* Toggle switch */}
            <span
              onClick={() => set('enabled', !form.enabled)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') set('enabled', !form.enabled); }}
              style={{
                width: 52,
                height: 28,
                borderRadius: 999,
                flexShrink: 0,
                position: 'relative',
                cursor: 'pointer',
                background: form.enabled ? '#22c55e' : 'rgba(255, 255, 255, 0.2)',
                transition: 'background .18s ease-in-out',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: form.enabled ? 27 : 3,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#ffffff',
                transition: 'left .18s ease-in-out',
                boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
              }} />
            </span>
          </div>

          {/* 2-Column Grid: Lịch chạy & Backup gì */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 20,
            alignItems: 'start',
          }}>
            {/* Column 1: Lịch chạy */}
            <SectionCard
              Icon={Clock}
              iconBg="rgba(59, 130, 246, 0.15)"
              iconColor="#3b82f6"
              title="Lịch chạy"
            >
              <SchedulePicker sched={sched} setSched={setSched} />
            </SectionCard>

            {/* Column 2: Backup gì */}
            <SectionCard
              Icon={Database}
              iconBg="rgba(34, 197, 94, 0.15)"
              iconColor="#22c55e"
              title="Backup gì"
              badge={`${scopeCount}/3 chọn`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ScopeRow
                  Icon={Database}
                  title="Postgres DB"
                  hint="pg_dump --clean --if-exists | gzip"
                  on={!!form.scopeDb}
                  onToggle={() => set('scopeDb', !form.scopeDb)}
                />
                <ScopeRow
                  Icon={FolderArchive}
                  title="MinIO uploads"
                  hint="avatars, payment, docs, attachments"
                  on={!!form.scopeUploads}
                  onToggle={() => set('scopeUploads', !form.scopeUploads)}
                />
                <ScopeRow
                  Icon={Terminal}
                  title="Infra configs"
                  hint="docker-compose, nginx, scripts"
                  on={!!form.scopeConfigs}
                  onToggle={() => set('scopeConfigs', !form.scopeConfigs)}
                />
              </div>
            </SectionCard>
          </div>

          {/* Bottom Accordion: Cài đặt nâng cao */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '18px 22px',
          }}>
            <button
              type="button"
              onClick={() => setAdvOpen((o) => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
              }}
            >
              <span style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'rgba(255, 255, 255, 0.7)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FileCog size={17} />
              </span>

              <div style={{ flex: 1 }}>
                <h2 style={{
                  fontFamily: font.display,
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: 0,
                }}>
                  Cài đặt nâng cao
                </h2>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: 12.5,
                  margin: '3px 0 0',
                  fontFamily: font.mono,
                }}>
                  Retention {form.retentionCount || 3} bản · Remote {form.rcloneRemote || 'gdrive'}:{form.remoteFolder || 'masterlms-backups'}
                </p>
              </div>

              <ChevronDown
                size={18}
                color="rgba(255, 255, 255, 0.5)"
                style={{
                  transform: advOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .18s ease-in-out',
                }}
              />
            </button>

            {advOpen && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                {/* Field 1: Retention */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                    GIỮ N BẢN MỚI
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.retentionCount ?? 3}
                    onChange={(e) => set('retentionCount', e.target.value)}
                    style={inputFieldStyle}
                  />
                  <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255, 255, 255, 0.4)', marginTop: 4 }}>
                    Quá N → rclone purge folder cũ
                  </span>
                </div>

                {/* Field 2: Rclone Remote */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                    RCLONE REMOTE
                  </label>
                  <input
                    type="text"
                    value={form.rcloneRemote ?? 'gdrive'}
                    onChange={(e) => set('rcloneRemote', e.target.value)}
                    placeholder="gdrive"
                    style={inputFieldStyle}
                  />
                  <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255, 255, 255, 0.4)', marginTop: 4 }}>
                    Tên trong rclone.conf
                  </span>
                </div>

                {/* Field 3: Remote Folder */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 6 }}>
                    FOLDER TRÊN DRIVE
                  </label>
                  <input
                    type="text"
                    value={form.remoteFolder ?? 'masterlms-backups'}
                    onChange={(e) => set('remoteFolder', e.target.value)}
                    placeholder="masterlms-backups"
                    style={inputFieldStyle}
                  />
                  <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255, 255, 255, 0.4)', marginTop: 4 }}>
                    Root folder backup
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              disabled={save.isPending}
              onClick={saveConfig}
              style={{
                padding: '11px 26px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                cursor: save.isPending ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all .14s',
                opacity: save.isPending ? 0.7 : 1,
              }}
            >
              {save.isPending ? <Loader2 size={16} className="backup-spin" /> : null}
              <span>{save.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- TAB 3: LỊCH SỬ */}
      {tab === 'history' && (
        <SectionCard
          Icon={History}
          iconBg="rgba(168, 85, 247, 0.15)"
          iconColor="#c084fc"
          title="Lịch sử backup"
          badge={`${list.length} lần chạy gần nhất`}
        >
          {list.length === 0 ? (
            <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', margin: '8px 0' }}>
              Chưa có bản ghi backup nào.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((r) => {
                const st = STATUS[r.status] ?? STATUS.pending;
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.5)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Status icon */}
                    <st.Icon
                      size={17}
                      color={st.c}
                      className={st.spin ? 'backup-spin' : undefined}
                    />

                    {/* Status text */}
                    <span style={{ fontSize: 13, fontWeight: 700, color: st.c, width: 88 }}>
                      {st.t}
                    </span>

                    {/* Time & Kind */}
                    <span style={{ fontSize: 13, color: '#ffffff', flex: 1, minWidth: 200 }}>
                      {fmtDate(r.startedAt)} ·{' '}
                      <span style={{ color: 'rgba(255, 255, 255, 0.55)' }}>
                        {r.kind === 'manual' ? 'thủ công' : 'tự động'}
                      </span>
                    </span>

                    {/* Size */}
                    <span style={{
                      fontSize: 12.5,
                      color: 'rgba(255, 255, 255, 0.7)',
                      width: 80,
                      textAlign: 'right',
                      fontFamily: font.mono,
                    }}>
                      {fmtSize(r.sizeBytes)}
                    </span>

                    {/* Duration */}
                    <span style={{
                      fontSize: 12.5,
                      color: 'rgba(255, 255, 255, 0.5)',
                      width: 58,
                      textAlign: 'right',
                      fontFamily: font.mono,
                    }}>
                      {dur(r.startedAt, r.finishedAt)}
                    </span>

                    {/* Error preview if any */}
                    {r.error ? (
                      <span
                        title={r.error}
                        style={{
                          fontSize: 12,
                          color: '#f87171',
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          background: 'rgba(239, 68, 68, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {r.error}
                      </span>
                    ) : null}

                    {/* View log button */}
                    {r.logTail ? (
                      <button
                        type="button"
                        onClick={() => setViewLogRun(r)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '5px',
                          color: 'rgba(255, 255, 255, 0.8)',
                          cursor: 'pointer',
                          fontSize: 11.5,
                          padding: '3px 8px',
                        }}
                      >
                        Xem log
                      </button>
                    ) : null}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => delRun.mutate(r.id)}
                      title="Xoá bản ghi"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.4)',
                        padding: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Log Tail Modal/Drawer */}
          {viewLogRun ? (
            <div
              onClick={() => setViewLogRun(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999,
                padding: 20,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: 720,
                  maxHeight: '80vh',
                  background: '#090d16',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                    Chi tiết Log Backup ({fmtDate(viewLogRun.startedAt)})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setViewLogRun(null)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Remote Path: <code style={{ color: '#38bdf8' }}>{viewLogRun.remotePath || '—'}</code>
                </div>

                <pre style={{
                  flex: 1,
                  overflowY: 'auto',
                  background: '#030712',
                  padding: 14,
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#4ade80',
                  fontFamily: font.mono,
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {viewLogRun.logTail || 'Không có log.'}
                </pre>
              </div>
            </div>
          ) : null}
        </SectionCard>
      )}

      {/* ------------------------------------------------------------- TAB 4: HƯỚNG DẪN */}
      {tab === 'guide' && (
        <SectionCard
          Icon={BookOpen}
          iconBg="rgba(245, 158, 11, 0.15)"
          iconColor="#f59e0b"
          title="Hướng dẫn cấu hình Google Drive OAuth"
        >
          <ol style={{
            margin: 0,
            paddingLeft: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            fontSize: 13.5,
            color: 'rgba(255, 255, 255, 0.85)',
            lineHeight: 1.6,
          }}>
            <li>
              Vào <code style={monoStyle}>https://console.cloud.google.com/projectcreate</code> để tạo dự án mới (ví dụ: <strong style={{ color: '#fff' }}>MasterLMS Backup</strong>).
            </li>
            <li>
              Bật Google Drive API tại <code style={monoStyle}>https://console.cloud.google.com/apis/library/drive.googleapis.com</code> → bấm <strong>Enable</strong>.
            </li>
            <li>
              Vào <strong>OAuth consent screen</strong>: Chọn User type <strong>External</strong> → điền tên ứng dụng và email hỗ trợ → Lưu.
            </li>
            <li>
              Tại tab <strong>Audience (Test users)</strong>: Bấm <strong>+ Add users</strong> và thêm địa chỉ Gmail bạn sẽ dùng để lưu backup (bắt buộc).
            </li>
            <li>
              Tại tab <strong>Data Access (Scopes)</strong>: Thêm scope Drive:
              <div style={{ marginTop: 4 }}>
                <code style={{ ...monoStyle, color: '#38bdf8' }}>https://www.googleapis.com/auth/drive</code>
              </div>
            </li>
            <li>
              Vào <strong>Credentials</strong> → <strong>+ Create Credentials</strong> → <strong>OAuth client ID</strong>:
              <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                <li>Application type: <strong>Web application</strong></li>
                <li>
                  Authorized redirect URIs:
                  <div style={{ marginTop: 4 }}>
                    <code style={{ ...monoStyle, color: '#38bdf8' }}>{redirectUri}</code>
                  </div>
                </li>
              </ul>
            </li>
            <li>
              Copy <strong>Client ID</strong> và <strong>Client Secret</strong> vừa tạo → chuyển sang tab <strong>Kết nối</strong> trên trang này → Dán vào và bấm <strong>Lưu credentials</strong> → bấm <strong>Đăng nhập Google</strong> để hoàn tất.
            </li>
          </ol>

          <div style={{
            marginTop: 20,
            padding: '14px 18px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            fontSize: 12.5,
            color: 'rgba(255, 255, 255, 0.65)',
            lineHeight: 1.5,
          }}>
            <strong style={{ color: '#fbbf24' }}>Lưu ý quan trọng:</strong> Khi đăng nhập Google xuất hiện màn hình <em>"Google chưa xác minh ứng dụng này"</em>, hãy bấm <strong>Nâng cao (Advanced)</strong> → <strong>Tiếp tục (Go to MasterLMS)</strong>. Ở màn hình cấp quyền, <strong>bắt buộc phải tick vào ô tròn cho phép xem/sửa/xoá file Drive</strong> để rclone có quyền tạo thư mục backup.
          </div>
        </SectionCard>
      )}

      {/* Global CSS keyframe */}
      <style>{`
        @keyframes backupSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .backup-spin {
          animation: backupSpin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

const monoStyle = {
  fontFamily: font.mono,
  background: 'rgba(255, 255, 255, 0.08)',
  padding: '2px 7px',
  borderRadius: '4px',
  fontSize: 12.5,
};
