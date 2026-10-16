import type { DramaProject } from "@/lib/drama-project-contract";

/** Source text stays in the saved project for generation, but is not needed in editor responses. */
export function dramaProjectForClient(project: DramaProject): DramaProject {
    if (!project.sourceAssets?.some((asset) => "textContent" in asset)) return project;
    return {
        ...project,
        sourceAssets: project.sourceAssets.map((asset) => {
            const metadata = { ...asset };
            delete metadata.textContent;
            return metadata;
        }),
    };
}
