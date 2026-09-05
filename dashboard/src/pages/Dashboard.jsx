import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { Package, CheckCircle, Truck, Clock } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { fetchParcelsThunk } from "@/features/parcels/parcelSlice";
import { fetchDashboardStatsThunk } from "@/features/dashboard/dashboardSlice";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const STATUS_FILL = {
  arrived: "hsl(var(--secondary))",
  in_transit: "hsl(var(--primary))",
  out_for_delivery: "hsl(var(--info))",
  delivered: "hsl(var(--success))",
};

const getParcelStatus = (parcel) => {
  const checkpoints = parcel?.checkpoints || [];
  if (!checkpoints.length) return "arrived";
  return checkpoints[checkpoints.length - 1].status || "arrived";
};

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, meta } = useSelector((s) => s.parcels);
  const {
    stats,
    loading: statsLoading,
    error: statsError,
  } = useSelector((s) => s.dashboard);

  useEffect(() => {
    dispatch(fetchParcelsThunk({ page: 1, limit: 8 }));
    dispatch(fetchDashboardStatsThunk());
  }, [dispatch]);

  const statusCounts = useMemo(() => {
    const base = {
      arrived: 0,
      in_transit: 0,
      out_for_delivery: 0,
      delivered: 0,
    };
    const rows = stats?.statusDistribution || [];

    for (const r of rows) {
      if (r?.name && base[r.name] !== undefined) base[r.name] = r.value || 0;
    }
    return base;
  }, [stats]);

  const monthlyParcelData = stats?.monthlyParcels || [];
  const monthlyRevenueData = stats?.monthlyRevenue || [];
  const weightDistributionData = stats?.weightDistribution || [];

  const deliveryStatusData = useMemo(() => {
    const rows = stats?.statusDistribution || [];
    return rows.map((r) => ({
      ...r,
      fill: STATUS_FILL[r.name] || "hsl(var(--muted-foreground))",
    }));
  }, [stats]);

  console.log("Dashboard stats:", stats);
  console.log("Dashboard stats:", deliveryStatusData);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview based on recent parcels
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Parcels"
            value={stats?.totals?.parcels ?? meta.total}
            icon={Package}
            index={0}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatsCard
            title="Delivered"
            value={statusCounts.delivered}
            icon={CheckCircle}
            index={1}
            iconClassName="bg-success/10 text-success"
          />
          <StatsCard
            title="In Transit"
            value={statusCounts.in_transit}
            icon={Truck}
            index={2}
            iconClassName="bg-info/10 text-info"
          />
          <StatsCard
            title="Pending"
            value={statusCounts.arrived}
            icon={Clock}
            index={3}
            iconClassName="bg-secondary/10 text-secondary"
          />
        </div>

        {statsError && <p className="text-sm text-destructive">{statsError}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Parcels Per Month</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyParcelData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />

                      <XAxis
                        dataKey="month"
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                      />

                      <YAxis
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                      />

                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar
                        dataKey={"parcels"}
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={deliveryStatusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        innerRadius={55}
                        dataKey="value"
                        paddingAngle={4}
                      >
                        {deliveryStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>

                      <Tooltip />
                      <Legend fontSize={12} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">
                  Revenue Per Month (PKR)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width={"100%"} height={250}>
                    <BarChart data={monthlyRevenueData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />

                      <XAxis
                        dataKey="month"
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                      />

                      <YAxis
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => `${v / 1000}k`}
                      />

                      <Tooltip
                        formatter={(v) => `PKR ${Number(v).toLocaleString()}`}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />

                      <Bar
                        dataKey={"revenue"}
                        fill="hsl(var(--secondary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Weight Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width={"100%"} height={250}>
                    <BarChart data={weightDistributionData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />

                      <XAxis
                        dataKey="range"
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                      />

                      <YAxis
                        fontSize={12}
                        stroke="hsl(var(--muted-foreground))"
                      />

                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />

                      <Bar
                        dataKey={"count"}
                        fill="hsl(var(--info))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Recent Parcels</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead className="hidden md:table-cell">Sender</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Receiver
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Origin</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Destination
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {(items || []).map((p) => (
                  <TableRow>
                    <TableCell>{p.trackingId}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.senderName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.receiverName}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {p.originCity}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {p.destinationCity}
                    </TableCell>
                    <TableCell>{getParcelStatus(p)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/parcel/${p._id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
