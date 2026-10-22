import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

export async function brandRoutes(app: FastifyInstance) {
  // Listar todas as bandeiras
  app.get('/', async () => {
    const brands = await prisma.brand.findMany({
      orderBy: [{ name: 'asc' }, { variant: 'asc' }],
    })
    return brands
  })

  // Buscar por ID
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params
    const brand = await prisma.brand.findUnique({
      where: { id: Number(id) },
      include: { cards: { select: { id: true, name: true, slug: true } } },
    })

    if (!brand) {
      reply.code(404)
      return { error: 'Brand not found' }
    }

    return brand
  })
}
