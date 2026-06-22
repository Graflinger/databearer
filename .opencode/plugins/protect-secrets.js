const SECRET_PATH_PATTERNS = [
  /(^|\/|\\)\.env($|\.|\/|\\)/i,
  /(^|\/|\\)\.env\.[^\/\\]+$/i,
  /(^|\/|\\)secrets?($|\/|\\)/i,
  /(^|\/|\\)credentials?($|\/|\\)/i,
  /(^|\/|\\)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i,
  /(^|\/|\\).*\.pem$/i,
  /(^|\/|\\).*\.key$/i,
  /(^|\/|\\).*credentials.*\.json$/i,
];

const SECRET_VALUE_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /-----BEGIN (RSA |DSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /(api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*['\"]?[A-Za-z0-9_\-/.+=]{12,}/i,
];

function stringify(value) {
  try {
    return JSON.stringify(value ?? "").replace(/\{env:[A-Z0-9_]+\}/gi, "{env:VAR}");
  } catch {
    return String(value ?? "").replace(/\{env:[A-Z0-9_]+\}/gi, "{env:VAR}");
  }
}

function containsSecretPath(value) {
  const text = stringify(value);
  return SECRET_PATH_PATTERNS.some((pattern) => pattern.test(text));
}

function containsSecretValue(value) {
  const text = stringify(value);
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}

export default async function protectSecrets() {
  return {
    // opencode passes the invoking metadata as `input` ({ tool, sessionID,
    // callID }) and the tool's actual arguments as `output.args`. We must
    // inspect `output.args` to see file paths, commands, and payloads.
    async "tool.execute.before"(input, output) {
      const toolName = input?.tool ?? "unknown-tool";
      const args = output?.args ?? {};

      if (containsSecretPath(args)) {
        throw new Error(
          `[protect-secrets] Blocked ${toolName}: request references a likely secret or credential path.`,
        );
      }

      if (containsSecretValue(args)) {
        throw new Error(
          `[protect-secrets] Blocked ${toolName}: request appears to contain a secret value.`,
        );
      }
    },
  };
}
