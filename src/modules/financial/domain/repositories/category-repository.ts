import type { Category, CategoryType } from "../entities/category.js";

export interface CreateCategoryInput {
  name: string;
  type?: CategoryType;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: CategoryType;
  color?: string | null;
  icon?: string | null;
}

export interface CategoryRepository {
  findAll(userId: string): Promise<Category[]>;
  findById(id: string, userId: string): Promise<Category | null>;
  create(userId: string, input: CreateCategoryInput): Promise<Category>;
  update(id: string, userId: string, input: UpdateCategoryInput): Promise<Category>;
  delete(id: string, userId: string): Promise<void>;
}
