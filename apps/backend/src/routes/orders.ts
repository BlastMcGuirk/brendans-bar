import express from 'express';
import { CreateOrderSchema, UpdateOrderStatusSchema } from '@brendans-bar/shared';
import { db } from '../lib/db.js';
import type { Server } from 'socket.io';

const router = express.Router();

router.get('/orders', async (_req, res) => {
  try {
    const orders = await db.order.findMany({
      where: { status: 'pending' },
      orderBy: { id: 'asc' },
      include: {
        items: {
          include: {
            drink: { include: { ingredients: true } },
          },
        },
      },
    });

    return res.status(200).json(orders);
  } catch (error) {
    console.error('Failed to fetch active orders:', error);
    return res.status(500).json({ error: 'Internal server error fetching active orders.' });
  }
});

router.post('/orders', async (req, res) => {
  try {
    // 1. Validate the incoming body against our shared Zod schema
    const validation = CreateOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.flatten() });
    }

    const { guestName, note, items } = validation.data;

    const availableDrinks = await db.drink.findMany({
      where: { id: { in: items.map((item) => item.drinkId) }, active: true },
      select: { id: true },
    });
    if (availableDrinks.length !== new Set(items.map((item) => item.drinkId)).size) {
      return res.status(400).json({ error: 'One or more selected drinks are unavailable.' });
    }

    // 2. Perform an atomic database transaction to save the order
    // (This guarantees the order and its items are saved together cleanly)
    const newOrder = await db.$transaction(async (tx) => {
      // Create the parent order ticket
      const order = await tx.order.create({
        data: {
          guestName,
          note: note || null,
          status: 'pending',
        },
      });

      // Create all corresponding drink line items mapping to this order
      await tx.orderItem.createMany({
        data: items.map((item) => ({
          orderId: order.id,
          drinkId: item.drinkId,
          quantity: item.quantity,
        })),
      });

      // Fetch the full order tree with complete drink details to send to the dashboard
      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              drink: true, // Includes drink names, garnishes, glass types, etc.
            },
          },
        },
      });
    });

    // 3. Retrieve our active Socket.io instance from the Express app container
    const io: Server = req.app.get('io');

    // 4. Broadcast the complete order payload to the live dashboard instantly
    io.emit('new-order', newOrder);

    // 5. Respond back to the ordering customer
    return res.status(201).json({ 
      success: true, 
      message: 'Order sent to the bar!', 
      orderId: newOrder?.id 
    });

  } catch (error) {
    console.error('Failed to process bar order:', error);
    return res.status(500).json({ error: 'Internal server error processing your order.' });
  }
});

// PATCH /api/orders/:id
router.patch('/orders/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }

    // 1. Validate the status updates coming from the client
    const validation = UpdateOrderStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.flatten() });
    }

    const { status } = validation.data;

    // 2. Update the record in PostgreSQL
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: {
          include: {
            drink: true,
          },
        },
      },
    });

    // 3. Fetch the Socket.io instance from the Express app container
    const io: Server = req.app.get('io');

    // 4. Broadcast the status change to all open dashboards in real-time
    io.emit('order-status-updated', {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
    });

    // 5. Respond back to the dashboard that triggered the request
    return res.status(200).json({
      success: true,
      message: `Order #${orderId} marked as ${status}.`,
      order: updatedOrder,
    });

  } catch (error) {
    console.error('Failed to update order status:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found.' });
    }
    // Handle Prisma specific code for "Record to update not found"
    return res.status(500).json({ error: 'Internal server error updating order status.' });
  }
});

export default router;
