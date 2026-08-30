import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { assetUrl } from "../utils/assetUrl.js";

function ContactEmail() {
  const { t } = useI18n();
  const parts = useMemo(
    () => ({
      user: "arminonline71",
      at: "@",
      domain: "gmail",
      dot: ".",
      tld: "com",
    }),
    [],
  );
  const [href, setHref] = useState("#");

  useEffect(() => {
    const address = `${parts.user}${parts.at}${parts.domain}${parts.dot}${parts.tld}`;
    setHref(`mailto:${address}`);
  }, [parts]);

  return (
    <p className="text-sm text-ink">
      {t("aboutMe.contact")}{" "}
      <a href={href} className="text-moss underline-offset-2 hover:underline">
        {parts.user} {t("aboutMe.emailAt")} {parts.domain} {t("aboutMe.emailDot")}{" "}
        {parts.tld}
      </a>
    </p>
  );
}

export default function AboutMePage() {
  const { t } = useI18n();

  return (
    <div className="hx-rise mx-auto flex h-full min-h-0 max-w-3xl flex-col gap-5 overflow-y-auto pb-8">
      <PageHeader icon={User} title={t("aboutMe.title")}>
        <p className="text-sm text-muted">{t("aboutMe.subtitle")}</p>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-start">
        <div className="overflow-hidden rounded-2xl border border-line/80 bg-fog/40">
          <img
            src={assetUrl("about-me/armin.png")}
            alt={t("aboutMe.photoAlt")}
            className="aspect-[4/5] w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.hidden = false;
            }}
          />
          <div
            hidden
            className="flex aspect-[4/5] items-center justify-center px-3 text-center text-xs text-muted"
          >
            {t("aboutMe.photoFallback")}
          </div>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-ink">
          <p>{t("aboutMe.p1")}</p>
          <p>{t("aboutMe.p2")}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-line/80 bg-paper/70 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("aboutMe.interestsTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-ink">{t("aboutMe.interestsBody")}</p>
      </section>

      <ContactEmail />

      <div className="space-y-3">
        <blockquote className="border-s-2 border-moss ps-4 text-sm italic leading-relaxed text-ink/90">
          &ldquo;Beware the quiet man. For while others speak, he watches. While others act, he
          plans. And when they finally rest, he strikes.&rdquo; — Anonymous
        </blockquote>
        <blockquote
          dir="rtl"
          lang="fa"
          className="border-s-2 border-moss ps-4 text-sm italic leading-relaxed text-ink/90"
        >
          «از مرد خاموش برحذر باش. زیرا در حالی که دیگران سخن می‌گویند، او نظاره می‌کند. در حالی که
          دیگران عمل می‌کنند، او برنامه می‌ریزد. و هنگامی که سرانجام آرام می‌گیرند، او ضربه
          می‌زند.» — ناشناس
        </blockquote>
      </div>
    </div>
  );
}
