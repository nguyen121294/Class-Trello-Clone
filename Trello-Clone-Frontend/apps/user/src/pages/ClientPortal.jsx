import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { radius, Button } from '@trello/ui';
import { Eye, ExternalLink, Calendar, Trello, BarChart2, Shield } from 'lucide-react';
import { api } from '../lib/api';

export function ClientPortal() {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' | 'gantt'

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await api.get(`/portal/boards/${boardId}`);
        setBoard(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (boardId) loadData();
  }, [boardId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Đang nạp cổng thông tin tiến độ dự án...</div>;
  }

  if (!board) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#ef4444' }}>Không tìm thấy dự án hoặc liên kết đã hết hiệu lực.</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top Banner Khách Hàng */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
            <Shield size={14} /> Client Progress Portal • Read-only
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0', color: '#0f172a' }}>{board.name}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {board.googleDriveUrl && (
            <a
              href={board.googleDriveUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                color: '#0284c7', background: '#e0f2fe', padding: '8px 14px', borderRadius: radius.base, textDecoration: 'none',
              }}
            >
              <ExternalLink size={14} /> Tài liệu Google Drive
            </a>
          )}
          <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: radius.base, padding: 3 }}>
            <button
              onClick={() => setActiveTab('kanban')}
              style={{
                border: 'none', borderRadius: radius.base, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                fontWeight: activeTab === 'kanban' ? 700 : 500,
                background: activeTab === 'kanban' ? '#fff' : 'transparent',
                color: activeTab === 'kanban' ? '#0f172a' : '#64748b',
                boxShadow: activeTab === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              Bảng Tiến Độ (Kanban)
            </button>
            <button
              onClick={() => setActiveTab('gantt')}
              style={{
                border: 'none', borderRadius: radius.base, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                fontWeight: activeTab === 'gantt' ? 700 : 500,
                background: activeTab === 'gantt' ? '#fff' : 'transparent',
                color: activeTab === 'gantt' ? '#0f172a' : '#64748b',
                boxShadow: activeTab === 'gantt' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              Tiến Độ Trục Thời Gian (Gantt)
            </button>
          </div>
        </div>
      </div>

      {/* Cột mốc Milestone tóm lược */}
      {board.milestones?.length > 0 && (
        <div style={{ background: '#eff6ff', borderBottom: '1px solid #dbeafe', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 20, overflowX: 'auto' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Cột mốc bàn giao:
          </span>
          {board.milestones.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1e3a8a', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600 }}>{m.title}</span>
              <span style={{ color: '#0284c7', background: '#dbeafe', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                {new Date(m.targetDate).toLocaleDateString('vi-VN')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Nội dung bảng Kanban chỉ đọc */}
      {activeTab === 'kanban' && (
        <div style={{ padding: '24px 32px', display: 'flex', gap: 20, overflowX: 'auto', flex: 1, alignItems: 'flex-start' }}>
          {(board.lists || []).map((list) => (
            <div key={list.id} style={{ width: 280, background: '#f1f5f9', borderRadius: radius.base, padding: 12, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#334155', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>{list.name}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{list.cards?.length || 0}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(list.cards || []).map((card) => (
                  <div key={card.id} style={{ background: '#fff', borderRadius: radius.base, padding: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>{card.title}</div>
                    {card.expectedResult && (
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{card.expectedResult}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                      {card.dueDate && (
                        <span>Hạn: {new Date(card.dueDate).toLocaleDateString('vi-VN')}</span>
                      )}
                      {card.jiraUrl && (
                        <a href={card.jiraUrl} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none' }}>Jira</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Gantt Chart chỉ đọc */}
      {activeTab === 'gantt' && (
        <div style={{ padding: '24px 32px' }}>
          <div style={{ background: '#fff', borderRadius: radius.base, padding: 20, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>Lộ Trình & Tiến Độ Thực Hiện</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(board.lists || []).flatMap((l) => l.cards || []).map((card) => (
                <div key={card.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: radius.base, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{card.title}</span>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
                    <span>Bắt đầu: {card.startDate ? new Date(card.startDate).toLocaleDateString('vi-VN') : 'Chưa set'}</span>
                    <span>Hoàn thành: {card.dueDate ? new Date(card.dueDate).toLocaleDateString('vi-VN') : 'Chưa set'}</span>
                    <span style={{ fontWeight: 700, color: card.status === 'Done' ? '#16a34a' : '#0284c7' }}>{card.status || 'Đang làm'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
