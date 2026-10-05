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
  ingredients: Ingredient[]
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
  type: 'cocktail',
  ingredients: [{ name: '', amount: 1, unit: 'oz', type: 'spirit' }],
}
export const drinkTypes = ['cocktail', 'mixed drink', 'beer', 'wine', 'other']
