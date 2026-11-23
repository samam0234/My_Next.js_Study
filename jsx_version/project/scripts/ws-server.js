import next from "next";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { authenticate } from "../src/course/security";
import { getRepository } from "../src/course/repository";
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
await app.prepare();
const server = createServer(app.getRequestHandler());
const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on("upgrade", async (request, socket, head) => {
    if (request.url?.split("?")[0] !== "/ws") {
        app.getUpgradeHandler()(request, socket, head);
        return;
    }
    try {
        if (request.headers.origin !== process.env.APP_ORIGIN)
            throw new Error("Origin");
        const headers = new Headers();
        if (request.headers.cookie)
            headers.set("Cookie", request.headers.cookie);
        const state = await (await getRepository()).read();
        authenticate(new Request(`${process.env.APP_ORIGIN}/ws`, { headers }), state);
        sockets.handleUpgrade(request, socket, head, (ws) => {
            ws.send(JSON.stringify({ type: "connected" }));
            // 학습용 echo. 사용자 간 브로드캐스트는 하지 않는다.
            ws.on("message", async (data) => {
                try {
                    authenticate(new Request(`${process.env.APP_ORIGIN}/ws`, { headers }), await (await getRepository()).read());
                    ws.send(JSON.stringify({
                        type: "echo",
                        text: data.toString().slice(0, 1000),
                    }));
                }
                catch {
                    ws.close(1008, "Session expired");
                }
            });
            const timer = setTimeout(() => ws.close(1000, "Reconnect"), 30_000);
            ws.on("close", () => clearTimeout(timer));
        });
    }
    catch {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
    }
});
server.listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () => console.log("Next.js + WebSocket /ws 시작"));
