import { PrismaClient } from "@prisma/client";

export class ChipEconomyService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { chips: true },
    });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    return user.chips;
  }

  async addChips(userId: string, amount: number): Promise<number> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { chips: { increment: amount } },
      select: { chips: true },
    });
    return user.chips;
  }

  async removeChips(userId: string, amount: number): Promise<number> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { chips: true },
    });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    if (user.chips < amount) {
      throw new Error(`Insufficient chips. Balance: ${user.chips}, Requested: ${amount}`);
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { chips: { decrement: amount } },
      select: { chips: true },
    });
    return updated.chips;
  }

  async transferChips(fromUserId: string, toUserId: string, amount: number): Promise<void> {
    if (amount <= 0) {
      throw new Error("Transfer amount must be positive");
    }
    await this.prisma.$transaction(async (tx) => {
      const fromUser = await tx.user.findUnique({
        where: { id: fromUserId },
        select: { chips: true },
      });
      if (!fromUser) throw new Error(`Source user ${fromUserId} not found`);
      if (fromUser.chips < amount) {
        throw new Error(`Insufficient chips for transfer. Balance: ${fromUser.chips}`);
      }
      await tx.user.update({
        where: { id: fromUserId },
        data: { chips: { decrement: amount } },
      });
      await tx.user.update({
        where: { id: toUserId },
        data: { chips: { increment: amount } },
      });
    });
  }

  async recordMatchResult(
    userId: string,
    roomType: string,
    chipsWon: number,
    chipsLost: number,
    result?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.matchHistory.create({
        data: {
          userId,
          roomType,
          chipsWon,
          chipsLost,
          result,
        },
      }),
      this.prisma.leaderboardEntry.upsert({
        where: { userId },
        create: {
          userId,
          totalChipsWon: chipsWon,
          gamesPlayed: 1,
        },
        update: {
          totalChipsWon: { increment: chipsWon },
          gamesPlayed: { increment: 1 },
        },
      }),
    ]);
  }
}
