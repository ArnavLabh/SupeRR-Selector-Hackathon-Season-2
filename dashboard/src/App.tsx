import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/ui";
import { DataProvider } from "./lib/data";
import Overview from "./pages/Overview";
import Pressure from "./pages/Pressure";
import Rankings from "./pages/Rankings";
import PlayerPage from "./pages/PlayerPage";
import Method from "./pages/Method";
import Auction from "./pages/Auction";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Shell>
      <ScrollTop />
      <DataProvider>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/pressure" element={<Pressure />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/player/:disc/:id" element={<PlayerPage />} />
          <Route path="/method" element={<Method />} />
          <Route path="/auction" element={<Auction />} />
          <Route path="*" element={<div className="callout">That page does not exist. Use the navigation above.</div>} />
        </Routes>
      </DataProvider>
    </Shell>
  );
}
