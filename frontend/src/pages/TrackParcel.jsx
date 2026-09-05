import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import TrackingTimeline from "@/components/TrackingTimeline";
import { useDispatch, useSelector } from "react-redux";
import { trackParcelThunk } from "@/features/parcels/parcelSlice";
import { useI18n } from "@/i18n";

const STATUS_KEYS = {
  arrived: "track.statusArrived",
  in_transit: "track.statusInTransit",
  out_for_delivery: "track.statusOutForDelivery",
  delivered: "track.statusDelivered",
};

const statusColors = {
  arrived: "bg-muted text-muted-foreground",
  in_transit: "bg-primary/10 text-primary",
  out_for_delivery: "bg-accent/10 text-accent",
  delivered: "bg-green-100 text-green-700",
};

const TrackParcel = () => {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState(searchParams.get("id") || "");
  const dispatch = useDispatch();
  const {
    trackParcel: parcel,
    trackLoading: loading,
    trackError,
  } = useSelector((state) => state.parcels);
  const notFound = Boolean(trackError);
  const { toast } = useToast();

  const handleTrack = async () => {
    if (!trackingId.trim()) return;

    try {
      await dispatch(trackParcelThunk(trackingId.trim())).unwrap();
    } catch (error) {
      toast({
        title: t("track.toastTitle"),
        description: t("track.toastDesc"),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (searchParams.get("id")) {
      handleTrack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStatus =
    parcel?.checkpoints?.length > 0
      ? parcel.checkpoints[parcel.checkpoints.length - 1].status
      : "arrived";

  const statusLabel = (status) => t(STATUS_KEYS[status] || "track.statusArrived");

  const detailRows = (p) => [
    [t("track.fieldTrackingId"), p.trackingID],
    [t("track.fieldShipmentType"), p.shimpentType],
    [t("track.fieldDeliveryType"), p.deliveryType],
    [t("track.fieldCategory"), p.parcelCategory],
    [t("track.fieldWeight"), `${p.Weight} kg`],
    [t("track.fieldOrigin"), p.originCity],
    [t("track.fieldDestination"), p.destinationCity],
    [t("track.fieldStatus"), statusLabel(currentStatus)],
  ];

  return (
    <>
      <div className="min-h-screen pb-20 pt-8 md:pt-14">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              {t("track.pageTitle")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("track.pageSubtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-lg mx-auto flex gap-2 mb-12"
          >
            <Input
              placeholder={t("track.placeholder")}
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrack()}
            />

            <Button
              onClick={handleTrack}
              disabled={loading}
              className="bg-primary text-primary-foreground shrink-0"
            >
              <Search className="mr-2 h-4 w-4" />
              {t("track.btnTrack")}
            </Button>
          </motion.div>

          {loading && (
            <div className="max-w-2xl mx-auto space-y-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          )}

          {notFound && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-white" />
              </div>

              <h3 className="font-display font-semibold text-lg text-foreground">
                {t("track.notFoundTitle")}
              </h3>

              <p className="text-sm text-muted-foreground mt-2">
                {t("track.notFoundDesc")}
              </p>
            </motion.div>
          )}

          {parcel && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      {t("track.detailsTitle")}
                    </CardTitle>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[currentStatus] || ""}`}
                    >
                      {statusLabel(currentStatus)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {detailRows(parcel).map(([label, value]) => (
                      <div key={label}>
                        <span className="text-muted-foreground">{label}</span>
                        <p className="font-medium text-foreground capitalize">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-6">
                  {t("track.timelineTitle")}
                </h3>
                <TrackingTimeline checkpoints={parcel.checkpoints} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
};

export default TrackParcel;
