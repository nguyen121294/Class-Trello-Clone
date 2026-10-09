import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../src/config/db.js";
import { emitToBoard } from "../../src/realtime/index.js";
import {
  createCard,
  moveCard,
} from "../../src/modules/cards/cards.service.js";

// Mock dependencies
vi.mock("../../src/config/db.js", () => {
  const mockPrisma = {
    card: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    list: {
      findUnique: vi.fn(),
    },
    board: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    activity: {
      create: vi.fn().mockResolvedValue({ id: "act-1" }),
    },
    $transaction: vi.fn(),
  };
  return {
    prisma: mockPrisma,
    dbHealthy: vi.fn(async () => true),
  };
});

describe("CardsService - Business Logic Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCard", () => {
    it("cardsService_createCard_enforcesWipLimit", async () => {
      // Given: List có WIP Limit = 3, và hiện tại đã có 3 cards
      const userId = "user-123";
      const listId = "list-wip-3";

      prisma.list.findUnique
        .mockResolvedValueOnce({
          id: listId,
          boardId: "board-1",
          board: { workspaceId: "ws-1" },
        })
        .mockResolvedValueOnce({ wipLimit: 3 });

      // Mock quyền Workspace của user (Owner)
      prisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
        ownerId: userId,
        orgId: "org-1",
        isLocked: false,
      });

      // Số thẻ hiện tại đang là 3 (bằng wipLimit)
      prisma.card.count.mockResolvedValueOnce(3);

      // When & Then: Thao tác tạo thêm card phải bị từ chối với lỗi 400 WIP_LIMIT
      await expect(
        createCard(userId, { listId, title: "Task vượt quá giới hạn" })
      ).rejects.toMatchObject({
        status: 400,
        code: "WIP_LIMIT",
      });
    });

    it("cardsService_createCard_createsCardSuccessfullyWhenWithinLimit", async () => {
      // Given: List có WIP Limit = 5, hiện tại có 2 cards
      const userId = "user-123";
      const listId = "list-wip-5";

      prisma.list.findUnique
        .mockResolvedValueOnce({
          id: listId,
          boardId: "board-1",
          board: { workspaceId: "ws-1" },
        })
        .mockResolvedValueOnce({ wipLimit: 5 });

      prisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
        ownerId: userId,
        orgId: "org-1",
        isLocked: false,
      });

      prisma.card.count.mockResolvedValueOnce(2); // Dưới limit
      prisma.card.aggregate.mockResolvedValueOnce({ _max: { position: 1000 } });

      const createdCard = {
        id: "new-card-1",
        number: 1,
        title: "Tính năng đăng nhập SSO",
        position: 2000,
        listId,
        boardId: "board-1",
      };

      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          board: { update: vi.fn().mockResolvedValue({ cardSeq: 1 }) },
          card: { create: vi.fn().mockResolvedValue(createdCard) },
        };
        return callback(tx);
      });

      // When: Tạo card
      const res = await createCard(userId, { listId, title: "Tính năng đăng nhập SSO" });

      // Then: Card được tạo thành công và realtime event được phát tới board
      expect(res.id).toBe("new-card-1");
      expect(emitToBoard).toHaveBeenCalledWith("board-1", "card:created", createdCard);
    });
  });

  describe("moveCard", () => {
    it("cardsService_moveCard_sameBoard_updatesPositionAndEmitsCardMoved", async () => {
      // Given: Di chuyển thẻ giữa 2 list trong cùng một Board
      const userId = "user-123";
      const cardId = "card-1";
      const targetListId = "list-done";

      prisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        listId: "list-todo",
        boardId: "board-1",
        workspaceId: "ws-1",
        list: {
          boardId: "board-1",
          board: { workspaceId: "ws-1" },
        },
      });

      prisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
        ownerId: userId,
        orgId: "org-1",
      });

      prisma.list.findUnique.mockResolvedValueOnce({
        id: targetListId,
        boardId: "board-1", // Cùng board
        board: { workspaceId: "ws-1" },
      });

      const updatedCard = { id: cardId, listId: targetListId, position: 1500 };
      prisma.card.update.mockResolvedValueOnce(updatedCard);

      // When: Di chuyển thẻ
      const res = await moveCard(userId, cardId, { listId: targetListId, position: 1500 });

      // Then: Cập nhật vị trí và bắn sự kiện card:moved
      expect(res.position).toBe(1500);
      expect(prisma.card.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: { listId: targetListId, position: 1500 },
        select: expect.any(Object),
      });
      expect(emitToBoard).toHaveBeenCalledWith("board-1", "card:moved", updatedCard);
    });

    it("cardsService_moveCard_crossBoard_emitsCardDeletedOnOldAndCardCreatedOnNewBoard", async () => {
      // Given: Di chuyển thẻ sang Board khác (Board 1 -> Board 2)
      const userId = "user-123";
      const cardId = "card-1";
      const targetListId = "list-b2-todo";

      prisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        listId: "list-b1-todo",
        list: {
          boardId: "board-1",
          board: { workspaceId: "ws-1" },
        },
      });

      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws-1",
        ownerId: userId,
        orgId: "org-1",
      });

      prisma.list.findUnique.mockResolvedValueOnce({
        id: targetListId,
        boardId: "board-2", // Khác board!
        board: { workspaceId: "ws-1" },
      });

      const updatedCard = { id: cardId, listId: targetListId, position: 1000 };
      prisma.card.update.mockResolvedValueOnce(updatedCard);

      // When: Di chuyển thẻ
      await moveCard(userId, cardId, { listId: targetListId, position: 1000 });

      // Then: Phát 2 sự kiện riêng biệt: xóa khỏi board cũ và tạo trên board mới
      expect(emitToBoard).toHaveBeenCalledWith("board-1", "card:deleted", {
        id: cardId,
        listId: "list-b1-todo",
      });
      expect(emitToBoard).toHaveBeenCalledWith("board-2", "card:created", updatedCard);
    });
  });
});
