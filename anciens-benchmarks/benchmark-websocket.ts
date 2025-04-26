import WebSocket from "ws";
import fs from "fs";

const TEST_CLIENTS = [10, 50, 100, 250];
const TEST_DURATION_MS = 10_000;
const WS_URL = "ws://localhost:3001";

type Stats = { latencies: number[]; received: number };

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.floor((p / 100) * sorted.length);
    return sorted[index];
}

export function safeMin(arr: number[]) {
    let min = Infinity;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] < min) min = arr[i];
    }
    return Number.isFinite(min) ? min : 0;
}

export function safeMax(arr: number[]) {
    let max = -Infinity;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > max) max = arr[i];
    }
    return Number.isFinite(max) ? max : 0;
}
function color(val: number, thresholds: number[], colors: string[]) {
    for (let i = 0; i < thresholds.length; i++) {
        if (val <= thresholds[i])
            return `<span style="color:${colors[i]}">${val.toFixed(1)}</span>`;
    }
    return `<span style="color:${colors.at(-1)}">${val.toFixed(1)}</span>`;
}

async function runTest(clientCount: number) {
    const statsArray: Stats[] = [];
    const clients: WebSocket[] = [];
    let connected = 0;
    let failed = 0;

    const BATCH_SIZE = 50;
    const BATCH_DELAY = 100;

    for (let i = 0; i < clientCount; i++) {
        const stats: Stats = { latencies: [], received: 0 };
        statsArray.push(stats);

        try {
            const ws = new WebSocket(WS_URL);
            clients.push(ws);

            ws.on("open", () => connected++);

            ws.on("message", (data) => {
                try {
                    const { type, data: fishBatch } = JSON.parse(
                        data.toString()
                    );
                    // console.log(
                    //     `Client ${i} received fish: ${fishBatch.fishes[0].id} (${fishBatch.fishes[0].x}, ${fishBatch.fishes[0].y})`
                    // );
                    const latency = Math.max(
                        0,
                        (Date.now() * 1_000_000 - Number(fishBatch.createdAt)) /
                            1_000_000
                    );
                    stats.latencies.push(latency);
                    stats.received++;
                } catch {}
            });

            ws.on("error", () => failed++);
        } catch {
            failed++;
        }

        if (i % BATCH_SIZE === 0) await sleep(BATCH_DELAY);
    }

    await sleep(TEST_DURATION_MS);
    clients.forEach((ws) => ws.close());

    const allLatencies = statsArray.flatMap((s) => s.latencies);
    const valid = allLatencies.filter((l) => Number.isFinite(l));
    const total = statsArray.reduce((a, b) => a + b.received, 0);

    const avg = valid.reduce((a, b) => a + b, 0) / (valid.length || 1);

    console.log(
        `✅ ${clientCount} clients : ${connected} connectés, ${failed} échoués, ${total} messages reçus`
    );
    console.log(
        `📊 Latence moyenne : ${avg.toFixed(1)} ms, P10 : ${percentile(
            valid,
            10
        )}, P90 : ${percentile(valid, 90)}, Min : ${safeMin(
            valid
        )}, Max : ${safeMax(valid)}`
    );

    return {
        clients: clientCount,
        connected,
        failed,
        received: total,
        avg,
        p10: percentile(valid, 10),
        p90: percentile(valid, 90),
        min: safeMin(valid),
        max: safeMax(valid),
        messagesPerClient: total / Math.max(connected, 1),
    };
}

function writeMarkdown(results: any[]) {
    let md = `# 📈 Benchmark WebSocket – Résultats de performance

Simule des connexions WebSocket vers \`ws://localhost:3001\`, pendant **10 secondes**.

| Clients demandés | Connectés | Msg/client | Latence Moy. (ms) | P10 | P90 | Min | Max |
|------------------|-----------|------------|-------------------|-----|-----|-----|-----|
`;

    for (const r of results) {
        const connDisplay =
            r.connected < r.clients
                ? `<span style="color:red">${r.connected}</span>`
                : r.connected;

        md += `| ${r.clients} | ${connDisplay} | ${r.messagesPerClient.toFixed(
            1
        )} | `;
        md += `${color(r.avg, [30, 100, 200], ["green", "orange", "red"])} | `;
        md += `${r.p10.toFixed(1)} | ${r.p90.toFixed(1)} | ${r.min.toFixed(
            1
        )} | ${r.max.toFixed(1)} |\n`;
    }

    fs.writeFileSync("benchmark-websocket-results.md", md, "utf-8");
    console.log(
        "✅ Résultats enregistrés dans `benchmark-websocket-results.md`"
    );
}

(async () => {
    const results = [];
    for (const count of TEST_CLIENTS) {
        console.log(`🚀 Test avec ${count} clients WebSocket...`);
        results.push(await runTest(count));
        await sleep(3000);
    }
    writeMarkdown(results);
})();
