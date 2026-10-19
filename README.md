# Scrum Poker

Planning poker em Next.js + Material UI. Cada carta usa a analogia de veículos:
quanto mais partes a entrega tem, mais pontos (Fibonacci).

| Carta | Veículo  |
| ----- | -------- |
| 1     | Skate    |
| 2     | Patinete |
| 3     | Bicicleta|
| 5     | Moto     |
| 8     | Carro    |
| 13    | Caminhão |
| 21    | Avião    |
| ☕    | Pausa    |

## Como funciona

- Cada pessoa entra com o nome (fica salvo no navegador) e escolhe uma carta.
  Clicar de novo na carta retira o voto.
- A mesa mostra quem já votou (carta virada) sem revelar o valor.
- **Revelar votos** pode ser clicado por qualquer pessoa a qualquer momento; o botão
  fica verde quando todos votaram.
- Depois de revelar, o painel de resultado indica:
  - **Consenso**: todos na mesma carta;
  - **Pequena divergência**: votos em cartas vizinhas (ex.: 3 e 5);
  - **Divergência**: votos a duas ou mais cartas de distância. Quem votou no menor e
    no maior valor fica destacado na mesa.
  - A pausa (☕) não entra na média nem no cálculo de divergência.
- **Limpar votação** pede confirmação e inicia uma nova rodada para todos.
- Quem fecha a aba sai da mesa; quem fica sem sinal por ~2,5 min é removido.

A sincronização é por polling (1,5 s) contra uma rota de API que guarda a sala em
um hash do Redis. Há uma única sala.

## Desenvolvimento

```bash
npm install
npm run dev
```

Sem variáveis de ambiente, o estado fica em memória: funciona em `next dev`, mas não
na Vercel (cada instância teria a sua própria memória).

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Em **Storage**, adicione um banco **Upstash Redis** (Marketplace) ao projeto. Ele
   cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` automaticamente
   (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` também são aceitas).
3. Faça o deploy (ou redeploy, se o banco foi adicionado depois).

Para rodar localmente contra o mesmo Redis: `vercel env pull .env.local`.
