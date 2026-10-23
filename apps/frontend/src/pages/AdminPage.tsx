import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { request } from '../api'
import PageFrame from '../components/PageFrame'
import { emptyDrink, drinkTypes } from '../types'
import type { Drink, DrinkForm, Ingredient, MenuSection } from '../types'

function AdminPage() {
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [form, setForm] = useState<DrinkForm>(emptyDrink)
  const [newSectionName, setNewSectionName] = useState('')
  const [draggedSectionName, setDraggedSectionName] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSection, setSavingSection] = useState(false)
  const [savingSectionOrder, setSavingSectionOrder] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showInactive, setShowInactive] = useState(true)

  const fetchDrinks = useCallback(() => request<Drink[]>('/drinks?includeInactive=true'), [])
  const fetchMenuSections = useCallback(() => request<MenuSection[]>('/menu-sections'), [])

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

  const loadMenuSections = useCallback(async () => {
    try {
      setMenuSections(await fetchMenuSections())
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load menu sections.')
    }
  }, [fetchMenuSections])

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
    void fetchMenuSections()
      .then((sections) => {
        if (mounted) setMenuSections(sections)
      })
      .catch((reason: Error) => {
        if (mounted) setError(reason.message)
      })
    return () => { mounted = false }
  }, [fetchDrinks, fetchMenuSections])

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
      menuSection: drink.menuSection ?? '',
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
      menuSection: form.menuSection || null,
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

  async function createMenuSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingSection(true)
    setError('')
    setMessage('')
    try {
      await request<MenuSection>('/menu-sections', {
        method: 'POST',
        body: JSON.stringify({ name: newSectionName.trim() }),
      })
      setNewSectionName('')
      await loadMenuSections()
      setMessage('Menu section created.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create menu section.')
    } finally {
      setSavingSection(false)
    }
  }

  async function saveMenuSectionOrder(nextSections: MenuSection[]) {
    setSavingSectionOrder(true)
    setError('')
    setMessage('')
    try {
      const savedSections = await request<MenuSection[]>('/menu-sections/order', {
        method: 'PUT',
        body: JSON.stringify({ names: nextSections.map((section) => section.name) }),
      })
      setMenuSections(savedSections)
      setMessage('Menu section order updated.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update menu section order.')
    } finally {
      setSavingSectionOrder(false)
      setDraggedSectionName(null)
    }
  }

  function moveMenuSection(sourceName: string, targetName: string) {
    if (sourceName === targetName || savingSection || savingSectionOrder) return
    const sourceIndex = menuSections.findIndex((section) => section.name === sourceName)
    const targetIndex = menuSections.findIndex((section) => section.name === targetName)
    if (sourceIndex < 0 || targetIndex < 0) return

    const nextSections = [...menuSections]
    const [section] = nextSections.splice(sourceIndex, 1)
    nextSections.splice(targetIndex, 0, section)
    void saveMenuSectionOrder(nextSections)
  }

  function moveMenuSectionByOffset(sectionName: string, offset: number) {
    const index = menuSections.findIndex((section) => section.name === sectionName)
    const target = menuSections[index + offset]
    if (target) moveMenuSection(sectionName, target.name)
  }

  async function deleteMenuSection(section: MenuSection) {
    if (!window.confirm(`Delete “${section.name}”? Drinks in this section will be grouped by type.`)) return
    setError('')
    setMessage('')
    try {
      await request(`/menu-sections?name=${encodeURIComponent(section.name)}`, { method: 'DELETE' })
      await Promise.all([loadMenuSections(), loadDrinks()])
      if (form.menuSection === section.name) updateField('menuSection', '')
      setMessage(`${section.name} deleted.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete menu section.')
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
                    <div><strong>{drink.name}</strong><span>{drink.menuSection ? `${drink.menuSection} · ` : ''}{drink.type} · {drink.ingredients.map((ingredient) => ingredient.name).join(', ') || 'No ingredients'}</span></div>
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
          <section className="menu-section-manager" aria-label="Menu sections">
            <div className="ingredient-editor-heading"><span>MENU SECTIONS</span></div>
            {menuSections.length > 0 && (
              <ul className="menu-section-list">
                {menuSections.map((section, index) => (
                  <li
                    className={draggedSectionName === section.name ? 'is-dragging' : ''}
                    key={section.name}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      moveMenuSection(event.dataTransfer.getData('text/plain'), section.name)
                    }}
                  >
                    <button
                      type="button"
                      className="section-drag-handle"
                      draggable={!savingSection && !savingSectionOrder}
                      disabled={savingSection || savingSectionOrder}
                      aria-label={`Drag to reorder ${section.name}`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', section.name)
                        setDraggedSectionName(section.name)
                      }}
                      onDragEnd={() => setDraggedSectionName(null)}
                    >DRAG</button>
                    <span className="menu-section-name">{section.name}</span>
                    <div className="menu-section-actions">
                      <button type="button" className="text-button section-order-button" disabled={savingSection || savingSectionOrder || index === 0} aria-label={`Move ${section.name} up`} onClick={() => moveMenuSectionByOffset(section.name, -1)}>↑</button>
                      <button type="button" className="text-button section-order-button" disabled={savingSection || savingSectionOrder || index === menuSections.length - 1} aria-label={`Move ${section.name} down`} onClick={() => moveMenuSectionByOffset(section.name, 1)}>↓</button>
                      <button type="button" className="text-button danger-text" disabled={savingSection || savingSectionOrder} onClick={() => void deleteMenuSection(section)}>DELETE</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form className="menu-section-form" onSubmit={createMenuSection}>
              <input aria-label="New menu section name" required maxLength={64} disabled={savingSection || savingSectionOrder} value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="e.g. Classic Cocktails" />
              <button type="submit" className="text-button" disabled={savingSection || savingSectionOrder}>{savingSection ? 'ADDING…' : '+ ADD SECTION'}</button>
            </form>
          </section>
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
            <label>MENU SECTION<select value={form.menuSection ?? ''} onChange={(event) => updateField('menuSection', event.target.value)}><option value="">Use drink type</option>{menuSections.map((section) => <option key={section.name} value={section.name}>{section.name}</option>)}</select></label>
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
