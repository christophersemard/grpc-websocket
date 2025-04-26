"use client";

import { useEffect, useRef } from "react";
import { ReceivedFish } from "@/hooks/useFishWebSocket";

interface Props {
    title: string;
    fishList: ReceivedFish[];
}

function getColorForFish(id: string): string {
    const colors = [
        "#ef4444", "#3b82f6", "#22c55e", "#facc15", "#a855f7",
        "#ec4899", "#f97316", "#14b8a6", "#6366f1", "#f59e0b",
        "#84cc16", "#fb7185", "#06b6d4", "#8b5cf6", "#e879f9",
        "#10b981", "#0ea5e9", "#78716c", "#71717a", "#737373",
    ];
    const index = parseInt(id.replace("fish-", ""), 10) % colors.length;
    return colors[index];
}

function getSize(fish: ReceivedFish): number {
    const speed = Math.sqrt(fish.vx ** 2 + fish.vy ** 2);
    return Math.min(12, 8 + speed * 8); // pixels
}

export function Aquarium({ title, fishList }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrame: number;

        const render = () => {
            const now = Date.now();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const fish of fishList) {
                if (now - fish.lastSeen > 500) continue;

                const x = (fish.x / 100) * canvas.width;
                const y = (fish.y / 100) * canvas.height;
                const size = getSize(fish);
                const color = getColorForFish(fish.id);

                ctx.beginPath();
                ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = "#ffffff";
                ctx.stroke();
            }

            animationFrame = requestAnimationFrame(render);
        };

        animationFrame = requestAnimationFrame(render);

        return () => cancelAnimationFrame(animationFrame);
    }, [fishList]);

    return (
        <div>
            <h2 className="text-xl font-bold mb-4 text-center px-4 py-2 text-white backdrop-blur border-blue-200 z-10 relative">
                {title}
            </h2>

            <div className="relative mx-auto border-4 border-blue-400 bg-gradient-to-b from-blue-300 to-blue-900 overflow-hidden shadow-inner backdrop-blur-sm w-128 h-64">
                <canvas
                    ref={canvasRef}
                    width={512}
                    height={256}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
}
