import {
  LayoutDashboard,
  PackagePlus,
  Boxes,
  Search,
  LogOut,
  BarChart3,
  UserPlus,
  Users,
  ShieldCheck,
  UserRound,
  ClipboardCheck,
  Inbox,
  Megaphone,
  Warehouse,
  PackageCheck,
  PackageSearch,
  Globe2,
  CreditCard,
  FileText,
  Truck,
  Tags,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { axiosInstance } from "@/services/axiosInstance";
import { logout } from "@/features/auth/authSlice";
const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Create Parcel", url: "/create-parcel", icon: PackagePlus },
  { title: "Manage Parcels", url: "/manage-parcels", icon: Boxes },
  { title: "Warehouses", url: "/warehouses", icon: Warehouse },
  { title: "Receiving", url: "/receiving", icon: PackageCheck },
  { title: "Packages", url: "/packages", icon: PackageSearch },
  { title: "International", url: "/international", icon: Globe2 },
  { title: "Kifisha Members", url: "/members", icon: Users },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Parcel Tracking", url: "/tracking", icon: Search },
  { title: "Add Admin", url: "/add-admin", icon: UserPlus },
  { title: "Membership Requests", url: "/membership-applications", icon: ClipboardCheck },
  { title: "Messages", url: "/messages", icon: Inbox },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Profile", url: "/profile", icon: UserRound },
  { title: "Security", url: "/security", icon: ShieldCheck },
];
const financeItems = [
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Shipments", url: "/shipments", icon: Truck },
  { title: "Pricing", url: "/pricing", icon: Tags },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((store) => store.auth.token);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const tick = () =>
      axiosInstance
        .get("/messages/admin/unread-count")
        .then(({ data }) => active && setUnread(data.unread || 0))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);
  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div
          className={`flex items-center gap-2 px-4 py-5 ${collapsed ? "justify-center" : ""}`}
        >
          <a className="flex items-center gap-2 bg-transparent" href="/">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sidebar-primary font-bold text-sm">
            <img src="logo.png" alt="logo" className="h-12 w-12" />
          </div>

          {!collapsed && (
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                SwiftKifisha Global
              </span>
            )}
          </a>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        className="hover:bg-sidebar-accent"
                        to={item.url}
                        end={item.url === "/"}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4" />{" "}
                        {!collapsed && <span>{item.title}</span>}
                        {item.title === "Messages" && unread > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            Finance
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeItems.map((item) => {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        className="hover:bg-sidebar-accent"
                        to={item.url}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4" />{" "}
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" /> {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
