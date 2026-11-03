# Votação

Comportamento em vigor das rodadas, dos votos, da revelação e do resultado.

## Cartas

Fibonacci com a analogia de veículos: quanto mais partes a entrega tem, mais pontos.

| Carta | Veículo |
| --- | --- |
| 1 | Skate |
| 2 | Patinete |
| 3 | Bicicleta |
| 5 | Moto |
| 8 | Carro |
| 13 | Caminhão |
| 21 | Avião |
| Pausa | Café |

A pausa não entra na média nem no cálculo de divergência.

## Rodada

- Toda sala começa na rodada 0. A rodada avança apenas quando o admin limpa a votação.
- Um voto vale só para a rodada em que foi dado. Votos de rodadas antigas são ignorados.
- Cada rodada está **aberta** ou **revelada**.

## Votar

- Qualquer pessoa na mesa vota em uma carta, troca de carta ou retira o voto clicando de novo na mesma carta.
- Enquanto a rodada está aberta, os outros veem só **quem** votou (carta virada). O valor de um voto nunca é enviado a outra pessoa antes da revelação. Cada pessoa vê o próprio voto.
- A mesa mostra "N de M votaram" e uma barra de progresso.
- Depois da revelação as cartas ficam desabilitadas.
- O voto aparece na hora na tela de quem votou. Se o servidor recusar, a tela volta ao estado anterior.

### Recusa por rodada desatualizada

O voto é validado no servidor junto com a rodada. Se a rodada já avançou ou já foi revelada, o servidor responde 409, a tela adota o estado atual e mostra "A votação já foi revelada ou reiniciada.". Quem votou no instante em que o admin limpou precisa votar de novo na rodada nova. Isso evita que um voto vá para a rodada errada.

## Revelar

- Só o admin revela (ver o domínio Salas). O botão informa "Revelar votos (N/M)", destaca-se com "Todos votaram: revelar!" quando todos votaram e fica desabilitado sem nenhum voto ou depois de revelado.
- Revelar não é otimista: a tela só muda com a resposta do servidor, para nunca mostrar "Nenhum voto" por engano.
- O servidor valida a rodada. Revelar uma rodada que já não é a atual responde 409 e não altera nada.
- Depois de revelada, a rodada exibe os valores de todos, incluindo quem não votou ("sem voto").

## Limpar

- Só o admin limpa. Pede confirmação em um diálogo: "Os votos desta rodada serão apagados para todos os participantes e uma nova rodada começará."
- O servidor valida a rodada. Limpar com a rodada desatualizada responde 409 e não apaga nada. Vários cliques simultâneos avançam uma única rodada.
- Limpar avança a rodada, apaga os votos e o GIF e remove da mesa quem está sem sinal (ver Presença).
- O botão de confirmar fica desabilitado enquanto o diálogo fecha, para um clique duplo não disparar duas vezes.
- Se a rodada mudar com o diálogo aberto (por exemplo, limpando em outra aba), o diálogo fecha sozinho.

## Resultado

Mostrado após a revelação, calculado sobre os votos revelados e sobre o total de pessoas na mesa.

| Nível | Quando | Título |
| --- | --- | --- |
| Consenso | 2 ou mais votos numéricos, todos na mesma carta | "Consenso!" (todos votaram) ou "Consenso entre quem votou" |
| Pequena divergência | Cartas vizinhas na sequência (por exemplo, 3 e 5) | "Pequena divergência" |
| Divergência | Duas ou mais posições de distância | "Divergência" |
| Voto único | Um único voto numérico | "Só um voto" |
| Pausa | Só houve votos de pausa | "Pausa para o café" |
| Vazia | Nenhum voto | "Nenhum voto" |

- A distância é medida pela posição na sequência do baralho, não pela diferença de valor.
- "Consenso" só diz "Todos" se ninguém ficou sem votar nem escolheu a pausa.
- Em divergência, quem votou no menor e no maior valor recebe as marcas "menor" e "maior" na mesa.
- O painel mostra a média e o mais votado (com 2 ou mais votos numéricos), a distribuição por carta e as ressalvas "N pessoas não votaram" e "N pessoas pediram pausa".
- Quando todos os valores numéricos empatam, o mais votado aparece como "Empate". Com empate parcial, mostra os valores empatados.
- A média usa vírgula e até uma casa decimal.

## Verificação

`src/lib/deck.test.ts`, `src/app/api/rooms/[code]/route.test.ts` (grupos "T02 ciclo completo" e "concorrência da rodada") e `e2e/room.spec.ts`.
