import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const MAX_FIELD_LENGTH = 4000;

function redact(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return text
    .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_KEY]")
    .replace(/-----BEGIN ([^-]+)PRIVATE KEY-----[\s\S]*?-----END \1PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/(api[_-]?key|access[_-]?token|secret|password)(["'\s:=]+)([^"'\s,}]{8,})/gi, "$1$2[REDACTED]")
    .slice(0, MAX_FIELD_LENGTH);
}

async function writeAuditLine(project, entry) {
  const projectRoot = project?.root ?? project?.directory ?? process.cwd();
  const auditPath = process.env.OPENCODE_AUDIT_LOG_PATH
    ?? join(homedir(), ".local", "share", "opencode", "audit", `${projectRoot.replace(/[^A-Za-z0-9_.-]/g, "_")}.jsonl`);
  await mkdir(dirname(auditPath), { recursive: true });
  await appendFile(auditPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export default async function auditLog({ project } = {}) {
  return {
    // input: { tool, sessionID, callID, args }; output: { title, output, metadata }
    async "tool.execute.after"(input, output) {
      const entry = {
        timestamp: new Date().toISOString(),
        tool: input?.tool ?? "unknown-tool",
        sessionID: input?.sessionID ?? null,
        callID: input?.callID ?? null,
        args: redact(input?.args ?? {}),
        output: redact(output?.output ?? output),
      };

      await writeAuditLine(project, entry);
    },
  };
}
