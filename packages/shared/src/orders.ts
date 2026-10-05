import { z } from 'zod';

// 1. Validates a single drink line item in the order
export const OrderItemInputSchema = z.object({
  drinkId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

// 2. Validates the entire incoming payload from the customer
export const CreateOrderSchema = z.object({
  guestName: z.string().min(1, "Please enter your name").max(64),
  note: z.string().trim().max(500).optional(),
  items: z.array(OrderItemInputSchema).min(1, "Please select at least one drink"),
});

export type CreateOrderDTO = z.infer<typeof CreateOrderSchema>;


export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'fulfilled', 'cancelled']),
});

export type UpdateOrderStatusDTO = z.infer<typeof UpdateOrderStatusSchema>;
