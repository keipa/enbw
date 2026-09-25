export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  title: string
  price: number
  images: string[]
  category: Category
}

export interface ProductDetail extends Product {
  description: string
}
