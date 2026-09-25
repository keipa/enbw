import { gql } from '@apollo/client/core'
import type { Product, ProductDetail } from '~/types/product'

export const PRODUCTS_QUERY = gql`
  query Products($limit: Int!, $offset: Int!) {
    products(limit: $limit, offset: $offset) {
      id
      title
      price
      images
      category {
        id
        name
      }
    }
  }
`

export const PRODUCT_QUERY = gql`
  query Product($id: ID!) {
    product(id: $id) {
      id
      title
      price
      description
      images
      category {
        id
        name
      }
    }
  }
`

export interface ProductsQueryResult {
  products: Product[]
}

export interface ProductQueryResult {
  product: ProductDetail | null
}
