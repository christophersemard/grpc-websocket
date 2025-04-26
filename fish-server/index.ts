import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";

const PROTO_PATH = __dirname + "/proto/fish.proto";

// === Chargement du proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: false,
    oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

// === WebSocket
const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer });
const connectedClients = new Set<WebSocket>();

wss.on("connection", (ws) => {
    console.log("🔌 Client WebSocket connecté");

    // ✅ Envoi d’un message de synchro horloge
    ws.send(
        JSON.stringify({
            type: "init",
            data: { serverTime: Date.now() }, // ms
        })
    );

    connectedClients.add(ws);
    ws.on("close", () => {
        connectedClients.delete(ws);
        console.log("❌ Client WebSocket déconnecté");
    });
});

// === gRPC abonnés
const grpcSubscribers: grpc.ServerWritableStream<any, any>[] = [];

// === Config dynamique
let fishCount = 500;
let intervalMs = 50;

// === Générateurs
type Fish = ReturnType<typeof createFish>;
let fishGenerators: Fish[] = [];

function createFish(id: string) {
    let x = Math.random() * 100;
    let y = Math.random() * 100;
    let vx = (Math.random() - 0.5) * 1.2;
    let vy = (Math.random() - 0.5) * 1.2;

    return () => {
        vx += (Math.random() - 0.5) * 0.2;
        vy += (Math.random() - 0.5) * 0.2;
        vx = Math.max(-1.5, Math.min(1.5, vx));
        vy = Math.max(-1.5, Math.min(1.5, vy));
        x += vx;
        y += vy;
        if (x < 0 || x > 100) vx *= -1;
        if (y < 0 || y > 100) vy *= -1;

        return {
            id,
            x,
            y,
            vx,
            vy,
        };
    };
}

function updateGenerators() {
    fishGenerators = Array.from({ length: fishCount }, (_, i) =>
        createFish(`fish-${i + 1}`)
    );
    console.log(`♻️ Générateurs recréés : ${fishCount} poissons`);
}

// === Boucle d’envoi
let generationTimer: NodeJS.Timeout;

function startIntervalLoop() {
    if (generationTimer) clearInterval(generationTimer);

    generationTimer = setInterval(() => {
        const fishes = fishGenerators.map((gen) => gen());
        const createdAt = Date.now() * 1_000_000;
        const batch = { createdAt: createdAt.toString(), fishes };

        // gRPC
        grpcSubscribers.forEach((stream) => {
            try {
                stream.write(batch);
            } catch (err) {
                if (err instanceof Error) {
                    console.log("❌ Erreur envoi gRPC :", err.message);
                } else {
                    console.log("❌ Erreur inconnue gRPC :", err);
                }
            }
        });

        // WebSocket
        const message = JSON.stringify({ type: "fish", data: batch });
        connectedClients.forEach((ws) => {
            if (ws.readyState === 1) ws.send(message);
        });
    }, intervalMs);

    console.log(`🔁 Nouvelle boucle d’envoi toutes les ${intervalMs} ms`);
}

// === Services gRPC
const fishService = {
    SubscribeToFish: (call: grpc.ServerWritableStream<any, any>) => {
        grpcSubscribers.push(call);
        console.log("📡 Client gRPC connecté");

        call.on("cancelled", () => {
            const i = grpcSubscribers.indexOf(call);
            if (i !== -1) grpcSubscribers.splice(i, 1);
            console.log("❌ Client gRPC déconnecté");
        });
    },

    UpdateConfig: (
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ) => {
        const config = call.request;

        if (typeof config.fishCount === "number") {
            fishCount = config.fishCount;
        }
        if (typeof config.intervalMs === "number") {
            intervalMs = config.intervalMs;
        }

        console.log(
            `⚙️ Config modifiée : ${fishCount} poissons, intervalle ${intervalMs}ms`
        );

        updateGenerators();
        startIntervalLoop();

        callback(null, { ok: true });
    },
};

// === Lancement gRPC
const grpcServer = new grpc.Server();
grpcServer.addService(proto.fish.FishService.service, fishService);

grpcServer.bindAsync(
    "0.0.0.0:50051",
    grpc.ServerCredentials.createInsecure(),
    () => {
        grpcServer.start();
        console.log("🎣 Serveur gRPC prêt sur le port 50051");
    }
);

// === Lancement WebSocket
httpServer.listen(3001, () => {
    console.log("🌐 WebSocket prêt sur ws://localhost:3001");
});

// Démarrage initial
updateGenerators();
startIntervalLoop();
