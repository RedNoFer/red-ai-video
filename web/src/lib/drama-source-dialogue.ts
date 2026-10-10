/** Source facts for review only; this parser never writes dialogue or prompts. */
export type DramaSourceDialogue = { speaker?: string; text: string; offset: number };

export function extractDramaSourceDialogues(source: string, speakers: readonly string[] = []): DramaSourceDialogue[] {
    const lines: DramaSourceDialogue[] = [];
    const covered: Array<[number, number]> = [];
    const speakerLines = /^[ \t]*([\p{L}·]+)[ \t]*[：:][ \t]*(?:\n[ \t]*)?([^\n]+)/gmu;
    for (const match of source.matchAll(speakerLines)) {
        if (/^(?:场景|时间|地点|画面|人声|音效|台词|动作|旁白说明)$/u.test(match[1])) continue;
        if (!speakers.includes(match[1]) && /(?:说|道|问|喊|答)$/u.test(match[1])) continue;
        let text = match[2].trim();
        let end = match.index + match[0].length;
        while (source[end] === "\n") {
            const continuation = source.slice(end + 1).split("\n")[0];
            if (!continuation.trim() || /^[ \t]*(?:[\p{L}·]+[ \t]*[：:]|[（(【\[])/u.test(continuation)) break;
            if (/[。！？!?”」』"]$/u.test(text) && !/^[ \t]+/u.test(continuation)) break;
            text += `\n${continuation}`;
            end += continuation.length + 1;
        }
        text = text.replace(/^[“「『"]|[”」』"]$/gu, "");
        if (!text) continue;
        lines.push({ speaker: match[1], text, offset: match.index });
        covered.push([match.index, end]);
    }
    for (const match of source.matchAll(/“([^”]+)”|「([^」]+)」|『([^』]+)』|"([^"\n]+)"/gu)) {
        if (covered.some(([start, end]) => match.index >= start && match.index < end)) continue;
        const before =
            source
                .slice(0, match.index)
                .split(/\n|[。！？；]/u)
                .at(-1) || "";
        const explicit = before.match(/([\p{L}·]+?)(?:说|道|问|喊|答)(?:[：:]\s*)?$/u)?.[1];
        const named = speakers.filter((name) => before.includes(name)).sort((left, right) => before.lastIndexOf(right) - before.lastIndexOf(left) || right.length - left.length)[0];
        const speaker = named && /说|道|问|喊|答/u.test(before.slice(before.lastIndexOf(named) + named.length)) ? named : explicit;
        lines.push({ ...(speaker ? { speaker } : {}), text: (match[1] || match[2] || match[3] || match[4]).trim(), offset: match.index });
    }
    return lines.sort((left, right) => left.offset - right.offset);
}

/** Off-screen dialogue remains the same speaker; containment is not identity. */
export function normalizeDramaSpeaker(value: string) {
    return value.replace(/[\s\u3000]/gu, "").replace(/(?:[（(](?:场内)?画外(?:音|对白)?[）)]|(?:在)?场内画外(?:音|对白)?|画外音)$/u, "");
}
