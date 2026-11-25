# LyricGap 🎵

Jogo para aprender idiomas completando a letra de músicas do YouTube. A música toca, a frase aparece com uma lacuna e você completa a palavra que falta.

**Jogar:** https://sos-software.github.io/lyricgap/

---

## Sumário

- [Como jogar](#como-jogar)
- [Modos de jogo](#modos-de-jogo)
- [Controles](#controles)
- [Biblioteca: favoritos, playlists e frases salvas](#biblioteca-favoritos-playlists-e-frases-salvas)
- [Progresso: contadores, meta diária e heatmap](#progresso-contadores-meta-diária-e-heatmap)
- [De onde vêm a letra, a tradução e a busca](#de-onde-vêm-a-letra-a-tradução-e-a-busca)
- [Usar no iPhone (tela cheia)](#usar-no-iphone-tela-cheia)
- [Anúncios e YouTube Premium](#anúncios-e-youtube-premium)
- [Backup e troca de aparelho](#backup-e-troca-de-aparelho)
- [Configurações](#configurações)
- [Rodar localmente](#rodar-localmente)
- [Estrutura do código](#estrutura-do-código)
- [Limitações conhecidas](#limitações-conhecidas)
- [Ideias futuras](#ideias-futuras)

---

## Como jogar

1. **Busque a música** na caixa de busca da tela inicial, ou cole um link do YouTube nela.
2. **Letra:** o app procura a letra sincronizada automaticamente.
   - **Achou:** toque no resultado marcado como *SINCRONIZADA*.
   - **Não achou:** vá em **Colar**, cole a letra (uma frase por linha) e faça a **sincronização**. Dê play e toque **MARCAR** no instante em que cada frase começa. É feito uma vez só e fica salvo.
3. Toque em **▶ Jogar** (lacunas) ou em **🎤 Karaokê** (só cantar junto, com tradução).
4. Se o clipe tiver uma introdução longa, toque em **⏭ Pular para a letra** (aparece sobre o vídeo).
5. No fim aparecem pontos, palavras certas, erros, precisão, recorde e a lista de **palavras para revisar**.

### Pontuação

Contadores simples, sem números inflados:

| Ação | Pontos |
|---|---|
| Palavra certa | **+1** |
| Música completa (jogada até o fim) | **+10** |

Na tela de jogo ficam três contadores: **✓ certas**, **✗ erros** e **🔥 acertos seguidos**. O recorde de cada música é o maior total de pontos. Dica, velocidade e tempo de resposta não mudam os pontos. O XP do nível usa a mesma regra.

### Encerrar

O botão **✕ Encerrar** (no topo, durante o jogo ou o karaokê) pausa a música e pergunta se você quer sair. Encerrando, aparece o resultado parcial: as palavras certas já contam no progresso, mas o bônus de +10 fica só para quem termina a música.

### Modo karaokê

A música toca e a **letra inteira rola sozinha**, com o verso cantado em destaque. O botão no topo alterna a tradução: **ao lado**, **abaixo** ou **sem tradução**. Tocar num verso pula para ele; ⏮/⏭ vão para o verso anterior/próximo; 🔖 salva a frase. No PC: espaço pausa, ← → trocam de verso. Não tem lacunas nem pontos.

## Modos de jogo

### Ritmo

| Modo | Como funciona |
|---|---|
| **🌊 Fluxo** | A música **nunca para**. As opções aparecem enquanto o verso toca. Acertou: +1 e sequência 🔥. Errou: a opção treme em vermelho, a certa acende em verde e a música segue **sem voltar**. Se o verso passar sem resposta, a palavra é revelada em silêncio. O anel do botão central mostra o tempo restante do verso. |
| **⏸ Pausa** (padrão) | O vídeo **pausa no fim de cada frase** com lacuna. Acertou: continua. Errou: **volta a frase** e toca de novo. Na 3ª vez que errar, a resposta aparece. Se você demorar, o trecho repete sozinho (padrão: 8s, configurável). |

### Forma de responder

- **Múltipla escolha** (padrão): 4 opções em formato de **cruz**. No PC, as setas ↑ ← → ↓ ou as teclas 1 a 4 escolhem a opção.
- **Digitando**: pequenos erros de digitação são aceitos em palavras de 5 letras ou mais, e maiúsculas/acentos não importam.

### Dificuldade

- **Fácil:** lacunas em cerca de 60% das frases.
- **Médio:** 1 lacuna por frase.
- **Difícil:** 2 lacunas por frase (em frases com 5 palavras ou mais).

As palavras escolhidas evitam artigos e palavras muito curtas. As opções erradas vêm da própria música e nunca repetem palavras que já aparecem na frase.

## Controles

| Botão | O que faz |
|---|---|
| ⏮ **Voltar** | Volta para o verso anterior e a música continua dali. Toques rápidos seguidos voltam mais versos. Um verso revisitado aparece completo, com a tradução e o 🔖 para salvar. No PC: Backspace. |
| 🔁 **Centro / ouvir de novo** | Repete o verso atual. No PC: Esc (ou espaço, na múltipla escolha). |
| 💡 **Dica** | Na múltipla escolha, elimina uma opção errada. Digitando, revela uma letra. Usar dica não tira pontos. |
| ⏸ **Pausa** | Pausa ou continua a música. |
| ⏭ **Pular** | Pula a lacuna (só no modo Pausa). |
| **Velocidade** | Alterna entre 1x, 0.75x e 0.5x. |
| 🔖 | Salva a frase (fica no cartão da frase anterior, nos versos revisitados e na lista do fim da música). |
| ✕ **Encerrar** / ⚙ | Encerrar a música (com confirmação e resultado parcial) / configurações. |
| ⏱ **Verso cortado? Ajustar tempo** | Fica embaixo do verso (e acende quando o jogo pausa para responder). Abre o ajuste do tempo **só daquele verso**: *Ouvir o verso* toca exatamente o trecho; − / + movem o início ou o fim em 0,25s; *Marcar início* / *Marcar fim* tocam o trecho e você toca de novo no instante em que a voz começa ou termina. *Salvar este verso* grava na letra da música (LRC) e o verso toca de novo já com o tempo certo. Se o fim passar do começo do próximo verso, o próximo começa mais tarde; se ficar antes, o app grava uma marca de fim. No karaokê, o mesmo ajuste fica no ícone ⏱ de cada verso. Se **a música toda** estiver adiantada ou atrasada, use a *Sincronia geral* no mesmo painel. |
| ⏭ **Pular para a letra** | Aparece sobre o vídeo quando falta mais de 5 s para o próximo verso (introdução do clipe ou solo). Pula para logo antes dele. |

**Tela de jogo:** a **frase atual** (com a lacuna) aparece com a **tradução logo embaixo, em letra maior**, enquanto o verso toca. Acima dela, um cartão discreto mostra a frase anterior completa, também com a tradução.

## Biblioteca: favoritos, playlists e frases salvas

- **☆ Favoritos:** a estrela ao lado de qualquer música ou na barra da música.
- **＋ Playlists:** adicione músicas a playlists. Uma playlist toca em sequência, e no fim de cada música aparece **"Próxima música ▶"**.
- **Recentes:** últimas 50 músicas abertas.
- **Músicas de exemplo:** na primeira vez que o app abre, 12 músicas já aparecem em *Recentes* para começar sem buscar (The Strokes, Sia, Coldplay, Ben E. King, Black Eyed Peas, Angels & Airwaves, Journey, Queen, AURORA, The Cranberries e Sixpence None The Richer). Todas têm letra sincronizada no LRCLIB. Quem já usava o app recebe as músicas uma vez, depois das suas. A lista fica em `SAMPLES`, no `app.js`.
- **🔖 Frases:** cada frase salva guarda:
  - o texto completo e a tradução;
  - a música (título e artista);
  - o **tempo exato de início e fim** do trecho.

  Na aba **Frases**, tocar numa frase abre um player que **toca só aquele trecho**, com os botões *Ouvir de novo*, *Jogar música*, *YouTube* (abre o vídeo já no segundo certo, bom para compartilhar) e *Remover*.

Tudo fica salvo **no próprio aparelho** (localStorage do navegador). Não existe servidor nem conta.

## Progresso: contadores, meta diária e heatmap

O card **Meta de hoje**, no topo da tela inicial, aparece depois do primeiro jogo e mostra:

- **Anel da meta diária:** palavras certas hoje sobre a meta (padrão 20; dá para mudar para 10, 30, 50 ou 100).
- **🔥 Dias seguidos:** dias consecutivos com atividade. Conta até ontem, então ainda dá tempo de manter a sequência hoje.
- **Nível:** sobe com XP. Cada palavra certa vale 1 e cada música completa vale 10 (níveis em 10, 40, 90, 160… XP). A barra mostra quanto falta para o próximo nível.
- **Contadores totais:** músicas ouvidas (completas), versos tocados e palavras certas.
- **Heatmap das últimas 20 semanas:** um quadrado por dia, mais claro quanto mais palavras certas naquele dia (cheio = meta batida). O dia de hoje tem contorno.

Tocar no card abre **Seu progresso**:

- nível com barra de XP;
- **heatmap de 6 meses**, em que tocar num dia mostra as palavras e os versos daquele dia;
- **gráfico dos últimos 7 dias** (palavras certas por dia), com a linha da meta;
- totais desde o começo: músicas ouvidas, músicas diferentes, versos tocados, palavras certas, precisão, tempo de jogo, dias seguidos, recorde de dias e frases salvas;
- a escolha da meta diária.

Avisos aparecem quando você **bate a meta do dia** 🎯 e quando **sobe de nível** ⬆️. A tela de fim de música mostra o resumo do dia (palavras/meta, dias seguidos, nível).

**O que conta:**

| Contador | Quando soma |
|---|---|
| Versos tocados | Cada verso novo alcançado durante o jogo (voltar e ouvir de novo não conta duas vezes) |
| Palavras certas | Cada lacuna acertada |
| Erros (para a precisão) | Lacuna errada, pulada ou que passou sem resposta |
| Músicas ouvidas | Cada vez que você chega ao fim de uma música jogando |
| Tempo de jogo | Tempo com a música tocando durante o jogo |

Os números ficam no aparelho (junto com a biblioteca) e entram no backup.

## De onde vêm a letra, a tradução e a busca

O Google só entra quando você pede uma tradução melhor (veja abaixo).

### Letra: [LRCLIB](https://lrclib.net)

- É um banco **gratuito e comunitário** de letras **sincronizadas** (cada frase com seu tempo). Voluntários enviam letras e tempos.
- Músicas menos conhecidas podem não estar lá. Nesse caso, cole a letra de qualquer site e sincronize no app.
- Uma letra comunitária pode ter pequenos erros. Dá para corrigir em **Editar LRC** na tela antes de jogar.
- O app não guarda nem distribui letras: elas são buscadas na hora, ou coladas por você, e ficam só no seu aparelho.

### Tradução: [MyMemory](https://mymemory.translated.net) (empresa Translated)

- Primeiro o serviço procura a frase numa **memória de traduções feitas por pessoas**. Se não encontra, usa **tradução automática**.
- Para letra de música, quase sempre cai na **tradução automática**. **Não é uma tradução feita por alguém para aquela música.**
- **Qualidade:** boa para entender o sentido geral, mas literal. Gírias, expressões idiomáticas e metáforas podem sair erradas ou estranhas.
- **Limite gratuito:** cerca de 5.000 caracteres por dia (umas 3 músicas novas por dia). As traduções ficam guardadas no aparelho, então repetir uma música não gasta o limite.
- O idioma de origem é escolhido em ⚙ → *Idioma das músicas*. O destino é sempre português (PT-BR).

### Melhorar uma tradução (✎)

Ao lado de cada tradução (verso atual, cartão do verso anterior, karaokê e frases salvas) há um **✎**. Ele abre o painel *Tradução do verso* com:

- **Automática (MyMemory):** a que o app usa por padrão;
- **Google Tradutor:** buscada na hora, muitas vezes mais natural;
- **Minha tradução:** escreva com suas palavras (ou cole uma tradução feita por alguém).

Toque na que faz mais sentido. Ela fica salva **para aquele verso** (e para todas as vezes que ele se repete, inclusive nas frases salvas) e entra no backup. Escolher *Automática* de novo desfaz a troca.

- O Google é chamado pelo endereço público do widget do Google Tradutor, **sem chave**. Não é uma API oficial: funciona hoje, mas pode parar sem aviso. Nesse caso o painel mostra "não disponível agora" e as outras opções continuam funcionando.
- **Por que não DeepL:** o DeepL bloqueia chamadas feitas direto do navegador, e o app roda no GitHub Pages, sem servidor para intermediar.

### Busca de vídeos

- **Filtro Músicas / Todos os vídeos:** por padrão a busca traz só **músicas** (YouTube Music: primeiro o áudio oficial do álbum, que bate com o tempo das letras e não tem introdução de clipe, depois os clipes oficiais). Cada resultado ganha um selo do LRCLIB: **LETRA ✓** (sincronizada), **SÓ TEXTO** (você sincroniza) ou **SEM LETRA**. Para palestras e outros vídeos, escolha **Todos os vídeos**.
- **Sem configurar nada:** a busca usa servidores públicos do [Piped](https://github.com/TeamPiped/Piped), um front-end alternativo e aberto do YouTube. Eles são gratuitos, mas **às vezes ficam fora do ar**. O app tenta vários e lembra qual funcionou.
- **Com uma chave da API do YouTube** (⚙ → *Busca de vídeos*): a busca usa a API oficial e fica estável. A chave é grátis no Google Cloud (YouTube Data API v3), com cerca de 100 buscas por dia, e fica salva só no seu aparelho.
- **Sempre funciona:** colar o link do vídeo na caixa de busca.

### Vídeo

- O vídeo toca no **player oficial do YouTube** (IFrame API). O app só controla play, pause, posição e velocidade.

## Usar no iPhone (tela cheia)

1. Abra **https://sos-software.github.io/lyricgap/** no **Safari**.
2. Toque em **Compartilhar** (⬆) e depois **Adicionar à Tela de Início**.
3. Abra pelo ícone **LyricGap**. O app abre em tela cheia, sem a barra do Safari.

Durante o jogo a tela não apaga (iOS 16.4 ou mais novo).

> ⚠️ O app da Tela de Início **guarda os dados separado do Safari**. Para levar músicas e frases de um para o outro, use o [backup](#backup-e-troca-de-aparelho).

## Anúncios e YouTube Premium

- O app **não remove anúncios**: o vídeo toca no player oficial, e cortar os anúncios dele vai contra as regras do YouTube.
- O Premium só funciona no player dentro de outro site quando o YouTube reconhece a sua conta. O Safari do iPhone bloqueia essa identificação por padrão (*Impedir Rastreamento entre Sites*), por isso os anúncios podem aparecer.
- O que costuma resolver no **Safari**: entrar na sua conta em youtube.com e desligar **Ajustes → Apps → Safari → Impedir Rastreamento entre Sites**. Isso é uma configuração de privacidade, então a decisão é sua.
- No app da Tela de Início isso não deve funcionar, porque ele não tem o login do Safari.

## Backup e troca de aparelho

Em ⚙ → *Biblioteca*:

- **Copiar backup:** copia tudo (músicas, letras sincronizadas, favoritos, playlists, frases salvas e recordes) como texto.
- **Restaurar backup:** cole o texto no outro aparelho (ou no app da Tela de Início). O conteúdo é **mesclado** com o que já existe, nada é apagado.

## Configurações

| Opção | Padrão |
|---|---|
| Ritmo (Fluxo / Pausa) | Pausa em cada frase |
| Dificuldade | Médio |
| Responder (escolha / digitando) | Múltipla escolha |
| Modo pausa: repetir o trecho se demorar | 8s |
| Velocidade | 1x |
| Idioma das músicas | Inglês |
| Tradução PT-BR | Ligada |
| Sons de acerto/erro | Ligados |
| Sincronia desta música (−/+) | 0.0s. Use − se a letra aparece antes da voz |
| Chave da API do YouTube | Vazia (usa os servidores Piped) |

## Rodar localmente

Requer só o [Node.js](https://nodejs.org), sem dependências.

```powershell
node server.js
```

- PC: http://localhost:8000
- Celular na mesma rede Wi-Fi: o endereço `http://192.168.x.x:8000` que aparece no terminal.

> O player do YouTube não funciona abrindo o `index.html` direto como arquivo (`file://`). Use o servidor.

**Publicação:** o site é servido pelo GitHub Pages a partir da branch `main`. Basta fazer `git push`, e ele atualiza em cerca de 1 minuto.

## Estrutura do código

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Estrutura das telas (início, música, jogo), ícones SVG e o painel inferior. |
| `style.css` | Visual (tema escuro, controle em cruz, botões redondos, painéis). |
| `app.js` | Toda a lógica: biblioteca, busca, player, letras, sincronização, jogo, frases, configurações. |
| `manifest.json`, `icons/` | Instalação como app (PWA) na Tela de Início. |
| `server.js` | Servidor local simples para testes. |

**Dados no localStorage:**

- `lg:lib`: músicas (letra LRC, sincronia, recorde, favorito), playlists, recentes, frases, traduções escolhidas por você (`trOverride`) e estatísticas de progresso (`stats`: totais e atividade por dia).
- `lg:settings`: configurações.
- `lg:tr`: cache de traduções.

**Como o jogo decide os tempos:** cada frase vai do seu tempo no LRC até o início da próxima (no máximo 10s). No modo Pausa, o vídeo pausa 0,15s antes do fim da frase. No Fluxo, a frase que termina sem resposta é revelada em silêncio.

**Feedback de resposta:** acertou, a opção fica verde e o verso pulsa. Errou, a opção treme em vermelho (o celular vibra, no Android), o verso balança e toca o som de erro. Quando a resposta é revelada, a opção certa acende em verde. Os botões ficam parados por ~1 s para dar tempo de ver. Digitando, a caixa de texto treme em vermelho.

## Limitações conhecidas

- Busca sem chave depende de servidores públicos instáveis.
- Tradução automática é literal (veja [Tradução](#tradução-mymemory-empresa-translated)).
- Letras que não estão no LRCLIB precisam ser coladas e sincronizadas uma vez.
- Alguns vídeos não permitem ser tocados fora do YouTube (erro 101/150). Nesse caso, tente outra versão (lyric video, áudio).
- Dados ficam por aparelho e por navegador. Para levar a outro, use o backup.

## Ideias futuras

- **Traduções ainda melhores:** tradução por IA com chave (entende contexto e gírias e pode explicar expressões), ou DeepL através de um pequeno servidor intermediário.
- Treinar só as frases salvas, como flashcards com áudio.
