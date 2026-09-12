// The project's .vercel.app addresses (the production alias and every preview) serve exactly the
// same pages as gmt.guru, so crawlers are told to keep them out of the index; the canonical link in
// app.vue is only a hint, this header is not.
//
// The test names the hosts to exclude rather than the one to keep on purpose: a request arriving
// with an unexpected Host must leave the site indexable, never the other way round.
export default defineEventHandler((event) => {
  if (getRequestHost(event).endsWith('.vercel.app')) {
    setResponseHeader(event, 'X-Robots-Tag', 'noindex')
  }
})
