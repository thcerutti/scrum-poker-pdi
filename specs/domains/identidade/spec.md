# Identidade

Como o app reconhece cada pessoa, sem cadastro nem senha.

## Identificador

- Cada navegador gera um identificador aleatório (`pid`) na primeira visita e o guarda no `localStorage`, junto com o nome. Ele identifica a pessoa em todas as salas.
- O nome fica salvo no navegador. **Sair** apaga o nome, não o identificador.
- O `pid` aceita de 1 a 64 caracteres de letras, números, `_` e `-`. Valores fora disso são recusados com 400.

## Segredo e id público

- O `pid` é o segredo do navegador e nunca sai do servidor. Ele viaja no cabeçalho `x-participant` nas leituras e no corpo nas ações.
- A mesa recebe apenas o id público: os 16 primeiros caracteres do SHA-256 do `pid`. Ele não permite agir em nome da pessoa: usá-lo como `pid` não lê o voto, não tira ninguém da sala e não dá o cargo de admin.
- Cada leitura devolve ao próprio usuário o seu id público (`selfId`), o do admin (`adminId`), se ele está na mesa (`seated`) e o seu voto (`myVote`).

## Limites

- Quem tem o código da sala entra nela: não há senha nem convite.
- Quem apaga os dados do navegador, ou usa outro navegador ou aparelho, é uma pessoa nova. Perde o voto, o lugar na fila e, se for o caso, o cargo de admin.
- Não há limite para a criação de salas. O risco é aceito para uso interno.

## Verificação

`src/app/api/rooms/[code]/route.test.ts` (grupos "segurança", "T28 entradas inválidas" e "admin da sala") e `e2e/room.spec.ts` (`T30/T31`, `T32`).
