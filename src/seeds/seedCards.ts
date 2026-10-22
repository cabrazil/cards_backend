import fs from 'fs'
import path from 'path'
import prisma from '../lib/prisma'
import { Segment } from '@prisma/client'

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
}

export async function seedCards() {
  console.log('💳 Seeding cards...')

  // Carregar dados de credit_card.json
  const creditCardJsonPath = path.resolve(__dirname, '../../../credit_card.json')
  if (!fs.existsSync(creditCardJsonPath)) {
    console.log('   ⚠️ credit_card.json não encontrado')
    return
  }

  const rawData = fs.readFileSync(creditCardJsonPath, 'utf-8')
  const cardsData = JSON.parse(rawData)

  for (const cardItem of cardsData) {
    const cardName = cardItem.card_name
    const slug = slugify(cardName)

    // Encontrar ou criar Issuer
    let issuer = await prisma.issuer.findFirst({
      where: { name: { equals: cardItem.issuer, mode: 'insensitive' } },
    })

    if (!issuer) {
      issuer = await prisma.issuer.create({
        data: { name: cardItem.issuer, type: 'OUTRO' },
      })
    }

    // Encontrar ou criar Brand
    const brandName = cardItem.card_brand || 'Visa'
    const variantName = cardItem.additional_info?.card_level || cardItem.category || 'Infinite'

    let brand = await prisma.brand.findFirst({
      where: {
        name: { equals: brandName, mode: 'insensitive' },
        variant: { equals: variantName, mode: 'insensitive' },
      },
    })

    if (!brand) {
      brand = await prisma.brand.findFirst({
        where: { name: { equals: brandName, mode: 'insensitive' } },
      })
    }

    if (!brand) {
      brand = await prisma.brand.create({
        data: { name: brandName, variant: variantName, benefits: [] },
      })
    }

    // Mapeamento de segmento
    let segment: Segment = Segment.ENTRADA
    if (cardItem.ranking_points >= 14) {
      segment = Segment.ALTA_RENDA
    } else if (cardItem.ranking_points >= 10) {
      segment = Segment.INTERMEDIARIO
    }

    // Upsert do Cartão
    const card = await prisma.card.upsert({
      where: { slug },
      update: {
        name: cardName,
        annualFee: cardItem.annual_fee || 0,
        segment,
        category: variantName,
        rankPoints: cardItem.ranking_points || 0,
        rankBenefits: cardItem.ranking_benefits || 0,
        issuerId: issuer.id,
        brandId: brand.id,
      },
      create: {
        name: cardName,
        slug,
        annualFee: cardItem.annual_fee || 0,
        segment,
        category: variantName,
        rankPoints: cardItem.ranking_points || 0,
        rankBenefits: cardItem.ranking_benefits || 0,
        issuerId: issuer.id,
        brandId: brand.id,
        contactless: true,
        isInternational: true,
        hasVirtualCards: true,
      },
    })

    // Seeding de Wallets associadas
    if (Array.isArray(cardItem.virtual_wallets)) {
      for (const wName of cardItem.virtual_wallets) {
        const wallet = await prisma.wallet.findUnique({ where: { name: wName } })
        if (wallet) {
          await prisma.cardWallet.upsert({
            where: {
              cardId_walletId: { cardId: card.id, walletId: wallet.id },
            },
            update: {},
            create: { cardId: card.id, walletId: wallet.id },
          })
        }
      }
    }

    // Seeding de ZeroFee
    if (cardItem.zero_annual_fee?.conditions) {
      await prisma.zeroFee.deleteMany({ where: { cardId: card.id } })
      for (const cond of cardItem.zero_annual_fee.conditions) {
        if (cond.expenses || cond.investments) {
          await prisma.zeroFee.create({
            data: {
              expenses: cond.expenses || '',
              investments: cond.investments || '',
              feeDiscount: cond.fee_discount || 100,
              cardId: card.id,
            },
          })
        }
      }
    }

    // Seeding de Rewards
    if (cardItem.rewards?.types) {
      await prisma.reward.deleteMany({ where: { cardId: card.id } })
      for (const rw of cardItem.rewards.types) {
        await prisma.reward.create({
          data: {
            expenses: rw.expenses || 'Compras Nacionais',
            pointsPerDollar: rw.points_per_dollar || 0,
            pointsPerReal: rw.points_per_real || 0,
            rules: Array.isArray(rw.rules) ? rw.rules.join('; ') : rw.rules || '',
            pointsLimit: rw.cap_on_points || 0,
            expiration: rw.expiration !== 'nunca',
            cardId: card.id,
          },
        })
      }
    }

    // Seeding de Lounges
    if (cardItem.lounge_access?.vip_lounges) {
      await prisma.lounge.deleteMany({ where: { cardId: card.id } })
      for (const lg of cardItem.lounge_access.vip_lounges) {
        if (lg.lounge_name) {
          await prisma.lounge.create({
            data: {
              name: lg.lounge_name,
              brAirports: Array.isArray(lg.airport) ? lg.airport : [lg.airport || ''],
              accessLimit: lg.access_limit || 'Ilimitado',
              cardId: card.id,
            },
          })
        }
      }
    }

    // Seeding de Mileages
    if (cardItem.mileage_programs) {
      await prisma.mileage.deleteMany({ where: { cardId: card.id } })
      for (const mp of cardItem.mileage_programs) {
        if (mp.program_name || mp.airlines?.length) {
          await prisma.mileage.create({
            data: {
              programName: mp.program_name || 'Programa de Milhas',
              airlines: Array.isArray(mp.airlines) ? mp.airlines : [mp.airlines || ''],
              hotels: Array.isArray(mp.hotels) ? mp.hotels : [mp.hotels || ''],
              ratePointsMiles: mp.transfer_rate?.points_to_miles || 1,
              minTransfer: mp.transfer_rate?.min_transfer || 0,
              payBills: mp.exchange?.pay_bills || false,
              cardId: card.id,
            },
          })
        }
      }
    }
  }

  const count = await prisma.card.count()
  console.log(`   ✅ ${count} cartões cadastrados e vinculados`)
}
