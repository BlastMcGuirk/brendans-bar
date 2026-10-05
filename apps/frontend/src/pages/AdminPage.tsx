import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { request } from '../api'
import PageFrame from '../components/PageFrame'
import { emptyDrink, drinkTypes } from '../types'
import type { Drink, DrinkForm, Ingredient } from '../types'

function AdminPage() {
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [form, setForm] = useState<DrinkForm>(emptyDrink)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showInactive, setShowInactive] = useState(true)

  const fetchDrinks = useCallback(() => request<Drink[]>('/drinks?includeInactive=true'), [])

  const loadDrinks = useCallback(async () => {
    try {
      setDrinks(await fetchDrinks())
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load drinks.')
    } finally {
      setLoading(false)
    }
  }, [fetchDrinks])

  useEffect(() => {
    let mounted = true
    void fetchDrinks()
      .then((menu) => {
        if (mounted) {
          setDrinks(menu)
          setError('')
        }
      })
      .catch((reason: Error) => {
        if (mounted) setError(reason.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [fetchDrinks])

  const visibleDrinks = drinks.filter((drink) => showInactive || drink.active)

  function updateField<K extends keyof DrinkForm>(field: K, value: DrinkForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) => ingredientIndex === index
        ? { ...ingredient, [field]: field === 'amount' ? Number(value) : value }
        : ingredient),
    }))
  }

  function editDrink(drink: Drink) {
    setEditingId(drink.id)
    setForm({
      ...drink,
      description: drink.description ?? '',
      glass: drink.glass ?? '',
      method: drink.method ?? '',
      garnish: drink.garnish ?? '',
      notes: drink.notes ?? '',
      ingredients: drink.ingredients.length ? drink.ingredients.map(({ name, amount, unit, type }) => ({ name, amount, unit, type })) : [],
    })
    setMessage('')
  }

  function resetForm() {
    setEditingId(null)
    setForm({ ...emptyDrink, ingredients: [...emptyDrink.ingredients] })
  }

  async function saveDrink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    const payload = {
      ...form,
      ingredients: form.ingredients.filter((ingredient) => ingredient.name.trim()),
      steps: form.steps.map((step) => step.trim()).filter(Boolean),
    }
    try {
      await request(editingId ? `/drinks/${editingId}` : '/drinks', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      await loadDrinks()
      setMessage(editingId ? 'Drink updated.' : 'Drink added to the menu.')
      resetForm()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save drink.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(drink: Drink) {
    setError('')
    try {
      await request(`/drinks/${drink.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !drink.active }),
      })
      await loadDrinks()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update drink status.')
    }
  }

  async function deleteDrink(drink: Drink) {
    if (!window.confirm(`Delete “${drink.name}”? This can’t be undone.`)) return
    setError('')
    setMessage('')
    try {
      await request(`/drinks/${drink.id}`, { method: 'DELETE' })
      await loadDrinks()
      if (editingId === drink.id) resetForm()
      setMessage(`${drink.name} deleted.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete drink.')
    }
  }

  return (
    <PageFrame className="admin-page">
      <section className="dashboard-heading">
        <div>
          <p className="overline"><span className="overline-line" /> BEHIND THE BAR</p>
          <h1>The <em>backbar.</em></h1>
          <p className="dashboard-subtitle">Keep the menu looking sharp. Manage your pours here.</p>
        </div>
        <div className="order-count"><span>{drinks.length.toString().padStart(2, '0')}</span><span>IN THE BOOK</span></div>
      </section>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {message && <div className="notice notice-success" role="status">{message}</div>}
      <div className="admin-layout">
        <section className="admin-list-section">
          <div className="orders-toolbar">
            <span>THE MENU <span className="group-count">{drinks.length}</span></span>
            <label className="toggle-filter"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> SHOW INACTIVE</label>
          </div>
          {loading ? <div className="empty-state">Taking inventory…</div> : visibleDrinks.length === 0 ? <div className="empty-state">No drinks to show.</div> : (
            <div className="admin-drink-list">
              {visibleDrinks.map((drink) => (
                <article className={`admin-drink ${drink.active ? '' : 'inactive'}`} key={drink.id}>
                  <div className="admin-drink-main">
                    <span className={`status-dot ${drink.active ? 'active' : ''}`} />
                    <div><strong>{drink.name}</strong><span>{drink.type} · {drink.ingredients.map((ingredient) => ingredient.name).join(', ') || 'No ingredients'}</span></div>
                  </div>
                  <div className="admin-drink-actions">
                    <button type="button" className="text-button" onClick={() => editDrink(drink)}>EDIT</button>
                    <button type="button" className="text-button" onClick={() => void toggleActive(drink)}>{drink.active ? 'DEACTIVATE' : 'ACTIVATE'}</button>
                    <button type="button" className="text-button danger-text" onClick={() => void deleteDrink(drink)}>DELETE</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-form-section">
          <div className="admin-form-heading">
            <p className="overline">{editingId ? 'MAKE IT JUST RIGHT' : 'A NEW FAVORITE'}</p>
            <h2>{editingId ? 'Edit a drink' : 'Add a drink'}<span className="heading-period">.</span></h2>
          </div>
          <form className="drink-editor" onSubmit={saveDrink}>
            <label>DRINK NAME<input required maxLength={128} value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="e.g. The House Old Fashioned" /></label>
            <label>MENU DESCRIPTION<input value={form.description ?? ''} onChange={(event) => updateField('description', event.target.value)} placeholder="A little something about the drink" /></label>
            <div className="form-two-col">
              <label>TYPE<select value={form.type} onChange={(event) => updateField('type', event.target.value)}>{drinkTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label>GLASS<input value={form.glass ?? ''} onChange={(event) => updateField('glass', event.target.value)} placeholder="Rocks glass" /></label>
            </div>
            <div className="form-two-col">
              <label>METHOD<input value={form.method ?? ''} onChange={(event) => updateField('method', event.target.value)} placeholder="Stirred, shaken…" /></label>
              <label>GARNISH<input value={form.garnish ?? ''} onChange={(event) => updateField('garnish', event.target.value)} placeholder="Orange twist" /></label>
            </div>
            <div className="ingredient-editor-heading"><span>INGREDIENTS</span><button type="button" className="text-button" onClick={() => updateField('ingredients', [...form.ingredients, { name: '', amount: 1, unit: 'oz', type: 'other' }])}>+ ADD ONE</button></div>
            {form.ingredients.length === 0 && <p className="form-hint">No ingredients added yet.</p>}
            {form.ingredients.map((ingredient, index) => (
              <div className="ingredient-editor-row" key={index}>
                <input aria-label={`Ingredient ${index + 1} name`} required value={ingredient.name} onChange={(event) => updateIngredient(index, 'name', event.target.value)} placeholder="Ingredient" />
                <input aria-label={`Ingredient ${index + 1} amount`} type="number" min="0" step="any" value={ingredient.amount} onChange={(event) => updateIngredient(index, 'amount', event.target.value)} />
                <input aria-label={`Ingredient ${index + 1} unit`} value={ingredient.unit} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} placeholder="oz" />
                <button type="button" className="remove-ingredient" aria-label={`Remove ingredient ${index + 1}`} onClick={() => updateField('ingredients', form.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index))}>×</button>
              </div>
            ))}
            <label>BAR NOTES<textarea rows={2} value={form.notes ?? ''} onChange={(event) => updateField('notes', event.target.value)} placeholder="Anything the bartender should know" /></label>
            <label>PREPARATION STEPS<textarea rows={3} value={form.steps.join('\n')} onChange={(event) => updateField('steps', event.target.value.split('\n'))} placeholder="One step per line" /></label>
            <label className="active-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => updateField('active', event.target.checked)} /> Available on the menu</label>
            <div className="editor-actions">
              {editingId && <button type="button" className="secondary-button" onClick={resetForm}>CANCEL</button>}
              <button type="submit" className="submit-order" disabled={saving}>{saving ? 'SAVING…' : editingId ? 'SAVE CHANGES' : 'ADD TO MENU'}<span aria-hidden="true">↗</span></button>
            </div>
          </form>
        </section>
      </div>
      <div className="dashboard-back"><a className="back-link" href="/">← BACK TO THE MENU</a></div>
    </PageFrame>
  )
}

export default AdminPage
