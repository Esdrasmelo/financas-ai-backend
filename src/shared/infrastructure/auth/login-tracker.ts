import type { PrismaClient } from "@prisma/client";
import type { Request } from "express";

interface GeoResult {
  city?: string;
  regionName?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  isp?: string;
  timezone?: string;
}

function isLocalIp(ip: string): boolean {
  return !ip || ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1";
}

async function geolocateIp(ip: string): Promise<GeoResult & { query?: string }> {
  try {
    const url = isLocalIp(ip)
      ? "http://ip-api.com/json/?fields=query,city,regionName,country,countryCode,lat,lon,isp,timezone"
      : `http://ip-api.com/json/${ip}?fields=query,city,regionName,country,countryCode,lat,lon,isp,timezone`;
    const res = await fetch(url);
    if (!res.ok) return {};
    return (await res.json()) as GeoResult & { query?: string };
  } catch {
    return {};
  }
}

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = "Desconhecido";
  let os = "Desconhecido";
  let device = "Desktop";

  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && ua.includes("Safari/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  if (ua.includes("Mobile") || ua.includes("Android")) device = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) device = "Tablet";

  return { browser, os, device };
}

function extractIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip ?? req.socket.remoteAddress ?? "";
}

export async function trackLogin(
  prisma: PrismaClient,
  userId: string,
  req: Request,
  success: boolean,
): Promise<void> {
  try {
    const rawIp = extractIp(req);
    const userAgent = req.headers["user-agent"] ?? "";
    const { browser, os, device } = parseUserAgent(userAgent);
    const geo = await geolocateIp(rawIp);
    const ip = isLocalIp(rawIp) && geo.query ? geo.query : rawIp;

    await prisma.loginHistory.create({
      data: {
        userId,
        success,
        ip: ip || null,
        userAgent: userAgent || null,
        browser,
        os,
        device,
        city: geo.city ?? null,
        region: geo.regionName ?? null,
        country: geo.country ?? null,
        countryCode: geo.countryCode ?? null,
        latitude: geo.lat ?? null,
        longitude: geo.lon ?? null,
        isp: geo.isp ?? null,
        timezone: geo.timezone ?? null,
      },
    });
  } catch (err) {
    console.error("Falha ao registrar login:", err);
  }
}
