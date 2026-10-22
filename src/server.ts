import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health'
import { issuerRoutes } from './routes/issuers'
import { brandRoutes } from './routes/brands'
import { cardRoutes } from './routes/cards'
import { recommendationRoutes } from './routes/recommendations'
import { adminCardRoutes } from './routes/adminCards'

const app = Fastify({
  logger: true,
  trustProxy: true,
})

// CORS — compartilhado entre Web e Mobile
app.register(cors, {
  origin: true,
  credentials: true,
})

// Rotas
app.register(healthRoutes)
app.register(issuerRoutes, { prefix: '/issuers' })
app.register(brandRoutes, { prefix: '/brands' })
app.register(cardRoutes, { prefix: '/cards' })
app.register(recommendationRoutes)
app.register(adminCardRoutes, { prefix: '/admin/cards' })

// Start
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3333
    const host = '0.0.0.0'

    await app.listen({ port, host })
    console.log(`🚀 Credit Card API running on http://${host}:${port}`)
  } catch (error) {
    console.error('Server startup failed:', error)
    process.exit(1)
  }
}

start()

export default app
