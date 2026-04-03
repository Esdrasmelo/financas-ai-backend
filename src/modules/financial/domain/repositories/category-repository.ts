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
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, input: UpdateCategoryInput): Promise<Category>;
  delete(id: string): Promise<void>;
}
