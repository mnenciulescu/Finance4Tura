import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { applyTheme, migrateLegacyTheme, readThemeSetting, THEMES } from "../theme/themes";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

describe("theme migration", () => {
  it("maps the old Light theme to Light", () => {
    localStorage.setItem("appTheme", "light");
    migrateLegacyTheme();
    expect(readThemeSetting()).toBe("light");
    expect(localStorage.getItem("appTheme")).toBeNull();
  });

  it.each(["dusk", "amber", "dark", "prism", "ember"])("maps the old %s theme to Dark", old => {
    localStorage.setItem("appTheme", old);
    migrateLegacyTheme();
    expect(readThemeSetting()).toBe("dark");
  });

  it("defaults to Automatic when nothing was stored", () => {
    migrateLegacyTheme();
    expect(readThemeSetting()).toBe("auto");
  });

  it("does not overwrite a choice already made", () => {
    localStorage.setItem("uiTheme", "light");
    localStorage.setItem("appTheme", "dusk");
    migrateLegacyTheme();
    expect(readThemeSetting()).toBe("light");
  });
});

describe("applying a theme", () => {
  it("sets data-theme and the theme-color meta", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.content).toBe(THEMES.find(t => t.id === "dark")!.metaColor);
    meta.remove();
  });

  it("switches live from the provider and persists the choice", () => {
    function Probe() {
      const { setting, theme, setSetting } = useTheme();
      return <button onClick={() => setSetting("dark")}>{setting}:{theme}</button>;
    }
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole("button").textContent).toBe("auto:light");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("dark:dark");
    expect(localStorage.getItem("uiTheme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
