import { createProtocolFixtureServer } from "./protocol-fixture-server.mjs";

const port = Number(process.env.VOZEB_PRO_PROTOCOL_FIXTURE_PORT) || 4010;
const host = process.env.VOZEB_PRO_PROTOCOL_FIXTURE_HOST || "127.0.0.1";

const fixture = createProtocolFixtureServer({
    imagePath: process.env.VOZEB_PRO_PROTOCOL_FIXTURE_IMAGE,
    videoPath: process.env.VOZEB_PRO_PROTOCOL_FIXTURE_VIDEO,
    responseDelayMs: process.env.VOZEB_PRO_PROTOCOL_FIXTURE_DELAY_MS,
    failImage: process.env.VOZEB_PRO_PROTOCOL_FIXTURE_FAIL_IMAGE === "1",
});

fixture.server.listen(port, host, () => {
    console.log(`Protocol fixture ready at http://${host}:${port}`);
});

setInterval(() => {}, 60_000);
