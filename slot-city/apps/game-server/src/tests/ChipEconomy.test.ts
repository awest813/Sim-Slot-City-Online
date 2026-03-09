// Mock the PrismaClient before importing ChipEconomyService
const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};
const mockPrismaMatch = {
  create: jest.fn(),
};
const mockPrismaLeaderboard = {
  upsert: jest.fn(),
};

const mockTransaction = jest.fn();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: mockPrismaUser,
    matchHistory: mockPrismaMatch,
    leaderboardEntry: mockPrismaLeaderboard,
    $transaction: mockTransaction,
  })),
}));

import { PrismaClient } from "@prisma/client";
import { ChipEconomyService } from "../services/ChipEconomyService";

describe("ChipEconomyService", () => {
  let service: ChipEconomyService;
  let prisma: PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    service = new ChipEconomyService(prisma);
  });

  describe("getBalance", () => {
    it("should return user chip balance", async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ chips: 5000 });
      const balance = await service.getBalance("user-1");
      expect(balance).toBe(5000);
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { chips: true },
      });
    });

    it("should throw if user not found", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);
      await expect(service.getBalance("nonexistent")).rejects.toThrow("User nonexistent not found");
    });
  });

  describe("addChips", () => {
    it("should add chips and return new balance", async () => {
      mockPrismaUser.update.mockResolvedValue({ chips: 5500 });
      const balance = await service.addChips("user-1", 500);
      expect(balance).toBe(5500);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { chips: { increment: 500 } },
        select: { chips: true },
      });
    });

    it("should throw if amount is zero or negative", async () => {
      await expect(service.addChips("user-1", 0)).rejects.toThrow("Amount must be positive");
      await expect(service.addChips("user-1", -100)).rejects.toThrow("Amount must be positive");
    });
  });

  describe("removeChips", () => {
    it("should remove chips and return new balance", async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ chips: 5000 });
      mockPrismaUser.update.mockResolvedValue({ chips: 4500 });
      const balance = await service.removeChips("user-1", 500);
      expect(balance).toBe(4500);
    });

    it("should throw if insufficient chips", async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ chips: 100 });
      await expect(service.removeChips("user-1", 500)).rejects.toThrow("Insufficient chips");
    });

    it("should throw if amount is zero or negative", async () => {
      await expect(service.removeChips("user-1", 0)).rejects.toThrow("Amount must be positive");
      await expect(service.removeChips("user-1", -100)).rejects.toThrow("Amount must be positive");
    });

    it("should throw if user not found", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);
      await expect(service.removeChips("nonexistent", 100)).rejects.toThrow("User nonexistent not found");
    });
  });

  describe("transferChips", () => {
    it("should transfer chips between users", async () => {
      mockTransaction.mockImplementation(async (cb: Function) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({ chips: 1000 }),
            update: jest.fn().mockResolvedValue({ chips: 500 }),
          },
        };
        await cb(mockTx);
      });
      await expect(service.transferChips("user-1", "user-2", 500)).resolves.toBeUndefined();
    });

    it("should throw if transfer amount is zero or negative", async () => {
      await expect(service.transferChips("user-1", "user-2", 0)).rejects.toThrow(
        "Transfer amount must be positive",
      );
    });
  });
});
