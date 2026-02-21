import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider }    from "../components/auth-context";
import { PlannerProvider } from "../components/planner-store";

export const metadata: Metadata = {
  title:       "Wealth Forecast",
  description: "Plan long-term wealth growth with unified investment inputs and AI-assisted forecasts",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <PlannerProvider>{children}</PlannerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
