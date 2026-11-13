import { NextRequest, NextResponse } from "next/server";
import { pkbFetchRaw, isPkbEndpoint } from "@/lib/pkb";

// Proxy publik ke API Samsat: token tidak ikut ter-bundle ke browser, dan
// masalah sertifikat upstream ditangani di sisi server (lihat src/lib/pkb.ts).
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string }> }) {
  const { path } = await ctx.params;
  if (!isPkbEndpoint(path)) {
    return NextResponse.json({ status: false, message: "Endpoint tidak dikenal" }, { status: 404 });
  }

  const nopol = req.nextUrl.searchParams.get("nopol")?.trim();
  if (!nopol) {
    return NextResponse.json({ status: false, message: "Parameter nopol wajib diisi" }, { status: 400 });
  }

  try {
    const { body } = await pkbFetchRaw(path, nopol);
    return new NextResponse(body, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ status: false, message: "Gagal menghubungi API Samsat" }, { status: 502 });
  }
}
