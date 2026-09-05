import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, Globe2, Truck, Info } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { calculateCostThunk } from "@/features/parcels/parcelSlice";
import {
  SHOP_HUB_OPTIONS,
  WORLD_DESTINATION_OPTIONS,
  DESTINATION_PLACES,
  UGANDA_REGION_GROUPS,
  formatMoney,
} from "@/lib/intlData";
import { useI18n } from "@/i18n";

const categories = [
  { value: "document", labelKey: "calculator.categoryDocument" },
  { value: "electronics", labelKey: "calculator.categoryElectronics" },
  { value: "fragile", labelKey: "calculator.categoryFragile" },
  { value: "clothing", labelKey: "calculator.categoryClothing" },
  { value: "food", labelKey: "calculator.categoryFood" },
  { value: "medicine", labelKey: "calculator.categoryMedicine" },
  { value: "cosmetics", labelKey: "calculator.categoryCosmetics" },
  { value: "books", labelKey: "calculator.categoryBooks" },
  { value: "small_package", labelKey: "calculator.categorySmallPackage" },
  { value: "large_package", labelKey: "calculator.categoryLargePackage" },
];

const deliveryOptions = (intl) =>
  intl
    ? [
        { value: "standard", labelKey: "calculator.speedStandardIntl" },
        { value: "overnight", labelKey: "calculator.speedExpressIntl" },
        { value: "sameDay", labelKey: "calculator.speedPriorityIntl" },
      ]
    : [
        { value: "standard", labelKey: "calculator.speedStandardDom" },
        { value: "overnight", labelKey: "calculator.speedOvernightDom" },
        { value: "sameDay", labelKey: "calculator.speedSameDayDom" },
      ];

const EMPTY = { originCity: "", destinationCity: "", originHub: "", destinationCountry: "", parcelCategory: "", weight: 1, deliveryType: "standard" };

const COUNTRY_OPTIONS = WORLD_DESTINATION_OPTIONS.filter(
  (o, i, arr) => arr.findIndex((x) => x.country === o.country) === i,
);

const placesOf = (country) => {
  if (DESTINATION_PLACES[country]) return DESTINATION_PLACES[country];
  const entry = WORLD_DESTINATION_OPTIONS.find((o) => o.country === country);
  return entry ? [entry.capital] : [];
};

const groupedUgandaOptions = UGANDA_REGION_GROUPS.map((g) => ({
  label: g.label,
  items: g.cities.map((cc) => ({ value: cc, label: cc })),
}));

const CalculateCostPage = () => {
  const { t } = useI18n();
  const [shipmentType, setShipmentType] = useState("international");
  const [form, setForm] = useState({ ...EMPTY });

  const dispatch = useDispatch();
  const { costQuote: result, costLoading: loading } = useSelector((state) => state.parcels);
  const { toast } = useToast();

  const isIntl = shipmentType === "international";

  const changeShipmentType = (v) => {
    setShipmentType(v);
    setForm({ ...EMPTY, deliveryType: "standard" });
  };

  const handleCalculate = async () => {
    const missing =
      isIntl
        ? !form.originHub || !form.destinationCountry || !form.destinationCity
        : !form.originCity || !form.destinationCity;
    if (missing || !form.parcelCategory) {
      toast({
        title: t("calculator.missingTitle"),
        description: t("calculator.missingDesc"),
        variant: "destructive",
      });
      return;
    }
    const hub = SHOP_HUB_OPTIONS.find((h) => h.value === form.originHub);
    const payload = isIntl
      ? {
          shipmentType,
          originCountry: form.originHub,
          originCity: hub ? `${hub.city}, ${hub.value}` : form.originHub,
          destinationCountry: form.destinationCountry,
          destinationCity: form.destinationCity,
          parcelCategory: form.parcelCategory,
          weight: Number(form.weight),
          deliveryType: form.deliveryType,
        }
      : {
          shipmentType,
          originCity: form.originCity,
          destinationCity: form.destinationCity,
          parcelCategory: form.parcelCategory,
          weight: Number(form.weight),
          deliveryType: form.deliveryType,
        };
    try {
      await dispatch(calculateCostThunk(payload)).unwrap();
    } catch (error) {
      toast({
        title: t("calculator.errorTitle"),
        description: error || t("calculator.errorDesc"),
        variant: "destructive",
      });
    }
  };

  const hubFor = (country) => SHOP_HUB_OPTIONS.find((h) => h.value === country);

  return (
    <div className="min-h-screen pb-20 pt-8 md:pt-14">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-3xl md:text-4xl text-foreground font-bold">
            {t("calculator.pageTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            {t("calculator.pageSubtitle")}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  {t("calculator.sectionShipment")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("calculator.labelRoute")}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={isIntl ? "default" : "outline"}
                      className={isIntl ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
                      onClick={() => changeShipmentType("international")}
                    >
                      <Globe2 className="mr-2 h-4 w-4" /> {t("calculator.international")}
                    </Button>
                    <Button
                      type="button"
                      variant={!isIntl ? "default" : "outline"}
                      onClick={() => changeShipmentType("national")}
                    >
                      <Truck className="mr-2 h-4 w-4" /> {t("calculator.domesticUg")}
                    </Button>
                  </div>
                </div>

                {isIntl ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("calculator.labelFromHub")}</Label>
                        <Select value={form.originHub} onValueChange={(v) => setForm({ ...form, originHub: v })}>
                          <SelectTrigger><SelectValue placeholder={t("calculator.placeholderSelectHub")} /></SelectTrigger>
                          <SelectContent>
                            {SHOP_HUB_OPTIONS.map((h) => (
                              <SelectItem key={h.value} value={h.value}>
                                {h.flag} {h.label} — {h.city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("calculator.labelToCountry")}</Label>
                        <Select
                          value={form.destinationCountry}
                          onValueChange={(v) => setForm((f) => ({ ...f, destinationCountry: v, destinationCity: "" }))}
                        >
                          <SelectTrigger><SelectValue placeholder={t("calculator.placeholderSelectCountry")} /></SelectTrigger>
                          <SelectContent>
                            {COUNTRY_OPTIONS.map((o) => (
                              <SelectItem key={o.country} value={o.country}>{o.country}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("calculator.labelCityRegion")}</Label>
                        <Select
                          value={form.destinationCity}
                          onValueChange={(v) => setForm({ ...form, destinationCity: v })}
                          disabled={!form.destinationCountry}
                        >
                          <SelectTrigger><SelectValue placeholder={form.destinationCountry ? t("calculator.placeholderCityRegion") : t("calculator.chooseCountryFirst")} /></SelectTrigger>
                          <SelectContent>
                            {placesOf(form.destinationCountry).map((place) => (
                              <SelectItem key={place} value={place}>{place}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.destinationCountry && placesOf(form.destinationCountry).length === 0 && (
                          <p className="text-xs text-muted-foreground">{t("calculator.noRegionList")}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-accent" />
                      {form.originHub && form.destinationCountry ? (
                        <>
                          {t("calculator.routeLineIntro", {
                            origin: `${hubFor(form.originHub)?.city ?? ""}, ${form.originHub}`,
                            destination: form.destinationCity
                              ? `${form.destinationCity}, ${form.destinationCountry}`
                              : form.destinationCountry,
                          })}
                          {t("calculator.feeIncludesNote")}
                        </>
                      ) : (
                        <>{t("calculator.pickGuide")}</>
                      )}
                    </p>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("calculator.labelFromUganda")}</Label>
                      <Select
                        value={form.originCity}
                        onValueChange={(v) => setForm((f) => ({ ...f, originCity: v, destinationCity: f.destinationCity === v ? "" : f.destinationCity }))}
                      >
                        <SelectTrigger><SelectValue placeholder={t("calculator.placeholderSelectCity")} /></SelectTrigger>
                        <SelectContent>
                          {groupedUgandaOptions.map((g) => (
                            <SelectGroup key={g.label}>
                              <SelectLabel>{g.label}</SelectLabel>
                              {g.items.map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("calculator.labelToUganda")}</Label>
                      <Select value={form.destinationCity} onValueChange={(v) => setForm({ ...form, destinationCity: v })}>
                        <SelectTrigger><SelectValue placeholder={t("calculator.placeholderSelectCity")} /></SelectTrigger>
                        <SelectContent>
                          {groupedUgandaOptions.map((g) => {
                            const items = g.items.filter((p) => p.value !== form.originCity);
                            if (!items.length) return null;
                            return (
                              <SelectGroup key={g.label}>
                                <SelectLabel>{g.label}</SelectLabel>
                                {items.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                ))}
                              </SelectGroup>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("calculator.labelCategoryField")}</Label>
                    <Select value={form.parcelCategory} onValueChange={(v) => setForm({ ...form, parcelCategory: v })}>
                      <SelectTrigger><SelectValue placeholder={t("calculator.placeholderCategory")} /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("calculator.labelWeightKg")}</Label>
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("calculator.labelSpeed")}</Label>
                  <Select value={form.deliveryType} onValueChange={(v) => setForm({ ...form, deliveryType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {deliveryOptions(isIntl).map((d) => (
                        <SelectItem key={d.value} value={d.value}>{t(d.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleCalculate} disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  {loading
                    ? t("calculator.btnCalculating")
                    : isIntl
                      ? t("calculator.btnEstimateIntl")
                      : t("calculator.btnEstimateDom")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            {result ? (
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display">{t("calculator.resultTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">{t("calculator.routeNote")}</span>
                    <span className="font-medium text-foreground capitalize text-right max-w-[60%]">
                      {result.originCity || result.originCountry || "-"} → {result.destinationCity || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">{t("calculator.quoteService")}</span>
                    <span className="font-medium text-foreground capitalize">
                      {(result.type || "-").replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">{t("track.fieldCategory")}</span>
                    <span className="font-medium text-foreground capitalize">
                      {result.parcelCategory?.replace(/_/g, " ") || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">{t("track.fieldWeight")}</span>
                    <span className="font-medium text-foreground">{result.weight} kg</span>
                  </div>
                  {result.billableWeight && result.billableWeight !== result.weight && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">{t("calculator.quoteBillable")}</span>
                      <span className="font-medium text-foreground">{result.billableWeight} kg</span>
                    </div>
                  )}
                  {result.distanceKm != null && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">{t("calculator.quoteDistance")}</span>
                      <span className="font-medium text-foreground">~{result.distanceKm} km</span>
                    </div>
                  )}
                  {result.breakdown && (
                    <div className="rounded-md bg-muted/50 border border-border/60 px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold text-muted-foreground">{t("calculator.breakdownTitle")}</p>
                      <p className="flex justify-between"><span>{t("calculator.breakdownBooking")}</span><span>UGX {Number(result.breakdown.baseFee).toLocaleString()}</span></p>
                      <p className="flex justify-between">
                        <span>
                          {t("calculator.breakdownContent", {
                            category: result.parcelCategory?.replace(/_/g, " ") || "-",
                            weight: `${result.billableWeight ?? result.weight} kg`,
                          })}
                        </span>
                        <span>UGX {Number(result.breakdown.contentFee).toLocaleString()}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>{t("calculator.breakdownDistance", { km: result.distanceKm ?? "-" })}</span>
                        <span>UGX {Number(result.breakdown.distanceFee).toLocaleString()}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>{t("calculator.breakdownSpeed", { multiplier: result.breakdown.deliveryMultiplier })}</span>
                        <span>{result.breakdown.bulkDiscountApplied ? t("calculator.breakdownBulkApplied") : t("calculator.breakdownNoBulk")}</span>
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">{t("calculator.estimatedTotal")}</span>
                    <span className="font-bold text-lg text-accent">{formatMoney(result.price, result.currency)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.currency === "USD" ? t("calculator.quoteNoteUsd") : t("calculator.quoteNoteUgx")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Calculator className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="max-w-xs mx-auto">
                    {t("calculator.emptyHint")}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CalculateCostPage;
