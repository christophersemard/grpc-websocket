"use client";

import { use, useEffect, useState } from "react";

type Props = {
    title: string
    totalMessages: number
    activeFishCount: number
    avgLatency: number
    minLatency: number
    maxLatency: number
    latencies: number[]
    medianLatency: number;
    stdDevLatency: number;

}


export function MetricsPanel({
    title,
    totalMessages,
    activeFishCount,
    avgLatency,
    minLatency,
    maxLatency,
    latencies,
    medianLatency,
    stdDevLatency,

}: Props) {



    return (
        <section className="mt-6 p-6 w-128 mx-auto bg-blue-50 border-4 border-blue-200">
            <h2 className="text-base font-semibold text-blue-900 mb-4">
                Metrics {title}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm text-blue-900">

                <div>
                    <p className="text-xs uppercase text-blue-800 mb-1">
                        Poissons actifs
                    </p>
                    <p className="text-lg font-mono font-semibold">
                        {activeFishCount}
                    </p>
                </div>

                <div>
                    <p className="text-xs uppercase text-blue-800 mb-1">
                        Latence moyenne
                    </p>
                    <p className="text-lg font-mono font-semibold">
                        {avgLatency} ms
                    </p>
                </div>

                <div>
                    <p className="text-xs uppercase text-blue-800 mb-1">
                        Latence min/max
                    </p>
                    <p className="text-lg font-mono font-semibold">
                        {minLatency} ms / {maxLatency} ms
                    </p>
                </div>

                <div>
                    <p className="text-xs uppercase text-blue-800 mb-1">Latence médiane</p>
                    <p className="text-lg font-mono font-semibold">{medianLatency} ms</p>
                </div>

                <div>
                    <p className="text-xs uppercase text-blue-800 mb-1">Écart-type</p>
                    <p className="text-lg font-mono font-semibold">{stdDevLatency} ms</p>
                </div>

            </div>

            <div className="mt-4">
                <p className="text-xs uppercase text-blue-800 mb-1">
                    Latences récentes
                </p>
                <div className="flex gap-1 items-end h-8">
                    {latencies.slice(-20).map((lat, i) => (
                        <div
                            key={i}
                            className="w-2 rounded-sm"
                            style={{
                                height: `${Math.min(
                                    Math.round(lat) / 2,
                                    32
                                )}px`,
                                backgroundColor:
                                    lat > 100 ? "#ef4444" : "#3b82f6",
                            }}
                            title={`${Math.round(lat)} ms`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
