import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Style-Edit Admin",
  description: "Style-Edit Admin Workspace",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
