const isProduction = process.env.NODE_ENV === "production";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
} as const;

function timestamp(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

function formatPrefix(level: string, color: string): string {
  if (isProduction) return `${new Date().toISOString()} [${level}]`;
  return `${colors.dim}${timestamp()}${colors.reset} ${color}${level}${colors.reset}`;
}

export const logger = {
  info(msg: string, ...args: unknown[]) {
    console.log(`${formatPrefix("INFO", colors.blue)} ${msg}`, ...args);
  },

  warn(msg: string, ...args: unknown[]) {
    console.warn(`${formatPrefix("WARN", `${colors.bgYellow}${colors.bold}`)} ${colors.yellow}${msg}${colors.reset}`, ...args);
  },

  error(msg: string, ...args: unknown[]) {
    console.error(`${formatPrefix("ERRO", `${colors.bgRed}${colors.bold}`)} ${colors.red}${msg}${colors.reset}`, ...args);
  },

  debug(msg: string, ...args: unknown[]) {
    if (isProduction) return;
    console.debug(`${formatPrefix("DBUG", colors.magenta)} ${colors.dim}${msg}${colors.reset}`, ...args);
  },

  request(method: string, path: string, status: number, durationMs: number) {
    const methodColor = methodColors[method] ?? colors.white;
    const statusColor = statusToColor(status);
    const duration = durationMs < 1000
      ? `${Math.round(durationMs)}ms`
      : `${(durationMs / 1000).toFixed(2)}s`;

    const line = [
      formatPrefix("HTTP", colors.cyan),
      `${methodColor}${method.padEnd(7)}${colors.reset}`,
      path,
      `${statusColor}${status}${colors.reset}`,
      `${colors.dim}${duration}${colors.reset}`,
    ].join(" ");

    console.log(line);
  },
};

const methodColors: Record<string, string> = {
  GET: colors.green,
  POST: colors.yellow,
  PUT: colors.blue,
  PATCH: colors.magenta,
  DELETE: colors.red,
};

function statusToColor(status: number): string {
  if (status < 300) return colors.green;
  if (status < 400) return colors.cyan;
  if (status < 500) return colors.yellow;
  return colors.red;
}
