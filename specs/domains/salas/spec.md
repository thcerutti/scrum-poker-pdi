# Salas

Comportamento em vigor das salas de votação e do admin. Regras de votação, presença, identidade e GIFs ficam nos outros domínios.

## Sala

- Uma sala é o espaço de um time. Participantes, rodada, votos e GIF são próprios de cada sala, e uma sala não enxerga nem afeta outra.
- Qualquer pessoa cria uma sala informando só o nome, sem cadastro. Quem cria é o primeiro admin.
- O código tem 6 caracteres, do alfabeto `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (sem `0`, `O`, `1` e `I`). É gerado de forma aleatória, e um código já em uso nunca é reaproveitado.
- O endereço da sala é `/sala/<CÓDIGO>` e pode ser compartilhado. O botão com o código, na barra do topo, copia o link da página.
- A sala expira depois de 24 h sem uso. Cada escrita bem-sucedida renova o prazo.

### Entrar

| Caminho | Comportamento |
| --- | --- |
| Tela inicial, **Criar sala** | Cria a sala e abre `/sala/<CÓDIGO>`. Exige nome |
| Tela inicial, código e **Entrar** | Ignora espaços e maiúsculas. Se a sala existe, abre; senão mostra "Sala não encontrada. Confira o código." e permanece na tela inicial |
| Abrir o link da sala | Se não há nome salvo no navegador, pede só o nome; se há, entra direto |
| **Sair** | Volta à tela inicial, com o nome preenchido |

Código com formato inválido é tratado como sala inexistente.

### Sala inexistente ou expirada

- A API responde 404 com "Sala não encontrada." em qualquer ação ou leitura, e nenhuma ação recria a sala.
- Na tela, quem já estava dentro vê "Sala não encontrada" com o botão **Voltar ao início**. O polling deixa de tentar.

### Várias salas

A mesma pessoa pode estar em salas diferentes ao mesmo tempo, em abas diferentes. Sair de uma sala não afeta a outra.

## Admin

Cada sala tem um admin. Só ele revela e limpa a votação. Os botões aparecem apenas para ele, e o servidor responde 403 ("Só o admin da sala pode revelar ou limpar a votação.") quando outra pessoa tenta essas ações, mesmo por chamada direta à API. A recusa não altera nenhum dado.

Na mesa, o admin recebe a marca "admin". As demais pessoas veem "<nome> vai revelar os votos." ou, depois da revelação, "<nome> vai iniciar a próxima rodada.". Sem admin na mesa, veem "Aguardando o admin da sala.".

## Troca de admin

Quando o admin sai da mesa, o cargo passa para a pessoa presente que entrou primeiro, ou seja, quem entrou logo depois dele. A troca é definitiva: o admin anterior não recupera o cargo ao voltar.

### O que conta como saída

| Situação | Quando o cargo passa |
| --- | --- |
| Clicar em **Sair** | Na hora |
| Fechar a aba | Cerca de 20 s depois, se nenhuma outra aba da mesma pessoa der sinal |
| Ficar sem sinal | Depois de cerca de 2,5 min |
| Recarregar a página ou fechar uma aba duplicada | Não passa |

### Ordem de entrada

- A ordem vale por sala e segue a entrada na mesa, não o nome.
- Recarregar a página mantém o lugar na fila.
- Quem sai e volta recebe uma nova entrada, no fim da fila. Isso vale para qualquer saída da tabela acima.
- Só concorre quem está presente na mesa no momento da troca.

### Quem volta

- Volta como participante comum, sem o cargo.
- Quem saiu por falta de sinal e volta na mesma rodada recupera o voto. Quem clicou em **Sair** perde o voto.

### Mesa vazia

Se o admin sai e não há ninguém na mesa, o cargo não passa para ninguém:

- Se a mesma pessoa voltar primeiro, continua admin.
- Se outra pessoa chegar primeiro, ela assume.

### Aviso

Quem assume vê "Agora você é admin da sala." e passa a ver os botões de revelar e limpar. A mesa mostra o novo admin para todos.

### Garantias

- A troca é atômica: saídas e entradas simultâneas terminam sempre com um único admin.
- O admin é identificado pelo navegador, não por conta. Em outro navegador ou aparelho, a pessoa entra como participante comum.

## Verificação

`src/app/api/rooms/[code]/route.test.ts` (grupos "salas", "admin da sala" e "transferência de admin") e `e2e/room.spec.ts` (testes `S*`, `O*` e `A*`).
