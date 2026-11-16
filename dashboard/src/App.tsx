import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Shell } from "./components/ui";
import { DataProvider } from "./lib/data";
import Overview from "./pages/Overview";

const Pressure = lazy(() => import("./pages/Pressure"));
const Rankings = lazy(() => import("./pages/Rankings"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const Method = lazy(() => import("./pages/Method"));
const Auction = lazy(() => import("./pages/Auction"));

export default function App() {
  return (
    <DataProvider>
      <Shell>
        <Suspense fallback={<div className="skeleton" style={{ height: 480 }} />}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/pressure" element={<Pressure />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/player/:disc/:id" element={<PlayerPage />} />
            <Route path="/method" element={<Method />} />
            <Route path="/auction" element={<Auction />} />
            <Route path="*" element={<div className="card pad">That page does not exist. <Link to="/" className="accent">Go to the overview</Link></div>} />
          </Routes>
        </Suspense>
      </Shell>
    </DataProvider>
  );
}
