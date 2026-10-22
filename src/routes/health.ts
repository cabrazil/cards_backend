import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return {
      status: 'ok',
      message: 'Credit Card Recommendation API',
      timestamp: new Date().toISOString(),
    }
  })

  app.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ok', database: 'connected' }
    } catch {
      return { status: 'error', database: 'disconnected' }
    }
  })
}
