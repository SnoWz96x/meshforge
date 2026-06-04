# Conformance Checklist — MeshForge

Checklist **permanente** a ser executado **antes de cada entrega**. Garante que
requisitos não regridam e que nada falso seja apresentado como pronto.

> Automação: `tools/conformance/check.mjs` (a implementar) deve validar os itens
> marcados como **[auto]**. Os demais são revisão manual **[manual]**.

## 1. Componentes obrigatórios presentes
- [ ] **[auto]** ComfyUI registrado no `manifest.lock.json`
- [ ] **[auto]** Hunyuan3D registrado no `manifest.lock.json`
- [ ] **[auto]** Blender registrado no `manifest.lock.json`
- [ ] **[auto]** SDXL presente no `models/registry.json`
- [ ] **[manual]** Nenhum componente obrigatório foi removido da arquitetura

## 2. Integrações obrigatórias intactas
- [ ] **[auto]** Fila `comfyui` referenciada no código (API enfileira; worker consome)
- [ ] **[manual]** Pipeline oficial mantém SDXL → Hunyuan3D → Blender → Export
- [ ] **[manual]** Nenhuma integração obrigatória virou opcional/plugin removível

## 3. Sem placeholders / fakes
- [ ] **[auto]** Grep por `TODO|FIXME|MOCK|PLACEHOLDER|dummy|fake` em código de produção, revisado
- [ ] **[auto]** Nenhum endpoint retorna dados mockados para funcionalidade marcada ✅
- [ ] **[manual]** Toda tela/botão presente está realmente funcional (ou marcado como WIP visível)
- [ ] **[manual]** Itens 🧪 (código não validado) NÃO aparecem como ✅ no tracking

## 4. Build / saúde
- [ ] **[auto]** `pnpm -r typecheck` passa
- [ ] **[auto]** `pnpm db:generate` ok; migrations aplicáveis
- [ ] **[auto]** API `/health` responde
- [ ] **[manual]** Serviços de GPU sobem com a config validada (ZLUDA)

## 5. Documentação sincronizada
- [ ] **[manual]** `README.md` reflete o estado real
- [ ] **[manual]** `ARCHITECTURE.md` reflete decisões atuais
- [ ] **[manual]** `ROADMAP.md` com status correto
- [ ] **[manual]** `CHANGELOG.md` atualizado com a mudança
- [ ] **[manual]** `REQUIREMENTS_TRACKING.md` atualizado (nada concluído sem registro)

## 6. Conformidade com as diretrizes de produto
- [ ] **[manual]** UI mantém padrão "SaaS premium" (não dashboard genérico, não amador)
- [ ] **[manual]** Decisões de escopo simplificadas têm justificativa técnica explícita

---

**Regra de ouro:** se um item não puder ser marcado com honestidade, a entrega
não está pronta — documentar como pendente em `REQUIREMENTS_TRACKING.md`.
