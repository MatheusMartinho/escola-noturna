# Escola Noturna

Painel de estudos para quem trabalha de dia e estuda à noite. Ele monta a semana em volta do trabalho e da academia, mostra o checklist do dia, acompanha a grade de aulas (técnicas, de comunicação e provas) e desenha o progresso.

Site estático: HTML, CSS e JavaScript puro, sem build e sem dependências.

## O que tem

| Aba | Para quê |
| --- | --- |
| Hoje | Linha do tempo do dia, checklist e as próximas aulas |
| Semana | Agenda da semana em cores, com avisos de conflito e de horário |
| Grade de aulas | As 61 aulas com status, a próxima destacada e as atrasadas marcadas |
| Progresso | Calendário de estudo, horas por semana, ritmo da grade e horas de alemão |
| Minha rotina | Horários de trabalho, academia e aulas, e o backup |

## Rodar no seu computador

Abra o `index.html` no navegador. Se preferir um servidor local:

```bash
python3 -m http.server 8000
# depois abra http://localhost:8000
```

## Publicar no GitHub Pages

1. Crie um repositório vazio no GitHub chamado `escola-noturna`.
2. Nesta pasta, envie o código:

   ```bash
   git remote add origin https://github.com/MatheusMartinho/escola-noturna.git
   git push -u origin main
   ```

3. No repositório, vá em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
4. Em um ou dois minutos o site fica em `https://MatheusMartinho.github.io/escola-noturna/`.

## Onde ficam os dados

O progresso fica salvo no `localStorage` do navegador em que você usa o app. Outro navegador ou outro computador começa do zero. Para levar o progresso junto, use **Minha rotina → Baixar backup** e depois **Restaurar backup** no outro lugar.

## Estrutura

```
index.html      a página
styles.css      o visual (tema claro e escuro)
curriculo.js    a grade: blocos e aulas
app.js          rotina, checklist, gráficos e armazenamento
```

Para mudar a grade, edite `curriculo.js`. Cada aula é uma linha: código, trilha, bloco, módulo, título, decisão, laboratório e semana planejada.
