// benchmark-grpc-shared.ts

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as fs from "fs";

const PROTO_PATH = __dirname + "/../fish-server/proto/fish.proto";
const SERVER_ADDRESS = "localhost:50051";
const TEST_DURATION_MS = 10_000;
const CLIENT_COUNTS = [10, 50, 100, 250, 500];

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDef) as any;
const FishService = proto.fish.FishService as grpc.ServiceClientConstructor;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.floor((p / 100) * sorted.length);
    return sorted[index];
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

async function runSharedBenchmark(clientCount: number) {
    const client = new FishService(
        SERVER_ADDRESS,
        grpc.credentials.createInsecure()
    );
    const statsArray: { latencies: number[]; received: number }[] = [];

    // On initialise les "faux clients"
    for (let i = 0; i < clientCount; i++) {
        statsArray.push({ latencies: [], received: 0 });
    }

    return new Promise<any>((resolve) => {
        const call = client.subscribeToFish({});

        call.on("data", (data: any) => {
            const now = Date.now();
            const latency = Math.max(
                0,
                now - Number(data.createdAt) / 1_000_000
            );

            // Chaque faux client reçoit chaque poisson
            for (const stats of statsArray) {
                stats.latencies.push(latency);
                stats.received++;
            }
        });

        setTimeout(() => {
            call.cancel();

            const allLatencies = statsArray.flatMap((s) => s.latencies);
            const validLatencies = allLatencies.filter((l) =>
                Number.isFinite(l)
            );
            const totalReceived = statsArray.reduce(
                (a, b) => a + b.received,
                0
            );

            const avg = validLatencies.length
                ? validLatencies.reduce((a, b) => a + b) / validLatencies.length
                : 0;
            const p10 = percentile(validLatencies, 10);
            const p90 = percentile(validLatencies, 90);
            const min = safeMin(validLatencies);
            const max = safeMax(validLatencies);
            const messagesPerClient = totalReceived / clientCount;

            resolve({
                clients: clientCount,
                received: totalReceived,
                avg,
                p10,
                p90,
                min,
                max,
                messagesPerClient,
            });
        }, TEST_DURATION_MS);
    });
}

function writeMarkdown(results: any[]) {
    let md = `# 📈 Benchmark gRPC (1 seul stream partagé)

Ce test simule **1 seul stream** gRPC partagé par tous les clients locaux.  
Latence mesurée sur **10 secondes**.

| Clients | Messages totaux | Msg/client | Latence Moy. (ms) | P10 (ms) | P90 (ms) | Min (ms) | Max (ms) |
|:---|---:|---:|---:|---:|---:|---:|---:|\n`;

    for (const res of results) {
        md += `| ${res.clients} | ${
            res.received
        } | ${res.messagesPerClient.toFixed(1)} | ${res.avg.toFixed(
            1
        )} | ${res.p10.toFixed(1)} | ${res.p90.toFixed(1)} | ${res.min.toFixed(
            1
        )} | ${res.max.toFixed(1)} |\n`;
    }

    fs.writeFileSync("benchmark-grpc-shared.md", md, "utf-8");
    console.log("📄 Résultats enregistrés dans `benchmark-grpc-shared.md`");
}

async function main() {
    console.log("🚀 Benchmark gRPC partagé – démarrage\n");
    const allResults = [];

    for (const count of CLIENT_COUNTS) {
        console.log(`🧑 Simuler ${count} clients locaux...`);
        const res = await runSharedBenchmark(count);

        console.log(`📥 Messages reçus: ${res.received}`);
        console.log(
            `⏱️ Latence: moyenne ${res.avg.toFixed(
                1
            )} ms | p10 ${res.p10.toFixed(1)} ms | p90 ${res.p90.toFixed(
                1
            )} ms\n`
        );

        allResults.push(res);
        await sleep(3000);
    }

    writeMarkdown(allResults);
    console.log("✅ Benchmark terminé.");
}

main();
