export type Ingredient = {
  id?: number
  name: string
  amount: number
  unit: string
  type: string
}

export type Drink = {
  id: number
  name: string
  description: string | null
  glass: string | null
  method: string | null
  garnish: string | null
  notes: string | null
  steps: string[]
  active: boolean
  type: string
  menuSection: string | null
  ingredients: Ingredient[]
}

export type MenuSection = {
  name: string
  sortOrder: number
}

export type Order = {
  id: number
  guestName: string
  note: string | null
  status: 'pending' | 'fulfilled' | 'cancelled'
  createdAt: string
  items: { id: number; quantity: number; drink: Drink }[]
}

export type DrinkForm = Omit<Drink, 'id' | 'ingredients'> & { ingredients: Ingredient[] }

export const emptyDrink: DrinkForm = {
  name: '',
  description: '',
  glass: '',
  method: '',
  garnish: '',
  notes: '',
  steps: [],
  active: true,
  type: 'Cocktail',
  menuSection: '',
  ingredients: [{ name: '', amount: 1, unit: 'oz', type: 'spirit' }],
}
export const drinkTypes = ['Cocktail', 'Mixed drink', 'Beer', 'Wine', 'Other']
