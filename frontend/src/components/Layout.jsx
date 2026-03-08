import useIsMobile from "../hooks/useIsMobile";
import Sidebar from "./Sidebar";
import MobileLayout from "./MobileLayout";

export default function Layout({ children }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return (
    <div style={s.shell}>
      <Sidebar />
      <main style={s.main}>{children}</main>
    </div>
  );
}

const s = {
  shell: {
    display:       "flex",
    flexDirection: "column",
    height:        "100vh",
    overflow:      "hidden",
  },
  main: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    padding:        "28px 32px",
    overflow:       "hidden",
    minHeight:      0,
  },
};
