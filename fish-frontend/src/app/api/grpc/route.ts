import { NextRequest } from "next/server";
import { ReadableStream } from "stream/web";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PROTO_PATH = process.cwd() + "/proto/fish.proto";

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: false,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef) as any;
const FishService = proto.fish.FishService as grpc.ServiceClientConstructor;

const client = new FishService(
    "server:50051",
    grpc.credentials.createInsecure()
);

type Subscriber = {
    controller: ReadableStreamDefaultController<Uint8Array>;
    interval: NodeJS.Timeout;
};

const subscribers = new Set<Subscriber>();
let call: grpc.ClientReadableStream<any> | null = null;

function startGrpcStream() {
    if (call) return;

    console.log("🎣 Ouverture du stream gRPC (subscribeToFish)...");
    call = client.subscribeToFish({});

    call!.on("data", (data: any) => {
        // data = { createdAt, fishes }

        const chunk = `data: ${JSON.stringify(data)}\n\n`;
        const encoded = new TextEncoder().encode(chunk);

        for (const sub of subscribers) {
            try {
                sub.controller.enqueue(encoded);
            } catch (err) {
                console.warn("❌ Enqueue failed", err);
            }
        }
    });

    call!.on("end", () => {
        console.log("📭 Stream gRPC terminé.");
        call = null;
    });

    call!.on("error", (err) => {
        console.error("🔥 Erreur gRPC :", err);
        call = null;
    });
}

export async function GET(_req: NextRequest) {
    startGrpcStream();

    const encoder = new TextEncoder();

    let thisSubscriber: Subscriber;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const interval = setInterval(() => {
                controller.enqueue(encoder.encode(": ping\n\n"));
            }, 15000);

            thisSubscriber = { controller, interval };
            subscribers.add(thisSubscriber);

            console.log(`🧑‍💻 Nouveau client SSE (${subscribers.size})`);
        },

        cancel() {
            if (thisSubscriber) {
                clearInterval(thisSubscriber.interval);
                subscribers.delete(thisSubscriber);
                console.log(`👋 Client SSE déconnecté (${subscribers.size})`);
            }

            if (subscribers.size === 0 && call) {
                console.log("🛑 Plus de clients, fermeture du stream gRPC");
                call.cancel();
                call = null;
            }
        },
    });

    return new Response(stream as BodyInit, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
