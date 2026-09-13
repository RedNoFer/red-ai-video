/** Single source of truth for Agent-generated vozeb-drama-production-package-v1 output. */
export const DRAMA_PACKAGE_ARCHITECTURE_RULES = `
制作包协议：vozeb-drama-production-package-v1。只返回当前请求对应的完整制作包对象和 Markdown，保留 project、assets、episodes、seriesBible、archive 及每镜的既有字段；不得新增静态帧字段。
字段职责：dramaticFunction、performancePlan、lightingPlan、continuity、entryState、exitState、videoPrompt 和 framePlan 必须分别填写当前镜头事实。framePlan.frames 只使用既有 id、sequenceIndex、startSecond、endSecond、startPrompt、actionPrompt、transitionPrompt、endPrompt、imagePrompt；静态正文和视频正文的规则只由唯一导演 Skill 负责。
结构化字段契约：framePlan.start.source 只能声明 independent 或 previous_accepted_actual_tail；framePlan.end.required 必须是布尔值；framePlan.referenceManifest 只保存参考图职责和执行绑定。backgroundNpcPolicy 只用于场景策略与校验，背景 NPC 不进入 characterCodes 或独立角色资产。
生产方案只校验协议允许的视觉、时长、帧数和参考图字段；已有资产按稳定 code 复用，场景全景图保持高清、无人、无文字的单视角全景。参考图职责由 framePlan.referenceManifest 和执行层绑定，不能写进静态正文。只使用当前请求、当前正式资产、当前集事实、当前附件和当前锁定方案。
`;
