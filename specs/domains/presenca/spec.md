# Presença

Comportamento em vigor de quem está na mesa: entrada, sinal de vida, saída e conexão.

## Estar na mesa

Está na mesa quem deu sinal nos últimos 150 s. Só essas pessoas aparecem para os outros, ordenadas pelo nome (pt-BR), e só elas contam em "N de M votaram" e no resultado. O nome é cortado em 30 caracteres, e nomes repetidos são permitidos.

Quem some da lista continua com o voto guardado: se voltar na mesma rodada, recupera.

## Sincronização

- A tela lê a sala a cada 1,5 s, inclusive sem rede, para que a falha apareça.
- A tela envia um sinal de vida a cada 15 s.
- Ao voltar a ficar visível, ao restaurar do cache do navegador e ao abrir, a tela entra na mesa de novo.
- O sinal de vida não devolve o estado da sala. Assim, uma resposta atrasada nunca desfaz na tela um voto recente.
- Se o servidor diz que a pessoa não está mais na mesa (por exemplo, a aba ficou suspensa), a tela entra de novo sozinha.

## Saídas

| Situação | Efeito |
| --- | --- |
| **Sair** | Remove a pessoa e o voto na hora. Todas as abas da mesma pessoa, na mesma sala, voltam para a tela inicial |
| Fechar a aba | A tela avisa o servidor, e a pessoa sai depois de cerca de 20 s, se nenhuma outra aba der sinal |
| Recarregar a página | Mantém o lugar e o voto, porque a nova página dá sinal dentro dos 20 s |
| Fechar uma aba duplicada | Mantém o lugar e o voto, porque a outra aba continua dando sinal |
| Sem sinal por 150 s | A pessoa some da mesa, mas o voto é guardado |
| Limpar a votação | Remove da mesa quem está sem sinal |

Um sinal de vida atrasado, chegando depois de **Sair**, não recoloca a pessoa na mesa.

## Entrada

- Entrar cria o lugar na mesa e a posição na fila do admin (ver Salas). Entrar de novo estando presente (recarregar, nova aba) só atualiza o sinal.
- Se a mesa estava vazia com a rodada revelada, a próxima pessoa a entrar começa uma rodada nova. Com a mesa vazia e a rodada aberta, nada muda.
- Se a pessoa que recarrega é a única na mesa e a rodada está revelada, o resultado continua à vista.

## Conexão e erros

- Sem conexão ou com erro do servidor, a tela mostra "Sem conexão com a sala. Tentando reconectar…", mantém os dados anteriores e tenta de novo a cada 3 s. O aviso some quando a conexão volta.
- Ações que falham mostram uma mensagem em português ("Sem conexão com a sala. Tente novamente." ou "Algo deu errado. Tente novamente."), nunca um erro técnico.
- Redis indisponível ou cota estourada: a API responde 503 em JSON, "A sala está indisponível no momento. Tente de novo em instantes.".
- Na Vercel sem Redis configurado, a API responde 503 em vez de usar a memória.

## Abas e navegador

- A mesma pessoa em duas abas é um único lugar na mesa.
- Com `localStorage` bloqueado, o app funciona: a pessoa só precisa digitar o nome de novo, e a identidade vale até fechar a página.

## Verificação

`src/app/api/rooms/[code]/route.test.ts` (grupo "presença" e "T27") e `e2e/room.spec.ts` (testes `T14` a `T23`, `T36` e `T37`).
