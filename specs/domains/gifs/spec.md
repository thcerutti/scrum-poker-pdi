# GIFs

Comportamento em vigor do GIF exibido ao revelar os votos.

## Fluxo

1. O admin revela os votos.
2. O navegador do admin escolhe uma busca de acordo com o nível do resultado e consulta o KLIPY.
3. O navegador envia à sala só a URL escolhida e as dimensões.
4. Todos veem o mesmo GIF, abaixo do resultado, com a legenda "Powered by KLIPY".

A busca sai do navegador, e não do servidor, por exigência dos termos do KLIPY. Por isso a chave `KLYPY_KEY` é embutida no bundle do cliente, e mudar a chave exige um novo deploy.

## Escolha

- Cada nível do resultado tem um conjunto de buscas (celebração no consenso, confusão na divergência, café na pausa, e assim por diante).
- Sorteia-se uma busca do conjunto e uma página entre as 8 primeiras, usando o primeiro resultado da página. Se a página não tiver um GIF, repete-se a busca na página 1.
- O arquivo preferido é o `md` em webp, com gif e `sm` como alternativas.
- O filtro de conteúdo é o mais restrito (`content_filter=high`), com `locale=br`.

## Regras no servidor

- Só são aceitas URLs `https://static*.klipy.com/`, de até 2000 caracteres, com largura e altura entre 1 e 4000. O título é cortado em 200 caracteres.
- O servidor guarda apenas a URL, nunca a mídia.
- O GIF vale para uma rodada. Fica o primeiro enviado: pedidos duplicados, atrasados, de rodada antiga ou de rodada não revelada são ignorados sem erro.
- Limpar a votação apaga o GIF.

## Falhas

Sem chave, com o KLIPY fora do ar ou com o limite estourado, o resultado aparece normalmente, sem GIF. A chave de teste tem limite de 100 requisições por hora, e cada revelação usa até 2.

## Verificação

`src/app/api/rooms/[code]/route.test.ts` ("T10" e "GIF de outro domínio"). O comportamento com o KLIPY fora do ar ainda não tem teste automatizado.
