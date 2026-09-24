import { prisma } from "../../config/db.js";
import { NotFound } from "../../lib/errors.js";

/**
 * Lấy dữ liệu Board an toàn cho Khách hàng xem (Read-only)
 * Che giấu thông tin nhạy cảm nội bộ
 */
export async function getClientBoardData(boardId) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      name: true,
      description: true,
      googleDriveUrl: true,
      goliveDate: true,
      lists: {
        where: { archived: false },
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          cards: {
            where: { archived: false },
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              startDate: true,
              dueDate: true,
              jiraUrl: true,
              expectedResult: true,
              assignees: {
                select: {
                  id: true,
                  externalName: true,
                  assigneeType: true,
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      },
      milestones: {
        orderBy: { targetDate: "asc" },
        select: {
          id: true,
          title: true,
          targetDate: true,
          status: true,
          description: true,
          // Không để lộ paymentAmount cho khách nếu chưa cho phép
        },
      },
    },
  });

  if (!board) throw NotFound("Không tìm thấy dự án.");
  return board;
}
