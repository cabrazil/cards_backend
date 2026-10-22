# 💳 Assistente de Cartões de Crédito — Backend API

API de alta performance desenvolvida com **Fastify**, **Prisma ORM** e **PostgreSQL**, responsável pelo motor de recomendação inteligente de cartões de crédito, catálogo de produtos financeiros e extração automatizada de dados via Inteligência Artificial.

---

## 🚀 Tecnologias

- **Linguagem & Runtime:** Node.js com [TypeScript](https://www.typescriptlang.org/) & [tsx](https://github.com/privatenumber/tsx)
- **Framework Web:** [Fastify v5](https://fastify.dev/) (rápido, tipado e com baixo overhead)
- **CORS:** [@fastify/cors](https://github.com/fastify/fastify-cors)
- **ORM & Banco de Dados:** [Prisma v6](https://www.prisma.io/) com **PostgreSQL**
- **IA Generativa:** Integração com [OpenRouter](https://openrouter.ai/) para extração automatizada e estruturação de novos cartões

---

## 🧠 Principais Funcionalidades

### 1. Motor de Recomendação & Onboarding
- **Questionário Dinâmico:** Seções e perguntas flexíveis no banco de dados (`/onboarding/questions`).
- **Sistema de Pesos por Critério:** Cada opção escolhida no quiz carrega pesos em múltiplos critérios (anuidade, milhas, cashback, investimento, salas VIP, aumento de limite, etc.).
- **Algoritmo de Match:** Calcula a pontuação percentual de compatibilidade do usuário com cada cartão cadastrado (`/recommendations/simulate`).
- **Justificativas Dinâmicas:** Exibição explicativa do motivo pelo qual aquele cartão foi sugerido de acordo com o perfil informado.

### 2. Catálogo Relacional de Cartões
- **Emissores:** Bancos tradicionais, bancos digitais, cooperativas e fintechs (`/issuers`).
- **Bandeiras:** Visa, Mastercard, Elo, American Express e variantes (Infinite, Black, Platinum, etc.) (`/brands`).
- **Cartões:** Dados completos de anuidade, política de isenção, renda mínima, spread para compras internacionais, pontuação e cashback (`/cards`).

### 3. Extrator Inteligente de Cartões com IA (Admin)
- Rota administrativa (`/admin/cards/extract`) capaz de ler páginas web ou textos promocionais e extrair um schema JSON completo do cartão.
- Algoritmo de deduplicação e correspondência para evitar cartões repetidos.
- Persistência estruturada em lote com relacionamento automático de benefícios e tags (`/admin/cards/save`).

---

## 📁 Estrutura do Projeto

```text
backend_pg/
├── prisma/
│   └── schema.prisma         # Modelagem relacional completa (5 domínios)
├── src/
│   ├── lib/
│   │   └── prisma.ts         # Cliente Prisma compartilhado
│   ├── routes/
│   │   ├── adminCards.ts     # Rotas de IA e administração
│   │   ├── brands.ts         # Bandeiras
│   │   ├── cards.ts          # Consulta de cartões
│   │   ├── health.ts         # Health check
│   │   ├── issuers.ts        # Emissores e bancos
│   │   └── recommendations.ts# Onboarding e motor de recomendação
│   ├── seeds/                # Scripts de povoamento e migração de dados
│   ├── services/
│   │   ├── cardExtractor.ts  # Integração com OpenRouter e prompts de IA
│   │   └── cardPersistence.ts# Lógica de persistência e deduplicação
│   └── server.ts             # Inicialização do servidor Fastify
├── .env.example              # Modelo de variáveis de ambiente
├── package.json
└── tsconfig.json
```

---

## 🛠️ Como Executar Localmente

### Pré-requisitos
- **Node.js** (v18+)
- **PostgreSQL** (v14+)
- **npm** ou **pnpm** / **yarn**

### 1. Clonar o Repositório
```bash
git clone https://github.com/cabrazil/cards_backend.git
cd cards_backend
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Configurar as Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```
Preencha os valores:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/creditcard_db?schema=public"
PORT=3333
NODE_ENV=development
OPENROUTER_API_KEY="sua-chave-openrouter-opcional"
```

### 4. Gerar o Prisma Client e Executar as Migrações
```bash
npx prisma generate
npx prisma db push
```

*(Opcional)* Rodar as seeds iniciais:
```bash
npm run db:seed
```

### 5. Iniciar o Servidor
```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Modo produção
npm run build
npm start
```
A API estará acessível em `http://localhost:3333`.

---

## 📌 Rotas Principais

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` | Status de saúde da aplicação |
| `GET` | `/issuers` | Lista emissores/bancos cadastrados |
| `GET` | `/brands` | Lista bandeiras cadastradas |
| `GET` | `/cards` | Lista cartões ativos com filtros |
| `GET` | `/cards/:slug` | Detalhes de um cartão específico |
| `GET` | `/onboarding/questions` | Retorna o quiz dinâmico de onboarding |
| `POST` | `/recommendations/simulate`| Simula recomendações a partir de respostas do quiz |
| `POST` | `/admin/cards/extract` | Extrai dados de cartão via IA (OpenRouter) |
| `POST` | `/admin/cards/save` | Salva cartão revisado no banco de dados |

---

## 📜 Licença

Este projeto é de uso privado para a plataforma de recomendação de cartões de crédito.
