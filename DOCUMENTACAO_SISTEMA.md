# Documentação Completa - Sistema de Venda de Ingressos GuicheWeb

## 📋 Visão Geral

Sistema completo de venda de ingressos online com:
- Múltiplos eventos configuráveis via painel admin
- Pagamento via PIX (FreePay Brasil)
- Rastreamento de vendas (Utmify)
- Geração de ingressos em PDF com QR Code e código de barras
- Busca de pedidos por CPF/Email

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `events`
Armazena informações dos eventos.

```sql
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  opening_time TIME,
  location TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  cover_url TEXT,
  event_map_url TEXT,
  map_url TEXT,
  google_maps_embed TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  youtube_url TEXT,
  is_active BOOLEAN DEFAULT true,
  show_on_home BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
ON public.events FOR SELECT USING (true);

CREATE POLICY "Events can be managed by authenticated users"
ON public.events FOR ALL USING (true);
```

### Tabela: `ticket_types`
Tipos de ingressos por evento.

```sql
CREATE TABLE public.ticket_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  price NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  available INTEGER DEFAULT 0,
  batch TEXT,
  color TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket types are viewable by everyone"
ON public.ticket_types FOR SELECT USING (true);

CREATE POLICY "Ticket types can be managed by authenticated users"
ON public.ticket_types FOR ALL USING (true);
```

### Tabela: `orders`
Pedidos/compras realizadas.

```sql
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  event_id UUID REFERENCES public.events(id),
  customer_name TEXT NOT NULL,
  customer_cpf TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items JSONB NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders are viewable by everyone"
ON public.orders FOR SELECT USING (true);

CREATE POLICY "Orders can be inserted by anyone"
ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Orders can be updated by anyone"
ON public.orders FOR UPDATE USING (true);
```

---

## 🔐 Secrets/Variáveis de Ambiente Necessárias

Configure estas secrets no Lovable Cloud:

| Secret Name | Descrição |
|-------------|-----------|
| `FREEPAY_PUBLIC_KEY` | Chave pública da API FreePay Brasil |
| `FREEPAY_SECRET_KEY` | Chave secreta da API FreePay Brasil |
| `UTMIFY_API_KEY` | Chave da API Utmify para rastreamento |
| `ADMIN_PASSWORD` | Senha de acesso ao painel administrativo |

**Secrets automáticas (não precisa configurar):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## ⚡ Edge Functions

### 1. `admin-auth`
Autenticação do painel administrativo.

**Localização:** `supabase/functions/admin-auth/index.ts`

**Funcionalidade:**
- Valida senha do admin contra `ADMIN_PASSWORD`
- Retorna sucesso ou erro de autenticação

### 2. `admin-events`
CRUD completo de eventos e tipos de ingresso.

**Localização:** `supabase/functions/admin-events/index.ts`

**Endpoints:**
- `GET` - Lista todos eventos com seus tipos de ingresso
- `POST` - Cria novo evento
- `PUT` - Atualiza evento existente
- `DELETE` - Remove evento

### 3. `create-pix-payment`
Criação de pagamento PIX via FreePay.

**Localização:** `supabase/functions/create-pix-payment/index.ts`

**Funcionalidade:**
1. Recebe dados do cliente e itens do carrinho
2. Cria pedido no banco com status "pending"
3. Envia para Utmify com status "waiting_payment"
4. Gera cobrança PIX na FreePay
5. Retorna QR Code e código "copia e cola"

### 4. `pix-webhook`
Webhook para confirmação de pagamento.

**Localização:** `supabase/functions/pix-webhook/index.ts`

**Funcionalidade:**
1. Recebe notificação da FreePay
2. Atualiza status do pedido no banco
3. Atualiza status na Utmify (paid/refunded)

---

## 📁 Estrutura de Pastas do Frontend

```
src/
├── assets/                    # Imagens e assets
│   ├── brazil-flag.png
│   ├── event-banner.png
│   ├── event-cover.jpg
│   ├── event-map.png
│   ├── guicheweb-logo.png
│   ├── guicheweb-logo-full.png
│   └── pix-phone-illustration.png
│
├── components/
│   ├── ui/                    # Componentes Shadcn UI
│   ├── Navbar.tsx             # Barra de navegação
│   ├── NavLink.tsx            # Links de navegação
│   ├── RichTextEditor.tsx     # Editor de texto rico (Tiptap)
│   ├── SearchOrdersDialog.tsx # Modal de busca de pedidos
│   ├── TicketView.tsx         # Visualização do ingresso
│   ├── UserMenuDialog.tsx     # Menu do usuário
│   └── admin/
│       └── EventManager.tsx   # Gerenciador de eventos admin
│
├── contexts/
│   └── AuthContext.tsx        # Contexto de autenticação
│
├── hooks/
│   ├── use-mobile.tsx         # Hook para detectar mobile
│   └── use-toast.ts           # Hook de notificações
│
├── integrations/
│   └── supabase/
│       ├── client.ts          # Cliente Supabase (auto-gerado)
│       └── types.ts           # Tipos TypeScript (auto-gerado)
│
├── pages/
│   ├── Index.tsx              # Página inicial com lista de eventos
│   ├── EventPage.tsx          # Página do evento com ingressos
│   ├── Checkout.tsx           # Página de checkout/pagamento
│   ├── PaymentSuccess.tsx     # Página de sucesso do pagamento
│   ├── MeusPedidos.tsx        # Página de visualização de pedidos
│   ├── Ingressos.tsx          # Página de ingressos
│   ├── MeusDados.tsx          # Página de dados do usuário
│   ├── Login.tsx              # Página de login
│   ├── AdminLogin.tsx         # Login do painel admin
│   ├── AdminDashboard.tsx     # Dashboard administrativo
│   └── NotFound.tsx           # Página 404
│
├── lib/
│   └── utils.ts               # Utilitários gerais
│
├── App.tsx                    # Componente principal com rotas
├── App.css                    # Estilos globais
├── index.css                  # Estilos Tailwind
└── main.tsx                   # Entry point
```

---

## 🛣️ Rotas da Aplicação

| Rota | Componente | Descrição |
|------|------------|-----------|
| `/` | Index | Página inicial com eventos |
| `/:slug` | EventPage | Página do evento dinâmico |
| `/checkout` | Checkout | Checkout com pagamento PIX |
| `/pagamento-confirmado` | PaymentSuccess | Confirmação de pagamento |
| `/meus-pedidos` | MeusPedidos | Visualização de ingressos |
| `/ingressos` | Ingressos | Página de ingressos |
| `/meus-dados` | MeusDados | Dados do usuário |
| `/login` | Login | Login de usuário |
| `/gw-admin-2025` | AdminLogin | Login admin (URL secreta) |
| `/gw-admin-2025/dashboard` | AdminDashboard | Painel administrativo |

---

## 💳 Fluxo de Pagamento PIX

```
1. Usuário seleciona ingressos na página do evento
           ↓
2. Clica em "Comprar" → Redirecionado para /checkout
           ↓
3. Preenche dados pessoais (nome, CPF, email, telefone)
           ↓
4. Clica em "Gerar PIX" → Edge Function create-pix-payment
           ↓
5. Sistema cria pedido no banco (status: pending)
           ↓
6. Sistema envia para Utmify (status: waiting_payment)
           ↓
7. Sistema gera cobrança na FreePay
           ↓
8. Retorna QR Code e código "copia e cola"
           ↓
9. Usuário paga via app do banco
           ↓
10. FreePay envia webhook → Edge Function pix-webhook
           ↓
11. Sistema atualiza pedido (status: paid)
           ↓
12. Sistema atualiza Utmify (status: paid)
           ↓
13. Usuário é redirecionado para /pagamento-confirmado
           ↓
14. Usuário pode baixar ingressos em PDF
```

---

## 🎫 Estrutura do Ingresso (PDF)

Cada ingresso contém:
- **Cabeçalho:** Data de pagamento, logo GuicheWeb
- **Dados do Evento:** Nome, data, horário, local
- **Dados do Cliente:** Nome, CPF (mascarado), email
- **Tipo de Ingresso:** Setor, nome do ingresso
- **Identificadores Únicos:**
  - QR Code (transaction_id + order_id + ticket_index)
  - Código de barras
  - Número do ingresso
- **Instruções:** Avisos importantes para o portador

---

## 🔧 Configurações Importantes

### Limite de Carrinho
- Máximo de R$ 1.000,00 por compra (prevenção de fraudes)
- Usuário deve fazer múltiplas compras para valores maiores

### Mobile First
- 80% dos usuários acessam via mobile
- Design prioriza experiência mobile

### Hierarquia de Ingressos
- **Setor:** Arena, Área VIP, Premium, Frontstage
- **Tipo:** Inteira, Meia, Solidária, PCD

---

## 📦 Dependências Principais

```json
{
  "react": "^18.3.1",
  "react-router-dom": "^6.30.1",
  "@supabase/supabase-js": "^2.86.0",
  "@tanstack/react-query": "^5.83.0",
  "tailwindcss": "...",
  "shadcn/ui": "...",
  "jspdf": "^3.0.4",
  "html2canvas": "^1.4.1",
  "qrcode": "^1.5.4",
  "jsbarcode": "^3.12.1",
  "@tiptap/react": "^3.11.1",
  "sonner": "^1.7.4",
  "date-fns": "^3.6.0"
}
```

---

## 🚀 Como Configurar em Nova Conta (Passo a Passo Completo)

### Passo 1: Criar Projeto no Lovable

1. Acesse https://lovable.dev
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Dê um nome ao projeto (ex: "GuicheWeb Ingressos")
5. Aguarde o projeto ser criado

### Passo 2: Habilitar Lovable Cloud

1. No projeto criado, clique no ícone de **Cloud** (nuvem) na barra superior
2. Clique em **"Enable Cloud"** ou **"Habilitar Cloud"**
3. Aguarde a configuração (pode levar alguns segundos)
4. O Cloud cria automaticamente um banco de dados PostgreSQL

### Passo 3: Importar Código do GitHub

1. Clique no botão **GitHub** no canto superior direito
2. Clique em **"Connect to GitHub"**
3. Autorize o Lovable a acessar sua conta GitHub
4. Selecione o repositório que contém o código do GuicheWeb
5. O código será sincronizado automaticamente

**Alternativa (se não tiver GitHub):**
- Copie os arquivos manualmente para o projeto
- Use o chat do Lovable para criar cada arquivo

### Passo 4: Criar Tabelas no Banco de Dados

No chat do Lovable, peça para criar as tabelas. Cole este comando:

```
Crie as seguintes tabelas no banco de dados:

1. Tabela events com campos: id, name, slug, event_date, event_time, opening_time, location, description, banner_url, cover_url, event_map_url, map_url, google_maps_embed, instagram_url, facebook_url, youtube_url, is_active, show_on_home, created_at, updated_at

2. Tabela ticket_types com campos: id, event_id (referência para events), name, sector, price, fee, available, batch, color, description, is_active, sort_order, created_at, updated_at

3. Tabela orders com campos: id, transaction_id, event_id (referência para events), customer_name, customer_cpf, customer_email, customer_phone, items (JSONB), total_amount, status, created_at, updated_at

Habilite RLS em todas as tabelas com políticas públicas de leitura.
```

### Passo 5: Criar Bucket de Storage

No chat do Lovable, peça:

```
Crie um bucket de storage chamado "event-images" que seja público para armazenar imagens dos eventos.
```

---

## 🔑 Configuração das APIs (MUITO IMPORTANTE)

### Configurar FreePay Brasil (Pagamento PIX)

#### 1. Criar Conta na FreePay
1. Acesse https://freepaybrasil.com
2. Clique em **"Criar Conta"** ou **"Cadastre-se"**
3. Preencha os dados da sua empresa/pessoa
4. Verifique seu email
5. Complete o cadastro com documentos (CNPJ ou CPF)

#### 2. Obter Chaves da API
1. Faça login no painel da FreePay
2. Vá em **"Configurações"** ou **"Integrações"** ou **"API"**
3. Encontre suas chaves:
   - **PUBLIC_KEY** (chave pública)
   - **SECRET_KEY** (chave secreta)
4. Copie ambas as chaves

#### 3. Configurar Webhook na FreePay
1. No painel da FreePay, vá em **"Webhooks"** ou **"Notificações"**
2. Adicione a URL do webhook:
   ```
   https://urktmzyjqcsuiyizumom.supabase.co/functions/v1/pix-webhook
   ```
   **ATENÇÃO:** Substitua `urktmzyjqcsuiyizumom` pelo ID do seu novo projeto Supabase!
3. Selecione os eventos: `PAID`, `REFUNDED`, `EXPIRED`
4. Salve

#### 4. Adicionar Secrets no Lovable
1. No Lovable, clique no ícone de **Cloud**
2. Vá em **"Secrets"** ou **"Variáveis de Ambiente"**
3. Adicione:
   - Nome: `FREEPAY_PUBLIC_KEY` | Valor: (sua chave pública)
   - Nome: `FREEPAY_SECRET_KEY` | Valor: (sua chave secreta)

---

### Configurar Utmify (Rastreamento de Vendas)

#### 1. Criar Conta na Utmify
1. Acesse https://utmify.com.br
2. Clique em **"Criar Conta"**
3. Preencha seus dados
4. Confirme seu email

#### 2. Obter API Key
1. Faça login no painel da Utmify
2. Vá em **"Configurações"** → **"API"** ou **"Integrações"**
3. Gere ou copie sua **API Key**

#### 3. Adicionar Secret no Lovable
1. No Lovable Cloud, vá em Secrets
2. Adicione:
   - Nome: `UTMIFY_API_KEY` | Valor: (sua API key)

---

### Configurar Senha do Admin

1. Escolha uma senha forte para o painel administrativo
2. No Lovable Cloud, vá em Secrets
3. Adicione:
   - Nome: `ADMIN_PASSWORD` | Valor: (sua senha escolhida)

**Exemplo de senha forte:** `GuicheWeb@2025!Secure`

---

## 🌐 Como Publicar/Hospedar o Site

### Opção 1: Hospedagem no Lovable (Recomendado)

1. No Lovable, clique no botão **"Publish"** (ícone de globo/web) no canto superior direito
2. Clique em **"Publish"** ou **"Publicar"**
3. Aguarde o deploy (alguns segundos)
4. Você receberá uma URL como: `https://seu-projeto.lovable.app`

#### Domínio Personalizado (Plano Pago)
1. Após publicar, clique em **"Settings"** → **"Domains"**
2. Clique em **"Add Custom Domain"**
3. Digite seu domínio (ex: `www.guicheweb.com.br`)
4. Siga as instruções para configurar o DNS:
   - Adicione um registro CNAME apontando para o Lovable
   - Ou adicione registros A conforme instruído

### Opção 2: Hospedagem Externa (Vercel, Netlify, etc.)

1. Conecte o repositório GitHub à Vercel/Netlify
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy automático a cada push

---

## 📋 Checklist de Configuração

Use esta lista para garantir que tudo está configurado:

### Lovable/Cloud
- [ ] Projeto criado no Lovable
- [ ] Cloud habilitado
- [ ] Código importado do GitHub

### Banco de Dados
- [ ] Tabela `events` criada
- [ ] Tabela `ticket_types` criada
- [ ] Tabela `orders` criada
- [ ] RLS habilitado em todas as tabelas
- [ ] Bucket `event-images` criado

### FreePay (PIX)
- [ ] Conta criada na FreePay
- [ ] Conta verificada/aprovada
- [ ] Chaves de API obtidas
- [ ] Webhook configurado com URL correta
- [ ] Secret `FREEPAY_PUBLIC_KEY` adicionada
- [ ] Secret `FREEPAY_SECRET_KEY` adicionada

### Utmify
- [ ] Conta criada na Utmify
- [ ] API Key obtida
- [ ] Secret `UTMIFY_API_KEY` adicionada

### Admin
- [ ] Secret `ADMIN_PASSWORD` definida

### Publicação
- [ ] Site publicado
- [ ] URL funcionando
- [ ] Domínio personalizado configurado (opcional)

---

## 🧪 Testando a Configuração

### 1. Testar Painel Admin
1. Acesse: `https://seu-site.com/gw-admin-2025`
2. Digite a senha do admin
3. Verifique se consegue criar/editar eventos

### 2. Testar Criação de Evento
1. No painel admin, crie um evento de teste
2. Adicione tipos de ingresso
3. Verifique se aparece na página inicial

### 3. Testar Pagamento PIX
1. Acesse a página do evento
2. Selecione ingressos
3. Preencha dados de teste
4. Gere o PIX
5. Verifique se o QR Code aparece
6. (Opcional) Faça um pagamento real de R$ 1,00 para testar

### 4. Testar Busca de Pedidos
1. Após um pagamento confirmado
2. Acesse "Meus Ingressos"
3. Busque pelo CPF ou email
4. Verifique se os ingressos aparecem
5. Teste o download do PDF

---

## 🔗 URLs Importantes das APIs

### FreePay Brasil
- **Site:** https://freepaybrasil.com
- **Documentação:** https://freepaybrasil.com/docs
- **Painel:** https://app.freepaybrasil.com
- **Endpoint de Pagamento:** `POST https://api.freepaybrasil.com/v1/payment-transaction/create`
- **Autenticação:** Basic Auth com `PUBLIC_KEY:SECRET_KEY` em Base64

### Utmify
- **Site:** https://utmify.com.br
- **Painel:** https://app.utmify.com.br
- **Endpoint de Pedidos:** `POST https://api.utmify.com.br/api-credentials/orders`
- **Autenticação:** Header `x-api-token: SUA_API_KEY`

---

## ⚠️ Problemas Comuns e Soluções

### PIX não gera
- Verifique se as chaves FreePay estão corretas
- Verifique se a conta FreePay está verificada/ativa
- Veja os logs da edge function no Cloud

### Webhook não funciona
- Verifique se a URL do webhook está correta
- Verifique se o ID do projeto Supabase está correto na URL
- Teste manualmente enviando um POST para a URL

### Pedidos não aparecem
- Verifique se a tabela orders existe
- Verifique as políticas RLS
- Veja os logs do banco de dados

### Imagens não carregam
- Verifique se o bucket event-images existe
- Verifique se o bucket está público
- Verifique a URL das imagens

---

## 📞 Suporte

Para dúvidas sobre a implementação, consulte:
- Código fonte no GitHub
- Documentação do Lovable: https://docs.lovable.dev
- Documentação FreePay: https://freepaybrasil.com/docs
- Documentação Utmify: https://utmify.com.br/docs
