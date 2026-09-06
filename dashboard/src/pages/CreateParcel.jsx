import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PackagePlus, CheckCircle2, X } from "lucide-react";
import ParcelQR from "@/components/ParcelQR";
import { createParcelThunk } from "@/features/parcels/parcelSlice";
import { toast } from "sonner";
import {
  getDestinationOptionsForShipmentType,
  isValidDestinationForShipmentType,
  UGANDA_CITY_OPTIONS,
} from "@/lib/locationData";

const categories = [
  "document",
  "electronics",
  "fragile",
  "clothing",
  "food",
  "medicine",
  "cosmetics",
  "books",
  "small_package",
  "large_package",
];

export default function CreateParcel() {
  const [form, setForm] = useState({
    senderName: "",
    senderPhone: "",
    senderAddress: "",
    receiverName: "",
    receiverPhone: "",
    receiverAddress: "",
    shipmentType: "national",
    originCity: "",
    destinationCity: "",
    deliveryType: "standard",
    parcelCategory: "small_package",
    weight: 1,
  });

  const dispatch = useDispatch();
  const { createLoading } = useSelector((state) => state.parcels);
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const destinationOptions = useMemo(
    () => getDestinationOptionsForShipmentType(form.shipmentType),
    [form.shipmentType],
  );

  const [createdParcel, setCreatedParcel] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const requiredMissing =
      !form.senderName.trim() ||
      !form.senderPhone.trim() ||
      !form.senderAddress.trim() ||
      !form.receiverName.trim() ||
      !form.receiverPhone.trim() ||
      !form.receiverAddress.trim() ||
      !form.originCity.trim() ||
      !form.destinationCity.trim() ||
      !form.parcelCategory.trim() ||
      !form.deliveryType.trim() ||
      !form.shipmentType.trim() ||
      !form.weight;

    if (requiredMissing) {
      toast.error("Please fill all required fields");
      return;
    }

    const payload = {
      ...form,
      weight: Number(form.weight),
    };

    const res = await dispatch(createParcelThunk(payload));
    if (createParcelThunk.fulfilled.match(res)) {
      setCreatedParcel(res.payload || null);
      setForm({
        senderName: "",
        senderPhone: "",
        senderAddress: "",
        receiverName: "",
        receiverPhone: "",
        receiverAddress: "",
        shipmentType: "national",
        originCity: "",
        destinationCity: "",
        deliveryType: "standard",
        parcelCategory: "small_package",
        weight: 1,
      });
    }
  };
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <PackagePlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create New Parcels</h1>
            <p className="text-muted-foreground text-sm">
              Fill in the details to create a new shipment.
            </p>
          </div>
        </div>

        {createdParcel?.trackingId && (
          <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-emerald-900">Parcel created: {createdParcel.trackingId}</p>
                <p className="text-sm text-emerald-800/80">
                  Share the QR code with the member — they can also download it from their dashboard.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ParcelQR trackingId={createdParcel.trackingId} />
              <button
                type="button"
                onClick={() => setCreatedParcel(null)}
                aria-label="Dismiss"
                className="self-start rounded-lg p-1.5 text-emerald-800/60 transition hover:bg-emerald-100 hover:text-emerald-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Sender Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Sender Name *</Label>
                <Input
                  placeholder="Full name"
                  value={form.senderName}
                  onChange={(e) => update("senderName", e.target.value)}
                />
              </div>
              <div>
                <Label>Sender Phone *</Label>
                <Input
                  placeholder="+256-700-123456"
                  value={form.senderPhone}
                  onChange={(e) => update("senderPhone", e.target.value)}
                />
              </div>
              <div>
                <Label>Sender Address *</Label>
                <Input
                  placeholder="Street address"
                  value={form.senderAddress}
                  onChange={(e) => update("senderAddress", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Receiver Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Receiver Name *</Label>
                <Input
                  placeholder="Full name"
                  value={form.receiverName}
                  onChange={(e) => update("receiverName", e.target.value)}
                />
              </div>
              <div>
                <Label>Receiver Phone *</Label>
                <Input
                  placeholder="+256-700-123456"
                  value={form.receiverPhone}
                  onChange={(e) => update("receiverPhone", e.target.value)}
                />
              </div>
              <div>
                <Label>Receiver Address *</Label>
                <Input
                  placeholder="Street address"
                  value={form.receiverAddress}
                  onChange={(e) => update("receiverAddress", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Shipment Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Shipment Type *</Label>

                <Select
                  value={form.shipmentType}
                  onValueChange={(v) =>
                    setForm((f) => {
                      const next = { ...f, shipmentType: v };
                      if (
                        !isValidDestinationForShipmentType(
                          v,
                          next.destinationCity,
                        )
                      ) {
                        next.destinationCity = "";
                      }
                      return next;
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Origin City *</Label>

                <Select
                  value={form.originCity}
                  onValueChange={(v) => update("originCity", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select origin city" />
                  </SelectTrigger>
                  <SelectContent>
                    {UGANDA_CITY_OPTIONS.map((o) => (
                      <SelectItem value={o.value} key={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Destination City *</Label>

                <Select
                  value={form.destinationCity}
                  onValueChange={(v) => update("destinationCity", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination city" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationOptions.map((o) => (
                      <SelectItem value={o.value} key={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Delivery Type *</Label>

                <Select
                  value={form.deliveryType}
                  onValueChange={(v) => update("deliveryType", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sameDay">Same Day</SelectItem>
                    <SelectItem value="overnight">Overnight</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Parcel Category *</Label>

                <Select
                  value={form.parcelCategory}
                  onValueChange={(v) => update("parcelCategory", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parcel category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Weight (kg) *</Label>
                <Input
                  type="number"
                  min={0.1}
                  step="0.1"
                  placeholder="e.g. 2.5"
                  value={form.weight}
                  onChange={(e) => update("weight", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
              disabled={createLoading}
            >
              {createLoading ? "Creating..." : "Create Parcel"}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </>
  );
}