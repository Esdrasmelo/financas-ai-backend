import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import type { CategoryRepository } from "../../domain/repositories/category-repository.js";

export function makeListCategories(repo: CategoryRepository) {
  return () => repo.findAll();
}

export function makeGetCategory(repo: CategoryRepository) {
  return async (id: string) => {
    const category = await repo.findById(id);
    if (!category) throw new NotFoundError("Category", id);
    return category;
  };
}

export function makeCreateCategory(repo: CategoryRepository) {
  return (input: { name: string; type?: "expense" | "income"; color?: string | null; icon?: string | null }) =>
    repo.create(input);
}

export function makeUpdateCategory(repo: CategoryRepository) {
  return async (
    id: string,
    input: { name?: string; type?: "expense" | "income"; color?: string | null; icon?: string | null },
  ) => {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError("Category", id);
    return repo.update(id, input);
  };
}

export function makeDeleteCategory(repo: CategoryRepository) {
  return async (id: string) => {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError("Category", id);
    await repo.delete(id);
  };
}
