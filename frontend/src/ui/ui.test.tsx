import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { Sheet, FormSheet } from "./Sheet";
import { ActionSheet } from "./ActionSheet";
import { Alert } from "./Alert";
import { SwipeActions } from "./SwipeActions";
import { PrivateValue, RevealButton, RevealScope } from "./PrivateValue";
import { Checkbox } from "./Checkbox";
import { Toggle } from "./Toggle";
import { SegmentedControl, SegmentedTabs } from "./Segmented";
import { Rating } from "./Rating";
import { ProgressBar } from "./Display";
import { ToastProvider, useToast } from "./Toast";

const back = () => act(async () => {
  window.history.back();
  await new Promise(r => setTimeout(r, 30));
});

describe("Sheet", () => {
  function Harness({ veto }: { veto?: () => boolean }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <span data-testid="state">{open ? "open" : "closed"}</span>
        <Sheet isOpen={open} onClose={() => setOpen(false)} title="Example" veto={veto}>body</Sheet>
      </>
    );
  }

  it("is a labelled modal dialog with a grabber", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Example" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Example" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("closed"));
  });

  it("closes on the system back button", async () => {
    render(<Harness />);
    await back();
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });

  it("stays open when vetoed", async () => {
    render(<Harness veto={() => true} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await back();
    expect(screen.getByTestId("state").textContent).toBe("open");
  });
});

describe("FormSheet", () => {
  function Harness({ dirty }: { dirty: boolean }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <span data-testid="state">{open ? "open" : "closed"}</span>
        <FormSheet isOpen={open} onClose={() => setOpen(false)} title="New Thing" onSubmit={vi.fn()} isDirty={dirty}>fields</FormSheet>
      </>
    );
  }

  it("has Cancel · Title · Save", () => {
    render(<Harness dirty={false} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New Thing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("closes straight away when nothing changed", () => {
    render(<Harness dirty={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });

  it("asks before discarding changes, from Cancel and from system back", async () => {
    render(<Harness dirty />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Discard Changes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep Editing" }));
    expect(screen.getByTestId("state").textContent).toBe("open");
    // Let the history step from closing the action sheet land (jsdom merges
    // back() calls issued before the previous traversal has been applied).
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });

    await back();
    expect(screen.getByTestId("state").textContent).toBe("open");
    expect(await screen.findByRole("button", { name: "Discard Changes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }));
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });
});

describe("overlay stack and system back", () => {
  it("closes only the top overlay per back press", async () => {
    function Harness() {
      const [sheet, setSheet] = useState(true);
      const [alert, setAlert] = useState(true);
      return (
        <>
          <span data-testid="s">{String(sheet)}</span><span data-testid="a">{String(alert)}</span>
          <Sheet isOpen={sheet} onClose={() => setSheet(false)} title="Below">x</Sheet>
          <Alert isOpen={alert} onClose={() => setAlert(false)} title="On top" actions={[{ label: "OK", onAction: () => setAlert(false) }]} />
        </>
      );
    }
    render(<Harness />);
    await back();
    expect(screen.getByTestId("a").textContent).toBe("false");
    expect(screen.getByTestId("s").textContent).toBe("true");
    await back();
    expect(screen.getByTestId("s").textContent).toBe("false");
  });
});

describe("ActionSheet and Alert", () => {
  it("lists actions plus a separate Cancel", () => {
    const del = vi.fn();
    render(<ActionSheet isOpen onClose={vi.fn()} title="Delete?" actions={[{ label: "Delete This Occurrence", destructive: true, onAction: del }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete This Occurrence" }));
    expect(del).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders an alertdialog with its buttons and error line", () => {
    render(<Alert isOpen onClose={vi.fn()} title="Mark as settled?" error="Wrong password." actions={[{ label: "Cancel", onAction: vi.fn() }, { label: "Mark Settled", onAction: vi.fn(), style: "primary" }]} />);
    expect(screen.getByRole("alertdialog", { name: "Mark as settled?" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Wrong password.");
  });
});

describe("SwipeActions — two-step delete", () => {
  it("arms Delete on the first tap and deletes on the second", () => {
    vi.useFakeTimers();
    const del = vi.fn();
    render(<SwipeActions actions={[{ label: "Delete", destructive: true, onAction: del }]}><div>row</div></SwipeActions>);
    fireEvent.click(screen.getByRole("button", { name: "Delete", hidden: true }));
    expect(del).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm Delete", hidden: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete", hidden: true }));
    expect(del).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("disarms after 4 seconds", () => {
    vi.useFakeTimers();
    render(<SwipeActions actions={[{ label: "Delete", destructive: true, onAction: vi.fn() }]}><div>row</div></SwipeActions>);
    fireEvent.click(screen.getByRole("button", { name: "Delete", hidden: true }));
    act(() => { vi.advanceTimersByTime(4100); });
    expect(screen.getByRole("button", { name: "Delete", hidden: true })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("PrivateValue", () => {
  it("keeps a hidden value out of the DOM entirely", () => {
    render(<p><PrivateValue visible={false}>14.200,00 RON</PrivateValue></p>);
    expect(document.body.textContent).not.toContain("14.200");
    expect(screen.getByRole("img", { name: "Hidden amount" })).toBeInTheDocument();
  });

  it("shows the value when visible", () => {
    render(<p><PrivateValue visible>14.200,00 RON</PrivateValue></p>);
    expect(screen.getByText("14.200,00 RON")).toBeInTheDocument();
  });

  it("reveals a hold group only while the button is held", () => {
    render(<RevealScope><RevealButton group="g" /><PrivateValue mode="hold" group="g">50.583 EUR</PrivateValue></RevealScope>);
    const btn = screen.getByRole("button", { name: "Hold to reveal amounts" });
    expect(screen.queryByText("50.583 EUR")).toBeNull();
    fireEvent.pointerDown(btn);
    expect(screen.getByText("50.583 EUR")).toBeInTheDocument();
    fireEvent.pointerUp(btn);
    expect(screen.queryByText("50.583 EUR")).toBeNull();
    fireEvent.pointerDown(btn);
    fireEvent.pointerCancel(btn);
    expect(screen.queryByText("50.583 EUR")).toBeNull();
  });

  it("re-masks when the app goes to the background", () => {
    render(<RevealScope><RevealButton group="g" /><PrivateValue mode="hold" group="g">secret</PrivateValue></RevealScope>);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Hold to reveal amounts" }));
    expect(screen.getByText("secret")).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event("blur")); });
    expect(screen.queryByText("secret")).toBeNull();
  });
});

describe("controls", () => {
  it("Checkbox reports its state and fires", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Rent: mark as completed" isSelected={false} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Rent: mark as completed" });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("Toggle is a switch", () => {
    const onChange = vi.fn();
    render(<Toggle label="Haptics" isSelected onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Haptics" });
    expect(sw).toBeChecked();
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("SegmentedControl is a radio group; SegmentedTabs a tablist", () => {
    const pick = vi.fn();
    render(<>
      <SegmentedControl label="Status" value="a" options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} onChange={pick} />
      <SegmentedTabs label="Sections" value="x" options={[{ value: "x", label: "X" }, { value: "y", label: "Y" }]} onChange={pick} />
    </>);
    expect(screen.getByRole("radiogroup", { name: "Status" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(pick).toHaveBeenCalledWith("b");
    expect(screen.getByRole("tab", { name: "X" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Y" }));
    expect(pick).toHaveBeenCalledWith("y");
  });

  it("Rating sets a value and clears it on a second tap of the same star", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Rating value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "3 stars" }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    rerender(<Rating value={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "3 stars" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("ProgressBar omits empty segments", () => {
    const { container } = render(<ProgressBar segments={[{ value: 2, color: "red" }, { value: 0, color: "blue" }, { value: 1, color: "green" }]} />);
    expect(container.querySelectorAll("span")).toHaveLength(2);
  });
});

describe("Toast", () => {
  it("shows a status message with an optional action", () => {
    const onAction = vi.fn();
    function Btn() {
      const { show } = useToast();
      return <button onClick={() => show({ message: "New version available", action: { label: "Reload", onAction } })}>go</button>;
    }
    render(<ToastProvider><Btn /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("status")).toHaveTextContent("New version available");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onAction).toHaveBeenCalled();
  });
});
