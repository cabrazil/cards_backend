import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import { Segment } from '@prisma/client'

export async function cardRoutes(app: FastifyInstance) {
  // Listar cartões com filtros
  app.get<{
    Querystring: {
      segment?: string
      issuer?: string
      status?: string
    }
  }>('/', async (request) => {
    const { segment, issuer, status } = request.query

    const cards = await prisma.card.findMany({
      where: {
        ...(segment && { segment: segment as Segment }),
        ...(issuer && { issuer: { name: issuer } }),
        ...(status ? { status: status as any } : { status: 'ACTIVE' }),
      },
      include: {
        issuer: { select: { id: true, name: true, type: true } },
        brand: { select: { id: true, name: true, variant: true } },
      },
      orderBy: [{ rankBenefits: 'desc' }, { name: 'asc' }],
    })

    return cards
  })

  // Buscar cartões por segmento (compatibilidade com frontend antigo)
  app.get<{ Params: { segment: string } }>('/segment/:segment', async (request) => {
    const { segment } = request.params

    const cards = await prisma.card.findMany({
      where: {
        segment: segment as Segment,
        status: 'ACTIVE',
      },
      include: {
        issuer: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true, variant: true } },
      },
      orderBy: { rankBenefits: 'desc' },
    })

    return cards
  })

  // Detalhes completos de um cartão
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params

    const card = await prisma.card.findUnique({
      where: { id: Number(id) },
      include: {
        issuer: true,
        brand: true,
        wallets: { include: { wallet: true } },
        tags: { include: { tag: true } },
        zeroFees: true,
        rewards: true,
        cashbacks: true,
        lounges: true,
        mileages: true,
        exclusive: true,
        requirement: true,
      },
    })

    if (!card) {
      reply.code(404)
      return { error: 'Card not found' }
    }

    return card
  })

  // Buscar por slug (para URLs amigáveis no app)
  app.get<{ Params: { slug: string } }>('/slug/:slug', async (request, reply) => {
    const { slug } = request.params

    const card = await prisma.card.findUnique({
      where: { slug },
      include: {
        issuer: true,
        brand: true,
        wallets: { include: { wallet: true } },
        tags: { include: { tag: true } },
        zeroFees: true,
        rewards: true,
        cashbacks: true,
        lounges: true,
        mileages: true,
        exclusive: true,
        requirement: true,
      },
    })

    if (!card) {
      reply.code(404)
      return { error: 'Card not found' }
    }

    return card
  })
}
