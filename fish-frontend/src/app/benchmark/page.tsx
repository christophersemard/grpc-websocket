"use client";

import { useEffect, useRef, useState } from "react";
import { useFishWebSocket } from "@/hooks/useFishWebSocket";
import { useFishGrpc } from "@/hooks/useFishGrpc";
import { MetricsPanel } from "@/components/MetricsPanel";
import { Aquarium } from "@/components/Aquarium";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
} from "recharts";

const scenarios = [
    { label: "100 poissons / 100ms", fishCount: 100, intervalMs: 100 },
    { label: "200 poissons / 50ms", fishCount: 200, intervalMs: 50 },
    { label: "500 poissons / 30ms", fishCount: 500, intervalMs: 30 },
    { label: "1000 poissons / 20ms", fishCount: 1000, intervalMs: 20 },
    { label: "2500 poissons / 20ms", fishCount: 2500, intervalMs: 20 },
    { label: "4000 poissons / 20ms", fishCount: 4000, intervalMs: 20 },
    { label: "5000 poissons / 50ms", fishCount: 5000, intervalMs: 50 },
];

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function BenchmarkLivePage() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [results, setResults] = useState<any[]>([]);
    const [status, setStatus] = useState("Démarrage...");
    const [loading, setLoading] = useState(true);

    const wsRef = useRef<any>(null);
    const grpcRef = useRef<any>(null);

    const ws = useFishWebSocket();
    const grpc = useFishGrpc();

    useEffect(() => {
        wsRef.current = ws;
        grpcRef.current = grpc;
    }, [ws, grpc]);

    useEffect(() => {
        async function runScenario(index: number) {
            const scenario = scenarios[index];
            setStatus(`🛠️ Configuration : ${scenario.label}`);

            await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fishCount: scenario.fishCount,
                    intervalMs: scenario.intervalMs,
                }),
            });

            setStatus(`🕑 Stabilisation (${scenario.fishCount} poissons attendus)...`);
            await waitForStableCount(scenario.fishCount);

            setStatus("🧹 Stabilisé, préparation de la collecte...");
            await delay(3000);

            const wsData = wsRef.current;
            const grpcData = grpcRef.current;

            setResults((prev) => [
                ...prev,
                {
                    label: scenario.label,
                    fishCount: scenario.fishCount,
                    ws: {
                        avg: wsData.avgLatency,
                        median: wsData.medianLatency,
                        stdDev: wsData.stdDevLatency,
                        p10: wsData.percentile10,
                        p90: wsData.percentile90,
                        min: wsData.displayedMin,
                        max: wsData.displayedMax,
                    },
                    grpc: {
                        avg: grpcData.avgLatency,
                        median: grpcData.medianLatency,
                        stdDev: grpcData.stdDevLatency,
                        p10: grpcData.percentile10,
                        p90: grpcData.percentile90,
                        min: grpcData.displayedMin,
                        max: grpcData.displayedMax,
                    },
                },
            ]);

            if (index < scenarios.length - 1) {
                setCurrentIndex(index + 1);
            } else {
                setStatus("✅ Tests terminés !");
                setLoading(false);
            }
        }

        runScenario(currentIndex);
    }, [currentIndex]);

    async function waitForStableCount(expected: number) {
        let tries = 0;
        while (tries < 50) {
            const wsOk = wsRef.current?.activeFishCount == expected;
            const grpcOk = grpcRef.current?.activeFishCount == expected;
            if (wsOk && grpcOk) return;
            await delay(300);
            tries++;
        }
    }

    function exportMarkdown() {
        const header = [
            "## Résultats du benchmark (WebSocket vs gRPC)",
            "",
            "Chaque scénario a été testé pendant 10 secondes après stabilisation du nombre de poissons.",
            "",
            "| Scénario | Protocole | Moyenne | Médiane | P10 | P90 | Écart-type | Min | Max |",
            "|:---|:---|---:|---:|---:|---:|---:|---:|---:|",
        ];

        const rows = results.flatMap((r) => [
            `| ${r.label} | WebSocket | ${r.ws.avg ?? "-"} ms | ${r.ws.median ?? "-"} ms | ${r.ws.p10 ?? "-"} ms | ${r.ws.p90 ?? "-"} ms | ${r.ws.stdDev ?? "-"} ms | ${r.ws.min ?? "-"} ms | ${r.ws.max ?? "-"} ms |`,
            `| | gRPC | ${r.grpc.avg ?? "-"} ms | ${r.grpc.median ?? "-"} ms | ${r.grpc.p10 ?? "-"} ms | ${r.grpc.p90 ?? "-"} ms | ${r.grpc.stdDev ?? "-"} ms | ${r.grpc.min ?? "-"} ms | ${r.grpc.max ?? "-"} ms |`,
            "",
        ]);

        const markdown = [...header, ...rows].join("\n");

        // Copier dans le presse-papier
        navigator.clipboard.writeText(markdown);

        // Télécharger le fichier .md
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "benchmark-resultats.md";
        a.click();
        URL.revokeObjectURL(url);

        alert("✅ Export Markdown copié et téléchargé !");
    }

    return (
        <main className="p-8 w-full mx-auto space-y-8 bg-gray-900 text-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold text-center mb-6">Benchmark WebSocket vs gRPC (temps réel)</h1>

            <p className="text-center text-lg font-semibold text-blue-300">{status}</p>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <Aquarium title="Aquarium WebSocket" fishList={ws.fishList} />
                    <MetricsPanel
                        title="(WebSocket)"
                        totalMessages={ws.totalMessages}
                        activeFishCount={ws.activeFishCount}
                        avgLatency={ws.avgLatency}
                        minLatency={ws.displayedMin}
                        maxLatency={ws.displayedMax}
                        latencies={ws.latencies}
                        medianLatency={ws.medianLatency}
                        stdDevLatency={ws.stdDevLatency}
                    />
                </div>

                <div>
                    <Aquarium title="Aquarium gRPC" fishList={grpc.fishList} />
                    <MetricsPanel
                        title="(gRPC)"
                        totalMessages={grpc.totalMessages}
                        activeFishCount={grpc.activeFishCount}
                        avgLatency={grpc.avgLatency}
                        minLatency={grpc.displayedMin}
                        maxLatency={grpc.displayedMax}
                        latencies={grpc.latencies}
                        medianLatency={grpc.medianLatency}
                        stdDevLatency={grpc.stdDevLatency}
                    />
                </div>
            </div>

            {results.length > 0 && (
                <>
                    <h2 className="text-2xl font-bold mt-12 mb-6">Résultats</h2>

                    <table className="w-full border border-gray-700 rounded mb-6 text-center text-sm">
                        <thead>
                            <tr className="bg-gray-800">
                                <th className="border px-2 py-2">Scénario</th>
                                <th className="border px-2 py-2">Protocole</th>
                                <th className="border px-2 py-2">Moyenne</th>
                                <th className="border px-2 py-2">Médiane</th>
                                <th className="border px-2 py-2">P10</th>
                                <th className="border px-2 py-2">P90</th>
                                <th className="border px-2 py-2">Écart-type</th>
                                <th className="border px-2 py-2">Min</th>
                                <th className="border px-2 py-2">Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.flatMap((r, i) => [
                                <tr key={`ws-${i}`} className="bg-gray-900">
                                    <td className="border px-2 py-2" rowSpan={2}>{r.label}</td>
                                    <td className="border px-2 py-2">WebSocket</td>
                                    <td className="border px-2 py-2">{r.ws.avg} ms</td>
                                    <td className="border px-2 py-2">{r.ws.median} ms</td>
                                    <td className="border px-2 py-2">{r.ws.p10} ms</td>
                                    <td className="border px-2 py-2">{r.ws.p90} ms</td>
                                    <td className="border px-2 py-2">{r.ws.stdDev} ms</td>
                                    <td className="border px-2 py-2">{r.ws.min} ms</td>
                                    <td className="border px-2 py-2">{r.ws.max} ms</td>
                                </tr>,
                                <tr key={`grpc-${i}`} className="bg-gray-800">
                                    <td className="border px-2 py-2">gRPC</td>
                                    <td className="border px-2 py-2">{r.grpc.avg} ms</td>
                                    <td className="border px-2 py-2">{r.grpc.median} ms</td>
                                    <td className="border px-2 py-2">{r.grpc.p10} ms</td>
                                    <td className="border px-2 py-2">{r.grpc.p90} ms</td>
                                    <td className="border px-2 py-2">{r.grpc.stdDev} ms</td>
                                    <td className="border px-2 py-2">{r.grpc.min} ms</td>
                                    <td className="border px-2 py-2">{r.grpc.max} ms</td>
                                </tr>,
                            ])}
                        </tbody>
                    </table>

                    <button
                        onClick={exportMarkdown}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded mb-12"
                    >
                        📋 Exporter en Markdown
                    </button>

                    <h2 className="text-2xl font-bold mt-12 mb-6">Graphique comparatif</h2>

                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={results.map(r => ({ name: r.label, ws: r.ws.avg, grpc: r.grpc.avg }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="ws" stroke="#3b82f6" name="WebSocket" />
                            <Line type="monotone" dataKey="grpc" stroke="#10b981" name="gRPC" />
                        </LineChart>
                    </ResponsiveContainer>
                </>
            )}
        </main>
    );
}
