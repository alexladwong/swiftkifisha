import { useState } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrackingTimeline } from "@/components/TrackingTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Search } from "lucide-react";
import { trackParcelThunk } from "@/features/parcels/parcelSlice";

const getParcelStatus = (parcel) => {
  const checkpoints = parcel?.checkpoints || [];
  if (!checkpoints.length) return "arrived";
  return checkpoints[checkpoints.length - 1].status || "arrived";
};

export default function ParcelTracking() {
  const dispatch = useDispatch();
  const {
    trackedParcel: result,
    trackLoading,
    trackError,
  } = useSelector((state) => state.parcels);

  const [query, setQuery] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    await dispatch(trackParcelThunk(query.trim()));
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold">Track Your Parcel</h1>
          <p className="text-muted-foreground text-sm">
            Enter your tracking ID to see the status of your shipment.
          </p>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Enter tracking ID (e.g. UG-CRR-123456)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={trackLoading}>
                {trackLoading ? "Tracking..." : "Track Parcel"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {trackError && (
          <p className="text-center text-muted-foreground">
            No parcel found with that tracking ID.
          </p>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-base">
                    {result.trackingId}
                  </CardTitle>
                  <StatusBadge status={getParcelStatus(result)} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {result.originCity} → {result.destinationCity}
                </p>
              </CardHeader>
              <CardContent>
                <TrackingTimeline checkpoints={result.checkpoints || []} />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}