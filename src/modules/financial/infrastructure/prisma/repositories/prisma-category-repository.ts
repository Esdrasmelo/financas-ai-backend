import type { PrismaClient } from "@prisma/client";
import type { CategoryRepository, CreateCategoryInput, UpdateCategoryInput } from "../../../domain/repositories/category-repository.js";
import { toCategoryDomain } from "../mappers/financial-mappers.js";

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll() {
    const rows = await this.db.category.findMany({ orderBy: { name: "asc" } });
    return rows.map(toCategoryDomain);
  }

  async findById(id: string) {
    const row = await this.db.category.findUnique({ where: { id } });
    return row ? toCategoryDomain(row) : null;
  }

  async create(input: CreateCategoryInput) {
    const row = await this.db.category.create({
      data: {
        name: input.name,
        type: input.type ?? "expense",
        color: input.color ?? null,
        icon: input.icon ?? null,
      },
    });
    return toCategoryDomain(row);
  }

  async update(id: string, input: UpdateCategoryInput) {
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

  async delete(id: string) {
    await this.db.category.delete({ where: { id } });
  }
}
