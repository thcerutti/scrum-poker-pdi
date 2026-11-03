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

- Na tela inicial, cada pessoa informa o nome (fica salvo no navegador) e cria uma sala
  ou entra com um código. Cada sala tem um código de 6 caracteres e um link
  (`/sala/ABC234`) para compartilhar pelo botão ao lado do nome do app, então vários
  times podem estimar ao mesmo tempo. A sala expira depois de um dia sem uso.
- Na sala, cada pessoa escolhe uma carta. Clicar de novo na carta retira o voto.
- A mesa mostra quem já votou (carta virada) sem revelar o valor.
- Quem cria a sala é o **admin**, destacado na mesa. **Revelar votos** e **Limpar votação**
  só aparecem para o admin, e o servidor recusa essas ações vindas de outra pessoa.
- Quando o admin sai (clicando em **Sair**, fechando a aba ou ficando sem sinal), o cargo
  passa para quem entrou primeiro entre os presentes, que é avisado na tela. Quem volta
  entra como participante comum, no fim da fila. Recarregar a página não muda nada.
  Se ninguém estava na mesa, quem chegar primeiro assume, salvo se for o próprio admin.
- Depois de revelar, o painel de resultado indica:
  - **Consenso**: todos na mesma carta;
  - **Pequena divergência**: votos em cartas vizinhas (ex.: 3 e 5);
  - **Divergência**: votos a duas ou mais cartas de distância. Quem votou no menor e
    no maior valor fica destacado na mesa.
  - A pausa (☕) não entra na média nem no cálculo de divergência.
- Ao revelar, aparece um GIF do [KLIPY](https://klipy.com) que combina com o resultado
  (comemoração no consenso, confusão na divergência). Quem clica em revelar busca o GIF
  e ele é compartilhado com a sala, então todos veem o mesmo.
- Limpar a votação pede confirmação e inicia uma nova rodada para todos.
- Recarregar a página ou fechar uma aba duplicada não tira ninguém da mesa nem apaga o
  voto. Quem fecha a última aba sai em ~20 s; quem fica sem sinal sai em ~2,5 min e
  recupera o voto se voltar na mesma rodada. **Sair** remove a pessoa e o voto na hora.
- Quem sai da mesa depois da revelação deixa de contar no resultado.
- Se alguém limpa a votação enquanto você clica em uma carta, o voto é recusado com um
  aviso: basta votar de novo na rodada nova.

A sincronização é por polling (1,5 s) contra uma rota de API que guarda a sala em
um hash do Redis, um por sala.

## Desenvolvimento

```bash
npm install
npm run dev
```

Sem variáveis de ambiente, o estado fica em memória: funciona em `next dev`, mas não
na Vercel (cada instância teria a sua própria memória). Por isso, na Vercel sem Redis a
API responde 503 em vez de parecer funcionar.

## Testes

```bash
npm test              # regras e API, com o cliente Upstash real e scripts Lua
npm run build && npm run test:e2e   # navegador, com várias pessoas na mesa
BASE_URL=https://sua-url.vercel.app npm run test:e2e   # o mesmo, em outra URL
node test/load.mjs https://sua-url.vercel.app 15 120   # carga: URL, pessoas, segundos
```

Os testes em `BASE_URL` e o de carga criam salas próprias, então não interferem em quem
estiver usando a URL.

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Em **Storage**, adicione um banco **Upstash Redis** (Marketplace) ao projeto, na
   mesma região das funções e sem réplicas de leitura (réplicas podem devolver dados
   atrasados). Ele cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` automaticamente
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
