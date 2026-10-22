import prisma from '../lib/prisma'

const walletNames = [
  'Google Pay',
  'Samsung Pay',
  'Apple Pay',
  'PayPal',
  'Garmin Pay',
]

const tagData = [
  { slug: 'sem-anuidade', label: 'Sem anuidade' },
  { slug: 'anuidade-zero-condicional', label: 'Anuidade zero condicional' },
  { slug: 'aceita-negativados', label: 'Aceita negativados' },
  { slug: 'aceita-score-baixo', label: 'Aceita score baixo' },
  { slug: 'para-universitarios', label: 'Para universitários' },
  { slug: 'para-mei', label: 'Para MEI' },
  { slug: 'para-autonomos', label: 'Para autônomos' },
  { slug: 'para-aposentados', label: 'Para aposentados' },
  { slug: 'primeira-vez', label: 'Primeiro cartão' },
  { slug: 'alto-cashback', label: 'Alto cashback' },
  { slug: 'melhor-milhas', label: 'Melhor para milhas' },
  { slug: 'sala-vip', label: 'Acesso a sala VIP' },
  { slug: 'cartao-metal', label: 'Cartão em metal' },
  { slug: 'sem-comprovacao-renda', label: 'Sem comprovação de renda' },
]

export async function seedWallets() {
  console.log('📱 Seeding wallets...')

  for (const name of walletNames) {
    await prisma.wallet.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  const count = await prisma.wallet.count()
  console.log(`   ✅ ${count} wallets criadas`)
}

export async function seedTags() {
  console.log('🏷️  Seeding tags...')

  for (const tag of tagData) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { label: tag.label },
      create: tag,
    })
  }

  const count = await prisma.tag.count()
  console.log(`   ✅ ${count} tags criadas`)
}
