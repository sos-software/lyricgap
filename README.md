# LyricGap 🎵

Jogo para aprender idiomas completando a letra de músicas do YouTube. A música toca, a frase aparece com uma lacuna e você completa a palavra que falta.

**Jogar:** https://sos-software.github.io/lyricgap/

---

## Sumário

- [Como jogar](#como-jogar)
- [Modos de jogo](#modos-de-jogo)
- [Controles](#controles)
- [Biblioteca: favoritos, playlists e frases salvas](#biblioteca-favoritos-playlists-e-frases-salvas)
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
3. Toque no botão ▶ grande para jogar.
4. No fim aparecem pontos, porcentagem de acertos, recorde e a lista de **palavras para revisar**.

## Modos de jogo

### Ritmo

| Modo | Como funciona |
|---|---|
| **🌊 Fluxo** (padrão) | A música **nunca para**. As opções aparecem enquanto o verso toca. Acertou: pontos (quanto mais rápido, mais pontos) e sequência 🔥. Errou ou não respondeu a tempo: a palavra é revelada em cor neutra, **sem som de erro e sem voltar**. Os erros aparecem só no final. O anel do botão central mostra o tempo restante do verso. |
| **⏸ Pausa** | O vídeo **pausa no fim de cada frase** com lacuna. Acertou: continua. Errou: **volta a frase** e toca de novo. Na 3ª vez que errar, a resposta aparece. Se você demorar, o trecho repete sozinho (padrão: 8s, configurável). |

### Forma de responder

- **Múltipla escolha** (padrão no celular): 4 opções em formato de **cruz**. No PC, as setas ↑ ← → ↓ ou as teclas 1 a 4 escolhem a opção.
- **Digitando** (padrão no PC): pequenos erros de digitação são aceitos em palavras de 5 letras ou mais, e maiúsculas/acentos não importam.

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
| 💡 **Dica** | Na múltipla escolha, elimina uma opção errada. Digitando, revela uma letra. Usar dica reduz os pontos. |
| ⏸ **Pausa** | Pausa ou continua a música. |
| ⏭ **Pular** | Pula a lacuna (só no modo Pausa). |
| **Velocidade** | Alterna entre 1x, 0.75x e 0.5x. |
| 🔖 | Salva a frase (fica no cartão da frase anterior, nos versos revisitados e na lista do fim da música). |
| ✕ / ⚙ | Sair do jogo / configurações. |

**Tela de jogo:** fica só a **frase atual** (com a lacuna). Acima dela, um cartão discreto mostra a **frase anterior completa e a tradução**. Assim dá para entender o significado enquanto você já ouve a próxima.

## Biblioteca: favoritos, playlists e frases salvas

- **☆ Favoritos:** a estrela ao lado de qualquer música ou na barra da música.
- **＋ Playlists:** adicione músicas a playlists. Uma playlist toca em sequência, e no fim de cada música aparece **"Próxima música ▶"**.
- **Recentes:** últimas 50 músicas abertas.
- **🔖 Frases:** cada frase salva guarda:
  - o texto completo e a tradução;
  - a música (título e artista);
  - o **tempo exato de início e fim** do trecho.

  Na aba **Frases**, tocar numa frase abre um player que **toca só aquele trecho**, com os botões *Ouvir de novo*, *Jogar música*, *YouTube* (abre o vídeo já no segundo certo, bom para compartilhar) e *Remover*.

Tudo fica salvo **no próprio aparelho** (localStorage do navegador). Não existe servidor nem conta.

## De onde vêm a letra, a tradução e a busca

Nenhuma dessas partes usa o Google.

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

### Busca de vídeos

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
| Ritmo (Fluxo / Pausa) | Fluxo |
| Dificuldade | Médio |
| Responder (escolha / digitando) | Escolha no celular, digitando no PC |
| Modo pausa: repetir o trecho se demorar | 8s |
| Velocidade | 1x |
| Idioma das músicas | Inglês |
| Tradução PT-BR | Ligada |
| Sons de acerto/erro | Ligados (no Fluxo não há som de erro) |
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

- `lg:lib`: músicas (letra LRC, sincronia, recorde, favorito), playlists, recentes e frases.
- `lg:settings`: configurações.
- `lg:tr`: cache de traduções.

**Como o jogo decide os tempos:** cada frase vai do seu tempo no LRC até o início da próxima (no máximo 10s). No modo Pausa, o vídeo pausa 0,15s antes do fim da frase. No Fluxo, a frase que termina sem resposta é revelada em silêncio.

## Limitações conhecidas

- Busca sem chave depende de servidores públicos instáveis.
- Tradução automática é literal (veja [Tradução](#tradução-mymemory-empresa-translated)).
- Letras que não estão no LRCLIB precisam ser coladas e sincronizadas uma vez.
- Alguns vídeos não permitem ser tocados fora do YouTube (erro 101/150). Nesse caso, tente outra versão (lyric video, áudio).
- Dados ficam por aparelho e por navegador. Para levar a outro, use o backup.

## Ideias futuras

- **Traduções melhores:** DeepL (grátis até 500 mil caracteres/mês, com chave), tradução por IA (entende contexto e gírias e pode explicar expressões) ou colar uma tradução humana linha a linha.
- Treinar só as frases salvas, como flashcards com áudio.
