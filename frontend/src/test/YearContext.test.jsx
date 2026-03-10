import { render, screen, act } from "@testing-library/react";
import { YearProvider, useYear } from "../context/YearContext";

function YearDisplay() {
  const { selectedYear, availableYears, setSelectedYear, setAvailableYears } = useYear();
  return (
    <div>
      <span data-testid="selected">{selectedYear}</span>
      <span data-testid="available">{availableYears.join(",")}</span>
      <button onClick={() => setSelectedYear(2025)}>Set 2025</button>
      <button onClick={() => setAvailableYears([2024, 2025, 2026])}>Set years</button>
    </div>
  );
}

describe("YearContext", () => {
  it("defaults selectedYear to the current calendar year", () => {
    render(<YearProvider><YearDisplay /></YearProvider>);
    expect(screen.getByTestId("selected").textContent).toBe(String(new Date().getFullYear()));
  });

  it("defaults availableYears to contain only the current year", () => {
    render(<YearProvider><YearDisplay /></YearProvider>);
    expect(screen.getByTestId("available").textContent).toBe(String(new Date().getFullYear()));
  });

  it("setSelectedYear updates the selectedYear value", async () => {
    render(<YearProvider><YearDisplay /></YearProvider>);
    await act(async () => {
      screen.getByText("Set 2025").click();
    });
    expect(screen.getByTestId("selected").textContent).toBe("2025");
  });

  it("setAvailableYears updates the available years list", async () => {
    render(<YearProvider><YearDisplay /></YearProvider>);
    await act(async () => {
      screen.getByText("Set years").click();
    });
    expect(screen.getByTestId("available").textContent).toBe("2024,2025,2026");
  });

  it("provides all context values to consumers", () => {
    let ctx;
    function Capture() {
      ctx = useYear();
      return null;
    }
    render(<YearProvider><Capture /></YearProvider>);
    expect(typeof ctx.selectedYear).toBe("number");
    expect(Array.isArray(ctx.availableYears)).toBe(true);
    expect(typeof ctx.setSelectedYear).toBe("function");
    expect(typeof ctx.setAvailableYears).toBe("function");
  });
});
