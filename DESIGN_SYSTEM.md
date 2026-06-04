# Design System — MeshForge

Identidade visual e princípios de UX. Objetivo: **produto SaaS premium**, maduro
e profissional — nunca "open source amador" nem "dashboard administrativo genérico".

> Este documento guia toda a UI. Construído a partir de pesquisa de referências
> de mercado (2026) — destilando o que cada uma faz bem, com **identidade própria**.

---

## 1. Posicionamento e identidade

**MeshForge = "a forja de malhas".** A metáfora central é a **forja**: matéria-prima
(prompt/imagem) entra fria e sai como artefato 3D acabado, sob calor e precisão.

- **Tom:** preciso, calmo, confiante. Ferramenta de profissional, não brinquedo.
- **Diferencial visual:** enquanto Meshy/Leonardo usam roxos/azuis genéricos de "AI",
  o MeshForge adota o **calor de forja** — gradiente âmbar → laranja → magenta sobre
  superfícies quase-pretas. Distinto, memorável, coerente com o logo.

## 2. Referências — o que extrair (não copiar)

| Produto | O que faz bem | Como adaptamos |
| :-- | :-- | :-- |
| **Meshy** | Módulos orientados a tarefa (Image/3D/Print/Animate), biblioteca unificada de assets, prompt helper, preview 3D no browser | IA por "áreas" (Gerar/Workflow/Biblioteca/Export); biblioteca unificada; viewer 3D embutido |
| **Krea** | Painel duplo input→output, feedback visual imediato, controles que parecem software de design | Tela de geração em 2 painéis (controles ↔ resultado ao vivo via WebSocket) |
| **Linear** | Dark-first, tokens em LCH (3 vars), 4 níveis de elevação, motion discreto, contraste alto | Base do nosso sistema de tokens e elevação; motion sóbrio |
| **Raycast** | Superfícies quase-pretas com "escada" sutil, bordas hairline 1px, raios apertados, acento saturado **raro**, Command Palette | ⌘K como ação central; acento usado com parcimônia; bordas finas |
| **Arc** | Sensação nativa, navegação por espaços, leveza | Shell Tauri (futuro) com cara nativa; espaços = projetos |
| **Spline / Sketchfab / Luma** | Viewer 3D no browser em tempo real, orbit/zoom/pan, embed | Viewer com react-three-fiber + drei (orbit, HDRI, wireframe, turntable) |
| **Figma / Fal / Firefly / Scenario / Kaedim** | Densidade profissional, galerias, estados de fila, parâmetros avançados sem poluir | Galeria/biblioteca, indicador de fila global, "advanced params" recolhíveis |

## 3. Tokens — cor

**Dark é o modo padrão e primário.** Light é first-class, porém secundário.
Hierarquia por **4 níveis de elevação** (Linear) + bordas hairline (Raycast).

### Dark (default)
```
--bg-base:        #0A0B0E   /* fundo (mais escuro) */
--surface-1:      #121318   /* cards, sidebar, painéis */
--surface-2:      #1A1C22   /* nested, hover, ativo */
--overlay:        #202229   /* modais, dropdowns, tooltips */
--border:         #26282F   /* hairline 1px */
--border-strong:  #2E3038
--text-primary:   #ECEDF1
--text-secondary: #A0A4AE
--text-muted:     #6B7079
```
### Light (secundário)
```
--bg-base: #FAFAFB  --surface-1: #FFFFFF  --surface-2: #F2F3F5  --overlay: #FFFFFF
--border: #E4E6EA  --text-primary: #16181D  --text-secondary: #5A5F6A  --text-muted: #8A8F99
```
### Acento "forge heat" (a marca)
```
--accent-amber:   #FFD37A
--accent:         #FF6B35   /* laranja — cor de ação primária */
--accent-hover:   #FF7E4D
--accent-magenta: #E8336D
--accent-grad:    linear-gradient(135deg, #FFD37A, #FF6B35 55%, #E8336D)
--accent-soft:    rgba(255,107,53,0.12)   /* fundo tonal */
--accent-on-light:#E85D2A   /* laranja mais profundo p/ contraste no light */
```
Uso do acento: **raro e intencional** (CTA primário, estado ativo, progresso,
destaque do logo). Nunca "arco-íris" por toda a tela.

### Semânticas
```
--success: #3DD68C   --warning: #FFB347   --danger: #F0506E   --info: #5B9DFF
```

## 4. Tokens — tipografia, espaço, forma, motion

- **Tipografia:** `Inter` (UI, com `ss03`), `JetBrains Mono` (seeds, params, paths, hashes).
  Display/wordmark: Inter 800, tracking apertado (igual ao logo).
  Escala: 12 · 13 · **14 (base)** · 16 · 20 · 24 · 32 · 48.
- **Espaçamento:** base 4 → 4·8·12·16·24·32·48·64.
- **Raios:** 6 (inputs/chips) · 10 (cards) · 14 (painéis/modais) · full (pills/avatars). Apertado (Raycast).
- **Elevação (dark):** menos sombra, mais borda + brilho sutil.
  - `e1`: 1px border `--border` + inset `0 1px 0 rgba(255,255,255,.03)`
  - `overlay`: `0 16px 48px rgba(0,0,0,.5)`
  - `glow-accent` (CTA/hero): `0 0 0 1px var(--accent), 0 8px 24px rgba(255,107,53,.25)`
- **Motion (discreto):** 120ms (micro) · 180ms (default) · 240ms (painel).
  Easing `cubic-bezier(0.2,0,0,1)` (ease-out). Spring no viewer 3D.
  **Respeitar `prefers-reduced-motion`.**

## 5. Arquitetura de informação / layout

```
┌───────────────────────────────────────────────────────────────┐
│ TopBar: [projeto ▾]   ………   [fila ◴ 2]  [☾/☀]  [⌘K]          │
├──────────┬────────────────────────────────────────────────────┤
│ Sidebar  │  CANVAS principal                                   │
│ ◇ Gerar  │                                                     │
│ ◇ Projetos                                                     │
│ ◇ Biblioteca                                                   │
│ ◇ Workflow                                                     │
│ ◇ Exportar                                                     │
│ ◇ Config │                                                     │
└──────────┴────────────────────────────────────────────────────┘
```

- **Command Palette (⌘K)** — ações: nova geração, trocar projeto, ir a um asset,
  exportar, alternar tema. (Raycast) — o atalho de power-user que dá cara de produto.
- **Gerar** (2 painéis — Krea): esquerda = modo (Text→Image · Image→Image · Image→3D ·
  Text→3D · Pipeline) + prompt + params (steps/cfg/size/seed) + botão Gerar;
  direita = resultado ao vivo + progresso (WebSocket) + faixa de recentes.
- **Workflow** (Meshy/orquestrador): pipeline SDXL→Hunyuan3D→Blender→Export como
  stepper/nós com status por etapa.
- **Biblioteca**: grid/masonry de assets (imagens + thumbs de malha), filtros, badges
  de tipo, hover preview.
- **Projetos**: cards com capa, contadores, "atualizado há…".
- **Exportar**: chips de formato (GLB/GLTF/OBJ/FBX/STL/USDZ) + download por formato.
- **Viewer 3D** (Spline/Sketchfab): canvas r3f, orbit/zoom/pan, HDRI, toggles
  (wireframe/material/grid/turntable), fullscreen.

## 6. Inventário de componentes
Button (primary forge / secondary / ghost / danger), IconButton, Input/Textarea,
Select, Slider, SegmentedControl/Tabs, Card, Badge/Chip (tipo/status), ProgressBar +
StepIndicator, Toast, Dialog, CommandPalette, Tooltip, Skeleton (loading **real**),
Dropzone (drag&drop), GalleryGrid, AssetCard, ProjectCard, ViewerCanvas, Sidebar,
TopBar, ThemeToggle, QueueIndicator, EmptyState (projetado e honesto).

## 7. Regras anti-"amador" / anti-"admin genérico"
- Ícones consistentes de **stroke** (Lucide/Phosphor) — nada de clipart.
- Acento com parcimônia; superfícies monocromáticas dominam.
- **Estados vazios projetados** ("Nenhum projeto ainda — crie o primeiro"), nunca tela morta.
- **Sem dados falsos/placeholders** (diretriz do projeto): loading = skeleton real de
  dado que está vindo; o que não existe aparece como empty state honesto, não como mock.
- Densidade profissional, alinhamento em grid, tipografia com hierarquia clara.

## 8. Stack de implementação (alvo da Fase 7)
Next.js 14 (App Router) · Tailwind (tokens acima) · shadcn/ui (Radix) ·
`lucide-react` · `framer-motion` (sóbrio) · `cmdk` (palette) ·
`@react-three/fiber` + `@react-three/drei` (viewer) · `next-themes` (dark/light) ·
`@tanstack/react-query` (API) · `socket.io-client` (progresso) · `zustand` (estado leve) ·
fontes via `next/font` (Inter, JetBrains Mono).

> Camada de capacidade `isDesktop()` para o futuro shell Tauri (diálogos nativos,
> orquestração de serviços) — no browser, degrada graciosamente.
