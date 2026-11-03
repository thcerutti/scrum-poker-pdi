# Constituição do projeto

Regras que valem para todo o trabalho neste repositório. Toda spec, plano e implementação devem respeitá-las.

Mantenha este arquivo curto: registre apenas o que um agente não conseguiria deduzir lendo o código.

## Produto

Planning poker web de uso interno, para os times do PDI na Way2. Os times estimam entregas em salas próprias, identificadas por um código de 6 caracteres e um link compartilhável, sem cadastro. As cartas seguem Fibonacci com a analogia de veículos (de skate a avião), e a identidade visual é a da Way2, com o acento do segmento PDI.

## Stack

- Next.js 16 (App Router), React 19 e TypeScript.
- Material UI 9 com Emotion; SWR no cliente.
- Upstash Redis para o estado das salas, com deploy na Vercel.
- KLIPY para os GIFs exibidos ao revelar os votos.
- Vitest e Playwright para os testes.

## Arquitetura

- `src/app`: páginas e rotas de API (`/api/rooms`, `/api/rooms/[code]`).
- `src/components`: interface. `src/lib`: regras, persistência e integrações. `src/styles/way2`: tokens da marca.
- A sincronização é por polling (1,5 s), sem conexão persistente com o servidor.
- Cada sala é um único hash no Redis, para que cada leitura custe um comando.
- Toda regra que depende do estado atual é atômica, em script Lua: ler e depois escrever perde corridas entre instâncias.
- `getAll` nunca escreve e nenhuma operação recria uma sala expirada.
- O armazenamento em memória serve apenas para desenvolvimento local. Na Vercel sem Redis, a API responde 503 em vez de parecer funcionar.

## Padrões de código

- Textos de interface, mensagens de erro, comentários e commits são em português do Brasil. Identificadores são em inglês.
- Commits têm o título no presente da terceira pessoa ("Corrige...", "Adiciona...") e o corpo explica o motivo da mudança.
- Importe de `src` pelo alias `@/`.
- Nos estilos de componente, use as variáveis `--w2-*`. Os hex de `src/theme.ts` existem só porque a paleta do MUI os exige e devem espelhar os tokens.
- Os tokens de `src/styles/way2` são cópia sem alteração dos oficiais da marca (skill `way2-marca`).
- Regras da marca: tema sempre escuro, elevação por borda de 1 px e nunca por sombra, uma família de cor por tela, sem cores funcionais (o nível do resultado é indicado por ícone e título) e texto branco dentro dos cartões.

## Testes e qualidade

Uma mudança só é aceita com as três verificações abaixo passando. O repositório não tem CI, então elas são executadas localmente:

- `npm run lint`: checagem de tipos com `tsc --noEmit`. Não há ESLint.
- `npm test`: regras e API com Vitest. O cliente Upstash é o real e os scripts Lua são executados de verdade em `test/fake-upstash.mjs`.
- `npm run build && npm run test:e2e`: navegador com várias pessoas na mesa. O teste roda sobre o build, então refaça-o antes.

O teste de carga é opcional: `node test/load.mjs <url> <pessoas> <segundos>`.

Cada teste cria a própria sala, para poder rodar contra uma URL em uso.

## Restrições

- O `pid` é o segredo de cada navegador e nunca sai do servidor: a mesa só recebe o id público derivado.
- Revelar e limpar são exclusivos do admin da sala, e o servidor valida isso. O cargo passa a quem entrou primeiro quando o admin sai (ver `domains/salas`).
- O valor de um voto só é enviado aos demais participantes depois da revelação.
- A busca de GIFs sai do navegador, por exigência dos termos do KLIPY, por isso `KLYPY_KEY` fica no bundle do cliente.
- O servidor guarda apenas a URL do GIF, nunca a mídia, e aceita somente URLs de `static*.klipy.com`.
- O filtro de conteúdo do KLIPY é o mais restrito (`content_filter=high`).
- O Redis fica na região das funções e sem réplicas de leitura, que podem devolver dados atrasados.

## Questões em aberto

Nenhuma no momento.
