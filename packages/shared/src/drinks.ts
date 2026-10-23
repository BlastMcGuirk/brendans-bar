import { z } from 'zod';

// 1. Enforce specific types via a TypeScript / Zod Enum
export const DrinkTypeEnum = z.enum(['Cocktail', 'Mixed drink', 'Beer', 'Wine', 'Other']);
export type DrinkType = z.infer<typeof DrinkTypeEnum>;

// 2. The Complete Drink Database Record Schema
export const DrinkSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1, "Name is required").max(128, "Name is too long"),
  description: z.string().nullable().optional(),
  glass: z.string().max(32).nullable().optional(),
  method: z.string().max(32).nullable().optional(),
  garnish: z.string().max(64).nullable().optional(),
  notes: z.string().nullable().optional(),
  steps: z.array(z.string()).default([]), // Maps to TEXT[]
  active: z.boolean().default(true),
  type: z.string().min(1, "Type is required").max(32),
  menuSection: z.string().min(1).max(64).nullable().optional(),
});

// 3. The DTO used when creating or updating a drink (Database handles the ID)
export const CreateDrinkSchema = DrinkSchema.omit({ id: true });

// 4. Inferred TypeScript types exported for your Frontend and Backend
export type Drink = z.infer<typeof DrinkSchema>;
export type CreateDrinkDTO = z.infer<typeof CreateDrinkSchema>;