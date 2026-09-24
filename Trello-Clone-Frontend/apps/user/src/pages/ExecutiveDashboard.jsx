import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, radius, font } from '@trello/ui';
import { LayoutDashboard, Building2, Trello, CheckCircle2, ShieldCheck, Eye, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';

export function ExecutiveDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        setLoading(true);
        const res = await api.get('/executive/overview');
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0284c7', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            <ShieldCheck size={16} /> B2B SaaS Enterprise Governance
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#0f172a' }}>
            Executive Overview Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
            Phân hệ giám sát dành riêng cho Ban Lãnh Đạo: Xem tổng thể tiến độ mọi phòng ban trên toàn công ty.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Đang nạp báo cáo giám sát tổng hợp...</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Không có dữ liệu hoặc bạn chưa được cấp quyền Lãnh đạo giám sát.</div>
      ) : (
        <>
          {/* Khối KPI Metrics Tổng Quan */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 32 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <Building2 size={16} color="#0284c7" /> Tổng Phòng Ban (Workspaces)
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 8 }}>
                {data.summary?.totalWorkspaces || 0}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <Trello size={16} color="#16a34a" /> Tổng Dự Án (Boards)
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 8 }}>
                {data.summary?.totalBoards || 0}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: radius.base, padding: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <CheckCircle2 size={16} color="#eab308" /> Tổng Thẻ Công Việc (Cards)
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 8 }}>
                {data.summary?.totalCards || 0}
              </div>
            </div>
          </div>

          {/* Danh Sách Chi Tiết Từng Workspace & Dự Án */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: radius.base, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: 15, color: '#334155' }}>
              Danh Sách Phòng Ban & Tiến Độ Dự Án Trực Thuộc
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(data.workspaces || []).map((ws) => (
                <div key={ws.id} style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{ws.name}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>
                        Trưởng phòng: <strong>{ws.owner?.name || ws.owner?.email || 'N/A'}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                      Read-only Oversight
                    </span>
                  </div>

                  {/* Danh sách Board của Workspace này */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
                    {(ws.boards || []).map((b) => (
                      <Link
                        key={b.id}
                        to={`/b/${b.id}`}
                        style={{
                          textDecoration: 'none',
                          padding: 12,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: radius.base,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#0284c7' }}>{b.name}</span>
                          <Eye size={14} color="#64748b" />
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {b.goliveDate ? `Golive: ${new Date(b.goliveDate).toLocaleDateString('vi-VN')}` : 'Chưa có ngày Golive'}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
