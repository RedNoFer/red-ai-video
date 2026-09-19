import { SEEDANCE_SPECIAL_MODELS, SEEDANCE_SPECIAL_PROMPT_GUIDANCE } from "@/lib/seedance-special";
import type { DramaEpisode, DramaProject, DramaShot } from "@/lib/drama-project-contract";

export type DramaPromptAdviceCategory = "length" | "cut" | "composition" | "continuity" | "dialogue" | "references" | "skill";

export type DramaPromptLimitProfile = {
    providerId: string;
    label: string;
    model?: string;
    characterLimit?: number;
    wordLimit?: number;
    known: boolean;
    note: string;
};

export type DramaPromptUsage = {
    characterCount: number;
    wordCount: number;
    chineseCharacterCount: number;
    limit?: number;
    unit: "characters" | "words" | "unknown";
    remaining?: number;
    ratio?: number;
    nearLimit: boolean;
    overLimit: boolean;
};

export type DramaPromptAdvice = {
    id: string;
    category: DramaPromptAdviceCategory;
    severity: "info" | "warning";
    title: string;
    message: string;
    impact: string;
    recommendation: string;
    insertText?: string;
};

export type DramaPromptAdviceReport = {
    profile: DramaPromptLimitProfile;
    usage: DramaPromptUsage;
    suggestions: DramaPromptAdvice[];
};

const seedanceSpecialModelIds = new Set<string>(SEEDANCE_SPECIAL_MODELS.map(([id]) => id));

/**
 * Supplier limits are kept in one place so new provider documentation can be
 * added without changing the UI. These values mirror the provider adapter.
 */
export function resolveDramaPromptLimit(model?: string): DramaPromptLimitProfile {
    const normalizedModel = model?.trim() || "";
    if (seedanceSpecialModelIds.has(normalizedModel) || /seedance.*special|sd_2\.0.*special/i.test(normalizedModel)) {
        return {
            providerId: "seedance-special",
            label: "Seedance 2.0 特价版",
            model: normalizedModel || undefined,
            characterLimit: SEEDANCE_SPECIAL_PROMPT_GUIDANCE.chineseCharacters,
            wordLimit: SEEDANCE_SPECIAL_PROMPT_GUIDANCE.englishWords,
            known: true,
            note: "供应商文档将此作为建议线，不是当前请求构造器的硬拒绝条件。含中文时参考 500 字符，纯英文参考 1000 词。",
        };
    }
    return {
        providerId: "unknown",
        label: normalizedModel ? `当前模型：${normalizedModel}` : "当前供应商/模型未锁定",
        model: normalizedModel || undefined,
        known: false,
        note: "当前没有配置该模型的公开提示词上限，建议向供应商确认。",
    };
}

export function measureDramaPrompt(prompt: string, profile: DramaPromptLimitProfile = resolveDramaPromptLimit()): DramaPromptUsage {
    const value = prompt.trim();
    const characterCount = Array.from(value).length;
    const chineseCharacterCount = Array.from(value.match(/\p{Script=Han}/gu) || []).length;
    const wordCount = value ? value.split(/\s+/).filter(Boolean).length : 0;
    const hasChinese = chineseCharacterCount > 0;
    const unit = profile.known ? (hasChinese ? "characters" : "words") : "unknown";
    const limit = unit === "characters" ? profile.characterLimit : unit === "words" ? profile.wordLimit : undefined;
    const current = unit === "characters" ? characterCount : unit === "words" ? wordCount : 0;
    const ratio = limit ? current / limit : undefined;
    return {
        characterCount,
        wordCount,
        chineseCharacterCount,
        limit,
        unit,
        remaining: limit === undefined ? undefined : Math.max(0, limit - current),
        ratio,
        nearLimit: Boolean(ratio !== undefined && ratio >= 0.85),
        overLimit: Boolean(ratio !== undefined && ratio > 1),
    };
}

export function compactDramaSupplierPrompt(prompt: string) {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const rawLine of prompt.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
            if (output.length && output[output.length - 1] !== "") output.push("");
            continue;
        }
        const key = line.replace(/\s+/g, " ");
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(line);
    }
    while (output[output.length - 1] === "") output.pop();
    return output.join("\n");
}

function normalizedPromptText(value?: string) {
    return (value || "")
        .replace(/\s+/g, "")
        .replace(/[，。！？、；：,.!?;:]/g, "")
        .trim();
}

function hasAny(value: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(value));
}

function isVertical(project: DramaProject) {
    const ratio = project.productionBible?.ratio || project.ratio || "";
    return /9\s*[:：/]\s*16/.test(ratio);
}

function addAdvice(target: DramaPromptAdvice[], advice: DramaPromptAdvice) {
    if (!target.some((item) => item.id === advice.id)) target.push(advice);
}

export function analyzeDramaPromptAdvice(input: { project: DramaProject; episode: DramaEpisode; shot: DramaShot; prompt: string; model?: string }): DramaPromptAdviceReport {
    const profile = resolveDramaPromptLimit(input.model);
    const usage = measureDramaPrompt(input.prompt, profile);
    const prompt = input.prompt.trim();
    const normalized = normalizedPromptText(prompt);
    const suggestions: DramaPromptAdvice[] = [];
    const frames = input.shot.framePlan?.frames || [];
    const dialogue = input.shot.utterances.filter((item) => item.text.trim());
    const hasDialogue = dialogue.length > 0 || Boolean(input.shot.dialogue.trim());
    const vertical = isVertical(input.project);

    if (usage.overLimit) {
        addAdvice(suggestions, {
            id: "prompt-length-over-limit",
            category: "length",
            severity: "warning",
            title: "超过供应商建议长度",
            message: `${profile.label}当前约 ${usage.unit === "characters" ? usage.characterCount : usage.wordCount}${usage.unit === "characters" ? " 字符" : " 词"}，已超过 ${usage.limit} 建议线，不代表接口必然拒绝。`,
            impact: "提示词越长，后半段时间线、对白或连续性要求越可能被弱化、截断或执行不完整。",
            recommendation: "优先保留人物身份与服装、动作、关键对白、时间线、站位空间关系和道具状态；删除重复风格词、重复禁止项和解释性段落。",
        });
    } else if (usage.nearLimit) {
        addAdvice(suggestions, {
            id: "prompt-length-near-limit",
            category: "length",
            severity: "warning",
            title: "提示词接近供应商上限",
            message: `${profile.label}剩余约 ${usage.remaining}${usage.unit === "characters" ? " 字符" : " 词"}，后续继续添加镜头说明可能触发截断。`,
            impact: "新增的禁止项或解释性内容可能挤掉对白、动作和镜头承接信息。",
            recommendation: "建议先生成供应商执行版，保留关键事实，风格和重复禁止项放入导演版追溯。",
        });
    }

    if (frames.length > 1) {
        const frameTexts = frames.map((frame) => normalizedPromptText([frame.actionPrompt, frame.transitionPrompt, frame.endPrompt, frame.imagePrompt].filter(Boolean).join(" ")));
        if (frameTexts.some((value, index) => value && value === frameTexts[index - 1])) {
            addAdvice(suggestions, {
                id: "repeated-frame-performance",
                category: "cut",
                severity: "warning",
                title: "相邻关键帧动作或表演重复",
                message: "相邻时间段的动作描述高度相同，硬切后可能得到重复的一模一样的神态、手势或构图。",
                impact: "切换只改变时间，不产生新的剧情信息，观感会像重复剪辑。",
                recommendation: "让相邻镜头至少改变一项：景别、机位、视线对象、手部动作、身体停顿或反应结果。",
                insertText: "相邻镜头必须产生可见变化：改变景别或机位，并用新的眼神、手部、呼吸或身体停顿承接上一镜动作结果。",
            });
        }
        if (frames.some((frame) => !frame.transitionPrompt?.trim())) {
            addAdvice(suggestions, {
                id: "cut-missing-trigger",
                category: "cut",
                severity: "warning",
                title: "部分切点缺少硬切触发和承接",
                message: "逐帧计划中有切换没有写清动作结果、切后新机位或信息目的。",
                impact: "供应商可能把多个阶段融合成一次连续推进，或随意重复人物表演。",
                recommendation: "每次切换补齐：触发事件、新景别/机位、切后信息目的、动作或视线承接。",
                insertText: "每次硬切都要由可见动作结果或台词节点触发；切后必须改变景别、机位或构图，并写明新的信息目的和动作/视线承接。",
            });
        }
    }

    const hardCutText = [input.shot.transitionIn, input.shot.transitionOut, ...frames.map((frame) => frame.transitionPrompt)].filter(Boolean).join(" ");
    if (frames.length > 1 && /硬切|hard\s*cut|jump\s*cut/i.test(hardCutText) && !hasAny(hardCutText, [/说完|完成|收住|抬眼|合唇|停顿|动作结果|视线落定|触发/i])) {
        addAdvice(suggestions, {
            id: "hard-cut-no-event",
            category: "cut",
            severity: "warning",
            title: "硬切没有明确动作结果",
            message: "虽然标记了硬切，但没有找到可执行的台词、动作或视线触发点。",
            impact: "切点可能落在任意位置，切换前后人物状态容易重复或跳变。",
            recommendation: "把切点绑定到说完关键词、抬眼、收手、合唇、视线落定等可见事件。",
            insertText: "硬切必须绑定可见触发事件，例如说完关键词、抬眼、收手、合唇或视线落定；切后继承上一镜动作结果。",
        });
    }

    if (vertical && !hasAny(prompt, [/9\s*[:：/]\s*16/, /竖屏/, /vertical/i, /1080\s*[×x]\s*1920/])) {
        addAdvice(suggestions, {
            id: "vertical-format-missing",
            category: "composition",
            severity: "warning",
            title: "执行版未明确 9:16 竖屏构图",
            message: "项目是 9:16，但当前视频提示词没有明确画幅和竖屏构图约束。",
            impact: "模型可能按横版构图生成，再把人物压缩或裁到只剩脸部。",
            recommendation: "补充 9:16 竖屏、人物安全空间和背景锚点，按竖屏重新设计镜头距离。",
            insertText: "画幅为 9:16 竖屏；人物保留完整头顶、下巴、主要衣领和必要手部安全空间，不贴近画面边缘；每镜保留可辨认的空间背景锚点。",
        });
    }
    if (vertical && hasAny(prompt, [/特写/, /近景/, /大头/, /close[- ]?up/i]) && !hasAny(prompt, [/完整头顶/, /完整下巴/, /衣领/, /安全空间/, /不裁脸/])) {
        addAdvice(suggestions, {
            id: "vertical-crop-risk",
            category: "composition",
            severity: "warning",
            title: "近景存在裁脸风险",
            message: "竖屏近景没有写明头顶、下巴、衣领和边缘安全空间。",
            impact: "镜头切换或运镜时，人物可能被裁成只剩脸部，手部和服装信息消失。",
            recommendation: "将近景改为保留完整头顶、下巴和主要衣领的中近景，并为运镜留出上下左右余量。",
            insertText: "所有近景保留完整头顶、下巴、主要衣领和必要手部，不贴边、不裁脸；运镜过程中保持安全空间。",
        });
    }

    const characterCount = input.shot.characterIds.length;
    if (vertical && characterCount >= 2 && !hasAny(prompt, [/画面左/, /画面右/, /左侧/, /右侧/, /对话轴/, /双人/, /过肩/, /two[- ]shot/i])) {
        addAdvice(suggestions, {
            id: "vertical-two-person-layout",
            category: "composition",
            severity: "info",
            title: "双人竖屏站位没有明确左右关系",
            message: "当前镜头包含多个角色，但提示词没有固定画面左右、视线方向或对话轴。",
            impact: "镜头切换时人物容易互换位置、越轴或被挤到画面边缘。",
            recommendation: "明确每个人物的画面侧、看向对方的方向，以及回到中全景时需要恢复的空间锚点。",
            insertText: "双人对话保持固定左右站位和相反视线方向，保持 180° 对话轴；切回全景时恢复原座次和空间锚点。",
        });
    }

    if (hasDialogue) {
        const missingSpeaker = dialogue.length > 0 && dialogue.some((item) => item.speaker.trim() && !prompt.includes(item.speaker.trim()));
        const missingLine = dialogue.length > 0 && dialogue.some((item) => item.text.trim().length >= 4 && !prompt.includes(item.text.trim()));
        if ((missingSpeaker || missingLine) && !hasAny(normalized, [/对白/, /台词/, /说话人/, /dialogue/i])) {
            const lines = dialogue.map((item) => `${item.speaker || "当前说话人"}：“${item.text.trim()}”`).join("；");
            addAdvice(suggestions, {
                id: "dialogue-speaker-binding",
                category: "dialogue",
                severity: "warning",
                title: "对白与说话人绑定不够明确",
                message: "剧本中有对白，但执行版没有稳定地写明说话人和对应台词。",
                impact: "模型可能让错误角色开口、漏掉关键句，或自行补出不符合剧情的新对白。",
                recommendation: `补充明确对白绑定：${lines}`,
                insertText: `对白只由指定角色说出，不新增对白：${lines}。保留自然停顿和句尾沉默。`,
            });
        }
    }

    const manifest = input.shot.framePlan?.referenceManifest || [];
    if (manifest.length) {
        const roles = new Set(manifest.map((item) => item.role));
        const expectedRoles = [input.shot.characterIds.length ? "character_anchor" : undefined, input.shot.sceneId ? "scene_anchor" : undefined, input.shot.propIds.length ? "prop_anchor" : undefined].filter(Boolean);
        if (expectedRoles.some((role) => !roles.has(role as (typeof manifest)[number]["role"]))) {
            addAdvice(suggestions, {
                id: "reference-role-gap",
                category: "references",
                severity: "warning",
                title: "参考素材职责可能不完整",
                message: "镜头已经声明了角色、场景或道具，但参考清单没有覆盖全部职责。",
                impact: "角色图可能改写场景，场景图可能替代人物身份，导致站位、服装或道具状态漂移。",
                recommendation: "明确角色参考只锁定身份/服装/饰品，场景参考只锁定空间/光线/座次/道具，连续关键帧按时间顺序约束动作状态。",
                insertText: "参考图职责：角色参考图只负责人物身份、骨相、发型、服装和饰品，不改写场景；场景参考图只负责空间、光线、座次和道具，不替代角色身份；连续关键帧按时间顺序使用，锁定对应时刻的动作状态。",
            });
        }
    }

    if (hasDialogue && characterCount >= 2 && !hasAny(prompt, [/侧\s*45度/, /过肩/, /180\s*[°度]?\s*轴线/, /对话轴/, /side\s*45/i, /180[- ]degree/i])) {
        addAdvice(suggestions, {
            id: "skill-axis-and-angle",
            category: "skill",
            severity: "info",
            title: "建议补充对话轴线与反打机位",
            message: "当前是双人对白镜头，但执行版没有体现稳定的 180° 轴线或侧 45 度/过肩关系。",
            impact: "反打时人物左右关系可能翻转，硬切会显得像随机换角度。",
            recommendation: "默认使用侧 45 度或过肩机位，保持 180° 轴线、左右视线和反打方向一致。",
            insertText: "双人对白默认采用侧 45 度或过肩机位，保持 180° 对话轴；反打保持人物左右位置和相反视线方向一致，不越轴。",
        });
    }

    if (input.shot.cameraMotion.trim() && !hasAny(prompt, [/运镜/, /推近/, /拉开/, /横移/, /摇镜/, /跟拍/, /push|pull|pan|track|dolly/i])) {
        addAdvice(suggestions, {
            id: "camera-motion-purpose",
            category: "skill",
            severity: "info",
            title: "运镜缺少剧情目的",
            message: "镜头资料中声明了运镜，但供应商执行版没有说明运镜对应的视线、决定或压力变化。",
            impact: "模型可能自动添加推拉、旋转或环绕，运镜和表演脱节。",
            recommendation: "明确运镜只服务于人物决定、视线变化或压力升级；未写运镜的镜头保持锁定机位。",
            insertText: "运镜只服务于人物决定、视线变化或压力升级；未明确写出的镜头保持锁定机位，不自动添加旋转、环绕、甩镜或数字变焦。",
        });
    }

    if (frames.length >= 3 && !input.shot.dramaticFunction?.trim()) {
        addAdvice(suggestions, {
            id: "shot-function-missing",
            category: "cut",
            severity: "info",
            title: "多镜头片段缺少镜头功能分配",
            message: "当前镜头包含多个时间段，但没有记录定场、关系、施压、反应或留白等信息目的。",
            impact: "镜头数量增加后容易出现多个镜头承担同一功能，切换看似频繁但剧情不推进。",
            recommendation: "可按“定场 → 关系 → 施压 → 细节 → 反应 → 转折 → 决定 → 留白”分配信息目的。",
            insertText: "为每个镜头写明独立信息目的；可按定场、关系、施压、细节、反应、转折、决定、留白分配，不要求每个片段都完整覆盖。",
        });
    }

    return { profile, usage, suggestions };
}
