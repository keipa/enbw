export default defineNuxtConfig({
  compatibilityDate: '2026-09-25',
  ssr: true,
  modules: ['@pinia/nuxt'],
  typescript: { strict: true },
  css: ['~/assets/css/tokens.css', '~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://i.imgur.com', crossorigin: '' },
        { rel: 'preconnect', href: 'https://images.ctfassets.net', crossorigin: '' },
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
  nitro: {
    compressPublicAssets: { gzip: true, brotli: true },
  },
})
