import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  Church,
  Gift,
  Plus,
} from "lucide-react";
import wayMakerLogo from "@/assets/waymaker-logo.png";
import wayMakerIcon from "@/assets/waymaker-icon.png";
import heroImage from "@/assets/waymaker-hero.jpg";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Way Maker Church — A place to live the Gospel for real" },
      {
        name: "description",
        content:
          "A Christ-centered community where lives are transformed, families are restored, and purpose in God becomes real.",
      },
      { property: "og:title", content: "Way Maker Church — A place to live the Gospel for real" },
      {
        property: "og:description",
        content:
          "A Christ-centered community where lives are transformed, families are restored, and purpose in God becomes real.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

const WHATSAPP_URL =
  "https://wa.me/18622362964?text=Hello%2C%20I%20came%20through%20social%20media%20and%20would%20like%20more%20information%20about%20Way%20Maker";

const ACTIVE_DONATION_URL = "https://buy.stripe.com/6oU9AVdhw6mJgBg3jD8og01";

function LandingPage() {
  const { t } = useTranslation();

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  const donationOptions = [
    {
      key: "pastoral",
      icon: Church,
      title: t("landingDonation.options.pastoral.title"),
      description: t("landingDonation.options.pastoral.description"),
      status: t("landingDonation.active"),
      enabled: true,
    },
    {
      key: "tithes",
      icon: HandHeart,
      title: t("landingDonation.options.tithes.title"),
      description: t("landingDonation.options.tithes.description"),
      status: t("landingDonation.comingSoon"),
      enabled: false,
    },
    {
      key: "offerings",
      icon: Gift,
      title: t("landingDonation.options.offerings.title"),
      description: t("landingDonation.options.offerings.description"),
      status: t("landingDonation.comingSoon"),
      enabled: false,
    },
    {
      key: "other",
      icon: Plus,
      title: t("landingDonation.options.other.title"),
      description: t("landingDonation.options.other.description"),
      status: t("landingDonation.comingSoon"),
      enabled: false,
    },
  ] as const;

  const handleDonationOptionClick = () => {
    try {
      (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push?.({
        event: "donate_clicked",
        source: "floating_button",
        category: "pastoral_ministry",
        timestamp: new Date().toISOString(),
      });
    } catch {
      // ignore
    }

    window.open(ACTIVE_DONATION_URL, "_blank", "noopener,noreferrer");
  };

  const feelings = ["noPurpose", "disappointed", "wounded", "missing", "shallow"] as const;
  const values: Array<{ icon: typeof Cross; key: "christCentered" | "biblical" | "transformation" | "community" | "care" }> = [
    { icon: Cross, key: "christCentered" },
    { icon: BookOpen, key: "biblical" },
    { icon: Sparkles, key: "transformation" },
    { icon: UsersRound, key: "community" },
    { icon: HandHeart, key: "care" },
  ];
  const pillars: Array<{ icon: typeof BookOpen; key: "teaching" | "discipleship" | "relationships" | "impact" }> = [
    { icon: BookOpen, key: "teaching" },
    { icon: Users, key: "discipleship" },
    { icon: Heart, key: "relationships" },
    { icon: Sparkles, key: "impact" },
  ];
  const findItems: Array<{ icon: typeof BookOpen; key: "biblical" | "welcoming" | "real" | "support" | "fellowship" | "growServe" }> = [
    { icon: BookOpen, key: "biblical" },
    { icon: HandHeart, key: "welcoming" },
    { icon: Users, key: "real" },
    { icon: Heart, key: "support" },
    { icon: UsersRound, key: "fellowship" },
    { icon: Sparkles, key: "growServe" },
  ];

  return (
    <div className="min-h-screen bg-[oklch(0.99_0.003_85)] text-[oklch(0.18_0.01_60)] antialiased">
      {/* Top nav */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <a href="#top" className="flex items-center gap-3">
            <img src={wayMakerIcon} alt="Way Maker Church" className="h-14 w-14 md:h-16 md:w-16 object-contain" />
            <span className="font-display text-base font-semibold tracking-tight text-white drop-shadow-sm">
              Way Maker Church
            </span>
          </a>
          <Link
            to="/login"
            className="inline-block rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/20 md:px-4 md:py-2 md:text-sm"
          >
            {t("landingPage.memberArea")}
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImage}
            alt={t("landingPage.communityWorshipAlt")}
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
        </div>

        <div className="mx-auto flex min-h-[100svh] max-w-5xl flex-col items-center justify-center px-6 py-32 text-center text-white md:px-10">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "oklch(0.82 0.13 85)" }} />
            {t("landingPage.heroBadge")}
          </span>

          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {t("landingPage.heroTitle1")}
            <br className="hidden sm:block" />
            <span className="italic font-normal" style={{ color: "oklch(0.85 0.12 85)" }}>
              {t("landingPage.heroTitle2")}
            </span>
            <br />
            {t("landingPage.heroTitle3")}
          </h1>

          <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            {t("landingPage.heroLead1")}
            <br className="hidden sm:block" /> {t("landingPage.heroLead2")}
            <br className="hidden sm:block" /> {t("landingPage.heroLead3")}
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
              {t("landingPage.heroCta")}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
          </div>

          <a
            href="#conexao"
            className="mt-20 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white/90"
          >
            {t("landingPage.continue")}
          </a>
        </div>
      </section>

      {/* CONNECTION / IDENTIFICATION */}
      <section id="conexao" className="relative px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              {t("landingPage.identification")}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t("landingPage.ifYouFeel")}
            </h2>
          </div>

          <ul className="space-y-5">
            {feelings.map((key) => (
              <li
                key={key}
                className="flex items-start gap-4 rounded-2xl border border-black/5 bg-white px-6 py-5 shadow-sm"
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Check className="h-4 w-4" style={{ color: "oklch(0.55 0.12 110)" }} />
                </span>
                <span className="text-base leading-relaxed text-[oklch(0.28_0.02_60)] sm:text-lg">
                  {t(`landingPage.feelings.${key}`)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-12 text-center font-display text-xl font-medium text-[oklch(0.25_0.02_60)] sm:text-2xl">
            {t("landingPage.notAlone")} <span className="italic">{t("landingPage.thereIsAWay")}</span>
          </p>
        </div>
      </section>

      {/* POSITIONING */}
      <section className="relative bg-[oklch(0.16_0.01_60)] px-6 py-24 text-white md:py-32 md:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-white/50">
              {t("landingPage.positioning")}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t("landingPage.positioningTitle1")}
              <span className="italic font-normal" style={{ color: "oklch(0.85 0.12 85)" }}>
                {t("landingPage.positioningTitle2")}
              </span>
            </h2>
          </div>

          <p className="mb-10 text-center text-lg text-white/70">{t("landingPage.weAreChurch")}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {values.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 backdrop-blur-sm"
              >
                <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "oklch(0.85 0.12 85)" }} />
                <span className="text-base leading-relaxed text-white/90">{t(`landingPage.values.${key}`)}</span>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <p className="font-display text-2xl font-medium leading-snug sm:text-3xl">
              {t("landingPage.notJustOne")}
              <br />
              <span className="italic" style={{ color: "oklch(0.85 0.12 85)" }}>
                {t("landingPage.youAreFamily")}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* OUR STORY */}
      <section className="px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto grid max-w-6xl gap-16 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              {t("landingPage.ourStoryTag")}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t("landingPage.ourStoryTitle1")}
              <span className="italic font-normal" style={{ color: "oklch(0.55 0.12 110)" }}>
                {t("landingPage.ourStoryTitle2")}
              </span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[oklch(0.4_0.02_60)]">
              {t("landingPage.ourStoryLead")}
            </p>
          </div>

          <ul className="space-y-4">
            {pillars.map(({ icon: Icon, key }) => (
              <li
                key={key}
                className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white px-6 py-5 shadow-sm"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Icon className="h-5 w-5" style={{ color: "oklch(0.55 0.12 110)" }} />
                </span>
                <span className="text-base font-medium text-[oklch(0.25_0.02_60)] sm:text-lg">
                  {t(`landingPage.pillars.${key}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="font-display text-2xl font-medium italic text-[oklch(0.25_0.02_60)] sm:text-3xl">
            {t("landingPage.notEvents")}
            <br />
            <span className="not-italic font-semibold" style={{ color: "oklch(0.45 0.13 110)" }}>
              {t("landingPage.transformation")}
            </span>
          </p>
        </div>
      </section>

      {/* WHAT YOU'LL FIND */}
      <section
        className="px-6 py-24 md:py-32 md:px-10"
        style={{ backgroundColor: "oklch(0.97 0.01 90)" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              {t("landingPage.findHereTag")}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t("landingPage.findHereTitle1")}
              <br className="hidden sm:block" /> {t("landingPage.findHereTitle2")}
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {findItems.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="group rounded-3xl border border-black/5 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Icon className="h-6 w-6" style={{ color: "oklch(0.5 0.12 110)" }} />
                </span>
                <p className="text-base leading-relaxed text-[oklch(0.28_0.02_60)] sm:text-lg">
                  {t(`landingPage.find.${key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEXT STEPS */}
      <section id="comecar" className="px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
              {t("landingPage.howStartTag")}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t("landingPage.yourTimeTitle1")}
              <br className="hidden sm:block" />
              <span className="italic font-normal" style={{ color: "oklch(0.5 0.12 110)" }}>
                {t("landingPage.yourTimeTitle2")}
              </span>
            </h2>
          </div>

          {/* SCHEDULE + ADDRESS */}
          <div className="mb-16 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "oklch(0.95 0.04 95)" }}
                >
                  <Calendar className="h-5 w-5" style={{ color: "oklch(0.5 0.12 110)" }} />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[oklch(0.5_0.12_110)]">
                    {t("landingPage.officialSchedule")}
                  </p>
                  <h3 className="font-display text-xl font-semibold text-[oklch(0.18_0.01_60)]">
                    {t("landingPage.serviceDays")}
                  </h3>
                </div>
              </div>

              <div className="mt-6 space-y-5 text-[oklch(0.3_0.02_60)]">
                <div className="animate-fade-in">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.18_0.01_60)]">{t("landingPage.sunday")}</p>
                  <ul className="mt-2 space-y-1.5 text-base leading-relaxed">
                    <li className="flex gap-2"><span>☕</span><span><span className="font-medium text-[oklch(0.18_0.01_60)]">9:30 AM</span> — {t("landingPage.colonialBreakfast")} <span className="text-sm text-[oklch(0.5_0.02_60)]">{t("landingPage.membersAndVisitors")}</span></span></li>
                    <li className="flex gap-2"><span>🙌</span><span><span className="font-medium text-[oklch(0.18_0.01_60)]">10:30 AM</span> — {t("landingPage.worshipService")}</span></li>
                  </ul>
                </div>

                <div className="animate-fade-in">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.18_0.01_60)]">{t("landingPage.mondayDay")}</p>
                  <ul className="mt-2 space-y-1.5 text-base leading-relaxed">
                    <li className="flex gap-2"><span>📖</span><span><span className="font-medium text-[oklch(0.18_0.01_60)]">8:00 PM</span> — {t("landingPage.biblicalTeaching")} <span className="text-sm text-[oklch(0.5_0.02_60)]">{t("landingPage.biblicalTeachingNote")}</span></span></li>
                  </ul>
                </div>

                <div className="animate-fade-in">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.18_0.01_60)]">{t("landingPage.wednesday")}</p>
                  <ul className="mt-2 space-y-1.5 text-base leading-relaxed">
                    <li className="flex gap-2"><span>🔥</span><span><span className="font-medium text-[oklch(0.18_0.01_60)]">8:00 PM</span> — {t("landingPage.rescueService")}</span></li>
                  </ul>
                </div>

                <div className="animate-fade-in">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.18_0.01_60)]">{t("landingPage.friday")}</p>
                  <ul className="mt-2 space-y-1.5 text-base leading-relaxed">
                    <li className="flex gap-2"><span>⚡</span><span><span className="font-medium text-[oklch(0.18_0.01_60)]">8:00 PM</span> — {t("landingPage.youthService")}</span></li>
                  </ul>
                </div>

                <div className="border-t border-black/5 pt-4 space-y-2 text-sm leading-relaxed">
                  <p className="flex gap-2"><span>🍞</span><span><span className="font-medium text-[oklch(0.18_0.01_60)]">{t("landingPage.communion")}</span> {t("landingPage.communionNote")}</span></p>
                  <p className="flex gap-2"><span>🌸</span><span><span className="font-medium text-[oklch(0.18_0.01_60)]">{t("landingPage.ellaMinistry")}</span> {t("landingPage.ellaNote")}</span></p>
                </div>
              </div>

              <div className="mt-8 rounded-2xl bg-[oklch(0.16_0.01_60)] p-6 text-center animate-fade-in">
                <p className="font-display text-lg font-medium leading-snug text-white sm:text-xl">
                  {t("landingPage.jesusRestores")}
                </p>
                <p className="mt-2 text-sm text-[oklch(0.75_0.04_90)]">
                  {t("landingPage.allLivesPrecious")}
                </p>
              </div>
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
                  {t("landingPage.addressTitle")}
                </h3>
              </div>
              <p className="mt-6 text-base leading-relaxed text-[oklch(0.3_0.02_60)]">
                {t("landingPage.addressLine")}
              </p>
              <div className="mt-6 overflow-hidden rounded-2xl border border-black/5">
                <iframe
                  title={t("landingPage.mapTitle")}
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
                {t("landingPage.directions")}
              </a>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {[
              { icon: MessageCircle, titleKey: "talkToTeam", descKey: "talkToTeamDesc" },
              { icon: UsersRound, titleKey: "joinGroup", descKey: "joinGroupDesc" },
            ].map(({ icon: Icon, titleKey, descKey }) => (
              <a
                key={titleKey}
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col rounded-3xl border border-black/5 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <span
                  className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "oklch(0.16 0.01 60)" }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <h3 className="font-display text-xl font-semibold leading-tight text-[oklch(0.18_0.01_60)]">
                  {t(`landingPage.${titleKey}`)}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[oklch(0.45_0.02_60)]">
                  {t(`landingPage.${descKey}`)}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[oklch(0.18_0.01_60)]">
                  {t("landingPage.takeThisStep")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL */}
      <section className="px-6 py-20 md:px-10" style={{ backgroundColor: "oklch(0.16 0.01 60)" }}>
        <div className="mx-auto max-w-3xl text-center text-white">
          <span className="text-xs uppercase tracking-[0.25em] text-white/50">
            {t("landingPage.followTag")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t("landingPage.followTitle1")}
            <br className="hidden sm:block" />
            <span className="italic font-normal" style={{ color: "oklch(0.85 0.12 85)" }}>
              {t("landingPage.followTitle2")}
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
              {t("landingPage.followInstagram")}
            </a>
          </div>
        </div>
      </section>

      {/* WELCOME */}
      <section
        className="px-6 py-24 md:py-32 md:px-10"
        style={{ backgroundColor: "oklch(0.96 0.02 95)" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.45_0.08_75)]">
            {t("landingPage.welcomeTag")}
          </span>
          <p className="mt-6 font-display text-3xl font-medium leading-tight tracking-tight text-[oklch(0.2_0.02_60)] sm:text-4xl md:text-5xl">
            {t("landingPage.welcomeTitle1")}
            <br />
            <span className="italic" style={{ color: "oklch(0.45 0.13 110)" }}>
              {t("landingPage.welcomeTitle2")}
            </span>
          </p>
        </div>
      </section>

      {/* SECONDARY CTAs */}
      <section id="ctas" className="px-6 py-24 md:py-32 md:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <span className="text-xs uppercase tracking-[0.25em] text-[oklch(0.55_0.06_60)]">
            {t("landingPage.nextStepTag")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            {t("landingPage.chooseHowStart")}
          </h2>

          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:flex-wrap">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.18_0.01_60)] px-8 py-4 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]"
            >
              {t("landingPage.joinService")}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.18_0.01_60)] bg-white px-8 py-4 text-sm font-semibold text-[oklch(0.18_0.01_60)] transition hover:bg-[oklch(0.18_0.01_60)] hover:text-white"
            >
              {t("landingPage.talkToSomeone")}
              <MessageCircle className="h-4 w-4" />
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]"
              style={{ backgroundColor: "oklch(0.5 0.13 110)" }}
            >
              {t("landingPage.joinAGroup")}
              <UsersRound className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* OBJECTION */}
      <section className="bg-[oklch(0.16_0.01_60)] px-6 py-24 text-white md:py-32 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs uppercase tracking-[0.25em] text-white/50">
            {t("landingPage.objectionTag")}
          </span>
          <blockquote className="mt-8 font-display text-3xl font-medium italic leading-tight tracking-tight sm:text-4xl md:text-5xl">
            {t("landingPage.objection")}
          </blockquote>
          <div className="mt-10 inline-flex items-center gap-3 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur-md">
            <Compass className="h-4 w-4" style={{ color: "oklch(0.85 0.12 85)" }} />
            {t("landingPage.noProblem")}
          </div>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/80">
            {t("landingPage.objectionLead1")}
            <br className="hidden sm:block" /> {t("landingPage.objectionLead2")}
          </p>
        </div>
      </section>

      {/* CLOSING */}
      <section className="px-6 py-28 md:py-40 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[oklch(0.95_0.04_95)]">
            <Cross className="h-7 w-7" style={{ color: "oklch(0.5 0.12 110)" }} />
          </span>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {t("landingPage.thereIsWay")}
            <br />
            <span className="italic font-normal" style={{ color: "oklch(0.45 0.13 110)" }}>
              {t("landingPage.yourMomentTitle")}
            </span>
          </h2>

          <div className="mt-12">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-[oklch(0.18_0.01_60)] px-10 py-5 text-base font-semibold text-white shadow-2xl shadow-black/20 transition hover:scale-[1.02]"
            >
              {t("landingPage.firstStep")}
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
            © {new Date().getFullYear()} Way Maker Church. {t("landingPage.rightsReserved")}
          </p>
          <Link to="/login" className="text-xs font-medium hover:text-[oklch(0.2_0.02_60)]">
            {t("landingPage.memberArea")} →
          </Link>
        </div>
      </footer>

      {/* FLOATING DONATE + WHATSAPP ACTIONS */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-row items-center gap-3 sm:bottom-6 sm:right-6 lg:bottom-8 lg:right-8">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("landingDonation.button")}
              className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.82_0.17_90)] px-3 py-2 text-xs font-semibold text-[oklch(0.2_0.02_60)] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition duration-200 hover:scale-[1.03] hover:brightness-[1.03] sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <Heart className="h-4 w-4 fill-current" />
              <span>{t("landingDonation.button")}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" sideOffset={12} className="w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-black/10 bg-white p-3 shadow-2xl">
          <div className="mb-2 px-2 pt-1">
            <p className="font-display text-base font-semibold text-[oklch(0.18_0.01_60)]">
              {t("landingDonation.title")}
            </p>
            <p className="mt-1 text-xs text-[oklch(0.45_0.02_60)]">
              {t("landingDonation.subtitle")}
            </p>
          </div>

          <div className="space-y-2">
            {donationOptions.map((option) => {
              const Icon = option.icon;

              if (option.enabled) {
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={handleDonationOptionClick}
                    className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-[oklch(0.98_0.01_90)] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[oklch(0.5_0.12_110)] hover:bg-[oklch(0.96_0.02_95)]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[oklch(0.95_0.04_95)] text-[oklch(0.5_0.12_110)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[oklch(0.18_0.01_60)]">{option.title}</span>
                      <span className="mt-0.5 block text-xs text-[oklch(0.45_0.02_60)]">{option.description}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[oklch(0.95_0.04_95)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[oklch(0.5_0.12_110)]">
                      {option.status}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={option.key}
                  aria-disabled="true"
                  className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[oklch(0.985_0.003_85)] px-3 py-3 opacity-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[oklch(0.95_0.01_85)] text-[oklch(0.4_0.01_60)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[oklch(0.18_0.01_60)]">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-[oklch(0.45_0.02_60)]">{option.description}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[oklch(0.94_0.003_85)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[oklch(0.4_0.01_60)]">
                    {option.status}
                  </span>
                </div>
              );
            })}
          </div>
          </PopoverContent>
        </Popover>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("landingPage.whatsappAria")}
          className="flex h-12 w-12 items-center justify-center rounded-full transition hover:scale-110 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
          style={{ animation: "wmc-pulse 2.4s ease-in-out infinite", filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.25))" }}
        >
          <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
            <path
              fill="#25D366"
              d="M16 .5C7.44.5.5 7.44.5 16c0 2.82.74 5.47 2.04 7.77L.5 31.5l7.94-2.02A15.46 15.46 0 0 0 16 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5z"
            />
            <path
              fill="#FFFFFF"
              d="M23.47 19.62c-.32-.16-1.88-.93-2.17-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.88-1.76-2.2-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.54-.71-.55-.18-.01-.4-.01-.61-.01-.21 0-.55.08-.84.4-.29.32-1.1 1.07-1.1 2.62 0 1.55 1.13 3.04 1.29 3.25.16.21 2.22 3.39 5.38 4.75.75.32 1.34.51 1.8.66.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.26-.74.26-1.37.18-1.51-.07-.13-.29-.21-.61-.37z"
            />
          </svg>
        </a>
      </div>
      <style>{`
        @keyframes wmc-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.55), 0 10px 25px -5px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(37, 211, 102, 0), 0 10px 25px -5px rgba(0,0,0,0.3); }
        }
      `}</style>
    </div>
  );
}
