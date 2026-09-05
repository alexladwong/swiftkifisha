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

const categories = [
  { value: "document", label: "Document" },
  { value: "electronics", label: "Electronics" },
  { value: "fragile", label: "Fragile" },
  { value: "clothing", label: "Clothing" },
  { value: "food", label: "Food" },
  { value: "medicine", label: "Medicine" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "books", label: "Books" },
  { value: "small_package", label: "Small Package" },
  { value: "large_package", label: "Large Package" },
];

const deliveryOptions = (intl) =>
  intl
    ? [
        { value: "standard", label: "Standard (5–9 days)" },
        { value: "overnight", label: "Express (2–4 days)" },
        { value: "sameDay", label: "Priority (1–2 days)" },
      ]
    : [
        { value: "standard", label: "Standard (2–5 days)" },
        { value: "overnight", label: "Overnight" },
        { value: "sameDay", label: "Same Day" },
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
        title: "Missing fields",
        description: "Please fill in all required fields.",
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
        title: "Error",
        description: error || "Could not calculate cost. Please try again later.",
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
            Estimate Your International Shipping Fee
          </h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            Shop from your SwiftUg mailbox abroad and see exactly what delivery to your door costs.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Shipment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Route</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={isIntl ? "default" : "outline"}
                      className={isIntl ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
                      onClick={() => changeShipmentType("international")}
                    >
                      <Globe2 className="mr-2 h-4 w-4" /> International
                    </Button>
                    <Button
                      type="button"
                      variant={!isIntl ? "default" : "outline"}
                      onClick={() => changeShipmentType("national")}
                    >
                      <Truck className="mr-2 h-4 w-4" /> Domestic (UG)
                    </Button>
                  </div>
                </div>

                {isIntl ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Shipping from (mailbox hub)</Label>
                        <Select value={form.originHub} onValueChange={(v) => setForm({ ...form, originHub: v })}>
                          <SelectTrigger><SelectValue placeholder="Select hub" /></SelectTrigger>
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
                        <Label>Deliver to (country)</Label>
                        <Select
                          value={form.destinationCountry}
                          onValueChange={(v) => setForm((f) => ({ ...f, destinationCountry: v, destinationCity: "" }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {COUNTRY_OPTIONS.map((o) => (
                              <SelectItem key={o.country} value={o.country}>{o.country}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>City / Region (in destination country)</Label>
                        <Select
                          value={form.destinationCity}
                          onValueChange={(v) => setForm({ ...form, destinationCity: v })}
                          disabled={!form.destinationCountry}
                        >
                          <SelectTrigger><SelectValue placeholder={form.destinationCountry ? "Select city / region" : "Choose a country first"} /></SelectTrigger>
                          <SelectContent>
                            {placesOf(form.destinationCountry).map((place) => (
                              <SelectItem key={place} value={place}>{place}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.destinationCountry && placesOf(form.destinationCountry).length === 0 && (
                          <p className="text-xs text-muted-foreground">No regional list yet for this country.</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-accent" />
                      {form.originHub && form.destinationCountry ? (
                        <>
                          Route: {hubFor(form.originHub)?.city}, {form.originHub} →{" "}
                          {form.destinationCity ? form.destinationCity + ", " : ""}
                          {form.destinationCountry}. Fee includes hub pickup and international delivery.
                        </>
                      ) : (
                        <>Pick your SwiftUg mailbox country, then the delivery country and its city / region.</>
                      )}
                    </p>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From (Uganda city / region)</Label>
                      <Select
                        value={form.originCity}
                        onValueChange={(v) => setForm((f) => ({ ...f, originCity: v, destinationCity: f.destinationCity === v ? "" : f.destinationCity }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
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
                      <Label>To (Uganda city / region)</Label>
                      <Select value={form.destinationCity} onValueChange={(v) => setForm({ ...form, destinationCity: v })}>
                        <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
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
                    <Label>Parcel Category</Label>
                    <Select value={form.parcelCategory} onValueChange={(v) => setForm({ ...form, parcelCategory: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
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
                  <Label>Delivery Speed</Label>
                  <Select value={form.deliveryType} onValueChange={(v) => setForm({ ...form, deliveryType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {deliveryOptions(isIntl).map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleCalculate} disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  {loading ? "Calculating..." : isIntl ? "Estimate my shipping fee" : "Calculate Cost"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            {result ? (
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display">Cost Estimate</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Route</span>
                    <span className="font-medium text-foreground capitalize text-right max-w-[60%]">
                      {result.originCity || result.originCountry || "-"} → {result.destinationCity || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium text-foreground capitalize">
                      {(result.type || "-").replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium text-foreground capitalize">
                      {result.parcelCategory?.replace(/_/g, " ") || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Weight</span>
                    <span className="font-medium text-foreground">{result.weight} kg</span>
                  </div>
                  {result.billableWeight && result.billableWeight !== result.weight && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Billable weight (min 1 kg)</span>
                      <span className="font-medium text-foreground">{result.billableWeight} kg</span>
                    </div>
                  )}
                  {result.distanceKm != null && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Route distance (approx.)</span>
                      <span className="font-medium text-foreground">~{result.distanceKm} km</span>
                    </div>
                  )}
                  {result.breakdown && (
                    <div className="rounded-md bg-muted/50 border border-border/60 px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold text-muted-foreground">How it is calculated</p>
                      <p className="flex justify-between"><span>Booking & handling</span><span>UGX {Number(result.breakdown.baseFee).toLocaleString()}</span></p>
                      <p className="flex justify-between"><span>Content ({result.parcelCategory?.replace(/_/g, " ") || "-"}, {result.billableWeight} kg)</span><span>UGX {Number(result.breakdown.contentFee).toLocaleString()}</span></p>
                      <p className="flex justify-between"><span>Distance ({result.distanceKm} km)</span><span>UGX {Number(result.breakdown.distanceFee).toLocaleString()}</span></p>
                      <p className="flex justify-between"><span>Delivery speed x{result.breakdown.deliveryMultiplier}</span><span>{result.breakdown.bulkDiscountApplied ? "bulk 10% off applied" : "no bulk discount"}</span></p>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Estimated total</span>
                    <span className="font-bold text-lg text-accent">{formatMoney(result.price, result.currency)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.currency === "USD"
                      ? "Includes hub pickup and international delivery. Destination duties & taxes are billed at cost with full transparency."
                      : "Distance-based domestic pricing: booking + content + distance (km). Items under 1 kg are billed as 1 kg. UGX rates apply."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Calculator className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="max-w-xs mx-auto">
                    Estimate the door-to-door cost of shipping from any SwiftUg mailbox hub to your country.
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