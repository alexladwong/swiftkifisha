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
import { useDispatch } from "react-redux";
import { logout } from "@/features/auth/authSlice";
const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Create Parcel", url: "/create-parcel", icon: PackagePlus },
  { title: "Manage Parcels", url: "/manage-parcels", icon: Boxes },
  { title: "Kifisha Members", url: "/members", icon: Users },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Parcel Tracking", url: "/tracking", icon: Search },
  { title: "Add Admin", url: "/add-admin", icon: UserPlus },
  { title: "Membership Requests", url: "/membership-applications", icon: ClipboardCheck },
  { title: "Profile", url: "/profile", icon: UserRound },
  { title: "Security", url: "/security", icon: ShieldCheck },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const dispatch = useDispatch();
  const navigate = useNavigate();
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-ring text-sidebar-primary font-bold text-sm">
            SU
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
             SwiftKifisha Global
            </span>
          )}
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
