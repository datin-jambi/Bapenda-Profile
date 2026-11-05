import type { Metadata } from "next";
import {
    Info,
    FileText,
    Scale,
    Users,
    Search,
    Clock,
    HelpCircle,
    BookOpen,
    Shield,
    ClipboardList,
    Building2,
    Eye,
    Copy,
} from "lucide-react";

export const metadata: Metadata = {
    title: "Tentang PPID | BAPENDA Provinsi Jambi",
    description:
        "Pelajari apa itu PPID (Pejabat Pengelola Informasi dan Dokumentasi), dasar hukum, tugas, fungsi, serta hak masyarakat untuk mengakses informasi publik di lingkungan BAPENDA Provinsi Jambi.",
    keywords:
        "ppid, pejabat pengelola informasi dan dokumentasi, keterbukaan informasi publik, informasi publik, bapenda jambi",
    openGraph: {
        title: "Tentang PPID | BAPENDA Provinsi Jambi",
        description:
            "Informasi lengkap mengenai PPID - Pejabat Pengelola Informasi dan Dokumentasi BAPENDA Provinsi Jambi.",
        type: "website",
    },
};

const INFORMASI_KATEGORI = [
    {
        icon: FileText,
        title: "Informasi Berkala",
        desc: "Informasi yang wajib diumumkan secara berkala melalui media cetak, papan pengumuman, dan website setiap 6 bulan atau setiap tahun.",
        color: "border-blue-200 bg-blue-50",
        iconColor: "text-blue-600",
    },
    {
        icon: Clock,
        title: "Informasi Serta Merta",
        desc: "Informasi yang dapat mengancam hajat hidup orang banyak dan ketertiban umum, wajib diumumkan dengan segera tanpa penundaan.",
        color: "border-red-200 bg-red-50",
        iconColor: "text-red-600",
    },
    {
        icon: ClipboardList,
        title: "Informasi Tersedia Setiap Saat",
        desc: "Informasi publik yang meliputi daftar seluruh informasi yang dimiliki PPID, beserta akses dan tata cara memperolehnya.",
        color: "border-green-200 bg-green-50",
        iconColor: "text-green-600",
    },
];

const HAK_PUBLIK = [
    {
        icon: Eye,
        title: "Melihat Informasi",
        desc: "Melihat langsung informasi publik yang tersedia di kantor PPID atau melalui website resmi.",
    },
    {
        icon: Copy,
        title: "Mendapatkan Salinan",
        desc: "Memperoleh salinan informasi publik dalam bentuk cetak, digital, atau format lainnya sesuai permohonan.",
    },
    {
        icon: HelpCircle,
        title: "Mengajukan Pertanyaan",
        desc: "Bertanya dan berkonsultasi mengenai informasi publik yang dibutuhkan kepada petugas PPID.",
    },
    {
        icon: Shield,
        title: "Mengajukan Keberatan",
        desc: "Mengajukan keberatan secara tertulis jika permohonan informasi ditolak atau tidak dipenuhi sesuai ketentuan.",
    },
];

export default function TentangPpidPage() {
    return (
        <main>
            {/* Hero */}
            <section className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white py-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm text-white/90 mb-5">
                        <Info className="h-4 w-4" />
                        Pejabat Pengelola Informasi dan Dokumentasi
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold font-poppins mb-4 leading-tight">
                        Tentang PPID
                    </h1>
                    <p className="text-lg md:text-xl text-white/85 mb-4 max-w-3xl mx-auto">
                        Memahami apa itu PPID, mengapa penting, dan bagaimana masyarakat dapat mengakses informasi publik
                        dengan mudah dan transparan.
                    </p>
                </div>
            </section>

            {/* Apa itu PPID */}
            <section className="py-16 px-4 bg-white">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">
                            Apa Itu <span className="text-primary">PPID</span>?
                        </h2>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed space-y-4">
                        <p className="text-base">
                            <strong className="text-gray-800">PPID</strong> adalah singkatan dari{" "}
                            <strong className="text-gray-800">Pejabat Pengelola Informasi dan Dokumentasi</strong>.
                            PPID adalah pejabat yang bertanggung jawab di bidang pengelolaan, pengumpulan,
                            pendokumentasian, penyimpanan, serta pelayanan informasi publik di suatu instansi
                            atau badan publik.
                        </p>

                        <p className="text-base">
                            Sederhananya, PPID adalah <strong className="text-gray-800">pintu informasi</strong> sebuah
                            instansi pemerintah. Jika masyarakat ingin mengetahui suatu informasi tentang
                            BAPENDA Provinsi Jambi — misalnya anggaran, program kerja, regulasi, atau
                            laporan kinerja — maka PPID adalah pihak yang bertugas menyediakan
                            informasi tersebut.
                        </p>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 my-6">
                            <div className="flex items-start gap-3">
                                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-blue-800 text-sm">Mengapa PPID Penting?</h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        PPID hadir sebagai wujud implementasi Undang-Undang Nomor 14 Tahun 2008 tentang
                                        Keterbukaan Informasi Publik (KIP). Setiap badan publik wajib membentuk PPID
                                        sebagai jembatan antara masyarakat dan pemerintah dalam hal akses informasi.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <p className="text-base">
                            Di BAPENDA Provinsi Jambi, PPID berperan memastikan bahwa setiap informasi publik
                            dapat diakses dengan mudah, cepat, dan transparan oleh seluruh masyarakat, sesuai
                            dengan amanat undang-undang.
                        </p>
                    </div>
                </div>
            </section>

            {/* Dasar Hukum */}
            <section className="py-16 px-4 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">Dasar Hukum</h2>
                        <p className="text-gray-500 mt-2">Landasan hukum pembentukan dan penyelenggaraan PPID</p>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            {
                                title: "UUD 1945 Pasal 28F",
                                desc: "Setiap orang berhak untuk berkomunikasi dan memperoleh informasi untuk mengembangkan pribadi dan lingkungan sosialnya.",
                            },
                            {
                                title: "UU No. 14 Tahun 2008",
                                desc: "Keterbukaan Informasi Publik (KIP) — mengatur hak masyarakat untuk memperoleh informasi dan kewajiban badan publik menyediakannya.",
                            },
                            {
                                title: "UU No. 25 Tahun 2009",
                                desc: "Pelayanan Publik — mengatur standar pelayanan informasi kepada masyarakat sebagai bagian dari pelayanan publik.",
                            },
                            {
                                title: "Peraturan Komisi Informasi",
                                desc: "Pedoman teknis pengelolaan dan pelayanan informasi publik di lingkungan badan publik.",
                            },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
                            >
                                <div className="flex items-start gap-3">
                                    <Scale className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-sm">{item.title}</h3>
                                        <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tugas dan Fungsi */}
            <section className="py-16 px-4 bg-white">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">Tugas & Fungsi PPID</h2>
                        <p className="text-gray-500 mt-2">Apa saja yang dilakukan PPID dalam melayani masyarakat</p>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: BookOpen,
                                title: "Pengelolaan Informasi",
                                desc: "Mengumpulkan, mendokumentasikan, dan menyimpan seluruh informasi publik di lingkungan BAPENDA Provinsi Jambi secara sistematis.",
                            },
                            {
                                icon: Users,
                                title: "Pelayanan Informasi",
                                desc: "Melayani permohonan informasi dari masyarakat dengan cepat, tepat, dan biaya yang terjangkau sesuai ketentuan.",
                            },
                            {
                                icon: Search,
                                title: "Pengumuman Informasi",
                                desc: "Mengumumkan informasi publik secara berkala, serta merta, dan tersedia setiap saat melalui berbagai media.",
                            },
                            {
                                icon: FileText,
                                title: "Pendokumentasian",
                                desc: "Mendokumentasikan seluruh informasi publik secara tertib, aman, dan mudah diakses saat dibutuhkan.",
                            },
                            {
                                icon: HelpCircle,
                                title: "Penyelesaian Sengketa",
                                desc: "Menangani keberatan dan membantu penyelesaian sengketa informasi publik yang diajukan oleh pemohon informasi.",
                            },
                            {
                                icon: Building2,
                                title: "Koordinasi Internal",
                                desc: "Berkoordinasi dengan seluruh unit kerja di lingkungan BAPENDA untuk memastikan ketersediaan informasi publik.",
                            },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow group"
                            >
                                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <item.icon className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">{item.title}</h3>
                                <p className="text-sm text-gray-600">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Informasi yang Dikelola */}
            <section className="py-16 px-4 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">Informasi yang Dikelola PPID</h2>
                        <p className="text-gray-500 mt-2">Jenis-jenis informasi publik yang tersedia dan dapat diakses</p>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { title: "Profil dan Struktur Organisasi", desc: "Informasi tentang profil instansi, struktur organisasi, visi misi, dan tugas pokok fungsi." },
                            { title: "Anggaran dan Keuangan", desc: "Laporan anggaran, realisasi keuangan, dan laporan kinerja instansi secara periodik." },
                            { title: "Regulasi dan Kebijakan", desc: "Peraturan daerah, keputusan kepala daerah, dan kebijakan terkait pendapatan daerah." },
                            { title: "Program dan Kegiatan", desc: "Rencana program kerja, kegiatan, dan capaian kinerja instansi." },
                            { title: "Layanan Publik", desc: "Standar pelayanan, prosedur, biaya, dan informasi layanan perpajakan daerah." },
                            { title: "Pengadaan Barang/Jasa", desc: "Informasi pengadaan barang/jasa, tender, dan kontrak kerja." },
                            { title: "Kepegawaian", desc: "Informasi umum kepegawaian, jumlah pegawai, dan kompetensi SDM." },
                            { title: "Data dan Statistik", desc: "Data pendapatan daerah, statistik pajak, dan informasi terkait lainnya." },
                            { title: "Laporan Kinerja", desc: "LAKIP, laporan tahunan, dan laporan pertanggungjawaban instansi." },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
                            >
                                <h3 className="font-semibold text-gray-800 text-sm mb-1">{item.title}</h3>
                                <p className="text-xs text-gray-500">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Kategori Informasi */}
            <section className="py-16 px-4 bg-white">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">Kategori Informasi Publik</h2>
                        <p className="text-gray-500 mt-2">Berdasarkan UU KIP No. 14 Tahun 2008, informasi publik dikelompokkan menjadi:</p>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {INFORMASI_KATEGORI.map((k) => (
                            <div key={k.title} className={`border-2 rounded-2xl p-6 ${k.color}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <k.icon className={`h-6 w-6 ${k.iconColor}`} />
                                    <h3 className="font-bold text-gray-800">{k.title}</h3>
                                </div>
                                <p className="text-sm text-gray-600">{k.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Hak Masyarakat */}
            <section className="py-16 px-4 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">Hak Masyarakat</h2>
                        <p className="text-gray-500 mt-2">Setiap warga negara berhak untuk:</p>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {HAK_PUBLIK.map((hak) => (
                            <div
                                key={hak.title}
                                className="bg-white border border-gray-200 rounded-2xl p-6 flex items-start gap-4 hover:shadow-sm transition-shadow"
                            >
                                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <hak.icon className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">{hak.title}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{hak.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="font-semibold text-yellow-800 text-sm">Yang Perlu Diketahui</h4>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Masyarakat tidak perlu memberikan alasan khusus untuk meminta informasi publik.
                                    Permohonan informasi bersifat terbuka dan tidak dipersulit. Biaya hanya dikenakan
                                    untuk penggandaan dan pengiriman informasi, bukan untuk akses informasinya.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Alur Permohonan */}
            <section className="py-16 px-4 bg-white">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">Alur Permohonan Informasi</h2>
                        <p className="text-gray-500 mt-2">Bagaimana cara mengajukan permohonan informasi publik</p>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="space-y-0">
                        {[
                            { step: 1, title: "Ajukan Permohonan", desc: "Datang langsung ke kantor PPID atau ajukan melalui website/email dengan mengisi formulir permohonan informasi." },
                            { step: 2, title: "Verifikasi & Registrasi", desc: "Petugas PPID memverifikasi identitas pemohon dan mendaftarkan permohonan ke dalam sistem." },
                            { step: 3, title: "Pencarian Informasi", desc: "PPID mencari dan mengumpulkan informasi yang dimohonkan dari unit kerja terkait." },
                            { step: 4, title: "Pemberian Respons", desc: "PPID memberikan tanggapan berupa pemberian informasi (diterima), penolakan (dengan alasan sah), atau pemberitahuan perpanjangan waktu." },
                            { step: 5, title: "Penyerahan Informasi", desc: "Informasi diserahkan kepada pemohon dalam bentuk cetak, softcopy, atau format lain sesuai kesepakatan." },
                        ].map((s, i) => (
                            <div key={s.step} className="flex gap-4 md:gap-6">
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        {s.step}
                                    </div>
                                    {i < 4 && <div className="w-0.5 h-12 bg-primary/20 mt-1" />}
                                </div>
                                <div className="pb-10">
                                    <h3 className="font-bold text-gray-800 text-base">{s.title}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-4">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="font-semibold text-blue-800 text-sm">Jangka Waktu Pelayanan</h4>
                                <p className="text-sm text-blue-700 mt-1">
                                    PPID wajib merespon permohonan informasi paling lambat <strong>10 hari kerja</strong> sejak permohonan
                                    diterima dan dapat diperpanjang <strong>7 hari kerja</strong> jika diperlukan. Apabila permohonan
                                    tidak direspons, pemohon berhak mengajukan keberatan.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Informasi yang Dikecualikan */}
            <section className="py-16 px-4 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="h-6 w-6 text-primary" />
                        <h2 className="text-3xl font-bold font-poppins text-gray-900">Informasi yang Dikecualikan</h2>
                    </div>
                    <p className="text-gray-600 mb-6">
                        Tidak semua informasi dapat diakses oleh publik. Berdasarkan UU KIP, beberapa jenis informasi
                        bersifat <strong>tertutup</strong> atau <strong>dikecualikan</strong>, yaitu:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            "Informasi yang membahayakan negara dan ketahanan nasional",
                            "Informasi yang terkait dengan rahasia pribadi (data pribadi)",
                            "Informasi yang terkait dengan rahasia bisnis dan kekayaan intelektual",
                            "Informasi yang dapat mengungkap isi akta otentik yang bersifat pribadi",
                            "Informasi yang belum diverifikasi kebenarannya",
                            "Informasi yang dikecualikan berdasarkan peraturan perundang-undangan",
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Kontak PPID */}
            {/* <section className="py-16 px-4 bg-gradient-to-r from-primary to-primary/80 text-white">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold font-poppins">Kontak PPID</h2>
                        <p className="text-white/80 mt-2">Hubungi PPID BAPENDA Provinsi Jambi untuk informasi lebih lanjut</p>
                        <div className="w-20 h-1 bg-secondary mx-auto mt-3 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                icon: Building2,
                                title: "Kantor",
                                desc: "Jl. RM. Thaher No. Km. 10, Kabupaten Muaro Jambi, Jambi",
                                sub: "Senin - Jumat, 08.00 - 16.00 WIB",
                            },
                            {
                                icon: Phone,
                                title: "Telepon",
                                desc: "(0741) 123456",
                                sub: "Jam kerja",
                            },
                            {
                                icon: Mail,
                                title: "Email",
                                desc: "ppid@bapendajambi.go.id",
                                sub: "24 jam (akan direspon jam kerja)",
                            },
                            {
                                icon: MapPin,
                                title: "Unit PPID",
                                desc: "Gedung Utama BAPENDA Provinsi Jambi",
                                sub: "Lantai 1, Bagian Humas & Informasi",
                            },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 text-center hover:bg-white/15 transition-colors"
                            >
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <item.icon className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="font-bold text-white text-base mb-1">{item.title}</h3>
                                <p className="text-sm text-white/80">{item.desc}</p>
                                <p className="text-xs text-white/60 mt-1">{item.sub}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 text-center">
                        <Link
                            href="/kontak"
                            className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/90 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg"
                        >
                            <Mail className="h-5 w-5" />
                            Hubungi Kami
                        </Link>
                    </div>
                </div>
            </section> */}
        </main>
    );
}
