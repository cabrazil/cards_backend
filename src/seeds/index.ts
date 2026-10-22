import prisma from '../lib/prisma'
import { seedIssuers } from './seedIssuers'
import { seedBrands } from './seedBrands'
import { seedWallets, seedTags } from './seedWalletsTags'
import { seedCriteria } from './seedCriteria'
import { seedOnboarding } from './seedOnboarding'
import { seedCards } from './seedCards'
import { seedCardScores } from './seedCardScores'

async function main() {
  console.log('🚀 Iniciando populamento do banco PostgreSQL...')

  await seedIssuers()
  await seedBrands()
  await seedWallets()
  await seedTags()
  await seedCriteria()
  await seedOnboarding()
  await seedCards()
  await seedCardScores()

  console.log('✨ Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro durante a execução dos seeds:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
