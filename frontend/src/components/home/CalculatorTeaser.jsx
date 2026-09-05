import { useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Calculator, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateCostThunk } from "@/features/parcels/parcelSlice";
import { SHOP_HUB_OPTIONS, placesForCountry } from "@/lib/intlData";
import { formatMoney } from "@/lib/intlData";
import { useI18n } from "@/i18n";

const COUNTRIES = [
  "United States","United Kingdom","United Arab Emirates","Germany","China","Singapore","Hong Kong",
  "Kenya","Canada","Australia","Saudi Arabia","Qatar","India","South Africa","Uganda",
].sort();

const CATEGORIES = [
  { value: "small_package", labelKey: "calculator.categorySmallPackage" },
  { value: "document", labelKey: "calculator.categoryDocument" },
  { value: "clothing", labelKey: "calculator.categoryClothing" },
  { value: "electronics", labelKey: "calculator.categoryElectronics" },
  { value: "fragile", labelKey: "calculator.categoryFragile" },
  { value: "books", labelKey: "calculator.categoryBooks" },
];

export default function CalculatorTeaser() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const [hub, setHub] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("small_package");
  const [weight, setWeight] = useState("1");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    if (!hub || !country) return;
    setLoading(true);
    setResult(null);
    try {
      const destPlaces = placesForCountry(country);
      const destinationCity = destPlaces[0] || country;
      const payload = {
        shipmentType: "international",
        originCountry: hub,
        originCity: SHOP_HUB_OPTIONS.find((h) => h.value === hub)?.city,
        destinationCountry: country,
        destinationCity,
        parcelCategory: category,
        weight: Number(weight) || 1,
        deliveryType: "standard",
      };
      const res = await dispatch(calculateCostThunk(payload)).unwrap();
      setResult(res);
    } catch {
      /* toast is shown by the slice */
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="estimator-heading" id="estimate" className="border-y border-border/70 bg-surface/60">
      <div className="shell-md grid gap-10 py-20 md:py-28 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="max-w-[420px]">
          <p className="mb-4 text-[13px] font-bold uppercase tracking-[0.14em] text-accent">{t("calculator.eyebrow")}</p>
          <h2 id="estimator-heading" className="text-balance font-display text-3xl font-bold leading-[1.12] tracking-tight text-foreground md:text-[40px]">
            {t("calculator.teaserTitle")}
          </h2>
          <p className="mt-5 text-pretty text-[16px] leading-[1.7] text-muted-foreground md:text-[17px]">
            {t("calculator.teaserSubtitle")}
          </p>
          <Link to="/calculate" className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-primary underline-offset-4 hover:underline">
            {t("calculator.teaserOpenFull")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_44px_-26px_rgba(15,23,42,0.25)] md:p-9">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teaser-hub" className="text-[13px] font-semibold text-foreground">{t("calculator.labelFromHub")}</Label>
              <Select value={hub} onValueChange={setHub}>
                <SelectTrigger id="teaser-hub" className="h-[52px] rounded-[10px] border-border bg-white text-[15px]">
                  <SelectValue placeholder={t("calculator.placeholderSelectHub")} />
                </SelectTrigger>
                <SelectContent>
                  {SHOP_HUB_OPTIONS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>{h.flag} {h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teaser-country" className="text-[13px] font-semibold text-foreground">{t("calculator.labelToCountry")}</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="teaser-country" className="h-[52px] rounded-[10px] border-border bg-white text-[15px]">
                  <SelectValue placeholder={t("calculator.placeholderSelectCountry")} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teaser-cat" className="text-[13px] font-semibold text-foreground">{t("calculator.labelContent")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="teaser-cat" className="h-[52px] rounded-[10px] border-border bg-white text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teaser-weight" className="text-[13px] font-semibold text-foreground">{t("calculator.labelWeightKg")}</Label>
              <Input
                id="teaser-weight"
                type="number"
                min="0.1"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-[52px] rounded-[10px] border-border bg-white text-[15px]"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={calculate} disabled={loading} className="h-[52px] rounded-[10px] bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/95">
              <Calculator className="mr-2 h-4 w-4" />
              {loading ? t("calculator.btnEstimating") : t("calculator.btnEstimate")}
            </Button>
            {result && (
              <div className="flex items-baseline gap-2" aria-live="polite">
                <span className="text-sm text-muted-foreground">{t("calculator.estimatedTotal")}</span>
                <span className="font-display text-2xl font-extrabold tracking-tight text-foreground">
                  {formatMoney(result.price, result.currency)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
