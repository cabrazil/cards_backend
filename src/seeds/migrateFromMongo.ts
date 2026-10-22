import { MongoClient, ObjectId } from 'mongodb'
import prisma from '../lib/prisma'
import { Segment, CardStatus } from '@prisma/client'

const MONGO_URL = 'mongodb+srv://cabrazil:Almada292@cluster0.xaenzhb.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0'

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

export async function migrateFromMongo() {
  console.log('🔌 Conectando ao MongoDB antigo...')
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db('test')
    console.log('   ✅ Conectado com sucesso ao MongoDB!')

    // 1. Mapas para correspondência de IDs (Mongo ObjectId -> Postgres Int)
    const issuerIdMap: Record<string, number> = {}
    const brandIdMap: Record<string, number> = {}
    const cardIdMap: Record<string, number> = {}

    // Limpar tabelas filhas para evitar duplicatas ao rodar o script
    console.log('🧹 Limpando tabelas de relacionamento do Postgres...')
    await prisma.cardWallet.deleteMany({})
    await prisma.zeroFee.deleteMany({})
    await prisma.reward.deleteMany({})
    await prisma.lounge.deleteMany({})
    await prisma.mileage.deleteMany({})
    await prisma.exclusive.deleteMany({})
    await prisma.requirement.deleteMany({})
    await prisma.cashback.deleteMany({})

    // ==========================================
    // 2. MIGRAR ISSUERS (Instituições)
    // ==========================================
    console.log('🏦 Migrando Issuers...')
    const mongoIssuers = await db.collection('issuers').find({}).toArray()
    console.log(`   Encontrados ${mongoIssuers.length} issuers no MongoDB.`)

    for (const mIssuer of mongoIssuers) {
      const name = mIssuer.issuer_name || 'Desconhecido'
      const type = mIssuer.issuer_type || 'OUTRO'

      // Upsert no Postgres
      const pIssuer = await prisma.issuer.upsert({
        where: { name },
        update: {},
        create: {
          name,
          type: 'OUTRO', // Mapeado padrão, pode ser refinado
        },
      })
      
      issuerIdMap[mIssuer._id.toString()] = pIssuer.id
    }

    // ==========================================
    // 3. MIGRAR BRANDS (Bandeiras)
    // ==========================================
    console.log('🏷️  Migrando Brands...')
    const mongoBrands = await db.collection('brands').find({}).toArray()
    console.log(`   Encontradas ${mongoBrands.length} brands no MongoDB.`)

    for (const mBrand of mongoBrands) {
      const name = mBrand.brand_name || 'Visa'
      const variant = mBrand.variant_name || 'Infinite'

      const pBrand = await prisma.brand.upsert({
        where: {
          name_variant: { name, variant }
        },
        update: {},
        create: {
          name,
          variant,
          benefits: mBrand.general_benefits || [],
          isActive: mBrand.isActive ?? true,
          siteUrl: mBrand.site_info || null,
        }
      })

      brandIdMap[mBrand._id.toString()] = pBrand.id
    }

    // ==========================================
    // 4. MIGRAR CARDS (Cartões)
    // ==========================================
    console.log('💳 Migrando Cards...')
    const mongoCards = await db.collection('cards').find({}).toArray()
    console.log(`   Encontrados ${mongoCards.length} cards no MongoDB.`)

    for (const mCard of mongoCards) {
      const cardName = mCard.card_name || 'Cartão Sem Nome'
      const slug = slugify(cardName)

      // Resolver ID do Issuer
      let pIssuerId: number | undefined
      if (mCard.issuerId) {
        pIssuerId = issuerIdMap[mCard.issuerId.toString()]
      }
      // Se não achou mapeado, busca pelo nome
      if (!pIssuerId && mCard.issuer_name) {
        const found = await prisma.issuer.findUnique({ where: { name: mCard.issuer_name } })
        pIssuerId = found?.id
      }
      // Fallback
      if (!pIssuerId) {
        const defaultIssuer = await prisma.issuer.upsert({
          where: { name: mCard.issuer_name || 'Outros' },
          update: {},
          create: { name: mCard.issuer_name || 'Outros', type: 'OUTRO' },
        })
        pIssuerId = defaultIssuer.id
      }

      // Resolver ID da Brand
      let pBrandId: number | undefined
      if (mCard.brandId) {
        pBrandId = brandIdMap[mCard.brandId.toString()]
      }
      if (!pBrandId && mCard.card_brand) {
        const found = await prisma.brand.findFirst({
          where: { name: { equals: mCard.card_brand, mode: 'insensitive' } }
        })
        pBrandId = found?.id
      }
      if (!pBrandId) {
        const defaultBrand = await prisma.brand.upsert({
          where: { name_variant: { name: mCard.card_brand || 'Visa', variant: mCard.category || 'Infinite' } },
          update: {},
          create: { name: mCard.card_brand || 'Visa', variant: mCard.category || 'Infinite', benefits: [] },
        })
        pBrandId = defaultBrand.id
      }

      // Segmento Enum mapping
      let segment: Segment = Segment.ENTRADA
      if (mCard.segment === 'ALTARENDA' || mCard.segment === 'ALTA_RENDA') {
        segment = Segment.ALTA_RENDA
      } else if (mCard.segment === 'INTERMEDIARIO') {
        segment = Segment.INTERMEDIARIO
      }

      // Criar/atualizar Card no Postgres
      const pCard = await prisma.card.upsert({
        where: { slug },
        update: {
          name: cardName,
          status: CardStatus.ACTIVE,
          segment,
          annualFee: mCard.annual_fee || 0,
          category: mCard.category || 'Classic',
          cardMaterial: mCard.card_material || null,
          contactless: mCard.contactless ?? true,
          isInternational: mCard.international_card ?? true,
          hasVirtualCards: mCard.virtual_cards ?? true,
          isDebit: mCard.is_debit ?? false,
          cardModality: mCard.card_modality || null,
          pictureUrl: mCard.src_card_picture || null,
          spreadOn: mCard.spread_on || null,
          spreadRate: mCard.spread_rate || 0,
          iofRate: mCard.iof_rate || 0,
          pointsExpire: mCard.points_expire ?? false,
          pointsAccelerator: mCard.points_accelerator ?? false,
          expenseCode: mCard.expense_code || 0,
          rankPoints: mCard.ranking_points || 0,
          rankBenefits: mCard.ranking_benefits || 0,
          rankAnnuity: mCard.ranking_annuity || 0,
          rankMilesProgram: mCard.ranking_miles_program || 0,
          rankVipLounges: mCard.ranking_vip_lounges || 0,
          vipLoungeApp: mCard.vip_lounge_app || null,
          obsSystemPoints: mCard.obs_system_points || [],
          obsSummary: mCard.obs_summary || [],
          additionalInfo: mCard.additional_info || [],
          issuerId: pIssuerId,
          brandId: pBrandId,
        },
        create: {
          name: cardName,
          slug,
          status: CardStatus.ACTIVE,
          segment,
          annualFee: mCard.annual_fee || 0,
          category: mCard.category || 'Classic',
          cardMaterial: mCard.card_material || null,
          contactless: mCard.contactless ?? true,
          isInternational: mCard.international_card ?? true,
          hasVirtualCards: mCard.virtual_cards ?? true,
          isDebit: mCard.is_debit ?? false,
          cardModality: mCard.card_modality || null,
          pictureUrl: mCard.src_card_picture || null,
          spreadOn: mCard.spread_on || null,
          spreadRate: mCard.spread_rate || 0,
          iofRate: mCard.iof_rate || 0,
          pointsExpire: mCard.points_expire ?? false,
          pointsAccelerator: mCard.points_accelerator ?? false,
          expenseCode: mCard.expense_code || 0,
          rankPoints: mCard.ranking_points || 0,
          rankBenefits: mCard.ranking_benefits || 0,
          rankAnnuity: mCard.ranking_annuity || 0,
          rankMilesProgram: mCard.ranking_miles_program || 0,
          rankVipLounges: mCard.ranking_vip_lounges || 0,
          vipLoungeApp: mCard.vip_lounge_app || null,
          obsSystemPoints: mCard.obs_system_points || [],
          obsSummary: mCard.obs_summary || [],
          additionalInfo: mCard.additional_info || [],
          issuerId: pIssuerId,
          brandId: pBrandId,
        },
      })

      cardIdMap[mCard._id.toString()] = pCard.id

      // Mapear carteiras virtuais
      if (Array.isArray(mCard.virtual_wallets)) {
        for (const wName of mCard.virtual_wallets) {
          const wallet = await prisma.wallet.findUnique({ where: { name: wName } })
          if (wallet) {
            await prisma.cardWallet.upsert({
              where: { cardId_walletId: { cardId: pCard.id, walletId: wallet.id } },
              update: {},
              create: { cardId: pCard.id, walletId: wallet.id },
            })
          }
        }
      }
    }

    // ==========================================
    // 5. MIGRAR RELACIONAMENTOS DOS CARTÕES
    // ==========================================
    
    // A: ZeroFees (Isenção de anuidade)
    console.log('💸 Migrando ZeroFees...')
    const mongoZeroFees = await db.collection('zerofees').find({}).toArray()
    for (const mZF of mongoZeroFees) {
      if (!mZF.CardId) continue
      const pCardId = cardIdMap[mZF.CardId.toString()]
      if (!pCardId) continue

      await prisma.zeroFee.create({
        data: {
          expenses: mZF.expenses || '',
          investments: mZF.investments || '',
          feeDiscount: mZF.fee_discount || 100,
          notes: mZF.notes || '',
          conditions: mZF.get_conditions || [],
          tips: mZF.fee_tips || [],
          cardId: pCardId,
        }
      })
    }

    // B: Rewards (Pontuação)
    console.log('🏆 Migrando Rewards...')
    const mongoRewards = await db.collection('rewards').find({}).toArray()
    for (const mRW of mongoRewards) {
      const cardRef = mRW.cardId || mRW.CardId
      if (!cardRef) continue
      const pCardId = cardIdMap[cardRef.toString()]
      if (!pCardId) continue

      await prisma.reward.create({
        data: {
          expenses: mRW.expenses || 'Compras',
          pointsPerDollar: mRW.points_per_dollar || 0,
          pointsPerReal: mRW.points_per_real || 0,
          rules: mRW.rules || '',
          pointsLimit: mRW.points_limit || 0,
          expiration: mRW.expiration ?? false,
          notes: mRW.notes || '',
          tips: mRW.reward_tips || [],
          cardId: pCardId,
        }
      })
    }

    // C: Lounges (Salas VIP)
    console.log('✈️  Migrando Lounges...')
    const mongoLounges = await db.collection('lounges').find({}).toArray()
    for (const mLg of mongoLounges) {
      const cardRef = mLg.cardId || mLg.CardId
      if (!cardRef) continue
      const pCardId = cardIdMap[cardRef.toString()]
      if (!pCardId) continue

      await prisma.lounge.create({
        data: {
          name: mLg.lounge_name || 'Sala VIP',
          brAirports: mLg.br_airport || [],
          intAirport: mLg.int_airport || null,
          accessLimit: mLg.access_limit?.toString() || 'Consulte',
          conditions: mLg.conditions || '',
          isPaid: mLg.ispaid ?? false,
          tips: mLg.vip_tips || [],
          cardId: pCardId,
        }
      })
    }

    // D: Mileages (Programas de milhas)
    console.log('🛫 Migrando Mileages...')
    const mongoMileages = await db.collection('mileages').find({}).toArray()
    for (const mMil of mongoMileages) {
      const cardRef = mMil.cardId || mMil.CardId
      if (!cardRef) continue
      const pCardId = cardIdMap[cardRef.toString()]
      if (!pCardId) continue

      await prisma.mileage.create({
        data: {
          programName: mMil.program_name || 'Programa de Milhas',
          transferPrograms: mMil.transfer_program || [],
          airlines: mMil.airlines || [],
          hotels: mMil.hotels || [],
          ratePointsMiles: mMil.rate_points_miles || 1,
          minTransfer: mMil.min_transfer || 0,
          exchangeStores: mMil.exchange_store || [],
          payBills: mMil.pay_bills ?? false,
          payCashback: mMil.pay_cashback ?? false,
          otherOptions: mMil.other_options || [],
          tips: mMil.mile_tips || [],
          cardId: pCardId,
        }
      })
    }

    // E: Exclusives
    console.log('💎 Migrando Exclusives...')
    const mongoExclusives = await db.collection('exclusives').find({}).toArray()
    for (const mExc of mongoExclusives) {
      const cardRef = mExc.cardId || mExc.CardId
      if (!cardRef) continue
      const pCardId = cardIdMap[cardRef.toString()]
      if (!pCardId) continue

      const exists = await prisma.exclusive.findUnique({ where: { cardId: pCardId } })
      if (exists) {
        // Se já existe, apenas mesclamos as listas de ofertas
        await prisma.exclusive.update({
          where: { cardId: pCardId },
          data: {
            exclusiveOffers: {
              set: Array.from(new Set([...(exists.exclusiveOffers || []), ...(mExc.exclusive_offers || [])]))
            },
            additionalInfo: {
              set: Array.from(new Set([...(exists.additionalInfo || []), ...(mExc.additional_info || [])]))
            }
          }
        })
      } else {
        await prisma.exclusive.create({
          data: {
            tagName: mExc.tag_name || '',
            tagAmount: mExc.tag_amount || 0,
            exclusiveOffers: mExc.exclusive_offers || [],
            additionalInfo: mExc.additional_info || [],
            cardId: pCardId,
          }
        })
      }
    }

    // F: Requirements
    console.log('📋 Migrando Requirements...')
    const mongoRequirements = await db.collection('requirements').find({}).toArray()
    for (const mReq of mongoRequirements) {
      const cardRef = mReq.cardId || mReq.CardId
      if (!cardRef) continue
      const pCardId = cardIdMap[cardRef.toString()]
      if (!pCardId) continue

      const exists = await prisma.requirement.findUnique({ where: { cardId: pCardId } })
      if (exists) {
        // Se já existe, mesclamos as regras e notas
        await prisma.requirement.update({
          where: { cardId: pCardId },
          data: {
            conditions: {
              set: Array.from(new Set([...(exists.conditions || []), ...(mReq.get_conditions || [])]))
            },
            notes: {
              set: Array.from(new Set([...(exists.notes || []), ...(mReq.notes || [])]))
            },
            tips: {
              set: Array.from(new Set([...(exists.tips || []), ...(mReq.req_tips || [])]))
            }
          }
        })
      } else {
        await prisma.requirement.create({
          data: {
            accountHolder: mReq.account_holder ?? true,
            addCardsAmount: mReq.add_cards_amount || 0,
            obsAddCards: mReq.obs_add_cards || '',
            addCardsCharge: mReq.add_cards_charge || 0,
            cardLimit: mReq.card_limit || '',
            conditions: mReq.get_conditions || [],
            notes: mReq.notes || [],
            tips: mReq.req_tips || [],
            cardId: pCardId,
          }
        })
      }
    }

    // G: Cashbacks
    console.log('💵 Migrando Cashbacks...')
    const mongoCashbacks = await db.collection('cashbacks').find({}).toArray()
    for (const mCash of mongoCashbacks) {
      const cardRef = mCash.cardId || mCash.CardId
      if (!cardRef) continue
      const pCardId = cardIdMap[cardRef.toString()]
      if (!pCardId) continue

      await prisma.cashback.create({
        data: {
          percentage: mCash.pct_cashback || 0,
          description: mCash.txt_cashback || '',
          notes: mCash.obs_cashback || [],
          tips: mCash.cash_tips || [],
          cardId: pCardId,
        }
      })
    }

    console.log('✨ Migração concluída com sucesso no PostgreSQL!')

  } catch (e) {
    console.error('❌ Erro na migração:', e)
  } finally {
    await client.close()
    await prisma.$disconnect()
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateFromMongo()
}
