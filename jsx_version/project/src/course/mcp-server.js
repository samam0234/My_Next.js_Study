import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// 공개된 학습 개념만 제공한다. 사용자 DB·비밀키를 MCP 도구에 노출하지 않는다.
export function createMcpServer() {
    const server = new McpServer({ name: "next-study", version: "1.0.0" });
    server.registerTool("explain_next", {
        description: "Next.js 개념 설명",
        inputSchema: { topic: z.enum(["routing", "rsc", "actions"]) },
    }, async ({ topic }) => ({
        content: [
            {
                type: "text",
                text: {
                    routing: "app 폴더와 page 파일이 URL을 만든다.",
                    rsc: "서버에서 데이터를 읽고 직렬화 가능한 props를 전달한다.",
                    actions: "use server 함수에서 검증·인가 후 데이터를 변경한다.",
                }[topic],
            },
        ],
    }));
    return server;
}
if (process.argv.includes("--stdio"))
    await createMcpServer().connect(new StdioServerTransport());
