import { Check, Globe } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * Language picker for the SwiftKifisha site (EN · ES · FR · AR · ZH).
 * `tone="dark"` is used on the dark footer; otherwise defaults to light.
 */
export default function LanguageSwitcher({ tone = "light", align = "end", compact = false, onSelect }) {
  const { lang, setLang, languages, t } = useI18n();
  const current = languages.find((l) => l.code === lang) ?? languages[0];

  const triggerCls =
    tone === "dark"
      ? "border-white/15 bg-transparent text-white/75 hover:bg-white/10 hover:text-white"
      : "border-border bg-white text-slate-600 hover:border-primary/30 hover:bg-surface hover:text-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
            triggerCls,
          )}
          aria-label={t("drawer.language")}
        >
          <Globe className="h-4 w-4 shrink-0" />
          {!compact && <span className="max-w-[100px] truncate">{current.native}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[190px]">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("drawer.language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => {
              setLang(l.code);
              onSelect?.();
            }}
            className="cursor-pointer"
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span>
                {l.native}
                <span className="ms-2 text-xs text-muted-foreground">{l.name}</span>
              </span>
              {l.code === lang && <Check className="h-4 w-4 shrink-0 text-accent" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
