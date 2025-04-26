import { useEffect, useRef, useState } from "react";
import { FishData, ReceivedFish } from "./useFishWebSocket";

function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function stdDev(arr: number[]): number {
    if (arr.length === 0) return 0;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
        arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function useFishGrpc(collectTo?: (latency: number) => void) {
    const [fishMap, setFishMap] = useState<Map<string, ReceivedFish>>(
        new Map()
    );
    const [latencies, setLatencies] = useState<number[]>([]);
    const [displayedLatency, setDisplayedLatency] = useState(0);
    const [displayedMin, setDisplayedMin] = useState(0);
    const [displayedMax, setDisplayedMax] = useState(0);
    const [totalMessages, setTotalMessages] = useState(0);

    const latenciesRef = useRef<number[]>([]);
    const controlRef = useRef(!!collectTo);

    useEffect(() => {
        latenciesRef.current = latencies;
    }, [latencies]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setFishMap((prev) => {
                const updated = new Map(prev);
                for (const [id, fish] of updated) {
                    if (now - fish.lastSeen > 2000) {
                        updated.delete(id);
                    }
                }
                return updated;
            });

            const lats = latenciesRef.current;
            if (lats.length === 0) return;

            const avg = lats.reduce((a, b) => a + b, 0) / lats.length;
            const min = Math.min(...lats);
            const max = Math.max(...lats);

            setDisplayedLatency(Math.round(avg));
            setDisplayedMin(Math.round(min));
            setDisplayedMax(Math.round(max));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const eventSource = new EventSource("/api/grpc");

        eventSource.onmessage = (event) => {
            const data: { createdAt: string; fishes: FishData[] } = JSON.parse(
                event.data
            );

            const nowMs = Date.now();
            const nowNs = BigInt(nowMs) * 1_000_000n;
            const createdAtNs = BigInt(data.createdAt);
            const latency = Number(nowNs - createdAtNs) / 1_000_000;

            if (controlRef.current && collectTo) collectTo(latency);

            const now = Date.now();
            const nowFishMap = new Map<string, ReceivedFish>();

            for (const fish of data.fishes) {
                nowFishMap.set(fish.id, {
                    ...fish,
                    latencyMs: latency,
                    lastSeen: now,
                });
            }

            setFishMap((prev) => {
                const updated = new Map(prev);
                nowFishMap.forEach((fish, id) => updated.set(id, fish));
                return updated;
            });

            setLatencies((prev) => [...prev.slice(-100), latency]);
            setTotalMessages((prev) => prev + data.fishes.length);
        };

        return () => eventSource.close();
    }, []);

    const sortedLatencies = [...latencies].sort((a, b) => a - b);

    return {
        fishList: Array.from(fishMap.values()),
        activeFishCount: fishMap.size,
        totalMessages,
        latencies,
        displayedLatency,
        displayedMin,
        displayedMax,
        avgLatency: latencies.length
            ? Math.round(
                  latencies.reduce((a, b) => a + b, 0) / latencies.length
              )
            : 0,
        medianLatency: latencies.length ? Math.round(median(latencies)) : 0,
        stdDevLatency: latencies.length ? Math.round(stdDev(latencies)) : 0,
        percentile10: latencies.length
            ? Math.round(percentile(latencies, 10))
            : 0,
        percentile90: latencies.length
            ? Math.round(percentile(latencies, 90))
            : 0,
    };
}
