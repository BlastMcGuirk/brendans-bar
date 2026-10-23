import { useCallback, useEffect, useState } from 'react'
import type { Order } from '../types'
import { request } from '../api'
import PageFrame from '../components/PageFrame'

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetchOrders = useCallback(() => request<Order[]>('/orders'), [])

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await fetchOrders())
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load orders.')
    } finally {
      setLoading(false)
    }
  }, [fetchOrders])

  useEffect(() => {
    let mounted = true
    const refresh = () => {
      void fetchOrders()
        .then((activeOrders) => {
          if (mounted) {
            setOrders(activeOrders)
            setError('')
          }
        })
        .catch((reason: Error) => {
          if (mounted) setError(reason.message)
        })
        .finally(() => {
          if (mounted) setLoading(false)
        })
    }
    refresh()
    const timer = window.setInterval(refresh, 8000)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [fetchOrders])

  async function updateStatus(orderId: number, status: 'fulfilled' | 'cancelled') {
    setUpdatingId(orderId)
    setError('')
    try {
      await request(`/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await loadOrders()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update order.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <PageFrame className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <p className="overline"><span className="overline-line" /> THE BAR DESK</p>
          <h1>On the <em>house.</em></h1>
          <p className="dashboard-subtitle">Every order, in the order it landed. You’ve got this.</p>
        </div>
        <div className="order-count"><span>{orders.length.toString().padStart(2, '0')}</span><span>ON DECK</span></div>
      </section>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <section className="orders-section" aria-label="Active orders">
        <div className="orders-toolbar">
          <span><span className="live-dot" /> ACTIVE ORDERS</span>
          <button type="button" className="text-button" onClick={() => void loadOrders()}>REFRESH ↻</button>
        </div>
        {loading ? <div className="empty-state">Checking the tickets…</div> : orders.length === 0 ? (
          <div className="empty-state empty-orders"><span aria-hidden="true">✳</span><strong>All caught up.</strong><span>No orders waiting at the bar.</span></div>
        ) : (
          <div className="orders-list">
            {orders.map((order, index) => (
              <article className="order-card" key={order.id}>
                <div className="ticket-number"><span>TICKET</span><strong>{String(index + 1).padStart(2, '0')}</strong></div>
                <div className="ticket-body">
                  <div className="ticket-title">
                    <h2>{order.guestName}</h2>
                    <span>ORDER #{order.id}</span>
                    <time dateTime={order.createdAt}>
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </time>
                  </div>
                  <ul className="ticket-items">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        <div className="ticket-item-title">
                          <span className="ticket-quantity">{item.quantity}×</span>
                          <strong>{item.drink.name}</strong>
                        </div>
                        <div className="ticket-recipe">
                          {(item.drink.glass || item.drink.method || item.drink.garnish) && (
                            <p>{[item.drink.glass, item.drink.method, item.drink.garnish && `Garnish: ${item.drink.garnish}`].filter(Boolean).join(' · ')}</p>
                          )}
                          {item.drink.ingredients.length > 0 && (
                            <p><strong>INGREDIENTS</strong> {item.drink.ingredients.map((ingredient) => `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`).join(' · ')}</p>
                          )}
                          {item.drink.steps.length > 0 && (
                            <ol>{item.drink.steps.map((step, stepIndex) => <li key={`${item.id}-${stepIndex}`}>{step}</li>)}</ol>
                          )}
                          {item.drink.notes?.trim() && <p><strong>BAR NOTES</strong> {item.drink.notes}</p>}
                          {item.drink.ingredients.length === 0 && item.drink.steps.length === 0 && !item.drink.glass && !item.drink.method && !item.drink.garnish && !item.drink.notes && (
                            <p>Recipe details haven’t been added.</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {order.note?.trim() && <p className="ticket-note"><strong>NOTE</strong> {order.note}</p>}
                </div>
                <div className="ticket-actions">
                  <button className="complete-button" type="button" disabled={updatingId === order.id} onClick={() => void updateStatus(order.id, 'fulfilled')}><span aria-hidden="true">✓</span> COMPLETE</button>
                  <button className="cancel-button" type="button" disabled={updatingId === order.id} onClick={() => void updateStatus(order.id, 'cancelled')}>CANCEL</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="dashboard-back"><a className="back-link" href="/">← BACK TO THE MENU</a></div>
    </PageFrame>
  )
}

export default OrdersPage
