import express from 'express';
import { z } from 'zod';
import { db } from '../lib/db.js';

const router = express.Router();

const IngredientInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  amount: z.number().nonnegative(),
  unit: z.string().trim().min(1).max(64),
  type: z.string().trim().min(1).max(32),
});

const DrinkInputSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().nullable().optional(),
  glass: z.string().max(32).nullable().optional(),
  method: z.string().max(32).nullable().optional(),
  garnish: z.string().max(64).nullable().optional(),
  notes: z.string().nullable().optional(),
  steps: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  type: z.string().trim().min(1).max(32),
  menuSection: z.string().trim().min(1).max(64).nullable().optional(),
  ingredients: z.array(IngredientInputSchema).default([]),
});

const MenuSectionInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
});
const MenuSectionOrderInputSchema = z.object({
  names: z.array(z.string().trim().min(1).max(64)),
});
const ActiveInputSchema = z.object({ active: z.boolean() });
const drinkInclude = { ingredients: { orderBy: { id: 'asc' as const } } };

router.get('/menu-sections', async (_req, res) => {
  try {
    const sections = await db.menuSection.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return res.status(200).json(sections);
  } catch (error) {
    console.error('Failed to fetch menu sections:', error);
    return res.status(500).json({ error: 'Internal server error fetching menu sections.' });
  }
});

router.put('/menu-sections/order', async (req, res) => {
  const validation = MenuSectionOrderInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Invalid menu section order.', details: validation.error.flatten() });
  }

  const { names } = validation.data;
  const orderedNames = new Set(names);
  if (orderedNames.size !== names.length) {
    return res.status(400).json({ error: 'Menu section order cannot contain duplicate names.' });
  }

  try {
    const sections = await db.$transaction(async (tx) => {
      const existing = await tx.menuSection.findMany({ select: { name: true } });
      if (existing.length !== names.length || existing.some(({ name }) => !orderedNames.has(name))) return null;

      for (const [sortOrder, name] of names.entries()) {
        await tx.menuSection.update({ where: { name }, data: { sortOrder } });
      }

      return tx.menuSection.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    });
    if (!sections) {
      return res.status(400).json({ error: 'Menu section order must include every existing section exactly once.' });
    }
    return res.status(200).json(sections);
  } catch (error) {
    console.error('Failed to update menu section order:', error);
    return res.status(500).json({ error: 'Internal server error updating menu section order.' });
  }
});

router.post('/menu-sections', async (req, res) => {
  const validation = MenuSectionInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Invalid menu section name.', details: validation.error.flatten() });
  }

  try {
    const section = await db.$transaction(async (tx) => {
      const latest = await tx.menuSection.aggregate({ _max: { sortOrder: true } });
      return tx.menuSection.create({
        data: { ...validation.data, sortOrder: (latest._max.sortOrder ?? -1) + 1 },
      });
    });
    return res.status(201).json(section);
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      return res.status(409).json({ error: 'A menu section with that name already exists.' });
    }
    console.error('Failed to create menu section:', error);
    return res.status(500).json({ error: 'Internal server error creating menu section.' });
  }
});

router.delete('/menu-sections', async (req, res) => {
  const validation = MenuSectionInputSchema.safeParse({ name: req.query.name });
  if (!validation.success) {
    return res.status(400).json({ error: 'Invalid menu section name.', details: validation.error.flatten() });
  }

  try {
    await db.menuSection.delete({ where: { name: validation.data.name } });
    return res.status(200).json({ success: true });
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) {
      return res.status(404).json({ error: 'Menu section not found.' });
    }
    console.error('Failed to delete menu section:', error);
    return res.status(500).json({ error: 'Internal server error deleting menu section.' });
  }
});

function drinkData(data: z.infer<typeof DrinkInputSchema>) {
  const { ingredients, ...drink } = data;
  return {
    drink,
    ingredients: ingredients.map((ingredient) => ({ ...ingredient })),
  };
}

router.get('/drinks', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const drinks = await db.drink.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: drinkInclude,
    });
    return res.status(200).json(drinks);
  } catch (error) {
    console.error('Failed to fetch drinks:', error);
    return res.status(500).json({ error: 'Internal server error fetching drinks.' });
  }
});

router.post('/drinks', async (req, res) => {
  const validation = DrinkInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Invalid drink details.', details: validation.error.flatten() });
  }

  try {
    if (validation.data.menuSection) {
      const section = await db.menuSection.findUnique({ where: { name: validation.data.menuSection } });
      if (!section) return res.status(400).json({ error: 'Selected menu section does not exist.' });
    }
    const { drink, ingredients } = drinkData(validation.data);
    const created = await db.drink.create({
      data: {
        ...drink,
        ingredients: { create: ingredients },
      },
      include: drinkInclude,
    });
    return res.status(201).json(created);
  } catch (error) {
    if (isPrismaCode(error, 'P2003')) {
      return res.status(400).json({ error: 'Selected menu section does not exist.' });
    }
    console.error('Failed to create drink:', error);
    return res.status(500).json({ error: 'Internal server error creating drink.' });
  }
});

router.put('/drinks/:id', async (req, res) => {
  const drinkId = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(drinkId) || drinkId <= 0) {
    return res.status(400).json({ error: 'Invalid drink ID format.' });
  }

  const validation = DrinkInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Invalid drink details.', details: validation.error.flatten() });
  }

  try {
    if (validation.data.menuSection) {
      const section = await db.menuSection.findUnique({ where: { name: validation.data.menuSection } });
      if (!section) return res.status(400).json({ error: 'Selected menu section does not exist.' });
    }
    const { drink, ingredients } = drinkData(validation.data);
    const updated = await db.$transaction(async (tx) => {
      await tx.ingredient.deleteMany({ where: { drinkId } });
      return tx.drink.update({
        where: { id: drinkId },
        data: {
          ...drink,
          ingredients: { create: ingredients },
        },
        include: drinkInclude,
      });
    });
    return res.status(200).json(updated);
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) {
      return res.status(404).json({ error: 'Drink not found.' });
    }
    if (isPrismaCode(error, 'P2003')) {
      return res.status(400).json({ error: 'Selected menu section does not exist.' });
    }
    console.error('Failed to update drink:', error);
    return res.status(500).json({ error: 'Internal server error updating drink.' });
  }
});

router.patch('/drinks/:id/active', async (req, res) => {
  const drinkId = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(drinkId) || drinkId <= 0) {
    return res.status(400).json({ error: 'Invalid drink ID format.' });
  }

  const validation = ActiveInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Invalid active status.', details: validation.error.flatten() });
  }

  try {
    const updated = await db.drink.update({
      where: { id: drinkId },
      data: { active: validation.data.active },
      include: drinkInclude,
    });
    return res.status(200).json(updated);
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) {
      return res.status(404).json({ error: 'Drink not found.' });
    }
    console.error('Failed to update drink availability:', error);
    return res.status(500).json({ error: 'Internal server error updating drink availability.' });
  }
});

router.delete('/drinks/:id', async (req, res) => {
  const drinkId = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(drinkId) || drinkId <= 0) {
    return res.status(400).json({ error: 'Invalid drink ID format.' });
  }

  try {
    await db.drink.delete({ where: { id: drinkId } });
    return res.status(200).json({ success: true });
  } catch (error) {
    if (isPrismaCode(error, 'P2025')) {
      return res.status(404).json({ error: 'Drink not found.' });
    }
    if (isPrismaCode(error, 'P2003')) {
      return res.status(409).json({ error: 'This drink is part of an order and cannot be deleted. Deactivate it instead.' });
    }
    console.error('Failed to delete drink:', error);
    return res.status(500).json({ error: 'Internal server error deleting drink.' });
  }
});

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export default router;
