export default defineNuxtConfig({
  compatibilityDate: '2026-09-25',
  ssr: true,
  modules: ['@pinia/nuxt'],
  typescript: { strict: true },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
  runtimeConfig: {
    contentfulSpaceId: '',
    contentfulDeliveryToken: '',
    contentfulEnvironment: 'master',
    public: {
      graphqlEndpoint: 'https://api.escuelajs.co/graphql',
    },
  },
})
