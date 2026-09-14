import { DRAMA_PACKAGE_AUTHORING_RULES, DRAMA_PACKAGE_COMPILE_MANIFEST, DRAMA_PACKAGE_CONTRACT, DRAMA_PACKAGE_GATE_CODES, DRAMA_PACKAGE_SECTIONS } from "./drama-production-package-contract";

/** The generated contract manifest is the shared source for Agent, Codex and import validation. */
export const DRAMA_PACKAGE_ARCHITECTURE_RULES = `
制作包协议：${DRAMA_PACKAGE_CONTRACT.id}@${DRAMA_PACKAGE_CONTRACT.version}（内容哈希 ${DRAMA_PACKAGE_CONTRACT.contentHash}；规范源 ${DRAMA_PACKAGE_COMPILE_MANIFEST.packageSpecHash}；编译规则 ${DRAMA_PACKAGE_COMPILE_MANIFEST.packageRulesHash}）。固定一级章节顺序：${DRAMA_PACKAGE_SECTIONS.join("、")}。只返回当前请求对应的完整制作包对象和 Markdown，保留 project、assets、episodes、seriesBible、archive 及每镜的既有字段；不得新增静态帧字段。
严格门禁代码：${DRAMA_PACKAGE_GATE_CODES.join(", ")}。门禁失败时只能返回失败原因，不能声明制作包已完成；通过门禁后才由 executeDramaScriptRun 确定性序列化。
${DRAMA_PACKAGE_AUTHORING_RULES}
`;
