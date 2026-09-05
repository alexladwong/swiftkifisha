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

const statusColors = {
  arrived: "bg-muted text-muted-foreground",
  in_transit: "bg-primary/10 text-primary",
  out_for_delivery: "bg-accent/10 text-accent",
  delivered: "bg-green-100 text-green-700",
};

const TrackParcel = () => {
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
        title: "Parcel not found",
        description: "Please check your tracking ID and try again.",
        variant: "desctructive",
      });
    }
  };

  useEffect(() => {
    if (searchParams.get("id")) {
      handleTrack();
    }
  }, []);

  const currentStatus =
    parcel?.checkpoints?.length > 0
      ? parcel.checkpoints[parcel.checkpoints.length - 1].status
      : "arrived";

  return (
    <>
      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Track Your Parcel
            </h1>
            <p className="text-muted-foreground mt-2">
              Enter your tracking ID to see live updates
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-lg mx-auto flex gap-2 mb-12"
          >
            <Input
              placeholder="Enter Tracking ID (e.g. PK-CRR-123456)"
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
              Track
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
                Parcel Not Found
              </h3>

              <p className="text-sm text-muted-foreground mt-2">
                We couldn't find a parcel with that tracking ID. Please
                double-check and try again.
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
                      Parcel Details
                    </CardTitle>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[currentStatus] || ""}`}
                    >
                      {currentStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Tracking ID", parcel.trackingID],
                      ["Shipment Type", parcel.shimpentType],
                      ["Delivery Type", parcel.deliveryType],
                      ["Category", parcel.parcelCategory],
                      ["Weight", `${parcel.Weight} kg`],
                      ["Origin", parcel.originCity],
                      ["Destination", parcel.destinationCity],
                      ["Status", currentStatus.replace(/_/g, " ")],
                    ].map(([label, value]) => (
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
                  Tracking Timeline
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
