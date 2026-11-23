import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
// 로컬 서버를 자식 프로세스로 실행한다. Next.js의 HTTP 요청 안에서 프로세스를 만들지 않는다.
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    "--import",
    "tsx",
    path.join(import.meta.dirname, "mcp-server.ts"),
    "--stdio",
  ],
});
const client = new Client({ name: "next-study-client", version: "1.0.0" });
try {
  await client.connect(transport);
  console.log(await client.listTools());
  console.log(
    await client.callTool({
      name: "explain_next",
      arguments: { topic: "rsc" },
    }),
  );
} finally {
  await client.close();
}
