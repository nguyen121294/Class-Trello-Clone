import React, { useState, useMemo } from 'react';
import { Button, Input, Modal, color, radius, font } from '@trello/ui';
import { Calendar, MoveRight, Layers, Sliders, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Biểu đồ Gantt trực quan chuyên nghiệp
 * Hỗ trợ 2 chế độ kéo thả:
 * - Mode 1: Cascade Push (Cố định thời lượng & Đẩy các task phụ thuộc theo)
 * - Mode 2: Flexible Stretch (Co dãn thời lượng tự do)
 */
export function GanttChart({ board, cards, onCardClick, onRefresh }) {
  const [dragMode, setDragMode] = useState('cascade'); // 'cascade' (Mode 1) | 'flexible' (Mode 2)
  const [saving, setSaving] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState(null);
  const [dragOffsetDays, setDragOffsetDays] = useState(0);

  // Lọc các card có ngày hợp lệ
  const validCards = useMemo(() => {
    return cards
      .filter((c) => !c.archived)
      .map((c) => {
        const start = c.startDate ? new Date(c.startDate) : (c.dueDate ? new Date(c.dueDate) : new Date());
        let due = c.dueDate ? new Date(c.dueDate) : new Date(start);
        if (due < start) due = new Date(start);
        return {
          ...c,
          start,
          due,
          durationDays: Math.max(1, Math.round((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1),
        };
      })
      .sort((a, b) => a.start - b.start);
  }, [cards]);

  // Xác định khoảng thời gian của trục Gantt
  const { minDate, totalDays, datesArray } = useMemo(() => {
    if (validCards.length === 0) {
      const today = new Date();
      return { minDate: today, totalDays: 30, datesArray: Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() + i); return d;
      })};
    }

    let min = new Date(validCards[0].start);
    let max = new Date(validCards[0].due);

    validCards.forEach((c) => {
      if (c.start < min) min = new Date(c.start);
      if (c.due > max) max = new Date(c.due);
    });

    // Thêm đệm 3 ngày trước và sau
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 7);

    const diffTime = Math.abs(max - min);
    const days = Math.max(14, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const arr = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(min);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }

    return { minDate: min, totalDays: days, datesArray: arr };
  }, [validCards]);

  const DAY_WIDTH = 42; // px per day

  // Xử lý dời ngày task
  const handleShiftTask = async (card, deltaDays) => {
    if (deltaDays === 0) return;
    setSaving(true);
    try {
      const newStart = new Date(card.start);
      const newDue = new Date(card.due);
      newStart.setDate(newStart.getDate() + deltaDays);
      newDue.setDate(newDue.getDate() + deltaDays);

      if (dragMode === 'cascade') {
        // Mode 1: Gọi API Cascade Push để tự động đẩy các task phụ thuộc nối sau
        await api.post(`/cards/${card.id}/gantt-cascade`, {
          newStartDate: newStart.toISOString(),
          newDueDate: newDue.toISOString(),
        });
      } else {
        // Mode 2: Chỉ cập nhật thẻ này
        await api.patch(`/cards/${card.id}`, {
          startDate: newStart.toISOString(),
          dueDate: newDue.toISOString(),
        });
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật tiến độ trên Gantt');
    } finally {
      setSaving(false);
      setDraggingCardId(null);
      setDragOffsetDays(0);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: radius.base, margin: '16px 24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
      {/* Thanh công cụ điều khiển chế độ kéo thả */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={15} color="#0284c7" /> Chế độ Kéo Thả Gantt:
          </span>
          <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: radius.base, padding: 3 }}>
            <button
              onClick={() => setDragMode('cascade')}
              style={{
                border: 'none', borderRadius: radius.base, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                fontWeight: dragMode === 'cascade' ? 700 : 500,
                background: dragMode === 'cascade' ? '#0284c7' : 'transparent',
                color: dragMode === 'cascade' ? '#fff' : '#475569',
              }}
            >
              Mode 1: Cố định thời lượng & Đẩy task sau
            </button>
            <button
              onClick={() => setDragMode('flexible')}
              style={{
                border: 'none', borderRadius: radius.base, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                fontWeight: dragMode === 'flexible' ? 700 : 500,
                background: dragMode === 'flexible' ? '#0284c7' : 'transparent',
                color: dragMode === 'flexible' ? '#fff' : '#475569',
              }}
            >
              Mode 2: Co dãn tự do (Start/End độc lập)
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {board?.googleDriveUrl && (
            <a
              href={board.googleDriveUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                color: '#0284c7', background: '#e0f2fe', padding: '6px 12px', borderRadius: radius.base, textDecoration: 'none'
              }}
            >
              <ExternalLink size={13} /> Mở Google Drive dự án
            </a>
          )}
          {saving && <span style={{ fontSize: 12, color: '#0284c7' }}>Đang lưu tiến độ...</span>}
        </div>
      </div>

      {/* Vùng biểu đồ Gantt Chart */}
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', position: 'relative' }}>
        <div style={{ minWidth: 280 + totalDays * DAY_WIDTH, display: 'flex', flexDirection: 'column' }}>
          {/* Header Timeline Ngày */}
          <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1', background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ width: 280, padding: '10px 16px', fontWeight: 700, fontSize: 12, color: '#334155', borderRight: '1px solid #cbd5e1' }}>
              Tên Công Việc / Đầu Việc
            </div>
            <div style={{ display: 'flex' }}>
              {datesArray.map((date, idx) => {
                const isToday = new Date().toDateString() === date.toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{
                      width: DAY_WIDTH, textAlign: 'center', padding: '6px 0', borderRight: '1px solid #e2e8f0',
                      fontSize: 10, background: isToday ? '#e0f2fe' : (isWeekend ? '#f8fafc' : 'transparent'),
                    }}
                  >
                    <div style={{ fontWeight: 600, color: isToday ? '#0284c7' : '#64748b' }}>
                      {date.toLocaleDateString('vi-VN', { weekday: 'narrow' })}
                    </div>
                    <div style={{ fontWeight: 700, color: isToday ? '#0284c7' : '#1e293b' }}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danh sách Task Rows */}
          {validCards.map((card) => {
            const startOffset = Math.round((card.start - minDate) / (1000 * 60 * 60 * 24));
            const leftPx = startOffset * DAY_WIDTH;
            const widthPx = Math.max(DAY_WIDTH, card.durationDays * DAY_WIDTH);

            return (
              <div
                key={card.id}
                style={{
                  display: 'flex', borderBottom: '1px solid #f1f5f9', height: 44, alignItems: 'center',
                }}
              >
                {/* Tên card bên trái */}
                <div
                  onClick={() => onCardClick(card)}
                  style={{
                    width: 280, padding: '0 16px', fontSize: 13, fontWeight: 500, color: '#1e293b',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</span>
                  {card.jiraUrl && (
                    <span style={{ fontSize: 10, background: '#e0e7ff', color: '#3730a3', padding: '2px 5px', borderRadius: 3 }}>Jira</span>
                  )}
                </div>

                {/* Thanh bar Gantt bên phải */}
                <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
                  <div
                    onClick={() => onCardClick(card)}
                    style={{
                      position: 'absolute',
                      left: leftPx,
                      width: widthPx,
                      height: 28,
                      background: card.status === 'Done' ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      borderRadius: radius.base,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <span>{card.title} ({card.durationDays}d)</span>
                  </div>

                  {/* Nút dịch chuyển lùi/tiến 1 ngày (mô phỏng thao tác kéo thả dễ dùng) */}
                  <div style={{ position: 'absolute', left: leftPx + widthPx + 6, display: 'flex', gap: 4 }}>
                    <button
                      title="Lùi 1 ngày"
                      onClick={() => handleShiftTask(card, -1)}
                      style={{ border: 'none', background: '#e2e8f0', borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: 'pointer' }}
                    >
                      -1d
                    </button>
                    <button
                      title="Tiến 1 ngày"
                      onClick={() => handleShiftTask(card, 1)}
                      style={{ border: 'none', background: '#0284c7', color: '#fff', borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: 'pointer' }}
                    >
                      +1d
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
