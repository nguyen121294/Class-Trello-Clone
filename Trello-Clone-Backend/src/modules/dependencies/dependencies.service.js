import { prisma } from "../../config/db.js";
import { NotFound, BadRequest } from "../../lib/errors.js";

/**
 * Kiểm tra chu trình (Cycle Detection) bằng thuật toán DFS
 * Trả về true nếu phát hiện vòng lặp phụ thuộc (ví dụ A -> B -> A)
 */
async function wouldCreateCycle(predecessorId, successorId) {
  if (predecessorId === successorId) return true;

  // Tìm tất cả các quan hệ trong cùng bảng / hệ thống
  const allDeps = await prisma.cardDependency.findMany({
    select: { predecessorId: true, successorId: true },
  });

  // Xây dựng adjacency list
  const adj = new Map();
  for (const dep of allDeps) {
    if (!adj.has(dep.predecessorId)) adj.set(dep.predecessorId, []);
    adj.get(dep.predecessorId).push(dep.successorId);
  }

  // Thêm cạnh mới dự kiến
  if (!adj.has(predecessorId)) adj.set(predecessorId, []);
  adj.get(predecessorId).push(successorId);

  // DFS từ successorId xem có đường đi về predecessorId không
  const visited = new Set();
  const stack = [successorId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === predecessorId) return true; // Có chu trình khép kín

    if (!visited.has(current)) {
      visited.add(current);
      const neighbors = adj.get(current) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) stack.push(n);
      }
    }
  }

  return false;
}

export async function listDependencies(boardId) {
  return prisma.cardDependency.findMany({
    where: {
      predecessor: { list: { boardId } },
    },
    include: {
      predecessor: { select: { id: true, title: true, startDate: true, dueDate: true } },
      successor: { select: { id: true, title: true, startDate: true, dueDate: true } },
    },
  });
}

export async function addDependency({ predecessorId, successorId, type = "FS" }) {
  if (!predecessorId || !successorId) {
    throw BadRequest("Thiếu ID công việc trước (predecessor) hoặc sau (successor).");
  }

  const [pCard, sCard] = await Promise.all([
    prisma.card.findUnique({ where: { id: predecessorId } }),
    prisma.card.findUnique({ where: { id: successorId } }),
  ]);

  if (!pCard || !sCard) throw NotFound("Không tìm thấy một trong hai công việc.");

  const hasCycle = await wouldCreateCycle(predecessorId, successorId);
  if (hasCycle) {
    throw BadRequest("Không thể tạo liên kết: Thao tác này tạo ra vòng lặp phụ thuộc vô tận giữa các công việc.");
  }

  return prisma.cardDependency.create({
    data: {
      predecessorId,
      successorId,
      type,
    },
  });
}

export async function removeDependency(id) {
  const existing = await prisma.cardDependency.findUnique({ where: { id } });
  if (!existing) throw NotFound("Không tìm thấy liên kết phụ thuộc.");
  return prisma.cardDependency.delete({ where: { id } });
}

/**
 * Thuật toán kéo thả Gantt Mode 1: Cascade Push (Cố định thời lượng)
 * Khi task gốc dịch chuyển, đẩy toàn bộ chuỗi task phụ thuộc nối sau theo đúng độ lệch ngày
 */
export async function cascadePushGanttTask(cardId, { newStartDate, newDueDate }) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw NotFound("Không tìm thấy công việc.");

  const start = new Date(newStartDate);
  const due = new Date(newDueDate);
  if (isNaN(start.getTime()) || isNaN(due.getTime()) || due < start) {
    throw BadRequest("Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.");
  }

  const originalStart = card.startDate ? new Date(card.startDate) : start;
  const deltaMs = start.getTime() - originalStart.getTime();
  const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));

  // Lấy toàn bộ đồ thị phụ thuộc
  const allDeps = await prisma.cardDependency.findMany({
    select: { predecessorId: true, successorId: true, type: true },
  });

  const adj = new Map();
  for (const dep of allDeps) {
    if (!adj.has(dep.predecessorId)) adj.set(dep.predecessorId, []);
    adj.get(dep.predecessorId).push(dep.successorId);
  }

  // Thu thập toàn bộ các task bị ảnh hưởng theo thứ tự tô bô
  const affectedCardIds = new Set();
  const queue = [cardId];

  while (queue.length > 0) {
    const curr = queue.shift();
    const successors = adj.get(curr) || [];
    for (const s of successors) {
      if (!affectedCardIds.has(s)) {
        affectedCardIds.add(s);
        queue.push(s);
      }
    }
  }

  // Cập nhật card gốc
  const updates = [
    prisma.card.update({
      where: { id: cardId },
      data: { startDate: start, dueDate: due },
    }),
  ];

  // Nếu có deltaDays và có affected cards, cập nhật tịnh tiến
  if (deltaDays !== 0 && affectedCardIds.size > 0) {
    const successorCards = await prisma.card.findMany({
      where: { id: { in: Array.from(affectedCardIds) } },
    });

    for (const s of successorCards) {
      if (s.startDate && s.dueDate) {
        const sStart = new Date(s.startDate);
        const sDue = new Date(s.dueDate);
        sStart.setDate(sStart.getDate() + deltaDays);
        sDue.setDate(sDue.getDate() + deltaDays);

        updates.push(
          prisma.card.update({
            where: { id: s.id },
            data: { startDate: sStart, dueDate: sDue },
          })
        );
      }
    }
  }

  const results = await prisma.$transaction(updates);
  return { updatedCount: results.length, rootCard: results[0] };
}
