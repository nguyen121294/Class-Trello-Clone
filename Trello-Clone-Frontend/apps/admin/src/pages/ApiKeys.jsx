import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Input, Select, Badge, Modal, EmptyState,
  usePermission, useToast, useConfirm, color, space, font, radius, shadow,
} from '@trello/ui';
import {
  Key, ShieldCheck, Plus, Trash2, Ban, CheckCircle2, Clock,
  RefreshCw, SlidersHorizontal, Copy, Check, Info, AlertTriangle, Layers,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, SearchInput } from '../components/Layout';
import { Table, Pagination } from '../components/Table';
import { Alert, CopyField } from '../components/ui';
import { usePagination } from '../lib/usePagination';
import { useDebounced } from '../lib/useDebounced';

const FALLBACK_SCOPES = [
  { key: 'workspaces:read', label: 'Read Workspaces', category: 'Workspaces', desc: 'Xem danh sách và thông tin không gian làm việc' },
  { key: 'boards:read', label: 'Read Boards', category: 'Boards & Lists', desc: 'Xem danh sách bảng, cấu hình nhãn, custom fields, thành viên' },
  { key: 'lists:read', label: 'Read Lists', category: 'Boards & Lists', desc: 'Xem các cột và danh sách công việc' },
  { key: 'cards:read', label: 'Read Cards', category: 'Cards', desc: 'Xem thẻ công việc, checklist, hạn chót, độ ưu tiên' },
  { key: 'comments:read', label: 'Read Comments', category: 'Content & Attachments', desc: 'Đọc bình luận trao đổi trên thẻ' },
  { key: 'attachments:read', label: 'Read Attachments', category: 'Content & Attachments', desc: 'Xem tệp đính kèm và link tải S3' },
  { key: 'activity:read', label: 'Read Activities', category: 'Planning & Tracking', desc: 'Xem lịch sử hoạt động và nhật ký thay đổi' },
  { key: 'milestones:read', label: 'Read Milestones', category: 'Planning & Tracking', desc: 'Xem các cột mốc dự án và ngày mục tiêu' },
  { key: 'gantt:read', label: 'Read Gantt & Dependencies', category: 'Planning & Tracking', desc: 'Xem quan hệ phụ thuộc giữa các công việc' },
  { key: 'reports:read', label: 'Read Weekly Reports', category: 'Planning & Tracking', desc: 'Xem các kỳ báo cáo tuần và check-in chấm công' },
  { key: 'search:read', label: 'Search Content', category: 'Overview & Dashboard', desc: 'Tìm kiếm văn bản trên toàn hệ thống' },
  { key: 'me:read', label: 'Read Profile & Dashboard', category: 'Overview & Dashboard', desc: 'Xem dashboard cá nhân và thông tin người dùng' },
  { key: 'notifications:read', label: 'Read Notifications', category: 'Overview & Dashboard', desc: 'Xem thông báo cá nhân' },
  { key: 'executive:read', label: 'Read Executive Overview', category: 'Overview & Dashboard', desc: 'Xem báo cáo tổng hợp KPI toàn doanh nghiệp' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ isRevoked, expiresAt }) {
  if (isRevoked) {
    return <Badge kind="error" style={{ gap: 4 }}><Ban size={12} /> Revoked</Badge>;
  }
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return <Badge style={{ gap: 4 }}><Clock size={12} /> Expired</Badge>;
  }
  return <Badge kind="success" style={{ gap: 4 }}><CheckCircle2 size={12} /> Active</Badge>;
}

export function ApiKeysPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { hasRole } = usePermission();
  const isSuper = hasRole('super_admin');

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'my' | 'config'
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyCreated, setNewKeyCreated] = useState(null);

  // Filters for All Keys tab
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const { page, setPage, pageSize, setPageSize, reset } = usePagination('api-keys-admin');

  // Form state for creating a new key
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('90');
  const [selectedScopes, setSelectedScopes] = useState([
    'workspaces:read', 'boards:read', 'lists:read', 'cards:read', 'comments:read',
    'attachments:read', 'activity:read', 'gantt:read', 'me:read',
  ]);

  // 1. Fetch Valid Scopes from Backend
  const scopesQuery = useQuery({
    queryKey: ['api-keys', 'scopes'],
    queryFn: async () => {
      try {
        const res = await api.get('/api-keys/scopes');
        return Array.isArray(res.data) ? res.data : FALLBACK_SCOPES;
      } catch {
        return FALLBACK_SCOPES;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const availableScopesList = scopesQuery.data || FALLBACK_SCOPES;

  // 2. Fetch All API Keys (Admin)
  const allKeys = useQuery({
    queryKey: ['admin', 'api-keys', search, statusFilter, page, pageSize],
    queryFn: async () => {
      const res = await api.get('/api-keys/admin', {
        params: {
          q: search || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page,
          limit: pageSize,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'all',
    placeholderData: (prev) => prev,
  });

  // 3. Fetch My Keys
  const myKeys = useQuery({
    queryKey: ['my-api-keys'],
    queryFn: async () => {
      const res = await api.get('/api-keys/me');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    enabled: activeTab === 'my',
  });

  // 4. Fetch Governance Settings
  const settingsQuery = useQuery({
    queryKey: ['admin', 'api-keys', 'settings'],
    queryFn: async () => {
      const res = await api.get('/api-keys/admin/settings');
      return res.data;
    },
    enabled: activeTab === 'config' || isSuper,
  });

  // Mutation: Create Key
  const createKeyMutation = useMutation({
    mutationFn: (body) => api.post('/api-keys/me', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['my-api-keys'] });
      qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      setCreateModalOpen(false);
      setNewKeyCreated(res.data);
      setKeyName('');
      toast.success('API Key created successfully!');
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to create API Key';
      toast.error(msg);
    },
  });

  // Mutation: Revoke Admin Key
  const revokeAdminMutation = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/api-keys/admin/${id}/revoke`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      qc.invalidateQueries({ queryKey: ['my-api-keys'] });
      toast.success('API Key has been revoked.');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to revoke API Key');
    },
  });

  // Mutation: Revoke My Key
  const revokeMyKeyMutation = useMutation({
    mutationFn: (id) => api.delete(`/api-keys/me/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-api-keys'] });
      qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      toast.success('Your API Key has been revoked.');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to revoke API Key');
    },
  });

  // Mutation: Save Settings
  const saveSettingsMutation = useMutation({
    mutationFn: (patch) => api.patch('/api-keys/admin/settings', patch),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'api-keys', 'settings'], res.data);
      toast.success('Governance settings saved successfully.');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    },
  });

  const onRevokeAdmin = async (keyItem) => {
    const ok = await confirm({
      title: 'Revoke API Key',
      message: `Revoke key "${keyItem.name}" (${keyItem.keyPrefix}...)? Any MCP server or application using this key will immediately lose access.`,
      confirmText: 'Revoke Key',
      danger: true,
    });
    if (ok) {
      revokeAdminMutation.mutate({
        id: keyItem.id,
        reason: 'Revoked by administrator from web console',
      });
    }
  };

  const onRevokeMine = async (keyItem) => {
    const ok = await confirm({
      title: 'Revoke My API Key',
      message: `Revoke "${keyItem.name}" (${keyItem.keyPrefix}...)? This action cannot be undone.`,
      confirmText: 'Revoke Key',
      danger: true,
    });
    if (ok) {
      revokeMyKeyMutation.mutate(keyItem.id);
    }
  };

  const toggleScope = (scopeKey) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeKey) ? prev.filter((s) => s !== scopeKey) : [...prev, scopeKey]
    );
  };

  const submitCreate = (e) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error('Please select at least one permission scope');
      return;
    }

    let expiresAt = null;
    const days = Number(expiresInDays);
    if (days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      expiresAt = expDate.toISOString();
    }

    createKeyMutation.mutate({
      name: keyName.trim(),
      scopes: selectedScopes,
      expiresAt,
      expiresInDays: days,
    });
  };

  // Group scopes by category
  const scopesByCategory = useMemo(() => {
    const map = {};
    availableScopesList.forEach((s) => {
      let category = s.category;
      if (!category) {
        if (s.key.startsWith('workspaces:')) category = 'Workspaces';
        else if (s.key.startsWith('boards:') || s.key.startsWith('lists:')) category = 'Boards & Lists';
        else if (s.key.startsWith('cards:')) category = 'Cards';
        else if (s.key.startsWith('comments:') || s.key.startsWith('attachments:')) category = 'Content & Attachments';
        else if (s.key.startsWith('activity:') || s.key.startsWith('milestones:') || s.key.startsWith('gantt:') || s.key.startsWith('reports:')) category = 'Planning & Tracking';
        else category = 'Overview & Dashboard';
      }
      if (!map[category]) map[category] = [];
      map[category].push(s);
    });
    return map;
  }, [availableScopesList]);

  // Columns for All Keys (Admin)
  const adminColumns = [
    {
      key: 'name',
      header: 'API Key',
      render: (k) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <span style={{
            width: 32, height: 32, borderRadius: radius.large, flexShrink: 0,
            background: 'rgba(24,104,219,0.12)', color: color.blue,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Key size={16} />
          </span>
          <div>
            <div style={{ fontWeight: 600, color: color.text }}>{k.name}</div>
            <code style={{ fontSize: 12, color: color.textMuted, fontFamily: font.mono }}>
              {k.keyPrefix}••••••••
            </code>
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Owner',
      render: (k) => (
        <div>
          <div style={{ fontWeight: 500, color: color.text, fontSize: 13 }}>
            {k.user?.name || 'Unknown User'}
          </div>
          <div style={{ fontSize: 12, color: color.textMuted }}>
            {k.user?.email}
          </div>
        </div>
      ),
    },
    {
      key: 'scopes',
      header: 'Permissions',
      render: (k) => {
        const count = k.scopes?.length || 0;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
            {k.scopes?.slice(0, 2).map((s) => (
              <Badge key={s} kind="default" style={{ fontSize: 11 }}>{s}</Badge>
            ))}
            {count > 2 && (
              <Badge kind="primary" style={{ fontSize: 11 }}>+{count - 2} more</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (k) => <StatusBadge isRevoked={!!k.revokedAt} expiresAt={k.expiresAt} />,
    },
    {
      key: 'rateLimit',
      header: 'Limit',
      align: 'center',
      render: (k) => (
        <span style={{ fontSize: 12, color: color.textMuted }}>
          {k.rateLimit ? `${k.rateLimit} req/m` : 'Default'}
        </span>
      ),
    },
    {
      key: 'lastUsed',
      header: 'Last Used',
      render: (k) => (
        <span style={{ fontSize: 12, color: k.lastUsedAt ? color.text : color.textMuted }}>
          {fmtDate(k.lastUsedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (k) => (
        !k.revokedAt && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => onRevokeAdmin(k)}
            loading={revokeAdminMutation.isPending}
          >
            Revoke
          </Button>
        )
      ),
    },
  ];

  // Columns for My Keys
  const myColumns = [
    {
      key: 'name',
      header: 'Key Name',
      render: (k) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <span style={{
            width: 32, height: 32, borderRadius: radius.large, flexShrink: 0,
            background: 'rgba(24,104,219,0.12)', color: color.blue,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Key size={16} />
          </span>
          <div>
            <div style={{ fontWeight: 600, color: color.text }}>{k.name}</div>
            <code style={{ fontSize: 12, color: color.textMuted, fontFamily: font.mono }}>
              {k.keyPrefix}••••••••
            </code>
          </div>
        </div>
      ),
    },
    {
      key: 'scopes',
      header: 'Permissions',
      render: (k) => {
        const count = k.scopes?.length || 0;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
            {k.scopes?.slice(0, 3).map((s) => (
              <Badge key={s} kind="default" style={{ fontSize: 11 }}>{s}</Badge>
            ))}
            {count > 3 && (
              <Badge kind="primary" style={{ fontSize: 11 }}>+{count - 3} more</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (k) => <StatusBadge isRevoked={!!k.revokedAt} expiresAt={k.expiresAt} />,
    },
    {
      key: 'created',
      header: 'Created At',
      render: (k) => <span style={{ fontSize: 12, color: color.textMuted }}>{fmtDate(k.createdAt)}</span>,
    },
    {
      key: 'expires',
      header: 'Expires At',
      render: (k) => <span style={{ fontSize: 12, color: color.textMuted }}>{k.expiresAt ? fmtDate(k.expiresAt) : 'Never'}</span>,
    },
    {
      key: 'lastUsed',
      header: 'Last Used',
      render: (k) => <span style={{ fontSize: 12, color: k.lastUsedAt ? color.text : color.textMuted }}>{fmtDate(k.lastUsedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (k) => (
        !k.revokedAt && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => onRevokeMine(k)}
            loading={revokeMyKeyMutation.isPending}
          >
            Revoke
          </Button>
        )
      ),
    },
  ];

  const adminRows = allKeys.data?.items || [];
  const totalAdminCount = allKeys.data?.total || 0;
  const myRows = Array.isArray(myKeys.data) ? myKeys.data : [];
  const currentSettings = settingsQuery.data || {};

  return (
    <div>
      <PageHeader
        title="API Keys"
        subtitle="Manage access tokens for MCP servers, Claude Desktop, and developer integrations"
        breadcrumb={['Admin', 'API Keys']}
        action={
          <div style={{ display: 'flex', gap: space.sm, alignItems: 'center' }}>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={15} />}
              onClick={() => {
                if (activeTab === 'all') allKeys.refetch();
                if (activeTab === 'my') myKeys.refetch();
                if (activeTab === 'config') settingsQuery.refetch();
              }}
            >
              Refresh
            </Button>
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create API Key
            </Button>
          </div>
        }
      />

      {/* Tabs Switcher */}
      <div style={{
        display: 'flex', gap: space.xs, marginBottom: space.lg,
        borderBottom: `1px solid ${color.border}`, paddingBottom: 2,
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: space.sm,
            padding: '10px 18px', border: 'none', background: 'transparent',
            cursor: 'pointer', fontFamily: font.text, fontSize: 14, fontWeight: 600,
            color: activeTab === 'all' ? color.blue : color.textMuted,
            borderBottom: activeTab === 'all' ? `2px solid ${color.blue}` : '2px solid transparent',
            marginBottom: -1, transition: 'color .12s',
          }}
        >
          <Layers size={16} /> All System Keys
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: space.sm,
            padding: '10px 18px', border: 'none', background: 'transparent',
            cursor: 'pointer', fontFamily: font.text, fontSize: 14, fontWeight: 600,
            color: activeTab === 'my' ? color.blue : color.textMuted,
            borderBottom: activeTab === 'my' ? `2px solid ${color.blue}` : '2px solid transparent',
            marginBottom: -1, transition: 'color .12s',
          }}
        >
          <Key size={16} /> My API Keys
        </button>

        {isSuper && (
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: space.sm,
              padding: '10px 18px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontFamily: font.text, fontSize: 14, fontWeight: 600,
              color: activeTab === 'config' ? color.blue : color.textMuted,
              borderBottom: activeTab === 'config' ? `2px solid ${color.blue}` : '2px solid transparent',
              marginBottom: -1, transition: 'color .12s',
            }}
          >
            <SlidersHorizontal size={16} /> Governance & Limits
          </button>
        )}
      </div>

      {/* TAB 1: ALL KEYS */}
      {activeTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space.base, flexWrap: 'wrap',
          }}>
            <SearchInput
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); reset(); }}
              placeholder="Search by key name, prefix, user email or name…"
              width={380}
            />

            <div style={{ display: 'flex', gap: space.sm, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: color.textMuted }}>Status:</span>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); reset(); }}
                style={{ minHeight: 36, padding: '4px 10px', fontSize: 13 }}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="revoked">Revoked</option>
                <option value="expired">Expired</option>
              </Select>
            </div>
          </div>

          <Table
            columns={adminColumns}
            rows={adminRows}
            loading={allKeys.isLoading}
            fetching={allKeys.isFetching}
            error={allKeys.isError ? 'Could not load API keys' : null}
            empty="No API keys found"
            emptyDescription={search ? 'No keys matched your search filter.' : 'No API keys have been generated yet.'}
          />

          {totalAdminCount > pageSize && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalAdminCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      {/* TAB 2: MY KEYS */}
      {activeTab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
          <Alert kind="info" title="How to use your API Key">
            Your personal API Key inherits all of your organization permissions while remaining restricted to the selected scopes.
            It can be used with Claude Desktop, Cursor MCP, or HTTP scripts using{' '}
            <code style={{ fontFamily: font.mono }}>Authorization: Bearer trello_live_...</code>.
          </Alert>

          <Table
            columns={myColumns}
            rows={myRows}
            loading={myKeys.isLoading}
            fetching={myKeys.isFetching}
            error={myKeys.isError ? 'Could not load your API keys' : null}
            empty="No personal API keys"
            emptyDescription="You haven't created any API keys yet. Click 'Create API Key' above to generate one."
          />
        </div>
      )}

      {/* TAB 3: GOVERNANCE & CONFIG */}
      {activeTab === 'config' && (
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: space.lg }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.base }}>
              <span style={{
                width: 34, height: 34, borderRadius: radius.large, flexShrink: 0,
                background: 'rgba(24,104,219,0.12)', color: color.blue,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <SlidersHorizontal size={17} />
              </span>
              <div>
                <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, margin: 0 }}>
                  Global API Key Limits
                </h2>
                <p style={{ color: color.textMuted, fontSize: 13, margin: '2px 0 0' }}>
                  Protect your system against abuse, DDoS, and runaway agent loops.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target;
                saveSettingsMutation.mutate({
                  maxKeysPerUser: Number(form.maxKeys.value),
                  defaultRateLimit: Number(form.rateLimit.value),
                  allowUserApiKeys: form.allowUserApiKeys.checked,
                  maxExpiryDays: Number(form.maxExpiryDays.value),
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: space.base }}
            >
              <Input
                label="Maximum active keys per user"
                name="maxKeys"
                type="number"
                min="1"
                max="50"
                defaultValue={currentSettings.maxKeysPerUser ?? 5}
                helper="Limits how many active keys an individual user can hold simultaneously."
              />

              <Input
                label="Default Rate Limit (Requests / minute)"
                name="rateLimit"
                type="number"
                min="10"
                max="10000"
                defaultValue={currentSettings.defaultRateLimit ?? 120}
                helper="Enforced via Redis sliding-window per API key."
              />

              <Input
                label="Maximum expiration (Days)"
                name="maxExpiryDays"
                type="number"
                min="1"
                max="3650"
                defaultValue={currentSettings.maxExpiryDays ?? 365}
                helper="Default lifetime cap for generated keys (e.g. 365 days)."
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: space.sm, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  name="allowUserApiKeys"
                  defaultChecked={currentSettings.allowUserApiKeys ?? true}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 500, color: color.text }}>
                  Allow regular users to generate self-service API Keys
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: space.sm }}>
                <Button type="submit" loading={saveSettingsMutation.isPending}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h3 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 700, color: color.text, margin: '0 0 8px 0' }}>
              Available Permission Scopes ({availableScopesList.length})
            </h3>
            <p style={{ color: color.textMuted, fontSize: 13, margin: '0 0 16px 0' }}>
              These scopes are strictly validated by the backend auth guard:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {availableScopesList.map((s) => (
                <Badge key={s.key} kind="primary" style={{ padding: '4px 10px', fontSize: 12 }}>
                  {s.key}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: CREATE API KEY */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create API Key"
        size="md"
      >
        <form onSubmit={submitCreate} style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <Input
            label="Key Name"
            placeholder="e.g. Claude Desktop MCP, Cursor IDE, Backup Script"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            helper="Give your key a recognizable name describing where it will be used."
            autoFocus
          />

          <Select
            label="Expiration Period"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            helper="Keys expire automatically unless set to never."
          >
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days (Recommended)</option>
            <option value="180">180 Days</option>
            <option value="365">1 Year</option>
            <option value="0">Never Expires</option>
          </Select>

          {/* Scope Selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontFamily: font.text, fontSize: 13, fontWeight: 600, color: color.text }}>
                Permission Scopes
              </label>
              <div style={{ display: 'flex', gap: space.xs }}>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => setSelectedScopes([
                    'workspaces:read', 'boards:read', 'lists:read', 'cards:read',
                    'comments:read', 'attachments:read', 'activity:read', 'gantt:read', 'me:read',
                  ])}
                >
                  Read-Only (MCP)
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => setSelectedScopes(availableScopesList.map((s) => s.key))}
                >
                  All Scopes
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => setSelectedScopes([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div style={{
              maxHeight: 250, overflowY: 'auto', border: `1px solid ${color.border}`,
              borderRadius: radius.base, padding: space.sm, display: 'flex', flexDirection: 'column', gap: space.sm,
            }}>
              {Object.entries(scopesByCategory).map(([cat, scopes]) => (
                <div key={cat}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    color: color.textMuted, letterSpacing: 0.5, marginBottom: 4,
                  }}>
                    {cat}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {scopes.map((s) => {
                      const checked = selectedScopes.includes(s.key);
                      return (
                        <label
                          key={s.key}
                          title={s.desc}
                          style={{
                            display: 'flex', alignItems: 'center', gap: space.sm,
                            padding: '6px 8px', borderRadius: radius.base, cursor: 'pointer',
                            background: checked ? color.primaryBadgeBg : color.surfaceAlt,
                            border: `1px solid ${checked ? color.blue : color.border}`,
                            transition: 'all .12s', fontSize: 13,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleScope(s.key)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: checked ? 600 : 400, color: checked ? color.blue : color.text }}>
                            {s.label || s.key}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: color.textMuted, marginTop: 4 }}>
              Selected: {selectedScopes.length} of {availableScopesList.length} scopes
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm }}>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createKeyMutation.isPending}>
              Generate Key
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: KEY CREATED SUCCESS */}
      <Modal
        open={!!newKeyCreated}
        onClose={() => setNewKeyCreated(null)}
        title="API Key Generated Successfully"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <Alert kind="danger" title="Save this key now!">
            This is the ONLY time this key will be displayed. If you lose it, you will need to revoke it and generate a new one.
          </Alert>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: color.text, display: 'block', marginBottom: 6 }}>
              Secret Token ({newKeyCreated?.name})
            </label>
            <CopyField value={newKeyCreated?.plaintext || newKeyCreated?.key} mono />
          </div>

          <div style={{
            background: color.surfaceAlt, border: `1px solid ${color.border}`,
            borderRadius: radius.base, padding: space.base,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: color.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
              Example Usage in .env or MCP Config
            </div>
            <code style={{
              display: 'block', fontFamily: font.mono, fontSize: 12,
              color: color.text, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {`TRELLO_API_URL=http://103.82.193.221:4000/api\nTRELLO_API_KEY=${newKeyCreated?.plaintext || newKeyCreated?.key}`}
            </code>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: space.sm }}>
            <Button onClick={() => setNewKeyCreated(null)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
