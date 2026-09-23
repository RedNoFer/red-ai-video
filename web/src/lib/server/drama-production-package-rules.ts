import { DRAMA_PACKAGE_AUTHORING_RULES, DRAMA_PACKAGE_COMPILE_MANIFEST, DRAMA_PACKAGE_CONTRACT, DRAMA_PACKAGE_GATE_CODES, DRAMA_PACKAGE_SECTIONS } from "./drama-production-package-contract";

/** The generated contract manifest is the shared source for Agent, Codex and import validation. */
export const DRAMA_PACKAGE_ARCHITECTURE_RULES = `
制作包协议：${DRAMA_PACKAGE_CONTRACT.id}@${DRAMA_PACKAGE_CONTRACT.version}（内容哈希 ${DRAMA_PACKAGE_CONTRACT.contentHash}；规范源 ${DRAMA_PACKAGE_COMPILE_MANIFEST.packageSpecHash}；编译规则 ${DRAMA_PACKAGE_COMPILE_MANIFEST.packageRulesHash}）。固定一级章节顺序：${DRAMA_PACKAGE_SECTIONS.join("、")}。独立 Codex authoring 的正式交付是完整 13 章 Markdown，并嵌入唯一 drama-production-package JSON；项目内 GPT 才使用结构化 package。独立 Markdown 导入时服务端只做结构安全检查和原文保存，不投影、不重写 videoPrompt。
严格门禁代码：${DRAMA_PACKAGE_GATE_CODES.join(", ")}。独立 Codex 必须在输出前按模板与 Skill 完成自检，Chapter 13 的 qualityGateStatus 必须为 passed；project-gpt 路径仍可由 executeDramaScriptRun 使用内部门禁。
${DRAMA_PACKAGE_AUTHORING_RULES}
`;
