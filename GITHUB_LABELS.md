# GitHub Labels — Escacev

Conjunto de labels para organizar as issues do projeto. Use uma das três formas abaixo.

---

## Forma 1 — GitHub CLI (recomendado)

Se você tem o GitHub CLI (`gh`) instalado e autenticado, cole estes comandos no
terminal, na pasta do repositório. Cada comando cria uma label.

```bash
# Prioridade
gh label create "essencial"   --color D73A4A --description "Bloqueia a entrega (MVP)"
gh label create "desejável"   --color FBCA04 --description "Só se houver folga"
gh label create "futuro"      --color 0E8A16 --description "Escopo v2, não implementar agora"

# Tipo
gh label create "feature"     --color A2EEEF --description "Nova funcionalidade"
gh label create "bug"         --color D73A4A --description "Algo não está funcionando"
gh label create "refactor"    --color C5DEF5 --description "Melhoria de código sem mudar comportamento"
gh label create "docs"        --color 0075CA --description "Documentação"
gh label create "test"        --color BFDADC --description "Testes"
gh label create "chore"       --color FEF2C0 --description "Configuração e manutenção"

# Fase / Recurso
gh label create "auth"             --color 5319E7 --description "Autenticação e autorização"
gh label create "membros"          --color 1D76DB --description "Membros, ministérios, funções"
gh label create "eventos"          --color 1D76DB --description "Eventos e calendário"
gh label create "escalas"          --color B60205 --description "Escalas e motor de conflito"
gh label create "indisponibilidade" --color 1D76DB --description "Indisponibilidade de membros"
gh label create "notificacoes"     --color 1D76DB --description "Notificações por e-mail"
gh label create "frontend"         --color BFD4F2 --description "Telas e interface"
gh label create "deploy"           --color 0E8A16 --description "Deploy, VPS, produção"
```

> Para **atualizar** uma label que já existe em vez de criar, troque `create` por `edit`.
> Se um comando falhar dizendo que a label já existe, use `gh label edit` com os mesmos parâmetros.

---

## Forma 2 — Manual pela interface

No GitHub: **Issues → Labels → New label**. Para cada linha da tabela, preencha
os três campos (Name, Description, Color) e clique em *Create label*.

A cor é o código hexadecimal **sem** o `#`.

### Prioridade
| Name | Color | Description |
|------|-------|-------------|
| `essencial` | `D73A4A` | Bloqueia a entrega (MVP) |
| `desejável` | `FBCA04` | Só se houver folga |
| `futuro` | `0E8A16` | Escopo v2, não implementar agora |

### Tipo
| Name | Color | Description |
|------|-------|-------------|
| `feature` | `A2EEEF` | Nova funcionalidade |
| `bug` | `D73A4A` | Algo não está funcionando |
| `refactor` | `C5DEF5` | Melhoria de código sem mudar comportamento |
| `docs` | `0075CA` | Documentação |
| `test` | `BFDADC` | Testes |
| `chore` | `FEF2C0` | Configuração e manutenção |

### Fase / Recurso
| Name | Color | Description |
|------|-------|-------------|
| `auth` | `5319E7` | Autenticação e autorização |
| `membros` | `1D76DB` | Membros, ministérios, funções |
| `eventos` | `1D76DB` | Eventos e calendário |
| `escalas` | `B60205` | Escalas e motor de conflito |
| `indisponibilidade` | `1D76DB` | Indisponibilidade de membros |
| `notificacoes` | `1D76DB` | Notificações por e-mail |
| `frontend` | `BFD4F2` | Telas e interface |
| `deploy` | `0E8A16` | Deploy, VPS, produção |

---

## Forma 3 — Sincronização via arquivo (avançado)

Ferramentas como [`github-label-sync`](https://github.com/Financial-Times/github-label-sync)
leem um arquivo `.json` e aplicam todas as labels de uma vez (criando, editando e
removendo). Para o escopo de um TCC solo, as formas 1 e 2 já resolvem — esta fica
como referência caso o projeto cresça.

---

## Como usar as labels nas issues

A ideia é combinar **uma label de cada grupo** em cada issue. Exemplos:

- *"Implementar login com Google"* → `feature` + `essencial` + `auth`
- *"Corrigir conflito em eventos simultâneos"* → `bug` + `essencial` + `escalas`
- *"Tela de matriz de compatibilidade"* → `feature` + `essencial` + `frontend`
- *"Implementar troca direta entre membros"* → `feature` + `desejável` + `escalas`
- *"Onboarding de novas instituições"* → `feature` + `futuro`

Assim você filtra o board por prioridade (o que é essencial agora), por recurso
(tudo de escalas) ou por tipo (todos os bugs abertos).

---

*Projeto Escacev · TCC*
