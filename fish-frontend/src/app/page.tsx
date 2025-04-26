"use client";

import { useState } from "react"
import { useFishWebSocket } from "@/hooks/useFishWebSocket"
import { Aquarium } from "@/components/Aquarium"
import { MetricsPanel } from "@/components/MetricsPanel"
import { useFishGrpc } from "@/hooks/useFishGrpc"

function ConfigForm() {
  const [fishCount, setFishCount] = useState(50)
  const [intervalMs, setIntervalMs] = useState(50)
  const [status, setStatus] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/config", {
      method: "POST",
      body: JSON.stringify({ fishCount, intervalMs }),
      headers: { "Content-Type": "application/json" },
    })

    if (res.ok) {
      setStatus("✅ Config mise à jour !")
    } else {
      setStatus("❌ Erreur serveur")
    }

    setTimeout(() => setStatus(""), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-4 mb-4">
      <div>
        <label className="text-sm block text-gray-300">Nombre de poissons</label>
        <input
          type="number"
          className="bg-gray-700 border px-2 py-1 w-32 text-white"
          value={fishCount}
          onChange={(e) => setFishCount(parseInt(e.target.value))}
        />
      </div>
      <div>
        <label className="text-sm block text-gray-300">Intervalle (ms)</label>
        <input
          type="number"
          className="bg-gray-700 border px-2 py-1 w-32 text-white"
          value={intervalMs}
          onChange={(e) => setIntervalMs(parseInt(e.target.value))}
        />
      </div>
      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
      >
        Mettre à jour
      </button>
      {status && <p className="text-sm ml-4">{status}</p>}
    </form>
  )
}

export default function AquariumPage() {
  const {
    fishList: wsFish,
    displayedLatency: wsDisplayedLatency,
    displayedMin: wsDisplayedMin,
    displayedMax: wsDisplayedMax,
    totalMessages: wsTotalMessages,
    activeFishCount: wsActiveCount,
    latencies: wsLatencies,
    medianLatency: wsMedian,
    stdDevLatency: wsStdDev,
  } = useFishWebSocket()

  const {
    fishList: grpcFish,
    displayedLatency: grpcDisplayedLatency,
    displayedMin: grpcDisplayedMin,
    displayedMax: grpcDisplayedMax,
    totalMessages: grpcTotalMessages,
    activeFishCount: grpcActiveCount,
    latencies: grpcLatencies,
    medianLatency: grpcMedian,
    stdDevLatency: grpcStdDev,
  } = useFishGrpc()

  return (
    <main className="p-8 space-y-6 bg-gray-800 text-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold text-center">Aquarium</h1>

      <div className="max-w-2xl mx-auto">
        <ConfigForm />
      </div>

      <div className="grid grid-cols-2 space-x-8 max-w-7xl mx-auto h-full py-8">
        <div>
          <Aquarium title="Aquarium WebSocket" fishList={wsFish} />

          <MetricsPanel
            title="(WebSocket)"
            totalMessages={wsTotalMessages}
            activeFishCount={wsActiveCount}
            avgLatency={wsDisplayedLatency}
            minLatency={wsDisplayedMin}
            maxLatency={wsDisplayedMax}
            medianLatency={wsMedian}
            stdDevLatency={wsStdDev}
            latencies={wsLatencies}
          />
        </div>

        <div>
          <Aquarium title="Aquarium gRPC" fishList={grpcFish} />

          <MetricsPanel
            title="(gRPC)"
            totalMessages={grpcTotalMessages}
            activeFishCount={grpcActiveCount}
            avgLatency={grpcDisplayedLatency}
            minLatency={grpcDisplayedMin}
            maxLatency={grpcDisplayedMax}
            latencies={grpcLatencies}
            medianLatency={grpcMedian}
            stdDevLatency={grpcStdDev}
          />
        </div>
      </div>
    </main>
  )
}
