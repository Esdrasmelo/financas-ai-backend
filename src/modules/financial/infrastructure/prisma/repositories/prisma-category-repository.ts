import type { PrismaClient } from "@prisma/client";
import type { CategoryRepository, CreateCategoryInput, UpdateCategoryInput } from "../../../domain/repositories/category-repository.js";
import { toCategoryDomain } from "../mappers/financial-mappers.js";

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(userId: string) {
    const rows = await this.db.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
    return rows.map(toCategoryDomain);
  }

  async findById(id: string, userId: string) {
    const row = await this.db.category.findFirst({ where: { id, userId } });
    return row ? toCategoryDomain(row) : null;
  }

  async create(userId: string, input: CreateCategoryInput) {
    const row = await this.db.category.create({
      data: {
        userId,
        name: input.name,
        type: input.type ?? "expense",
        color: input.color ?? null,
        icon: input.icon ?? null,
      },
    });
    return toCategoryDomain(row);
  }

  async update(id: string, userId: string, input: UpdateCategoryInput) {
    const row = await this.db.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.icon !== undefined && { icon: input.icon }),
      },
    });
    return toCategoryDomain(row);
  }

  async delete(id: string, _userId: string) {
    await this.db.category.delete({ where: { id } });
  }
}
