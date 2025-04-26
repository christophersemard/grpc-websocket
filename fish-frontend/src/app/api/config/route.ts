import { NextRequest } from "next/server";
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
    "server:50051", // ou localhost si local
    grpc.credentials.createInsecure()
);

export async function POST(req: NextRequest) {
    const { fishCount, intervalMs } = await req.json();

    return new Promise<Response>((resolve) => {
        client.updateConfig({ fishCount, intervalMs }, (err: any, res: any) => {
            if (err) {
                console.error("Erreur gRPC UpdateConfig:", err);
                return resolve(new Response("Erreur gRPC", { status: 500 }));
            }

            return resolve(
                new Response(JSON.stringify(res), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            );
        });
    });
}
