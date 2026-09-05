import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/StatsCard";
import { TrendingUp, Package, DollarSign, BarChart3 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { fetchAnalyticsThunk } from "@/features/analytics/analyticsSlice";

export default function Analytics() {
  const dispatch = useDispatch();
  const {
    summary,
    revenueData,
    parcelGrowthData,
    topCitiesData,
    deliveryPerformanceData,
    loading,
    error,
  } = useSelector((state) => state.analytics);

  useEffect(() => {
    console.log("Dispatching fetchAnalyticsThunk");
    dispatch(fetchAnalyticsThunk());
    console.log("fetchAnalyticsThunk dispatched");
  }, [dispatch]);

  const totalRevenue =
    summary?.totals?.revenue ??
    (revenueData || []).reduce((s, d) => s + (d.revenue || 0), 0);

  const totalParcels =
    summary?.totals?.parcels ??
    (parcelGrowthData || []).reduce((s, d) => s + (d.parcels || 0), 0);

  const citiesServed = summary?.citiesServed ?? (topCitiesData || []).length;

  const avgOnTime = useMemo(() => {
    const rows = deliveryPerformanceData || [];
    if (!rows.length) return 0;
    return Math.round(
      rows.reduce((s, d) => s + (d.onTime || 0), 0) / rows.length,
    );
  }, [deliveryPerformanceData]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Advanced insights into your logicstics operations
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Revenue"
            value={totalRevenue}
            icon={DollarSign}
            prefix={"PKR"}
            index={0}
            iconClassName="bg-success/10 text-success"
          />
          <StatsCard
            title="Total Parcels"
            value={totalParcels}
            icon={Package}
            index={1}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatsCard
            title="Avg On-Time %"
            value={avgOnTime}
            icon={TrendingUp}
            suffix={"%"}
            index={2}
            iconClassName="bg-info/10 text-info"
          />
          <StatsCard
            title="Cities Served"
            value={citiesServed}
            icon={BarChart3}
            index={3}
            iconClassName="bg-secondary/10 text-secondary"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Revenue Trend (PKR)</CardTitle>
            </CardHeader>

            <CardContent>
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={revenueData || []}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--success))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--success))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

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
                      formatter={(v) => `PKR ${v.toLocaleString()}`}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey={"revenue"}
                      stroke="hsl(var(--success))"
                      fill="url(#revGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Parcel Growth</CardTitle>
            </CardHeader>

            <CardContent>
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={parcelGrowthData || []}>
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
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey={"parcels"}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">
                Top Destination Cities
              </CardTitle>
            </CardHeader>

            <CardContent>
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topCitiesData || []} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />

                    <XAxis
                      type="number"
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                    />

                    <YAxis
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                      dataKey="city"
                      type="category"
                      width={80}
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
                      fill="hsl(var(--secondary))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">
                Delivery Performance (%)
              </CardTitle>
            </CardHeader>

            <CardContent>
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={deliveryPerformanceData || []}>
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
                      dataKey={"onTime"}
                      name={"On Time"}
                      fill="hsl(var(--success))"
                      radius={[4, 4, 0, 0]}
                      stackId={"a"}
                    />

                    <Bar
                      dataKey={"delayed"}
                      name={"Delayed"}
                      fill="hsl(var(--destructive))"
                      radius={[4, 4, 0, 0]}
                      stackId={"a"}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  );
}
