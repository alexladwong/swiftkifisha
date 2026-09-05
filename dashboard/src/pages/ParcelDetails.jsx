import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { TrackingTimeline } from "@/components/TrackingTimeline";
import { ArrowLeft, Package, MapPin, User, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addCheckpointThunk } from "@/features/parcels/parcelSlice";
import { toast } from "sonner";

const getParcelStatus = (parcel) => {
  const checkpoints = parcel?.checkpoints || [];
  if (!checkpoints.length) return "arrived";
  return checkpoints[checkpoints.length - 1].status || "arrived";
};

export default function ParcelDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items, updateLoading } = useSelector((state) => state.parcels);
  console.log(id, items)
  const parcel = useMemo(() => items.find((p) => p._id === id), [items, id]);

  const [checkpoint, setCheckpoint] = useState({
    location: "",
    title: "",
    description: "",
    status: "in_transit",
  });

  if (!parcel) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">
          Parcel not found in current list
        </p>
        <Button variant="outline" onClick={() => navigate("/manage-parcels")}>
          Go to Manage Parcels
        </Button>
      </div>
    );
  }

  const status = getParcelStatus(parcel);

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-black font-semibold">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  const addCheckpoint = async () => {
    if (!checkpoint.location || !checkpoint.title || !checkpoint.status) {
      toast.error("Please fill in location, title and status");
      return;
    }

    await dispatch(addCheckpointThunk({ id: parcel._id, checkpoint }));
    setCheckpoint({
      location: "",
      title: "",
      description: "",
      status: "in_transit",
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-6 "
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 y-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="font-mono">{parcel.trackingId}</span>
              <StatusBadge status={status} />
            </h1>
            <p className="text-sm text-muted-foreground">Parcel Details</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Sender Information</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Name" value={parcel.senderName} />
                <InfoRow label="Phone" value={parcel.senderPhone} />
                <InfoRow label="Address" value={parcel.senderAddress} />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">
                  Receiver Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Name" value={parcel.receiverName} />
                <InfoRow label="Phone" value={parcel.receiverPhone} />
                <InfoRow label="Address" value={parcel.receiverAddress} />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Shipment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Shipment Type" value={parcel.shipmentType} />
                <InfoRow label="Delivery Type" value={parcel.deliveryType} />
                <InfoRow
                  label="Category"
                  value={parcel.parcelCategory?.replace(/>_/g, " ")}
                />
                <InfoRow label="Weight" value={`${parcel.weight} kg`} />
                <InfoRow
                  label="Price"
                  value={`PKR ${Number(parcel.price || 0).toLocaleString()} kg`}
                />
                <InfoRow
                  label="Created"
                  value={
                    parcel.createdAt
                      ? new Date(parcel.createdAt).toLocaleDateString("en-PK", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "-"
                  }
                />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Add Checkpoint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Location *</Label>
                  <Input
                    placeholder="e.g. Karachi"
                    value={checkpoint.location}
                    onChange={(e) =>
                      setCheckpoint({ ...checkpoint, location: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Title *</Label>
                  <Input
                    placeholder="e.g. Arrived At Facility"
                    value={checkpoint.title}
                    onChange={(e) =>
                      setCheckpoint({ ...checkpoint, title: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional"
                    value={checkpoint.description}
                    onChange={(e) =>
                      setCheckpoint({
                        ...checkpoint,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Status *</Label>

                  <Select
                    value={checkpoint.status}
                    onValueChange={(v) =>
                      setCheckpoint({ ...checkpoint, status: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arrived">Arrived</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="out_for_delivery">
                        Out for Delivery
                      </SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={addCheckpoint} disabled={updateLoading}>
                  {updateLoading ? "Saving..." : "Add"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center gap-2">
                <MapPin className="h-4 w-4 text-success" />
                <CardTitle className="text-base">Route</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1 text-center gap-4 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">Origin</p>
                    <p className="font-semibold">{parcel.originCity}</p>
                  </div>
                  <Truck className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-center p-4 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">Destination</p>
                    <p className="font-semibold">{parcel.destinationCity}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Tracking Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <TrackingTimeline checkpoints={parcel.checkpoints || []} />
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </>
  );
}
