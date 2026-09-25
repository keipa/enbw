import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const client = new ApolloClient({
    link: new HttpLink({ uri: config.public.graphqlEndpoint }),
    cache: new InMemoryCache(),
    ssrMode: import.meta.server,
  })

  return {
    provide: { apollo: client },
  }
})
