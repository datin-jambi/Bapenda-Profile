import { z } from "zod";
import { Role, ContentStatus } from "@prisma/client";

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.nativeEnum(Role),
  uptdId: z.number().int().optional().nullable(),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  role: z.nativeEnum(Role).optional(),
  uptdId: z.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Konfirmasi password tidak cocok",
  path: ["confirmPassword"],
});

export const newsCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const newsSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter"),
  categoryId: z.coerce.number().int("Pilih kategori").min(1, "Pilih kategori"),
  excerpt: z.string().optional().nullable(),
  content: z.string().min(10, "Konten minimal 10 karakter"),
  thumbnailUrl: z.string().optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  status: z.nativeEnum(ContentStatus).optional(),
});

export const gallerySchema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter"),
  description: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  status: z.nativeEnum(ContentStatus).optional(),
});

export const galleryItemSchema = z.object({
  mediaType: z.enum(["IMAGE", "VIDEO", "PDF"]),
  fileId: z.string().optional().nullable(),
  fileUrl: z.string().url("URL file tidak valid"),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const faqCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
  slug: z.string().optional(),
});

export const faqSchema = z.object({
  categoryId: z.coerce.number().int("Pilih kategori").min(1, "Pilih kategori"),
  question: z.string().min(5, "Pertanyaan minimal 5 karakter").max(500, "Pertanyaan maksimal 500 karakter"),
  answer: z.string().min(10, "Jawaban minimal 10 karakter"),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isPublished: z.boolean().optional().default(false),
});

export const faqCategoryCreateSchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const pageSchema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter"),
  slug: z.string().optional(),
  content: z.string().min(10, "Konten minimal 10 karakter"),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

export const bannerSchema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter"),
  description: z.string().optional().nullable(),
  imageUrl: z.string().min(1, "Gambar wajib diisi"),
  buttonText: z.string().optional().nullable(),
  buttonUrl: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const regulationSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter"),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  fileUrl: z.string().min(1, "File wajib diisi"),
  fileId: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  status: z.nativeEnum(ContentStatus).optional().default("DRAFT"),
});

export const settingsSchema = z.record(z.string(), z.string());

export const vehicleTaxCheckSchema = z.object({
  licensePlate: z.string().min(1, "Nomor polisi wajib diisi"),
  status: z.enum(["Lunas", "Belum Lunas"], { required_error: "Status wajib dipilih" }),
  // Kondisi kendaraan diisi manual oleh petugas; boleh dikosongkan.
  condition: z.string().max(100, "Kondisi maksimal 100 karakter").optional().nullable(),
  notes: z.string().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  lokasi: z.string().optional().nullable(),
});

export const vehicleTaxCheckInputSchema = z.object({
  licensePlate: z.string().min(1, "Nomor polisi wajib diisi"),
});

export type VehicleTaxCheckInput = z.infer<typeof vehicleTaxCheckSchema>;
export type VehicleTaxCheckLookup = z.infer<typeof vehicleTaxCheckInputSchema>;

export const uptdSchema = z.object({
  code: z.string().min(2, "Kode UPTD wajib diisi"),
  name: z.string().min(2, "Nama UPTD wajib diisi"),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  headName: z.string().optional().nullable(),

  // Wilayah
  province: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  subDistrict: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),

  // Geolokasi — validated range
  latitude: z.coerce
    .number()
    .min(-90, "Latitude harus antara -90 dan 90")
    .max(90, "Latitude harus antara -90 dan 90")
    .optional()
    .nullable(),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude harus antara -180 dan 180")
    .max(180, "Longitude harus antara -180 dan 180")
    .optional()
    .nullable(),
  googleMapsUrl: z.string().url("Format URL tidak valid").optional().nullable(),

  // Visibilitas
  isActive: z.boolean().optional(),
  showOnPublicMap: z.boolean().optional(),
});

export type NewsCategoryInput = z.infer<typeof newsCategorySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type NewsInput = z.infer<typeof newsSchema>;
export type GalleryInput = z.infer<typeof gallerySchema>;
export type GalleryItemInput = z.infer<typeof galleryItemSchema>;
export type FaqInput = z.infer<typeof faqSchema>;
export type FaqCategoryCreateInput = z.infer<typeof faqCategoryCreateSchema>;
export type PageInput = z.infer<typeof pageSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
export type RegulationInput = z.infer<typeof regulationSchema>;
export type RegulationFormInput = RegulationInput;
export type UptdInput = z.infer<typeof uptdSchema>;
