import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

export async function issuerRoutes(app: FastifyInstance) {
  // Listar todas as instituições
  app.get('/', async () => {
    const issuers = await prisma.issuer.findMany({
      orderBy: { name: 'asc' },
    })
    return issuers
  })

  // Buscar por ID
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params
    const issuer = await prisma.issuer.findUnique({
      where: { id: Number(id) },
      include: { cards: { select: { id: true, name: true, slug: true, category: true } } },
    })

    if (!issuer) {
      reply.code(404)
      return { error: 'Issuer not found' }
    }

    return issuer
  })
}
