import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/proxy-dispatcher", () => ({ configureServerProxyDispatcher: vi.fn() }));

const mocks = vi.hoisted(() => ({ fetchSafeOutbound: vi.fn() }));
vi.mock("@/lib/server/safe-outbound-fetch", () => ({ fetchSafeOutbound: (...args: Parameters<typeof fetch>) => mocks.fetchSafeOutbound(...args) }));

import { createProtocolFixtureServer } from "../../../../scripts/protocol-fixture-server.mjs";
import { runGeminiImageTask } from "./image-task-gemini";
import { runOpenAiImageTask } from "./image-task-openai";
import { runCustomImageTask } from "./image-task-custom";
import type { ImageTask } from "@/lib/server/image-task-store";
import { emptyAdvancedConfig } from "@/lib/channel-protocol-registry";

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGPQq/3/H4QZYAwAWewKpRUlAtEAAAAASUVORK5CYII=";
const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`;

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

beforeEach(() => {
    vi.stubEnv("VOZEB_PRO_ALLOW_PRIVATE_UPSTREAMS", "1");
    vi.stubEnv("VOZEB_PRO_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1");
    mocks.fetchSafeOutbound.mockImplementation((url: string | URL, init?: RequestInit) => {
        if (String(url).startsWith("https://cdn.example.com/")) return Promise.resolve(new Response(new Uint8Array([137]), { status: 206, headers: { "content-type": "image/png" } }));
        return fetch(url, init);
    });
});

describe("OpenAI image provider over a live compatible fixture", () => {
    it("parses a valid PNG returned over TCP", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task: ImageTask = {
            id: "image-live",
            userId: "user-live",
            username: "user",
            displayName: "User",
            kind: "generation",
            source: "image-workbench",
            status: "running",
            createdAt: 1,
            updatedAt: 1,
            config: { baseUrl: origin, apiKey: "fixture-key", apiFormat: "openai", model: "mock-image", channelId: "fixture-image" },
            candidateConfigs: [],
            prompt: "create a blue protocol test image",
            references: [],
        };

        try {
            await expect(runOpenAiImageTask(task, "http://internal", "http://public", "", true)).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,iVBOR/) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]).toMatchObject({ method: "POST", path: "/v1/images/generations" });
            expect(fixture.requests[0]?.headers.authorization).toBe("Bearer fixture-key");
            expect(JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}")).toMatchObject({ model: "mock-image", response_format: "url" });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("uses the selected GlobalAiOpc image preset once and polls its declared result path", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = "http://127.0.0.1:" + address.port;
        const task: ImageTask = {
            id: "image-global-live",
            userId: "user-live",
            username: "user",
            displayName: "User",
            kind: "generation",
            source: "image-workbench",
            status: "running",
            createdAt: 1,
            updatedAt: 1,
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-2",
                channelId: "fixture-global-image",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "globalaiopc", globalAiOpcPreset: "image-gpt-image-2", createPath: "/image2/images", queryPath: "/result/:task_id" },
            },
            candidateConfigs: [],
            prompt: "create a blue protocol test image",
            references: [],
        };

        try {
            const submitted = await runOpenAiImageTask(task, "http://internal", "http://public", "", true);
            expect(submitted.pending).toMatchObject({ id: expect.stringMatching(/^fixture-image-/) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]).toMatchObject({ method: "POST", path: "/v1/image2/images" });
            expect(fixture.requests[0]?.headers.authorization).toBe("Bearer fixture-key");
            expect(fixture.requests[0]?.headers["idempotency-key"]).toBe("image-task:image-global-live:attempt:1");
            const body = JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}");
            expect(body).toMatchObject({ model: "gpt-image-2", prompt: "create a blue protocol test image", resolution: "2k" });

            const { pollOpenAiImageTask } = await import("./image-task-support");
            const result = await pollOpenAiImageTask(task.config, submitted.pending!.id, origin, origin, "", "", true);
            expect(result.dataUrl).toMatch(/(?:^data:image\/png;base64,|\/media\/fixture\.png$)/);
            expect(fixture.requests.map((request) => request.path)).toEqual(["/v1/image2/images", "/v1/result/" + submitted.pending!.id]);
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("sends sub2api edits to the documented endpoint with images image_url objects", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = "http://127.0.0.1:" + address.port;
        const task = liveImageTask(origin, {
            id: "image-sub2api-live",
            kind: "edit",
            references: [{ type: "image/png", dataUrl: "https://cdn.example.com/reference.png" }],
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-1",
                channelId: "fixture-sub2api",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "sub2api", createPath: "/images/generations", editPath: "/images/edits", supportsReferenceImage: true },
            },
        });

        try {
            await expect(runOpenAiImageTask(task, "", "", "", true)).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]?.path).toBe("/v1/images/edits");
            const body = JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}");
            expect(body.images).toEqual([{ image_url: "https://cdn.example.com/reference.png" }]);
            expect(body.image_urls).toBeUndefined();
            expect(fixture.requests[0]?.headers["idempotency-key"]).toBe("image-task:image-sub2api-live:attempt:1");
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("transmits every reference image in a multi-reference sub2api edit", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const references = ["character.png", "scene.png", "prop.png"].map((name) => ({ name, type: "image/png", dataUrl: `https://cdn.example.com/${name}` }));
        const task = liveImageTask(origin, {
            id: "image-sub2api-multi-reference-live",
            kind: "edit",
            references,
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-2",
                channelId: "fixture-sub2api",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "sub2api", createPath: "/images/generations", editPath: "/images/edits", supportsReferenceImage: true },
            },
        });

        try {
            await expect(runOpenAiImageTask(task, "", "", "", true)).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
            const submissions = fixture.requests.filter((request) => request.method === "POST" && request.path === "/v1/images/edits");
            expect(submissions).toHaveLength(1);
            const body = JSON.parse(submissions[0]?.body.toString("utf8") || "{}");
            expect(body.images).toEqual(references.map((reference) => ({ image_url: `https://cdn.example.com/${reference.name}` })));
            expect(body.images).toHaveLength(3);
            expect(body.image_urls).toBeUndefined();
            expect(body.prompt).toContain("images[].image_url");
            expect(body.prompt).toContain("Use every supplied reference image in array order");
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("sends sub2api text-to-image using only the strict image request fields", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: "image-sub2api-generation-live",
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-2",
                channelId: "fixture-sub2api",
                quality: "high",
                size: "9:16",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "sub2api", createPath: "/images/generations", editPath: "/images/generations", supportsReferenceImage: true },
            },
        });

        try {
            await expect(runOpenAiImageTask(task, "", "", "", true)).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]?.path).toBe("/v1/images/generations");
            expect(JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}")).toEqual({
                model: "gpt-image-2",
                prompt: "create a blue protocol test image",
                n: 1,
                quality: "high",
                size: "1024x1536",
                output_format: "png",
            });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("sends a public reference URL directly to sub2api edit images", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: "image-sub2api-local-reference",
            kind: "edit",
            references: [{ name: "candidate.png", type: "image/png", dataUrl: "", url: "https://cdn.example.com/reference.png" }],
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-2",
                channelId: "",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "sub2api", createPath: "/images/generations", editPath: "/images/edits", supportsReferenceImage: true },
            },
        });

        try {
            await expect(runOpenAiImageTask(task, origin, "https://app.example.com", "", true)).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
            const submission = fixture.requests.find((request) => request.method === "POST" && request.path === "/v1/images/edits");
            expect(submission).toBeDefined();
            const body = JSON.parse(submission?.body.toString("utf8") || "{}");
            expect(body.images).toEqual([{ image_url: "https://cdn.example.com/reference.png" }]);
            expect(fixture.requests.map((request) => request.path)).toEqual(["/v1/images/edits"]);
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("sends standard OpenAI edits as multipart with the reference image file", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: "image-openai-edit-live",
            kind: "edit",
            references: [{ name: "reference.png", type: "image/png", dataUrl: PNG_DATA_URL }],
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-1",
                channelId: "fixture-openai",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "openai", createPath: "/images/generations", editPath: "/images/edits", supportsReferenceImage: true },
            },
        });

        try {
            await expect(runOpenAiImageTask(task, origin, "", "", true)).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]?.path).toBe("/v1/images/edits");
            expect(fixture.requests[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
            const body = fixture.requests[0]?.body.toString("latin1") || "";
            expect(body).toContain('name="image"; filename="reference.png"');
            expect(body).toContain("Content-Type: image/png");
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("sends Stable Diffusion img2img references as inline base64", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: "image-stable-diffusion-edit-live",
            kind: "edit",
            references: [{ name: "reference.png", type: "image/png", dataUrl: PNG_DATA_URL }],
            config: {
                baseUrl: origin,
                apiKey: "",
                apiFormat: "openai",
                model: "mock-image",
                channelId: "fixture-stable-diffusion",
                size: "1024x1024",
                advancedConfig: {
                    ...emptyAdvancedConfig(),
                    protocol: "stable-diffusion",
                    createPath: "/sdapi/v1/txt2img",
                    editPath: "/sdapi/v1/img2img",
                    requestTemplate: '{"prompt":"{{prompt}}","width":"{{width}}","height":"{{height}}","batch_size":1,"init_images":"{{images}}","override_settings":{"sd_model_checkpoint":"{{model}}"},"override_settings_restore_afterwards":true}',
                    resultField: "images[0]",
                    supportsReferenceImage: true,
                },
            },
        });

        try {
            await expect(runCustomImageTask(task, origin, "", "", true)).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]?.path).toBe("/sdapi/v1/img2img");
            expect(JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}")).toMatchObject({ init_images: [PNG_DATA_URL] });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("uses TokenGo's async image runtime for text and reference image requests", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: "image-buming-image-live",
            kind: "edit",
            references: [{ type: "image/png", dataUrl: "https://cdn.example.com/reference.png" }],
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-2-official",
                channelId: "fixture-buming-image",
                size: "9:16",
                quality: "high",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "buming-image", createPath: "/api/v1/model-runtime/invoke", queryPath: "/api/v1/model-runtime/tasks/:task_id", requestTemplate: '{"modality":"image","model_id":"{{model}}","operation":"generate","params":{"prompt":"{{prompt}}","mode":"{{mode}}","aspect_ratio":"{{aspect_ratio}}","resolution":"{{resolution}}","quality":"{{quality}}","count":1,"output_format":"{{output_format}}","images":"{{images}}"}}', resultField: "result_url", statusField: "status", referenceRule: "参考图必须是公网 URL。", supportsReferenceImage: true },
            },
        });

        try {
            const submitted = await runCustomImageTask(task, "", "", "", true);
            expect(submitted.pending).toMatchObject({ id: expect.stringMatching(/^fixture-buming-image-/) });
            const body = JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}");
            expect(fixture.requests[0]?.path).toBe("/api/v1/model-runtime/invoke");
            expect(body.params).toMatchObject({ mode: "image-edit", aspect_ratio: "9:16", resolution: "4K", images: ["https://cdn.example.com/reference.png"] });

            const result = await import("./image-task-custom").then(({ pollCustomImageTask }) => pollCustomImageTask(task, submitted.pending!.id, `${origin}/api/v1/model-runtime/invoke`, "", true));
            expect(result.dataUrl).toMatch(/(?:^data:image\/png;base64,|\/media\/fixture\.png$)/);
            expect(fixture.requests.map((request) => request.path)).toEqual(["/api/v1/model-runtime/invoke", `/api/v1/model-runtime/tasks/${submitted.pending!.id}`]);
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("uploads a local reference before TokenGo image editing", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: "image-buming-local-reference",
            kind: "edit",
            references: [{ name: "candidate.png", type: "image/png", dataUrl: PNG_DATA_URL }],
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "gpt-image-2-official",
                channelId: "fixture-buming-image",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "buming-image", createPath: "/api/v1/model-runtime/invoke", queryPath: "/api/v1/model-runtime/tasks/:task_id", requestTemplate: '{"modality":"image","model_id":"{{model}}","operation":"generate","params":{"prompt":"{{prompt}}","mode":"{{mode}}","images":"{{images}}"}}', resultField: "result_url", statusField: "status", referenceRule: "参考图必须是公网 URL。", supportsReferenceImage: true },
            },
        });

        try {
            await expect(runCustomImageTask(task, origin, "", "", true)).resolves.toMatchObject({ pending: { id: expect.stringMatching(/^fixture-buming-image-/) } });
            expect(fixture.requests.map((request) => request.path)).toEqual(["/v1/files", "/api/v1/model-runtime/invoke"]);
            expect(fixture.requests[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
            expect(JSON.parse(fixture.requests[1]?.body.toString("utf8") || "{}").params).toMatchObject({ mode: "image-edit", images: ["https://cdn.example.com/fixture-upload.png"] });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it("sends Gemini image references as inlineData", async () => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: "image-gemini-edit-live",
            kind: "edit",
            references: [{ name: "reference.png", type: "image/png", dataUrl: PNG_DATA_URL }],
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "gemini",
                model: "gemini-image",
                channelId: "fixture-gemini",
                advancedConfig: { ...emptyAdvancedConfig(), protocol: "compatible", createPath: "/models/:model:generateContent", supportsReferenceImage: true },
            },
        });

        try {
            await expect(runGeminiImageTask(task, origin, "")).resolves.toMatchObject({ dataUrl: expect.stringMatching(/^data:image\/png;base64,/) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]?.path).toBe("/v1beta/models/gemini-image:generateContent");
            const body = JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}");
            expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: "image/png", data: PNG_BASE64 } });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it.each([
        ["Stable Diffusion", "stable-diffusion", "/sdapi/v1/txt2img", '{"prompt":"{{prompt}}","width":"{{width}}","height":"{{height}}","override_settings":{"sd_model_checkpoint":"{{model}}"}}', "images[0]"],
        ["custom", "custom", "/custom/images", '{"deployment":"{{model}}","input":"{{prompt}}","dimensions":"{{size}}"}', "data.image_url"],
    ] as const)("uses the exact %s image template and result field", async (_name, protocol, createPath, requestTemplate, resultField) => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = "http://127.0.0.1:" + address.port;
        const task = liveImageTask(origin, {
            id: "image-" + protocol + "-live",
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: "fixture-image-model",
                channelId: "fixture-" + protocol,
                size: "1024x1024",
                advancedConfig: { ...emptyAdvancedConfig(), protocol, createPath, requestTemplate, resultField },
            },
        });

        try {
            await expect(runCustomImageTask(task, "", "", "", true)).resolves.toMatchObject({ dataUrl: expect.any(String) });
            expect(fixture.requests).toHaveLength(1);
            expect(fixture.requests[0]?.path).toBe(createPath);
            expect(fixture.requests[0]?.headers["idempotency-key"]).toBe("image-task:" + task.id + ":attempt:1");
            const body = JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}");
            if (protocol === "stable-diffusion") expect(body).toMatchObject({ prompt: task.prompt, width: 1024, height: 1024, override_settings: { sd_model_checkpoint: task.config.model } });
            else expect(body).toEqual({ deployment: task.config.model, input: task.prompt, dimensions: "1024x1024" });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });

    it.each([
        ["custom", "high"],
        ["yumeng", "4K"],
    ] as const)("keeps image quality mapping isolated for the %s protocol", async (protocol, expectedResolution) => {
        const fixture = createProtocolFixtureServer();
        await new Promise<void>((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
        const address = fixture.server.address();
        if (!address || typeof address === "string") throw new Error("Protocol fixture did not bind a TCP port");
        const origin = `http://127.0.0.1:${address.port}`;
        const task = liveImageTask(origin, {
            id: `image-${protocol}-quality`,
            config: {
                baseUrl: origin,
                apiKey: "fixture-key",
                apiFormat: "openai",
                model: protocol === "yumeng" ? "seedream-5.0" : "fixture-image-model",
                channelId: `fixture-${protocol}`,
                quality: "high",
                advancedConfig: { ...emptyAdvancedConfig(), protocol, createPath: "/custom/images", requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}","resolution":"{{resolution}}"}', resultField: "data.image_url" },
            },
        });

        try {
            await expect(runCustomImageTask(task, "", "", "", true)).resolves.toMatchObject({ dataUrl: expect.any(String) });
            expect(JSON.parse(fixture.requests[0]?.body.toString("utf8") || "{}")).toMatchObject({ resolution: expectedResolution });
        } finally {
            await new Promise<void>((resolve, reject) => fixture.server.close((error?: Error) => (error ? reject(error) : resolve())));
        }
    });
});

function liveImageTask(origin: string, patch: Partial<ImageTask>): ImageTask {
    return {
        id: "image-live",
        userId: "user-live",
        username: "user",
        displayName: "User",
        kind: "generation",
        source: "image-workbench",
        status: "running",
        createdAt: 1,
        updatedAt: 1,
        config: { baseUrl: origin, apiKey: "fixture-key", apiFormat: "openai", model: "mock-image", channelId: "fixture-image" },
        candidateConfigs: [],
        prompt: "create a blue protocol test image",
        references: [],
        ...patch,
    };
}
