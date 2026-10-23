import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { request } from '../api'
import PageFrame from '../components/PageFrame'
import type { Drink, MenuSection } from '../types'

function MenuPage() {
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [guestName, setGuestName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([request<Drink[]>('/drinks'), request<MenuSection[]>('/menu-sections')])
      .then(([menuDrinks, sections]) => {
        setDrinks(menuDrinks)
        setMenuSections(sections)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  const selectedCount = Object.values(selected).reduce((sum, quantity) => sum + quantity, 0)
  const groupedDrinks = useMemo(() => {
    const sectionsByName = new Map(menuSections.map((section) => [section.name, section]))
    const groups = new Map<string, { label: string; sortOrder: number; drinks: Drink[] }>()
    for (const drink of drinks) {
      const section = drink.menuSection?.trim()
      const key = section ? `section:${section}` : `type:${drink.type || 'Other'}`
      const label = section || drink.type || 'Other'
      const group = groups.get(key) ?? {
        label,
        sortOrder: sectionsByName.get(label)?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        drinks: [],
      }
      group.drinks.push(drink)
      groups.set(key, group)
    }
    return [...groups.entries()].sort(([, first], [, second]) =>
      first.sortOrder - second.sortOrder || first.label.localeCompare(second.label),
    )
  }, [drinks, menuSections])

  function setQuantity(drinkId: number, quantity: number) {
    setSelected((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[drinkId]
      else next[drinkId] = quantity
      return next
    })
    setMessage('')
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const result = await request<{ orderId: number }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          guestName: guestName.trim(),
          note: note.trim() || undefined,
          items: Object.entries(selected).map(([drinkId, quantity]) => ({
            drinkId: Number(drinkId),
            quantity,
          })),
        }),
      })
      setSelected({})
      setGuestName('')
      setNote('')
      setMessage(`You’re all set. Your order is at the bar (#${result.orderId}).`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageFrame className="menu-page">
      <section className="menu-hero">
        <p className="overline">DRINKS <span aria-hidden="true">·</span> COCKTAILS <span aria-hidden="true">·</span> GOOD COMPANY</p>
        <h1>Drinks <em>&amp; cocktails</em></h1>
        <span className="menu-ornament" aria-hidden="true">✳</span>
        <p className="hero-description">A few house favorites, made with care and meant to be enjoyed.</p>
      </section>

      <section className="menu-content">
        <div className="menu-heading">
          <h2>THE MENU</h2>
          <p>Choose your drinks below</p>
        </div>

        {loading ? (
          <div className="empty-state">Setting the bar…</div>
        ) : error ? (
          <div className="notice notice-error" role="alert">{error}</div>
        ) : drinks.length === 0 ? (
          <div className="empty-state">The menu is taking a breather. Check back soon.</div>
        ) : (
          <form onSubmit={submitOrder}>
            <div className="drink-groups">
              {groupedDrinks.map(([key, group]) => (
                <section className="drink-group" key={key}>
                  <div className="group-label"><span>{group.label}</span><span className="group-count">{String(group.drinks.length).padStart(2, '0')}</span></div>
                  <div className="drink-list">
                    {group.drinks.map((drink) => (
                      <article className={`drink-row ${selected[drink.id] ? 'is-selected' : ''}`} key={drink.id}>
                        <label className="drink-info" htmlFor={`drink-${drink.id}`}>
                          <span className="drink-name">{drink.name}</span>
                          {drink.description && <span className="drink-description">{drink.description}</span>}
                          <span className="drink-ingredients">
                            {drink.ingredients.map((ingredient) => ingredient.name).join(' · ') || 'Ask us what’s in it'}
                          </span>
                        </label>
                        <div className="quantity-control" aria-label={`${drink.name} quantity`}>
                          <button type="button" aria-label={`Remove one ${drink.name}`} disabled={!selected[drink.id]} onClick={() => setQuantity(drink.id, (selected[drink.id] ?? 0) - 1)}>−</button>
                          <span>{selected[drink.id] ?? 0}</span>
                          <button type="button" aria-label={`Add one ${drink.name}`} onClick={() => setQuantity(drink.id, (selected[drink.id] ?? 0) + 1)}>+</button>
                        </div>
                        <input className="visually-hidden" id={`drink-${drink.id}`} type="checkbox" checked={Boolean(selected[drink.id])} onChange={(event) => setQuantity(drink.id, event.target.checked ? 1 : 0)} />
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="order-panel">
              <div className="order-panel-copy">
                <p className="overline">READY WHEN YOU ARE</p>
                <h3>Your order</h3>
                <p>Leave your name and any notes for the bar.</p>
              </div>
              <div className="order-form-fields">
                <label htmlFor="guest-name">YOUR NAME</label>
                <input id="guest-name" autoComplete="name" maxLength={64} required value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="What should we call you?" />
                <label htmlFor="order-note">ORDER NOTE <span>(OPTIONAL)</span></label>
                <textarea id="order-note" maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything we should know?" />
                {message && <p className="notice notice-success" role="status">{message}</p>}
                {error && <p className="notice notice-error" role="alert">{error}</p>}
                <button className="submit-order" type="submit" disabled={submitting || selectedCount === 0}>
                  <span>{submitting ? 'SENDING YOUR ORDER…' : `SEND TO THE BAR${selectedCount ? ` · ${selectedCount} DRINK${selectedCount === 1 ? '' : 'S'}` : ''}`}</span>
                  <span aria-hidden="true">↗</span>
                </button>
                {selectedCount === 0 && <span className="form-hint">Choose a drink above to get started.</span>}
              </div>
            </div>
          </form>
        )}
      </section>
    </PageFrame>
  )
}

export default MenuPage
