import prisma from '../lib/prisma'

const brands = [
  {
    name: 'Visa',
    variant: 'Infinite',
    benefits: [
      'Seguro Proteção de Preço',
      'Seguro Proteção de Compras',
      'Garantia Estendida Original',
      'Visa Concierge',
      'Visa Global Service',
      'Visa Surpreenda',
      'Ofertas Especiais Visa',
    ],
    siteUrl: 'https://www.visa.com.br/pague-com-visa/cartoes/visa-infinite.html',
  },
  {
    name: 'Visa',
    variant: 'Platinum',
    benefits: [
      'Seguro Proteção de Compras',
      'Garantia Estendida Original',
      'Visa Concierge',
      'Ofertas Especiais Visa',
    ],
    siteUrl: 'https://www.visa.com.br/pague-com-visa/cartoes/visa-platinum.html',
  },
  {
    name: 'Visa',
    variant: 'Gold',
    benefits: [
      'Seguro Proteção de Compras',
      'Visa Surpreenda',
      'Ofertas Especiais Visa',
    ],
    siteUrl: 'https://www.visa.com.br/pague-com-visa/cartoes/visa-gold.html',
  },
  {
    name: 'Mastercard',
    variant: 'Black',
    benefits: [
      'Priceless Cities',
      'Mastercard Airport Concierge',
      'Assistência Global de Emergência',
      'Mastercard Platinum Concierge',
      'Seguro de emergências médicas: Masterassist Plus',
      'Seguro de automóveis',
      'Isenção de rolha',
      'Mastercard Surpreenda',
      'Ofertas Especiais Mastercard',
    ],
    siteUrl: 'https://www.mastercard.com.br/pt-br/pessoal/encontre-um-cartao/cartoes-credito/mastercard-black.html',
  },
  {
    name: 'Mastercard',
    variant: 'Platinum',
    benefits: [
      'Priceless Cities',
      'Mastercard Surpreenda',
      'Seguro de emergências médicas',
      'Ofertas Especiais Mastercard',
    ],
    siteUrl: 'https://www.mastercard.com.br/pt-br/pessoal/encontre-um-cartao/cartoes-credito/mastercard-platinum.html',
  },
  {
    name: 'Mastercard',
    variant: 'Gold',
    benefits: [
      'Mastercard Surpreenda',
      'Ofertas Especiais Mastercard',
    ],
    siteUrl: 'https://www.mastercard.com.br/pt-br/pessoal/encontre-um-cartao/cartoes-credito/mastercard-gold.html',
  },
  {
    name: 'Elo',
    variant: 'Nanquim',
    benefits: [
      'Elo Concierge',
      'Seguro Viagem',
      'Proteção de Compras',
      'Garantia Estendida',
    ],
    siteUrl: 'https://www.elo.com.br/cartao/nanquim',
  },
  {
    name: 'Elo',
    variant: 'Grafite',
    benefits: [
      'Seguro Viagem',
      'Proteção de Compras',
    ],
    siteUrl: 'https://www.elo.com.br/cartao/grafite',
  },
  {
    name: 'American Express',
    variant: 'Centurion',
    benefits: [
      'Amex Concierge',
      'Seguro Viagem Premium',
      'Proteção de Compras',
      'Acesso ilimitado a salas VIP',
    ],
    siteUrl: 'https://www.americanexpress.com.br',
  },
  {
    name: 'Hipercard',
    variant: 'Standard',
    benefits: [
      'Ofertas Especiais Hipercard',
    ],
    siteUrl: 'https://www.hipercard.com.br',
  },
]

export async function seedBrands() {
  console.log('🏷️  Seeding brands...')

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: {
        name_variant: { name: brand.name, variant: brand.variant },
      },
      update: {
        benefits: brand.benefits,
        siteUrl: brand.siteUrl,
      },
      create: {
        name: brand.name,
        variant: brand.variant,
        benefits: brand.benefits,
        siteUrl: brand.siteUrl,
        isActive: true,
      },
    })
  }

  const count = await prisma.brand.count()
  console.log(`   ✅ ${count} brands criadas`)
}
