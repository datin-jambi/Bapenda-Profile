"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Save, Globe, Phone, Share2, Settings2, MapPin, CheckCircle2, AlertCircle, LucideIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type SettingsForm = {
  site_name: string;
  site_description: string;
  site_keywords: string;
  meta_author: string;
  logo_url: string;
  contact_address: string;
  contact_phone: string;
  contact_email: string;
  contact_fax: string;
  office_hours: string;
  location_latitude: string;
  location_longitude: string;
  location_maps_embed_url: string;
  social_facebook: string;
  social_twitter: string;
  social_instagram: string;
  social_youtube: string;
  social_tiktok: string;
  google_analytics_id: string;
  footer_text: string;
};

type FieldDef = {
  key: keyof SettingsForm;
  label: string;
  placeholder: string;
  type?: "input" | "textarea";
};

type Section = {
  title: string;
  icon: LucideIcon;
  fields: FieldDef[];
};

const SECTIONS: Section[] = [
  {
    title: "Informasi Umum",
    icon: Globe,
    fields: [
      { key: "site_name", label: "Nama Website", placeholder: "BAPENDA Provinsi Jambi" },
      { key: "site_description", label: "Deskripsi Website", placeholder: "Website resmi...", type: "textarea" },
      { key: "site_keywords", label: "Keywords SEO", placeholder: "bapenda, pajak, jambi..." },
      { key: "meta_author", label: "Meta Author", placeholder: "BAPENDA Provinsi Jambi" },
      { key: "logo_url", label: "URL Logo", placeholder: "https://..." },
    ],
  },
  {
    title: "Informasi Kontak",
    icon: Phone,
    fields: [
      { key: "contact_address", label: "Alamat", placeholder: "Jl. Ahmad Yani No. 1...", type: "textarea" },
      { key: "contact_phone", label: "Telepon", placeholder: "(0741) 60436" },
      { key: "contact_email", label: "Email", placeholder: "info@bapenda.jambiprov.go.id" },
      { key: "contact_fax", label: "Fax", placeholder: "(0741) 60436" },
      { key: "office_hours", label: "Jam Operasional", placeholder: "Senin - Jumat: 08.00 - 16.00 WIB" },
    ],
  },
  {
    title: "Lokasi Kantor",
    icon: MapPin,
    fields: [
      { key: "location_latitude", label: "Latitude", placeholder: "-1.6101" },
      { key: "location_longitude", label: "Longitude", placeholder: "103.6131" },
      { key: "location_maps_embed_url", label: "URL Embed Peta", placeholder: "https://maps.google.com/maps?q=...&output=embed", type: "textarea" },
    ],
  },
  {
    title: "Media Sosial",
    icon: Share2,
    fields: [
      { key: "social_facebook", label: "Facebook URL", placeholder: "https://facebook.com/..." },
      { key: "social_twitter", label: "Twitter/X URL", placeholder: "https://twitter.com/..." },
      { key: "social_instagram", label: "Instagram URL", placeholder: "https://instagram.com/..." },
      { key: "social_youtube", label: "YouTube URL", placeholder: "https://youtube.com/..." },
      { key: "social_tiktok", label: "TikTok URL", placeholder: "https://tiktok.com/..." },
    ],
  },
  {
    title: "Lainnya",
    icon: Settings2,
    fields: [
      { key: "google_analytics_id", label: "Google Analytics ID", placeholder: "G-XXXXXXXXXX" },
      { key: "footer_text", label: "Teks Footer", placeholder: "© 2024 BAPENDA Provinsi Jambi..." },
    ],
  },
];

function parseMapsUrl(url: string): { lat: string; lng: string; embedUrl: string } | null {
  // Sudah berbentuk embed URL — gunakan langsung
  if (url.includes("/maps/embed") || url.includes("output=embed")) {
    return { lat: "", lng: "", embedUrl: url };
  }

  let lat = "", lng = "", zoom = "17";

  // Format: @lat,lng,zoomz  (link share Google Maps)
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/);
  if (atMatch) {
    lat = atMatch[1];
    lng = atMatch[2];
    zoom = atMatch[3];
  } else {
    // Format: @lat,lng (tanpa zoom)
    const atBasic = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atBasic) { lat = atBasic[1]; lng = atBasic[2]; }
  }

  // Fallback: q=lat,lng
  if (!lat) {
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) { lat = qMatch[1]; lng = qMatch[2]; }
  }

  // Fallback: ll=lat,lng
  if (!lat) {
    const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llMatch) { lat = llMatch[1]; lng = llMatch[2]; }
  }

  if (!lat || !lng) return null;

  const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
  return { lat, lng, embedUrl };
}

export default function SelokoSettingsPage() {
  const queryClient = useQueryClient();
  const [mapsUrl, setMapsUrl] = useState("");
  const [mapsStatus, setMapsStatus] = useState<"idle" | "ok" | "error">("idle");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["seloko-settings"],
    queryFn: () => api.get("/seloko/settings").then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, setValue, formState: { isDirty, isSubmitting } } = useForm<SettingsForm>();

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  const handleMapsUrl = (url: string) => {
    setMapsUrl(url);
    if (!url) { setMapsStatus("idle"); return; }
    const result = parseMapsUrl(url);
    if (result) {
      if (result.lat) setValue("location_latitude", result.lat, { shouldDirty: true });
      if (result.lng) setValue("location_longitude", result.lng, { shouldDirty: true });
      setValue("location_maps_embed_url", result.embedUrl, { shouldDirty: true });
      setMapsStatus("ok");
    } else {
      setMapsStatus("error");
    }
  };

  const mutation = useMutation({
    mutationFn: (data: SettingsForm) => api.put("/seloko/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-settings"] });
      toast.success("Pengaturan berhasil disimpan");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menyimpan pengaturan"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-primary">Pengaturan Website</h1>
        <p className="text-sm text-muted-foreground">Kelola informasi umum, kontak, dan media sosial website</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        {SECTIONS.map(({ title, icon: Icon, fields }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {title === "Lokasi Kantor" && (
                <div className="space-y-2">
                  <Label>Paste Link Google Maps</Label>
                  <div className="relative">
                    <Input
                      value={mapsUrl}
                      onChange={(e) => handleMapsUrl(e.target.value)}
                      placeholder="https://www.google.com/maps/place/.../@-1.6101,103.6131,17z"
                      className="pr-9"
                    />
                    {mapsStatus === "ok" && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {mapsStatus === "error" && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {mapsStatus === "ok" && (
                    <p className="text-xs text-green-600">Koordinat & URL embed berhasil diekstrak, klik Simpan untuk menyimpan</p>
                  )}
                  {mapsStatus === "error" && (
                    <p className="text-xs text-destructive">Format tidak dikenali, isi koordinat dan URL embed secara manual</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Salin link dari Google Maps → klik kanan lokasi → &quot;Bagikan&quot; → salin link, atau paste URL embed dari menu Bagikan → Sematkan peta.
                  </p>
                </div>
              )}
              {fields.map(({ key, label, placeholder, type = "input" }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  {type === "textarea" ? (
                    <Textarea
                      id={key}
                      {...register(key as keyof SettingsForm)}
                      placeholder={placeholder}
                      rows={2}
                    />
                  ) : (
                    <Input
                      id={key}
                      {...register(key as keyof SettingsForm)}
                      placeholder={placeholder}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end gap-3">
          {isDirty && (
            <Button type="button" variant="outline" onClick={() => reset(settings)}>
              Reset
            </Button>
          )}
          <Button
            type="submit"
            loading={isSubmitting || mutation.isPending}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Simpan Pengaturan
          </Button>
        </div>
      </form>
    </div>
  );
}
