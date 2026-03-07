import Sidebar from "./Sidebar";

export default function Layout({ children }) {
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
