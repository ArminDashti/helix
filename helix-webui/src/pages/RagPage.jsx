import { Brain } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";

export default function RagPage() {
  const { t } = useI18n();
  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={Brain} title={t("nav.rag")} />
      <section className="rounded-2xl border border-line/80 bg-paper/80 p-4 text-sm text-muted">
        <p className="font-medium text-ink">{t("rag.subtitle")}</p>
        <p className="mt-2">{t("rag.placeholder")}</p>
      </section>
    </div>
  );
}
