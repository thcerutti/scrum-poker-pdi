# Specs

Este repositório usa Spec-Driven Development: o comportamento esperado é especificado antes do código.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `constitution.md` | Regras que valem para todo o projeto |
| `domains/<dominio>/spec.md` | Como o sistema se comporta hoje. É a fonte de verdade |
| `domains/<dominio>/contracts/` | Contratos em vigor, como OpenAPI e schemas |
| `changes/NNN-slug/spec.md` | O quê e por quê de uma mudança |
| `changes/NNN-slug/plan.md` | Como a mudança será feita |
| `changes/NNN-slug/contracts/` | Contratos propostos pela mudança |
| `changes/NNN-slug/tasks.md` | Passos de execução |

`NNN` tem três dígitos e cresce a cada mudança. `slug` é um nome curto em kebab-case, como `001-cadastro-usuario`.

Crie apenas os arquivos que a mudança precisar. Uma correção pequena pode ter só `spec.md` ou nem precisar de uma pasta.

## Ciclo de uma mudança

1. **Especificar:** crie `changes/NNN-slug/spec.md` e obtenha aprovação.
2. **Planejar:** detalhe a solução em `plan.md` e `tasks.md`, quando necessário.
3. **Implementar:** faça a mudança, com os testes derivados dos critérios de aceite.
4. **Consolidar:** atualize `domains/<dominio>/` com o novo comportamento e marque a mudança como `Concluída`.

Pastas de mudanças concluídas não são alteradas: elas registram o histórico. Se o comportamento mudar de novo, crie outra mudança.

## Sistemas existentes

Não documente todo o sistema de uma vez. Crie a spec de um domínio quando uma mudança tocar nele, descrevendo apenas o comportamento confirmado.
