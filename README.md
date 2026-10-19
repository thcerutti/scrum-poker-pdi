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
- Ao revelar, aparece um GIF do [KLIPY](https://klipy.com) que combina com o resultado
  (comemoração no consenso, confusão na divergência). Quem clica em revelar busca o GIF
  e ele é compartilhado com a sala, então todos veem o mesmo.
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
3. Para os GIFs, crie a variável `KLYPY_KEY` com a chave do KLIPY. Ela é embutida no
   build, então mudar a chave exige um novo deploy.
4. Faça o deploy (ou redeploy, se o banco ou a chave foram adicionados depois).

### Sobre o KLIPY

- Os termos exigem que a busca saia do navegador, por isso a chave fica visível no
  JavaScript da página. O servidor só guarda a URL escolhida, nunca a mídia.
- A chave em modo de teste é limitada a 100 requisições/hora (são até 2 por revelação).
  Para liberar, peça acesso de produção no Partner Panel.
- O filtro de conteúdo usado é o mais restrito (`content_filter=high`).

Para rodar localmente contra o mesmo Redis: `vercel env pull .env.local`.
