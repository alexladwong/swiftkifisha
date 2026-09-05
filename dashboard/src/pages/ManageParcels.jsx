import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Eye, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  addCheckpointThunk,
  fetchParcelsThunk,
} from "@/features/parcels/parcelSlice";
import { toast } from "sonner";

const getParcelStatus = (parcel) => {
  const checkpoints = parcel?.checkpoints || [];
  if (!checkpoints.length) return "arrived";
  return checkpoints[checkpoints.length - 1].status || "arrived";
};

const ManageParcels = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, loading, meta, updateLoading } = useSelector(
    (state) => state.parcels,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [shipmentFilter, setShipmentFilter] = useState("all");

  const perPage = 10;

  const [modalParcel, setModalParcel] = useState(null);
  const [checkpoint, setCheckpoint] = useState({
    location: "",
    title: "",
    description: "",
    status: "in_transit",
  });

  useEffect(() => {
    dispatch(fetchParcelsThunk({ page, limit: perPage, search }));
  }, [dispatch, page, perPage, search]);

  const filtered = useMemo(() => {
    return (items || []).filter((p) => {
      const status = getParcelStatus(p);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      const matchShipment =
        shipmentFilter === "all" || p.shipmentType === shipmentFilter;
      return matchStatus && matchShipment;
    });
  }, [items, statusFilter, shipmentFilter]);

  const openUpdateModal = (parcel) => {
    setModalParcel(parcel);
    setCheckpoint({
      location: parcel.destinationCity || "",
      title: "Status Update",
      description: "",
      status: getParcelStatus(parcel),
    });
  };

  const handleAddCheckpoint = async () => {
    if (!modalParcel) return;
    if (!checkpoint.location || !checkpoint.title || !checkpoint.status) {
      toast.error("Please fill in location, title and status");
      return;
    }

    const res = await dispatch(
      addCheckpointThunk({ id: modalParcel._id, checkpoint }),
    );
    if (addCheckpointThunk.fulfilled.match(res)) {
      setModalParcel(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 "
      >
        <div>
          <h1 className="text-2xl font-bold">Manage Parcels</h1>
          <p className="text-sm text-muted-foreground">
            View and manage parcels in the system
          </p>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by tracking ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="flex gap-2 items-center">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="out_for_delivery">
                      Out for Delivery
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={shipmentFilter}
                  onValueChange={(v) => {
                    setShipmentFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Shipment Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shipment Types</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking ID</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Sender
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Receiver
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Origin
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Destination
                      </TableHead>
                      <TableHead className="hidden xl:table-cell">
                        Weight
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Date
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const status = getParcelStatus(p);
                      return (
                        <TableRow key={p._id} className="table-row-hover">
                          <TableCell className="font-mono text-xs font-medium">
                            {p.trackingId}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {p.senderName}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {p.receiverName}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {p.originCity}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {p.destinationCity}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm">
                            {p.weight} kg
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {p.createdAt
                              ? new Date(p.createdAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant={"ghost"}
                                size="icon"
                                className="w-8 h-8"
                                onClick={() => navigate(`/parcel/${p._id}`)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant={"ghost"}
                                size="icon"
                                className="w-8 h-8"
                                onClick={() => openUpdateModal(p)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {meta.total} total parcels
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={"outline"}
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center text-sm px-2">
                      {meta.page} / {meta.totalPages}
                    </span>
                    <Button
                      variant={"outline"}
                      size="sm"
                      disabled={page >= meta.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <AnimatePresence>
          {modalParcel && (
            <Dialog open onOpenChange={() => setModalParcel(null)}>
              <DialogContent>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <DialogHeader>
                    <DialogTitle>Add Checkpoint</DialogTitle>
                    <DialogDescription>
                      Update tracking for {modalParcel.trackingId}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4 space-y-3">
                    <div className="space-y-1">
                      <Label>Location *</Label>
                      <Input
                        value={checkpoint.location}
                        onChange={(e) =>
                          setCheckpoint({
                            ...checkpoint,
                            location: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Title *</Label>
                      <Input
                        value={checkpoint.title}
                        onChange={(e) =>
                          setCheckpoint({
                            ...checkpoint,
                            title: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Description</Label>
                      <Input
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
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arrived">Arrived</SelectItem>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="out_for_delivery">
                            Out for Delivery
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setModalParcel(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddCheckpoint}
                      disabled={updateLoading}
                    >
                      {updateLoading ? "Saving..." : "Add Checkpoint"}
                    </Button>
                  </DialogFooter>
                </motion.div>
              </DialogContent>
            </Dialog>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default ManageParcels;
