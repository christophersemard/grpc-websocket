import WebSocket from "ws";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "fs";

const TEST_CLIENTS = [10, 50, 100, 200, 300, 500];
const TEST_DURATION_MS = 15_000;
const WS_URL = "ws://localhost:3001";
const GRPC_SERVER = "localhost:50051";
const PROTO_PATH = __dirname + "/../fish-server/proto/fish.proto";

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDef) as any;
const FishService = proto.fish.FishService as grpc.ServiceClientConstructor;

type Stats = {
    latencies: number[];
    received: number;
};

function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.floor((p / 100) * sorted.length);
    return sorted[index] ?? sorted[sorted.length - 1];
}

function safeMin(arr: number[]) {
    let min = Infinity;
    for (const v of arr) if (v < min) min = v;
    return Number.isFinite(min) ? min : 0;
}

function safeMax(arr: number[]) {
    let max = -Infinity;
    for (const v of arr) if (v > max) max = v;
    return Number.isFinite(max) ? max : 0;
}

async function runWebSocketTest(clientCount: number) {
    console.log(`\n🌐 WebSocket: ${clientCount} clients...`);
    const statsArray: Stats[] = [];
    let connected = 0;
    let failed = 0;
    const clients: WebSocket[] = [];

    for (let i = 0; i < clientCount; i++) {
        const stats: Stats = { latencies: [], received: 0 };
        statsArray.push(stats);

        try {
            const ws = new WebSocket(WS_URL);
            clients.push(ws);

            ws.on("open", () => {
                connected++;
            });

            ws.on("message", (data) => {
                try {
                    const { data: fishBatch } = JSON.parse(data.toString());
                    const latency = Math.max(
                        0,
                        (Date.now() * 1_000_000 - Number(fishBatch.createdAt)) /
                            1_000_000
                    );
                    stats.latencies.push(latency);
                    stats.received++;
                } catch {}
            });

            ws.on("error", () => {
                failed++;
            });
        } catch {
            failed++;
        }
    }

    await sleep(TEST_DURATION_MS);

    clients.forEach((ws) => ws.close());

    return aggregateResults(statsArray, clientCount, connected, failed);
}

async function runGrpcTest(clientCount: number) {
    console.log(`\n⚙️ gRPC: ${clientCount} clients...`);
    const statsArray: Stats[] = [];
    let connected = 0;
    let failed = 0;

    for (let i = 0; i < clientCount; i++) {
        try {
            const client = new FishService(
                GRPC_SERVER,
                grpc.credentials.createInsecure()
            );
            const stats: Stats = { latencies: [], received: 0 };
            statsArray.push(stats);

            const call = client.subscribeToFish({});

            call.on("data", (fishData: any) => {
                const now = Date.now();
                const latency = Math.max(
                    0,
                    now - Number(fishData.createdAt) / 1_000_000
                );
                stats.latencies.push(latency);
                stats.received++;
            });

            call.on("error", () => {
                failed++;
            });

            connected++;
        } catch {
            failed++;
        }
    }

    await sleep(TEST_DURATION_MS);

    return aggregateResults(statsArray, clientCount, connected, failed);
}

function aggregateResults(
    statsArray: Stats[],
    clientCount: number,
    connected: number,
    failed: number
) {
    const allLatencies = statsArray.flatMap((s) => s.latencies);
    const validLatencies = allLatencies.filter((l) => Number.isFinite(l));
    const totalReceived = statsArray.reduce((a, b) => a + b.received, 0);

    const avg =
        validLatencies.length > 0
            ? validLatencies.reduce((a, b) => a + b) / validLatencies.length
            : 0;
    const p10 = percentile(validLatencies, 10);
    const p90 = percentile(validLatencies, 90);
    const min = safeMin(validLatencies);
    const max = safeMax(validLatencies);
    const perClient = connected > 0 ? totalReceived / connected : 0;
    const lossRate =
        connected > 0
            ? Math.max(0, (clientCount - connected) / clientCount) * 100
            : 100;

    return {
        clients: clientCount,
        connected,
        failed,
        received: totalReceived,
        avg,
        p10,
        p90,
        min,
        max,
        messagesPerClient: perClient,
        lossRate,
    };
}

function color(val: number, thresholds: number[], colors: string[]) {
    for (let i = 0; i < thresholds.length; i++) {
        if (val <= thresholds[i]) {
            return `<span style="color:${colors[i]}">${val.toFixed(1)}</span>`;
        }
    }
    return `<span style="color:${colors[colors.length - 1]}">${val.toFixed(
        1
    )}</span>`;
}

function writeMarkdown(results: { ws: any; grpc: any }[]) {
    let md = `# 📈 Benchmark Comparatif WebSocket vs gRPC

Test simulant différentes charges de clients recevant un flux intensif (5000 poissons / 20ms).  
Durée de chaque test : **15 secondes**.

| Clients demandés | Protocole | Connectés | Taux perte (%) | Msg/Client | Latence Moy (ms) | P10 (ms) | P90 (ms) | Min (ms) | Max (ms) |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|
`;

    for (const r of results) {
        for (const [proto, data] of [
            ["WebSocket", r.ws],
            ["gRPC", r.grpc],
        ]) {
            const colorLoss = color(
                data.lossRate,
                [0, 5, 15],
                ["green", "orange", "red"]
            );
            const colorAvg = color(
                data.avg,
                [30, 100, 200],
                ["green", "orange", "red"]
            );
            md += `| ${data.clients} | ${proto} | ${
                data.connected
            } | ${colorLoss} | ${data.messagesPerClient.toFixed(
                1
            )} | ${colorAvg} | ${data.p10.toFixed(1)} | ${data.p90.toFixed(
                1
            )} | ${data.min.toFixed(1)} | ${data.max.toFixed(1)} |\n`;
        }
    }

    fs.writeFileSync("benchmark-comparatif.md", md, "utf-8");
    console.log("\n✅ Résultats enregistrés dans `benchmark-comparatif.md`");
}

async function main() {
    console.log("🚀 Démarrage du benchmark comparatif WebSocket vs gRPC...");
    const combinedResults: { ws: any; grpc: any }[] = [];

    for (const clientCount of TEST_CLIENTS) {
        const wsResult = await runWebSocketTest(clientCount);
        await sleep(2000);
        const grpcResult = await runGrpcTest(clientCount);

        combinedResults.push({ ws: wsResult, grpc: grpcResult });

        console.log(`✅ Test terminé pour ${clientCount} clients.`);
        await sleep(3000);
    }

    writeMarkdown(combinedResults);
    console.log("\n🎯 Tous les tests sont terminés !");
    process.exit(0);
}

main();
