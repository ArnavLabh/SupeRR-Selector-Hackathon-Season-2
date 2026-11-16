import { Component, lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Shell } from "./components/ui";
import { DataProvider, prefetchData } from "./lib/data";
import Overview from "./pages/Overview";

/** After a redeploy, an open tab may ask for page files that no longer exist.
    Reload once to pick up the new build instead of leaving a blank page. */
function load<T extends { default: ComponentType }>(f: () => Promise<T>) {
  return () => f().then((m) => { sessionStorage.removeItem("chunk-reload"); return m; }).catch((e) => {
    if (!sessionStorage.getItem("chunk-reload")) { sessionStorage.setItem("chunk-reload", "1"); window.location.reload(); }
    throw e;
  });
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="card pad stack" role="alert"><b>This page did not load.</b><span className="muted">Usually a new version was just published.</span><button className="btn primary" style={{ justifySelf: "start" }} onClick={() => window.location.reload()}>Reload</button></div>
      : this.props.children;
  }
}

const pages = {
  pressure: load(() => import("./pages/Pressure")), rankings: load(() => import("./pages/Rankings")), player: load(() => import("./pages/PlayerPage")),
  method: load(() => import("./pages/Method")), auction: load(() => import("./pages/Auction")),
};
const Pressure = lazy(pages.pressure);
const Rankings = lazy(pages.rankings);
const PlayerPage = lazy(pages.player);
const Method = lazy(pages.method);
const Auction = lazy(pages.auction);

/** After the first paint, quietly load every page and data file so navigation is instant. */
function usePreload() {
  useEffect(() => {
    const go = () => { Object.values(pages).forEach((f) => f().catch(() => undefined)); prefetchData(); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go); else setTimeout(go, 600);
  }, []);
}

export default function App() {
  usePreload();
  return (
    <DataProvider>
      <Shell>
        <Boundary>
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
        </Boundary>
      </Shell>
    </DataProvider>
  );
}
