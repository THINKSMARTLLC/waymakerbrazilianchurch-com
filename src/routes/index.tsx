import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Heart,
  Users,
  BookOpen,
  Sparkles,
  Compass,
  Cross,
  HandHeart,
  MessageCircle,
  Calendar,
  UsersRound,
  Check,
  ArrowRight,
  MapPin,
  Instagram,
  Navigation,
} from "lucide-react";
import wayMakerLogo from "@/assets/waymaker-logo.png";
import heroImage from "@/assets/waymaker-hero.jpg";
import whatsappIcon from "@/assets/whatsapp-icon.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Way Maker Church — Um lugar para viver o Evangelho de verdade" },
      {
        name: "description",
        content:
          "Uma comunidade centrada em Cristo, onde vidas são transformadas, famílias são restauradas e o propósito em Deus se torna real.",
      },
      { property: "og:title", content: "Way Maker Church — Um lugar para viver o Evangelho de verdade" },
      {
        property: "og:description",
        content:
          "Uma comunidade centrada em Cristo, onde vidas são transformadas, famílias são restauradas e o propósito em Deus se torna real.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

// 🔁 A/B Variations (estruturadas para teste — não exibidas ao usuário final)
const AB_VARIATIONS = {
  headlines: [
    "Mais do que uma igreja. Um recomeço com Deus.",
    "Se você busca algo real com Deus, você acabou de encontrar.",
    "Um lugar onde o Evangelho é vivido — não apenas falado.",
  ],
  ctas: ["Quero dar o primeiro passo", "Quero conhecer essa igreja", "Quero viver isso"],
};

const WHATSAPP_URL =
  'https://wa.me/15512237610?text=Olá,%20quero%20mais%20informações.';

function LandingPage() {
  // Smooth scroll
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    // Expose A/B data on window for analytics scripts (no UI side effects).
    (window as unknown as { __WMC_AB__?: typeof AB_VARIATIONS }).__WMC_AB__ = AB_VARIATIONS;
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[oklch(0.99_0.003_85)] text-[oklch(0.18_0.01_60)] antialiased">
      {/* Top nav */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 shadow-sm ring-1 ring-black/5 overflow-hidden">
              <img src={wayMakerLogo} alt="Way Maker Church" className="h-9 w-9 object-contain" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight text-white drop-shadow-sm">
              Way Maker Church
            </span>
          </a>
          <Link
            to="/login"
            className="hidden rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20 md:inline-block"
          >
            Área do membro
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImage}
            alt="Comunidade em momento de adoração"
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
        </div>

        <div className="mx-auto flex min-h-[100svh] max-w-5xl flex-col items-center justify-center px-6 py-32 text-center text-white md:px-10">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "oklch(0.82 0.13 85)" }} />
            Way Maker Church
          </span>

          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Um lugar para quem não quer
            <br className="hidden sm:block" />
            <span className="italic font-normal" style={{ color: "oklch(0.85 0.12 85)" }}>
              {" "}apenas ir à igreja…
            </span>
            <br />
            mas viver o Evangelho de verdade.
          </h1>

          <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            Aqui você encontra uma comunidade centrada em Cristo,
            <br className="hidden sm:block" /> onde vidas são transformadas, famílias são restauradas
            <br className="hidden sm:block" /> e o propósito em Deus se torna real.
          </p>

          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
            <a
              href="#comecar"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("comecar")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-black shadow-xl shadow-black/30 transition hover:scale-[1.02] hover:bg-white/95"
            >
              Quero conhecer mais sobre a Way Maker Church
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
          </div>

          <a
            href="#conexao"
            className="mt-20 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white/90"
          >
            ↓ Continue
          </a>
        </div>
      </section>

      {/* CONEXÃO / IDENTIFICAÇÃO */}
      <section id="conexao" className="relative px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              Identificação
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Se você sente que…
            </h2>
          </div>

          <ul className="space-y-5">
            {[
              "Está vivendo sem direção ou propósito",
              "Já se decepcionou com religião vazia",
              "Carrega feridas emocionais ou espirituais",
              "Sente falta de algo verdadeiro com Deus",
              "Quer fazer parte de algo real, não superficial",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-4 rounded-2xl border border-black/5 bg-white px-6 py-5 shadow-sm"
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Check className="h-4 w-4" style={{ color: "oklch(0.55 0.12 110)" }} />
                </span>
                <span className="text-base leading-relaxed text-[oklch(0.28_0.02_60)] sm:text-lg">
                  {item}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-12 text-center font-display text-xl font-medium text-[oklch(0.25_0.02_60)] sm:text-2xl">
            👉 Você não está sozinho. <span className="italic">E existe um caminho.</span>
          </p>
        </div>
      </section>

      {/* POSICIONAMENTO */}
      <section className="relative bg-[oklch(0.16_0.01_60)] px-6 py-24 text-white md:py-32 md:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-white/50">
              ✝️ Posicionamento
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Na Way Maker Church, não focamos em
              <span className="italic font-normal" style={{ color: "oklch(0.85 0.12 85)" }}>
                {" "}aparência, performance ou entretenimento.
              </span>
            </h2>
          </div>

          <p className="mb-10 text-center text-lg text-white/70">Somos uma igreja:</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Cross, text: "Centrada em Cristo e na cruz" },
              { icon: BookOpen, text: "Baseada na verdade bíblica" },
              { icon: Sparkles, text: "Focada em transformação real, não apenas frequência" },
              { icon: UsersRound, text: "Construída sobre comunhão verdadeira e pertencimento" },
              { icon: HandHeart, text: "Comprometida com cuidar de pessoas de forma prática" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 backdrop-blur-sm"
              >
                <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "oklch(0.85 0.12 85)" }} />
                <span className="text-base leading-relaxed text-white/90">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <p className="font-display text-2xl font-medium leading-snug sm:text-3xl">
              Aqui, você não é mais um.
              <br />
              <span className="italic" style={{ color: "oklch(0.85 0.12 85)" }}>
                Você faz parte de uma família.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* HISTÓRIA / AUTORIDADE */}
      <section className="px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto grid max-w-6xl gap-16 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              💬 Nossa história
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              A Way Maker Church nasceu com uma visão clara:
              <span className="italic font-normal" style={{ color: "oklch(0.55 0.12 110)" }}>
                {" "}romper com o superficial e voltar ao essencial — Cristo.
              </span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[oklch(0.4_0.02_60)]">
              Com mais de 15 anos de experiência ministerial, nosso pastor lidera uma comunidade
              que cresce com base em:
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { icon: BookOpen, text: "Ensino bíblico sólido" },
              { icon: Users, text: "Discipulado intencional" },
              { icon: Heart, text: "Relacionamentos verdadeiros" },
              { icon: Sparkles, text: "Impacto real na vida das pessoas" },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white px-6 py-5 shadow-sm"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Icon className="h-5 w-5" style={{ color: "oklch(0.55 0.12 110)" }} />
                </span>
                <span className="text-base font-medium text-[oklch(0.25_0.02_60)] sm:text-lg">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="font-display text-2xl font-medium italic text-[oklch(0.25_0.02_60)] sm:text-3xl">
            Não somos sobre eventos.
            <br />
            <span className="not-italic font-semibold" style={{ color: "oklch(0.45 0.13 110)" }}>
              Somos sobre transformação.
            </span>
          </p>
        </div>
      </section>

      {/* O QUE VOCÊ VAI ENCONTRAR */}
      <section
        className="px-6 py-24 md:py-32 md:px-10"
        style={{ backgroundColor: "oklch(0.97 0.01 90)" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              🌱 O que você vai encontrar aqui
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Tudo o que sua alma busca,
              <br className="hidden sm:block" /> em um só lugar.
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BookOpen, text: "Uma palavra bíblica que confronta e transforma" },
              { icon: HandHeart, text: "Um ambiente simples, acolhedor e sem julgamentos" },
              { icon: Users, text: "Pessoas reais, vivendo processos reais" },
              { icon: Heart, text: "Apoio espiritual e emocional" },
              { icon: UsersRound, text: "Comunhão verdadeira" },
              { icon: Sparkles, text: "Oportunidade de crescer e servir" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="group rounded-3xl border border-black/5 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Icon className="h-6 w-6" style={{ color: "oklch(0.5 0.12 110)" }} />
                </span>
                <p className="text-base leading-relaxed text-[oklch(0.28_0.02_60)] sm:text-lg">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRÓXIMOS PASSOS */}
      <section id="comecar" className="px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              🚪 Como você pode começar
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Você pode dar o próximo passo
              <br className="hidden sm:block" />
              <span className="italic font-normal" style={{ color: "oklch(0.5 0.12 110)" }}>
                {" "}no seu tempo 👇
              </span>
            </h2>
          </div>

          {/* DIAS DE CULTO + ENDEREÇO + MAPA */}
          <div className="mb-16 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Calendar className="h-5 w-5" style={{ color: "oklch(0.5 0.12 110)" }} />
                </span>
                <h3 className="font-display text-xl font-semibold text-[oklch(0.18_0.01_60)]">
                  📅 Dias de culto
                </h3>
              </div>
              <ul className="mt-6 space-y-3 text-base leading-relaxed text-[oklch(0.3_0.02_60)]">
                <li className="flex gap-3"><span className="text-[oklch(0.5_0.12_110)]">•</span> Domingo – 10h30min</li>
                <li className="flex gap-3"><span className="text-[oklch(0.5_0.12_110)]">•</span> Segunda – 8pm (Ensino Bíblico)</li>
                <li className="flex gap-3"><span className="text-[oklch(0.5_0.12_110)]">•</span> Quarta – 8pm (Culto)</li>
                <li className="flex gap-3"><span className="text-[oklch(0.5_0.12_110)]">•</span> Sexta-feira – 8pm Culto de Jovens</li>
                <li className="flex gap-3"><span className="text-[oklch(0.5_0.12_110)]">•</span> Santa Ceia – sempre o primeiro domingo do mês</li>
              </ul>
            </div>

            <div className="flex flex-col rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <MapPin className="h-5 w-5" style={{ color: "oklch(0.5 0.12 110)" }} />
                </span>
                <h3 className="font-display text-xl font-semibold text-[oklch(0.18_0.01_60)]">
                  📍 Endereço
                </h3>
              </div>
              <p className="mt-6 text-base leading-relaxed text-[oklch(0.3_0.02_60)]">
                110 Paris St 2FL, Newark, New Jersey
              </p>
              <div className="mt-6 overflow-hidden rounded-2xl border border-black/5">
                <iframe
                  title="Mapa Way Maker Church"
                  src="https://www.google.com/maps?q=110+Paris+St+2FL,+Newark,+New+Jersey&output=embed"
                  width="100%"
                  height="260"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=110+Paris+St+2FL,+Newark,+New+Jersey"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center justify-center gap-2 self-start rounded-full bg-[oklch(0.16_0.01_60)] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02] hover:bg-[oklch(0.22_0.01_60)]"
              >
                <Navigation className="h-4 w-4" />
                Como chegar
              </a>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                icon: MessageCircle,
                title: "Falar com alguém da nossa equipe",
                desc: "Se você prefere conversar antes, estamos aqui para te ouvir.",
                href: WHATSAPP_URL,
              },
              {
                icon: UsersRound,
                title: "Fazer parte de um grupo / célula",
                desc: "Cresça em um ambiente mais próximo, com acompanhamento real.",
                href: WHATSAPP_URL,
              },
            ].map(({ icon: Icon, title, desc, href }) => (
              <a
                key={title}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group relative flex flex-col rounded-3xl border border-black/5 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <span
                  className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "oklch(0.16 0.01 60)" }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <h3 className="font-display text-xl font-semibold leading-tight text-[oklch(0.18_0.01_60)]">
                  {title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[oklch(0.45_0.02_60)]">
                  {desc}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[oklch(0.18_0.01_60)]">
                  Dar este passo
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* REDES SOCIAIS */}
      <section className="px-6 py-20 md:px-10" style={{ backgroundColor: "oklch(0.16 0.01 60)" }}>
        <div className="mx-auto max-w-3xl text-center text-white">
          <span className="text-xs uppercase tracking-[0.25em] text-white/50">
            📲 Acompanhe e se conecte
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Siga a Way Maker Church no Instagram
            <br className="hidden sm:block" />
            <span className="italic font-normal" style={{ color: "oklch(0.85 0.12 85)" }}>
              {" "}e acompanhe tudo que está acontecendo.
            </span>
          </h2>
          <div className="mt-10 flex justify-center">
            <a
              href="https://www.instagram.com/waymakerbchurch/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-semibold text-black shadow-xl shadow-black/30 transition hover:scale-[1.02]"
            >
              <Instagram className="h-5 w-5" />
              Seguir no Instagram
            </a>
          </div>
        </div>
      </section>

      {/* ACOLHIMENTO */}
      <section
        className="px-6 py-24 md:py-32 md:px-10"
        style={{ backgroundColor: "oklch(0.96 0.02 95)" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.45_0.08_75)]">
            💛 Acolhimento
          </span>
          <p className="mt-6 font-display text-3xl font-medium leading-tight tracking-tight text-[oklch(0.2_0.02_60)] sm:text-4xl md:text-5xl">
            Não importa como você chega.
            <br />
            <span className="italic" style={{ color: "oklch(0.45 0.13 110)" }}>
              O que importa é que você encontrou um lugar para recomeçar.
            </span>
          </p>
        </div>
      </section>

      {/* CTAs SECUNDÁRIOS */}
      <section id="ctas" className="px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
            🔘 Próximo passo
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Escolha como quer começar
          </h2>

          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:flex-wrap">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.18_0.01_60)] px-8 py-4 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]"
            >
              Quero participar de um culto
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.18_0.01_60)] bg-white px-8 py-4 text-sm font-semibold text-[oklch(0.18_0.01_60)] transition hover:bg-[oklch(0.18_0.01_60)] hover:text-white"
            >
              Quero falar com alguém
              <MessageCircle className="h-4 w-4" />
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]"
              style={{ backgroundColor: "oklch(0.5 0.13 110)" }}
            >
              Quero entrar em um grupo
              <UsersRound className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* QUEBRA DE OBJEÇÃO */}
      <section className="bg-[oklch(0.16_0.01_60)] px-6 py-24 text-white md:py-32 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs uppercase tracking-[0.25em] text-white/50">
            ⏳ Talvez você esteja pensando…
          </span>
          <blockquote className="mt-8 font-display text-3xl font-medium italic leading-tight tracking-tight sm:text-4xl md:text-5xl">
            “E se eu nunca fui em uma igreja assim?”
          </blockquote>
          <div className="mt-10 inline-flex items-center gap-3 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur-md">
            <Compass className="h-4 w-4" style={{ color: "oklch(0.85 0.12 85)" }} />
            Sem problema.
          </div>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/80">
            Você será recebido com respeito,
            <br className="hidden sm:block" /> sem pressão e sem expectativas irreais.
          </p>
        </div>
      </section>

      {/* FECHAMENTO */}
      <section className="px-6 py-28 md:py-40 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[oklch(0.95_0.04_95)]">
            <Cross className="h-7 w-7" style={{ color: "oklch(0.5 0.12 110)" }} />
          </span>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Existe um caminho.
            <br />
            <span className="italic font-normal" style={{ color: "oklch(0.45 0.13 110)" }}>
              E talvez esse seja o seu momento de começar.
            </span>
          </h2>

          <div className="mt-12">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-[oklch(0.18_0.01_60)] px-10 py-5 text-base font-semibold text-white shadow-2xl shadow-black/20 transition hover:scale-[1.02]"
            >
              Quero dar o primeiro passo
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-white px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-[oklch(0.5_0.02_60)] sm:flex-row">
          <div className="flex items-center gap-3">
            <img src={wayMakerLogo} alt="Way Maker Church" className="h-7 w-7 object-contain" />
            <span className="font-display font-semibold text-[oklch(0.2_0.02_60)]">
              Way Maker Church
            </span>
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} Way Maker Church. Todos os direitos reservados.
          </p>
          <Link to="/login" className="text-xs font-medium hover:text-[oklch(0.2_0.02_60)]">
            Área do membro →
          </Link>
        </div>
      </footer>

      {/* FLOATING WHATSAPP BUTTON */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco no WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-black/30 ring-4 ring-[#25D366]/20 transition hover:scale-110 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
        style={{ animation: "wmc-pulse 2.4s ease-in-out infinite" }}
      >
        <img src={whatsappIcon} alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
      </a>
      <style>{`
        @keyframes wmc-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.55), 0 10px 25px -5px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(37, 211, 102, 0), 0 10px 25px -5px rgba(0,0,0,0.3); }
        }
      `}</style>
    </div>
  );
}
